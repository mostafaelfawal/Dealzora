"""Pydantic schemas. المال بالقروش."""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.core.validation import Money, optional_text

from .constants import (
    DEFAULT_PAGE_SIZE,
    MAX_NOTE_LEN,
    MAX_PAGE_SIZE,
    MAX_QUERY_LEN,
    ReservationFilter,
)

Note = optional_text("الملاحظة", MAX_NOTE_LEN)


class ReservationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    client_ref: str = Field(min_length=8, max_length=36)
    customer_id: str = Field(min_length=1, max_length=36)
    invoice: dict[str, Any]
    pickup_on: date | None = None
    deposit: Money = 0
    note: Note = None


class ReservationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pickup_on: date | None = None
    note: Note = None


class ReservationListQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    q: str = Field("", max_length=MAX_QUERY_LEN)
    filter: ReservationFilter = ReservationFilter.OPEN
    page: int = Field(1, ge=1)
    page_size: int = Field(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)


class ReservationOut(BaseModel):
    id: str
    number: int
    status: str
    customer_id: str
    customer_name: str
    customer_phone: str | None
    # رصيد العميل الآن (سالب = له لدى المحل). None لو حُذف العميل.
    customer_balance: int | None
    pickup_on: date | None
    is_overdue: bool
    deposit: int
    total: int
    item_count: int
    note: str | None
    invoice: dict[str, Any]
    created_at: datetime
    cashier_name: str | None
    sale_id: str | None
    sale_number: int | None
    closed_at: datetime | None


class ReservationCounts(BaseModel):
    pending: int
    ready: int
    overdue: int
    due_today: int
    open_deposits: int  # عرابين الحجوزات المفتوحة (قروش)


class ReservationListOut(BaseModel):
    items: list[ReservationOut]
    total: int
    page: int
    page_size: int
    counts: ReservationCounts
