"""الوصول لقاعدة البيانات فقط. لا قواعد عمل ولا commit هنا (الـ service يملك المعاملة)."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import Role

from .model import User


class UserRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

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

    def flush(self) -> None:
        self.session.flush()