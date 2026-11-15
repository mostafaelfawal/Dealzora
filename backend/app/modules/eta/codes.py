"""جداول أكواد المنظومة: بيانات ثابتة من الـ SDK في مجلد codes/ (المصدر والبصمة في codes/SOURCE.md).

تُقرأ مرة واحدة عند أول طلب. الملفات مضمّنة في نسخة الـ exe (--add-data في build-backend.ps1).
أسماء الحقول تختلف حالتها بين ملفات المصدر (code/Code، desc_en/Desc_en)، فنوحّدها هنا عند القراءة.
"""

import json
from dataclasses import dataclass
from enum import StrEnum
from functools import lru_cache
from pathlib import Path

from .constants import UNIT_SUGGESTIONS

_DIR = Path(__file__).parent / "codes"


class CodeTable(StrEnum):
    UNITS = "units"
    ACTIVITIES = "activities"
    TAX_TYPES = "tax_types"
    NON_TAXABLE_TAX_TYPES = "non_taxable_tax_types"
    TAX_SUBTYPES = "tax_subtypes"
    PAYMENT_METHODS = "payment_methods"
    BUYER_TYPES = "buyer_types"


_FILES: dict[CodeTable, str] = {
    CodeTable.UNITS: "UnitTypes.json",
    CodeTable.ACTIVITIES: "ActivityCodes.json",
    CodeTable.TAX_TYPES: "TaxTypes.json",
    CodeTable.NON_TAXABLE_TAX_TYPES: "NonTaxableTaxTypes.json",
    CodeTable.TAX_SUBTYPES: "TaxSubtypes.json",
    CodeTable.PAYMENT_METHODS: "PaymentMethods.json",
    CodeTable.BUYER_TYPES: "BuyerTypes.json",
}


@dataclass(frozen=True, slots=True)
class CodeEntry:
    code: str
    desc_en: str
    desc_ar: str
    ref: str | None = None  # TaxSubtypes: نوع الضريبة الأب (TaxtypeReference)


def _field(row: dict, name: str) -> str:
    for key in (name, name.capitalize(), name[:1].upper() + name[1:]):
        if key in row and row[key] is not None:
            return str(row[key]).strip()
    return ""


@lru_cache
def table(name: CodeTable) -> tuple[CodeEntry, ...]:
    """الجدول بترتيب المصدر. الكود المكرر في المصدر (ST في الوحدات) يُؤخذ أول ظهور له."""
    rows = json.loads((_DIR / _FILES[name]).read_text(encoding="utf-8-sig"))
    seen: set[str] = set()
    out: list[CodeEntry] = []
    for row in rows:
        code = _field(row, "code")
        if not code or code in seen:
            continue
        seen.add(code)
        ref = row.get("TaxtypeReference")
        out.append(CodeEntry(code, _field(row, "desc_en"), _field(row, "desc_ar"), str(ref) if ref else None))
    return tuple(out)


@lru_cache
def codes(name: CodeTable) -> frozenset[str]:
    return frozenset(e.code for e in table(name))


def is_valid(name: CodeTable, code: str | None) -> bool:
    return bool(code) and code in codes(name)


def suggest_unit_code(unit_name: str) -> str | None:
    """اقتراح كود لاسم وحدة شائع (يُعرض للمدير ولا يُحفظ تلقائياً)."""
    code = UNIT_SUGGESTIONS.get(unit_name.strip())
    return code if code and is_valid(CodeTable.UNITS, code) else None
