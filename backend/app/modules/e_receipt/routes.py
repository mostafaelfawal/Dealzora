"""طبقة HTTP للإيصال الإلكتروني (المرحلة 3: لا إرسال). لخطة «سلسلة» وللمدير."""

import threading
from dataclasses import asdict
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.errors import AppError, ConflictError, NotFoundError
from app.core.permissions import require_authenticated, require_manager, require_manager_write, require_owner_write
from app.core.plan import Feature, require_feature
from app.core.security import Actor, get_actor
from app.modules.sales.model import Sale, SaleReturn

from . import service
from .constants import ERROR_MESSAGES, EReceiptError
from .listing import ReceiptFilters, list_receipts, report, resend_mode
from .model import EReceiptAttempt
from .sender import queue_counts, release_return, sender

router = APIRouter(prefix="/e-receipt", tags=["e-receipt"], dependencies=[require_feature(Feature.E_RECEIPT)])

DbSession = Annotated[Session, Depends(get_session)]
ActorDep = Annotated[Actor, Depends(get_actor)]


class ReceiptStateOut(BaseModel):
    id: str
    status: str | None
    uuid: str | None
    previous_uuid: str | None
    receipt_number: str | None
    error: str | None


class ChainOut(BaseModel):
    device_id: str
    last_seq: int
    last_uuid: str
    anchor_seq: int | None
    anchor_uuid: str | None
    gap: bool


def _state(row: Sale | SaleReturn) -> ReceiptStateOut:
    return ReceiptStateOut(
        id=row.id, status=row.eta_status, uuid=row.eta_uuid, previous_uuid=row.eta_previous_uuid,
        receipt_number=row.eta_receipt_number, error=row.eta_error,
    )  # fmt: skip


def _get(session: Session, model: type[Sale] | type[SaleReturn], row_id: str) -> Sale | SaleReturn:
    row = session.get(model, row_id)
    if row is None or row.deleted_at is not None:
        raise NotFoundError(EReceiptError.NOT_FOUND.value, ERROR_MESSAGES[EReceiptError.NOT_FOUND])
    return row


@router.post("/sales/{sale_id}/regenerate", response_model=ReceiptStateOut, dependencies=[Depends(require_manager_write)])
def regenerate_sale(sale_id: str, session: DbSession, actor: ActorDep):
    row = _get(session, Sale, sale_id)
    service.regenerate(session, actor, row)
    return _state(row)


@router.post(
    "/returns/{return_id}/regenerate", response_model=ReceiptStateOut, dependencies=[Depends(require_manager_write)]
)
def regenerate_return(return_id: str, session: DbSession, actor: ActorDep):
    row = _get(session, SaleReturn, return_id)
    service.regenerate(session, actor, row)
    return _state(row)


@router.get("/chains", response_model=list[ChainOut], dependencies=[Depends(require_manager)])
def list_chains(session: DbSession):
    return service.chains(session)


@router.post("/chains/{device_id}/adopt-anchor", response_model=list[ChainOut], dependencies=[Depends(require_manager_write)])
def adopt_anchor(device_id: str, session: DbSession, actor: ActorDep):
    service.adopt_anchor(session, actor, device_id)
    return service.chains(session)


# ================= الاتصال بالمنظومة (المرحلة 4) =================
class ConnectionTestOut(BaseModel):
    ok: bool
    environment: str
    message: str
    kind: str | None = None
    expires_in: int | None = None
    correlation_id: str | None = None


class CycleOut(BaseModel):
    submitted: int
    accepted: int
    rejected: int
    resolved: int
    errors: list[str]


class AttemptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    pos_device_id: str
    environment: str
    operation: str
    outcome: str
    http_status: int | None
    submission_uuid: str | None
    receipts_count: int
    accepted_count: int
    rejected_count: int
    retry_after: float | None
    correlation_id: str | None
    message: str | None
    duration_ms: int


class SendStatusOut(BaseModel):
    counts: dict[str, int]  # حالة ← عدد (بيع + مرتجع)
    queue: dict[str, int]  # waiting / rejected / late (قارب مهلة الـ 24 ساعة) / overdue (تجاوزها)
    devices: dict[str, dict]  # جهاز ← {wait_seconds, auth_error, held_by, held_return_id}


@router.post(
    "/devices/{device_id}/test-connection", response_model=ConnectionTestOut,
    dependencies=[Depends(require_manager_write)],
)  # fmt: skip
def test_connection(device_id: str, session: DbSession):
    return sender.test_connection(session, device_id)


@router.post("/send-now", response_model=CycleOut, dependencies=[Depends(require_manager_write)])
def send_now():
    return asdict(sender.run_cycle(force=True))


@router.get("/send-status", response_model=SendStatusOut, dependencies=[Depends(require_manager)])
def send_status(session: DbSession):
    counts: dict[str, int] = {}
    for model in (Sale, SaleReturn):
        rows = session.execute(
            select(model.eta_status, func.count()).where(model.eta_status.is_not(None)).group_by(model.eta_status)
        ).all()
        for status, count in rows:
            counts[status] = counts.get(status, 0) + int(count)
    now = sender.clock()
    return SendStatusOut(
        counts=counts, queue=queue_counts(session), devices={d: s.as_dict(now) for d, s in sender.devices.items()}
    )


@router.post("/returns/{return_id}/release", response_model=ReceiptStateOut, dependencies=[Depends(require_manager_write)])
def release_held_return(return_id: str, session: DbSession, actor: ActorDep):
    """إرسال مرتجع رغم رفض فاتورته الأصلية (يفك إيقاف سلسلة الجهاز)."""
    row = _get(session, SaleReturn, return_id)
    release_return(session, actor, row)  # type: ignore[arg-type]
    return _state(row)


