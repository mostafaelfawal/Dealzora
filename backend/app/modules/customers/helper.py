"""دوال مساعدة نقية (بدون قاعدة بيانات ولا HTTP)، سهلة الاختبار."""

import re
from datetime import datetime, timedelta, timezone
from typing import Any

# TODO: انقل دوال النصوص دي إلى app/core/text.py عندما يحتاجها موديول ثالث.
from app.modules.products.helper import escape_like, normalize_digits, normalize_search

from .constants import CUSTOMER_SNAPSHOT_FIELDS, NEAR_LIMIT_PERCENT, OVERDUE_DAYS
from .types import CreditLevel

__all__ = [
    "escape_like",
    "normalize_digits",
    "normalize_search",
    "clean_phone",
    "build_search_text",
    "calc_available_credit",
    "calc_credit_level",
    "is_overdue",
    "customer_snapshot",
    "diff_snapshots",
]

_PHONE_NOISE = re.compile(r"[\s\-()]")


def clean_phone(text: str) -> str:
    return _PHONE_NOISE.sub("", normalize_digits(text))


def build_search_text(name: str, phone: str | None) -> str:
    return " ".join(p for p in (normalize_search(name), phone) if p)


# ---------- الائتمان ----------
def calc_available_credit(balance: int, credit_limit: int) -> int:
    return max(credit_limit - balance, 0)


def calc_credit_level(balance: int, credit_limit: int) -> CreditLevel:
    """نفس منطق getCreditLevel في الواجهة (بحساب صحيح بدون كسور)."""
    if credit_limit <= 0:
        return CreditLevel.CASH
    if balance >= credit_limit:
        return CreditLevel.FULL
    if balance * 100 >= credit_limit * NEAR_LIMIT_PERCENT:
        return CreditLevel.WARN
    return CreditLevel.OK


def _aware(value: datetime) -> datetime:
    """SQLite يرجّع datetime بدون tzinfo (مخزّن UTC)."""
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def is_overdue(
    balance: int,
    last_payment_at: datetime | None,
    created_at: datetime,
    now: datetime,
) -> bool:
    """متأخر = عليه دين ومرّ أكثر من OVERDUE_DAYS على آخر دفعة (أو على إضافته لو لم يدفع قط)."""
    if balance <= 0:
        return False
    since = _aware(last_payment_at or created_at)
    return _aware(now) - since > timedelta(days=OVERDUE_DAYS)


# ---------- Audit / Outbox ----------
def customer_snapshot(customer: Any) -> dict[str, Any]:
    return {f: getattr(customer, f) for f in CUSTOMER_SNAPSHOT_FIELDS}


def diff_snapshots(
    before: dict[str, Any], after: dict[str, Any]
) -> dict[str, dict[str, Any]]:
    return {
        key: {"from": before.get(key), "to": after.get(key)}
        for key in after
        if before.get(key) != after.get(key)
    }
