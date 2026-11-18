"""المتجر الإلكتروني للمحل («سلسلة» فقط): إدارة المالك من الجهاز الرئيسي + مخزون فرع التجهيز.

- الإدارة كلها من الفرع الرئيسي (is_admin) وبخطة مسموحة (store_plans)، مثل إدارة الفروع.
- الأصناف تأتي من كتالوج المحل المشترك (CatalogItem). المالك يختار ما يُعرض، والاسم والسعر والتصنيف
  تُقرأ من الكتالوج دائماً: تعديل السعر في البرنامج يظهر في المتجر مع أول مزامنة.
- المخزون: فرع التجهيز يرفع كميات الأصناف المعروضة فقط (لا مخزون المحل كاملاً). المتاح للبيع =
  المخزون المرفوع − الكميات في الطلبات المفتوحة (لم تُسلَّم ولم تُلغَ).
- الصور: يضغطها البرنامج قبل الرفع، وهنا يُتحقق من نوعها الفعلي (البايتات الأولى) وحجمها، وتُخدم
  بنوعها الصحيح مع nosniff وسياسة محتوى مغلقة (لا يمكن تمرير HTML أو SVG على أنه صورة).
- كل استعلام مقيّد بـ shop_id المتصل: لا يرى محل أصناف أو طلبات محل آخر، ومعرّف لمحل آخر = «غير موجود».
"""

import base64
import binascii
import re
import secrets
import unicodedata
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationInfo, field_validator
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..audit import record
from ..config import get_settings
from ..db import utcnow
from ..errors import BadRequest, Conflict, Forbidden, NotFound
from ..models import Branch, CatalogItem, Shop, Store, StoreImage, StoreOrder, StoreProduct
from ..security import Caller

REQUIRED_PLAN = "enterprise"
OPEN_STATUSES = ("new", "confirmed", "delivering")
STATUSES = (*OPEN_STATUSES, "delivered", "cancelled")
# الانتقالات المسموحة للمالك. الإلغاء ممكن قبل التسليم فقط.
TRANSITIONS: dict[str, set[str]] = {
    "new": {"confirmed", "cancelled"},
    "confirmed": {"delivering", "cancelled"},
    "delivering": {"delivered", "cancelled"},
}

# slug: حروف إنجليزية صغيرة وأرقام وشرطة واحدة بين الكلمات (3–40). مثال: super-market-elbaraka
SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,39}$")
# مسارات واجهة المتجر نفسها وأسماء قد تُستغل للخداع.
RESERVED_SLUGS = frozenset(
    {
        "v1", "v2", "api", "admin", "app", "www", "store", "stores", "shop", "shops", "static", "assets",
        "_next", "next", "health", "docs", "login", "auth", "account", "accounts", "cart", "checkout",
        "order", "orders", "track", "help", "support", "about", "terms", "privacy", "contact", "blog",
        "dealzora", "official", "security", "billing", "pay", "payment", "favicon-ico", "robots-txt",
        "sitemap", "sitemap-xml", "null", "undefined", "test", "demo",
    }
)  # fmt: skip

IMAGE_ID_RE = r"^[0-9a-f]{32}$"
ImageId = Annotated[str, StringConstraints(pattern=IMAGE_ID_RE)]
Gid = Annotated[str, StringConstraints(min_length=8, max_length=36, pattern=r"^[0-9A-Za-z-]+$")]
Money = Annotated[int, Field(ge=0, le=10**10)]
_CONTROL = re.compile(r"[\u0000-\u0008\u000b-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]")


def clean_text(value: str | None, *, multiline: bool = False) -> str | None:
    """نص آمن للعرض: بلا محارف تحكم أو اتجاه مخفية (تُستخدم لتزوير النص)، ومسافات موحّدة. فارغ ← None."""
    if value is None:
        return None
    text = unicodedata.normalize("NFC", value)
    text = _CONTROL.sub("", text)
    if multiline:
        lines = [" ".join(line.split()) for line in text.replace("\r", "").split("\n")]
        text = "\n".join(lines).strip()
        text = re.sub(r"\n{3,}", "\n\n", text)
    else:
        text = " ".join(text.split())
    return text or None


