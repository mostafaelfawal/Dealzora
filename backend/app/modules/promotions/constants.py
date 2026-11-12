"""ثوابت العروض التلقائية."""

from enum import StrEnum

MAX_NAME_LEN = 80
MAX_PRODUCTS = 300
ENTITY_PROMOTION = "promotion"


class PromoKind(StrEnum):
    PERCENT = "percent"
    AMOUNT = "amount"
    BUY_GET = "buy_get"


class PromoScope(StrEnum):
    ALL = "all"  # كل الأصناف
    CATEGORY = "category"
    PRODUCTS = "products"


class PromoStatus(StrEnum):
    ACTIVE = "active"  # شغال الآن
    SCHEDULED = "scheduled"  # يبدأ لاحقاً
    EXPIRED = "expired"  # انتهت مدته
    PAUSED = "paused"  # أوقفه المدير


class PromoError(StrEnum):
    NOT_FOUND = "promotion_not_found"
    VERSION_CONFLICT = "promotion_version_conflict"
    CATEGORY_NOT_FOUND = "promotion_category_not_found"
    PRODUCT_NOT_FOUND = "promotion_product_not_found"


ERROR_MESSAGES: dict[PromoError, str] = {
    PromoError.NOT_FOUND: "لم نجد هذا العرض",
    PromoError.VERSION_CONFLICT: "العرض تغيّر من جهاز آخر. أعد فتحه وحاول مرة أخرى",
    PromoError.CATEGORY_NOT_FOUND: "القسم غير موجود",
    PromoError.PRODUCT_NOT_FOUND: "صنف في العرض لم يعد موجوداً",
}
