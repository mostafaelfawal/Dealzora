"""ثوابت موديول الورديات. أي رقم أو نص ثابت يُكتب هنا فقط."""

from enum import StrEnum

MAX_NOTE_LEN = 200
DEFAULT_PAGE_SIZE = 24
MAX_PAGE_SIZE = 200

ENTITY_SHIFT = "shift"

SHIFT_SNAPSHOT_FIELDS = (
    "cashier_id",
    "opened_at",
    "closed_at",
    "opening_float",
    "expected_cash",
    "counted_cash",
    "difference",
    "note",
)


class ShiftError(StrEnum):
    NOT_FOUND = "shift_not_found"
    NO_OPEN_SHIFT = "no_open_shift"
    ALREADY_OPEN = "shift_already_open"
    NOT_YOURS = "shift_not_yours"


ERROR_MESSAGES: dict[ShiftError, str] = {
    ShiftError.NOT_FOUND: "لم نجد هذه الوردية",
    ShiftError.NO_OPEN_SHIFT: "لا توجد وردية مفتوحة. افتح وردية أولاً",
    ShiftError.ALREADY_OPEN: "توجد وردية مفتوحة بالفعل. اقفلها أولاً",
    ShiftError.NOT_YOURS: "هذه الوردية مفتوحة باسم مستخدم آخر. اطلب من المدير قفلها",
}
