"""Users + server-side sessions. Role is read from DB, never from the client."""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, select, text
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.core.base import Base, SyncMixin, utcnow
from app.core.errors import ForbiddenError, UnauthorizedError

SESSION_TTL = timedelta(hours=12)
MAX_FAILED = 5
LOCK_FOR = timedelta(minutes=5)

_hasher = PasswordHasher()
_DUMMY_HASH = _hasher.hash("dummy-password")  # equalizes timing for unknown users


class User(SyncMixin, Base):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(50))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(16))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    failed_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("uq_users_username_live", "username", unique=True, sqlite_where=text("deleted_at IS NULL")),
    )


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)  # we never store the raw token
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


def aware(dt: datetime) -> datetime:
    """SQLite returns naive datetimes; treat them as UTC."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def login(session: Session, username: str, password: str) -> tuple[str, User]:
    now = utcnow()
    user = session.scalars(
        select(User).where(User.username == username, User.deleted_at.is_(None))
    ).first()

    if user and user.locked_until and aware(user.locked_until) > now:
        raise ForbiddenError("account_locked", "الحساب مقفل مؤقتاً، حاول بعد قليل")

    try:
        _hasher.verify(user.password_hash if user else _DUMMY_HASH, password)
        ok = user is not None and user.is_active
    except VerifyMismatchError:
        ok = False

    if not ok:
        if user:
            user.failed_attempts += 1
            if user.failed_attempts >= MAX_FAILED:
                user.locked_until = now + LOCK_FOR
                user.failed_attempts = 0
            session.commit()
        raise UnauthorizedError("invalid_credentials", "اسم المستخدم أو كلمة المرور غير صحيحة")

    user.failed_attempts = 0
    user.locked_until = None
    token = secrets.token_urlsafe(32)
    session.add(AuthSession(token_hash=_hash_token(token), user_id=user.id, expires_at=now + SESSION_TTL))
    session.commit()
    return token, user


def resolve_token(session: Session, token: str) -> User:
    row = session.get(AuthSession, _hash_token(token))
    if row is None or aware(row.expires_at) < utcnow():
        raise UnauthorizedError("unauthorized", "الجلسة منتهية، سجّل الدخول من جديد")
    user = session.get(User, row.user_id)
    if user is None or user.deleted_at is not None or not user.is_active:
        raise UnauthorizedError("unauthorized", "الحساب غير متاح")
    return user


def logout(session: Session, token: str) -> None:
    row = session.get(AuthSession, _hash_token(token))
    if row:
        session.delete(row)
        session.commit()