"""جداول SQLAlchemy للمستخدمين والجلسات."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, SyncMixin, utcnow

from .constants import MAX_USERNAME_LEN


class User(SyncMixin, Base):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(MAX_USERNAME_LEN))  # مُطبَّع (lowercase)
    password_hash: Mapped[str] = mapped_column(String(255))  # Argon2id
    role: Mapped[str] = mapped_column(String(16))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    failed_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("uq_users_username_live", "username", unique=True, sqlite_where=text("deleted_at IS NULL")),
    )


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)  # SHA-256 للتوكن
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    __table_args__ = (Index("ix_auth_sessions_expires", "expires_at"),)