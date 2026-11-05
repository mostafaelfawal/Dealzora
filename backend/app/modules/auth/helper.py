"""دوال مساعدة نقية للجلسات: التوكنات والتوقيت. بدون قاعدة بيانات ولا HTTP."""

import hashlib
import secrets
from datetime import datetime, timezone


def generate_token() -> str:
    return secrets.token_urlsafe(32)  # 256 بت


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()  # لا نخزن التوكن الخام


def aware(dt: datetime) -> datetime:
    """SQLite يرجّع datetime بلا منطقة زمنية؛ نعتبرها UTC."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
