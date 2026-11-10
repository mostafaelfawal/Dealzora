"""ثوابت موديول المبيعات. أي رقم أو نص ثابت يُكتب هنا فقط."""

from enum import StrEnum

# ---- الحدود ----
MAX_LINES = 300  # أقصى عدد أصناف في فاتورة واحدة
MAX_NOTE_LEN = 200
MAX_QUERY_LEN = 100
DEFAULT_PAGE_SIZE = 24
MAX_PAGE_SIZE = 200

# ---- قواعد العمل ----
# أقصى خصم يمنحه الكاشير (على الصنف أو الفاتورة) كنسبة من القيمة. المدير بلا حد.
CASHIER_MAX_DISCOUNT_PERCENT = 20
# البيع بأكثر من الرصيد مرفوض: الرصيد المخزّن هو المرجع، والتصحيح بالجرد.
ALLOW_NEGATIVE_STOCK = False

# ---- أسماء الكيانات (للـ Outbox والـ Audit والخزنة) ----
ENTITY_SALE = "sale"
ENTITY_SALE_RETURN = "sale_return"
REF_SALE = "sale"
REF_SALE_RETURN = "sale_return"


class SaleError(StrEnum):
    NOT_FOUND = "sale_not_found"
    EMPTY = "sale_empty"
    DUPLICATE = "sale_duplicate"
    PRODUCT_NOT_FOUND = "sale_product_not_found"
    PRODUCT_INACTIVE = "sale_product_inactive"
    UNIT_NOT_FOUND = "sale_unit_not_found"
    PRICE_CHANGED = "sale_price_changed"
    INSUFFICIENT_STOCK = "sale_insufficient_stock"
    FRACTION_NOT_ALLOWED = "sale_fraction_not_allowed"
    LINE_DISCOUNT_TOO_HIGH = "sale_line_discount_too_high"
    DISCOUNT_TOO_HIGH = "sale_discount_too_high"
    CASHIER_DISCOUNT_LIMIT = "sale_cashier_discount_limit"
    CUSTOMER_REQUIRED = "sale_customer_required"
    CUSTOMER_INACTIVE = "sale_customer_inactive"
    CREDIT_LIMIT = "sale_credit_limit"
    PAYMENT_MISMATCH = "sale_payment_mismatch"
    CASH_SHORT = "sale_cash_short"
    RETURN_NOT_FOUND = "sale_return_not_found"
    RETURN_EMPTY = "sale_return_empty"
    RETURN_LINE_NOT_FOUND = "sale_return_line_not_found"
    RETURN_QTY_EXCEEDS = "sale_return_qty_exceeds"
    RETURN_EXPIRED = "sale_return_expired"


ERROR_MESSAGES: dict[SaleError, str] = {
    SaleError.NOT_FOUND: "لم نجد هذه الفاتورة",
    SaleError.EMPTY: "الفاتورة فارغة",
    SaleError.DUPLICATE: "تم حفظ هذه الفاتورة من قبل",
    SaleError.PRODUCT_NOT_FOUND: "صنف في الفاتورة لم يعد موجوداً. حدّث الكاشير",
    SaleError.PRODUCT_INACTIVE: "صنف في الفاتورة موقوف عن البيع",
    SaleError.UNIT_NOT_FOUND: "وحدة البيع لم تعد موجودة. حدّث الكاشير",
    SaleError.PRICE_CHANGED: "تغيّر سعر صنف في الفاتورة. حدّث الكاشير وأعد المحاولة",
    SaleError.INSUFFICIENT_STOCK: "الرصيد غير كافٍ لأحد الأصناف",
    SaleError.FRACTION_NOT_ALLOWED: "صنف في الفاتورة لا يقبل كسوراً",
    SaleError.LINE_DISCOUNT_TOO_HIGH: "خصم الصنف أكبر من قيمته",
    SaleError.DISCOUNT_TOO_HIGH: "الخصم أكبر من قيمة الفاتورة",
    SaleError.CASHIER_DISCOUNT_LIMIT: "الخصم أكبر من المسموح للكاشير. اطلب موافقة المدير",
    SaleError.CUSTOMER_REQUIRED: "اختر عميلاً للبيع الآجل",
    SaleError.CUSTOMER_INACTIVE: "هذا العميل موقوف",
    SaleError.CREDIT_LIMIT: "المبلغ الآجل أكبر من الحد المتاح للعميل",
    SaleError.PAYMENT_MISMATCH: "المدفوع لا يطابق إجمالي الفاتورة",
    SaleError.CASH_SHORT: "المبلغ المستلم أقل من المطلوب",
    SaleError.RETURN_NOT_FOUND: "لم نجد هذا المرتجع",
    SaleError.RETURN_EMPTY: "اختر صنفاً واحداً على الأقل للإرجاع",
    SaleError.RETURN_LINE_NOT_FOUND: "الصنف ليس في هذه الفاتورة",
    SaleError.RETURN_QTY_EXCEEDS: "الكمية أكبر من المتاح للإرجاع",
    SaleError.RETURN_EXPIRED: "الفاتورة خارج مهلة الإرجاع. المرتجع يحتاج المدير",
}
