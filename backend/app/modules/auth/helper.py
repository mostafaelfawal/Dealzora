"""دوال مساعدة نقية: تجزئة كلمات المرور، التوكنات، التطبيع. بدون قاعدة بيانات ولا HTTP."""

import hashlib
import secrets
import unicodedata
from datetime import datetime, timezone
from typing import Any

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.security import Role

from .constants import (
    ARGON2_MEMORY_KIB,
    ARGON2_PARALLELISM,
    ARGON2_TIME_COST,
    USER_SNAPSHOT_FIELDS,
)

_hasher = PasswordHasher(
    time_cost=ARGON2_TIME_COST,
    memory_cost=ARGON2_MEMORY_KIB,
    parallelism=ARGON2_PARALLELISM,
    hash_len=32,
    salt_len=16,
)


# ---------- التطبيع ----------
def normalize_username(text: str) -> str:
    return unicodedata.normalize("NFKC", text).strip().casefold()


def normalize_password(text: str) -> str:
    """NFKC فقط. لا strip ولا تغيير حالة: المسافات جزء من كلمة المرور."""
    return unicodedata.normalize("NFKC", text)


# ---------- كلمات المرور ----------
def hash_password(password: str) -> str:
    return _hasher.hash(normalize_password(password))


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, normalize_password(password))
    except (VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def password_contains_username(password: str, username: str) -> bool:
    return bool(username) and username in normalize_username(password)


# تجزئة وهمية بنفس المعاملات: تساوي زمن الرد عندما يكون المستخدم غير موجود.
DUMMY_HASH = hash_password("dummy-password-for-timing")


# ---------- التوكنات ----------
def generate_token() -> str:
    return secrets.token_urlsafe(32)  # 256 بت


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()  # لا نخزن التوكن الخام


# ---------- متنوعة ----------
def aware(dt: datetime) -> datetime:
    """SQLite يرجّع datetime بلا منطقة زمنية؛ نعتبرها UTC."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def parse_role(value: str) -> Role | None:
    try:
        return Role(value)
    except ValueError:
        return None


def user_snapshot(user: Any) -> dict[str, Any]:
    return {f: getattr(user, f) for f in USER_SNAPSHOT_FIELDS}


def diff_snapshots(before: dict[str, Any], after: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        key: {"from": before.get(key), "to": after.get(key)}
        for key in after
        if before.get(key) != after.get(key)
    }