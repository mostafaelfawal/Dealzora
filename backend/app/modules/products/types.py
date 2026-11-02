"""Enums و dataclasses الداخلية (لا علاقة لها بـ HTTP)."""

from dataclasses import dataclass
from enum import StrEnum

from .constants import DEFAULT_PAGE_SIZE


class StockLevel(StrEnum):
    OK = "ok"
    LOW = "low"
    OUT = "out"


class StockFilter(StrEnum):
    ALL = "all"
    LOW = "low"
    OUT = "out"


class SortKey(StrEnum):
    NAME_ASC = "name_asc"
    NEWEST = "newest"
    PRICE_ASC = "price_asc"
    PRICE_DESC = "price_desc"
    STOCK_ASC = "stock_asc"
    STOCK_DESC = "stock_desc"
    MARGIN_DESC = "margin_desc"


class MovementType(StrEnum):
    OPENING = "opening"
    PURCHASE = "purchase"
    PURCHASE_RETURN = "purchase_return"
    SALE = "sale"
    SALE_RETURN = "sale_return"
    COUNT = "count"  # جرد
    DAMAGE = "damage"  # تالف
    GIFT = "gift"  # هدية
    ADJUSTMENT = "adjustment"  # تسوية أخرى


class AdjustReason(StrEnum):
    COUNT = "count"
    DAMAGE = "damage"
    GIFT = "gift"
    OTHER = "other"


@dataclass(frozen=True, slots=True)
class ProductFilters:
    query: str = ""
    category_id: str | None = None
    stock: StockFilter = StockFilter.ALL
    sort: SortKey = SortKey.NAME_ASC
    only_active: bool = False
    page: int = 1
    page_size: int = DEFAULT_PAGE_SIZE


@dataclass(frozen=True, slots=True)
class ProductsSummary:
    total: int
    low: int
    out: int
    stock_value: int  # بالقروش، بسعر الشراء
