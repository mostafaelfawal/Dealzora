"""أنواع التحقق القابلة لإعادة الاستخدام في Pydantic (Annotated types) بدل تكرار _clean_* في كل موديول.

أمثلة:
    Name = required_text("اسم العميل", MAX_NAME_LEN)
    Address = limited_text("العنوان", MAX_ADDRESS_LEN)
    OptionalNotes = optional_text("الملاحظات", MAX_NOTES_LEN)
    OptionalPhone = optional_phone(PHONE_PATTERN, "رقم الهاتف غير صالح")
"""

import re
from typing import Annotated

from pydantic import AfterValidator, BeforeValidator, Field

from .constants import MAX_MONEY
from .text import clean_phone, collapse_spaces


def empty_to_none(value: object) -> object:
    """نص فارغ/مسافات فقط → None، وغير ذلك يُنظَّف من أطرافه."""
    return (value.strip() or None) if isinstance(value, str) else value


def required_text(label: str, max_len: int, *, required_message: str | None = None):
    """نص إلزامي: يوحّد المسافات، لا يقبل الفارغ ولا الأطول من الحد."""

    def check(value: str) -> str:
        value = collapse_spaces(value)
        if not value:
            raise ValueError(required_message or f"{label} مطلوب")
        if len(value) > max_len:
            raise ValueError(f"{label} أطول من {max_len} حرفاً")
        return value

    return Annotated[str, AfterValidator(check)]


def limited_text(label: str, max_len: int):
    """نص اختياري بقيمة افتراضية (غير None): يُقصّ ويُفحص طوله فقط."""

    def check(value: str) -> str:
        value = value.strip()
        if len(value) > max_len:
            raise ValueError(f"{label} أطول من {max_len} حرفاً")
        return value

    return Annotated[str, AfterValidator(check)]


def optional_text(label: str, max_len: int):
    """نص يقبل None؛ الفارغ يتحول إلى None."""

    def check(value: str | None) -> str | None:
        if value is not None and len(value) > max_len:
            raise ValueError(f"{label} أطول من {max_len} حرفاً")
        return value

    return Annotated[str | None, BeforeValidator(empty_to_none), AfterValidator(check)]


def optional_phone(pattern: str, message: str):
    """هاتف اختياري: يُنظَّف (أرقام لاتينية بدون مسافات) ثم يُطابَق على النمط."""
    regex = re.compile(pattern)

    def check(value: str | None) -> str | None:
        if value is None:
            return None
        value = clean_phone(value)
        if not regex.fullmatch(value):
            raise ValueError(message)
        return value

    return Annotated[str | None, BeforeValidator(empty_to_none), AfterValidator(check)]


# ---- المال بالقروش ----
Money = Annotated[int, Field(ge=0, le=MAX_MONEY)]
PositiveMoney = Annotated[int, Field(gt=0, le=MAX_MONEY)]


def _check_amount(value: int) -> int:
    if value <= 0:
        raise ValueError("اكتب مبلغاً أكبر من صفر")
    if value > MAX_MONEY:
        raise ValueError("المبلغ كبير جداً")
    return value


Amount = Annotated[int, AfterValidator(_check_amount)]  # نفس PositiveMoney برسائل عربية