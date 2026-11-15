"""ثوابت مستند الإيصال الإلكتروني. المرجع: الـ SDK الرسمي (اطلعنا عليه 2026-11-15).

- Retail Receipt v1.2:  https://sdk.invoicing.eta.gov.eg/documents/retail-receipt-v1-2/
- Return Receipt v1.2:  https://sdk.invoicing.eta.gov.eg/documents/return-receipt-v1-2/
- توليد الـ UUID:        https://sdk.invoicing.eta.gov.eg/receiptissuancefaq/#how-to-generate-receipt-uuid
- التسلسل الموحّد:       https://sdk.invoicing.eta.gov.eg/document-serialization-approach/
- قواعد الحساب:         https://sdk.invoicing.eta.gov.eg/main-calculations/
"""

from decimal import Decimal
from enum import StrEnum

# ---- نوع المستند (documentType) ----
TYPE_VERSION = "1.2"  # أحدث إصدار؛ 1.0 و1.1 متقاعدان (صفحة /types/)
RECEIPT_TYPE_SALE = "SR"  # retail-receipt-v1-2
RECEIPT_TYPE_RETURN = "r"  # return-receipt-v1-2: «the Value must be ‘r’ for Return Receipt»
CURRENCY = "EGP"  # exchangeRate إلزامي فقط لغير EGP (core rule 17)
RETURN_NUMBER_PREFIX = "R-"  # receiptNumber فريد على مستوى الفرع، وترقيم المرتجع مستقل عن البيع
# «Maximum allowed days to issue a return receipt is 540 days of the issuance date of the sales receipt.»
# (receiptissuancefaq، Limitations on receipt submission)
RETURN_MAX_DAYS = 540
# «Amendment with reference value is: 96 hours» (receiptissuancefaq، Validation with Reference Old UUID):
# تصحيح إيصال مرفوض بـ referenceOldUUID. بعدها ترفضه المنظومة إلا بطلب إرسال متأخر.
AMENDMENT_HOURS = 96
PROD_CONFIRM_TEXT = "فعلي"  # تأكيد صريح للتحويل للبيئة الفعلية

# ---- الأرقام ----
DECIMALS = 5  # «decimal number up to 5 decimal precisions» (main-calculations)
Q5 = Decimal("0.00001")
TOLERANCE = Decimal("0.5")  # «All the above calculations are subject to (± 0.5) tolerance.»
MONEY_SCALE = 100  # قروش ← جنيه
QTY_SCALE = 1000
RATE_SCALE = 10_000  # نقاط أساس ← نسبة مئوية × 100

# ---- المشتري (buyer) ----
# «150000 EGP for receipts with version 1.2 and newer» (receiptissuancefaq، National ID Validator)
BUYER_ID_THRESHOLD = Decimal("150000")
BUYER_PERSON = "P"
BUYER_BUSINESS = "B"

# ---- الحدود (من جداول الصفحة) ----
MAX_ITEMS = 300  # FAQ: أقصى 300 سطر في الإيصال
MAX_RECEIPT_NUMBER = 50
MAX_INTERNAL_CODE = 50
MAX_DESCRIPTION = 500
MAX_DISCOUNT_DESCRIPTION = 50
MAX_BUYER_NAME = 100
MAX_BUYER_MOBILE = 30

# ---- الضريبة: نوع T1 (ضريبة القيمة المضافة) وأنواعها الفرعية (eta/codes/TaxSubtypes.json) ----
# قرار المحل (المرحلة 3): خاضع=V009 «General Item sales»، معفى=V003 «Exempted good or service»،
# نسبة صفر=V010 «Other Rates» بنسبة 0. يُفضّل تأكيدها مع محاسب المحل.
VAT_TAX_TYPE = "T1"
VAT_SUBTYPES: dict[str, str] = {"taxable": "V009", "exempt": "V003", "zero": "V010"}

