"""تحويلات المخزون بين فروع نفس المحل: إرسال مباشر، أو طلب يوافق عليه الفرع الآخر."""

from typing import Annotated, Literal

from fastapi import APIRouter, Query, status

from ..db import SessionDep
from ..schemas import (
    ApproveIn,
    ReceiveIn,
    RejectIn,
    TransferIn,
    TransferListOut,
    TransferOut,
    TransferRequestIn,
    TransferStatus,
)
from ..security import CallerDep
from ..services import transfers

router = APIRouter(prefix="/transfers", tags=["transfers"])


@router.post("", response_model=TransferOut, status_code=status.HTTP_201_CREATED)
def create(data: TransferIn, caller: CallerDep, session: SessionDep):
    """إرسال تحويل (البضاعة خرجت من فرعك). نفس id مرة ثانية = نفس التحويل بدون تكرار."""
    return transfers.create(session, caller, data)


@router.post("/requests", response_model=TransferOut, status_code=status.HTTP_201_CREATED)
def request(data: TransferRequestIn, caller: CallerDep, session: SessionDep):
    """فرعك يطلب بضاعة من فرع آخر (لا تتحرك بضاعة حتى يوافق ويرسل)."""
    return transfers.request(session, caller, data)


@router.get("", response_model=TransferListOut)
def list_transfers(
    caller: CallerDep,
    session: SessionDep,
    direction: Literal["in", "out", "all"] = "all",
    status_: Annotated[TransferStatus | None, Query(alias="status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
):
    return transfers.list_for(
        session, caller, direction=direction, status=status_, page=page, page_size=page_size
    )


@router.get("/{transfer_id}", response_model=TransferOut)
def get_one(transfer_id: str, caller: CallerDep, session: SessionDep):
    return transfers.get_one(session, caller, transfer_id)


@router.post("/{transfer_id}/approve", response_model=TransferOut)
def approve(transfer_id: str, data: ApproveIn, caller: CallerDep, session: SessionDep):
    """الموافقة على طلب وإرسال الكميات المتاحة فعلاً (من الفرع المطلوب منه)."""
    return transfers.approve(session, caller, transfer_id, data)


@router.post("/{transfer_id}/reject", response_model=TransferOut)
def reject(transfer_id: str, data: RejectIn, caller: CallerDep, session: SessionDep):
    return transfers.reject(session, caller, transfer_id, data)


@router.post("/{transfer_id}/withdraw", response_model=TransferOut)
def withdraw(transfer_id: str, caller: CallerDep, session: SessionDep):
    """صاحب الطلب يسحبه قبل الرد."""
    return transfers.withdraw(session, caller, transfer_id)


@router.post("/{transfer_id}/receive", response_model=TransferOut)
def receive(transfer_id: str, data: ReceiveIn, caller: CallerDep, session: SessionDep):
    return transfers.receive(session, caller, transfer_id, data)


@router.post("/{transfer_id}/cancel", response_model=TransferOut)
def cancel(transfer_id: str, caller: CallerDep, session: SessionDep):
    return transfers.cancel(session, caller, transfer_id)
