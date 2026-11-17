"""تنبيهات تطبيق الهاتف (المالك ومديرو الفروع).

دورة واحدة كل دقيقة (python -m app.cli notifier):
  1) produce: يكتشف الأحداث ويُنشئ تنبيهاً **واحداً لكل حدث لكل حساب** (dedup_key فريد في القاعدة):
     - branch_offline   فرع غير متصل أكثر من المدة التي يختارها المستخدم (مرة لكل انقطاع)
     - eta_rejected     إيصالات إلكترونية مرفوضة جديدة (من الملخص اليومي للفرع)
     - transfer_request طلب تحويل ينتظر موافقة هذا الحساب (المالك أو مدير الفرع المطلوب منه)
     - low_sales        صافي مبيعات أمس أقل كثيراً من متوسط نفس اليوم في الأسابيع السابقة
     - recap            «ملخص يومك/أسبوعك جاهز» في الساعة التي يختارها المستخدم (الأرقام في التطبيق فقط)
  2) send: لكل حساب، التنبيهات المنتظرة تُرسل **معاً في إشعار واحد** (لا أكثر من إشعار كل
     notify_min_gap_minutes)، ولا شيء في ساعات الهدوء (تُرسل مجمّعة بعدها)، وما لم يعد صحيحاً
     (الفرع رجع، الطلب اتحسم) يُسقط قبل الإرسال.

المحتوى يظهر على شاشة القفل: نوع الحدث واسم الفرع فقط. لا مبالغ، ولا أرقام مبيعات، ولا أسماء عملاء أو أصناف.
"""

import logging
import uuid
from collections.abc import Callable
from datetime import UTC, date, datetime, time, timedelta
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..audit import record
from ..config import get_settings
from ..db import utcnow
from ..errors import AppError
from ..models import (
    Branch,
    BranchRecord,
    CatalogItem,
    DailyStat,
    MobileSession,
    Notification,
    NotificationPrefs,
    Shop,
    Transfer,
)
from ..schemas import NotificationPrefsBody
from .mobile_auth import Account, _account, check_shop

log = logging.getLogger("notify")

KINDS = ("branch_offline", "eta_rejected", "transfer_request", "low_sales", "sensitive_op", "cash_diff", "recap")
DEFAULT_OFFSET = 120  # مصر

# دالة الإرسال: رسائل Expo ← تذاكر (قابلة للاستبدال في الاختبارات).
PushFn = Callable[[list[dict[str, Any]]], list[dict[str, Any]]]


def _aware(value: datetime | None) -> datetime | None:
    return value if value is None or value.tzinfo else value.replace(tzinfo=UTC)


