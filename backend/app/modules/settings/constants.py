"""ثوابت الإعدادات العامة."""

from enum import StrEnum

ENTITY_SETTING = "app_setting"

MAX_CURRENCY_CODE = 8
MAX_CURRENCY_SYMBOL = 8
MAX_CURRENCY_NAME = 40
MAX_PATH_LEN = 400

# الافتراضي: الجنيه المصري (سلوك النظام قبل إضافة الإعداد).
DEFAULT_CURRENCY = {"code": "EGP", "symbol": "ج.م", "name": "جنيه مصري"}

# حد خصم الكاشير (المدير بلا حد). الافتراضي: مفعّل بنسبة 20% (سلوك النظام قبل الإعداد).
DEFAULT_CASHIER_DISCOUNT_ENABLED = True
DEFAULT_CASHIER_DISCOUNT_PERCENT = 20


class SettingKey(StrEnum):
    CURRENCY_CODE = "currency.code"
    CURRENCY_SYMBOL = "currency.symbol"
    CURRENCY_NAME = "currency.name"
    BACKUP_DIR = "backup.dir"  # فارغ = المجلد الافتراضي بجانب القاعدة
    # طرق الدفع الإلكتروني للمحل + دولة القوالب (JSON، انظر payments.py).
    PAY_METHODS = "payments.methods"
    # حد خصم الكاشير: "1"/"0" والنسبة المئوية (0..100).
    DISCOUNT_LIMIT_ENABLED = "discount.cashier_limit_enabled"
    DISCOUNT_LIMIT_PERCENT = "discount.cashier_max_percent"
    # مفاتيح قديمة (قبل القوالب): تُقرأ مرة واحدة لترحيلها إلى PAY_METHODS.
    PAY_VODAFONE_CASH = "payments.vodafone_cash"
    PAY_INSTAPAY = "payments.instapay"


class SettingsError(StrEnum):
    BACKUP_DIR_INVALID = "backup_dir_invalid"
    BACKUP_DIR_NOT_WRITABLE = "backup_dir_not_writable"


ERROR_MESSAGES: dict[SettingsError, str] = {
    SettingsError.BACKUP_DIR_INVALID: "المسار غير صالح. اختر مجلداً كاملاً مثل D:\\Dealzora-Backups",
    SettingsError.BACKUP_DIR_NOT_WRITABLE: "لا يمكن الكتابة في هذا المجلد. اختر مجلداً آخر أو تأكد من توصيل الفلاشة/القرص",
}
