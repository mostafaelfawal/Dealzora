"""Pydantic schemas. المال بالقروش."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from .schema_validation import Amount, RequiredNote
from .types import CashDirection, CashKind, CashSortKey


class ManualEntryCreate(BaseModel):
    """حركة يدوية: إيداع (رصيد افتتاحي، تمويل) أو سحب (مالك أخذ فلوس). السبب إجباري."""

    model_config = ConfigDict(extra="forbid")

    direction: CashDirection
    amount: Amount
    occurred_at: date
    note: RequiredNote


class CashEntryOut(BaseModel):
    id: str
    direction: CashDirection
    kind: CashKind
    amount: int
    note: str | None
    occurred_at: date
    source_entity: str | None
    source_id: str | None
    created_by_name: str | None
    version: int
    created_at: datetime


class CashListQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    direction: CashDirection | None = None
    kind: CashKind | None = None
    date_from: date | None = None
    date_to: date | None = None
    sort: CashSortKey = CashSortKey.NEWEST
    page: int = Field(1, ge=1)
    page_size: int = Field(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)

    @model_validator(mode="after")
    def _date_range(self):
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("تاريخ البداية بعد تاريخ النهاية")
        return self


class CashListOut(BaseModel):
    items: list[CashEntryOut]
    total: int
    page: int
    page_size: int


class TreasurySummaryOut(BaseModel):
    balance: int
    total_in: int
    total_out: int
    today_in: int
    today_out: int
    month_in: int
    month_out: int