def _ago(delta: timedelta) -> str:
    minutes = int(delta.total_seconds() // 60)
    if minutes < 60:
        return f"{minutes} دقيقة"
    hours = minutes // 60
    if hours < 24:
        return "ساعة" if hours == 1 else "ساعتين" if hours == 2 else f"{hours} ساعات" if hours <= 10 else f"{hours} ساعة"
    days = hours // 24
    return "يوم" if days == 1 else "يومين" if days == 2 else f"{days} أيام"


# ================= الإعدادات =================
def prefs_row(session: Session, account_id: str) -> NotificationPrefs | None:
    return session.get(NotificationPrefs, account_id)


def prefs_of(row: NotificationPrefs | None) -> dict[str, Any]:
    """الإعدادات بعد دمج الافتراضي (حقول جديدة لاحقاً لا تكسر القديم)."""
    base = NotificationPrefsBody().model_dump()
    if row is not None:
        try:
            base = NotificationPrefsBody.model_validate({**base, **(row.data or {})}).model_dump()
        except ValueError:
            pass
    return base


def ensure_prefs(session: Session, shop_id: str, account_id: str) -> NotificationPrefs:
    row = session.get(NotificationPrefs, account_id)
    if row is None:
        row = NotificationPrefs(account_id=account_id, shop_id=shop_id, data=NotificationPrefsBody().model_dump(),
                                utc_offset_minutes=DEFAULT_OFFSET, updated_at=utcnow())  # fmt: skip
        session.add(row)
        session.flush()
    return row


def local_now(row: NotificationPrefs | None, now: datetime) -> datetime:
    offset = row.utc_offset_minutes if row is not None else DEFAULT_OFFSET
    return (now + timedelta(minutes=offset)).replace(tzinfo=None)


def _hhmm(text: str) -> time:
    h, m = text.split(":")
    return time(int(h), int(m))


def in_quiet_hours(prefs: dict[str, Any], local: datetime) -> bool:
    """يدعم الفترة التي تعبر منتصف الليل (23:00 ← 08:00). البداية = النهاية = لا هدوء."""
    quiet = prefs.get("quiet") or {}
    if not quiet.get("enabled"):
        return False
    start, end, now_t = _hhmm(quiet["start"]), _hhmm(quiet["end"]), local.time()
    if start == end:
        return False
    if start < end:
        return start <= now_t < end
    return now_t >= start or now_t < end


# ================= المستلمون =================
def _recipients(session: Session, shop: Shop, now: datetime) -> list[tuple[Account, dict[str, Any], NotificationPrefs | None]]:
    """حسابات المحل التي لها جلسة هاتف سارية (مالك/مدير نشط بصلاحياته الحالية)."""
    ids = session.scalars(
        select(MobileSession.account_id).where(
            MobileSession.shop_id == shop.id, MobileSession.revoked_at.is_(None), MobileSession.refresh_expires_at > now
        ).distinct()
    ).all()
    out = []
    for account_id in ids:
        account = _account(session, session.get(CatalogItem, account_id), shop.id)
        if account is None:
            continue
        row = prefs_row(session, account.id)
        out.append((account, prefs_of(row), row))
    return out


def _add(session: Session, *, shop_id: str, account_id: str, kind: str, key: str, title: str, body: str,
         route: str, ref_id: str | None, now: datetime) -> bool:  # fmt: skip
    """True لو أُنشئ. نفس الحدث لنفس الحساب مرة واحدة فقط (والقيد الفريد يحمي من عمليتين معاً)."""
    exists = session.scalar(
        select(Notification.id).where(Notification.account_id == account_id, Notification.dedup_key == key)
    )
    if exists:
        return False
    try:
        with session.begin_nested():
            session.add(Notification(
                id=str(uuid.uuid4()), shop_id=shop_id, account_id=account_id, kind=kind, dedup_key=key[:160],
                title=title[:80], body=body[:200], route=route[:120], ref_id=ref_id, status="pending", created_at=now,
            ))  # fmt: skip
    except IntegrityError:
        return False
    return True


# ================= اكتشاف الأحداث =================
def _transfer_requests(session: Session, shop: Shop, recipients, names: dict[str, str], now: datetime) -> int:
    since = now - timedelta(hours=get_settings().notify_lookback_hours)
    rows = session.scalars(
        select(Transfer).where(Transfer.shop_id == shop.id, Transfer.status == "requested", Transfer.requested_at >= since)
    ).all()
    n = 0
    for t in rows:
        for account, prefs, _ in recipients:
            # نفس صلاحية الموافقة: الفرع المطلوب منه فقط.
            if not prefs["transfer_request"]["enabled"] or t.from_branch_id not in account.branch_ids:
                continue
            n += _add(session, shop_id=shop.id, account_id=account.id, kind="transfer_request",
                      key=f"transfer_request:{t.id}", title="طلب تحويل جديد",
                      body=f"{names.get(t.to_branch_id, 'فرع')} يطلب أصنافاً من {names.get(t.from_branch_id, 'فرع')}",
                      route=f"/transfer/{t.id}", ref_id=t.id, now=now)  # fmt: skip
    return n


def _eta_rejected(session: Session, shop: Shop, recipients, names: dict[str, str], now: datetime) -> int:
    since_day = (now - timedelta(hours=get_settings().notify_lookback_hours)).date() - timedelta(days=1)
    rows = session.scalars(select(DailyStat).where(DailyStat.shop_id == shop.id, DailyStat.day >= since_day)).all()
    n = 0
    for row in rows:
        count = int((row.data or {}).get("eta_rejected") or 0)
        if count <= 0:
            continue
        for account, prefs, _ in recipients:
            if not prefs["eta_rejected"]["enabled"] or row.branch_id not in account.branch_ids:
                continue
            # مفتاح بالعدد: زيادة جديدة = تنبيه جديد، ونفس العدد لا يتكرر.
            n += _add(session, shop_id=shop.id, account_id=account.id, kind="eta_rejected",
                      key=f"eta_rejected:{row.branch_id}:{row.day.isoformat()}:{count}",
                      title="إيصالات إلكترونية مرفوضة",
                      body=f"فرع {names.get(row.branch_id, '')}: إيصالات رفضتها منظومة الضرائب. التصحيح من جهاز الفرع",
                      route="/receipts", ref_id=row.branch_id, now=now)  # fmt: skip
    return n


def _offline(session: Session, shop: Shop, recipients, branches: list[Branch], now: datetime) -> int:
    n = 0
    for b in branches:
        seen = _aware(b.last_seen_at)
        if not b.is_active or seen is None:
            continue
        for account, prefs, _ in recipients:
            pref = prefs["branch_offline"]
            if not pref["enabled"] or b.id not in account.branch_ids:
                continue
            if now - seen < timedelta(minutes=pref["minutes"]):
                continue
            # مفتاح بآخر ظهور: انقطاع واحد = تنبيه واحد، ورجوع ثم انقطاع جديد = تنبيه جديد.
            n += _add(session, shop_id=shop.id, account_id=account.id, kind="branch_offline",
                      key=f"branch_offline:{b.id}:{seen.isoformat(timespec='seconds')}", title="فرع غير متصل",
                      body=f"فرع {b.name} غير متصل منذ أكثر من {_ago(timedelta(minutes=pref['minutes']))}",
                      route=f"/branch/{b.id}", ref_id=b.id, now=now)  # fmt: skip
    return n


def _low_sales(session: Session, shop: Shop, recipients, branches: list[Branch], now: datetime) -> int:
    settings = get_settings()
    n = 0
    for account, prefs, row in recipients:
        if not prefs["low_sales"]["enabled"]:
            continue
        local = local_now(row, now)
        if local.hour < settings.low_sales_after_hour:
            continue
        day = local.date() - timedelta(days=1)  # أمس بتوقيت المستخدم (يوم مكتمل)
        for b in branches:
            if not b.is_active or b.id not in account.branch_ids:
                continue
            if _is_low(session, b.id, day, settings.low_sales_ratio):
                n += _add(session, shop_id=shop.id, account_id=account.id, kind="low_sales",
                          key=f"low_sales:{b.id}:{day.isoformat()}", title="مبيعات أقل من المعتاد",
                          body=f"مبيعات فرع {b.name} أمس أقل كثيراً من المعتاد لنفس اليوم",
                          route=f"/branch/{b.id}", ref_id=b.id, now=now)  # fmt: skip
    return n


def _is_low(session: Session, branch_id: str, day: date, ratio: float) -> bool:
    """أمس < ratio × متوسط نفس اليوم في 4 أسابيع سابقة (3 على الأقل بها بيانات). يوم بلا ملخص لا يُحكم عليه."""
    days = [day - timedelta(weeks=w) for w in range(5)]
    nets: dict[date, Any] = dict(
        session.execute(
            select(DailyStat.day, DailyStat.data).where(DailyStat.branch_id == branch_id, DailyStat.day.in_(days))
        ).all()
    )
    if day not in nets:
        return False
    history = [int((nets[d] or {}).get("net") or 0) for d in days[1:] if d in nets]
    if len(history) < 3:
        return False
    avg = sum(history) / len(history)
    return avg > 0 and int((nets[day] or {}).get("net") or 0) < avg * ratio


# الجمعة: آخر يوم في أسبوع المحل (السبت ← الجمعة)، فملخص الأسبوع يصل مساء الجمعة.
RECAP_WEEKDAY = 4


def _has_sales(session: Session, shop_id: str, branch_ids: list[str], d1: date, d2: date) -> bool:
    """فرع واحد على الأقل من فروع الحساب رفع فواتير في الفترة (لا ملخص لفترة بلا بيع)."""
    if not branch_ids:
        return False
    rows = session.scalars(
        select(DailyStat.data).where(
            DailyStat.shop_id == shop_id, DailyStat.branch_id.in_(branch_ids), DailyStat.day >= d1, DailyStat.day <= d2
        )
    ).all()
    return any(int((d or {}).get("count") or 0) > 0 for d in rows)


def _recap(session: Session, shop: Shop, recipients, now: datetime) -> int:
    """تنبيه «الملخص جاهز» مرة لكل يوم/أسبوع لكل حساب، بعد ساعة المستخدم وبتاريخه المحلي."""
    n = 0
    for account, prefs, row in recipients:
        pref = prefs["recap"]
        if not pref["enabled"]:
            continue
        local = local_now(row, now)
        if local.hour < pref["hour"]:
            continue
        day = local.date()
        if pref["mode"] in ("day", "both") and _has_sales(session, shop.id, account.branch_ids, day, day):
            n += _add(session, shop_id=shop.id, account_id=account.id, kind="recap", key=f"recap:day:{day.isoformat()}",
                      title="ملخص يومك جاهز", body="شاهد ما حدث اليوم في متاجرك على Dealzora مع تحليل سريع",
                      route=f"/recap/day/{day.isoformat()}", ref_id=None, now=now)  # fmt: skip
        start = day - timedelta(days=6)
        if (
            pref["mode"] in ("week", "both")
            and day.weekday() == RECAP_WEEKDAY
            and _has_sales(session, shop.id, account.branch_ids, start, day)
        ):
            n += _add(session, shop_id=shop.id, account_id=account.id, kind="recap", key=f"recap:week:{day.isoformat()}",
                      title="ملخص أسبوعك جاهز", body="أسبوعك في متاجرك على Dealzora: الأرقام والتحليل في دقيقة",
                      route=f"/recap/week/{day.isoformat()}", ref_id=None, now=now)  # fmt: skip
    return n


SENSITIVE_LABEL = {"discount": "خصم كبير على فاتورة", "return": "مرتجع بمبلغ كبير", "full_return": "مرتجع فاتورة كاملة"}


def _branch_records(session: Session, shop: Shop, recipients, names: dict[str, str], now: datetime) -> int:
    """عمليات حساسة (فوق حد المالك كما رفعها الفرع) وفروق نقدية الورديات فوق الحد. بلا مبالغ في النص."""
    from .branch_reports import get_config

    since = now - timedelta(hours=get_settings().notify_lookback_hours)
    cash_min = get_config(session, shop.id)["cash_diff_min"]
    rows = session.scalars(
        select(BranchRecord).where(
            BranchRecord.shop_id == shop.id, BranchRecord.kind.in_(("sensitive", "shift")), BranchRecord.created_at >= since
        )
    ).all()
    n = 0
    for r in rows:
        if r.kind == "sensitive":
            kind, title, label, route = "sensitive_op", "عملية حساسة", SENSITIVE_LABEL.get(str(r.data.get("type")), "عملية حساسة"), "/sensitive"
        else:
            if abs(int(r.data.get("difference") or 0)) < max(cash_min, 1):
                continue
            kind, title, label, route = "cash_diff", "فرق نقدية في وردية", "فرق في النقدية عند إغلاق وردية", "/shifts"
        for account, prefs, _ in recipients:
            if not prefs[kind]["enabled"] or r.branch_id not in account.branch_ids:
                continue
            n += _add(session, shop_id=shop.id, account_id=account.id, kind=kind, key=f"{kind}:{r.id}", title=title,
                      body=f"فرع {names.get(r.branch_id, '')}: {label}", route=route, ref_id=r.branch_id, now=now)  # fmt: skip
    return n


def produce(session: Session, now: datetime | None = None) -> int:
    now = now or utcnow()
    shop_ids = session.scalars(
        select(MobileSession.shop_id).where(MobileSession.revoked_at.is_(None), MobileSession.refresh_expires_at > now).distinct()
    ).all()
    created = 0
    for shop_id in shop_ids:
        shop = session.get(Shop, shop_id)
        if shop is None:
            continue
        try:
            check_shop(shop)  # «سلسلة» وترخيص ساري فقط
        except AppError:
            continue
        recipients = _recipients(session, shop, now)
        if not recipients:
            continue
        branches = list(session.scalars(select(Branch).where(Branch.shop_id == shop.id)).all())
        names = {b.id: b.name for b in branches}
        created += _transfer_requests(session, shop, recipients, names, now)
        created += _eta_rejected(session, shop, recipients, names, now)
        created += _offline(session, shop, recipients, branches, now)
        created += _low_sales(session, shop, recipients, branches, now)
        created += _branch_records(session, shop, recipients, names, now)
        created += _recap(session, shop, recipients, now)
    session.commit()
    return created


# ================= الإرسال (تجميع + ساعات هدوء) =================
def _still_valid(session: Session, n: Notification) -> bool:
    if n.kind == "transfer_request":
        t = session.get(Transfer, n.ref_id) if n.ref_id else None
        return t is not None and t.status == "requested"
    if n.kind == "branch_offline":
        b = session.get(Branch, n.ref_id) if n.ref_id else None
        seen = _aware(b.last_seen_at) if b else None
        # نفس الانقطاع ما زال قائماً (لم يظهر الفرع بعد إنشاء التنبيه).
        return b is not None and b.is_active and seen is not None and n.dedup_key.split(":", 2)[2] == seen.isoformat(timespec="seconds")
    return True


def _plural(n: int) -> str:
    return "تنبيهان جديدان" if n == 2 else f"{n} تنبيهات جديدة" if n <= 10 else f"{n} تنبيهاً جديداً"


def compose(rows: list[Notification]) -> tuple[str, str, str]:
    """إشعار واحد للمجموعة: (العنوان، النص، الشاشة)."""
    if len(rows) == 1:
        return rows[0].title, rows[0].body, rows[0].route
    titles = list(dict.fromkeys(r.title for r in rows))
    routes = {r.route for r in rows}
    return _plural(len(rows)), "، ".join(titles)[:180], routes.pop() if len(routes) == 1 else "/alerts"


def send_pending(session: Session, push: PushFn, now: datetime | None = None) -> int:
    """يرسل المنتظر لكل حساب مسموح الآن. يرجع عدد الإشعارات (push) المرسلة."""
    now = now or utcnow()
    gap = timedelta(minutes=get_settings().notify_min_gap_minutes)
    account_ids = session.scalars(select(Notification.account_id).where(Notification.status == "pending").distinct()).all()
    pushed = 0
    for account_id in account_ids:
        rows = list(session.scalars(
            select(Notification).where(Notification.account_id == account_id, Notification.status == "pending")
            .order_by(Notification.created_at)
        ).all())  # fmt: skip
        shop = session.get(Shop, rows[0].shop_id)
        account = _account(session, session.get(CatalogItem, account_id), rows[0].shop_id)
        try:
            if shop is None or account is None:
                raise AppError("gone", "")
            check_shop(shop)
        except AppError:
            for r in rows:  # الحساب أُوقف أو المحل نزل لخطة أقل: لا إرسال
                r.status = "dropped"
            session.commit()
            continue
        row = ensure_prefs(session, shop.id, account_id)
        prefs = prefs_of(row)
        if in_quiet_hours(prefs, local_now(row, now)):
            continue  # تُرسل مجمّعة بعد ساعات الهدوء
        last = _aware(row.last_push_at)
        if last is not None and now - last < gap:
            continue  # تجميع الأحداث المتقاربة في إشعار واحد
        valid = []
        for r in rows:
            if _still_valid(session, r):
                valid.append(r)
            else:
                r.status = "dropped"
        if not valid:
            session.commit()
            continue

        sessions = list(session.scalars(
            select(MobileSession).where(
                MobileSession.account_id == account_id, MobileSession.revoked_at.is_(None),
                MobileSession.refresh_expires_at > now, MobileSession.push_token.is_not(None),
            )
        ).all())  # fmt: skip
        if sessions:
            title, body, route = compose(valid)
            messages = [{"to": s.push_token, "title": title, "body": body, "data": {"url": route},
                         "channelId": "alerts", "priority": "high", "sound": "default"} for s in sessions]  # fmt: skip
            try:
                tickets = push(messages)
            except Exception:
                log.warning("expo push failed for account; will retry", exc_info=True)
                session.rollback()
                continue
            for s, ticket in zip(sessions, tickets, strict=False):
                if (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
                    s.push_token = None  # التطبيق اتمسح أو الإذن اتسحب
            row.last_push_at = now
            pushed += 1
        for r in valid:
            r.status = "sent"
            r.sent_at = now
        session.commit()
    return pushed


def send_test(session: Session, push: PushFn, shop_id: str | None = None, now: datetime | None = None) -> list[str]:
    """إشعار تجريبي لكل هاتف مسجّل (للتأكد من وصول الإشعارات): يظهر في سجل التنبيهات، ويُرسل push فوراً
    للهواتف التي لها token (بلا انتظار التجميع أو ساعات الهدوء). بلا token (Expo Go): التطبيق يلتقطه
    خلال دقيقة ويعرضه إشعاراً محلياً. يرجع وصفاً لكل حساب وصله (بلا أي token في الناتج)."""
    now = now or utcnow()
    q = select(MobileSession.shop_id).where(MobileSession.revoked_at.is_(None), MobileSession.refresh_expires_at > now)
    if shop_id:
        q = q.where(MobileSession.shop_id == shop_id)
    out: list[str] = []
    for sid in session.scalars(q.distinct()).all():
        shop = session.get(Shop, sid)
        if shop is None:
            continue
        stamp = now.astimezone(UTC).strftime("%H:%M:%S")
        for account, _prefs, _row in _recipients(session, shop, now):
            key = f"test:{uuid.uuid4()}"
            _add(session, shop_id=shop.id, account_id=account.id, kind="test", key=key, title="إشعار تجريبي",
                 body=f"الإشعارات تصل من الخادم ({stamp} UTC)", route="/alerts", ref_id=None, now=now)  # fmt: skip
            n = session.scalar(select(Notification).where(Notification.account_id == account.id, Notification.dedup_key == key))
            tokens = session.scalars(
                select(MobileSession.push_token).where(
                    MobileSession.account_id == account.id, MobileSession.revoked_at.is_(None),
                    MobileSession.refresh_expires_at > now, MobileSession.push_token.is_not(None),
                )
            ).all()  # fmt: skip
            how = "سيظهر في التطبيق خلال دقيقة (لا push token: Expo Go)"
            if tokens:
                try:
                    push([{"to": t, "title": n.title, "body": n.body, "data": {"url": "/alerts"},
                           "channelId": "alerts", "priority": "high", "sound": "default"} for t in tokens])  # fmt: skip
                    how = f"push أُرسل لـ {len(tokens)} هاتف"
                except Exception:  # noqa: BLE001
                    log.warning("test push failed", exc_info=True)
                    how = "فشل push (انظر السجل)، وسيظهر في التطبيق خلال دقيقة"
            if n is not None:
                n.status, n.sent_at = "sent", now
            out.append(f"{shop.name} / {account.username}: {how}")
    session.commit()
    return out


def tick(session: Session, push: PushFn, now: datetime | None = None) -> dict[str, int]:
    return {"created": produce(session, now), "pushed": send_pending(session, push, now)}


# ================= Expo push =================
def expo_push(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """POST إلى خدمة Expo (حتى 100 رسالة في الطلب). مكتبة بايثون القياسية فقط (بلا اعتماديات جديدة)."""
    import json
    import urllib.request

    settings = get_settings()
    tickets: list[dict[str, Any]] = []
    for i in range(0, len(messages), 100):
        req = urllib.request.Request(
            settings.expo_push_url,
            data=json.dumps(messages[i : i + 100]).encode(),
            headers={"Accept": "application/json", "Content-Type": "application/json",
                     **({"Authorization": f"Bearer {settings.expo_access_token}"} if settings.expo_access_token else {})},
            method="POST",
        )  # fmt: skip
        with urllib.request.urlopen(req, timeout=15) as resp:
            tickets += json.loads(resp.read()).get("data") or []
    return tickets


# ================= للهاتف =================
def register_token(session: Session, *, shop_id: str, session_id: str, account_id: str, username: str,
                   token: str, offset: int, ip: str) -> None:  # fmt: skip
    # نفس الهاتف كان مسجّلاً بحساب آخر: لا تصله تنبيهات الحساب القديم.
    session.execute(
        update(MobileSession).where(MobileSession.push_token == token, MobileSession.id != session_id).values(push_token=None)
    )
    ms = session.get(MobileSession, session_id)
    if ms is not None:
        ms.push_token = token
    row = ensure_prefs(session, shop_id, account_id)
    row.utc_offset_minutes = offset
    record(session, "push_token_registered", actor="mobile", shop_id=shop_id, ip=ip,
           details={"username": username, "session_id": session_id, "from_phone": True})  # fmt: skip
    session.commit()


def clear_token(session: Session, *, shop_id: str, session_id: str, username: str, ip: str) -> None:
    ms = session.get(MobileSession, session_id)
    if ms is not None and ms.push_token:
        ms.push_token = None
        record(session, "push_token_removed", actor="mobile", shop_id=shop_id, ip=ip,
               details={"username": username, "session_id": session_id, "from_phone": True})  # fmt: skip
        session.commit()


def unread_count(session: Session, account_id: str) -> int:
    return session.scalar(
        select(func.count()).select_from(Notification).where(
            Notification.account_id == account_id, Notification.read_at.is_(None), Notification.status != "dropped"
        )
    ) or 0  # fmt: skip
