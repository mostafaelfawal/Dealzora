"""Pydantic schemas. المال بالقروش والكميات × 1000."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.validation import Money, PositiveMoney, optional_text

from .constants import (
    DEFAULT_PAGE_SIZE,
    MAX_LINES,
    MAX_NOTE_LEN,
    MAX_PAGE_SIZE,
    MAX_QUERY_LEN,
    MAX_REF_LEN,
)
from .types import PurchaseStatusFilter, RefundMethod

Note = optional_text("الملاحظة", MAX_NOTE_LEN)
SupplierInvoice = optional_text("رقم فاتورة المورد", MAX_REF_LEN)
Qty = Field(gt=0, le=1_000_000_000)


class PurchaseLineIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: str = Field(min_length=1, max_length=36)
    unit_id: str | None = Field(None, max_length=36)
    qty: int = Qty
    unit_cost: Money
    new_sale_price: PositiveMoney | None = None  # سعر بيع جديد للوحدة الأساسية (اختياري)


class PurchaseCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    supplier_id: str = Field(min_length=1, max_length=36)
    supplier_invoice: SupplierInvoice = None
    purchased_on: date
    lines: list[PurchaseLineIn] = Field(min_length=1, max_length=MAX_LINES)
    discount: Money = 0
    paid_amount: Money = 0
    note: Note = None


class PurchaseReturnLineIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    purchase_line_id: str = Field(min_length=1, max_length=36)
    qty: int = Qty


class PurchaseReturnCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    refund_method: RefundMethod
    note: Note = None
    lines: list[PurchaseReturnLineIn] = Field(min_length=1, max_length=MAX_LINES)


class PurchaseLineOut(BaseModel):
    id: str
    product_id: str
    name: str
    unit_name: str
    qty: int
    unit_cost: int
    line_total: int
    returned_qty: int


class PurchaseOut(BaseModel):
    id: str
    number: int
    supplier_id: str
    supplier_name: str
    supplier_invoice: str | None
    purchased_on: date
    created_at: datetime
    created_by_name: str | None
    subtotal: int
    discount: int
    total: int
    paid_amount: int
    credit_amount: int
    returned_total: int
    note: str | None
    lines: list[PurchaseLineOut]


class PurchaseListQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    q: str = Field("", max_length=MAX_QUERY_LEN)
    supplier_id: str | None = None
    status: PurchaseStatusFilter = PurchaseStatusFilter.ALL
    date_from: date | None = None
    date_to: date | None = None
    page: int = Field(1, ge=1)
    page_size: int = Field(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)

    @model_validator(mode="after")
    def _date_range(self):
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("تاريخ البداية بعد تاريخ النهاية")
        return self


class PurchaseListOut(BaseModel):
    items: list[PurchaseOut]
    total: int
    page: int
    page_size: int


class PurchasesSummaryOut(BaseModel):
    month_count: int
    month_total: int
    month_paid: int
    returns_month: int


class PurchaseReturnLineOut(BaseModel):
    id: str
    purchase_line_id: str
    name: str
    qty: int
    amount: int


class PurchaseReturnOut(BaseModel):
    id: str
    number: int
    purchase_id: str
    supplier_id: str
    returned_on: date
    refund_method: RefundMethod
    total: int
    note: str | None
    lines: list[PurchaseReturnLineOut]
