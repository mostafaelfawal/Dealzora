"""Pydantic schemas. المال بالقروش."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.validation import Money, optional_text

from .constants import DEFAULT_PAGE_SIZE, MAX_NOTE_LEN, MAX_PAGE_SIZE

Note = optional_text("الملاحظة", MAX_NOTE_LEN)


class ShiftOpenIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    opening_float: Money = 0


class ShiftCloseIn(BaseModel):
    """الكاشير يعدّ الدرج "أعمى" ويكتب المبلغ الفعلي فقط."""

    model_config = ConfigDict(extra="forbid")

    counted_cash: Money
    note: Note = None


class ShiftOut(BaseModel):
    id: str
    cashier_id: str
    cashier_name: str | None
    # الجهاز الذي فُتحت عليه (لكل جهاز كاشير درجه ووردياته).
    device_name: str | None
    is_open: bool
    opened_at: datetime
    closed_at: datetime | None
    opening_float: int
    sales_count: int
    returns_count: int
    # None للكاشير: يعدّ الدرج بدون أن يرى المتوقع.
    sales_total: int | None
    cash_sales: int | None
    credit_sales: int | None
    cash_refunds: int | None
    vodafone_sales: int | None
    instapay_sales: int | None
    wallet_refunds: int | None
    expected_cash: int | None
    counted_cash: int | None
    difference: int | None
    note: str | None
    version: int


class ShiftListQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page: int = Field(1, ge=1)
    page_size: int = Field(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)


class ShiftListOut(BaseModel):
    items: list[ShiftOut]
    total: int
    page: int
    page_size: int
