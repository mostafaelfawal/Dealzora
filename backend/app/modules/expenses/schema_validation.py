"""قواعد التحقق القابلة لإعادة الاستخدام. نفس قرارات expense.schema.ts في الـ frontend."""

from typing import Annotated

from pydantic import AfterValidator, BeforeValidator

from .constants import MAX_MONEY, MAX_NOTE_LEN


def _check_amount(value: int) -> int:
    if value <= 0:
        raise ValueError("اكتب مبلغاً أكبر من صفر")
    if value > MAX_MONEY:
        raise ValueError("المبلغ كبير جداً")
    return value


def _strip_note(value: object) -> object:
    if isinstance(value, str):
        return value.strip() or None
    return value


def _check_note(value: str | None) -> str | None:
    if value is not None and len(value) > MAX_NOTE_LEN:
        raise ValueError(f"الملاحظة أطول من {MAX_NOTE_LEN} حرفاً")
    return value


Amount = Annotated[int, AfterValidator(_check_amount)]  # قروش، > 0
Note = Annotated[str | None, BeforeValidator(_strip_note), AfterValidator(_check_note)]