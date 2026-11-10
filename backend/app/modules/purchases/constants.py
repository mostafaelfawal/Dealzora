"""ثوابت موديول المشتريات. أي رقم أو نص ثابت يُكتب هنا فقط."""

from enum import StrEnum

MAX_LINES = 300
MAX_NOTE_LEN = 200
MAX_REF_LEN = 40  # رقم فاتورة المورد
MAX_QUERY_LEN = 100
DEFAULT_PAGE_SIZE = 24
MAX_PAGE_SIZE = 200

ENTITY_PURCHASE = "purchase"
ENTITY_PURCHASE_RETURN = "purchase_return"
REF_PURCHASE = "purchase"
REF_PURCHASE_RETURN = "purchase_return"


class PurchaseError(StrEnum):
    NOT_FOUND = "purchase_not_found"
    PRODUCT_NOT_FOUND = "purchase_product_not_found"
    UNIT_NOT_FOUND = "purchase_unit_not_found"
    FRACTION_NOT_ALLOWED = "purchase_fraction_not_allowed"
    DISCOUNT_TOO_HIGH = "purchase_discount_too_high"
    PAID_EXCEEDS_TOTAL = "purchase_paid_exceeds_total"
    FUTURE_DATE = "purchase_future_date"
    RETURN_LINE_NOT_FOUND = "purchase_return_line_not_found"
    RETURN_QTY_EXCEEDS = "purchase_return_qty_exceeds"
    INSUFFICIENT_STOCK = "purchase_insufficient_stock"


ERROR_MESSAGES: dict[PurchaseError, str] = {
    PurchaseError.NOT_FOUND: "لم نجد فاتورة الشراء",
    PurchaseError.PRODUCT_NOT_FOUND: "صنف في الفاتورة لم يعد موجوداً",
    PurchaseError.UNIT_NOT_FOUND: "وحدة الشراء لم تعد موجودة",
    PurchaseError.FRACTION_NOT_ALLOWED: "صنف في الفاتورة لا يقبل كسوراً",
    PurchaseError.DISCOUNT_TOO_HIGH: "الخصم أكبر من قيمة الفاتورة",
    PurchaseError.PAID_EXCEEDS_TOTAL: "المدفوع أكبر من إجمالي الفاتورة",
    PurchaseError.FUTURE_DATE: "تاريخ الفاتورة في المستقبل",
    PurchaseError.RETURN_LINE_NOT_FOUND: "الصنف ليس في هذه الفاتورة",
    PurchaseError.RETURN_QTY_EXCEEDS: "الكمية أكبر من المتاح للإرجاع",
    PurchaseError.INSUFFICIENT_STOCK: "الرصيد الحالي أقل من الكمية المرتجعة",
}
