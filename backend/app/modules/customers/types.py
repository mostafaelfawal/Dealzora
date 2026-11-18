"""Enums و dataclasses الداخلية (لا علاقة لها بـ HTTP)."""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from .constants import DEFAULT_PAGE_SIZE


class CustomerFilter(StrEnum):
    ALL = "all"
    DEBTORS = "debtors"
    OVERDUE = "overdue"
    LIMIT = "limit"
    INACTIVE = "inactive"
    CREDITORS = "creditors"  # لهم رصيد لدى المحل


class CustomerSort(StrEnum):
    DEBT = "debt"
    NAME = "name"
    RECENT = "recent"
    SALES = "sales"
    NEWEST = "newest"


class CreditLevel(StrEnum):
    CASH = "cash"  # حد ائتماني 0 = بيع نقدي فقط
    OK = "ok"
    WARN = "warn"
    FULL = "full"


class LedgerType(StrEnum):
    OPENING = "opening"  # رصيد افتتاحي
    SALE = "sale"  # فاتورة آجلة (من الكاشير)
    PAYMENT = "payment"  # تحصيل دفعة
    RETURN = "return"  # مرتجع يخفض الدين (من الكاشير)
    ADJUSTMENT = "adjustment"
    DEPOSIT = "deposit"  # باقٍ تركه العميل رصيداً لدى المحل
    BALANCE_USE = "balance_use"  # دفع فاتورة من رصيده لدى المحل
    BALANCE_PAYOUT = "balance_payout"  # صرف رصيده نقداً (المدير)
    # قديم: لم يعد يُنشأ (البيع بالتقسيط صار بيعاً آجلاً من الكاشير). يبقى لعرض الحركات القديمة.
    INSTALLMENT = "installment"


@dataclass(frozen=True, slots=True)
class CustomerFilters:
    overdue_before: datetime
    query: str = ""
    filter: CustomerFilter = CustomerFilter.ALL
    sort: CustomerSort = CustomerSort.DEBT
    only_active: bool = False
    page: int = 1
    page_size: int = DEFAULT_PAGE_SIZE


@dataclass(frozen=True, slots=True)
class CustomersSummary:
    total: int
    total_debt: int  # بالقروش
    debtors: int
    overdue: int
    at_limit: int
    inactive: int
    total_credit: int = 0  # أرصدة العملاء لدى المحل
    creditors: int = 0
