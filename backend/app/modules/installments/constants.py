"""ثوابت موديول التقسيط. أي رقم أو نص ثابت يُكتب هنا فقط."""

from enum import StrEnum

# ---- الحدود ----
MAX_TITLE_LEN = 80
MAX_NOTE_LEN = 200
MAX_PAYMENT_NOTE_LEN = 80
MAX_MONEY = 1_000_000_000  # بالقروش (10 مليون جنيه)
MIN_INSTALLMENTS = 1
MAX_INSTALLMENTS = 120  # عشر سنوات شهرياً
DUE_SOON_DAYS = 7  # «مستحق خلال أسبوع»

# ---- أسماء الكيانات (للـ Outbox والـ Audit) ----
ENTITY_PLAN = "installment_plan"
REF_TYPE_PLAN = "installment_plan"  # ref_type على حركات كشف حساب العميل (الأقساط والدين)
REF_TYPE_DOWN = "installment_down"  # المقدّم (لا يُحسب من دفعات الأقساط)

DOWN_PAYMENT_NOTE = "مقدّم تقسيط"

PLAN_SNAPSHOT_FIELDS = (
    "customer_id",
    "title",
    "principal",
    "down_payment",
    "total",
    "installments_count",
    "frequency",
    "start_date",
    "paid_amount",
    "status",
    "note",
)


class InstallmentError(StrEnum):
    NOT_FOUND = "installment_plan_not_found"
    VERSION_CONFLICT = "version_conflict"
    CUSTOMER_INACTIVE = "installment_customer_inactive"
    EXCEEDS_DEBT = "installment_exceeds_debt"
    DOWN_EXCEEDS_PRINCIPAL = "installment_down_exceeds_principal"
    NOTHING_TO_FINANCE = "installment_nothing_to_finance"
    NOT_ACTIVE = "installment_plan_not_active"
    PAYMENT_EXCEEDS_REMAINING = "installment_payment_exceeds_remaining"
    PAYMENT_EXCEEDS_BALANCE = "installment_payment_exceeds_balance"


ERROR_MESSAGES: dict[InstallmentError, str] = {
    InstallmentError.NOT_FOUND: "لم نجد خطة التقسيط هذه",
    InstallmentError.VERSION_CONFLICT: "عُدّلت خطة التقسيط من مكان آخر. حدّث الصفحة وأعد المحاولة",
    InstallmentError.CUSTOMER_INACTIVE: "هذا العميل معطّل. فعّله أولاً لتقسّط عليه",
    InstallmentError.EXCEEDS_DEBT: "المبلغ أكبر من مديونية العميل غير المقسّطة",
    InstallmentError.DOWN_EXCEEDS_PRINCIPAL: "المقدّم أكبر من مبلغ التقسيط",
    InstallmentError.NOTHING_TO_FINANCE: "لا يتبقى مبلغ للتقسيط بعد المقدّم",
    InstallmentError.NOT_ACTIVE: "خطة التقسيط هذه منتهية أو ملغاة",
    InstallmentError.PAYMENT_EXCEEDS_REMAINING: "المبلغ أكبر من المتبقي على خطة التقسيط",
    InstallmentError.PAYMENT_EXCEEDS_BALANCE: "المبلغ أكبر من مديونية العميل الحالية",
}
