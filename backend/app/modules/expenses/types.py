"""Enums و dataclasses الداخلية (لا علاقة لها بـ HTTP)."""

from dataclasses import dataclass
from datetime import date
from enum import StrEnum

from .constants import DEFAULT_PAGE_SIZE


class ExpenseCategory(StrEnum):
    """نفس مفاتيح EXPENSE_CATEGORIES في الـ frontend بالضبط."""

    RENT = "rent"
    ELECTRICITY = "electricity"
    WATER = "water"
    SALARIES = "salaries"
    TRANSPORT = "transport"
    MAINTENANCE = "maintenance"
    SUPPLIES = "supplies"
    MARKETING = "marketing"
    TAXES = "taxes"
    OTHER = "other"


class ExpenseSortKey(StrEnum):
    NEWEST = "newest"
    OLDEST = "oldest"
    AMOUNT_DESC = "amount_desc"
    AMOUNT_ASC = "amount_asc"


@dataclass(frozen=True, slots=True)
class ExpenseFilters:
    query: str = ""
    category: ExpenseCategory | None = None
    date_from: date | None = None
    date_to: date | None = None
    sort: ExpenseSortKey = ExpenseSortKey.NEWEST
    page: int = 1
    page_size: int = DEFAULT_PAGE_SIZE


@dataclass(frozen=True, slots=True)
class ExpensesSummary:
    today: int  # بالقروش
    week: int
    month: int
    total: int
    count: int