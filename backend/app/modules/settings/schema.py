"""Pydantic schemas للإعدادات العامة."""

from typing import Annotated

from pydantic import AfterValidator, BaseModel, BeforeValidator, ConfigDict, Field

from app.core.text import collapse_spaces

from .constants import (
    MAX_CURRENCY_CODE,
    MAX_CURRENCY_NAME,
    MAX_CURRENCY_SYMBOL,
    MAX_PATH_LEN,
    MAX_WALLET_ACCOUNT,
)


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


def _vodafone_number(value: str | None) -> str | None:
    """رقم محفظة مصري: 11 رقماً يبدأ بـ 01 (نقبل الأرقام العربية والمسافات)."""
    if value is None:
        return None
    digits = value.translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")).replace(" ", "").replace("-", "")
    if not (len(digits) == 11 and digits.startswith("01") and digits.isdigit()):
        raise ValueError("رقم فودافون كاش يجب أن يكون 11 رقماً ويبدأ بـ 01")
    return digits


def _instapay_address(value: str | None) -> str | None:
    if value is None:
        return None
    value = collapse_spaces(value)
    if len(value) > MAX_WALLET_ACCOUNT:
        raise ValueError(f"عنوان إنستاباي أطول من {MAX_WALLET_ACCOUNT} حرفاً")
    return value or None


class PaymentAccountsIn(BaseModel):
    """حسابات المحل للدفع الإلكتروني. الفارغ يوقف الطريقة في الكاشير."""

    model_config = ConfigDict(extra="forbid")

    vodafone_cash: Annotated[
        str | None, BeforeValidator(_empty_to_none), AfterValidator(_vodafone_number)
    ] = None
    instapay: Annotated[
        str | None, BeforeValidator(_empty_to_none), AfterValidator(_instapay_address)
    ] = Field(None, description="عنوان الدفع (name@instapay) أو رقم الموبايل")


class PaymentAccountsOut(BaseModel):
    vodafone_cash: str | None
    instapay: str | None


class PublicSettingsOut(BaseModel):
    """ما تحتاجه كل الشاشات (حتى قبل الدخول)."""

    currency: CurrencyOut
    payments: PaymentAccountsOut


class BackupLocationIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # None/فارغ = الرجوع للمجلد الافتراضي.
    path: Annotated[str | None, BeforeValidator(_empty_to_none), AfterValidator(_clean_path)] = None
