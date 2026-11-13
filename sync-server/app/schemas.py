"""شكل الطلبات والردود. المال بالقروش والكميات × 1000 (نفس قواعد البرنامج المحلي)."""

from datetime import date, datetime
from enum import StrEnum
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

UUID_RE = r"^[0-9a-fA-F-]{8,36}$"


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ================= الإدارة =================
class ShopIn(Strict):
    name: str = Field(min_length=2, max_length=120)


class ShopPatch(Strict):
    name: str | None = Field(None, min_length=2, max_length=120)
    is_active: bool | None = None


class BranchIn(Strict):
    name: str = Field(min_length=2, max_length=120)
    code: str = Field(min_length=1, max_length=12, pattern=r"^[A-Za-z0-9]+$")

    @field_validator("code")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.upper()


class BranchPatch(Strict):
    name: str | None = Field(None, min_length=2, max_length=120)
    is_active: bool | None = None


class BranchOut(BaseModel):
    id: str
    shop_id: str
    name: str
    code: str
    is_active: bool
    last_seen_at: datetime | None
    last_pushed_seq: int
    acked_seq: int


class BranchCredentials(BaseModel):
    """يُعرض مرة واحدة عند الإنشاء أو تغيير السر. يُدخَل في البرنامج المحلي للفرع."""

    branch: BranchOut
    branch_id: str
    secret: str


class ShopOut(BaseModel):
    id: str
    name: str
    is_active: bool
    last_seq: int
    created_at: datetime
    branches: list[BranchOut]


# ================= التوثيق =================
class TokenIn(Strict):
    branch_id: str = Field(pattern=UUID_RE)
    secret: str = Field(min_length=20, max_length=200)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    branch_id: str
    shop_id: str


class PairingCodeOut(BaseModel):
    """الكود يظهر مرة واحدة: يكتبه المالك في برنامج الفرع خلال مدة صلاحيته."""

    branch_id: str
    branch_name: str
    code: str
    expires_at: datetime


class PairIn(Strict):
    code: str = Field(min_length=12, max_length=20)


class PairOut(BaseModel):
    """بيانات الدخول الدائمة للجهاز (تُحفظ مشفّرة في البرنامج المحلي، ولا تُعرض مرة أخرى)."""

    branch_id: str
    secret: str
    branch_name: str
    branch_code: str
    shop_id: str
    shop_name: str


# ================= دليل الفروع =================
class BranchPublicOut(BaseModel):
    """ما يراه فرع عن باقي فروع محله (بدون أي بيانات دخول)."""

    id: str
    name: str
    code: str
    is_active: bool
    online: bool
    last_seen_at: datetime | None
    is_me: bool


# ================= المزامنة =================
class EventIn(Strict):
    """حدث من outbox الفرع كما هو. id = معرّف الحدث محلياً (UUID) فيمنع التكرار."""

    id: str = Field(pattern=UUID_RE)
    entity: str = Field(min_length=1, max_length=40)
    entity_id: str = Field(min_length=1, max_length=64)
    op: str = Field(min_length=1, max_length=16)
    payload: dict[str, Any]
    base_version: int | None = None
    created_at: datetime | None = None
    # فارغ = لكل فروع المحل. أو id فرع واحد من نفس المحل (خصوصية بين الفروع).
    target_branch_id: str | None = Field(None, pattern=UUID_RE)


class PushIn(Strict):
    events: list[EventIn] = Field(min_length=1)


class PushOut(BaseModel):
    accepted: int
    duplicates: int
    last_seq: int


class EventOut(BaseModel):
    id: str
    seq: int
    branch_id: str
    entity: str
    entity_id: str
    op: str
    payload: dict[str, Any]
    base_version: int | None
    created_at: datetime | None
    received_at: datetime
    target_branch_id: str | None


class PullOut(BaseModel):
    events: list[EventOut]
    # استخدمه في الطلب التالي (after). يتقدّم حتى لو تخطّينا أحداث فرعك.
    next_after: int
    has_more: bool
    last_seq: int


