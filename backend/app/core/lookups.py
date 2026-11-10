"""استعلامات قراءة مشتركة بين الموديولات (أسماء المستخدمين للعرض)."""

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session


def user_names(session: Session, user_ids: Iterable[str | None]) -> dict[str, str]:
    """id → username. استيراد متأخر لتفادي الاستيراد الدائري مع users."""
    from app.modules.users.model import User

    ids = {uid for uid in user_ids if uid}
    if not ids:
        return {}
    rows = session.execute(select(User.id, User.username).where(User.id.in_(ids))).all()
    return {uid: username for uid, username in rows}
