"""ثوابت موديول المنتجات. أي رقم أو نص ثابت يُكتب هنا فقط."""

from enum import StrEnum

# ---- القواعد العامة للمشروع ----
QTY_SCALE = 1000  # الكميات INTEGER بوحدة الأساس × 1000 (1.5 كجم = 1500)

# ---- الحدود ----
MAX_NAME_LEN = 200
MAX_BARCODE_LEN = 32
MAX_UNIT_NAME_LEN = 30
MAX_NOTE_LEN = 300
MAX_EXTRA_UNITS = 5  # TODO: طابقها مع MAX_EXTRA_UNITS في frontend/config/productOptions
MAX_BULK_ITEMS = 200  # أقصى عدد عناصر في طلب جماعي واحد
MAX_MONEY = 1_000_000_000  # بالقروش (10 مليون جنيه)
MAX_QTY = 1_000_000 * QTY_SCALE
MAX_SCALE_CODE = 999_999  # حتى 6 خانات على الميزان
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 500

BARCODE_PATTERN = r"[0-9A-Za-z\-]{3,32}"
EAN_PREFIX = "622"  # مصر

# وحدات موزونة معروفة تتجاوز فحص الكسور في الـ schema. المرجع الكامل علم allow_decimal
# في قائمة الوحدات (catalog.MeasureUnit) ويطبّقه ProductService._register_units.
DECIMAL_UNITS = frozenset({"كيلو", "كجم", "جرام", "لتر", "متر"})
DEFAULT_UNIT = "قطعة"
COPY_SUFFIX = " (نسخة)"

# ---- أسماء الكيانات (للـ Outbox والـ Audit) ----
ENTITY_PRODUCT = "product"
ENTITY_STOCK_MOVEMENT = "stock_movement"

PRODUCT_SNAPSHOT_FIELDS = (
    "name",
    "barcode",
    "category_id",
    "unit",
    "allow_decimal",
    "cost_price",
    "sale_price",
    "min_stock",
    "is_active",
    "scale_code",
)


class ProductError(StrEnum):
    NOT_FOUND = "product_not_found"
    CATEGORY_NOT_FOUND = "category_not_found"
    BARCODE_TAKEN = "barcode_taken"
    VERSION_CONFLICT = "version_conflict"
    INSUFFICIENT_STOCK = "insufficient_stock"
    NO_STOCK_CHANGE = "no_stock_change"
    FRACTION_NOT_ALLOWED = "fraction_not_allowed"
    HAS_STOCK = "product_has_stock"
    SCALE_CODE_TAKEN = "scale_code_taken"


ERROR_MESSAGES: dict[ProductError, str] = {
    ProductError.NOT_FOUND: "لم نجد هذا الصنف",
    ProductError.CATEGORY_NOT_FOUND: "القسم غير موجود",
    ProductError.BARCODE_TAKEN: "هذا الباركود مستخدم لصنف آخر",
    ProductError.VERSION_CONFLICT: "تم تعديل هذا الصنف من مكان آخر. حدّث الصفحة وأعد المحاولة",
    ProductError.INSUFFICIENT_STOCK: "الكمية أكبر من الرصيد المتاح",
    ProductError.NO_STOCK_CHANGE: "لا يوجد تغيير في الرصيد",
    ProductError.FRACTION_NOT_ALLOWED: "هذا الصنف لا يقبل كسوراً",
    ProductError.SCALE_CODE_TAKEN: "كود الميزان مستخدم لصنف آخر",
    ProductError.HAS_STOCK: "لا يمكن حذف صنف رصيده أكبر من صفر. صفّر الرصيد أولاً بالجرد",
}
