"""سجل أمني على السيرفر. لا يُسجَّل فيه أي سر أو توكن أبداً."""

from typing import Any

from sqlalchemy.orm import Session

from .models import AuditLog


def record(
    session: Session,
    action: str,
    *,
    actor: str,
    shop_id: str | None = None,
    branch_id: str | None = None,
    ip: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """يُضاف للجلسة الحالية (يُحفظ مع commit المستدعي)."""
    session.add(
        AuditLog(
            actor=actor,
            action=action,
            shop_id=shop_id,
            branch_id=branch_id,
            ip=ip,
            details=details,
        )
    )


def record_now(session: Session, action: str, **kw: Any) -> None:
    """للأحداث التي تُسجَّل حتى لو فشل الطلب (دخول فاشل): commit مستقل."""
    record(session, action, **kw)
    session.commit()
