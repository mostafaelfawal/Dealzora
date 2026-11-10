"""Pydantic schemas للإعدادات العامة."""

from typing import Annotated

from pydantic import AfterValidator, BaseModel, BeforeValidator, ConfigDict

from app.core.text import collapse_spaces

from .constants import MAX_CURRENCY_CODE, MAX_CURRENCY_NAME, MAX_CURRENCY_SYMBOL, MAX_PATH_LEN


def _required(label: str, max_len: int):
    def clean(value: str) -> str:
        value = collapse_spaces(value)
        if not value:
            raise ValueError(f"{label} مطلوب")
        if len(value) > max_len:
            raise ValueError(f"{label} أطول من {max_len} حرفاً")
        return value

    return clean


def _empty_to_none(value: object) -> object:
    return None if isinstance(value, str) and not value.strip() else value


def _clean_path(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip().strip('"')
    if len(value) > MAX_PATH_LEN:
        raise ValueError(f"المسار أطول من {MAX_PATH_LEN} حرفاً")
    return value


class CurrencyIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: Annotated[str, AfterValidator(_required("رمز العملة", MAX_CURRENCY_CODE))]
    symbol: Annotated[str, AfterValidator(_required("اختصار العملة", MAX_CURRENCY_SYMBOL))]
    name: Annotated[str, AfterValidator(_required("اسم العملة", MAX_CURRENCY_NAME))]


class CurrencyOut(BaseModel):
    code: str
    symbol: str
    name: str


class PublicSettingsOut(BaseModel):
    """ما تحتاجه كل الشاشات (حتى قبل الدخول)."""

    currency: CurrencyOut


class BackupLocationIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # None/فارغ = الرجوع للمجلد الافتراضي.
    path: Annotated[str | None, BeforeValidator(_empty_to_none), AfterValidator(_clean_path)] = None