# ---- طرق الدفع ← أكواد المنظومة (eta/codes/PaymentMethods.json) ----
# paymentMethod قيمة واحدة. المختلط عندنا = كاش + آجل، فيُعامل كاش (الجزء المدفوع نقدي).
PAYMENT_CODES: dict[str, str] = {"cash": "C", "mixed": "C", "credit": "O"}
PAYMENT_CODE_CARD = "V"  # طريقة إلكترونية نوعها card
PAYMENT_CODE_OTHER = "O"  # محافظ وتحويلات وأي طريقة غير معروفة

# ---- أوصاف الخصومات في commercialDiscountData (حتى 50 حرفاً) ----
DISCOUNT_PROMO = "عرض"
DISCOUNT_LINE = "خصم على الصنف"
DISCOUNT_INVOICE = "خصم على الفاتورة"
DISCOUNT_LOYALTY = "خصم نقاط الولاء"

ENTITY_E_RECEIPT = "e_receipt"
ANCHOR_FILE_NAME = "eta-chain.anchor.json"


class EReceiptStatus(StrEnum):
    """حالة الإيصال في المنظومة. NULL في الفاتورة = الميزة لم تكن مفعّلة وقت البيع (لا شيء تولّد)."""

    NOT_SENT = "not_sent"  # تولّد وصالح محلياً، لم يُرسل بعد
    PENDING = "pending"  # أُرسل وينتظر النتيجة (المرحلة 4)
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    NOT_REQUIRED = "not_required"  # مثل مرتجع فاتورة بيعت قبل تفعيل المنظومة
    INVALID = "invalid"  # خطأ تحقق محلي: لم يدخل السلسلة (بلا UUID)، ويُعاد توليده بعد التصحيح


class EReceiptError(StrEnum):
    NOT_FOUND = "e_receipt_not_found"
    NOT_INVALID = "e_receipt_not_invalid"
    CHAIN_CONFLICT = "e_receipt_chain_conflict"
    NO_ANCHOR_GAP = "e_receipt_no_anchor_gap"
    DISABLED = "e_receipt_disabled"
    NOT_REJECTED = "e_receipt_not_rejected"
    LATE_AMENDMENT = "e_receipt_late_amendment"
    WRONG_ENVIRONMENT = "e_receipt_wrong_environment"
    ORIGINAL_MISSING = "e_receipt_original_missing"
    ENV_CONFIRM = "e_receipt_env_confirm"
    SENDER_BUSY = "e_receipt_sender_busy"


ERROR_MESSAGES: dict[EReceiptError, str] = {
    EReceiptError.NOT_FOUND: "لم نجد هذه الفاتورة",
    EReceiptError.NOT_INVALID: "إعادة التوليد للإيصالات التي بها خطأ تحقق فقط",
    EReceiptError.CHAIN_CONFLICT: "تزامن في سلسلة إيصالات الجهاز. أعد المحاولة",
    EReceiptError.NO_ANCHOR_GAP: "لا يوجد تعارض في سلسلة هذا الجهاز",
    EReceiptError.DISABLED: "الإيصال الإلكتروني غير مفعّل",
    EReceiptError.NOT_REJECTED: "التصحيح وإعادة الإرسال للإيصالات المرفوضة فقط",
    EReceiptError.LATE_AMENDMENT: "مر أكثر من {hours} ساعة على الإيصال: المنظومة ترفض تصحيحه إلا بطلب إرسال متأخر. أكّد لإرساله على أي حال",
    EReceiptError.WRONG_ENVIRONMENT: "الإيصال من بيئة أخرى (تجريبية/فعلية) ولا يُعاد إرساله على البيئة الحالية",
    EReceiptError.ORIGINAL_MISSING: "فاتورة البيع الأصلية ليس لها إيصال صحيح. صحّحها أولاً",
    EReceiptError.ENV_CONFIRM: "للتحويل للبيئة الفعلية اكتب كلمة «{text}» للتأكيد",
    EReceiptError.SENDER_BUSY: "دورة إرسال تعمل الآن. أعد المحاولة بعد دقيقة",
}
