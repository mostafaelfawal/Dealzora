"""حارس الساعة: لو وقت الجهاز أقدم من آخر نشاط مسجَّل في audit_log فالتاريخ رُجِّع.
UUIDv7 يحمل الوقت بالـ ms في أول 48 بت، فلا نحتاج عموداً إضافياً. القاعدة مشفّرة فلا يمكن تعديلها خارج التطبيق.
"""

import time
import uuid

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ForbiddenError

CLOCK_TOLERANCE_MS = 10 * 60 * 1000


def last_activity_ms(session: Session) -> int | None:
    last_id = session.execute(
        text("SELECT id FROM audit_log ORDER BY id DESC LIMIT 1")
    ).scalar()
    return (uuid.UUID(last_id).int >> 80) if last_id else None


def ensure_clock_sane(session: Session) -> None:
    last = last_activity_ms(session)
    if last is not None and time.time_ns() // 1_000_000 + CLOCK_TOLERANCE_MS < last:
        raise ForbiddenError(
            "clock_tampered",
            "تاريخ الجهاز أقدم من آخر نشاط مسجَّل. صحّح التاريخ ثم أعد المحاولة",
        )
