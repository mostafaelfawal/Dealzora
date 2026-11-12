"""Pydantic schemas. المال بالقروش والكميات × 1000 (نفس قواعد المنتجات)."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.constants import MAX_MONEY
from app.core.validation import Money, optional_text

from .constants import (
    DEFAULT_PAGE_SIZE,
    MAX_LINES,
    MAX_NOTE_LEN,
    MAX_PAGE_SIZE,
    MAX_PAYMENT_REF_LEN,
    MAX_QUERY_LEN,
)
from app.modules.settings.payments import is_electronic

from .types import PaymentMethod, RefundVia, ReturnReason, SaleSort, SaleStatusFilter

Note = optional_text("الملاحظة", MAX_NOTE_LEN)
PaymentRef = optional_text("رقم العملية", MAX_PAYMENT_REF_LEN)
Qty = Field(gt=0, le=1_000_000_000)  # × 1000


# ================= إنشاء فاتورة =================
class SaleLineIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: str = Field(min_length=1, max_length=36)
    unit_id: str | None = Field(None, max_length=36)
    qty: int = Qty
    # السعر الذي رآه الكاشير. السيرفر يقارنه بالسعر الحالي ولا يثق به أبداً.
    unit_price: Money
    discount: Money = 0


class SaleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    client_ref: str = Field(min_length=8, max_length=36)
    customer_id: str | None = Field(None, max_length=36)
    lines: list[SaleLineIn] = Field(min_length=1, max_length=MAX_LINES)
    invoice_discount: Money = 0
    # cash/credit/mixed أو معرّف طريقة إلكترونية مفعّلة في الإعدادات.
    payment_method: str = Field(pattern=r"^[a-z][a-z0-9_]{1,15}$")
    cash_amount: Money = 0
    received: Money = 0
    # الدفع الإلكتروني: رقم العملية أو رقم المحوِّل (اختياري، للمراجعة).
    payment_ref: PaymentRef = None
    note: Note = None

    @model_validator(mode="after")
    def _payment_shape(self):
        if is_electronic(self.payment_method):
            if self.cash_amount or self.received:
                raise ValueError("الدفع الإلكتروني يكون بالمبلغ كاملاً بدون كاش")
            return self
        if self.payment_ref:
            raise ValueError("رقم العملية للدفع الإلكتروني فقط")
        if self.payment_method == PaymentMethod.CREDIT and self.cash_amount:
            raise ValueError("البيع الآجل بالكامل لا يحتوي مبلغاً كاشاً")
        if self.received and self.received < self.cash_amount:
            raise ValueError("المبلغ المستلم أقل من المدفوع كاش")
        if self.received > MAX_MONEY:
            raise ValueError("المبلغ كبير جداً")
        return self


# ================= المرتجع =================
class ReturnLineIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sale_line_id: str = Field(min_length=1, max_length=36)
    qty: int = Qty


class ReturnCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: ReturnReason
    note: Note = None
    lines: list[ReturnLineIn] = Field(min_length=1, max_length=MAX_LINES)
    # فاتورة مدفوعة إلكترونياً فقط: لنفس المحفظة (افتراضي) أو كاش من الدرج.
    refund_via: RefundVia = RefundVia.WALLET


class ExchangeCreate(BaseModel):
    """استبدال = مرتجع من فاتورة قديمة + فاتورة جديدة في معاملة واحدة."""

    model_config = ConfigDict(extra="forbid")

    sale_id: str = Field(min_length=1, max_length=36)
    return_data: ReturnCreate
    sale: SaleCreate | None = None  # None = مرتجع فقط


# ================= الاستجابات =================
class SaleLineOut(BaseModel):
    id: str
    product_id: str
    unit_id: str | None  # None = الوحدة الأساسية
    name: str
    unit_name: str
    factor: int  # وحدات أساسية × 1000 لكل وحدة بيع (كرتونة 12 = 12000)
    qty: int
    unit_price: int
    discount: int
    line_total: int
    net_total: int
    returned_qty: int
    unit_cost: int | None  # None للكاشير


class SaleOut(BaseModel):
    id: str
    number: int
    sold_at: datetime
    sold_on: date
    customer_id: str | None
    customer_name: str | None
    customer_phone: str | None
    cashier_name: str | None
    payment_method: str
    payment_label: str
    subtotal: int
    lines_discount: int
    invoice_discount: int
    total: int
    cash_amount: int
    credit_amount: int
    wallet_amount: int
    payment_ref: str | None
    received: int
    change: int
    returned_total: int
    cost_total: int | None  # None للكاشير
    profit: int | None  # None للكاشير
    note: str | None
    lines: list[SaleLineOut]


class SaleListQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    q: str = Field("", max_length=MAX_QUERY_LEN)
    customer_id: str | None = None
    shift_id: str | None = None
    method: str | None = Field(None, max_length=16)
    status: SaleStatusFilter = SaleStatusFilter.ALL
    date_from: date | None = None
    date_to: date | None = None
    sort: SaleSort = SaleSort.NEWEST
    page: int = Field(1, ge=1)
    page_size: int = Field(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)

    @model_validator(mode="after")
    def _date_range(self):
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("تاريخ البداية بعد تاريخ النهاية")
        return self


class SaleListOut(BaseModel):
    items: list[SaleOut]
    total: int
    page: int
    page_size: int


class SalesSummaryOut(BaseModel):
    today_count: int
    today_total: int
    today_profit: int
    today_returns: int
    week_total: int
    month_total: int
    month_profit: int


class ReturnLineOut(BaseModel):
    id: str
    sale_line_id: str
    product_id: str
    name: str
    unit_name: str
    qty: int
    amount: int


class ReturnOut(BaseModel):
    id: str
    number: int
    sale_id: str
    sale_number: int
    returned_at: datetime
    returned_on: date
    reason: ReturnReason
    note: str | None
    customer_name: str | None
    cashier_name: str | None
    total: int
    cash_refund: int
    credit_refund: int
    wallet_refund: int
    lines: list[ReturnLineOut]


class ReturnListQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    q: str = Field("", max_length=MAX_QUERY_LEN)
    reason: ReturnReason | None = None
    date_from: date | None = None
    date_to: date | None = None
    page: int = Field(1, ge=1)
    page_size: int = Field(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)


class ReturnListOut(BaseModel):
    items: list[ReturnOut]
    total: int
    page: int
    page_size: int


class ExchangeOut(BaseModel):
    sale_return: ReturnOut
    sale: SaleOut | None
