"""لوحة الإدارة (أنت فقط، بـ ADMIN_TOKEN ومن IPs مسموحة اختيارياً): المحلات والفروع وأكواد الربط
والسجل الأمني. كل عملية هنا تُسجَّل مع الـ IP."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select

from ..db import SessionDep
from ..models import AuditLog
from ..ratelimit import client_ip
from ..schemas import (
    AuditOut,
    BranchCredentials,
    BranchIn,
    BranchOut,
    BranchPatch,
    PairingCodeOut,
    ShopIn,
    ShopOut,
    ShopPatch,
)
from ..security import require_admin
from ..services import pairing, shops

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/shops", response_model=list[ShopOut])
def list_shops(session: SessionDep):
    return shops.list_shops(session)


@router.post("/shops", response_model=ShopOut, status_code=status.HTTP_201_CREATED)
def create_shop(data: ShopIn, request: Request, session: SessionDep):
    return shops.create_shop(session, data, ip=client_ip(request))


@router.patch("/shops/{shop_id}", response_model=ShopOut)
def update_shop(shop_id: str, data: ShopPatch, request: Request, session: SessionDep):
    """is_active=false يوقف كل فروع المحل فوراً (اشتراك انتهى مثلاً)."""
    return shops.update_shop(session, shop_id, data, ip=client_ip(request))


@router.post(
    "/shops/{shop_id}/branches",
    response_model=BranchCredentials,
    status_code=status.HTTP_201_CREATED,
)
def create_branch(shop_id: str, data: BranchIn, request: Request, session: SessionDep):
    """السر يظهر هنا مرة واحدة. الأسهل للمالك: اطلع كود ربط بدلاً منه (pairing-code)."""
    return shops.create_branch(session, shop_id, data, ip=client_ip(request))


@router.patch("/branches/{branch_id}", response_model=BranchOut)
def update_branch(branch_id: str, data: BranchPatch, request: Request, session: SessionDep):
    return shops.update_branch(session, branch_id, data, ip=client_ip(request))


@router.post("/branches/{branch_id}/rotate-secret", response_model=BranchCredentials)
def rotate_secret(branch_id: str, request: Request, session: SessionDep):
    """جهاز ضاع؟ سر جديد، والقديم وكل توكناته تتوقف فوراً."""
    return shops.rotate_secret(session, branch_id, ip=client_ip(request))


@router.post("/branches/{branch_id}/pairing-code", response_model=PairingCodeOut)
def pairing_code(branch_id: str, request: Request, session: SessionDep):
    """كود قصير (XXXX-XXXX-XXXX) يكتبه المالك في برنامج الفرع. مرة واحدة وصالح دقائق.
    الربط يوقف أي جهاز قديم لنفس الفرع."""
    return pairing.create_code(session, branch_id, ip=client_ip(request))


@router.get("/audit", response_model=list[AuditOut])
def audit(
    session: SessionDep,
    shop_id: str | None = None,
    action: str | None = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
):
    stmt = select(AuditLog).order_by(AuditLog.id.desc()).limit(limit)
    if shop_id:
        stmt = stmt.where(AuditLog.shop_id == shop_id)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    return [
        AuditOut(
            id=r.id,
            at=r.at,
            actor=r.actor,
            action=r.action,
            shop_id=r.shop_id,
            branch_id=r.branch_id,
            ip=r.ip,
            details=r.details,
        )
        for r in session.scalars(stmt).all()
    ]
