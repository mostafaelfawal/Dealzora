"""خدمة المالك الذاتية (بدون تدخل المورّد).

  POST  /v1/shops/register                    مفتاح ترخيص «سلسلة» ← محل + الفرع الرئيسي لهذا الجهاز
  GET   /v1/shop                              بيانات المحل والترخيص
  POST  /v1/shop/license                      تجديد الترخيص (مفتاح جديد لنفس الترخيص)
  GET   /v1/shop/branches                     فروع المحل (للفرع الرئيسي)
  POST  /v1/shop/branches                     فرع جديد + كود ربطه
  POST  /v1/shop/branches/{id}/pairing-code   كود ربط جديد (يلغي القديم)
  PATCH /v1/shop/branches/{id}                تغيير الاسم / إيقاف / تفعيل
  POST  /v1/shop/branches/{id}/revoke         إلغاء ربط جهاز الفرع (يتوقف فوراً)
  GET   /v1/shop/lease                        شهادة الفرع الموقّعة (يرث خطة المحل)
  GET/POST /v1/shop/staff, PATCH/DELETE /v1/shop/staff/{id}   موظفو كل الفروع (المالك)
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request, status

from ..db import SessionDep
from ..ratelimit import client_ip, limit_auth
from ..schemas import (
    AdminBranchOut,
    BranchIn,
    BranchPatch,
    LeaseOut,
    LicenseIn,
    NewBranchOut,
    PairingCodeOut,
    PairOut,
    RegisterIn,
    ShopInfoOut,
    StaffIn,
    StaffOut,
    StaffPatch,
)
from ..security import CallerDep, RenewalCallerDep
from ..models import Branch, Shop
from ..services import lease as lease_svc
from ..services import self_service as svc
from ..services import staff as staff_svc

router = APIRouter(tags=["shop"])


@router.post(
    "/shops/register",
    response_model=PairOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(limit_auth)],
)
def register(data: RegisterIn, request: Request, session: SessionDep):
    return svc.register(session, data, ip=client_ip(request))


@router.get("/shop", response_model=ShopInfoOut)
def info(caller: CallerDep, session: SessionDep):
    return svc.info(session, caller)


@router.post("/shop/license", response_model=ShopInfoOut, dependencies=[Depends(limit_auth)])
def renew(data: LicenseIn, caller: RenewalCallerDep, session: SessionDep):
    return svc.renew(session, caller, data.license_key)


@router.get("/shop/branches", response_model=list[AdminBranchOut])
def branches(caller: CallerDep, session: SessionDep):
    return svc.list_branches(session, caller)


@router.post("/shop/branches", response_model=NewBranchOut, status_code=status.HTTP_201_CREATED)
def create_branch(data: BranchIn, caller: CallerDep, session: SessionDep):
    return svc.create_branch(session, caller, data)


@router.post("/shop/branches/{branch_id}/pairing-code", response_model=PairingCodeOut)
def pairing_code(branch_id: str, caller: CallerDep, session: SessionDep):
    return svc.pairing_code(session, caller, branch_id)


@router.patch("/shop/branches/{branch_id}", response_model=AdminBranchOut)
def update_branch(branch_id: str, data: BranchPatch, caller: CallerDep, session: SessionDep):
    return svc.update_branch(session, caller, branch_id, name=data.name, is_active=data.is_active)


@router.post("/shop/branches/{branch_id}/revoke", response_model=AdminBranchOut)
def revoke(branch_id: str, caller: CallerDep, session: SessionDep):
    return svc.revoke_device(session, caller, branch_id)


@router.get("/shop/lease", response_model=LeaseOut)
def lease(caller: CallerDep, session: SessionDep):
    """أي فرع مربوط (والمحل ساري الترخيص) يأخذ شهادة بخطة محله."""
    shop = session.get(Shop, caller.shop_id)
    branch = session.get(Branch, caller.branch_id)
    token, payload = lease_svc.issue(shop, branch)
    return LeaseOut(lease=token, plan=payload["plan"], expires_at=datetime.fromtimestamp(payload["exp"], tz=UTC))


@router.get("/shop/staff", response_model=list[StaffOut])
def list_staff(caller: CallerDep, session: SessionDep):
    return staff_svc.list_staff(session, caller)


@router.post("/shop/staff", response_model=StaffOut, status_code=status.HTTP_201_CREATED)
def create_staff(data: StaffIn, caller: CallerDep, session: SessionDep):
    return staff_svc.create(session, caller, data)


@router.patch("/shop/staff/{staff_id}", response_model=StaffOut)
def update_staff(staff_id: str, data: StaffPatch, caller: CallerDep, session: SessionDep):
    return staff_svc.update(session, caller, staff_id, data)


@router.delete("/shop/staff/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_staff(staff_id: str, caller: CallerDep, session: SessionDep):
    staff_svc.delete(session, caller, staff_id)
