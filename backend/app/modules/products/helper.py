"""دوال مساعدة نقية (بدون قاعدة بيانات ولا HTTP)، سهلة الاختبار."""

import math
import re
import secrets
from collections.abc import Iterable
from datetime import datetime
from typing import Any

from .constants import EAN_PREFIX, PRODUCT_SNAPSHOT_FIELDS
from .types import AdjustReason, MovementType, StockLevel

_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "0123456789" * 2)
_DIACRITICS = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]")
_LETTERS = str.maketrans(
    {"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ة": "ه", "ؤ": "و", "ئ": "ي"}
)


def normalize_digits(text: str) -> str:
    return text.translate(_DIGITS)


def normalize_search(text: str) -> str:
    """توحيد النص العربي للبحث: أرقام، تشكيل، ألف/ياء/تاء مربوطة."""
    text = normalize_digits(text)
    text = _DIACRITICS.sub("", text).translate(_LETTERS)
    return " ".join(text.casefold().split())


def escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def build_search_text(name: str, barcodes: Iterable[str | None]) -> str:
    return " ".join([normalize_search(name), *(b for b in barcodes if b)])


# ---------- المخزون والهامش ----------
def calc_stock_level(stock_qty: int, min_stock: int) -> StockLevel:
    if stock_qty <= 0:
        return StockLevel.OUT
    if min_stock > 0 and stock_qty <= min_stock:
        return StockLevel.LOW
    return StockLevel.OK


def calc_margin_percent(cost: int, sale: int) -> int | None:
    """هامش الربح من سعر البيع (%)، مقرّب مثل Math.round في الواجهة."""
    if sale <= 0:
        return None
    return math.floor((sale - cost) * 100 / sale + 0.5)


def compute_adjustment(reason: AdjustReason, qty: int, current: int) -> tuple[int, MovementType]:
    """يحوّل مدخلات التعديل اليدوي إلى (الفرق الموقّع، نوع الحركة)."""
    if reason is AdjustReason.COUNT:
        return qty - current, MovementType.COUNT  # qty = الرصيد بعد الجرد
    if reason is AdjustReason.DAMAGE:
        return -qty, MovementType.DAMAGE
    if reason is AdjustReason.GIFT:
        return -qty, MovementType.GIFT
    return qty, MovementType.ADJUSTMENT  # OTHER: موقّعة


# ---------- الباركود ----------
def ean13_check_digit(body12: str) -> int:
    total = sum(int(d) * (1 if i % 2 == 0 else 3) for i, d in enumerate(body12))
    return (10 - total % 10) % 10


def generate_barcode() -> str:
    body = EAN_PREFIX + "".join(str(secrets.randbelow(10)) for _ in range(9))
    return body + str(ean13_check_digit(body))


# ---------- Audit / Outbox ----------
def _jsonable(value: Any) -> Any:
    return value.isoformat() if isinstance(value, datetime) else value


def product_snapshot(product: Any, *, include_deleted_units: bool = False) -> dict[str, Any]:
    data: dict[str, Any] = {f: getattr(product, f) for f in PRODUCT_SNAPSHOT_FIELDS}
    units = product.all_units if include_deleted_units else product.units
    data["units"] = [
        {
            "id": u.id,
            "name": u.name,
            "factor": u.factor,
            "barcode": u.barcode,
            "sale_price": u.sale_price,
            "deleted_at": _jsonable(u.deleted_at),
        }
        for u in units
    ]
    return data


def diff_snapshots(before: dict[str, Any], after: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        key: {"from": before.get(key), "to": after.get(key)}
        for key in after
        if before.get(key) != after.get(key)
    }
