"""Enums و dataclasses الداخلية (لا علاقة لها بـ HTTP)."""

from dataclasses import dataclass
from datetime import date
from enum import StrEnum


class Frequency(StrEnum):
    MONTHLY = "monthly"
    BIWEEKLY = "biweekly"
    WEEKLY = "weekly"


class PlanStatus(StrEnum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PlanFilter(StrEnum):
    ALL = "all"
    ACTIVE = "active"
    OVERDUE = "overdue"
    DUE_SOON = "due_soon"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class DueStatus(StrEnum):
    PAID = "paid"
    PARTIAL = "partial"  # دُفع جزء منه ولم يحل موعده بعد
    OVERDUE = "overdue"  # حل موعده ولم يُسدَّد كاملاً
    UPCOMING = "upcoming"


@dataclass(frozen=True, slots=True)
class DueRow:
    seq: int
    due_date: date
    amount: int
    paid: int
    status: DueStatus


@dataclass(frozen=True, slots=True)
class PlanProgress:
    """ما يُحسب من الجدول والمدفوع (لا يُخزَّن)."""

    remaining: int
    paid_count: int
    overdue_amount: int
    overdue_count: int
    next_due_date: date | None
    next_due_amount: int  # المتبقي من أول قسط غير مسدَّد
