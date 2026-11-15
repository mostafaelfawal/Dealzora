"""هوية مستخدم تطبيق الهاتف (المالك أو مدير فرع).

توكن الهاتف منفصل تماماً عن توكن الفرع، فلا يصلح أحدهما مكان الآخر:
- مفتاح توقيع مشتق من SYNC_JWT_SECRET بتسمية خاصة (التوقيع نفسه يختلف).
- typ=mobile و aud=dealzora-mobile (توكن الفرع بلا aud، وPyJWT يرفض aud غير متوقع على مسارات الفروع).
كل طلب يعيد فحص الجلسة والحساب والمحل والخطة من القاعدة (services/mobile_auth).
"""

import hashlib
import hmac
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, Header, Request
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_session, utcnow
from .errors import NotFound, Unauthorized
from .models import MobileSession
from .ratelimit import client_ip
from .security import ALGORITHM, ISSUER, _bearer
from .services import mobile_auth

TOKEN_TYPE = "mobile"
AUDIENCE = "dealzora-mobile"
_TOUCH_EVERY = timedelta(seconds=60)


@lru_cache
def _key(secret: str) -> str:
    return hmac.new(secret.encode(), b"dealzora-mobile-access-v1", hashlib.sha256).hexdigest()


def issue_access(ms: MobileSession) -> tuple[str, datetime]:
    settings = get_settings()
    now = datetime.now(UTC)
    expires = now + timedelta(minutes=settings.mobile_access_ttl_minutes)
    token = jwt.encode(
        {"sub": ms.id, "shop": ms.shop_id, "typ": TOKEN_TYPE, "aud": AUDIENCE, "iss": ISSUER, "iat": now, "exp": expires},
        _key(settings.jwt_secret),
        algorithm=ALGORITHM,
    )
    return token, expires


@dataclass(frozen=True, slots=True)
class MobileUser:
    session_id: str
    shop_id: str
    shop_name: str
    account_id: str
    username: str
    role: str  # owner / manager
    branch_ids: tuple[str, ...]
    ip: str

    def require_branch(self, branch_id: str) -> None:
        """فرع غير مسند للمستخدم = غير موجود بالنسبة له (لا نكشف وجوده)."""
        if branch_id not in self.branch_ids:
            raise NotFound("branch_not_found", "الفرع غير موجود")


def _load(session: Session, authorization: str | None) -> MobileSession:
    try:
        claims = jwt.decode(
            _bearer(authorization),
            _key(get_settings().jwt_secret),
            algorithms=[ALGORITHM],
            issuer=ISSUER,
            audience=AUDIENCE,
            options={"require": ["exp", "sub", "shop", "typ", "aud", "iss"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise Unauthorized("token_expired", "انتهى التوكن، جدّده بتوكن التجديد") from exc
    except jwt.PyJWTError as exc:
        raise Unauthorized("token_invalid", "توكن غير صالح") from exc
    if claims.get("typ") != TOKEN_TYPE:
        raise Unauthorized("token_invalid", "توكن غير صالح")
    ms = session.get(MobileSession, claims["sub"])
    if ms is None or ms.shop_id != claims["shop"]:
        raise Unauthorized("token_invalid", "توكن غير صالح")
    return ms


def get_mobile_session(
    session: Annotated[Session, Depends(get_session)],
    authorization: Annotated[str | None, Header()] = None,
) -> MobileSession:
    """جلسة سارية فقط (بلا فحص الخطة): لتسجيل الخروج حتى لو المحل نزل لخطة أقل."""
    ms = _load(session, authorization)
    if ms.revoked_at is not None:
        raise Unauthorized("session_revoked", "تم تسجيل الخروج من هذا الهاتف. سجّل الدخول من جديد")
    return ms


def get_mobile_user(
    request: Request,
    session: Annotated[Session, Depends(get_session)],
    authorization: Annotated[str | None, Header()] = None,
) -> MobileUser:
    """كل مسارات البيانات: جلسة سارية + الحساب لم يتغير + المحل نشط ومرخّص وبخطة «سلسلة»."""
    ms = _load(session, authorization)
    account, shop = mobile_auth.validate_session(session, ms)
    mobile_auth.check_shop(shop)
    ip = client_ip(request)
    now = utcnow()
    last = mobile_auth.aware(ms.last_used_at)
    if last is None or now - last > _TOUCH_EVERY:
        ms.last_used_at, ms.last_ip = now, ip  # بدون كتابة في كل طلب
        session.commit()
    return MobileUser(session_id=ms.id, shop_id=shop.id, shop_name=shop.name, account_id=account.id,
                      username=account.username, role=account.role, branch_ids=account.branch_ids, ip=ip)  # fmt: skip


MobileSessionDep = Annotated[MobileSession, Depends(get_mobile_session)]
MobileUserDep = Annotated[MobileUser, Depends(get_mobile_user)]
