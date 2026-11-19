"""مدخلات شاشة المتجر. التحقق الكامل (الرابط، تنظيف النصوص، الهاتف) على سيرفر الفروع،
وهنا حدود الشكل فقط حتى لا يُرسل للسيرفر ما هو مرفوض بوضوح."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

ImageId = Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{32}$")]
Gid = Annotated[str, StringConstraints(min_length=8, max_length=36, pattern=r"^[0-9A-Za-z-]+$")]
Money = Annotated[int, Field(ge=0, le=10**10)]


class StoreIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slug: Annotated[str, StringConstraints(min_length=3, max_length=40)]
    name: Annotated[str, StringConstraints(min_length=2, max_length=120)]
    tagline: Annotated[str, StringConstraints(max_length=300)] | None = None
    about: Annotated[str, StringConstraints(max_length=1200)] | None = None
    phone: Annotated[str, StringConstraints(max_length=24)]
    whatsapp: Annotated[str, StringConstraints(max_length=24)] | None = None
    city: Annotated[str, StringConstraints(max_length=120)] | None = None
    address: Annotated[str, StringConstraints(max_length=400)] | None = None
    hours: Annotated[str, StringConstraints(max_length=240)] | None = None
    currency: Annotated[str, StringConstraints(min_length=1, max_length=8)] = "ج.م"
    logo_image_id: ImageId | None = None
    is_published: bool = False
    accepting_orders: bool = True
    delivery_fee: Money = 0
    free_delivery_over: Money | None = None
    min_order: Money = 0
    delivery_note: Annotated[str, StringConstraints(max_length=400)] | None = None
    fulfillment_branch_id: Gid | None = None


class ImageIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content_type: Literal["image/webp", "image/jpeg", "image/png"]
    data: Annotated[str, StringConstraints(min_length=16, max_length=900_000)]


class ProductPatchIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_published: bool | None = None
    featured: bool | None = None
    sort_order: Annotated[int, Field(ge=0, le=100_000)] | None = None
    description: Annotated[str, StringConstraints(max_length=2000)] | None = None
    image_id: ImageId | None = None
    gallery: list[ImageId] | None = Field(None, max_length=5)
    max_qty: Annotated[int, Field(ge=1, le=10**9)] | None = None


class ThemeIn(BaseModel):
    """التحقق الكامل (الألوان المسموحة، روابط التواصل) على سيرفر الفروع."""

    model_config = ConfigDict(extra="forbid")

    color: Literal["neutral", "emerald", "teal", "blue", "indigo", "violet", "rose", "orange"] = "neutral"
    mode: Literal["system", "light", "dark"] = "system"
    cover_image_id: ImageId | None = None
    announcement: Annotated[str, StringConstraints(max_length=300)] | None = None
    show_featured: bool = True
    facebook: Annotated[str, StringConstraints(max_length=300)] | None = None
    instagram: Annotated[str, StringConstraints(max_length=300)] | None = None
    tiktok: Annotated[str, StringConstraints(max_length=300)] | None = None


class BulkIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    gids: list[Gid] = Field(min_length=1, max_length=500)
    is_published: bool


class StatusIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["confirmed", "delivering", "delivered", "cancelled"]
    reason: Annotated[str, StringConstraints(max_length=400)] | None = None
    note: Annotated[str, StringConstraints(max_length=600)] | None = None


class NoteIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    note: Annotated[str, StringConstraints(max_length=600)] | None = None
