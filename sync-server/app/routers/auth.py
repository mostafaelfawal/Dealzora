"""دخول الفرع: ربط الجهاز بكود قصير (مرة واحدة)، ثم استبدال السر بتوكن قصير العمر.

محمي بحد طلبات لكل IP، وكل فشل يُسجَّل في السجل الأمني بدون أي سر.
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select

from ..audit import record_now
from ..db import SessionDep, utcnow
from ..errors import Forbidden, Unauthorized
from ..models import Branch, Shop
from ..ratelimit import client_ip, limit_auth
from ..schemas import PairIn, PairOut, TokenIn, TokenOut
from ..security import issue_token, verify_secret
from ..services import pairing

router = APIRouter(prefix="/auth", tags=["auth"], dependencies=[Depends(limit_auth)])


@router.post("/token", response_model=TokenOut)
def token(data: TokenIn, request: Request, session: SessionDep):
    ip = client_ip(request)
    row = session.execute(
        select(Branch, Shop).join(Shop, Shop.id == Branch.shop_id).where(Branch.id == data.branch_id)
    ).first()
    # نفس الرسالة للفرع غير الموجود والسر الخطأ (لا نكشف أي الاثنين).
    if row is None or not verify_secret(data.secret, row[0].secret_hash):
        record_now(
            session, "login_failed", actor="anonymous", ip=ip,
            branch_id=row[0].id if row else None, shop_id=row[1].id if row else None,
        )  # fmt: skip
        raise Unauthorized("bad_credentials", "بيانات الفرع غير صحيحة")
    branch, shop = row
    if not shop.is_active:
        raise Forbidden("shop_disabled", "حساب المحل موقوف")
    if not branch.is_active:
        raise Forbidden("branch_disabled", "هذا الفرع موقوف")
    branch.last_seen_at = utcnow()
    session.commit()
    access, expires = issue_token(branch)
    return TokenOut(access_token=access, expires_at=expires, branch_id=branch.id, shop_id=shop.id)


@router.post("/pair", response_model=PairOut)
def pair(data: PairIn, request: Request, session: SessionDep):
    """جهاز الفرع يكتب الكود اللي أعطيته للمالك، فيأخذ بيانات دخوله الدائمة مرة واحدة."""
    return pairing.redeem(session, data.code, ip=client_ip(request))
