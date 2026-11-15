"""ضمان وصول كل إيصال للمنظومة حتى مع انقطاع الإنترنت (المرحلة 5).

الطابور = صفوف الإيصالات نفسها (sales / sale_returns) وحالتها eta_status، وليس core/outbox:
  - الإيصال يحتاج ترتيب سلسلة لكل جهاز وانتظار مرتجع لقبول فاتورته؛ أحداث الـ outbox مستقلة غير مرتبة.
  - حالاته متعددة الخطوات (لم يُرسل/في الطريق/معلّق/مقبول/مرفوض) ومستنده وUUID مخزّنان في الصف أصلاً.
  - الـ UUID مفتاح طبيعي لمنع التكرار يعرفه خادم المنظومة نفسه.
  - الـ outbox لا عامل يستهلكه حالياً، ووجهته مختلفة (المزامنة).

الحالات في الطابور (eta_status + eta_submission_uuid + eta_sent_at):
  not_sent                               ← ينتظر دوره في سلسلة جهازه
  pending وبلا submission و sent_at      ← «في الطريق»: خرج الطلب ولا نعرف هل وصل (أو 422 مكرر)
  pending ومعه submission                ← وصل، والمنظومة تتحقق منه
  accepted / rejected                    ← نهائي

القواعد:
  1) الترتيب: لكل جهاز بترتيب eta_seq. لا يُرسل جديد والجهاز عنده إيصالات «في الطريق» (تُسوّى أولاً).
  2) المرتجع لا يُرسل قبل «مقبول» لفاتورته الأصلية، وكل ما بعده في سلسلة الجهاز ينتظره. لو رُفضت
     الفاتورة نهائياً: السلسلة موقوفة بتنبيه حتى يقرر المدير (release_return).
  3) الكتابة المسبقة (write-ahead): قبل الإرسال تُسجَّل الدفعة «في الطريق» ثم commit، ثم الطلب.
     انقطاع/إغلاق البرنامج بعدها ← عند الاستئناف نسأل المنظومة عن كل إيصال بالـ UUID:
       وصلها ← نتيجته. لم يصلها (404) بعد مهلة كافية ← يرجع «لم يُرسل» ويُرسل مرة واحدة.
     فلا يُرسل نفس الإيصال مرتين بالخطأ، ولا يضيع إيصال.
  4) إعادة المحاولة بتأجيل متزايد، والطابور في القاعدة فيستأنف بعد إعادة التشغيل تلقائياً.
  5) مهلة الإرسال: «The receipt is allowed to be submitted within the allowed duration (24 hours)»
     (receiptissuancefaq). تنبيه بعد LATE_WARNING_HOURS لإيصال لم يصل بعد.
  6) الجهاز المصدر هو المرسل: كل دفعة من جهاز واحد ببياناته هو (رقمه التسلسلي وClient ID)، وكل فرع
     يرسل من قاعدته فقط (لا إرسال بالنيابة عن فروع أخرى).
  7) البيع لا ينتظر شيئاً من هنا: العامل في thread منفصل ومعاملاته قصيرة بلا اتصال شبكة بداخلها.
  8) تغيّر أعداد الطابور ← حدث realtime «e_receipt» (لا «sales»: لا داعي لإعادة جلب المبيعات).
"""

import hashlib
import logging
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.config import get_settings
from app.core.database import get_sessionmaker, get_write_sessionmaker
from app.core.realtime import hub, replace_topics
from app.core.secret_box import open_secret
from app.core.security import Actor, Role
from app.modules.devices.model import DeviceEtaProfile
from app.modules.eta.constants import EtaEnvironment
from app.modules.eta.service import EtaService, _secret_context
from app.modules.sales.model import Sale, SaleReturn

from .client import (
    DeviceCredentials,
    EtaAuthError,
    EtaClient,
    EtaError,
    EtaNetworkError,
    EtaRateLimited,
    EtaRequestError,
)
from .constants import ENTITY_E_RECEIPT, EReceiptStatus
from .model import EReceiptAttempt
from .service import is_active

