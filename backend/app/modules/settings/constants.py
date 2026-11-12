"""ثوابت الإعدادات العامة."""

from enum import StrEnum

ENTITY_SETTING = "app_setting"

MAX_CURRENCY_CODE = 8
MAX_CURRENCY_SYMBOL = 8
MAX_CURRENCY_NAME = 40
MAX_PATH_LEN = 400
MAX_WALLET_ACCOUNT = 60

# الافتراضي: الجنيه المصري (سلوك النظام قبل إضافة الإعداد).
DEFAULT_CURRENCY = {"code": "EGP", "symbol": "ج.م", "name": "جنيه مصري"}


class SettingKey(StrEnum):
    CURRENCY_CODE = "currency.code"
    CURRENCY_SYMBOL = "currency.symbol"
    CURRENCY_NAME = "currency.name"
    BACKUP_DIR = "backup.dir"  # فارغ = المجلد الافتراضي بجانب القاعدة
    # حسابات الدفع الإلكتروني للمحل. فارغ = الطريقة غير مفعّلة في الكاشير.
    PAY_VODAFONE_CASH = "payments.vodafone_cash"
    PAY_INSTAPAY = "payments.instapay"


class SettingsError(StrEnum):
    BACKUP_DIR_INVALID = "backup_dir_invalid"
    BACKUP_DIR_NOT_WRITABLE = "backup_dir_not_writable"


ERROR_MESSAGES: dict[SettingsError, str] = {
    SettingsError.BACKUP_DIR_INVALID: "المسار غير صالح. اختر مجلداً كاملاً مثل D:\\Dealzora-Backups",
    SettingsError.BACKUP_DIR_NOT_WRITABLE: "لا يمكن الكتابة في هذا المجلد. اختر مجلداً آخر أو تأكد من توصيل الفلاشة/القرص",
}
