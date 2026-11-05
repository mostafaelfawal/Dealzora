"""جدول SQLAlchemy للمستخدمين."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, SyncMixin

from .constants import MAX_USERNAME_LEN


class User(SyncMixin, Base):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(MAX_USERNAME_LEN))  # مُطبَّع (lowercase)
    password_hash: Mapped[str] = mapped_column(String(255))  # Argon2id
    role: Mapped[str] = mapped_column(String(16))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    failed_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    password_changed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        Index(
            "uq_users_username_live",
            "username",
            unique=True,
            sqlite_where=text("deleted_at IS NULL"),
        ),
    )
