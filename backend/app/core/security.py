"""هوية المستخدم + تصريح الكتابة (الترخيص). الأدوار المسموحة لكل مسار تُحدَّد في core/permissions.py."""

import hashlib
import hmac
import time
from dataclasses import dataclass
from enum import StrEnum
from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.bearer import get_bearer_token
from app.core.clock_guard import ensure_clock_sane
from app.core.config import get_settings
from app.core.database import get_session
from app.core.errors import ForbiddenError, UnauthorizedError


class Role(StrEnum):
    MANAGER = "manager"
    CASHIER = "cashier"
    # OWNER = "owner"


@dataclass(frozen=True, slots=True)
class Actor:
    user_id: str
    role: Role
    device_id: str


def require_app_token(
    x_session_token: Annotated[str | None, Header()] = None,
) -> None:
    """App-instance gate (Rust token). It is NOT an identity, only 'this request came from our app'."""
    if not x_session_token or not hmac.compare_digest(
        x_session_token, get_settings().session_token
    ):
        raise UnauthorizedError("unauthorized", "جلسة غير صالحة")


def get_actor(
    session: Annotated[Session, Depends(get_session)],
    _app: Annotated[None, Depends(require_app_token)],
    token: Annotated[str, Depends(get_bearer_token)],
) -> Actor:
    from app.modules.auth.service import AuthService  # استيراد متأخر لتفادي الدوران

    return AuthService(session).authenticate(token)


def require_write_permit(
    session: Annotated[Session, Depends(get_session)],
    x_write_permit: Annotated[str | None, Header()] = None,
) -> None:
    """تصريح كتابة قصير العمر يصدره Rust بعد فحص الترخيص. الصيغة: '<expires_unix>.<hmac_sha256_hex>'."""
    if not x_write_permit or "." not in x_write_permit:
        raise ForbiddenError(
            "write_permit_required", "الترخيص منتهٍ: النظام في وضع القراءة فقط"
        )
    expires, _, signature = x_write_permit.partition(".")
    expected = hmac.new(
        get_settings().write_permit_secret.encode(), expires.encode(), hashlib.sha256
    ).hexdigest()
    if not expires.isdigit() or not hmac.compare_digest(signature, expected):
        raise ForbiddenError("write_permit_invalid", "تصريح الكتابة غير صالح")
    if int(expires) < time.time():
        raise ForbiddenError(
            "write_permit_expired", "انتهى تصريح الكتابة، أعد المحاولة"
        )
    ensure_clock_sane(session)