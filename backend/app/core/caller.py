"""مَن يتصل بالـ backend؟ (الجهاز، لا المستخدم)

- الجهاز الأساسي: X-Session-Token (توكن عشوائي من Rust في كل تشغيل، لا يغادر الجهاز).
- جهاز كاشير مقترن: X-Device-Token (يُعطى مرة عند الاقتران، ويُخزَّن على جهاز الكاشير فقط).

device_id للمتصل يُسجَّل على كل عملياته (الوردية والدرج والفواتير)، فلكل جهاز درجه ووردياته.
"""

import hashlib
import hmac
from dataclasses import dataclass
from datetime import timedelta
from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from .base import utcnow
from .config import get_settings
from .database import get_session
from .errors import ForbiddenError, UnauthorizedError

MAIN_DEVICE_NAME = "الجهاز الأساسي"
_TOUCH_EVERY = timedelta(seconds=30)


@dataclass(frozen=True, slots=True)
class Caller:
    device_id: str
    is_main: bool
    name: str


def hash_device_token(token: str) -> str:
    return hashlib.sha256(f"device|{token}".encode()).hexdigest()


def get_caller(
    session: Annotated[Session, Depends(get_session)],
    x_session_token: Annotated[str | None, Header()] = None,
    x_device_token: Annotated[str | None, Header()] = None,
) -> Caller:
    settings = get_settings()
    if x_session_token and hmac.compare_digest(x_session_token, settings.session_token):
        return Caller(settings.device_id, True, MAIN_DEVICE_NAME)

    if x_device_token:
        from app.modules.devices.model import Device  # متأخر: تفادي الاستيراد الدائري

        device = session.scalars(
            select(Device).where(
                Device.token_hash == hash_device_token(x_device_token),
                Device.deleted_at.is_(None),
            )
        ).first()
        if device is not None:
            now = utcnow()
            seen = device.last_seen_at
            if seen is None or now - (seen if seen.tzinfo else seen.replace(tzinfo=now.tzinfo)) > _TOUCH_EVERY:
                device.last_seen_at = now  # «متصل الآن» في قائمة الأجهزة
                try:
                    session.commit()
                except OperationalError:
                    session.rollback()
            return Caller(device.id, False, device.name)
        # جهاز أُلغي اقترانه: رسالة واضحة ليعرض جهاز الكاشير شاشة الاتصال من جديد.
        raise UnauthorizedError("device_not_paired", "هذا الجهاز لم يعد مرتبطاً بالجهاز الأساسي")

    raise UnauthorizedError("unauthorized", "جلسة غير صالحة")


CallerDep = Annotated[Caller, Depends(get_caller)]


def require_main_device(caller: CallerDep) -> Caller:
    """عمليات تخص ملفات/شبكة الجهاز الأساسي نفسه (مكان النسخ، الاستعادة، الاقتران)."""
    if not caller.is_main:
        raise ForbiddenError("main_device_only", "هذه العملية من الجهاز الأساسي فقط")
    return caller
