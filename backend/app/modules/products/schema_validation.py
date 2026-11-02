"""قواعد التحقق القابلة لإعادة الاستخدام (Annotated types + فحوصات عبر الحقول).
اسم الملف schema_validation لأن بايثون لا يقبل نقطة في اسم الـ module.
"""

import re
from typing import Annotated

from pydantic import AfterValidator, BeforeValidator, Field

from .constants import (
    BARCODE_PATTERN,
    DECIMAL_UNITS,
    MAX_EXTRA_UNITS,
    MAX_MONEY,
    MAX_NAME_LEN,
    MAX_QTY,
    MAX_UNIT_NAME_LEN,
    QTY_SCALE,
)
from .helper import normalize_digits

_BARCODE_RE = re.compile(BARCODE_PATTERN)


def _clean_name(value: str) -> str:
    value = " ".join(value.split())
    if not value:
        raise ValueError("اسم الصنف مطلوب")
    if len(value) > MAX_NAME_LEN:
        raise ValueError(f"اسم الصنف أطول من {MAX_NAME_LEN} حرفاً")
    return value


def _clean_unit_name(value: str) -> str:
    value = " ".join(value.split())
    if not value:
        raise ValueError("اسم الوحدة مطلوب")
    if len(value) > MAX_UNIT_NAME_LEN:
        raise ValueError(f"اسم الوحدة أطول من {MAX_UNIT_NAME_LEN} حرفاً")
    return value


def _empty_to_none(value: object) -> object:
    return None if isinstance(value, str) and not value.strip() else value


def _clean_barcode(value: str | None) -> str | None:
    if value is None:
        return None
    value = normalize_digits(value).strip()
    if not _BARCODE_RE.fullmatch(value):
        raise ValueError("الباركود غير صالح (أرقام أو حروف إنجليزية، من 3 إلى 32 خانة)")
    return value


Name = Annotated[str, AfterValidator(_clean_name)]
UnitName = Annotated[str, AfterValidator(_clean_unit_name)]
OptionalBarcode = Annotated[
    str | None, BeforeValidator(_empty_to_none), AfterValidator(_clean_barcode)
]
Money = Annotated[int, Field(ge=0, le=MAX_MONEY)]  # قروش
SalePrice = Annotated[int, Field(gt=0, le=MAX_MONEY)]
Qty = Annotated[int, Field(ge=0, le=MAX_QTY)]  # × 1000
UnitFactor = Annotated[int, Field(ge=QTY_SCALE, le=MAX_QTY)]


# ---------- فحوصات عبر الحقول ----------
def resolve_allow_decimal(unit: str, allow_decimal: bool) -> bool:
    """الوحدات الموزونة تفعّل الكسور تلقائياً."""
    return True if unit in DECIMAL_UNITS else allow_decimal


def validate_granularity(allow_decimal: bool, **quantities: int) -> None:
    if allow_decimal:
        return
    labels = {"min_stock": "الحد الأدنى", "opening_stock": "الرصيد الافتتاحي"}
    for key, value in quantities.items():
        if value % QTY_SCALE:
            raise ValueError(f"{labels.get(key, key)} لا يقبل كسوراً لأن الصنف لا يُباع بالوزن")


def validate_extra_units(base_unit: str, barcode: str | None, units: list) -> None:
    if len(units) > MAX_EXTRA_UNITS:
        raise ValueError(f"الحد الأقصى {MAX_EXTRA_UNITS} وحدات إضافية")
    names = {base_unit}
    barcodes = {barcode} if barcode else set()
    for unit in units:
        if unit.name in names:
            raise ValueError(f"اسم الوحدة «{unit.name}» مكرر")
        names.add(unit.name)
        if unit.barcode:
            if unit.barcode in barcodes:
                raise ValueError(f"الباركود {unit.barcode} مكرر داخل نفس الصنف")
            barcodes.add(unit.barcode)
