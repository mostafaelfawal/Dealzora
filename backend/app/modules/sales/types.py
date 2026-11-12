"""Enums و dataclasses الداخلية (لا علاقة لها بـ HTTP)."""

from dataclasses import dataclass
from datetime import date
from enum import StrEnum

from .constants import DEFAULT_PAGE_SIZE


class PaymentMethod(StrEnum):
    """الطرق المدمجة. أي معرّف آخر = طريقة إلكترونية يحددها المحل (settings/payments.py):
    المبلغ كامل بلا باقٍ، ولا يدخل الدرج ولا الخزنة النقدية."""

    CASH = "cash"
    CREDIT = "credit"
    MIXED = "mixed"


class RefundVia(StrEnum):
    """رد مرتجع فاتورة مدفوعة إلكترونياً: لنفس المحفظة (افتراضي) أو كاش من الدرج."""

    WALLET = "wallet"
    CASH = "cash"


class ReturnReason(StrEnum):
    WRONG_ITEM = "wrong_item"
    DEFECTIVE = "defective"
    CUSTOMER_CHANGED = "customer_changed"
    OTHER = "other"


class SaleStatusFilter(StrEnum):
    ALL = "all"
    CREDIT = "credit"  # فيها جزء آجل
    WALLET = "wallet"  # أي دفع إلكتروني (محفظة/بطاقة/تحويل)
    RETURNED = "returned"  # عليها مرتجع (كلي أو جزئي)


class SaleSort(StrEnum):
    NEWEST = "newest"
    OLDEST = "oldest"
    TOTAL_DESC = "total_desc"
    TOTAL_ASC = "total_asc"


@dataclass(frozen=True, slots=True)
class SaleFilters:
    query: str = ""
    number: int | None = None
    customer_id: str | None = None
    shift_id: str | None = None
    method: str | None = None
    status: SaleStatusFilter = SaleStatusFilter.ALL
    date_from: date | None = None
    date_to: date | None = None
    sort: SaleSort = SaleSort.NEWEST
    page: int = 1
    page_size: int = DEFAULT_PAGE_SIZE


@dataclass(frozen=True, slots=True)
class PeriodTotals:
    count: int
    total: int
    profit: int
    returns: int
