"""الفروع وتحويلات المخزون (للمدير). كل الكتابة تحتاج خطة «سلسلة» وتصريح الكتابة (الترخيص)."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query

from app.core.caller import require_main_device
from app.core.deps import ActorDep, SessionDep
from app.core.permissions import (
    require_authenticated_write,
    require_manager,
    require_manager_write,
    require_owner_write,
)
from app.core.plan import Feature, require_feature_for_writes

from .schemas import ApproveIn, ConnectIn, ReceiveIn, RejectIn, RequestIn, SendIn
from .service import BranchSyncService

router = APIRouter(
    prefix="/branch-sync",
    tags=["branch-sync"],
    dependencies=[require_feature_for_writes(Feature.BRANCHES)],
)
Read = [Depends(require_manager)]
Write = [Depends(require_manager_write)]
OwnerWrite = [Depends(require_owner_write)]  # ربط/فصل الفرع: للمالك فقط


def _svc(session: SessionDep, actor: ActorDep) -> BranchSyncService:
    return BranchSyncService(session, actor)


Svc = Annotated[BranchSyncService, Depends(_svc)]


@router.get("/status", dependencies=Read)
def status(svc: Svc, check: bool = False):
    """حالة الربط (بدون السر أبداً). check=true يختبر الوصول للسيرفر."""
    return svc.status(check=check)


@router.post("/connect", dependencies=OwnerWrite)
def connect(data: ConnectIn, svc: Svc):
    """ربط هذا الفرع بسيرفر الفروع بكود الربط (مرة واحدة)."""
    return svc.connect(data)


@router.post("/disconnect", dependencies=OwnerWrite)
def disconnect(svc: Svc):
    return svc.disconnect()


@router.get("/catalog", dependencies=Read)
def catalog(svc: Svc):
    """حالة مزامنة الأصناف والعملاء: آخر مزامنة، عدد المربوط، والسجلات اللي فشلت."""
    return svc.catalog()


@router.post(
    "/catalog/sync",
    dependencies=[Depends(require_authenticated_write), Depends(require_main_device)],
)
def sync_now(svc: Svc):
    """دورة مزامنة (الواجهة تستدعيها كل دقيقة على الجهاز الأساسي، وزر «مزامنة الآن»).
    أي مستخدم مسجّل (كاشير أو مدير) لأنها تعمل في الخلفية، لكن بتصريح الكتابة (الترخيص)."""
    return svc.sync_now()


@router.get("/branches", dependencies=Read)
def branches(svc: Svc):
    return svc.branches()


@router.get("/transfers/summary", dependencies=Read)
def summary(svc: Svc):
    return svc.summary()


@router.get("/transfers", dependencies=Read)
def list_transfers(
    svc: Svc,
    direction: Literal["in", "out", "all"] = "all",
    status_: Annotated[str | None, Query(alias="status", max_length=16)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 30,
):
    return svc.list_transfers(direction, status_, page, page_size)


@router.post("/transfers/retry", dependencies=Write)
def retry(svc: Svc):
    """إعادة إرسال ما تعلّق بسبب انقطاع النت."""
    return {"sent": svc.retry_pending(), **svc.status()}


@router.get("/transfers/{transfer_id}", dependencies=Read)
def get_transfer(transfer_id: str, svc: Svc):
    return svc.get_transfer(transfer_id)


@router.post("/transfers", dependencies=Write)
def send(data: SendIn, svc: Svc):
    """إرسال بضاعة لفرع آخر: تُخصم من مخزون هذا الفرع فوراً."""
    return svc.send(data)


@router.post("/transfers/requests", dependencies=Write)
def request(data: RequestIn, svc: Svc):
    return svc.request(data)


@router.post("/transfers/{transfer_id}/approve", dependencies=Write)
def approve(transfer_id: str, data: ApproveIn, svc: Svc):
    return svc.approve(transfer_id, data)


@router.post("/transfers/{transfer_id}/reject", dependencies=Write)
def reject(transfer_id: str, data: RejectIn, svc: Svc):
    return svc.reject(transfer_id, data)


@router.post("/transfers/{transfer_id}/withdraw", dependencies=Write)
def withdraw(transfer_id: str, svc: Svc):
    return svc.withdraw(transfer_id)


@router.post("/transfers/{transfer_id}/cancel", dependencies=Write)
def cancel(transfer_id: str, svc: Svc):
    return svc.cancel(transfer_id)


@router.post("/transfers/{transfer_id}/receive", dependencies=Write)
def receive(transfer_id: str, data: ReceiveIn, svc: Svc):
    """استلام تحويل وارد: يُضاف ما وصل فعلاً لمخزون هذا الفرع (بصلاحيته وتكلفته)."""
    return svc.receive(transfer_id, data)