class AckIn(Strict):
    seq: int = Field(ge=0)


class SyncStatusOut(BaseModel):
    shop_id: str
    branch_id: str
    last_seq: int
    my_last_pushed_seq: int
    my_acked_seq: int
    branches: list[BranchOut]


# ================= التحويلات =================
class TransferStatus(StrEnum):
    REQUESTED = "requested"  # فرع الاستلام طلب، وفي انتظار فرع الإرسال
    REJECTED = "rejected"  # فرع الإرسال رفض الطلب
    WITHDRAWN = "withdrawn"  # صاحب الطلب سحبه قبل الرد
    SENT = "sent"  # في الطريق
    RECEIVED = "received"
    PARTIAL = "partial"  # استُلم بعجز
    CANCELLED = "cancelled"  # فرع الإرسال ألغاه قبل الاستلام


class TransferLineIn(Strict):
    product_id: str = Field(min_length=1, max_length=36)
    barcode: str | None = Field(None, max_length=32)
    name: str = Field(min_length=1, max_length=200)
    unit: str = Field(min_length=1, max_length=30)
    qty: int = Field(gt=0, le=1_000_000_000)
    unit_cost: int = Field(0, ge=0, le=1_000_000_000)
    batch_no: str | None = Field(None, max_length=40)
    expiry_date: date | None = None


class TransferIn(Strict):
    id: str = Field(pattern=UUID_RE)
    to_branch_id: str = Field(pattern=UUID_RE)
    lines: list[TransferLineIn] = Field(min_length=1, max_length=500)
    note: str | None = Field(None, max_length=300)
    sent_by: str | None = Field(None, max_length=80)


class RequestLineIn(Strict):
    product_id: str = Field(min_length=1, max_length=36)
    barcode: str | None = Field(None, max_length=32)
    name: str = Field(min_length=1, max_length=200)
    unit: str = Field(min_length=1, max_length=30)
    qty: int = Field(gt=0, le=1_000_000_000)


class TransferRequestIn(Strict):
    """فرعك يطلب بضاعة من فرع آخر."""

    id: str = Field(pattern=UUID_RE)
    from_branch_id: str = Field(pattern=UUID_RE)
    lines: list[RequestLineIn] = Field(min_length=1, max_length=500)
    note: str | None = Field(None, max_length=300)
    requested_by: str | None = Field(None, max_length=80)


class ApproveLineIn(Strict):
    line_id: str
    qty: int = Field(ge=0, le=1_000_000_000)  # 0 = غير متوفر
    unit_cost: int = Field(0, ge=0, le=1_000_000_000)
    batch_no: str | None = Field(None, max_length=40)
    expiry_date: date | None = None


class ApproveIn(Strict):
    """الموافقة على طلب وإرساله بالكميات الفعلية. الأسطر غير المذكورة = الكمية المطلوبة بتكلفة 0."""

    lines: list[ApproveLineIn] = Field(default_factory=list, max_length=500)
    note: str | None = Field(None, max_length=300)
    sent_by: str | None = Field(None, max_length=80)


class RejectIn(Strict):
    reason: str = Field(min_length=2, max_length=300)


class ReceiveLineIn(Strict):
    line_id: str
    qty_received: int = Field(ge=0, le=1_000_000_000)


class ReceiveIn(Strict):
    # الأسطر غير المذكورة = استُلمت كاملة.
    lines: list[ReceiveLineIn] = Field(default_factory=list, max_length=500)
    note: str | None = Field(None, max_length=300)
    received_by: str | None = Field(None, max_length=80)


class TransferLineOut(BaseModel):
    id: str
    product_id: str
    barcode: str | None
    name: str
    unit: str
    qty_requested: int | None
    qty_sent: int
    qty_received: int | None
    unit_cost: int
    batch_no: str | None
    expiry_date: date | None


