"""تطبيق الهاتف (المالك ومديرو الفروع). مسارات منفصلة عن الفروع، وتوكن الهاتف لا يصلح لمسارات الفروع والعكس.

  POST /mobile/v1/auth/login         {code, username, password, device_id, device_name, platform} ← توكنات
  POST /mobile/v1/auth/refresh       {refresh_token} ← توكنات جديدة (والقديم يتوقف)
  POST /mobile/v1/auth/logout        هذا الهاتف
  POST /mobile/v1/auth/logout-all    كل هواتف هذا الحساب
  GET  /mobile/v1/me                 الحساب وفروعه المسموحة
  GET  /mobile/v1/sessions           هواتف هذا الحساب المسجّلة
  GET  /mobile/v1/branches           الفروع المسموحة مع آخر اتصال لكل فرع
  GET  /mobile/v1/branches/{id}      فرع مسموح (غير المسند = 404)

كل المسارات (عدا login/refresh/logout) تفرض خطة «سلسلة» على السيرفر: plan_upgrade_required (403).
"""

from datetime import timedelta

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import select

from ..config import get_settings
from ..db import SessionDep, utcnow
from ..errors import NotFound
from ..mobile_security import MobileSessionDep, MobileUser, MobileUserDep
from ..models import Branch
from ..ratelimit import client_ip, limit_auth
from ..schemas import (
    MobileBranchOut,
    MobileLoginIn,
    MobileRefreshIn,
    MobileSessionOut,
    MobileTokensOut,
    MobileUserOut,
)
from ..services import mobile_auth as svc

PREFIX = "/mobile/v1"

router = APIRouter(tags=["mobile"])


@router.post("/auth/login", response_model=MobileTokensOut, dependencies=[Depends(limit_auth)])
def login(data: MobileLoginIn, request: Request, session: SessionDep):
    return svc.login(session, data, ip=client_ip(request))


@router.post("/auth/refresh", response_model=MobileTokensOut, dependencies=[Depends(limit_auth)])
def refresh(data: MobileRefreshIn, request: Request, session: SessionDep):
    return svc.refresh(session, data.refresh_token, ip=client_ip(request))


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(ms: MobileSessionDep, request: Request, session: SessionDep):
    svc.logout(session, ms, ip=client_ip(request))


@router.post("/auth/logout-all")
def logout_all(ms: MobileSessionDep, request: Request, session: SessionDep) -> dict[str, int]:
    return {"revoked": svc.logout_all(session, ms, ip=client_ip(request))}


@router.get("/me", response_model=MobileUserOut)
def me(user: MobileUserDep):
    return MobileUserOut(account_id=user.account_id, username=user.username, role=user.role,  # type: ignore[arg-type]
                         shop_id=user.shop_id, shop_name=user.shop_name, branch_ids=list(user.branch_ids))  # fmt: skip


@router.get("/sessions", response_model=list[MobileSessionOut])
def sessions(user: MobileUserDep, session: SessionDep):
    return [
        MobileSessionOut(
            id=s.id,
            device_name=s.device_name,
            platform=s.platform,
            created_at=s.created_at,
            last_used_at=svc.aware(s.last_used_at),
            is_current=s.id == user.session_id,
        )
        for s in svc.active_sessions(session, user.account_id)
    ]


def _branch_out(b: Branch) -> MobileBranchOut:
    window = timedelta(seconds=get_settings().online_window_seconds)
    seen = svc.aware(b.last_seen_at)
    return MobileBranchOut(id=b.id, name=b.name, code=b.code, is_active=b.is_active, last_seen_at=seen,
                           online=bool(b.is_active and seen and utcnow() - seen <= window))  # fmt: skip


def _branches(session: SessionDep, user: MobileUser) -> list[Branch]:
    rows = session.scalars(
        select(Branch).where(Branch.shop_id == user.shop_id, Branch.id.in_(user.branch_ids)).order_by(Branch.created_at)
    ).all()
    return list(rows)


@router.get("/branches", response_model=list[MobileBranchOut])
def branches(user: MobileUserDep, session: SessionDep):
    return [_branch_out(b) for b in _branches(session, user)]


@router.get("/branches/{branch_id}", response_model=MobileBranchOut)
def branch(branch_id: str, user: MobileUserDep, session: SessionDep):
    user.require_branch(branch_id)
    row = session.get(Branch, branch_id)
    if row is None or row.shop_id != user.shop_id:
        raise NotFound("branch_not_found", "الفرع غير موجود")
    return _branch_out(row)
