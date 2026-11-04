"""الوصول لجدول الجلسات فقط. لا قواعد عمل ولا commit هنا (الـ service يملك المعاملة)."""

from datetime import datetime

from sqlalchemy import and_, delete, or_, select
from sqlalchemy.orm import Session

from .constants import SESSION_IDLE_TTL
from .model import AuthSession


class AuthRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

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