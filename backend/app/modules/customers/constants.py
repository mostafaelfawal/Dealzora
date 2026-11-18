"""ثوابت موديول العملاء. أي رقم أو نص ثابت يُكتب هنا فقط."""

from enum import StrEnum

# ---- الحدود ----
MAX_NAME_LEN = 100
MAX_ADDRESS_LEN = 200
MAX_NOTES_LEN = 300
MAX_NOTE_LEN = 300  # ملاحظة حركة الحساب
MAX_BULK_ITEMS = 200  # أقصى عدد عناصر في طلب جماعي واحد
MAX_PAYMENT_NOTE_LEN = 80
MAX_PHONE_LEN = 16
MAX_MONEY = 1_000_000_000  # بالقروش (10 مليون جنيه)
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 500

PHONE_PATTERN = r"\+?[0-9]{8,15}"

# ---- قواعد الائتمان  ----
OVERDUE_DAYS = 30  # عليه دين وبدون أي دفعة لأكثر من هذه المدة = متأخر
NEAR_LIMIT_PERCENT = 80  # استهلاك الحد الائتماني الذي يظهر عنده "قارب الحد"

OPENING_NOTE = "رصيد افتتاحي"
DEFAULT_PAYMENT_NOTE = "دفعة"
DEFAULT_PAYOUT_NOTE = "صرف رصيد نقداً"

# ---- أسماء الكيانات (للـ Outbox والـ Audit) ----
ENTITY_CUSTOMER = "customer"
ENTITY_LEDGER_ENTRY = "customer_ledger"

CUSTOMER_SNAPSHOT_FIELDS = (
    "name",
    "phone",
    "address",
    "notes",
    "credit_limit",
    "is_active",
    "is_wholesale",
)


class CustomerError(StrEnum):
    NOT_FOUND = "customer_not_found"
    PHONE_TAKEN = "customer_phone_taken"
    VERSION_CONFLICT = "version_conflict"
    HAS_BALANCE = "customer_has_balance"
    NO_DEBT = "customer_no_debt"
    AMOUNT_EXCEEDS_DEBT = "payment_exceeds_debt"
    HAS_CREDIT = "customer_has_credit"
    NO_CREDIT = "customer_no_credit"
    AMOUNT_EXCEEDS_CREDIT = "payout_exceeds_credit"
    HAS_ACTIVE_PLAN = "customer_has_active_installment_plan"


ERROR_MESSAGES: dict[CustomerError, str] = {
    CustomerError.NOT_FOUND: "لم نجد هذا العميل",
    CustomerError.PHONE_TAKEN: "رقم الهاتف مسجّل لعميل آخر",
    CustomerError.VERSION_CONFLICT: "تم تعديل هذا العميل من مكان آخر. حدّث الصفحة وأعد المحاولة",
    CustomerError.HAS_BALANCE: "لا يمكن حذف عميل عليه مديونية. حصّل المبلغ أولاً",
    CustomerError.NO_DEBT: "هذا العميل ليس عليه مديونية",
    CustomerError.AMOUNT_EXCEEDS_DEBT: "المبلغ أكبر من مديونية العميل",
    CustomerError.HAS_CREDIT: "لا يمكن حذف عميل له رصيد لدى المحل. اصرف له رصيده أولاً",
    CustomerError.NO_CREDIT: "هذا العميل ليس له رصيد لدى المحل",
    CustomerError.AMOUNT_EXCEEDS_CREDIT: "المبلغ أكبر من رصيد العميل لدى المحل",
    CustomerError.HAS_ACTIVE_PLAN: "لا يمكن حذف عميل له خطة تقسيط جارية. ألغِ الخطة أولاً",
}
