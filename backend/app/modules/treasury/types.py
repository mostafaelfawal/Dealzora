"""Enums و dataclasses الداخلية."""

from dataclasses import dataclass
from datetime import date
from enum import StrEnum

from .constants import DEFAULT_PAGE_SIZE


class CashDirection(StrEnum):
    IN = "in"
    OUT = "out"


class CashKind(StrEnum):
    EXPENSE = "expense"  # تلقائي من المصروفات
    MANUAL_IN = "manual_in"  # إيداع يدوي (رصيد افتتاحي، تمويل...)
    MANUAL_OUT = "manual_out"  # سحب يدوي
    # لاحقاً: SALE, PURCHASE, CUSTOMER_PAYMENT, SUPPLIER_PAYMENT, REFUND, SHIFT_ADJUST


MANUAL_KINDS = frozenset({CashKind.MANUAL_IN, CashKind.MANUAL_OUT})


class CashSortKey(StrEnum):
    NEWEST = "newest"
    OLDEST = "oldest"
    AMOUNT_DESC = "amount_desc"
    AMOUNT_ASC = "amount_asc"


@dataclass(frozen=True, slots=True)
class CashFilters:
    direction: CashDirection | None = None
    kind: CashKind | None = None
    date_from: date | None = None
    date_to: date | None = None
    sort: CashSortKey = CashSortKey.NEWEST
    page: int = 1
    page_size: int = DEFAULT_PAGE_SIZE


@dataclass(frozen=True, slots=True)
class TreasurySummary:
    balance: int  # قروش (داخل - خارج)
    total_in: int
    total_out: int
    today_in: int
    today_out: int
    month_in: int
    month_out: int