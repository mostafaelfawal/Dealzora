"""Pydantic schemas لمنظومة الإيصال الإلكتروني. الحدود من constants (منقولة من الـ SDK)."""

from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field

from .constants import (
    ADDRESS_COUNTRY,
    MAX_ACTIVITY_CODE,
    MAX_ADDITIONAL_INFO,
    MAX_BRANCH_CODE,
    MAX_BUILDING_NUMBER,
    MAX_CLIENT_ID,
    MAX_CLIENT_SECRET,
    MAX_FLOOR,
    MAX_GOVERNATE,
    MAX_LANDMARK,
    MAX_POS_MODEL_FRAMEWORK,
    MAX_POS_OS_VERSION,
    MAX_POS_SERIAL,
    MAX_POSTAL_CODE,
    MAX_PRESHARED_KEY,
    MAX_REGION_CITY,
    MAX_RIN,
    MAX_ROOM,
    MAX_STREET,
    MAX_TRADE_NAME,
    MAX_UNIT_TYPE,
    EtaEnvironment,
)


def _clean(value: object) -> object:
    """نص بلا مسافات زائدة، والفارغ = None."""
    if isinstance(value, str):
        value = " ".join(value.split())
        return value or None
    return value


def Text(max_len: int):  # noqa: N802 - نوع مُعاد استخدامه
    return Annotated[Annotated[str, Field(max_length=max_len)] | None, BeforeValidator(_clean)]


# ================= إعدادات المحل =================
class EtaConfig(BaseModel):
    """seller في الإيصال: rin ← rin ، company_trade_name ← companyTradeName ، activity_code ← activityCode."""

    model_config = ConfigDict(extra="forbid")

    enabled: bool = False
    environment: EtaEnvironment = EtaEnvironment.PREPROD
    rin: Text(MAX_RIN) = None
    company_trade_name: Text(MAX_TRADE_NAME) = None
    activity_code: Text(MAX_ACTIVITY_CODE) = None


# ================= الفرع (هذا الجهاز الأساسي = فرع) =================
class EtaBranch(BaseModel):
    """branchCode و branchAddress في الإيصال (الحقول بنفس معناها في جدول BranchAddress)."""

    model_config = ConfigDict(extra="forbid")

    branch_code: Text(MAX_BRANCH_CODE) = None
    country: str = Field(ADDRESS_COUNTRY, pattern=r"^[A-Z]{2}$")
    governate: Text(MAX_GOVERNATE) = None
    region_city: Text(MAX_REGION_CITY) = None
    street: Text(MAX_STREET) = None
    building_number: Text(MAX_BUILDING_NUMBER) = None
    postal_code: Text(MAX_POSTAL_CODE) = None
    floor: Text(MAX_FLOOR) = None
    room: Text(MAX_ROOM) = None
    landmark: Text(MAX_LANDMARK) = None
    additional_information: Text(MAX_ADDITIONAL_INFO) = None


# ================= الأجهزة =================
class SecretAction(StrEnum):
    KEEP = "keep"  # لا تغيير (الافتراضي: الواجهة لا تعرف القيمة الحالية أصلاً)
    SET = "set"
    CLEAR = "clear"


class DeviceProfileIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pos_serial: Text(MAX_POS_SERIAL) = None
    pos_os_version: Text(MAX_POS_OS_VERSION) = None
    pos_model_framework: Text(MAX_POS_MODEL_FRAMEWORK) = None
    client_id: Text(MAX_CLIENT_ID) = None
    client_secret_action: SecretAction = SecretAction.KEEP
    client_secret: str | None = Field(None, min_length=1, max_length=MAX_CLIENT_SECRET)
    preshared_key_action: SecretAction = SecretAction.KEEP
    preshared_key: str | None = Field(None, min_length=1, max_length=MAX_PRESHARED_KEY)


class SecretState(StrEnum):
    UNSET = "unset"
    SET = "set"
    UNREADABLE = "unreadable"  # مخزّن لكن تعذّر فكه (مفتاح مختلف): يحتاج إعادة إدخال


class DeviceProfileOut(BaseModel):
    """لا تحتوي أي سر: فقط حالته."""

    device_id: str
    name: str
    is_main: bool
    pos_serial: str | None
    pos_os_version: str | None
    pos_model_framework: str | None
    client_id: str | None
    client_secret: SecretState
    preshared_key: SecretState


# ================= الوحدات =================
class UnitMappingIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    eta_unit_type: Text(MAX_UNIT_TYPE) = None


class UnitMappingOut(BaseModel):
    id: str
    name: str
    eta_unit_type: str | None
    suggested: str | None  # اقتراح لاسم شائع (لا يُحفظ تلقائياً)
    product_count: int


# ================= جداول الأكواد =================
class CodeOut(BaseModel):
    code: str
    desc_en: str
    desc_ar: str
    ref: str | None = None


# ================= الجاهزية =================
class ReadinessSeverity(StrEnum):
    BLOCKER = "blocker"  # يمنع التفعيل
    WARNING = "warning"  # تنبيه فقط


class ReadinessSection(StrEnum):
    TAX = "tax"
    SHOP = "shop"
    BRANCH = "branch"
    DEVICES = "devices"
    UNITS = "units"
    PRODUCTS = "products"


class ReadinessItem(BaseModel):
    key: str  # ثابت للواجهة (مثل shop.rin أو device.<id>.client_secret)
    section: ReadinessSection
    severity: ReadinessSeverity
    title: str
    detail: str | None = None
    count: int | None = None
    samples: list[str] = Field(default_factory=list)  # أمثلة (أسماء أصناف/وحدات/أجهزة)
    ref_id: str | None = None  # الجهاز/الوحدة المعنية


class ReadinessOut(BaseModel):
    ready: bool  # لا بنود مانعة
    blockers: int
    warnings: int
    items: list[ReadinessItem]
