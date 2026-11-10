"""Enums و dataclasses الداخلية."""

from dataclasses import dataclass
from datetime import date
from enum import StrEnum

from .constants import DEFAULT_PAGE_SIZE


class RefundMethod(StrEnum):
    BALANCE = "balance"  # يُخصم من مستحقات المورد
    CASH = "cash"  # المورد ردّ نقدية للخزنة


class PurchaseStatusFilter(StrEnum):
    ALL = "all"
    CREDIT = "credit"  # فيها جزء آجل
    RETURNED = "returned"


@dataclass(frozen=True, slots=True)
class PurchaseFilters:
    query: str = ""
    number: int | None = None
    supplier_id: str | None = None
    status: PurchaseStatusFilter = PurchaseStatusFilter.ALL
    date_from: date | None = None
    date_to: date | None = None
    page: int = 1
    page_size: int = DEFAULT_PAGE_SIZE
