"""قواعد التحقق القابلة لإعادة الاستخدام (Annotated types).
اسم الملف schema_validation لأن بايثون لا يقبل نقطة في اسم الـ module.
"""

import re
from typing import Annotated

from pydantic import AfterValidator, BeforeValidator, Field

from .constants import (
    MAX_ADDRESS_LEN,
    MAX_MONEY,
    MAX_NAME_LEN,
    MAX_NOTES_LEN,
    MAX_PAYMENT_NOTE_LEN,
    PHONE_PATTERN,
)
from .helper import clean_phone

_PHONE_RE = re.compile(PHONE_PATTERN)


def _clean_name(value: str) -> str:
    value = " ".join(value.split())
    if not value:
        raise ValueError("اسم العميل مطلوب")
    if len(value) > MAX_NAME_LEN:
        raise ValueError(f"اسم العميل أطول من {MAX_NAME_LEN} حرفاً")
    return value


def _empty_to_none(value: object) -> object:
    return None if isinstance(value, str) and not value.strip() else value


def _clean_phone(value: str | None) -> str | None:
    if value is None:
        return None
    value = clean_phone(value)
    if not _PHONE_RE.fullmatch(value):
        raise ValueError("رقم الهاتف غير صالح. أرقام فقط (مثال: 01012345678)")
    return value


def _text(max_len: int, label: str):
    def check(value: str) -> str:
        value = value.strip()
        if len(value) > max_len:
            raise ValueError(f"{label} أطول من {max_len} حرفاً")
        return value

    return AfterValidator(check)


def _clean_optional_note(value: str | None) -> str | None:
    value = (value or "").strip()
    if len(value) > MAX_PAYMENT_NOTE_LEN:
        raise ValueError(f"الملاحظة أطول من {MAX_PAYMENT_NOTE_LEN} حرفاً")
    return value or None


Name = Annotated[str, AfterValidator(_clean_name)]
OptionalPhone = Annotated[
    str | None, BeforeValidator(_empty_to_none), AfterValidator(_clean_phone)
]
Address = Annotated[str, _text(MAX_ADDRESS_LEN, "العنوان")]
Notes = Annotated[str, _text(MAX_NOTES_LEN, "الملاحظات")]
PaymentNote = Annotated[str | None, AfterValidator(_clean_optional_note)]
Money = Annotated[int, Field(ge=0, le=MAX_MONEY)]  # قروش
PositiveMoney = Annotated[int, Field(gt=0, le=MAX_MONEY)]
