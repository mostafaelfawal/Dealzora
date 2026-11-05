"""Pydantic schemas (الطلبات والاستجابات). قواعد التحقق نفسها في schema_validation."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from .constants import DEFAULT_PAGE_SIZE, MAX_BULK_ITEMS, MAX_NOTE_LEN, MAX_PAGE_SIZE
from .schema_validation import (
    Money,
    Name,
    OptionalAddress,
    OptionalNotes,
    OptionalPhone,
    PositiveMoney,
)
from .types import BalanceFilter, SortKey, TransactionType


# ================= المورد =================
class SupplierBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name
    phone: OptionalPhone = None
    address: OptionalAddress = None
    notes: OptionalNotes = None
    is_active: bool = True


class SupplierCreate(SupplierBase):
    opening_balance: Money = 0  # المستحق للمورد قبل استخدام البرنامج


class SupplierUpdate(SupplierBase):
    base_version: int = Field(
        ge=1, description="نسخة السجل التي بدأ منها المستخدم التعديل"
    )


class SupplierOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    phone: str | None
    address: str | None
    notes: str | None
    balance: int  # قروش. موجب = مستحق للمورد
    is_active: bool
    version: int
    created_at: datetime
    updated_at: datetime


# ================= القوائم =================
class SupplierListQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    q: str = Field("", max_length=100)
    balance: BalanceFilter = BalanceFilter.ALL
    sort: SortKey = SortKey.NAME_ASC
    page: int = Field(1, ge=1)
    page_size: int = Field(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)


class SupplierListOut(BaseModel):
    items: list[SupplierOut]
    total: int
    page: int
    page_size: int


class SuppliersSummaryOut(BaseModel):
    total: int
    owed: int
    inactive: int
    total_payable: int


# ================= كشف الحساب والدفعات =================
class SupplierPaymentIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount: PositiveMoney
    note: str | None = Field(None, max_length=MAX_NOTE_LEN)


class SupplierTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    supplier_id: str
    txn_type: TransactionType
    amount_delta: int
    balance_after: int
    note: str | None
    created_at: datetime


class SupplierStatementOut(BaseModel):
    items: list[SupplierTransactionOut]
    total: int
    page: int
    page_size: int


class StatementQuery(BaseModel):
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
