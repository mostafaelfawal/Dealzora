"""دليل فروع المحل: لاختيار الفرع في التحويلات ومعرفة المتصل الآن. بدون أي بيانات دخول."""

from datetime import UTC, timedelta

from fastapi import APIRouter
from sqlalchemy import select

from ..config import get_settings
from ..db import SessionDep, utcnow
from ..models import Branch
from ..schemas import BranchPublicOut
from ..security import CallerDep

router = APIRouter(prefix="/branches", tags=["branches"])


@router.get("", response_model=list[BranchPublicOut])
def list_branches(caller: CallerDep, session: SessionDep):
    window = timedelta(seconds=get_settings().online_window_seconds)
    now = utcnow()
    rows = session.scalars(
        select(Branch).where(Branch.shop_id == caller.shop_id).order_by(Branch.created_at)
    ).all()

    def online(b: Branch) -> bool:
        if b.last_seen_at is None:
            return False
        seen = b.last_seen_at if b.last_seen_at.tzinfo else b.last_seen_at.replace(tzinfo=UTC)
        return now - seen <= window

    return [
        BranchPublicOut(
            id=b.id,
            name=b.name,
            code=b.code,
            is_active=b.is_active,
            online=b.is_active and online(b),
            last_seen_at=b.last_seen_at,
            is_me=b.id == caller.branch_id,
        )
        for b in rows
    ]