log = logging.getLogger(__name__)

MAX_BATCH_RECEIPTS = 500  # «Maximum Submission Size is 500 receipts (1.5 Mbytes)»
MAX_BATCH_BYTES = 1_500_000
MIN_INTERVAL = 1.0  # ثانية بين طلبات نفس الجهاز
RECEIPT_POLL_INTERVAL = 0.5  # Get Receipt Details: «2 requests every 1 second»
WORKER_INTERVAL = 60
NETWORK_BACKOFF = (15, 30, 60, 120, 300)  # ثوانٍ؛ بحد أقصى 5 دقائق فيلحق برجوع الشبكة سريعاً
RESEND_GRACE = timedelta(minutes=15)  # «في الطريق» ولم تجده المنظومة: بعد هذه المدة فقط يُعاد إرساله
SUBMIT_WINDOW = timedelta(hours=24)  # مهلة الإرسال من الـ SDK
LATE_WARNING = timedelta(hours=18)  # تنبيه قبل انتهاء المهلة بست ساعات
SYSTEM_ACTOR_ID = "system"
REALTIME_TOPIC = "e_receipt"
_DUPLICATE_HINTS = ("duplicate", "already exist", "مكرر")

ReceiptModel = type[Sale] | type[SaleReturn]


@dataclass(frozen=True, slots=True)
class Pending:
    model: ReceiptModel
    id: str
    uuid: str
    document: str
    seq: int
    reference_uuid: str | None = None  # للمرتجع: UUID الفاتورة الأصلية
    release: bool = False
    submission_uuid: str | None = None
    sent_at: datetime | None = None
    number: str | None = None


@dataclass
class DeviceState:
    blocked_until: float = 0.0
    failures: int = 0
    auth_error: str | None = None
    auth_fingerprint: str | None = None
    # مرتجع يوقف السلسلة (فاتورته الأصلية مرفوضة) حتى قرار المدير: (id، رقم الإيصال)
    held_return_id: str | None = None
    held_by: str | None = None

    def as_dict(self, now: float) -> dict[str, Any]:
        return {"wait_seconds": max(round(self.blocked_until - now), 0), "auth_error": self.auth_error,
                "held_by": self.held_by, "held_return_id": self.held_return_id}  # fmt: skip


@dataclass
class CycleSummary:
    submitted: int = 0
    accepted: int = 0
    rejected: int = 0
    resolved: int = 0
    errors: list[str] = field(default_factory=list)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(moment: datetime | None) -> datetime | None:
    if moment is None:
        return None
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


def _fingerprint(creds: DeviceCredentials) -> str:
    raw = "|".join((creds.client_id, creds.client_secret, creds.pos_serial, creds.pos_os_version,
                    creds.pos_model_framework, creds.preshared_key or "", creds.environment.value))  # fmt: skip
    return hashlib.sha256(raw.encode()).hexdigest()


def load_credentials(session: Session, device_id: str, environment: EtaEnvironment) -> DeviceCredentials | str:
    """بيانات مصادقة الجهاز مفكوكة في الذاكرة فقط، أو رسالة بما ينقص."""
    profile = session.scalar(
        select(DeviceEtaProfile).where(DeviceEtaProfile.pos_device_id == device_id, DeviceEtaProfile.deleted_at.is_(None))
    )
    if profile is None or not (profile.client_id and profile.pos_serial and profile.pos_os_version and profile.pos_model_framework):
        return "بيانات الجهاز في المنظومة ناقصة"
    secret = open_secret(profile.client_secret_enc, _secret_context(device_id, "client_secret"))
    if secret is None:
        return "Client Secret غير مكتوب أو يحتاج إعادة إدخال"
    psk = open_secret(profile.preshared_key_enc, _secret_context(device_id, "preshared_key"))
    return DeviceCredentials(
        device_id=device_id, environment=environment, client_id=profile.client_id, client_secret=secret,
        pos_serial=profile.pos_serial, pos_os_version=profile.pos_os_version,
        pos_model_framework=profile.pos_model_framework, preshared_key=psk,
    )  # fmt: skip


