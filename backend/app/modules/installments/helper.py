"""دوال نقية (بدون قاعدة بيانات ولا HTTP): حساب الجدول وتقدّم السداد."""

import calendar
from datetime import date, timedelta

from .constants import DUE_SOON_DAYS
from .types import DueRow, DueStatus, Frequency, PlanProgress


def add_months(day: date, months: int) -> date:
    """نفس اليوم بعد n شهر، ويُقصّ لآخر الشهر (31 يناير + شهر = 28/29 فبراير)."""
    month_index = day.month - 1 + months
    year = day.year + month_index // 12
    month = month_index % 12 + 1
    last = calendar.monthrange(year, month)[1]
    return date(year, month, min(day.day, last))


def due_date(start: date, frequency: Frequency, index: int) -> date:
    if frequency is Frequency.MONTHLY:
        return add_months(start, index)
    step = 14 if frequency is Frequency.BIWEEKLY else 7
    return start + timedelta(days=step * index)


def split_amounts(total: int, count: int) -> list[int]:
    """أقساط متساوية بالقرش، والفرق يُضاف على القسط الأخير."""
    base = total // count
    return [base] * (count - 1) + [total - base * (count - 1)]


def build_schedule(
    total: int,
    count: int,
    frequency: Frequency,
    start: date,
    paid: int,
    today: date,
) -> list[DueRow]:
    """الجدول مع توزيع المدفوع على الأقساط من الأقدم للأحدث."""
    rows: list[DueRow] = []
    left = paid
    for i, amount in enumerate(split_amounts(total, count)):
        covered = min(left, amount)
        left -= covered
        due = due_date(start, frequency, i)
        if covered >= amount:
            status = DueStatus.PAID
        elif due < today:
            status = DueStatus.OVERDUE
        elif covered > 0:
            status = DueStatus.PARTIAL
        else:
            status = DueStatus.UPCOMING
        rows.append(DueRow(seq=i + 1, due_date=due, amount=amount, paid=covered, status=status))
    return rows


def plan_progress(rows: list[DueRow], total: int, paid: int) -> PlanProgress:
    overdue = [r for r in rows if r.status is DueStatus.OVERDUE]
    nxt = next((r for r in rows if r.status is not DueStatus.PAID), None)
    return PlanProgress(
        remaining=max(total - paid, 0),
        paid_count=sum(1 for r in rows if r.status is DueStatus.PAID),
        overdue_amount=sum(r.amount - r.paid for r in overdue),
        overdue_count=len(overdue),
        next_due_date=nxt.due_date if nxt else None,
        next_due_amount=(nxt.amount - nxt.paid) if nxt else 0,
    )


def is_due_soon(overdue_count: int, next_due_date: date | None, today: date) -> bool:
    """قسط يحل خلال أسبوع (ولا متأخرات: المتأخر له فلتره)."""
    if overdue_count or next_due_date is None:
        return False
    return next_due_date <= today + timedelta(days=DUE_SOON_DAYS)
