"""ثوابت موديول الموردين. أي رقم أو نص ثابت يُكتب هنا فقط."""

from enum import StrEnum

# ---- الحدود ----
MAX_NAME_LEN = 200
MAX_PHONE_LEN = 20
MAX_ADDRESS_LEN = 300
MAX_NOTES_LEN = 500
MAX_NOTE_LEN = 300  # ملاحظة الحركة
MAX_BULK_ITEMS = 200  # أقصى عدد عناصر في طلب جماعي واحد
MAX_MONEY = 1_000_000_000  # بالقروش (10 مليون جنيه)
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 500

PHONE_PATTERN = r"\+?[0-9]{7,15}"  # بعد حذف المسافات والشرطات

# ---- أسماء الكيانات (للـ Outbox والـ Audit) ----
ENTITY_SUPPLIER = "supplier"
ENTITY_SUPPLIER_TXN = "supplier_transaction"

SUPPLIER_SNAPSHOT_FIELDS = (
    "name",
    "phone",
    "address",
    "notes",
    "is_active",
)


class SupplierError(StrEnum):
    NOT_FOUND = "supplier_not_found"
    NAME_TAKEN = "supplier_name_taken"
    VERSION_CONFLICT = "version_conflict"
    HAS_BALANCE = "supplier_has_balance"


ERROR_MESSAGES: dict[SupplierError, str] = {
    SupplierError.NOT_FOUND: "لم نجد هذا المورد",
    SupplierError.NAME_TAKEN: "يوجد مورد آخر بنفس الاسم",
    SupplierError.VERSION_CONFLICT: "تم تعديل هذا المورد من مكان آخر. حدّث الصفحة وأعد المحاولة",
    SupplierError.HAS_BALANCE: "لا يمكن حذف مورد له رصيد غير صفري. سدّد الحساب أو سوّه أولاً",
}
