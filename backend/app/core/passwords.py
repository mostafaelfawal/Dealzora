"""تجزئة كلمات المرور (Argon2id) وتطبيعها. مشتركة بين users و auth ولا تعرف شيئاً عن قاعدة البيانات."""

import unicodedata

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

# ---- Argon2id (أعلى من الحد الأدنى في OWASP) ----
ARGON2_TIME_COST = 3
ARGON2_MEMORY_KIB = 64 * 1024
ARGON2_PARALLELISM = 2

# ---- الحدود ----
MIN_PASSWORD_LEN = 10
MAX_PASSWORD_LEN = 128

_hasher = PasswordHasher(
    time_cost=ARGON2_TIME_COST,
    memory_cost=ARGON2_MEMORY_KIB,
    parallelism=ARGON2_PARALLELISM,
    hash_len=32,
    salt_len=16,
)


def normalize_password(text: str) -> str:
    """NFKC فقط. لا strip ولا تغيير حالة: المسافات جزء من كلمة المرور."""
    return unicodedata.normalize("NFKC", text)


def hash_password(password: str) -> str:
    return _hasher.hash(normalize_password(password))


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, normalize_password(password))
    except (VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


# تجزئة وهمية بنفس المعاملات: تساوي زمن الرد عندما يكون المستخدم غير موجود.
DUMMY_HASH = hash_password("dummy-password-for-timing")
