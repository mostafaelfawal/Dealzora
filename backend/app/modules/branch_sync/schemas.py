"""طلبات شاشة «تحويلات الفروع». الكميات × 1000 بالوحدة الأساسية والمال بالقروش (قواعد البرنامج)."""

from pydantic import BaseModel, ConfigDict, Field


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ConnectIn(Strict):
    server_url: str = Field(min_length=4, max_length=200)
    code: str = Field(min_length=12, max_length=20)


class RegisterShopIn(Strict):
    """المالك يسجّل محله على سيرفر الفروع بمفتاح ترخيص «سلسلة» (هذا الجهاز = الفرع الرئيسي)."""

    server_url: str = Field(min_length=4, max_length=200)
    license_key: str = Field(min_length=20, max_length=4096)
    branch_name: str = Field("الفرع الرئيسي", min_length=2, max_length=120)
    branch_code: str = Field("MAIN", min_length=1, max_length=12, pattern=r"^[A-Za-z0-9]+$")
    recover: bool = False


class NewBranchIn(Strict):
    name: str = Field(min_length=2, max_length=120)
    code: str = Field(min_length=1, max_length=12, pattern=r"^[A-Za-z0-9]+$")


class BranchPatchIn(Strict):
    name: str | None = Field(None, min_length=2, max_length=120)
    is_active: bool | None = None


class LicenseKeyIn(Strict):
    license_key: str = Field(min_length=20, max_length=4096)


class LineIn(Strict):
    product_id: str = Field(min_length=1, max_length=36)
    qty: int = Field(gt=0, le=1_000_000_000)


class SendIn(Strict):
    to_branch_id: str = Field(min_length=8, max_length=36)
    lines: list[LineIn] = Field(min_length=1, max_length=300)
    note: str | None = Field(None, max_length=300)


class RequestIn(Strict):
    from_branch_id: str = Field(min_length=8, max_length=36)
    lines: list[LineIn] = Field(min_length=1, max_length=300)
    note: str | None = Field(None, max_length=300)


class ApproveLineIn(Strict):
    line_id: str
    qty: int = Field(ge=0, le=1_000_000_000)  # 0 = غير متوفر
    product_id: str | None = Field(None, max_length=36)  # الصنف المحلي لو لم يُطابَق تلقائياً


class ApproveIn(Strict):
    lines: list[ApproveLineIn] = Field(min_length=1, max_length=300)
    note: str | None = Field(None, max_length=300)


class ReceiveLineIn(Strict):
    line_id: str
    qty_received: int = Field(ge=0, le=1_000_000_000)
    product_id: str | None = Field(None, max_length=36)


class ReceiveIn(Strict):
    lines: list[ReceiveLineIn] = Field(min_length=1, max_length=300)
    note: str | None = Field(None, max_length=300)


class RejectIn(Strict):
    reason: str = Field(min_length=2, max_length=300)
