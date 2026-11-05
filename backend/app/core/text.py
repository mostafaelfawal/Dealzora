"""دوال نصوص نقية (بدون قاعدة بيانات ولا HTTP): تطبيع العربي للبحث، الأرقام، الهواتف."""

import re
from collections.abc import Iterable

_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "0123456789" * 2)
_DIACRITICS = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]")
_LETTERS = str.maketrans(
    {"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ة": "ه", "ؤ": "و", "ئ": "ي"}
)
_PHONE_NOISE = re.compile(r"[\s\-()]")


def normalize_digits(text: str) -> str:
    """أرقام عربية/فارسية → لاتينية."""
    return text.translate(_DIGITS)


def collapse_spaces(text: str) -> str:
    """يحذف المسافات الزائدة ويوحّد الفواصل بينها."""
    return " ".join(text.split())


def normalize_search(text: str) -> str:
    """توحيد النص العربي للبحث: أرقام، تشكيل، ألف/ياء/تاء مربوطة."""
    text = normalize_digits(text)
    text = _DIACRITICS.sub("", text).translate(_LETTERS)
    return collapse_spaces(text.casefold())


def escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def clean_phone(text: str) -> str:
    """أرقام لاتينية بدون مسافات أو شرطات أو أقواس."""
    return _PHONE_NOISE.sub("", normalize_digits(text))


def build_search_text(text: str | None, extras: Iterable[str | None] = ()) -> str:
    """عمود search_text: النص الأساسي مُطبَّع + قيم إضافية جاهزة (باركود، هاتف...)."""
    parts = [normalize_search(text or ""), *extras]
    return " ".join(p for p in parts if p)