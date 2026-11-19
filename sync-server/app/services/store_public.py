"""واجهة المتجر العامة (بلا تسجيل دخول): عرض الأصناف، وطلب بالدفع عند الاستلام، ومتابعة الطلب.

الحماية:
- المتجر يظهر فقط لو المالك نشره، والمحل نشط وترخيصه ساري وخطته «سلسلة». غير ذلك = «غير موجود»
  (لا نكشف هل المتجر موجود وموقوف أم غير موجود أصلاً).
- لا يُقبل أي سعر من المتصفح: السعر والاسم والوحدة تُقرأ من الكتالوج على السيرفر وقت الطلب.
- الكمية تُتحقق: موجبة، بخطوة الوحدة (عدد صحيح، أو ربع للموزون)، ولا تتجاوز حد الصنف ولا المتاح.
- حدود للطلبات لكل IP ولكل هاتف، وحقل فخ مخفي للبرامج الآلية، ومفتاح للطلب يمنع تكراره لو أُرسل مرتين.
- رابط المتابعة سر عشوائي مشتق (HMAC) لا يُخزَّن إلا مُجزّأً، ولا يكشف رقم الطلب التسلسلي وحده شيئاً.
- لا يظهر للزوار أي شيء عن المخزون الفعلي أو التكلفة أو العملاء الآخرين.
"""

import hashlib
import hmac
import re
import threading
import time
import uuid
from collections import defaultdict, deque
from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..audit import record
from ..config import get_settings
from ..db import utcnow
from ..errors import BadRequest, Conflict, NotFound
from ..models import CatalogItem, Shop, Store, StoreOrder, StoreOrderLine, StoreProduct
from ..ratelimit import TooManyRequests, _Window
from . import store as core

ORDER_PERIOD = 600.0  # 10 دقائق
LOW_STOCK = 5_000  # «متبقٍ القليل» عند 5 وحدات أو أقل (× 1000)


