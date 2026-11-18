"""Pydantic schemas. أسماء الحقول تطابق features/installments/api/installments.api.ts."""

from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, model_validator

from .constants import (
    MAX_INSTALLMENTS,
    MAX_MONEY,
    MAX_NOTE_LEN,
    MAX_PAYMENT_NOTE_LEN,
    MAX_TITLE_LEN,
    MIN_INSTALLMENTS,
)
from .types import DueStatus, Frequency, PlanFilter, PlanStatus


def _squash(value: object) -> object:
    return " ".join(value.split()) if isinstance(value, str) else value


def _empty_to_none(value: object) -> object:
    if isinstance(value, str):
        value = " ".join(value.split())
        return value or None
    return value


Title = Annotated[str, BeforeValidator(_squash), Field(min_length=1, max_length=MAX_TITLE_LEN)]
# قيد الطول على النص فقط: لو وُضع على (str | None) يُطبَّق على None فيرمي TypeError (خطأ 500).
Note = Annotated[
    Annotated[str, Field(max_length=MAX_NOTE_LEN)] | None, BeforeValidator(_empty_to_none)
]
PaymentNote = Annotated[
    Annotated[str, Field(max_length=MAX_PAYMENT_NOTE_LEN)] | None,
    BeforeValidator(_empty_to_none),
]


# ================= الطلبات =================
class PlanCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    customer_id: str = Field(min_length=1, max_length=36)
    title: Title
    principal: int = Field(gt=0, le=MAX_MONEY)  # قروش
    down_payment: int = Field(0, ge=0, le=MAX_MONEY)
    installments_count: int = Field(ge=MIN_INSTALLMENTS, le=MAX_INSTALLMENTS)
    frequency: Frequency = Frequency.MONTHLY
    start_date: date
    # True = بيع/دين جديد يُضاف لحساب العميل الآن. False = تقسيط مديونية مسجّلة بالفعل (بيع آجل).
    adds_debt: bool = False
    note: Note = None

    @model_validator(mode="after")
    def _down(self):
        if self.down_payment > self.principal:
            raise ValueError("المقدّم أكبر من مبلغ التقسيط")
        return self


class PlanPaymentIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount: int = Field(gt=0, le=MAX_MONEY)
    note: PaymentNote = None


class PlanListQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    filter: PlanFilter = PlanFilter.ALL
    customer_id: str | None = Field(None, max_length=36)


# ================= الاستجابات =================
class PlanOut(BaseModel):
    id: str
    customer_id: str
    customer_name: str
    customer_phone: str | None
    title: str
    principal: int
    down_payment: int
    total: int
    installments_count: int
    installment_amount: int  # القسط المعتاد (الأخير قد يزيد قروشاً)
    frequency: Frequency
    start_date: date
    end_date: date
    paid_amount: int
    remaining: int
    paid_count: int
    overdue_amount: int
    overdue_count: int
    next_due_date: date | None
    next_due_amount: int
    status: PlanStatus
    note: str | None
    version: int
    created_at: datetime


class DueOut(BaseModel):
    seq: int
    due_date: date
    amount: int
    paid: int
    status: DueStatus


class PlanPaymentOut(BaseModel):
    id: str
    amount: int
    note: str | None
    created_at: datetime


class PlanDetailOut(PlanOut):
    schedule: list[DueOut]
    payments: list[PlanPaymentOut]


class PlansSummaryOut(BaseModel):
    active: int
    remaining: int  # المتبقي على كل الخطط النشطة
    overdue_plans: int
    overdue_amount: int
    due_soon_plans: int
    due_soon_amount: int
    completed: int
    collected: int  # كل ما حُصّل من أقساط (بلا المقدّم)
