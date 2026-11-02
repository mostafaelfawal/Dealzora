"""Base + الحقول المشتركة لكل الجداول (UUIDv7، version، حذف ناعم، حالة المزامنة)."""

import os
import time
import uuid
from datetime import datetime, timezone
from enum import StrEnum

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def uuid7() -> str:
    """UUIDv7: 48 بت زمن (ms) + عشوائي، فيكون مرتباً زمنياً."""
    ms = time.time_ns() // 1_000_000
    raw = bytearray(ms.to_bytes(6, "big") + os.urandom(10))
    raw[6] = (raw[6] & 0x0F) | 0x70
    raw[8] = (raw[8] & 0x3F) | 0x80
    return str(uuid.UUID(bytes=bytes(raw)))


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SyncState(StrEnum):
    PENDING = "pending"
    SYNCED = "synced"


class Base(DeclarativeBase):
    pass


class SyncMixin:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid7)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    device_id: Mapped[str] = mapped_column(String(36))
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    sync_state: Mapped[str] = mapped_column(String(16), default=SyncState.PENDING.value)

    def mark_modified(self) -> None:
        self.version += 1
        self.updated_at = utcnow()
        self.sync_state = SyncState.PENDING.value

    def mark_deleted(self) -> None:
        """Tombstone: لا حذف فعلي قبل فترة الاحتفاظ."""
        self.deleted_at = utcnow()
        self.mark_modified()
