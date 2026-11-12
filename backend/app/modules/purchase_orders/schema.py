"""Pydantic schemas. المال بالقروش والكميات × 1000."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.validation import Money, optional_text

from .constants import (
    DEFAULT_COVER_DAYS,
    DEFAULT_LEAD_DAYS,
    DEFAULT_PAGE_SIZE,
    DEFAULT_SALES_DAYS,
    MAX_LINES,
    MAX_NOTE_LEN,
    MAX_PAGE_SIZE,
    OrderStatus,
    OrderStatusFilter,
    Urgency,
)

Note = optional_text("الملاحظة", MAX_NOTE_LEN)


# ================= اقتراح النواقص =================
class SuggestionsQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sales_days: int = Field(DEFAULT_SALES_DAYS, ge=7, le=365)
    cover_days: int = Field(DEFAULT_COVER_DAYS, ge=1, le=180)
    lead_days: int = Field(DEFAULT_LEAD_DAYS, ge=0, le=60)
    round_packs: bool = True


class SuggestionOut(BaseModel):
    product_id: str
    name: str
    barcode: str | None
    category_name: str | None
    unit: str
    allow_decimal: bool
    stock: int
    min_stock: int
    on_order: int  # في طلبات مفتوحة (مسودة/مُرسلة)
    sold_qty: int  # صافي المبيعات في الفترة
    avg_daily: int  # × 1000
    days_left: float | None  # None = لا مبيعات (لا يمكن التوقع)
    urgency: Urgency
    suggested_qty: int  # بالوحدة الأساسية × 1000 (0 = مغطى بطلبات مفتوحة)
    pack_name: str | None  # كرتونة/دستة: للعرض «= 3 كرتونة»
    pack_factor: int | None
    unit_cost: int  # آخر سعر شراء للوحدة الأساسية
    line_total: int
    supplier_id: str | None  # آخر مورد اشترينا منه الصنف
    supplier_name: str | None
    last_purchased_on: date | None


class SuggestionsTotals(BaseModel):
    count: int
    out: int
    critical: int
    low: int
    soon: int
    estimated_total: int
    suppliers: int


class SuggestionsOut(BaseModel):
    sales_days: int
    cover_days: int
    lead_days: int
    items: list[SuggestionOut]
    totals: SuggestionsTotals


# ================= طلبات الشراء =================
class OrderLineIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: str = Field(min_length=1, max_length=36)
    qty: int = Field(gt=0, le=1_000_000_000)
    unit_cost: Money


class OrderCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    supplier_id: str = Field(min_length=1, max_length=36)
    note: Note = None
    lines: list[OrderLineIn] = Field(min_length=1, max_length=MAX_LINES)


class OrderUpdate(OrderCreate):
    base_version: int = Field(ge=1)


class OrderAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    base_version: int = Field(ge=1)


class OrderLineOut(BaseModel):
    id: str
    product_id: str
    name: str
    unit_name: str
    qty: int
    unit_cost: int
    line_total: int
    stock_at_order: int
    current_stock: int | None  # None = الصنف حُذف


class OrderOut(BaseModel):
    id: str
    number: int
    version: int
    supplier_id: str
    supplier_name: str
    supplier_phone: str | None
    status: OrderStatus
    total: int
    note: str | None
    created_at: datetime
    created_by_name: str | None
    sent_at: datetime | None
    closed_at: datetime | None
    purchase_id: str | None
    purchase_number: int | None
    lines: list[OrderLineOut]


class OrderListQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: OrderStatusFilter = OrderStatusFilter.OPEN
    supplier_id: str | None = None
    page: int = Field(1, ge=1)
    page_size: int = Field(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)


class OrderListOut(BaseModel):
    items: list[OrderOut]
    total: int
    page: int
    page_size: int


class OrdersSummaryOut(BaseModel):
    draft: int
    sent: int
    open_total: int
    received_month: int
