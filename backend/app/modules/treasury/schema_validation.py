from typing import Annotated

from pydantic import AfterValidator, BeforeValidator

from .constants import MAX_MONEY, MAX_NOTE_LEN


def _check_amount(value: int) -> int:
    if value <= 0:
        raise ValueError("اكتب مبلغاً أكبر من صفر")
    if value > MAX_MONEY:
        raise ValueError("المبلغ كبير جداً")
    return value


def _strip(value: object) -> object:
    return (value.strip() or None) if isinstance(value, str) else value


def _check_required_note(value: str | None) -> str:
    if not value:
        raise ValueError("اكتب سبب الحركة")
    if len(value) > MAX_NOTE_LEN:
        raise ValueError(f"الملاحظة أطول من {MAX_NOTE_LEN} حرفاً")
    return value


Amount = Annotated[int, AfterValidator(_check_amount)]
RequiredNote = Annotated[str, BeforeValidator(_strip), AfterValidator(_check_required_note)]