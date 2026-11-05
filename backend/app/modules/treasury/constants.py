"""ثوابت موديول الخزنة. أي رقم أو نص ثابت يُكتب هنا فقط."""

from enum import StrEnum

MAX_NOTE_LEN = 200
MAX_MONEY = 10_000_000 * 100  # قروش
DEFAULT_PAGE_SIZE = 24
MAX_PAGE_SIZE = 500

ENTITY_CASH_ENTRY = "cash_entry"
SOURCE_EXPENSE = "expense"  # نفس ENTITY_EXPENSE في موديول المصروفات (بدون استيراد دائري)

CASH_SNAPSHOT_FIELDS = (
    "direction",
    "kind",
    "amount",
    "occurred_at",
    "note",
    "source_entity",
    "source_id",
)


class TreasuryError(StrEnum):
    NOT_FOUND = "cash_entry_not_found"
    VERSION_CONFLICT = "version_conflict"
    LOCKED = "cash_entry_locked"


ERROR_MESSAGES: dict[TreasuryError, str] = {
    TreasuryError.NOT_FOUND: "لم نجد هذه الحركة",
    TreasuryError.VERSION_CONFLICT: "تم تعديل هذه الحركة من مكان آخر. حدّث الصفحة وأعد المحاولة",
    TreasuryError.LOCKED: "هذه الحركة مرتبطة بعملية أخرى (مثل مصروف). عدّلها أو احذفها من مصدرها",
}