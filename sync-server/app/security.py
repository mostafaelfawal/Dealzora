"""هوية المتصل.

- الفرع: سر دخول (256 بت عشوائي، يُخزَّن مُجزّأ SHA-256) يُستبدل بتوكن JWT قصير العمر يحمل
  shop_id و branch_id و token_version. كل استعلام يُقيَّد بالمحل والفرع، فلا يرى فرعٌ بيانات محل آخر.
  تغيير السر أو إعادة الربط يزيد token_version فتتوقف كل التوكنات القديمة فوراً.
- الإدارة (أنت): ADMIN_TOKEN ثابت من البيئة، ومقيّد اختيارياً بقائمة IPs.
"""

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_session, utcnow
from .errors import Forbidden, Unauthorized
from .models import Branch, Shop
from .ratelimit import client_ip

ALGORITHM = "HS256"
ISSUER = "dealzora-sync"
TOKEN_TYPE = "branch"
_TOUCH_EVERY = timedelta(seconds=60)


def new_secret() -> str:
    return secrets.token_urlsafe(32)


def hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


def verify_secret(secret: str, hashed: str) -> bool:
    return hmac.compare_digest(hash_secret(secret), hashed)


def issue_token(branch: Branch) -> tuple[str, datetime]:
    settings = get_settings()
    now = datetime.now(UTC)
    expires = now + timedelta(minutes=settings.token_ttl_minutes)
    token = jwt.encode(
        {
            "sub": branch.id,
            "shop": branch.shop_id,
            "ver": branch.token_version,
            "typ": TOKEN_TYPE,
            "iss": ISSUER,
            "iat": now,
            "exp": expires,
        },
        settings.jwt_secret,
        algorithm=ALGORITHM,
    )
    return token, expires


def _bearer(authorization: str | None) -> str:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise Unauthorized("unauthorized", "مطلوب توكن (Authorization: Bearer …)")
    return token


@dataclass(frozen=True, slots=True)
class Caller:
    branch_id: str
    shop_id: str
    branch_name: str
    token_exp: datetime
    ip: str


def get_caller(
    request: Request,
    session: Annotated[Session, Depends(get_session)],
    authorization: Annotated[str | None, Header()] = None,
) -> Caller:
    return _caller(request, session, authorization, enforce_license=True)


def get_caller_for_renewal(
    request: Request,
    session: Annotated[Session, Depends(get_session)],
    authorization: Annotated[str | None, Header()] = None,
) -> Caller:
    """مثل get_caller لكن يسمح بترخيص منتهٍ: لتجديده فقط."""
    return _caller(request, session, authorization, enforce_license=False)


def _caller(request: Request, session: Session, authorization: str | None, *, enforce_license: bool) -> Caller:
    try:
        claims = jwt.decode(
            _bearer(authorization),
            get_settings().jwt_secret,
            algorithms=[ALGORITHM],
            issuer=ISSUER,
            options={"require": ["exp", "sub", "shop", "typ", "ver", "iss"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise Unauthorized("token_expired", "انتهى التوكن، اطلب توكناً جديداً") from exc
    except jwt.PyJWTError as exc:
        raise Unauthorized("token_invalid", "توكن غير صالح") from exc
    if claims.get("typ") != TOKEN_TYPE:
        raise Unauthorized("token_invalid", "توكن غير صالح")

    row = session.execute(
        select(Branch, Shop)
        .join(Shop, Shop.id == Branch.shop_id)
        .where(Branch.id == claims["sub"], Branch.shop_id == claims["shop"])
    ).first()
    if row is None:
        raise Unauthorized("branch_unknown", "الفرع غير موجود")
    branch, shop = row
    if claims["ver"] != branch.token_version:
        raise Unauthorized("token_revoked", "تم تغيير بيانات دخول هذا الفرع. سجّل الدخول من جديد")
    if not shop.is_active:
        raise Forbidden("shop_disabled", "حساب المحل موقوف")
    if not branch.is_active:
        raise Forbidden("branch_disabled", "هذا الفرع موقوف")

    now = utcnow()
    expires = shop.license_expires_at
    if enforce_license and expires is not None:
        expires = expires if expires.tzinfo else expires.replace(tzinfo=UTC)
        if now > expires + timedelta(days=get_settings().license_grace_days):
            raise Forbidden("license_expired", "انتهى ترخيص المحل. جدّد الاشتراك من الجهاز الرئيسي للمالك")
    seen = branch.last_seen_at
    if seen is None or now - (seen if seen.tzinfo else seen.replace(tzinfo=UTC)) > _TOUCH_EVERY:
        branch.last_seen_at = now  # «متصل» في قائمة الفروع، بدون كتابة في كل طلب
        session.commit()
    return Caller(
        branch_id=branch.id,
        shop_id=shop.id,
        branch_name=branch.name,
        token_exp=datetime.fromtimestamp(claims["exp"], tz=UTC),
        ip=client_ip(request),
    )


CallerDep = Annotated[Caller, Depends(get_caller)]
RenewalCallerDep = Annotated[Caller, Depends(get_caller_for_renewal)]


def require_admin(request: Request, authorization: Annotated[str | None, Header()] = None) -> None:
    settings = get_settings()
    allowed = settings.admin_allowed_ips
    if allowed and client_ip(request) not in allowed:
        raise Forbidden("admin_ip_denied", "لوحة الإدارة غير متاحة من هذا العنوان")
    token = _bearer(authorization)
    if not hmac.compare_digest(token.encode(), settings.admin_token.encode()):
        raise Forbidden("admin_only", "صلاحية الإدارة مطلوبة")
