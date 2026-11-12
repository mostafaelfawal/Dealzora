"""ثوابت طلبات الشراء واقتراح النواقص."""

from enum import StrEnum

MAX_LINES = 300
MAX_NOTE_LEN = 200
DEFAULT_PAGE_SIZE = 24
MAX_PAGE_SIZE = 200

ENTITY_PURCHASE_ORDER = "purchase_order"

# ---------- اقتراح النواقص (القيم الافتراضية، والواجهة تغيّرها) ----------
DEFAULT_SALES_DAYS = 30  # فترة حساب معدل البيع
DEFAULT_COVER_DAYS = 14  # الطلب يكفي كم يوم بعد وصوله
DEFAULT_LEAD_DAYS = 3  # كم يوم يأخذ المورد ليورّد
MIN_HISTORY_DAYS = 7  # صنف جديد: لا نقسم مبيعاته على أقل من أسبوع (يبالغ في المعدل)
NO_SALES_TARGET_FACTOR = 2  # صنف له حد أدنى ولا يُباع مؤخراً: نطلب حتى ضعف الحد


class OrderStatus(StrEnum):
    DRAFT = "draft"  # مسودة: تُعدّل بحرية
    SENT = "sent"  # أُرسل للمورد (واتساب/طباعة) وننتظر البضاعة
    RECEIVED = "received"  # تحوّل لفاتورة شراء
    CANCELLED = "cancelled"


OPEN_STATUSES = (OrderStatus.DRAFT, OrderStatus.SENT)


class OrderStatusFilter(StrEnum):
    OPEN = "open"
    ALL = "all"
    DRAFT = "draft"
    SENT = "sent"
    RECEIVED = "received"
    CANCELLED = "cancelled"


class Urgency(StrEnum):
    OUT = "out"  # نفد
    CRITICAL = "critical"  # سينفد قبل أن يصل طلب جديد
    LOW = "low"  # تحت الحد الأدنى
    SOON = "soon"  # فوق الحد لكن سينفد خلال مدة التوريد + التغطية


URGENCY_RANK = {Urgency.OUT: 0, Urgency.CRITICAL: 1, Urgency.LOW: 2, Urgency.SOON: 3}


class OrderError(StrEnum):
    NOT_FOUND = "purchase_order_not_found"
    VERSION_CONFLICT = "purchase_order_version_conflict"
    NOT_EDITABLE = "purchase_order_not_editable"
    PRODUCT_NOT_FOUND = "purchase_order_product_not_found"
    DUPLICATE_PRODUCT = "purchase_order_duplicate_product"
    FRACTION_NOT_ALLOWED = "purchase_order_fraction_not_allowed"
    SUPPLIER_INACTIVE = "purchase_order_supplier_inactive"


ERROR_MESSAGES: dict[OrderError, str] = {
    OrderError.NOT_FOUND: "لم نجد طلب الشراء",
    OrderError.VERSION_CONFLICT: "الطلب تغيّر من جهاز آخر. أعد فتحه وحاول مرة أخرى",
    OrderError.NOT_EDITABLE: "الطلب استُلم أو أُلغي، لا يمكن تعديله",
    OrderError.PRODUCT_NOT_FOUND: "صنف في الطلب لم يعد موجوداً",
    OrderError.DUPLICATE_PRODUCT: "الصنف مكرر في الطلب",
    OrderError.FRACTION_NOT_ALLOWED: "صنف في الطلب لا يقبل كسوراً",
    OrderError.SUPPLIER_INACTIVE: "المورد غير موجود أو معطّل",
}