def normalize_phone(raw: str | None) -> str | None:
    """أرقام فقط (مع + في البداية اختيارياً)، 8–15 رقماً. الأرقام العربية تُحوَّل."""
    if raw is None:
        return None
    text = raw.strip().translate(str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789"))
    if not text:
        return None
    plus = text.startswith("+")
    digits = re.sub(r"[\s\-().]", "", text.lstrip("+"))
    if not digits.isdigit() or not 8 <= len(digits) <= 15:
        raise ValueError("رقم الهاتف غير صحيح")
    return ("+" if plus else "") + digits


def _aware(value: datetime | None) -> datetime | None:
    return value if value is None or value.tzinfo else value.replace(tzinfo=UTC)


# ================= الخطة والصلاحية =================
def shop_plan(shop: Shop) -> str:
    return shop.license_plan or get_settings().legacy_shop_plan


def shop_live(shop: Shop) -> bool:
    """المحل نشط وترخيصه ساري (بالمهلة) وخطته تسمح بالمتجر: غير ذلك المتجر لا يظهر للزوار."""
    settings = get_settings()
    if not shop.is_active or shop_plan(shop) not in settings.store_plans:
        return False
    expires = _aware(shop.license_expires_at)
    return expires is None or utcnow() <= expires + timedelta(days=settings.license_grace_days)


def owner(session: Session, caller: Caller) -> Shop:
    """الجهاز الرئيسي للمالك فقط، وبخطة «سلسلة»."""
    branch = session.get(Branch, caller.branch_id)
    shop = session.get(Shop, caller.shop_id)
    if branch is None or shop is None or not branch.is_admin:
        raise Forbidden("not_admin_branch", "إدارة المتجر الإلكتروني من الجهاز الرئيسي للمالك فقط")
    plan = shop_plan(shop)
    if plan not in get_settings().store_plans:
        raise Forbidden(
            "plan_upgrade_required",
            "المتجر الإلكتروني متاح في خطة «سلسلة» فقط. رقِّ خطة المحل لتستخدمه",
            {"current_plan": plan, "required_plan": REQUIRED_PLAN},
        )
    return shop


def public_url(slug: str) -> str | None:
    base = get_settings().store_public_url.rstrip("/")
    return f"{base}/{slug}" if base else None


# ================= إعدادات المتجر =================
def validate_slug(value: str) -> str:
    slug = value.strip().lower()
    if not SLUG_RE.match(slug):
        raise ValueError("الرابط: حروف إنجليزية صغيرة وأرقام وشرطة بين الكلمات فقط (3–40). مثال: super-market")
    if slug in RESERVED_SLUGS:
        raise ValueError("هذا الرابط محجوز، اختر رابطاً آخر")
    return slug


def _text(max_len: int, *, multiline: bool = False):  # noqa: ANN202
    def check(value: str | None) -> str | None:
        out = clean_text(value, multiline=multiline)
        if out is not None and len(out) > max_len:
            raise ValueError(f"أقصى طول {max_len} حرفاً")
        return out

    return check


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

    @field_validator("slug")
    @classmethod
    def _slug(cls, value: str) -> str:
        return validate_slug(value)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        out = _text(80)(value)
        if not out or len(out) < 2:
            raise ValueError("اكتب اسم المتجر")
        return out

    @field_validator("tagline", "about", "city", "address", "hours", "delivery_note")
    @classmethod
    def _texts(cls, value: str | None, info: ValidationInfo) -> str | None:
        limit = {"tagline": 160, "about": 600, "city": 60, "address": 200, "hours": 120, "delivery_note": 200}
        return _text(limit[info.field_name], multiline=info.field_name == "about")(value)

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str) -> str:
        out = normalize_phone(value)
        if out is None:
            raise ValueError("اكتب رقم هاتف المتجر")
        return out

    @field_validator("currency")
    @classmethod
    def _currency(cls, value: str) -> str:
        out = clean_text(value)
        if not out or len(out) > 8:
            raise ValueError("رمز العملة غير صحيح")
        return out

    @field_validator("whatsapp")
    @classmethod
    def _wa(cls, value: str | None) -> str | None:
        return normalize_phone(value)


class StoreOut(BaseModel):
    slug: str
    url: str | None
    name: str
    tagline: str | None
    about: str | None
    phone: str
    whatsapp: str | None
    city: str | None
    address: str | None
    hours: str | None
    currency: str
    logo_image_id: str | None
    is_published: bool
    accepting_orders: bool
    delivery_fee: int
    free_delivery_over: int | None
    min_order: int
    delivery_note: str | None
    fulfillment_branch_id: str | None
    live: bool
    created_at: datetime
    updated_at: datetime


class StoreStateOut(BaseModel):
    store: StoreOut | None
    # للإعداد الأول: اسم المحل ورابط مقترح، وعنوان الواجهة العامة.
    suggested_name: str
    suggested_slug: str
    public_base_url: str | None
    branches: list[dict[str, Any]]


def _store_out(store: Store, shop: Shop) -> StoreOut:
    return StoreOut(
        slug=store.slug, url=public_url(store.slug), name=store.name, tagline=store.tagline, about=store.about,
        phone=store.phone, whatsapp=store.whatsapp, city=store.city, address=store.address, hours=store.hours,
        currency=store.currency, logo_image_id=store.logo_image_id, is_published=store.is_published,
        accepting_orders=store.accepting_orders, delivery_fee=store.delivery_fee,
        free_delivery_over=store.free_delivery_over, min_order=store.min_order,
        delivery_note=store.delivery_note, fulfillment_branch_id=store.fulfillment_branch_id,
        live=store.is_published and shop_live(shop),
        created_at=_aware(store.created_at), updated_at=_aware(store.updated_at),
    )  # fmt: skip