def _system_actor() -> Actor:
    return Actor(user_id=SYSTEM_ACTOR_ID, role=Role.OWNER, device_id=get_settings().device_id)


def batches(items: list[Pending]) -> list[list[Pending]]:
    """دفعات بحد العدد والحجم، بترتيب السلسلة."""
    out: list[list[Pending]] = []
    current: list[Pending] = []
    empty = len('{"receipts":[],"signatures":[]}')
    size = empty
    for item in items:
        extra = len(item.document.encode("utf-8")) + 1
        if current and (len(current) >= MAX_BATCH_RECEIPTS or size + extra > MAX_BATCH_BYTES):
            out.append(current)
            current, size = [], empty
        current.append(item)
        size += extra
    if current:
        out.append(current)
    return out


# ================= قراءة الطابور =================
def _rows(session: Session, *statuses: EReceiptStatus) -> dict[str, list[Pending]]:
    """إيصالات بحالات معينة لكل جهاز بترتيب السلسلة (بيع ومرتجع معاً)."""
    by_device: dict[str, list[Pending]] = {}
    values = [s.value for s in statuses]
    for model in (Sale, SaleReturn):
        cols = [model.id, model.eta_uuid, model.eta_document, model.eta_seq, model.eta_device_id,
                model.eta_submission_uuid, model.eta_sent_at, model.eta_receipt_number]  # fmt: skip
        if model is SaleReturn:
            cols += [SaleReturn.eta_reference_uuid, SaleReturn.eta_release]
        rows = session.execute(
            select(*cols).where(model.eta_status.in_(values), model.eta_uuid.is_not(None), model.deleted_at.is_(None))
        ).all()
        for r in rows:
            by_device.setdefault(r[4], []).append(
                Pending(model, r[0], r[1], r[2] or "", r[3] or 0, submission_uuid=r[5], sent_at=_aware(r[6]),
                        number=r[7], reference_uuid=r[8] if model is SaleReturn else None,
                        release=bool(r[9]) if model is SaleReturn else False)  # fmt: skip
            )
    for items in by_device.values():
        items.sort(key=lambda p: p.seq)
    return by_device


def _sale_status(session: Session, uuids: set[str]) -> dict[str, str | None]:
    if not uuids:
        return {}
    rows = session.execute(
        select(Sale.eta_uuid, Sale.eta_replaced_uuid, Sale.eta_status).where(
            or_(Sale.eta_uuid.in_(uuids), Sale.eta_replaced_uuid.in_(uuids))
        )
    ).all()
    out: dict[str, str | None] = {}
    for uuid, replaced, status in rows:
        out[uuid] = status
        if replaced:  # الأصل صُحّح بـ UUID جديد: المرتجع المشير للقديم يتبع حالة المصحَّح
            out[replaced] = status
    return out


def queue_counts(session: Session, now: datetime | None = None) -> dict[str, int]:
    """أعداد الطابور للواجهة والـ realtime: لم يصل بعد، مرفوض، متأخر (قارب المهلة)، تجاوز المهلة."""
    now = now or _now()
    out = {"waiting": 0, "rejected": 0, "late": 0, "overdue": 0}
    for model in (Sale, SaleReturn):
        unsent = (model.eta_status == EReceiptStatus.NOT_SENT.value) | (
            (model.eta_status == EReceiptStatus.PENDING.value) & model.eta_submission_uuid.is_(None)
        )
        out["waiting"] += session.scalar(
            select(func.count()).select_from(model).where(
                model.eta_status.in_([EReceiptStatus.NOT_SENT.value, EReceiptStatus.PENDING.value])
            )
        ) or 0
        out["rejected"] += session.scalar(
            select(func.count()).select_from(model).where(
                model.eta_status.in_([EReceiptStatus.REJECTED.value, EReceiptStatus.INVALID.value])
            )
        ) or 0
        out["late"] += session.scalar(
            select(func.count()).select_from(model).where(unsent, model.created_at < now - LATE_WARNING)
        ) or 0
        out["overdue"] += session.scalar(
            select(func.count()).select_from(model).where(unsent, model.created_at < now - SUBMIT_WINDOW)
        ) or 0
    return out


