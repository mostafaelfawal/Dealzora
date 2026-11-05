"""ثوابت موديول المصادقة. أي رقم أو نص ثابت يُكتب هنا فقط."""

from datetime import timedelta
from enum import StrEnum

# ---- الجلسات ----
SESSION_TTL = timedelta(hours=12)  # حد أقصى مطلق
SESSION_IDLE_TTL = timedelta(hours=4)  # خمول بلا طلبات
SESSION_TOUCH_INTERVAL = timedelta(
    minutes=1
)  # لا نكتب last_seen أكثر من مرة في الدقيقة
MAX_SESSIONS_PER_USER = 5

# ---- القفل ضد التخمين ----
MAX_FAILED_ATTEMPTS = 5
LOCK_DURATION = timedelta(minutes=5)


class AuthError(StrEnum):
    UNAUTHORIZED = "unauthorized"
    INVALID_CREDENTIALS = "invalid_credentials"
    ACCOUNT_LOCKED = "account_locked"
    WRONG_PASSWORD = "wrong_password"
    SAME_PASSWORD = "same_password"
    PASSWORD_HAS_USERNAME = "password_has_username"


ERROR_MESSAGES: dict[AuthError, str] = {
    AuthError.UNAUTHORIZED: "الجلسة منتهية، سجّل الدخول من جديد",
    AuthError.INVALID_CREDENTIALS: "اسم المستخدم أو كلمة المرور غير صحيحة",
    AuthError.ACCOUNT_LOCKED: "الحساب مقفل مؤقتاً، حاول بعد قليل",
    AuthError.WRONG_PASSWORD: "كلمة المرور الحالية غير صحيحة",
    AuthError.SAME_PASSWORD: "كلمة المرور الجديدة يجب أن تختلف عن الحالية",
    AuthError.PASSWORD_HAS_USERNAME: "كلمة المرور لا يجب أن تحتوي اسم المستخدم",
}
