"""تطبيق الهاتف (المالك ومديرو الفروع). مسارات منفصلة عن الفروع، وتوكن الهاتف لا يصلح لمسارات الفروع والعكس.

  POST /mobile/v1/auth/login         {code, username, password, device_id, device_name, platform} ← توكنات
  POST /mobile/v1/auth/refresh       {refresh_token} ← توكنات جديدة (والقديم يتوقف)
  POST /mobile/v1/auth/logout        هذا الهاتف
  POST /mobile/v1/auth/logout-all    كل هواتف هذا الحساب
  GET  /mobile/v1/me                 الحساب وفروعه المسموحة
  GET  /mobile/v1/sessions           هواتف هذا الحساب المسجّلة
  GET  /mobile/v1/branches           الفروع المسموحة: الحالة (متصل/متأخر/منقطع)، آخر ظهور، تأخر المزامنة
  GET  /mobile/v1/branches/{id}      فرع مسموح (غير المسند = 404)
  GET  /mobile/v1/summary?date_from=&date_to=[&branch_id=]
                                     ملخص الفترة لكل فرع ومجمّع + اتجاه يومي + مقارنة (نفس تقرير الفروع)

كل المسارات (عدا login/refresh/logout) تفرض خطة «سلسلة» على السيرفر: plan_upgrade_required (403).
"""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status

from ..db import SessionDep
from ..errors import NotFound
from ..mobile_security import MobileSessionDep, MobileUserDep
from ..ratelimit import client_ip, limit_auth
from ..schemas import (
    MobileBranchOut,
    MobileLoginIn,
    MobileRefreshIn,
    MobileSessionOut,
    MobileSummaryOut,
    MobileTokensOut,
    MobileUserOut,
)
from ..services import mobile_auth as svc
from ..services import mobile_reports as reports

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


@router.get("/branches", response_model=list[MobileBranchOut])
def branches(user: MobileUserDep, session: SessionDep):
    return reports.branch_states(session, user.shop_id, list(user.branch_ids))


@router.get("/branches/{branch_id}", response_model=MobileBranchOut)
def branch(branch_id: str, user: MobileUserDep, session: SessionDep):
    user.require_branch(branch_id)
    rows = reports.branch_states(session, user.shop_id, [branch_id])
    if not rows:
        raise NotFound("branch_not_found", "الفرع غير موجود")
    return rows[0]


@router.get("/summary", response_model=MobileSummaryOut)
def summary(
    user: MobileUserDep,
    session: SessionDep,
    date_from: Annotated[date, Query()],
    date_to: Annotated[date, Query()],
    branch_id: Annotated[str | None, Query(max_length=36)] = None,
):
    """الفترة بتاريخ الهاتف المحلي (مثل البرنامج). المدير: فروعه فقط، وفرع غير مسند = 404."""
    ids = list(user.branch_ids)
    if branch_id is not None:
        user.require_branch(branch_id)
        ids = [branch_id]
    return reports.summary(session, user.shop_id, ids, date_from, date_to)
