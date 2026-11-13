"""الفروع وتحويلات المخزون (للمدير). كل الكتابة تحتاج خطة «سلسلة» وتصريح الكتابة (الترخيص)."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query

from app.core.caller import require_main_device
from app.core.deps import ActorDep, SessionDep
from app.core.permissions import (
    require_authenticated_write,
    require_manager,
    require_manager_write,
    require_owner,
    require_owner_write,
)
from app.core.plan import Feature, require_feature_for_writes
from app.core.security import require_write_permit
from pydantic import BaseModel, ConfigDict, Field

from .schemas import (
    ApproveIn,
    BranchPatchIn,
    ConnectIn,
    LicenseKeyIn,
    NewBranchIn,
    ReceiveIn,
    RegisterShopIn,
    RejectIn,
    RequestIn,
    SendIn,
)
from .service import BranchSyncService

router = APIRouter(prefix="/branch-sync", tags=["branch-sync"])
# خطة «سلسلة» (أو موروثة من المحل) لكل عمليات التحويل وإدارة الفروع. الربط بكود والمزامنة بدونها:
# كود المالك هو الإثبات، والجهاز يرث الخطة بعد الربط.
_Plan = require_feature_for_writes(Feature.BRANCHES)
Read = [Depends(require_manager)]
Write = [Depends(require_manager_write), _Plan]
OwnerWrite = [Depends(require_owner_write), _Plan]  # للمالك فقط
OwnerConnect = [Depends(require_owner_write)]
OwnerRead = [Depends(require_owner)]


class JoinIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=12, max_length=20)
    server_url: str = Field(min_length=4, max_length=200)


def _system_svc(session: SessionDep) -> BranchSyncService:
    """جهاز جديد بلا مستخدمين: نعمل باسم «النظام» (الـ service يرفض لو فيه مستخدمين)."""
    from app.core.config import get_settings
    from app.core.security import Actor, Role

    return BranchSyncService(session, Actor("system", Role.OWNER, get_settings().device_id))


JoinDeps = [Depends(require_write_permit), Depends(require_main_device)]


@router.post("/join", dependencies=JoinDeps)
def join(data: JoinIn, svc: Annotated[BranchSyncService, Depends(_system_svc)]):
    """شاشة الإعداد الأول لجهاز فرع جديد: ربط بكود المالك + سحب حساب المالك والأصناف."""
    return svc.join(data.code, data.server_url)


@router.post("/join/sync", dependencies=JoinDeps)
def join_sync(svc: Annotated[BranchSyncService, Depends(_system_svc)]):
    """إعادة المحاولة لو حساب المالك لم يصل بعد (جهاز المالك لم يزامن، أو النت انقطع)."""
    from app.core.errors import ConflictError
    from app.modules.users.repository import UserRepository

    if UserRepository(svc.session).count_users() > 0:
        raise ConflictError("already_setup", "هذا الجهاز مُعدّ بالفعل")
    return svc.join_sync()


def _svc(session: SessionDep, actor: ActorDep) -> BranchSyncService:
    return BranchSyncService(session, actor)


Svc = Annotated[BranchSyncService, Depends(_svc)]


@router.get("/status", dependencies=Read)
def status(svc: Svc, check: bool = False):
    """حالة الربط (بدون السر أبداً). check=true يختبر الوصول للسيرفر."""
    return svc.status(check=check)


@router.post("/connect", dependencies=OwnerConnect)
def connect(data: ConnectIn, svc: Svc):
    """ربط هذا الفرع بسيرفر الفروع بكود الربط (مرة واحدة)."""
    return svc.connect(data)


@router.post("/register", dependencies=OwnerWrite)
def register(data: RegisterShopIn, svc: Svc):
    """المالك يسجّل محله على سيرفر الفروع بمفتاح ترخيص «سلسلة» (أو يسترجعه على جهاز جديد)."""
    return svc.register(data)


@router.get("/shop", dependencies=Read)
def shop_info(svc: Svc):
    """بيانات المحل والترخيص على سيرفر الفروع."""
    return svc.shop_info()


@router.post("/shop/license", dependencies=OwnerWrite)
def renew_license(data: LicenseKeyIn, svc: Svc):
    return svc.renew_license(data.license_key)


@router.get("/shop/branches", dependencies=OwnerRead)
def admin_branches(svc: Svc):
    """فروع المحل (من الجهاز الرئيسي للمالك)."""
    return svc.admin_branches()


@router.post("/shop/branches", dependencies=OwnerWrite)
def admin_create_branch(data: NewBranchIn, svc: Svc):
    """فرع جديد + كود ربط يكتبه جهاز الفرع."""
    return svc.admin_create_branch(data)


@router.post("/shop/branches/{branch_id}/pairing-code", dependencies=OwnerWrite)
def admin_pairing_code(branch_id: str, svc: Svc):
    return svc.admin_pairing_code(branch_id)


@router.patch("/shop/branches/{branch_id}", dependencies=OwnerWrite)
def admin_update(branch_id: str, data: BranchPatchIn, svc: Svc):
    return svc.admin_update(branch_id, data)


@router.post("/shop/branches/{branch_id}/revoke", dependencies=OwnerWrite)
def admin_revoke(branch_id: str, svc: Svc):
    """إلغاء ربط جهاز الفرع (ضاع/اتسرق/هيتغير): يتوقف فوراً."""
    return svc.admin_revoke(branch_id)


@router.post("/disconnect", dependencies=OwnerConnect)
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