class TransferOut(BaseModel):
    id: str
    number: int
    from_branch_id: str
    from_branch_name: str
    to_branch_id: str
    to_branch_name: str
    status: TransferStatus
    note: str | None
    receive_note: str | None
    sent_by: str | None
    received_by: str | None
    requested_by: str | None
    requested_at: datetime | None
    rejected_at: datetime | None
    reject_reason: str | None
    sent_at: datetime | None
    received_at: datetime | None
    cancelled_at: datetime | None
    version: int
    total_cost: int
    shortage_cost: int
    lines: list[TransferLineOut]


class TransferListOut(BaseModel):
    items: list[TransferOut]
    total: int


# ================= الملخصات اليومية =================
class DailyStatIn(Strict):
    data: dict[str, Any]


class DailyStatOut(BaseModel):
    branch_id: str
    day: date
    data: dict[str, Any]
    updated_at: datetime


# ================= السجل الأمني =================
class AuditOut(BaseModel):
    id: int
    at: datetime
    actor: str
    action: str
    shop_id: str | None
    branch_id: str | None
    ip: str | None
    details: dict[str, Any] | None


# ================= التسجيل الذاتي وإدارة المالك =================
class RegisterIn(Strict):
    """مالك بترخيص «سلسلة» يسجّل محله، أو يسترجعه على جهاز جديد (recover)."""

    license_key: str = Field(min_length=20, max_length=4096)
    shop_name: str | None = Field(None, min_length=2, max_length=120)
    branch_name: str = Field("الفرع الرئيسي", min_length=2, max_length=120)
    branch_code: str = Field("MAIN", min_length=1, max_length=12, pattern=r"^[A-Za-z0-9]+$")
    recover: bool = False

    @field_validator("branch_code")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.upper()


class LicenseIn(Strict):
    license_key: str = Field(min_length=20, max_length=4096)


class ShopInfoOut(BaseModel):
    shop_id: str
    shop_name: str
    is_admin: bool
    license_plan: str | None
    license_expires_at: datetime | None
    branches: int
    max_branches: int


class AdminBranchOut(BaseModel):
    id: str
    name: str
    code: str
    is_active: bool
    is_admin: bool
    is_me: bool
    online: bool
    paired: bool  # فيه جهاز مربوط حالياً
    last_seen_at: datetime | None


class NewBranchOut(BaseModel):
    branch: AdminBranchOut
    pairing: PairingCodeOut


class LeaseOut(BaseModel):
    """شهادة الفرع الموقّعة: البرنامج يتحقق منها بالمفتاح العام المثبّت فيه."""

    lease: str
    plan: str
    expires_at: datetime


# ================= إدارة الموظفين المركزية (المالك) =================
_USERNAME = r"^[a-z0-9._\-]{3,50}$"
_HASH = r"^\$argon2id\$"
_BRANCH_ID = r"^[0-9A-Za-z-]{8,36}$"


class StaffIn(Strict):
    """كلمة المرور لا تصل هنا: التجزئة (Argon2id) من البرنامج المحلي للمالك."""

    username: str = Field(pattern=_USERNAME)
    password_hash: str = Field(min_length=40, max_length=255, pattern=_HASH)
    role: Literal["manager", "cashier"]
    is_active: bool = True
    branches: list[Annotated[str, Field(pattern=_BRANCH_ID)]] = Field(min_length=1, max_length=50)


class StaffPatch(Strict):
    username: str | None = Field(None, pattern=_USERNAME)
    password_hash: str | None = Field(None, min_length=40, max_length=255, pattern=_HASH)
    role: Literal["manager", "cashier"] | None = None
    is_active: bool | None = None
    branches: list[Annotated[str, Field(pattern=_BRANCH_ID)]] | None = Field(None, min_length=1, max_length=50)


class StaffOut(BaseModel):
    """بدون تجزئة كلمة المرور."""

    id: str
    username: str
    role: str
    is_active: bool
    branches: list[str]
    updated_at: datetime | None
    updated_by_branch_id: str | None
