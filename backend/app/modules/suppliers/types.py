"""Enums و dataclasses الداخلية (لا علاقة لها بـ HTTP)."""

from dataclasses import dataclass
from enum import StrEnum

from .constants import DEFAULT_PAGE_SIZE


class BalanceFilter(StrEnum):
    ALL = "all"
    OWED = "owed"  # عليه مستحقات (الرصيد > 0)
    SETTLED = "settled"  # لا مستحقات (الرصيد <= 0)


class SortKey(StrEnum):
    NAME_ASC = "name_asc"
    NEWEST = "newest"
    BALANCE_DESC = "balance_desc"
    BALANCE_ASC = "balance_asc"


class TransactionType(StrEnum):
    OPENING = "opening"  # رصيد افتتاحي
    PURCHASE = "purchase"  # فاتورة شراء آجل: يزيد المستحق
    PURCHASE_RETURN = "purchase_return"  # مرتجع: ينقص المستحق
    PAYMENT = "payment"  # دفعة سداد: تنقص المستحق
    ADJUSTMENT = "adjustment"  # تسوية يدوية


@dataclass(frozen=True, slots=True)
class SupplierFilters:
    query: str = ""
    balance: BalanceFilter = BalanceFilter.ALL
    sort: SortKey = SortKey.NAME_ASC
    page: int = 1
    page_size: int = DEFAULT_PAGE_SIZE


@dataclass(frozen=True, slots=True)
class SuppliersSummary:
    total: int
    owed: int
    inactive: int
    total_payable: int  # بالقروش
