"""Pydantic schemas للإعدادات العامة."""

from typing import Annotated

from pydantic import AfterValidator, BaseModel, BeforeValidator, ConfigDict, Field, model_validator

from app.core.text import collapse_spaces

from .constants import (
    MAX_CURRENCY_CODE,
    MAX_CURRENCY_NAME,
    MAX_CURRENCY_SYMBOL,
    MAX_PATH_LEN,
)
from .scale import ScaleBarcodeConfig
from .payments import (
    MAX_COUNTRY_LEN,
    MAX_METHOD_ACCOUNT,
    MAX_METHOD_NAME,
    MAX_METHODS,
    METHOD_ID_RE,
    RESERVED_IDS,
    PaymentKind,
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


def _method_id(value: str) -> str:
    value = value.strip().lower()
    if not METHOD_ID_RE.match(value) or value in RESERVED_IDS:
        raise ValueError("معرّف طريقة الدفع غير صالح")
    return value


def _account(value: str | None) -> str | None:
    if value is None:
        return None
    value = collapse_spaces(value.translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")))
    if len(value) > MAX_METHOD_ACCOUNT:
        raise ValueError(f"رقم الحساب أطول من {MAX_METHOD_ACCOUNT} حرفاً")
    return value or None


def _country(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip().upper()
    if not value.isalpha() or len(value) > MAX_COUNTRY_LEN:
        raise ValueError("رمز الدولة غير صالح")
    return value


class PaymentMethodIn(BaseModel):
    """طريقة دفع إلكتروني (من قالب الدولة أو مضافة يدوياً)."""

    model_config = ConfigDict(extra="forbid")

    id: Annotated[str, AfterValidator(_method_id)]
    name: Annotated[str, AfterValidator(_required("اسم طريقة الدفع", MAX_METHOD_NAME))]
    kind: PaymentKind = PaymentKind.WALLET
    # رقم المحفظة / IBAN / عنوان الدفع يظهر للكاشير ليمليه على العميل. اختياري (نقطة البيع لا تحتاجه).
    account: Annotated[str | None, BeforeValidator(_empty_to_none), AfterValidator(_account)] = None
    enabled: bool = True


class PaymentMethodOut(BaseModel):
    id: str
    name: str
    kind: PaymentKind
    account: str | None
    enabled: bool


class PaymentConfigIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # دولة القوالب (ISO مثل EG/SA). None = لم تُختر بعد.
    country: Annotated[str | None, BeforeValidator(_empty_to_none), AfterValidator(_country)] = None
    methods: list[PaymentMethodIn] = Field(default_factory=list, max_length=MAX_METHODS)

    @model_validator(mode="after")
    def _unique(self):
        ids = [m.id for m in self.methods]
        if len(ids) != len(set(ids)):
            raise ValueError("طريقة الدفع مكررة")
        names = [m.name for m in self.methods]
        if len(names) != len(set(names)):
            raise ValueError("يوجد طريقتا دفع بنفس الاسم")
        return self


class PaymentConfigOut(BaseModel):
    country: str | None
    methods: list[PaymentMethodOut]


class DiscountLimitIn(BaseModel):
    """حد خصم الكاشير. enabled=False = الكاشير يخصم بلا حد."""

    model_config = ConfigDict(extra="forbid")

    enabled: bool
    max_percent: int = Field(ge=0, le=100)


class DiscountLimitOut(BaseModel):
    enabled: bool
    max_percent: int


class PublicSettingsOut(BaseModel):
    """ما تحتاجه كل الشاشات (حتى قبل الدخول)."""

    currency: CurrencyOut
    payments: PaymentConfigOut
    discount_limit: DiscountLimitOut
    scale_barcode: ScaleBarcodeConfig


class BackupLocationIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # None/فارغ = الرجوع للمجلد الافتراضي.
    path: Annotated[str | None, BeforeValidator(_empty_to_none), AfterValidator(_clean_path)] = None