class _Counter:
    """عدّاد الطلبات الناجحة فقط: عميل يصحح كمية أو عنواناً لا يُحسب عليه، والطلب المقبول يُحسب."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _trim(self, key: str, now: float) -> deque[float]:
        hits = self._hits[key]
        while hits and now - hits[0] >= ORDER_PERIOD:
            hits.popleft()
        return hits

    def wait(self, key: str, limit: int) -> float | None:
        now = time.monotonic()
        with self._lock:
            hits = self._trim(key, now)
            return ORDER_PERIOD - (now - hits[0]) if len(hits) >= limit else None

    def add(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            self._trim(key, now).append(now)
            if len(self._hits) > 50_000:
                self._hits = defaultdict(deque, {k: v for k, v in self._hits.items() if v})


_read_window = _Window()
_order_counter = _Counter()


def reset_limits() -> None:
    """للاختبارات."""
    global _read_window, _order_counter
    _read_window = _Window()
    _order_counter = _Counter()


def limit_read(ip: str) -> None:
    wait = _read_window.hit(f"store-read:{ip}", get_settings().store_read_rate_per_min)
    if wait is not None:
        raise TooManyRequests("rate_limited", "طلبات كثيرة. انتظر قليلاً ثم أعد المحاولة", {"retry_after": int(wait) + 1})


def _limit_order(key: str, limit: int) -> None:
    wait = _order_counter.wait(key, limit)
    if wait is not None:
        raise TooManyRequests(
            "rate_limited",
            "أرسلت طلبات كثيرة في وقت قصير. انتظر بضع دقائق أو تواصل مع المتجر مباشرة",
            {"retry_after": int(wait) + 1},
        )


def _aware(value: datetime | None) -> datetime | None:
    return value if value is None or value.tzinfo else value.replace(tzinfo=UTC)


# ================= المتجر =================
def live_store(session: Session, slug: str) -> tuple[Store, Shop]:
    slug = (slug or "").strip().lower()
    if not core.SLUG_RE.match(slug):
        raise NotFound("store_not_found", "المتجر غير موجود")
    store = session.scalars(select(Store).where(Store.slug == slug)).first()
    shop = session.get(Shop, store.shop_id) if store else None
    if store is None or shop is None or not store.is_published or not core.shop_live(shop):
        raise NotFound("store_not_found", "المتجر غير موجود")
    return store, shop


def image_url(slug: str, image_id: str | None) -> str | None:
    return f"/v1/store/public/{slug}/images/{image_id}" if image_id else None


class PublicProduct(BaseModel):
    gid: str
    name: str
    price: int
    unit: str
    # خطوة الكمية (× 1000): 1000 لعدد صحيح، 250 للموزون (ربع كيلو).
    step: int
    category: str | None
    image_url: str | None
    featured: bool
    available: bool
    # أقصى كمية يمكن طلبها الآن (× 1000)، None = بلا حد معروف.
    max_qty: int | None
    low_stock: bool


class PublicProductDetail(PublicProduct):
    description: str | None
    barcode: str | None
    # الرئيسية أولاً ثم الإضافية.
    images: list[str]


class PublicTheme(BaseModel):
    color: str
    mode: str
    cover_url: str | None
    announcement: str | None
    show_featured: bool
    facebook: str | None
    instagram: str | None
    tiktok: str | None


class PublicStore(BaseModel):
    slug: str
    name: str
    tagline: str | None
    about: str | None
    phone: str
    whatsapp: str | None
    city: str | None
    address: str | None
    hours: str | None
    currency: str
    logo_url: str | None
    accepting_orders: bool
    delivery_fee: int
    free_delivery_over: int | None
    min_order: int
    delivery_note: str | None
    categories: list[dict[str, Any]]
    featured: list[PublicProduct]
    products_count: int
    theme: PublicTheme


def _step(data: dict[str, Any]) -> int:
    return 250 if data.get("allow_decimal") else 1000


def _visible(session: Session, shop_id: str) -> list[tuple[StoreProduct, CatalogItem]]:
    rows = session.execute(
        select(StoreProduct, CatalogItem)
        .join(CatalogItem, CatalogItem.id == StoreProduct.gid)
        .where(
            StoreProduct.shop_id == shop_id,
            StoreProduct.is_published.is_(True),
            CatalogItem.shop_id == shop_id,
            CatalogItem.deleted.is_(False),
        )
    ).all()
    return [(sp, item) for sp, item in rows if item.data.get("is_active", True) and int(item.data.get("sale_price") or 0) > 0]


def _public(slug: str, sp: StoreProduct, item: CatalogItem, reserved: dict[str, int], *, detail: bool = False):
    d = item.data
    avail = core.available_qty(sp, reserved)
    limits = [x for x in (avail, sp.max_qty) if x is not None]
    step = _step(d)
    max_qty = min(limits) if limits else None
    fields = dict(
        gid=item.id, name=d.get("name", ""), price=int(d.get("sale_price") or 0), unit=d.get("unit", ""),
        step=step, category=d.get("category"), image_url=image_url(slug, sp.image_id), featured=sp.featured,
        available=max_qty is None or max_qty >= step, max_qty=max_qty,
        low_stock=avail is not None and 0 < avail <= LOW_STOCK,
    )  # fmt: skip
    if detail:
        images = [image_url(slug, i) for i in [sp.image_id, *(sp.gallery or [])] if i]
        return PublicProductDetail(**fields, description=sp.description, barcode=d.get("barcode"), images=images)
    return PublicProduct(**fields)


def _order_key(sp: StoreProduct, item: CatalogItem) -> tuple:
    return (not sp.featured, sp.sort_order, core.search_key(str(item.data.get("name", ""))))


def store_home(session: Session, slug: str) -> PublicStore:
    store, shop = live_store(session, slug)
    rows = _visible(session, shop.id)
    reserved = core.reserved_qty(session, shop.id, [sp.gid for sp, _ in rows])
    counts: dict[str, int] = {}
    for _, item in rows:
        cat = item.data.get("category")
        if cat:
            counts[cat] = counts.get(cat, 0) + 1
    featured = sorted((r for r in rows if r[0].featured), key=lambda r: _order_key(*r))[:12]
    return PublicStore(
        slug=store.slug, name=store.name, tagline=store.tagline, about=store.about, phone=store.phone,
        whatsapp=store.whatsapp, city=store.city, address=store.address, hours=store.hours,
        currency=store.currency, logo_url=image_url(store.slug, store.logo_image_id), accepting_orders=store.accepting_orders,
        delivery_fee=store.delivery_fee, free_delivery_over=store.free_delivery_over, min_order=store.min_order,
        delivery_note=store.delivery_note,
        categories=[{"name": k, "count": v} for k, v in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))],
        featured=[_public(store.slug, sp, item, reserved) for sp, item in featured],
        products_count=len(rows), theme=_theme(store),
    )  # fmt: skip


def _theme(store: Store) -> PublicTheme:
    t = core.theme_of(store)
    return PublicTheme(
        color=t.color, mode=t.mode, cover_url=image_url(store.slug, t.cover_image_id), announcement=t.announcement,
        show_featured=t.show_featured, facebook=t.facebook, instagram=t.instagram, tiktok=t.tiktok,
    )  # fmt: skip


class ProductsPage(BaseModel):
    items: list[PublicProduct]
    total: int
    page: int
    page_size: int


def products(
    session: Session,
    slug: str,
    *,
    q: str | None,
    category: str | None,
    sort: Literal["default", "price_asc", "price_desc", "name"],
    page: int,
    page_size: int,
) -> ProductsPage:
    store, shop = live_store(session, slug)
    rows = _visible(session, shop.id)
    if category:
        rows = [r for r in rows if r[1].data.get("category") == category]
    key = core.search_key(q.strip()) if q and q.strip() else None
    if key:
        parts = key.split()
        rows = [r for r in rows if all(p in core.search_key(f"{r[1].data.get('name', '')} {r[1].data.get('category') or ''}") for p in parts)]
    price = lambda r: int(r[1].data.get("sale_price") or 0)  # noqa: E731
    if sort == "price_asc":
        rows.sort(key=price)
    elif sort == "price_desc":
        rows.sort(key=price, reverse=True)
    elif sort == "name":
        rows.sort(key=lambda r: core.search_key(str(r[1].data.get("name", ""))))
    else:
        rows.sort(key=lambda r: _order_key(*r))
    total = len(rows)
    chunk = rows[(page - 1) * page_size : page * page_size]
    reserved = core.reserved_qty(session, shop.id, [sp.gid for sp, _ in chunk])
    return ProductsPage(items=[_public(store.slug, sp, item, reserved) for sp, item in chunk], total=total, page=page,
                        page_size=page_size)  # fmt: skip


class ProductPage(BaseModel):
    product: PublicProductDetail
    related: list[PublicProduct]


def product(session: Session, slug: str, gid: str) -> ProductPage:
    store, shop = live_store(session, slug)
    rows = _visible(session, shop.id)
    match = next(((sp, item) for sp, item in rows if item.id == gid), None)
    if match is None:
        raise NotFound("product_not_found", "الصنف غير موجود أو لم يعد معروضاً")
    category = match[1].data.get("category")
    related = sorted(
        (r for r in rows if r[1].id != gid and category and r[1].data.get("category") == category),
        key=lambda r: _order_key(*r),
    )[:8]
    reserved = core.reserved_qty(session, shop.id, [gid, *[sp.gid for sp, _ in related]])
    return ProductPage(
        product=_public(store.slug, *match, reserved, detail=True),
        related=[_public(store.slug, sp, item, reserved) for sp, item in related],
    )


def image(session: Session, slug: str, image_id: str):  # noqa: ANN201
    """الصورة تُخدم حتى قبل نشر المتجر (معاينة المالك في البرنامج): المعرّف عشوائي 128 بت لا يُخمَّن،
    والصورة نفسها مقيّدة بمحل هذا الرابط وبخطة سارية."""
    slug = (slug or "").strip().lower()
    store = session.scalars(select(Store).where(Store.slug == slug)).first() if core.SLUG_RE.match(slug) else None
    shop = session.get(Shop, store.shop_id) if store else None
    if store is None or shop is None or not core.shop_live(shop):
        raise NotFound("image_not_found", "الصورة غير موجودة")
    img = core.image_for(session, shop.id, image_id)
    if img is None:
        raise NotFound("image_not_found", "الصورة غير موجودة")
    return img


# ================= الطلب =================
class OrderItemIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    gid: core.Gid
    qty: Annotated[int, Field(ge=1, le=10**7)]  # × 1000


class OrderIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    client_ref: Annotated[str, StringConstraints(min_length=8, max_length=64, pattern=r"^[0-9A-Za-z-]+$")]
    name: Annotated[str, StringConstraints(min_length=2, max_length=120)]
    phone: Annotated[str, StringConstraints(min_length=6, max_length=24)]
    city: Annotated[str, StringConstraints(max_length=120)] | None = None
    address: Annotated[str, StringConstraints(min_length=5, max_length=500)]
    notes: Annotated[str, StringConstraints(max_length=500)] | None = None
    items: list[OrderItemIn] = Field(min_length=1, max_length=60)
    # حقل فخ: مخفي في الصفحة، البرامج الآلية تملؤه.
    website: Annotated[str, StringConstraints(max_length=200)] = ""

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        out = core.clean_text(value)
        if not out or len(out) < 2 or len(out) > 80:
            raise ValueError("اكتب الاسم (حرفان على الأقل)")
        return out

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str) -> str:
        out = core.normalize_phone(value)
        if out is None:
            raise ValueError("رقم الهاتف غير صحيح")
        return out

    @field_validator("address")
    @classmethod
    def _address(cls, value: str) -> str:
        out = core.clean_text(value, multiline=True)
        if not out or len(out) < 5 or len(out) > 300:
            raise ValueError("اكتب العنوان بالتفصيل")
        return out

    @field_validator("city")
    @classmethod
    def _city(cls, value: str | None) -> str | None:
        out = core.clean_text(value)
        if out and len(out) > 60:
            raise ValueError("اسم المدينة طويل")
        return out

    @field_validator("notes")
    @classmethod
    def _notes(cls, value: str | None) -> str | None:
        out = core.clean_text(value, multiline=True)
        if out and len(out) > 300:
            raise ValueError("الملاحظات أطول من 300 حرف")
        return out


def _token(order_id: str) -> str:
    mac = hmac.new(get_settings().jwt_secret.encode(), f"store-order:{order_id}".encode(), hashlib.sha256)
    return mac.hexdigest()[:40]


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class OrderCreated(BaseModel):
    number: int
    token: str
    status: str
    total: int
    created_at: datetime


def create_order(session: Session, slug: str, data: OrderIn, *, ip: str) -> OrderCreated:
    settings = get_settings()
    store, shop = live_store(session, slug)
    if data.website:
        raise BadRequest("order_rejected", "تعذّر إرسال الطلب")
    existing = session.scalars(
        select(StoreOrder).where(StoreOrder.shop_id == shop.id, StoreOrder.client_ref == data.client_ref)
    ).first()
    if existing is not None:  # نفس الطلب أُرسل مرتين (ضغطتان أو انقطاع): نفس النتيجة بلا طلب جديد
        if existing.phone != data.phone:
            raise Conflict("order_duplicate", "أعد تحميل الصفحة وحاول مرة أخرى")
        return OrderCreated(number=existing.number, token=_token(existing.id), status=existing.status,
                            total=existing.total, created_at=_aware(existing.created_at))  # fmt: skip
    ip_key, phone_key = f"ip:{ip}", f"phone:{shop.id}:{data.phone}"
    _limit_order(ip_key, settings.store_order_rate_per_ip)
    _limit_order(phone_key, settings.store_order_rate_per_phone)
    if not store.accepting_orders:
        raise Conflict("store_closed", "المتجر لا يستقبل طلبات الآن. حاول لاحقاً أو تواصل معه بالهاتف")

    # قفل صف المتجر: رقم طلب متسلسل بلا تكرار، وفحص المتاح بلا تسابق بين طلبين على آخر قطعة.
    store = session.execute(select(Store).where(Store.shop_id == shop.id).with_for_update()).scalar_one()
    priced, subtotal, _ = _price(session, store, shop.id, data.items, strict=True)
    lines = [StoreOrderLine(id=str(uuid.uuid4()), position=i, **p.model_dump(include=_LINE_FIELDS))
             for i, p in enumerate(priced)]  # fmt: skip
    if subtotal < store.min_order:
        raise Conflict("below_minimum", "قيمة الطلب أقل من الحد الأدنى للطلب", {"min_order": store.min_order})
    fee = _delivery_fee(store, subtotal)

    now = utcnow()
    store.last_order_no += 1
    order_id = str(uuid.uuid4())
    token = _token(order_id)
    order = StoreOrder(
        id=order_id, shop_id=shop.id, number=store.last_order_no, token_hash=_hash(token),
        client_ref=data.client_ref, status="new", customer_name=data.name, phone=data.phone, city=data.city,
        address=data.address, notes=data.notes, subtotal=subtotal, delivery_fee=fee, total=subtotal + fee,
        items_count=len(lines), ip=ip[:64], created_at=now, updated_at=now, lines=lines,
    )  # fmt: skip
    session.add(order)
    try:
        session.flush()
    except IntegrityError as exc:  # نفس المفتاح وصل في نفس اللحظة من طلب آخر
        session.rollback()
        raise Conflict("order_duplicate", "الطلب قيد الإرسال بالفعل. انتظر لحظة") from exc
    record(session, "store_order_created", actor="anonymous", shop_id=shop.id, ip=ip,
           details={"order": order.number, "total": order.total, "items": order.items_count})  # fmt: skip
    session.commit()
    _order_counter.add(ip_key)
    _order_counter.add(phone_key)
    return OrderCreated(number=order.number, token=token, status=order.status, total=order.total,
                        created_at=_aware(order.created_at))  # fmt: skip


def _fmt_qty(qty: int) -> str:
    return f"{qty / 1000:g}"


# ================= تسعير السلة =================
class PricedLine(BaseModel):
    gid: str
    barcode: str | None
    name: str
    unit: str
    unit_price: int
    qty: int
    line_total: int
    step: int
    max_qty: int | None
    image_url: str | None


_LINE_FIELDS = {"gid", "barcode", "name", "unit", "unit_price", "qty", "line_total"}


class CartIssue(BaseModel):
    gid: str
    code: Literal["product_unavailable", "out_of_stock", "qty_exceeds", "qty_invalid"]
    message: str
    max_qty: int


def _delivery_fee(store: Store, subtotal: int) -> int:
    free = store.free_delivery_over is not None and subtotal >= store.free_delivery_over
    return 0 if free else store.delivery_fee


def _price(
    session: Session, store: Store, shop_id: str, items: list[OrderItemIn], *, strict: bool
) -> tuple[list[PricedLine], int, list[CartIssue]]:
    """السعر والكمية من السيرفر وحده. strict (الطلب الفعلي): أي مشكلة = رفض برسالة واضحة.
    غير ذلك (مراجعة السلة): نصحح الكمية للمتاح ونرجع المشاكل ليراها العميل قبل التأكيد."""
    wanted: dict[str, int] = {}
    for line in items:
        wanted[line.gid] = wanted.get(line.gid, 0) + line.qty
    rows = {sp.gid: (sp, item) for sp, item in _visible(session, shop_id) if sp.gid in wanted}
    reserved = core.reserved_qty(session, shop_id, list(wanted))
    out: list[PricedLine] = []
    issues: list[CartIssue] = []
    subtotal = 0

    def problem(gid: str, code: str, message: str, max_qty: int = 0) -> None:
        if strict:
            raise (BadRequest if code == "qty_invalid" else Conflict)(code, message, {"gid": gid, "max_qty": max_qty})
        issues.append(CartIssue(gid=gid, code=code, message=message, max_qty=max_qty))  # type: ignore[arg-type]

    for gid, qty in wanted.items():
        if gid not in rows:
            problem(gid, "product_unavailable", "أحد الأصناف في السلة لم يعد معروضاً. حدّث السلة وحاول مرة أخرى")
            continue
        sp, item = rows[gid]
        d = item.data
        name = str(d.get("name", ""))
        unit = str(d.get("unit", ""))
        step = _step(d)
        if qty % step:
            problem(gid, "qty_invalid", f"كمية «{name}» غير صحيحة")
            qty -= qty % step
        avail = core.available_qty(sp, reserved)
        limit = min([x for x in (avail, sp.max_qty) if x is not None], default=None)
        if limit is not None and qty > limit:
            limit -= limit % step
            if limit < step:
                problem(gid, "out_of_stock", f"«{name}» نفد من المتجر الآن")
                continue
            problem(gid, "qty_exceeds", f"المتاح من «{name}» الآن {_fmt_qty(limit)} {unit}", limit)
            qty = limit
        if qty < step:
            continue
        price = int(d.get("sale_price") or 0)
        total = (price * qty + 500) // 1000
        subtotal += total
        out.append(PricedLine(
            gid=gid, barcode=d.get("barcode"), name=name[:200], unit=unit[:30], unit_price=price, qty=qty,
            line_total=total, step=step, max_qty=limit, image_url=image_url(store.slug, sp.image_id),
        ))  # fmt: skip
    return out, subtotal, issues


class QuoteIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[OrderItemIn] = Field(min_length=1, max_length=60)


class QuoteOut(BaseModel):
    lines: list[PricedLine]
    subtotal: int
    delivery_fee: int
    total: int
    min_order: int
    free_delivery_over: int | None
    accepting_orders: bool
    issues: list[CartIssue]


def quote(session: Session, slug: str, data: QuoteIn) -> QuoteOut:
    """مراجعة السلة قبل الطلب: الأسعار الحالية والمتاح ورسوم التوصيل بالضبط كما ستُحسب في الطلب."""
    store, shop = live_store(session, slug)
    lines, subtotal, issues = _price(session, store, shop.id, data.items, strict=False)
    fee = _delivery_fee(store, subtotal) if lines else 0
    return QuoteOut(lines=lines, subtotal=subtotal, delivery_fee=fee, total=subtotal + fee, min_order=store.min_order,
                    free_delivery_over=store.free_delivery_over, accepting_orders=store.accepting_orders,
                    issues=issues)  # fmt: skip


class TrackLine(BaseModel):
    gid: str
    name: str
    unit: str
    unit_price: int
    qty: int
    line_total: int


class TrackOut(BaseModel):
    number: int
    store_name: str
    currency: str
    status: str
    customer_name: str
    phone: str
    city: str | None
    address: str
    notes: str | None
    subtotal: int
    delivery_fee: int
    total: int
    cancel_reason: str | None
    cancelled_by: str | None
    can_cancel: bool
    created_at: datetime
    confirmed_at: datetime | None
    delivering_at: datetime | None
    delivered_at: datetime | None
    cancelled_at: datetime | None
    lines: list[TrackLine]


_TOKEN_RE = re.compile(r"^[0-9a-f]{40}$")


def _order_by_token(session: Session, shop_id: str, token: str, *, lock: bool = False) -> StoreOrder:
    if not _TOKEN_RE.match(token or ""):
        raise NotFound("order_not_found", "الطلب غير موجود")
    query = select(StoreOrder).where(StoreOrder.token_hash == _hash(token), StoreOrder.shop_id == shop_id)
    order = session.execute(query.with_for_update() if lock else query).scalar_one_or_none()
    if order is None or not hmac.compare_digest(_token(order.id), token):
        raise NotFound("order_not_found", "الطلب غير موجود")
    return order


def _mask(phone: str) -> str:
    return phone[:3] + "•" * max(len(phone) - 6, 0) + phone[-3:] if len(phone) > 6 else phone


def _track(order: StoreOrder, store: Store) -> TrackOut:
    return TrackOut(
        number=order.number, store_name=store.name, currency=store.currency, status=order.status, customer_name=order.customer_name, phone=_mask(order.phone),
        city=order.city, address=order.address, notes=order.notes, subtotal=order.subtotal,
        delivery_fee=order.delivery_fee, total=order.total, cancel_reason=order.cancel_reason,
        cancelled_by=order.cancelled_by, can_cancel=order.status == "new",
        created_at=_aware(order.created_at), confirmed_at=_aware(order.confirmed_at),
        delivering_at=_aware(order.delivering_at), delivered_at=_aware(order.delivered_at),
        cancelled_at=_aware(order.cancelled_at),
        lines=[TrackLine(gid=ln.gid, name=ln.name, unit=ln.unit, unit_price=ln.unit_price, qty=ln.qty,
                         line_total=ln.line_total) for ln in order.lines],
    )  # fmt: skip


def track(session: Session, slug: str, token: str) -> TrackOut:
    store, shop = live_store(session, slug)
    return _track(_order_by_token(session, shop.id, token), store)


def cancel_by_customer(session: Session, slug: str, token: str, *, ip: str) -> TrackOut:
    """العميل يلغي طلبه قبل أن يؤكده المحل فقط."""
    store, shop = live_store(session, slug)
    order = _order_by_token(session, shop.id, token, lock=True)
    if order.status != "new":
        raise Conflict("cannot_cancel", "لا يمكن إلغاء الطلب بعد تأكيده من المتجر. تواصل مع المتجر بالهاتف")
    now = utcnow()
    order.status = "cancelled"
    order.cancelled_at = now
    order.cancelled_by = "customer"
    order.cancel_reason = "ألغاه العميل"
    order.updated_at = now
    record(session, "store_order_status", actor="anonymous", shop_id=shop.id, ip=ip,
           details={"order": order.number, "from": "new", "to": "cancelled", "by": "customer"})  # fmt: skip
    session.commit()
    return _track(order, store)
