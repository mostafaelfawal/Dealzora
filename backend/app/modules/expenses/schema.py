"""Pydantic schemas (الطلبات والاستجابات). أسماء الحقول تطابق types/expenseApi.ts."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .constants import DEFAULT_PAGE_SIZE, MAX_BULK_ITEMS, MAX_PAGE_SIZE, MAX_QUERY_LEN
from .schema_validation import Amount, Note
from .types import ExpenseCategory, ExpenseSortKey


# ================= المصروف =================
class ExpenseBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: ExpenseCategory
    amount: Amount  # قروش
    spent_at: date  # YYYY-MM-DD
    note: Note = None


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(ExpenseBase):
    base_version: int = Field(ge=1, description="نسخة السجل التي بدأ منها المستخدم التعديل")


class ExpenseOut(BaseModel):
    id: str
    category: ExpenseCategory
    amount: int
    note: str | None
    spent_at: date
    created_by_name: str | None
    version: int
    created_at: datetime
    updated_at: datetime


# ================= القوائم =================
class ExpenseListQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    q: str = Field("", max_length=MAX_QUERY_LEN)
    category: ExpenseCategory | None = None
    date_from: date | None = None
    date_to: date | None = None
    sort: ExpenseSortKey = ExpenseSortKey.NEWEST
    page: int = Field(1, ge=1)
    page_size: int = Field(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)

    @model_validator(mode="after")
    def _date_range(self):
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("تاريخ البداية بعد تاريخ النهاية")
        return self


class ExpenseListOut(BaseModel):
    items: list[ExpenseOut]
    total: int
    page: int
    page_size: int


class ExpensesSummaryOut(BaseModel):
    today: int
    week: int
    month: int
    total: int
    count: int


# ================= العمليات الجماعية (نفس شكل /products و /customers) =================
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