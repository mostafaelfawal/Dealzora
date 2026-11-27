"""ثوابت الحجوزات. أي رقم أو نص ثابت يُكتب هنا فقط."""

from enum import StrEnum

MAX_PAYLOAD_BYTES = 256 * 1024
MAX_LINES = 300
MAX_NOTE_LEN = 200
MAX_QUERY_LEN = 100
DEFAULT_PAGE_SIZE = 30
MAX_PAGE_SIZE = 200

ENTITY_RESERVATION = "reservation"
REF_RESERVATION = "reservation"


class ReservationStatus(StrEnum):
    PENDING = "pending"  # قيد التجهيز
    READY = "ready"  # جاهز للاستلام
    PICKED_UP = "picked_up"  # استُلم (صار فاتورة بيع)
    CANCELLED = "cancelled"


OPEN_STATUSES = frozenset({ReservationStatus.PENDING, ReservationStatus.READY})


class ReservationFilter(StrEnum):
    OPEN = "open"  # قيد التجهيز + جاهز
    PENDING = "pending"
    READY = "ready"
    OVERDUE = "overdue"  # مفتوح وتجاوز موعد الاستلام
    PICKED_UP = "picked_up"
    CANCELLED = "cancelled"
    ALL = "all"


class ReservationError(StrEnum):
    NOT_FOUND = "reservation_not_found"
    EMPTY = "reservation_empty"
    TOO_LARGE = "reservation_too_large"
    INVALID = "reservation_invalid"
    DUPLICATE = "reservation_duplicate"
    CUSTOMER_INACTIVE = "reservation_customer_inactive"
    CUSTOMER_HAS_DEBT = "reservation_customer_has_debt"
    NOT_OPEN = "reservation_not_open"
    CUSTOMER_MISMATCH = "reservation_customer_mismatch"
    NOT_YOURS = "reservation_not_yours"
    PICKUP_IN_PAST = "reservation_pickup_in_past"


ERROR_MESSAGES: dict[ReservationError, str] = {
    ReservationError.NOT_FOUND: "لم نجد هذا الحجز",
    ReservationError.EMPTY: "لا يمكن حجز فاتورة فارغة",
    ReservationError.TOO_LARGE: "الحجز أكبر من المسموح",
    ReservationError.INVALID: "بيانات الحجز غير صالحة",
    ReservationError.DUPLICATE: "حُفظ هذا الحجز من قبل",
    ReservationError.CUSTOMER_INACTIVE: "هذا العميل موقوف",
    ReservationError.CUSTOMER_HAS_DEBT: (
        "على العميل دين ({debt}). حصّله أولاً أو احجز بلا عربون، حتى لا يُخصم العربون من الدين"
    ),
    ReservationError.NOT_OPEN: "هذا الحجز {status} ولا يمكن تعديله",
    ReservationError.CUSTOMER_MISMATCH: "عميل الفاتورة غير عميل الحجز",
    ReservationError.NOT_YOURS: "إلغاء حجز سجّله كاشير آخر للمدير فقط",
    ReservationError.PICKUP_IN_PAST: "موعد الاستلام لا يكون في الماضي",
}

STATUS_NAMES: dict[ReservationStatus, str] = {
    ReservationStatus.PENDING: "قيد التجهيز",
    ReservationStatus.READY: "جاهز للاستلام",
    ReservationStatus.PICKED_UP: "مُستلَم",
    ReservationStatus.CANCELLED: "ملغى",
}
