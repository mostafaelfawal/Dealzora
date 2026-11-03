"""الوصول لقاعدة البيانات فقط. لا قواعد عمل ولا commit هنا (الـ service يملك المعاملة)."""

from datetime import datetime

from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.orm import Session

from app.core.security import Role

from .constants import SESSION_IDLE_TTL
from .model import AuthSession, User


class AuthRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    # ---------- المستخدمون ----------
    def get_user(self, user_id: str) -> User | None:
        stmt = select(User).where(User.id == user_id, User.deleted_at.is_(None))
        return self.session.scalars(stmt).first()

    def get_by_username(self, username: str) -> User | None:
        stmt = select(User).where(User.username == username, User.deleted_at.is_(None))
        return self.session.scalars(stmt).first()

    def username_taken(self, username: str, *, exclude_id: str | None = None) -> bool:
        stmt = select(User.id).where(User.username == username, User.deleted_at.is_(None))
        if exclude_id:
            stmt = stmt.where(User.id != exclude_id)
        return self.session.scalar(stmt.limit(1)) is not None

    def count_users(self) -> int:
        stmt = select(func.count()).select_from(User).where(User.deleted_at.is_(None))
        return self.session.scalar(stmt) or 0

    def count_active_managers(self, *, exclude_id: str | None = None) -> int:
        stmt = (
            select(func.count())
            .select_from(User)
            .where(
                User.deleted_at.is_(None),
                User.is_active.is_(True),
                User.role == Role.MANAGER.value,
            )
        )
        if exclude_id:
            stmt = stmt.where(User.id != exclude_id)
        return self.session.scalar(stmt) or 0

    def list_users(self) -> list[User]:
        stmt = select(User).where(User.deleted_at.is_(None)).order_by(User.created_at, User.username)
        return list(self.session.scalars(stmt).all())

    def add_user(self, user: User) -> None:
        self.session.add(user)

    # ---------- الجلسات ----------
    def get_session(self, token_hash: str) -> AuthSession | None:
        return self.session.get(AuthSession, token_hash)

    def add_session(self, row: AuthSession) -> None:
        self.session.add(row)

    def delete_session(self, row: AuthSession) -> None:
        self.session.delete(row)

    def delete_user_sessions(self, user_id: str, *, except_hash: str | None = None) -> None:
        stmt = delete(AuthSession).where(AuthSession.user_id == user_id)
        if except_hash:
            stmt = stmt.where(AuthSession.token_hash != except_hash)
        self.session.execute(stmt)

    def trim_user_sessions(self, user_id: str, keep: int) -> None:
        """يبقي أحدث `keep` جلسات للمستخدم ويحذف الأقدم."""
        stale = (
            select(AuthSession.token_hash)
            .where(AuthSession.user_id == user_id)
            .order_by(AuthSession.created_at.desc())
            .offset(keep)
        )
        self.session.execute(delete(AuthSession).where(AuthSession.token_hash.in_(stale)))

    def delete_stale_sessions(self, now: datetime) -> None:
        idle_cutoff = now - SESSION_IDLE_TTL
        self.session.execute(
            delete(AuthSession).where(
                or_(
                    AuthSession.expires_at <= now,
                    and_(AuthSession.last_seen_at.is_not(None), AuthSession.last_seen_at < idle_cutoff),
                )
            )
        )

    def flush(self) -> None:
        self.session.flush()