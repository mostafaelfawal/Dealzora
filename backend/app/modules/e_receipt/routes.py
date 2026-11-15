"""طبقة HTTP للإيصال الإلكتروني (المرحلة 3: لا إرسال). لخطة «سلسلة» وللمدير."""

from dataclasses import asdict
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.errors import NotFoundError
from app.core.permissions import require_manager, require_manager_write
from app.core.plan import Feature, require_feature
from app.core.security import Actor, get_actor
from app.modules.sales.model import Sale, SaleReturn

from . import service
from .constants import ERROR_MESSAGES, EReceiptError
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