class Sender:
    def __init__(self, client: EtaClient | None = None, *, sleep=time.sleep, clock=time.monotonic,  # noqa: ANN001
                 wall=_now) -> None:  # fmt: skip
        self.client = client or EtaClient()
        self.sleep = sleep
        self.clock = clock
        self.wall = wall  # الوقت الفعلي (لمهلة إعادة الإرسال والتأخر)؛ قابل للاستبدال في الاختبار
        self.devices: dict[str, DeviceState] = {}
        self._run_lock = threading.Lock()
        self._last_call: dict[str, float] = {}
        self._last_counts: dict[str, int] | None = None

    # ---------- أدوات ----------
    def _state(self, device_id: str) -> DeviceState:
        return self.devices.setdefault(device_id, DeviceState())

    def _pace(self, device_id: str, interval: float = MIN_INTERVAL) -> None:
        last = self._last_call.get(device_id)
        if last is not None:
            wait = interval - (self.clock() - last)
            if wait > 0:
                self.sleep(wait)
        self._last_call[device_id] = self.clock()

    def _record(
        self, *, device_id: str, env: EtaEnvironment, operation: str, outcome: str, started: float,
        error: EtaError | None = None, submission_uuid: str | None = None, receipts: int = 0,
        accepted: int = 0, rejected: int = 0, message: str | None = None, audit: dict[str, Any] | None = None,
    ) -> None:  # fmt: skip
        """محاولة في جدول التشخيص (+ سجل التدقيق). بلا توكن ولا أسرار ولا مستندات."""
        with get_write_sessionmaker()() as session:
            session.add(
                EReceiptAttempt(
                    pos_device_id=device_id, environment=env.value, operation=operation, outcome=outcome,
                    http_status=error.status if error else None, submission_uuid=submission_uuid,
                    receipts_count=receipts, accepted_count=accepted, rejected_count=rejected,
                    retry_after=getattr(error, "retry_after", None),
                    correlation_id=error.correlation_id if error else None,
                    message=(message or (error.message if error else None)),
                    duration_ms=int((self.clock() - started) * 1000),
                )
            )  # fmt: skip
            if audit is not None:
                record_audit(session, _system_actor(), entity=ENTITY_E_RECEIPT,
                             entity_id=submission_uuid or device_id, action=f"{operation}_{outcome}", changes=audit)  # fmt: skip
            session.flush()
            replace_topics(session, set())  # سجل تشخيص: لا يهم أجهزة الكاشير
            session.commit()

    @staticmethod
    def _apply(updates: list[tuple[ReceiptModel, str, dict[str, Any]]]) -> None:
        """تحديث حالات الإيصالات في معاملة قصيرة (بلا شبكة). لا يُعلن «sales» (أعداد الطابور تُعلن منفصلة)."""
        if not updates:
            return
        with get_write_sessionmaker()() as session:
            for model, rid, values in updates:
                row = session.get(model, rid)
                if row is None:
                    continue
                for key, value in values.items():
                    setattr(row, key, value)
            session.flush()
            replace_topics(session, set())
            session.commit()

    def _on_error(self, device_id: str, creds: DeviceCredentials, error: EtaError, summary: CycleSummary) -> None:
        state = self._state(device_id)
        if isinstance(error, EtaRateLimited):
            state.blocked_until = self.clock() + error.retry_after
        elif isinstance(error, EtaNetworkError):
            state.blocked_until = self.clock() + NETWORK_BACKOFF[min(state.failures, len(NETWORK_BACKOFF) - 1)]
            state.failures += 1
        elif isinstance(error, EtaAuthError):
            state.auth_error = error.message
            state.auth_fingerprint = _fingerprint(creds)
            self.client.forget(creds)
        summary.errors.append(f"{device_id}: {error.kind}: {error.message}")
        log.warning("eta %s device=%s status=%s correlation=%s", error.kind, device_id, error.status, error.correlation_id)

    def _can_call(self, device_id: str, creds: DeviceCredentials, force: bool) -> bool:
        state = self._state(device_id)
        if state.auth_error:
            if force or state.auth_fingerprint != _fingerprint(creds):
                state.auth_error = state.auth_fingerprint = None
            else:
                return False
        return force or state.blocked_until <= self.clock()

    # ---------- الترتيب والانتظار ----------
    def _sendable(self, device_id: str, queue: list[Pending], originals: dict[str, str | None]) -> list[Pending]:
        """البادئة القابلة للإرسال من سلسلة الجهاز: تتوقف عند أول مرتجع فاتورته لم تُقبل بعد."""
        state = self._state(device_id)
        state.held_by = state.held_return_id = None
        out: list[Pending] = []
        for item in queue:
            if item.model is SaleReturn and item.reference_uuid and not item.release:
                status = originals.get(item.reference_uuid)
                if status != EReceiptStatus.ACCEPTED.value:
                    if status in (EReceiptStatus.REJECTED.value, EReceiptStatus.INVALID.value):
                        state.held_by = item.number or item.id  # تنبيه: يحتاج قرار المدير
                        state.held_return_id = item.id
                    break  # ما بعده في السلسلة ينتظره
            out.append(item)
        return out

    # ---------- التسوية: «في الطريق» ----------
    def _reconcile(self, device_id: str, items: list[Pending], creds: DeviceCredentials, summary: CycleSummary) -> bool:
        """إيصالات خرجت ولا نعرف مصيرها: نسأل المنظومة عن كل واحد بالـ UUID. True = لم يبق شيء معلّق الهوية."""
        started = self.clock()
        updates: list[tuple[ReceiptModel, str, dict[str, Any]]] = []
        unresolved = 0
        try:
            for p in items:
                self._pace(device_id, RECEIPT_POLL_INTERVAL)
                state = self.client.receipt(creds, p.uuid)
                final = self._final(state.status)
                if state.status == "NotFound":
                    sent_at = p.sent_at or self.wall()
                    if self.wall() - sent_at >= RESEND_GRACE:  # لم يصلها فعلاً: يُعاد في دوره
                        updates.append((p.model, p.id, {"eta_status": EReceiptStatus.NOT_SENT.value, "eta_sent_at": None}))
                    else:
                        unresolved += 1
                elif final is None:  # وصلها وما زال قيد التحقق
                    unresolved += 1
                else:
                    status, note = final
                    updates.append((p.model, p.id, self._final_values(status, state.message or note)))
                    summary.resolved += 1
                    summary.accepted += status is EReceiptStatus.ACCEPTED
                    summary.rejected += status is EReceiptStatus.REJECTED
        except EtaError as error:
            self._apply(updates)
            self._on_error(device_id, creds, error, summary)
            self._record(device_id=device_id, env=creds.environment, operation="reconcile", outcome=error.kind,
                         started=started, error=error, receipts=len(items))  # fmt: skip
            return False
        self._apply(updates)
        if updates:
            self._record(device_id=device_id, env=creds.environment, operation="reconcile", outcome="ok",
                         started=started, receipts=len(updates), message=f"تمت تسوية {len(updates)} إيصال")  # fmt: skip
        return unresolved == 0

    # ---------- الإرسال ----------
    def _send(self, device_id: str, items: list[Pending], creds: DeviceCredentials, summary: CycleSummary) -> None:
        for batch in batches(items):
            self._pace(device_id)
            started = self.clock()
            try:
                self.client.ensure_token(creds)  # فشل هنا = لم يخرج شيء
            except EtaError as error:
                self._on_error(device_id, creds, error, summary)
                self._record(device_id=device_id, env=creds.environment, operation="submit", outcome=error.kind,
                             started=started, error=error, receipts=len(batch),
                             audit={"receipts": len(batch), "error": error.message} if isinstance(error, EtaAuthError) else None)  # fmt: skip
                return
            # write-ahead: الدفعة «في الطريق» قبل الطلب، فإغلاق البرنامج أثناءه لا يضيّع ولا يكرر.
            sent_at = self.wall()
            self._apply([(p.model, p.id, {"eta_status": EReceiptStatus.PENDING.value, "eta_submission_uuid": None,
                                          "eta_sent_at": sent_at}) for p in batch])  # fmt: skip
            try:
                result = self.client.submit(creds, [p.document for p in batch])
            except EtaError as error:
                self._submit_failed(device_id, batch, creds, error, started, summary)
                return
            self._state(device_id).failures = 0
            rejected = {r.uuid: r for r in result.rejected if r.uuid}
            updates, n_rej, n_dup = [], 0, 0
            for p in batch:
                base = {"eta_submission_uuid": result.submission_uuid}
                if p.uuid in rejected:
                    message = rejected[p.uuid].message
                    if any(h in message.lower() for h in _DUPLICATE_HINTS):
                        n_dup += 1  # وصلها من قبل (أُعيد بعد انقطاع): لا نرفضه، نسوّيه بالـ UUID
                        updates.append((p.model, p.id, {"eta_submission_uuid": None}))
                        continue
                    n_rej += 1
                    updates.append((p.model, p.id, {**base, "eta_status": EReceiptStatus.REJECTED.value, "eta_error": message}))
                else:
                    updates.append((p.model, p.id, {**base, "eta_long_id": result.accepted.get(p.uuid), "eta_error": None}))
            self._apply(updates)
            summary.submitted += len(batch)
            summary.rejected += n_rej
            self._record(
                device_id=device_id, env=creds.environment, operation="submit",
                outcome="ok" if not n_rej else ("rejected" if n_rej == len(batch) else "partial"),
                started=started, submission_uuid=result.submission_uuid, receipts=len(batch),
                accepted=len(batch) - n_rej - n_dup, rejected=n_rej,
                audit={"receipts": len(batch), "accepted": len(batch) - n_rej - n_dup, "rejected": n_rej,
                       "already_received": n_dup, "first_seq": batch[0].seq, "last_seq": batch[-1].seq,
                       "rejected_numbers": [r.receipt_number for r in result.rejected][:20]},
            )  # fmt: skip
            if n_dup:
                return  # تسوية المكرر أولاً قبل أي إرسال جديد (حفاظاً على الترتيب)

    def _submit_failed(self, device_id: str, batch: list[Pending], creds: DeviceCredentials, error: EtaError,
                       started: float, summary: CycleSummary) -> None:  # fmt: skip
        """ماذا نعرف عن مصير الدفعة؟ لم تصل ← ترجع «لم يُرسل». ربما وصلت ← تبقى «في الطريق» للتسوية."""
        reached = (isinstance(error, EtaNetworkError) and error.maybe_sent) or (
            isinstance(error, EtaRateLimited) and error.status == 422  # DuplicateSubmission: وصلت من قبل
        )
        if isinstance(error, EtaRequestError):  # بنية/حجم: لا إعادة تلقائية، يُعرض للمستخدم
            message = f"رفضت المنظومة الدفعة: {error.message}"
            self._apply([(p.model, p.id, {"eta_status": EReceiptStatus.REJECTED.value, "eta_error": message})
                         for p in batch])  # fmt: skip
            summary.rejected += len(batch)
            self._record(device_id=device_id, env=creds.environment, operation="submit", outcome="bad_request",
                         started=started, error=error, receipts=len(batch), rejected=len(batch),
                         audit={"receipts": len(batch), "error": error.message})  # fmt: skip
            return
        if not reached:
            self._apply([(p.model, p.id, {"eta_status": EReceiptStatus.NOT_SENT.value, "eta_sent_at": None})
                         for p in batch])  # fmt: skip
        outcome = "duplicate" if isinstance(error, EtaRateLimited) and error.status == 422 else error.kind
        if outcome != "duplicate":
            self._on_error(device_id, creds, error, summary)
        self._record(device_id=device_id, env=creds.environment, operation="submit", outcome=outcome,
                     started=started, error=error, receipts=len(batch),
                     message=f"{error.message} — الدفعة {'قيد التسوية (ربما وصلت)' if reached else 'لم تصل وتُعاد'}")  # fmt: skip

    # ---------- متابعة الدفعات المعروفة ----------
    @staticmethod
    def _final(status: str) -> tuple[EReceiptStatus, str | None] | None:
        if status == "Valid":
            return EReceiptStatus.ACCEPTED, None
        if status == "Invalid":
            return EReceiptStatus.REJECTED, None
        if status == "Cancelled":
            return EReceiptStatus.REJECTED, "أُلغي الإيصال في المنظومة"
        return None

    @staticmethod
    def _final_values(status: EReceiptStatus, message: str | None) -> dict[str, Any]:
        return {"eta_status": status.value,
                "eta_error": None if status is EReceiptStatus.ACCEPTED else (message or "رفضته المنظومة")}  # fmt: skip

    def _poll(self, device_id: str, items: list[Pending], creds: DeviceCredentials, summary: CycleSummary) -> None:
        subs: dict[str, list[Pending]] = {}
        for p in items:
            subs.setdefault(p.submission_uuid or "", []).append(p)
        for submission_uuid, group in subs.items():
            by_uuid = {p.uuid: p for p in group}
            started = self.clock()
            states = []
            try:
                page, pages = 1, 1
                while page <= pages:
                    self._pace(device_id)
                    result = self.client.submission(creds, submission_uuid, page=page)
                    states += result.receipts
                    pages, page = result.total_pages, page + 1
            except EtaError as error:
                self._on_error(device_id, creds, error, summary)
                self._record(device_id=device_id, env=creds.environment, operation="poll", outcome=error.kind,
                             started=started, error=error, submission_uuid=submission_uuid, receipts=len(group))  # fmt: skip
                return
            updates, ok, bad = [], 0, 0
            for state in states:
                p = by_uuid.get(state.uuid)
                final = self._final(state.status)
                if p is None or final is None:
                    continue
                status, note = final
                ok += status is EReceiptStatus.ACCEPTED
                bad += status is EReceiptStatus.REJECTED
                updates.append((p.model, p.id, self._final_values(status, state.message or note)))
            if updates:
                self._apply(updates)
                summary.resolved += len(updates)
                summary.accepted += ok
                summary.rejected += bad
                self._record(device_id=device_id, env=creds.environment, operation="poll",
                             outcome="ok" if not bad else ("rejected" if not ok else "partial"), started=started,
                             submission_uuid=submission_uuid, receipts=len(updates), accepted=ok, rejected=bad,
                             audit={"accepted": ok, "rejected": bad})  # fmt: skip

    # ---------- الدورة ----------
    def _device(self, device_id: str, creds: DeviceCredentials, force: bool, summary: CycleSummary) -> None:
        """دورة جهاز واحد: تسوية «في الطريق» ← متابعة الدفعات ← إرسال البادئة المسموحة بالترتيب."""
        if not self._can_call(device_id, creds, force):
            return
        with get_sessionmaker()() as session:
            pending = _rows(session, EReceiptStatus.PENDING).get(device_id, [])
        in_flight = [p for p in pending if not p.submission_uuid]
        if in_flight and not self._reconcile(device_id, in_flight, creds, summary):
            return  # لا إرسال جديد قبل معرفة مصير ما خرج (الترتيب + عدم التكرار)
        known = [p for p in pending if p.submission_uuid]
        if known and self._can_call(device_id, creds, False):
            self._poll(device_id, known, creds, summary)
        if not self._can_call(device_id, creds, False):
            return
        with get_sessionmaker()() as session:
            queue = _rows(session, EReceiptStatus.NOT_SENT).get(device_id, [])
            originals = _sale_status(session, {p.reference_uuid for p in queue if p.reference_uuid})
        sendable = self._sendable(device_id, queue, originals)
        if sendable:
            self._send(device_id, sendable, creds, summary)

    def run_cycle(self, *, force: bool = False) -> CycleSummary:
        summary = CycleSummary()
        if not self._run_lock.acquire(blocking=False):
            summary.errors.append("دورة إرسال أخرى تعمل الآن")
            return summary
        try:
            with get_sessionmaker()() as session:
                if not is_active(session):
                    return summary
                env = EtaService(session, _system_actor()).config().environment
                devices = set(_rows(session, EReceiptStatus.NOT_SENT, EReceiptStatus.PENDING))
                creds = {d: load_credentials(session, d, env) for d in devices}
            for device_id in sorted(creds):
                c = creds[device_id]
                if isinstance(c, str):
                    self._state(device_id).auth_error = c
                    summary.errors.append(f"{device_id}: {c}")
                    continue
                self._device(device_id, c, force, summary)
            return summary
        finally:
            self._run_lock.release()
            self._announce()

    def _announce(self) -> None:
        """حدث realtime «e_receipt» فقط لو تغيّرت أعداد الطابور (لم يصل/مرفوض/متأخر)."""
        try:
            with get_sessionmaker()() as session:
                counts = queue_counts(session, self.wall())
        except Exception:  # noqa: BLE001
            return
        if counts != self._last_counts:
            self._last_counts = counts
            hub.publish({REALTIME_TOPIC})

    def test_connection(self, session: Session, device_id: str) -> dict[str, Any]:
        """مصادقة فقط (زر «اختبار الاتصال»)."""
        env = EtaService(session, _system_actor()).config().environment
        creds = load_credentials(session, device_id, env)
        started = self.clock()
        if isinstance(creds, str):
            return {"ok": False, "environment": env.value, "message": creds}
        try:
            info = self.client.authenticate(creds)
        except EtaError as error:
            self._record(device_id=device_id, env=env, operation="test", outcome=error.kind, started=started, error=error)
            return {"ok": False, "environment": env.value, "message": error.message, "kind": error.kind,
                    "correlation_id": error.correlation_id}  # fmt: skip
        state = self._state(device_id)
        state.auth_error = state.auth_fingerprint = None
        self._record(device_id=device_id, env=env, operation="test", outcome="ok", started=started)
        return {"ok": True, "environment": env.value, "message": "تم الاتصال بالمنظومة بنجاح", "expires_in": info.expires_in}


def release_return(session: Session, actor: Actor, ret: SaleReturn) -> None:
    """قرار المدير: يُرسل المرتجع رغم رفض فاتورته الأصلية (ستكمل سلسلة الجهاز، والمنظومة سترفضه غالباً)."""
    ret.eta_release = True
    record_audit(session, actor, entity=ENTITY_E_RECEIPT, entity_id=ret.id, action="release_return",
                 changes={"return_number": ret.number, "reference_uuid": ret.eta_reference_uuid})  # fmt: skip
    session.commit()


sender = Sender()


def start_worker() -> None:
    """عند الإقلاع: دورة فورية (استئناف ما انقطع، ومنه «في الطريق»)، ثم كل دقيقة. لا شيء والميزة متوقفة."""

    def loop() -> None:
        delay = 5  # مهلة قصيرة بعد الإقلاع حتى يكتمل init_db
        while True:
            time.sleep(delay)
            delay = WORKER_INTERVAL
            try:
                sender.run_cycle()
            except Exception:  # noqa: BLE001 - الخلفية لا تتوقف أبداً
                log.exception("e-receipt worker cycle failed")

    threading.Thread(target=loop, name="e-receipt-sender", daemon=True).start()