def _suggest_slug(session: Session, name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    base = re.sub(r"[^a-z0-9]+", "-", ascii_name).strip("-")[:30].strip("-")
    if len(base) < 3 or base in RESERVED_SLUGS:
        base = "store"
    slug = base
    while session.scalar(select(Store.shop_id).where(Store.slug == slug)) is not None or slug in RESERVED_SLUGS:
        slug = f"{base}-{secrets.randbelow(9000) + 1000}"
    return slug


def _branches(session: Session, shop_id: str) -> list[dict[str, Any]]:
    rows = session.scalars(select(Branch).where(Branch.shop_id == shop_id).order_by(Branch.created_at)).all()
    return [{"id": b.id, "name": b.name, "code": b.code, "is_admin": b.is_admin, "is_active": b.is_active} for b in rows]


def get_state(session: Session, caller: Caller) -> StoreStateOut:
    shop = owner(session, caller)
    store = session.get(Store, shop.id)
    return StoreStateOut(
        store=_store_out(store, shop) if store else None,
        suggested_name=shop.name,
        suggested_slug=store.slug if store else _suggest_slug(session, shop.name),
        public_base_url=get_settings().store_public_url.rstrip("/") or None,
        branches=_branches(session, shop.id),
    )


def slug_available(session: Session, caller: Caller, slug: str) -> dict[str, Any]:
    shop = owner(session, caller)
    try:
        slug = validate_slug(slug)
    except ValueError as exc:
        return {"slug": slug, "available": False, "message": str(exc)}
    holder = session.scalar(select(Store.shop_id).where(Store.slug == slug))
    ok = holder is None or holder == shop.id
    return {"slug": slug, "available": ok, "message": None if ok else "هذا الرابط مستخدم لمتجر آخر"}


def _check_image(session: Session, shop_id: str, image_id: str | None) -> None:
    if image_id is None:
        return
    img = session.get(StoreImage, image_id)
    if img is None or img.shop_id != shop_id:
        raise BadRequest("image_not_found", "الصورة غير موجودة. ارفعها من جديد")


def save_store(session: Session, caller: Caller, data: StoreIn) -> StoreOut:
    shop = owner(session, caller)
    if data.fulfillment_branch_id is not None:
        branch = session.get(Branch, data.fulfillment_branch_id)
        if branch is None or branch.shop_id != shop.id:
            raise BadRequest("branch_not_found", "فرع التجهيز غير موجود")
    _check_image(session, shop.id, data.logo_image_id)
    holder = session.scalar(select(Store.shop_id).where(Store.slug == data.slug))
    if holder is not None and holder != shop.id:
        raise Conflict("slug_taken", "هذا الرابط مستخدم لمتجر آخر، اختر رابطاً غيره")

    store = session.get(Store, shop.id)
    now = utcnow()
    created = store is None
    if store is None:
        store = Store(shop_id=shop.id, last_order_no=0, created_at=now)
        session.add(store)
    old_logo = store.logo_image_id
    old_slug = store.slug
    for key, value in data.model_dump().items():
        setattr(store, key, value)
    store.updated_at = now
    try:
        session.flush()
    except IntegrityError as exc:  # تسابق على نفس الرابط
        session.rollback()
        raise Conflict("slug_taken", "هذا الرابط مستخدم لمتجر آخر، اختر رابطاً غيره") from exc
    if old_logo and old_logo != store.logo_image_id:
        drop_image_if_unused(session, shop.id, old_logo)
    record(session, "store_created" if created else "store_updated", actor="owner", shop_id=shop.id,
           branch_id=caller.branch_id, ip=caller.ip,
           details={"slug": store.slug, "published": store.is_published,
                    **({"old_slug": old_slug} if old_slug and old_slug != store.slug else {})})  # fmt: skip
    session.commit()
    return _store_out(store, shop)


def require_store(session: Session, shop: Shop) -> Store:
    store = session.get(Store, shop.id)
    if store is None:
        raise Conflict("store_not_setup", "أنشئ المتجر من الإعدادات أولاً")
    return store


# ================= الصور =================
_MAGIC = {
    "image/jpeg": lambda b: b[:3] == b"\xff\xd8\xff",
    "image/png": lambda b: b[:8] == b"\x89PNG\r\n\x1a\n",
    "image/webp": lambda b: len(b) > 12 and b[:4] == b"RIFF" and b[8:12] == b"WEBP",
}


class ImageIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content_type: Literal["image/webp", "image/jpeg", "image/png"]
    data: Annotated[str, StringConstraints(min_length=16, max_length=7_000_000)]


def upload_image(session: Session, caller: Caller, data: ImageIn) -> dict[str, Any]:
    shop = owner(session, caller)
    settings = get_settings()
    try:
        raw = base64.b64decode(data.data, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise BadRequest("image_invalid", "ملف الصورة تالف") from exc
    if len(raw) > settings.store_image_max_bytes:
        raise BadRequest("image_too_large", f"الصورة أكبر من {settings.store_image_max_bytes // 1000} كيلوبايت")
    if not _MAGIC[data.content_type](raw):
        raise BadRequest("image_invalid", "الملف ليس صورة بالصيغة المذكورة (WebP أو JPEG أو PNG)")
    count = session.scalar(select(func.count()).select_from(StoreImage).where(StoreImage.shop_id == shop.id)) or 0
    if count >= settings.store_max_images:
        raise Conflict("images_limit", "وصلت لأقصى عدد صور للمتجر. احذف صور الأصناف غير المعروضة")
    image = StoreImage(id=secrets.token_hex(16), shop_id=shop.id, content_type=data.content_type, data=raw,
                       size=len(raw), created_at=utcnow())  # fmt: skip
    session.add(image)
    session.commit()
    return {"id": image.id, "size": image.size}


def drop_image_if_unused(session: Session, shop_id: str, image_id: str) -> None:
    used = session.scalar(
        select(func.count()).select_from(StoreProduct).where(StoreProduct.shop_id == shop_id, StoreProduct.image_id == image_id)
    ) or 0  # fmt: skip
    store = session.get(Store, shop_id)
    if used or (store is not None and store.logo_image_id == image_id):
        return
    image = session.get(StoreImage, image_id)
    if image is not None and image.shop_id == shop_id:
        session.delete(image)


def image_for(session: Session, shop_id: str, image_id: str) -> StoreImage | None:
    if not re.match(IMAGE_ID_RE, image_id):
        return None
    image = session.get(StoreImage, image_id)
    return image if image is not None and image.shop_id == shop_id else None


# ================= الأصناف =================
def catalog_products(session: Session, shop_id: str) -> list[CatalogItem]:
    return list(
        session.scalars(
            select(CatalogItem).where(
                CatalogItem.shop_id == shop_id, CatalogItem.kind == "product", CatalogItem.deleted.is_(False)
            )
        ).all()
    )


def reserved_qty(session: Session, shop_id: str, gids: list[str] | None = None) -> dict[str, int]:
    """الكميات المحجوزة في الطلبات المفتوحة لكل صنف (لم تُسلَّم ولم تُلغَ)."""
    from ..models import StoreOrderLine

    query = (
        select(StoreOrderLine.gid, func.sum(StoreOrderLine.qty))
        .join(StoreOrder, StoreOrder.id == StoreOrderLine.order_id)
        .where(StoreOrder.shop_id == shop_id, StoreOrder.status.in_(OPEN_STATUSES))
        .group_by(StoreOrderLine.gid)
    )
    if gids is not None:
        if not gids:
            return {}
        query = query.where(StoreOrderLine.gid.in_(gids))
    return {gid: int(qty or 0) for gid, qty in session.execute(query).all()}


def available_qty(sp: StoreProduct, reserved: dict[str, int]) -> int | None:
    """المتاح للطلب (× 1000). None = المخزون غير معروف بعد (لا حد غير max_qty)."""
    if sp.stock_qty is None:
        return None
    return max(int(sp.stock_qty) - reserved.get(sp.gid, 0), 0)


def search_key(text: str) -> str:
    """بحث عربي متسامح: بلا تشكيل، والألف والياء والتاء المربوطة موحّدة."""
    text = unicodedata.normalize("NFKD", text.casefold())
    text = "".join(ch for ch in text if not unicodedata.combining(ch) and ch != "ـ")
    return text.translate(str.maketrans("أإآٱىة", "اااايه"))


class AdminProductOut(BaseModel):
    gid: str
    name: str
    barcode: str | None
    category: str | None
    unit: str
    allow_decimal: bool
    price: int
    catalog_active: bool
    in_store: bool
    is_published: bool
    featured: bool
    sort_order: int
    description: str | None
    image_id: str | None
    max_qty: int | None
    stock_qty: int | None
    available_qty: int | None
    stock_at: datetime | None


class AdminProductsOut(BaseModel):
    items: list[AdminProductOut]
    total: int
    page: int
    page_size: int
    published_count: int
    categories: list[str]
    stock_branch: str | None


def _admin_product(item: CatalogItem, sp: StoreProduct | None, reserved: dict[str, int]) -> AdminProductOut:
    d = item.data
    return AdminProductOut(
        gid=item.id, name=d.get("name", ""), barcode=d.get("barcode"), category=d.get("category"),
        unit=d.get("unit", ""), allow_decimal=bool(d.get("allow_decimal")), price=int(d.get("sale_price") or 0),
        catalog_active=bool(d.get("is_active", True)), in_store=sp is not None,
        is_published=bool(sp and sp.is_published), featured=bool(sp and sp.featured),
        sort_order=sp.sort_order if sp else 0, description=sp.description if sp else None,
        image_id=sp.image_id if sp else None, max_qty=sp.max_qty if sp else None,
        stock_qty=sp.stock_qty if sp else None, available_qty=available_qty(sp, reserved) if sp else None,
        stock_at=_aware(sp.stock_at) if sp else None,
    )  # fmt: skip


def _store_products(session: Session, shop_id: str) -> dict[str, StoreProduct]:
    return {sp.gid: sp for sp in session.scalars(select(StoreProduct).where(StoreProduct.shop_id == shop_id)).all()}


def list_products(
    session: Session,
    caller: Caller,
    *,
    q: str | None,
    status: Literal["all", "published", "hidden"],
    category: str | None,
    page: int,
    page_size: int,
) -> AdminProductsOut:
    shop = owner(session, caller)
    store = session.get(Store, shop.id)
    items = catalog_products(session, shop.id)
    sps = _store_products(session, shop.id)
    reserved = reserved_qty(session, shop.id)
    categories = sorted({str(i.data.get("category")) for i in items if i.data.get("category")})
    key = search_key(q.strip()) if q and q.strip() else None

    def keep(item: CatalogItem) -> bool:
        sp = sps.get(item.id)
        published = bool(sp and sp.is_published)
        if status == "published" and not published:
            return False
        if status == "hidden" and published:
            return False
        if category and item.data.get("category") != category:
            return False
        if key:
            hay = search_key(f"{item.data.get('name', '')} {item.data.get('barcode') or ''}")
            return all(part in hay for part in key.split())
        return True

    shown = [i for i in items if keep(i)]
    # المعروض أولاً (بترتيب المالك)، ثم الباقي بالاسم.
    shown.sort(key=lambda i: (
        not (sps.get(i.id) and sps[i.id].is_published),
        sps[i.id].sort_order if i.id in sps else 0,
        search_key(str(i.data.get("name", ""))),
    ))  # fmt: skip
    total = len(shown)
    start = (page - 1) * page_size
    branch_id = (store.fulfillment_branch_id if store else None) or _admin_branch_id(session, shop.id)
    branch = session.get(Branch, branch_id) if branch_id else None
    return AdminProductsOut(
        items=[_admin_product(i, sps.get(i.id), reserved) for i in shown[start:start + page_size]],
        total=total, page=page, page_size=page_size,
        published_count=sum(1 for sp in sps.values() if sp.is_published),
        categories=categories, stock_branch=branch.name if branch else None,
    )  # fmt: skip


class StoreProductIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_published: bool | None = None
    featured: bool | None = None
    sort_order: Annotated[int, Field(ge=0, le=100_000)] | None = None
    description: Annotated[str, StringConstraints(max_length=2000)] | None = None
    image_id: ImageId | None = None
    max_qty: Annotated[int, Field(ge=1, le=10**9)] | None = None

    @field_validator("description")
    @classmethod
    def _desc(cls, value: str | None) -> str | None:
        return _text(1000, multiline=True)(value)


def _catalog_product(session: Session, shop_id: str, gid: str) -> CatalogItem:
    item = session.get(CatalogItem, gid)
    if item is None or item.shop_id != shop_id or item.kind != "product" or item.deleted:
        raise NotFound("product_not_found", "الصنف غير موجود في كتالوج المحل. زامِن البرنامج ثم حاول مرة أخرى")
    return item


def _published_count(session: Session, shop_id: str) -> int:
    return session.scalar(
        select(func.count()).select_from(StoreProduct)
        .where(StoreProduct.shop_id == shop_id, StoreProduct.is_published.is_(True))
    ) or 0  # fmt: skip


def _ensure_room(session: Session, shop_id: str, adding: int) -> None:
    limit = get_settings().store_max_products
    if _published_count(session, shop_id) + adding > limit:
        raise Conflict("products_limit", f"أقصى عدد أصناف معروضة في المتجر {limit}")


def update_product(session: Session, caller: Caller, gid: str, data: StoreProductIn) -> AdminProductOut:
    shop = owner(session, caller)
    require_store(session, shop)
    item = _catalog_product(session, shop.id, gid)
    sp = session.get(StoreProduct, gid)
    fields = data.model_fields_set
    now = utcnow()
    if sp is None:
        sp = StoreProduct(gid=gid, shop_id=shop.id, is_published=False, featured=False, sort_order=0, created_at=now)
        session.add(sp)
    if "image_id" in fields:
        _check_image(session, shop.id, data.image_id)
    if data.is_published and not sp.is_published:
        _ensure_room(session, shop.id, 1)
    old_image = sp.image_id
    for key in fields:
        value = getattr(data, key)
        if key in ("is_published", "featured", "sort_order") and value is None:
            continue  # لا معنى لـ null هنا
        setattr(sp, key, value)
    sp.updated_at = now
    session.flush()
    if old_image and old_image != sp.image_id:
        drop_image_if_unused(session, shop.id, old_image)
    session.commit()
    return _admin_product(item, sp, reserved_qty(session, shop.id, [gid]))


class BulkIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    gids: list[Gid] = Field(min_length=1, max_length=500)
    is_published: bool


def bulk_publish(session: Session, caller: Caller, data: BulkIn) -> dict[str, int]:
    shop = owner(session, caller)
    require_store(session, shop)
    gids = list(dict.fromkeys(data.gids))
    valid = {
        i.id for i in session.scalars(
            select(CatalogItem).where(CatalogItem.id.in_(gids), CatalogItem.shop_id == shop.id,
                                      CatalogItem.kind == "product", CatalogItem.deleted.is_(False))
        ).all()
    }  # fmt: skip
    existing = {sp.gid: sp for sp in session.scalars(select(StoreProduct).where(StoreProduct.gid.in_(valid))).all()}
    if data.is_published:
        adding = sum(1 for g in valid if not (existing.get(g) and existing[g].is_published))
        _ensure_room(session, shop.id, adding)
    now = utcnow()
    changed = 0
    for gid in valid:
        sp = existing.get(gid)
        if sp is None:
            if not data.is_published:
                continue
            sp = StoreProduct(gid=gid, shop_id=shop.id, featured=False, sort_order=0, created_at=now)
            session.add(sp)
        if sp.is_published != data.is_published:
            changed += 1
        sp.is_published = data.is_published
        sp.updated_at = now
    session.commit()
    return {"changed": changed, "skipped": len(gids) - len(valid)}


# ================= مخزون فرع التجهيز =================
def _admin_branch_id(session: Session, shop_id: str) -> str | None:
    return session.scalar(select(Branch.id).where(Branch.shop_id == shop_id, Branch.is_admin.is_(True)).limit(1))


def _is_fulfillment(session: Session, caller: Caller, store: Store) -> bool:
    target = store.fulfillment_branch_id or _admin_branch_id(session, caller.shop_id)
    return target == caller.branch_id


def stock_request(session: Session, caller: Caller) -> dict[str, Any]:
    """أي فرع يسأل مع المزامنة: هل أنا فرع التجهيز، وما الأصناف المعروضة التي أرفع مخزونها؟"""
    shop = session.get(Shop, caller.shop_id)
    store = session.get(Store, caller.shop_id)
    if shop is None or store is None or not shop_live(shop) or not _is_fulfillment(session, caller, store):
        return {"gids": []}
    gids = session.scalars(
        select(StoreProduct.gid).where(StoreProduct.shop_id == shop.id, StoreProduct.is_published.is_(True))
    ).all()
    return {"gids": list(gids)}


class StockLine(BaseModel):
    model_config = ConfigDict(extra="forbid")

    gid: Gid
    qty: Annotated[int, Field(ge=-(10**12), le=10**12)]


class StockIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[StockLine] = Field(max_length=10_000)


def stock_push(session: Session, caller: Caller, data: StockIn) -> dict[str, int]:
    store = session.get(Store, caller.shop_id)
    if store is None or not _is_fulfillment(session, caller, store):
        raise Forbidden("not_fulfillment_branch", "هذا الفرع ليس فرع تجهيز طلبات المتجر")
    wanted = {line.gid: line.qty for line in data.items}
    if not wanted:
        return {"updated": 0}
    now = utcnow()
    updated = 0
    rows = session.scalars(
        select(StoreProduct).where(StoreProduct.shop_id == caller.shop_id, StoreProduct.gid.in_(list(wanted)))
    ).all()
    for sp in rows:
        sp.stock_qty = wanted[sp.gid]
        sp.stock_at = now
        updated += 1
    session.commit()
    return {"updated": updated}


# ================= الطلبات (المالك) =================
class OrderLineOut(BaseModel):
    gid: str
    barcode: str | None
    name: str
    unit: str
    unit_price: int
    qty: int
    line_total: int


class OrderOut(BaseModel):
    id: str
    number: int
    status: str
    customer_name: str
    phone: str
    city: str | None
    address: str
    notes: str | None
    subtotal: int
    delivery_fee: int
    total: int
    items_count: int
    cancel_reason: str | None
    cancelled_by: str | None
    owner_note: str | None
    created_at: datetime
    updated_at: datetime
    confirmed_at: datetime | None
    delivering_at: datetime | None
    delivered_at: datetime | None
    cancelled_at: datetime | None
    # عدد طلبات نفس الهاتف السابقة (عميل متكرر أم جديد).
    previous_orders: int = 0


class OrderDetailOut(OrderOut):
    lines: list[OrderLineOut]


class OrdersOut(BaseModel):
    items: list[OrderOut]
    total: int
    page: int
    page_size: int
    counts: dict[str, int]


def order_out(order: StoreOrder, *, previous: int = 0) -> OrderOut:
    return OrderOut(
        id=order.id, number=order.number, status=order.status, customer_name=order.customer_name,
        phone=order.phone, city=order.city, address=order.address, notes=order.notes, subtotal=order.subtotal,
        delivery_fee=order.delivery_fee, total=order.total, items_count=order.items_count,
        cancel_reason=order.cancel_reason, cancelled_by=order.cancelled_by, owner_note=order.owner_note,
        created_at=_aware(order.created_at), updated_at=_aware(order.updated_at),
        confirmed_at=_aware(order.confirmed_at), delivering_at=_aware(order.delivering_at),
        delivered_at=_aware(order.delivered_at), cancelled_at=_aware(order.cancelled_at), previous_orders=previous,
    )  # fmt: skip


def order_detail(order: StoreOrder, *, previous: int = 0) -> OrderDetailOut:
    return OrderDetailOut(
        **order_out(order, previous=previous).model_dump(),
        lines=[OrderLineOut(gid=ln.gid, barcode=ln.barcode, name=ln.name, unit=ln.unit, unit_price=ln.unit_price,
                            qty=ln.qty, line_total=ln.line_total) for ln in order.lines],
    )  # fmt: skip


def _status_counts(session: Session, shop_id: str) -> dict[str, int]:
    rows = session.execute(
        select(StoreOrder.status, func.count()).where(StoreOrder.shop_id == shop_id).group_by(StoreOrder.status)
    ).all()
    counts = {s: 0 for s in STATUSES}
    counts.update({status: int(n) for status, n in rows})
    return counts


def list_orders(
    session: Session, caller: Caller, *, status: str | None, q: str | None, page: int, page_size: int
) -> OrdersOut:
    shop = owner(session, caller)
    query = select(StoreOrder).where(StoreOrder.shop_id == shop.id)
    if status == "open":
        query = query.where(StoreOrder.status.in_(OPEN_STATUSES))
    elif status in STATUSES:
        query = query.where(StoreOrder.status == status)
    text = (q or "").strip()
    if text:
        digits = re.sub(r"\D", "", text.lstrip("#"))
        conds = [StoreOrder.customer_name.ilike(f"%{text[:60]}%")]
        if digits:
            conds.append(StoreOrder.phone.like(f"%{digits[:15]}%"))
            if len(digits) <= 9:
                conds.append(StoreOrder.number == int(digits))
        query = query.where(or_(*conds))
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = session.scalars(
        query.order_by(StoreOrder.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    previous = _previous_counts(session, shop.id, rows)
    return OrdersOut(
        items=[order_out(o, previous=previous.get(o.id, 0)) for o in rows],
        total=total, page=page, page_size=page_size, counts=_status_counts(session, shop.id),
    )  # fmt: skip


def _previous_counts(session: Session, shop_id: str, orders: list[StoreOrder]) -> dict[str, int]:
    phones = list({o.phone for o in orders})
    if not phones:
        return {}
    rows = session.execute(
        select(StoreOrder.phone, StoreOrder.created_at).where(StoreOrder.shop_id == shop_id, StoreOrder.phone.in_(phones))
    ).all()  # fmt: skip
    out = {}
    for o in orders:
        created = _aware(o.created_at)
        out[o.id] = sum(1 for phone, at in rows if phone == o.phone and _aware(at) < created)
    return out


def _owned_order(session: Session, shop_id: str, order_id: str) -> StoreOrder:
    order = session.get(StoreOrder, order_id) if re.match(r"^[0-9a-f-]{36}$", order_id or "") else None
    if order is None or order.shop_id != shop_id:
        raise NotFound("order_not_found", "الطلب غير موجود")
    return order


def get_order(session: Session, caller: Caller, order_id: str) -> OrderDetailOut:
    shop = owner(session, caller)
    order = _owned_order(session, shop.id, order_id)
    return order_detail(order, previous=_previous_counts(session, shop.id, [order]).get(order.id, 0))


class StatusIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["confirmed", "delivering", "delivered", "cancelled"]
    reason: Annotated[str, StringConstraints(max_length=400)] | None = None
    note: Annotated[str, StringConstraints(max_length=600)] | None = None

    @field_validator("reason")
    @classmethod
    def _reason(cls, value: str | None) -> str | None:
        return _text(200)(value)

    @field_validator("note")
    @classmethod
    def _note(cls, value: str | None) -> str | None:
        return _text(300, multiline=True)(value)


STATUS_STAMP = {"confirmed": "confirmed_at", "delivering": "delivering_at", "delivered": "delivered_at",
                "cancelled": "cancelled_at"}  # fmt: skip


def set_status(session: Session, caller: Caller, order_id: str, data: StatusIn) -> OrderDetailOut:
    shop = owner(session, caller)
    order = session.execute(
        select(StoreOrder).where(StoreOrder.id == _owned_order(session, shop.id, order_id).id).with_for_update()
    ).scalar_one()
    if data.status not in TRANSITIONS.get(order.status, set()):
        raise Conflict(
            "invalid_transition",
            "لا يمكن تغيير حالة هذا الطلب بهذا الشكل" if order.status in OPEN_STATUSES
            else "هذا الطلب مُغلق بالفعل (تم تسليمه أو إلغاؤه)",
            {"status": order.status},
        )
    if data.status == "cancelled" and not data.reason:
        raise BadRequest("reason_required", "اكتب سبب الإلغاء (يظهر للعميل في صفحة متابعة الطلب)")
    now = utcnow()
    previous = order.status
    order.status = data.status
    setattr(order, STATUS_STAMP[data.status], now)
    if data.status == "cancelled":
        order.cancel_reason = data.reason
        order.cancelled_by = "owner"
    if "note" in data.model_fields_set:
        order.owner_note = data.note
    order.updated_at = now
    record(session, "store_order_status", actor="owner", shop_id=shop.id, branch_id=caller.branch_id, ip=caller.ip,
           details={"order": order.number, "from": previous, "to": data.status})  # fmt: skip
    session.commit()
    return get_order(session, caller, order.id)


class NoteIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    note: Annotated[str, StringConstraints(max_length=600)] | None = None

    @field_validator("note")
    @classmethod
    def _note(cls, value: str | None) -> str | None:
        return _text(300, multiline=True)(value)


def set_note(session: Session, caller: Caller, order_id: str, data: NoteIn) -> OrderDetailOut:
    shop = owner(session, caller)
    order = _owned_order(session, shop.id, order_id)
    order.owner_note = data.note
    order.updated_at = utcnow()
    session.commit()
    return get_order(session, caller, order.id)


# ================= الملخص =================
class SummaryOut(BaseModel):
    counts: dict[str, int]
    today_orders: int
    today_sales: int
    week_sales: int
    week_orders: int
    month_delivered: int
    average_order: int
    published_products: int
    out_of_stock: int
    daily: list[dict[str, Any]]
    top_products: list[dict[str, Any]]
    recent: list[OrderOut]


def summary(session: Session, caller: Caller, *, utc_offset_minutes: int = 120) -> SummaryOut:
    """أرقام لوحة المتجر. «اليوم» بتوقيت المالك (فرق التوقيت من الجهاز)."""
    from ..models import StoreOrderLine

    shop = owner(session, caller)
    offset = timedelta(minutes=max(-14 * 60, min(14 * 60, utc_offset_minutes)))
    now = utcnow()
    local_now = now + offset
    today_start = local_now.replace(hour=0, minute=0, second=0, microsecond=0) - offset
    week_start = today_start - timedelta(days=6)
    month_start = today_start - timedelta(days=29)

    rows = session.execute(
        select(StoreOrder.id, StoreOrder.status, StoreOrder.total, StoreOrder.created_at)
        .where(StoreOrder.shop_id == shop.id, StoreOrder.created_at >= month_start)
    ).all()  # fmt: skip
    live = [(oid, st, total, _aware(at)) for oid, st, total, at in rows if st != "cancelled"]
    today = [r for r in live if r[3] >= today_start]
    week = [r for r in live if r[3] >= week_start]
    daily = []
    for i in range(6, -1, -1):
        start = today_start - timedelta(days=i)
        end = start + timedelta(days=1)
        day_rows = [r for r in live if start <= r[3] < end]
        daily.append({"day": (start + offset).date().isoformat(), "orders": len(day_rows),
                      "sales": sum(int(r[2]) for r in day_rows)})  # fmt: skip

    top = session.execute(
        select(StoreOrderLine.gid, StoreOrderLine.name, func.sum(StoreOrderLine.qty), func.sum(StoreOrderLine.line_total))
        .join(StoreOrder, StoreOrder.id == StoreOrderLine.order_id)
        .where(StoreOrder.shop_id == shop.id, StoreOrder.status != "cancelled", StoreOrder.created_at >= month_start)
        .group_by(StoreOrderLine.gid, StoreOrderLine.name)
        .order_by(func.sum(StoreOrderLine.line_total).desc())
        .limit(5)
    ).all()  # fmt: skip

    sps = session.scalars(
        select(StoreProduct).where(StoreProduct.shop_id == shop.id, StoreProduct.is_published.is_(True))
    ).all()
    reserved = reserved_qty(session, shop.id)
    out_of_stock = sum(1 for sp in sps if (a := available_qty(sp, reserved)) is not None and a <= 0)
    recent = session.scalars(
        select(StoreOrder).where(StoreOrder.shop_id == shop.id).order_by(StoreOrder.created_at.desc()).limit(6)
    ).all()
    week_sales = sum(int(r[2]) for r in week)
    return SummaryOut(
        counts=_status_counts(session, shop.id),
        today_orders=len(today), today_sales=sum(int(r[2]) for r in today),
        week_sales=week_sales, week_orders=len(week),
        month_delivered=sum(int(r[2]) for r in live if r[1] == "delivered"),
        average_order=week_sales // len(week) if week else 0,
        published_products=len(sps), out_of_stock=out_of_stock, daily=daily,
        top_products=[{"gid": g, "name": n, "qty": int(q or 0), "sales": int(s or 0)} for g, n, q, s in top],
        recent=[order_out(o) for o in recent],
    )  # fmt: skip
