"""ثوابت موديول المصادقة. أي رقم أو نص ثابت يُكتب هنا فقط."""

from datetime import timedelta
from enum import StrEnum

from app.core.security import Role

# ---- الجلسات ----
SESSION_TTL = timedelta(hours=12)  # حد أقصى مطلق
SESSION_IDLE_TTL = timedelta(hours=4)  # خمول بلا طلبات
SESSION_TOUCH_INTERVAL = timedelta(minutes=1)  # لا نكتب last_seen أكثر من مرة في الدقيقة
MAX_SESSIONS_PER_USER = 5

# ---- القفل ضد التخمين ----
MAX_FAILED_ATTEMPTS = 5
LOCK_DURATION = timedelta(minutes=5)

# ---- Argon2id (أعلى من الحد الأدنى في OWASP) ----
ARGON2_TIME_COST = 3
ARGON2_MEMORY_KIB = 64 * 1024
ARGON2_PARALLELISM = 2

# ---- الحدود ----
MIN_PASSWORD_LEN = 10
MAX_PASSWORD_LEN = 128
MAX_USERNAME_LEN = 50
# ASCII فقط بعد التوحيد: يمنع انتحال الأسماء بحروف متشابهة (Cyrillic/Arabic lookalikes).
USERNAME_PATTERN = r"[a-z0-9._\-]{3,50}"

# الأدوار التي يمكن إسنادها من الـ API. OWNER مستقبلاً لن يُضاف هنا.
ASSIGNABLE_ROLES = frozenset({Role.MANAGER, Role.CASHIER})

COMMON_PASSWORDS = frozenset(
    {
        "password", "password1", "password123", "passw0rd123", "1234567890",
        "12345678910", "0123456789", "123456789a", "qwertyuiop", "qwerty12345",
        "admin12345", "administrator", "welcome123", "letmein123", "iloveyou123",
        "abcdefghij", "1q2w3e4r5t", "11111111111", "0000000000", "dealzora123",
    }
)  # fmt: skip

# ---- أسماء الكيانات (للـ Audit) ----
ENTITY_USER = "user"
USER_SNAPSHOT_FIELDS = ("username", "role", "is_active")  # لا password_hash أبداً


class AuthError(StrEnum):
    UNAUTHORIZED = "unauthorized"
    INVALID_CREDENTIALS = "invalid_credentials"
    ACCOUNT_LOCKED = "account_locked"
    FORBIDDEN = "forbidden"
    ALREADY_SETUP = "already_setup"
    USER_NOT_FOUND = "user_not_found"
    USERNAME_TAKEN = "username_taken"
    WRONG_PASSWORD = "wrong_password"
    SAME_PASSWORD = "same_password"
    PASSWORD_HAS_USERNAME = "password_has_username"
    LAST_MANAGER = "last_manager"
    SELF_ACTION = "self_action_forbidden"


ERROR_MESSAGES: dict[AuthError, str] = {
    AuthError.UNAUTHORIZED: "الجلسة منتهية، سجّل الدخول من جديد",
    AuthError.INVALID_CREDENTIALS: "اسم المستخدم أو كلمة المرور غير صحيحة",
    AuthError.ACCOUNT_LOCKED: "الحساب مقفل مؤقتاً، حاول بعد قليل",
    AuthError.FORBIDDEN: "هذه العملية للمدير فقط",
    AuthError.ALREADY_SETUP: "تم إعداد النظام بالفعل",
    AuthError.USER_NOT_FOUND: "لم نجد هذا المستخدم",
    AuthError.USERNAME_TAKEN: "اسم المستخدم مستخدم بالفعل",
    AuthError.WRONG_PASSWORD: "كلمة المرور الحالية غير صحيحة",
    AuthError.SAME_PASSWORD: "كلمة المرور الجديدة يجب أن تختلف عن الحالية",
    AuthError.PASSWORD_HAS_USERNAME: "كلمة المرور لا يجب أن تحتوي اسم المستخدم",
    AuthError.LAST_MANAGER: "لا يمكن تعطيل أو حذف أو تخفيض آخر مدير في النظام",
    AuthError.SELF_ACTION: "لا يمكنك تنفيذ هذه العملية على حسابك. اطلبها من مدير آخر",
}