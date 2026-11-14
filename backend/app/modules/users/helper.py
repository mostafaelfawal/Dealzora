"""دوال مساعدة نقية للمستخدمين: التطبيع، اللقطات، تعيين كلمة المرور. بدون HTTP وبدون استعلامات."""

import unicodedata
from datetime import datetime
from typing import Any

from app.core.config import get_settings
from app.core.passwords import hash_password
from app.core.security import Actor, Role

from .constants import USER_SNAPSHOT_FIELDS
from .model import User


def normalize_username(text: str) -> str:
    return unicodedata.normalize("NFKC", text).strip().casefold()


def password_contains_username(password: str, username: str) -> bool:
    # تطابق تام فقط: «ahmed2024» مقبولة لمستخدم ahmed لأنها أسهل على التاجر.
    return bool(username) and normalize_username(password) == username


def parse_role(value: str) -> Role | None:
    try:
        return Role(value)
    except ValueError:
        return None


def actor_for(user: User) -> Actor:
    return Actor(user.id, Role(user.role), get_settings().device_id)


def set_password(user: User, password: str, now: datetime) -> None:
    user.password_hash = hash_password(password)
    user.password_changed_at = now
    user.failed_attempts = 0
    user.mark_modified()


def user_snapshot(user: User) -> dict[str, Any]:
    return {f: getattr(user, f) for f in USER_SNAPSHOT_FIELDS}


def diff_snapshots(
    before: dict[str, Any], after: dict[str, Any]
) -> dict[str, dict[str, Any]]:
    return {
        key: {"from": before.get(key), "to": after.get(key)}
        for key in after
        if before.get(key) != after.get(key)
    }
