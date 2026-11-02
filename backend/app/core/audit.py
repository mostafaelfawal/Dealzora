"""سجل التدقيق (Audit Log): كل تعديل أو حذف يُسجَّل داخل نفس معاملة العملية."""

from typing import Any

from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.core.base import Base, SyncMixin, uuid7
from app.core.security import Actor


class AuditLog(SyncMixin, Base):
    __tablename__ = "audit_log"

    entity: Mapped[str] = mapped_column(String(40), index=True)
    entity_id: Mapped[str] = mapped_column(String(36), index=True)
    action: Mapped[str] = mapped_column(String(40))
    actor_id: Mapped[str] = mapped_column(String(36))
    changes: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)


def record_audit(
    session: Session,
    actor: Actor,
    *,
    entity: str,
    entity_id: str,
    action: str,
    changes: dict[str, Any] | None = None,
) -> None:
    session.add(
        AuditLog(
            id=uuid7(),
            entity=entity,
            entity_id=entity_id,
            action=action,
            actor_id=actor.user_id,
            created_by=actor.user_id,
            device_id=actor.device_id,
            changes=changes,
        )
    )