@router.get("/attempts", response_model=list[AttemptOut], dependencies=[Depends(require_manager)])
def list_attempts(session: DbSession, limit: int = Query(50, ge=1, le=500)):
    return session.scalars(select(EReceiptAttempt).order_by(EReceiptAttempt.created_at.desc()).limit(limit)).all()


# ================= شاشة الإيصالات (المرحلة 8) =================
class ReceiptItemOut(BaseModel):
    kind: str
    id: str
    sale_id: str
    number: int
    receipt_number: str | None
    issued_at: datetime
    device_id: str | None
    device_name: str | None
    status: str
    uuid: str | None
    replaced_uuid: str | None
    reference_uuid: str | None
    environment: str | None
    total: int
    tax_total: int | None
    error: str | None
    help_title: str | None
    help_action: str | None
    sent_at: datetime | None
    late: bool
    overdue: bool
    amendment_late: bool
    resend: str | None  # send / correct / regenerate / None


class ReceiptListOut(BaseModel):
    items: list[ReceiptItemOut]
    total: int
    page: int
    page_size: int
    devices: list[dict]


class ResendItem(BaseModel):
    kind: str = Field(pattern="^(sale|return)$")
    id: str = Field(min_length=1, max_length=36)


class ResendIn(BaseModel):
    items: list[ResendItem] = Field(min_length=1, max_length=500)
    accept_late: bool = False  # تأكيد صريح لتصحيح إيصال مرّ عليه أكثر من 96 ساعة


class ResendOut(BaseModel):
    corrected: int
    regenerated: int
    queued: int
    errors: list[dict]  # [{id, number, message, code}]


class QueueOut(BaseModel):
    enabled: bool
    waiting: int
    rejected: int
    late: int
    overdue: int


class EnvironmentIn(BaseModel):
    environment: str = Field(pattern="^(preprod|prod)$")
    confirm_text: str = Field("", max_length=20)


@router.get("/receipts", response_model=ReceiptListOut, dependencies=[Depends(require_manager)])
def list_receipts_route(
    session: DbSession,
    actor: ActorDep,
    status: str | None = Query(None, max_length=16),
    kind: str | None = Query(None, pattern="^(sale|return)$"),
    device_id: str | None = Query(None, max_length=36),
    date_from: date | None = None,
    date_to: date | None = None,
    q: str = Query("", max_length=20),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    term = q.strip().lstrip("#").removeprefix("R-")
    filters = ReceiptFilters(status=status, kind=kind, device_id=device_id, date_from=date_from, date_to=date_to,
                             number=int(term) if term.isdigit() else None, page=page, page_size=page_size)  # fmt: skip
    return list_receipts(session, actor, filters)


@router.post("/receipts/resend", response_model=ResendOut, dependencies=[Depends(require_manager_write)])
def resend_receipts(data: ResendIn, session: DbSession, actor: ActorDep):
    """فردي أو جماعي: المرفوض ← تصحيح بطريقة الـ SDK، خطأ التحقق ← إعادة توليد، ولم يُرسل ← إرسال فوري."""
    out = {"corrected": 0, "regenerated": 0, "queued": 0, "errors": []}
    for item in data.items:
        model = Sale if item.kind == "sale" else SaleReturn
        row = session.get(model, item.id)
        if row is None or row.deleted_at is not None:
            out["errors"].append({"id": item.id, "number": None, "message": "غير موجود", "code": "not_found"})
            continue
        mode = resend_mode(row)
        try:
            if mode == "correct":
                service.resubmit_rejected(session, actor, row, accept_late=data.accept_late)
                session.commit()
                out["corrected"] += 1
            elif mode == "regenerate":
                service.regenerate(session, actor, row)
                out["regenerated"] += 1
            elif mode == "send":
                out["queued"] += 1
            else:
                raise ConflictError("e_receipt_nothing_to_resend", "الإيصال مقبول أو قيد التحقق، ولا يحتاج إعادة إرسال")
        except AppError as exc:
            session.rollback()
            out["errors"].append({"id": item.id, "number": row.number, "message": exc.message, "code": exc.code})
    if out["corrected"] or out["regenerated"] or out["queued"]:
        # الإرسال نفسه في الخلفية (شبكة): الواجهة تتحدث من حدث realtime «e_receipt».
        threading.Thread(target=lambda: sender.run_cycle(force=True), name="e-receipt-resend", daemon=True).start()
    return out


@router.get("/queue", response_model=QueueOut, dependencies=[Depends(require_authenticated)])
def queue(session: DbSession):
    """مؤشر الكاشير والداشبورد (أعداد فقط، متاح لأي مستخدم مسجّل)."""
    enabled = service.is_active(session)
    counts = queue_counts(session) if enabled else {"waiting": 0, "rejected": 0, "late": 0, "overdue": 0}
    return QueueOut(enabled=enabled, **counts)


@router.get("/report", dependencies=[Depends(require_manager)])
def period_report(session: DbSession, date_from: date, date_to: date):
    return report(session, date_from, date_to)


@router.get("/environment", dependencies=[Depends(require_manager)])
def environment_preview(session: DbSession, actor: ActorDep):
    return service.environment_switch_preview(session, actor)


@router.post("/environment", dependencies=[Depends(require_owner_write)])
def switch_environment_route(data: EnvironmentIn, session: DbSession, actor: ActorDep):
    """تجريبي ↔ فعلي بتأكيد صريح (للمالك). سلسلة جديدة لكل جهاز، وغير المرسل من البيئة القديمة «غير مطلوب»."""
    return service.switch_environment(session, actor, data.environment, data.confirm_text)
