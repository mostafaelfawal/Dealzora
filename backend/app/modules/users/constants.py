"""ثوابت موديول المستخدمين. أي رقم أو نص ثابت يُكتب هنا فقط."""

from enum import StrEnum

from app.core.security import Role

# ---- الحدود ----
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

# ---- أسماء الكيانات (للـ Audit، مشتركة مع auth) ----
ENTITY_USER = "user"
USER_SNAPSHOT_FIELDS = ("username", "role", "is_active")  # لا password_hash أبداً


class UserError(StrEnum):
    UNAUTHORIZED = "unauthorized"
    FORBIDDEN = "forbidden"
    ALREADY_SETUP = "already_setup"
    USER_NOT_FOUND = "user_not_found"
    USERNAME_TAKEN = "username_taken"
    PASSWORD_HAS_USERNAME = "password_has_username"
    LAST_MANAGER = "last_manager"
    SELF_ACTION = "self_action_forbidden"


ERROR_MESSAGES: dict[UserError, str] = {
    UserError.UNAUTHORIZED: "الجلسة منتهية، سجّل الدخول من جديد",
    UserError.FORBIDDEN: "هذه العملية للمدير فقط",
    UserError.ALREADY_SETUP: "تم إعداد النظام بالفعل",
    UserError.USER_NOT_FOUND: "لم نجد هذا المستخدم",
    UserError.USERNAME_TAKEN: "اسم المستخدم مستخدم بالفعل",
    UserError.PASSWORD_HAS_USERNAME: "كلمة المرور لا يجب أن تحتوي اسم المستخدم",
    UserError.LAST_MANAGER: "لا يمكن تعطيل أو حذف أو تخفيض آخر مدير في النظام",
    UserError.SELF_ACTION: "لا يمكنك تنفيذ هذه العملية على حسابك. اطلبها من مدير آخر",
}