"""دوال مساعدة نقية (بدون قاعدة بيانات ولا HTTP).

normalize_search / escape_like / diff_snapshots عامة، مستوردة من products.helper
(لو احتجتها في موديول ثالث انقلها إلى app/core).
"""

from datetime import date, datetime, timedelta
from typing import Any

from app.modules.products.helper import diff_snapshots, escape_like, normalize_search

from .constants import EXPENSE_SNAPSHOT_FIELDS, WEEK_DAYS

__all__ = [
    "build_search_text",
    "diff_snapshots",
    "escape_like",
    "expense_snapshot",
    "normalize_search",
    "period_starts",
]


def build_search_text(note: str | None) -> str:
    """البحث في الملاحظات فقط (نفس placeholder الواجهة)."""
    return normalize_search(note or "")


def period_starts(today: date) -> tuple[date, date]:
    """(بداية آخر 7 أيام شامل اليوم، أول الشهر). نفس منطق periodRange في الواجهة."""
    return today - timedelta(days=WEEK_DAYS - 1), today.replace(day=1)


def _jsonable(value: Any) -> Any:
    return value.isoformat() if isinstance(value, (date, datetime)) else value


def expense_snapshot(expense: Any) -> dict[str, Any]:
    return {f: _jsonable(getattr(expense, f)) for f in EXPENSE_SNAPSHOT_FIELDS}