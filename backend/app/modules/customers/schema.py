"""Pydantic schemas (الطلبات والاستجابات). قواعد التحقق نفسها في schema_validation."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from .constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from .schema_validation import (
    Address,
    Money,
    Name,
    Notes,
    OptionalPhone,
    PaymentNote,
    PositiveMoney,
)
from .types import CreditLevel, CustomerFilter, CustomerSort, LedgerType


# ================= العميل =================
class CustomerBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name
    phone: OptionalPhone = None
    address: Address = ""
    notes: Notes = ""
    credit_limit: Money = 0  # 0 = بيع نقدي فقط
    is_active: bool = True


class CustomerCreate(CustomerBase):
    opening_balance: Money = 0  # دين سابق


class CustomerUpdate(CustomerBase):
    base_version: int = Field(
        ge=1, description="نسخة السجل التي بدأ منها المستخدم التعديل"
    )


class CustomerOut(BaseModel):
    id: str
    name: str
    phone: str | None
    address: str
    notes: str | None  # None للكاشير
    balance: int
    credit_limit: int
    available_credit: int
    credit_level: CreditLevel
    is_overdue: bool
    is_active: bool
    total_sales: int | None  # None للكاشير
    last_purchase_at: datetime | None
    last_payment_at: datetime | None
    version: int
    created_at: datetime
    updated_at: datetime


# ================= القوائم =================
class CustomerListQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    q: str = Field("", max_length=100)
    filter: CustomerFilter = CustomerFilter.ALL
    sort: CustomerSort = CustomerSort.DEBT
    page: int = Field(1, ge=1)
    page_size: int = Field(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)


class CustomerListOut(BaseModel):
    items: list[CustomerOut]
    total: int
    page: int
    page_size: int


class CustomersSummaryOut(BaseModel):
    total: int
    total_debt: int
    debtors: int
    overdue: int
    at_limit: int
    inactive: int


# ================= الدفعات وكشف الحساب =================
class PaymentIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount: PositiveMoney
    note: PaymentNote = None


class StatementEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    entry_type: LedgerType
    debit: int
    credit: int
    balance_after: int
    note: str | None
    ref_type: str | None
    ref_id: str | None
    created_at: datetime


class StatementOut(BaseModel):
    items: list[StatementEntryOut]  # الأحدث أولاً
    total: int
    page: int
    page_size: int


class StatementQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page: int = Field(1, ge=1)
    page_size: int = Field(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)
