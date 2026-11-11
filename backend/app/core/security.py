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
from app.core.caller import Caller, CallerDep
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


def require_app_token(caller: CallerDep) -> Caller:
    """بوابة الجهاز: الجهاز الأساسي (توكن Rust) أو جهاز كاشير مقترن (توكن الجهاز).
    ليست هوية مستخدم؛ المستخدم يأتي من جلسة الدخول (get_actor)."""
    return caller


def get_actor(
    session: Annotated[Session, Depends(get_session)],
    caller: CallerDep,
    token: Annotated[str, Depends(get_bearer_token)],
) -> Actor:
    from app.modules.auth.service import AuthService  # استيراد متأخر لتفادي الدوران

    return AuthService(session).authenticate(token, caller.device_id)


def require_write_permit(
    session: Annotated[Session, Depends(get_session)],
    caller: CallerDep,
    x_write_permit: Annotated[str | None, Header()] = None,
) -> None:
    """تصريح كتابة قصير العمر يصدره Rust بعد فحص الترخيص. الصيغة: '<expires_unix>.<hmac_sha256_hex>'.

    جهاز الكاشير ليس لديه ترخيص: يكتب طالما عقد ترخيص الجهاز الأساسي ساري (devices.runtime).
    """
    if not caller.is_main:
        from app.modules.devices.runtime import active_lease  # متأخر: تفادي الدوران

        if active_lease() is None:
            raise ForbiddenError(
                "main_license_inactive",
                "ترخيص الجهاز الأساسي غير فعّال أو البرنامج مغلق عليه: النظام للقراءة فقط",
            )
        ensure_clock_sane(session)
        return
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