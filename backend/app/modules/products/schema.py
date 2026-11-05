"""Pydantic schemas (الطلبات والاستجابات). قواعد التحقق نفسها في schema_validation."""

from datetime import datetime

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator

from .constants import (
    DEFAULT_PAGE_SIZE,
    DEFAULT_UNIT,
    MAX_EXTRA_UNITS,
    MAX_NOTE_LEN,
    MAX_PAGE_SIZE,
    MAX_QTY,
    MAX_BULK_ITEMS
)
from .schema_validation import (
    Money,
    Name,
    OptionalBarcode,
    Qty,
    SalePrice,
    UnitFactor,
    UnitName,
    resolve_allow_decimal,
    validate_extra_units,
    validate_granularity,
)
from .types import AdjustReason, MovementType, SortKey, StockFilter, StockLevel


# ================= الوحدات الإضافية =================
class UnitIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = None  # موجود = تعديل وحدة قائمة، وغيابه = وحدة جديدة
    name: UnitName
    factor: UnitFactor  # عدد الوحدات الأساسية × 1000
    barcode: OptionalBarcode = None
    sale_price: Money | None = None


class UnitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    factor: int
    barcode: str | None
    sale_price: int | None


# ================= الصنف =================
class ProductBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name
    barcode: OptionalBarcode = None
    category_id: str | None = None
    unit: UnitName = DEFAULT_UNIT
    allow_decimal: bool = False
    cost_price: Money = 0
    sale_price: SalePrice
    min_stock: Qty = 0
    is_active: bool = True
    extra_units: list[UnitIn] = Field(default_factory=list, max_length=MAX_EXTRA_UNITS)

    @model_validator(mode="after")
    def _cross_field_rules(self):
        self.allow_decimal = resolve_allow_decimal(self.unit, self.allow_decimal)
        validate_granularity(
            self.allow_decimal,
            min_stock=self.min_stock,
            opening_stock=getattr(self, "opening_stock", 0),
        )
        validate_extra_units(self.unit, self.barcode, self.extra_units)
        return self


class ProductCreate(ProductBase):
    opening_stock: Qty = 0


class ProductUpdate(ProductBase):
    base_version: int = Field(
        ge=1, description="نسخة السجل التي بدأ منها المستخدم التعديل"
    )


class ProductOut(BaseModel):
    id: str
    name: str
    barcode: str | None
    category_id: str | None
    category_name: str | None
    unit: str
    allow_decimal: bool
    cost_price: int | None  # None للكاشير
    sale_price: int
    margin_percent: int | None  # None للكاشير
    min_stock: int
    stock_qty: int
    stock_level: StockLevel
    is_active: bool
    extra_units: list[UnitOut]
    version: int
    created_at: datetime
    updated_at: datetime


# ================= القوائم =================
class ProductListQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    q: str = Field("", max_length=100)
    category_id: str | None = None
    stock: StockFilter = StockFilter.ALL
    sort: SortKey = SortKey.NAME_ASC
    page: int = Field(1, ge=1)
    page_size: int = Field(
        DEFAULT_PAGE_SIZE,
        ge=1,
        le=MAX_PAGE_SIZE,
        validation_alias=AliasChoices("page_size", "limit"),
    )


class ProductListOut(BaseModel):
    items: list[ProductOut]
    total: int
    page: int
    page_size: int


class ProductsSummaryOut(BaseModel):
    total: int
    low: int
    out: int
    stock_value: int | None  # None للكاشير


class BarcodeLookupOut(BaseModel):
    product: ProductOut
    matched_unit_id: str | None  # لو الباركود لوحدة إضافية (كرتونة مثلاً)


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str


# ================= المخزون =================
class StockAdjustIn(BaseModel):
    """تعديل مخزون يدوي. معنى qty يتبع السبب:
    count  → الرصيد الفعلي بعد الجرد (>= 0)
    damage/gift → الكمية الخارجة (> 0)
    other  → فرق موقّع (± ولا يساوي صفراً) والملاحظة إلزامية
    """

    model_config = ConfigDict(extra="forbid")

    reason: AdjustReason
    qty: int = Field(ge=-MAX_QTY, le=MAX_QTY)
    note: str | None = Field(None, max_length=MAX_NOTE_LEN)

    @model_validator(mode="after")
    def _rules(self):
        self.note = (self.note or "").strip() or None
        if self.reason is AdjustReason.COUNT and self.qty < 0:
            raise ValueError("الرصيد بعد الجرد لا يكون سالباً")
        if self.reason in (AdjustReason.DAMAGE, AdjustReason.GIFT) and self.qty <= 0:
            raise ValueError("الكمية يجب أن تكون أكبر من صفر")
        if self.reason is AdjustReason.OTHER:
            if self.qty == 0:
                raise ValueError("الفرق لا يمكن أن يكون صفراً")
            if not self.note:
                raise ValueError("اكتب سبب التعديل")
        return self


class StockMovementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_id: str
    movement_type: MovementType
    qty_delta: int
    balance_after: int
    unit_cost: int | None
    note: str | None
    ref_type: str | None
    ref_id: str | None
    created_by: str | None
    created_at: datetime


class StockLedgerOut(BaseModel):
    items: list[StockMovementOut]
    total: int
    page: int
    page_size: int


class LedgerQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page: int = Field(1, ge=1)
    page_size: int = Field(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)

# ================= العمليات الجماعية =================
class BulkItemIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    base_version: int = Field(ge=1)


class BulkIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[BulkItemIn] = Field(min_length=1, max_length=MAX_BULK_ITEMS)


class BulkFailureOut(BaseModel):
    id: str
    code: str
    message: str


class BulkResultOut(BaseModel):
    succeeded: list[str]
    failed: list[BulkFailureOut]