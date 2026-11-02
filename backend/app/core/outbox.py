"""Outbox: حدث لكل تغيير يُكتب في نفس معاملة العملية، وعامل المزامنة يرسله لاحقاً."""

from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import JSON, DateTime, Integer, String
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.core.base import Base, utcnow, uuid7


class OutboxStatus(StrEnum):
    READY = "ready"
    SENDING = "sending"
    FAILED = "failed"
    DONE = "done"


class OutboxOp(StrEnum):
    UPSERT = "upsert"
    DELETE = "delete"


class OutboxEvent(Base):
    __tablename__ = "outbox"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid7)
    entity: Mapped[str] = mapped_column(String(40), index=True)
    entity_id: Mapped[str] = mapped_column(String(36))
    op: Mapped[str] = mapped_column(String(16))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    base_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default=OutboxStatus.READY.value, index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String(36), unique=True, default=uuid7)
    device_id: Mapped[str] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


def enqueue_outbox(
    session: Session,
    *,
    entity: str,
    entity_id: str,
    op: OutboxOp,
    payload: dict[str, Any],
    device_id: str,
    base_version: int | None = None,
) -> None:
    session.add(
        OutboxEvent(
            id=uuid7(),
            entity=entity,
            entity_id=entity_id,
            op=op.value,
            payload=payload,
            base_version=base_version,
            device_id=device_id,
        )
    )
