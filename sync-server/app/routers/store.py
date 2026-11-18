"""المتجر الإلكتروني («سلسلة» فقط).

إدارة المالك (الجهاز الرئيسي، بتوكن الفرع):
  GET   /v1/shop/store                      إعدادات المتجر (أو null قبل الإنشاء) + رابط مقترح
  PUT   /v1/shop/store                      إنشاء/تعديل المتجر
  GET   /v1/shop/store/slug?slug=           هل الرابط متاح؟
  POST  /v1/shop/store/images               رفع صورة (base64 بعد ضغطها في البرنامج)
  GET   /v1/shop/store/products             أصناف الكتالوج وحالتها في المتجر
  PATCH /v1/shop/store/products/{gid}       عرض/إخفاء، مميز، وصف، صورة، حد الكمية
  POST  /v1/shop/store/products/bulk        عرض/إخفاء مجموعة أصناف
  GET   /v1/shop/store/orders               الطلبات (بحث وتصفية)
  GET   /v1/shop/store/orders/{id}          تفاصيل طلب
  POST  /v1/shop/store/orders/{id}/status   تأكيد / خروج للتوصيل / تسليم / إلغاء
  PUT   /v1/shop/store/orders/{id}/note     ملاحظة داخلية
  GET   /v1/shop/store/summary              أرقام لوحة المتجر

فرع التجهيز (مع المزامنة):
  GET   /v1/store/stock-request             الأصناف المعروضة التي يرفع مخزونها (فارغ لغير فرع التجهيز)
  POST  /v1/store/stock                     كمياتها الحالية

الواجهة العامة (بلا دخول، بحد طلبات لكل IP):
  GET   /v1/store/public/{slug}                       المتجر + التصنيفات + المميز
  GET   /v1/store/public/{slug}/products              بحث وتصفية وترتيب وصفحات
  GET   /v1/store/public/{slug}/products/{gid}        صنف + أصناف مشابهة
  GET   /v1/store/public/{slug}/images/{id}           صورة
  POST  /v1/store/public/{slug}/quote                 مراجعة السلة (الأسعار والمتاح والتوصيل الحالية)
  POST  /v1/store/public/{slug}/orders                طلب بالدفع عند الاستلام
  GET   /v1/store/public/{slug}/orders/{token}        متابعة الطلب
  POST  /v1/store/public/{slug}/orders/{token}/cancel إلغاء من العميل (قبل التأكيد فقط)
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response

from ..db import SessionDep
from ..ratelimit import client_ip
from ..security import CallerDep
from ..services import store as svc
from ..services import store_public as pub

owner_router = APIRouter(prefix="/shop/store", tags=["store"])
branch_router = APIRouter(prefix="/store", tags=["store"])
public_router = APIRouter(prefix="/store/public/{slug}", tags=["store-public"])


# ================= المالك =================
@owner_router.get("", response_model=svc.StoreStateOut)
def get_store(caller: CallerDep, session: SessionDep):
    return svc.get_state(session, caller)


@owner_router.put("", response_model=svc.StoreOut)
def save_store(data: svc.StoreIn, caller: CallerDep, session: SessionDep):
    return svc.save_store(session, caller, data)


@owner_router.get("/slug")
def slug_check(caller: CallerDep, session: SessionDep, slug: Annotated[str, Query(max_length=60)]):
    return svc.slug_available(session, caller, slug)


@owner_router.post("/images", status_code=201)
def upload_image(data: svc.ImageIn, caller: CallerDep, session: SessionDep):
    return svc.upload_image(session, caller, data)


@owner_router.get("/products", response_model=svc.AdminProductsOut)
def list_products(
    caller: CallerDep,
    session: SessionDep,
    q: Annotated[str | None, Query(max_length=100)] = None,
    status: Literal["all", "published", "hidden"] = "all",
    category: Annotated[str | None, Query(max_length=80)] = None,
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
):
    return svc.list_products(session, caller, q=q, status=status, category=category, page=page, page_size=page_size)


@owner_router.post("/products/bulk")
def bulk(data: svc.BulkIn, caller: CallerDep, session: SessionDep):
    return svc.bulk_publish(session, caller, data)


@owner_router.patch("/products/{gid}", response_model=svc.AdminProductOut)
def update_product(gid: str, data: svc.StoreProductIn, caller: CallerDep, session: SessionDep):
    return svc.update_product(session, caller, gid, data)


@owner_router.get("/orders", response_model=svc.OrdersOut)
def list_orders(
    caller: CallerDep,
    session: SessionDep,
    status: Annotated[str | None, Query(max_length=16)] = None,
    q: Annotated[str | None, Query(max_length=80)] = None,
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 30,
):
    return svc.list_orders(session, caller, status=status, q=q, page=page, page_size=page_size)


@owner_router.get("/orders/{order_id}", response_model=svc.OrderDetailOut)
def get_order(order_id: str, caller: CallerDep, session: SessionDep):
    return svc.get_order(session, caller, order_id)


@owner_router.post("/orders/{order_id}/status", response_model=svc.OrderDetailOut)
def set_status(order_id: str, data: svc.StatusIn, caller: CallerDep, session: SessionDep):
    return svc.set_status(session, caller, order_id, data)


@owner_router.put("/orders/{order_id}/note", response_model=svc.OrderDetailOut)
def set_note(order_id: str, data: svc.NoteIn, caller: CallerDep, session: SessionDep):
    return svc.set_note(session, caller, order_id, data)


@owner_router.get("/summary", response_model=svc.SummaryOut)
def summary(
    caller: CallerDep,
    session: SessionDep,
    utc_offset_minutes: Annotated[int, Query(ge=-840, le=840)] = 120,
):
    return svc.summary(session, caller, utc_offset_minutes=utc_offset_minutes)


# ================= فرع التجهيز =================
@branch_router.get("/stock-request")
def stock_request(caller: CallerDep, session: SessionDep):
    return svc.stock_request(session, caller)


@branch_router.post("/stock")
def stock_push(data: svc.StockIn, caller: CallerDep, session: SessionDep):
    return svc.stock_push(session, caller, data)


# ================= الواجهة العامة =================
def _limited(request: Request) -> str:
    ip = client_ip(request)
    pub.limit_read(ip)
    return ip


PublicIp = Annotated[str, Depends(_limited)]


@public_router.get("", response_model=pub.PublicStore)
def store_home(slug: str, _: PublicIp, session: SessionDep):
    return pub.store_home(session, slug)


@public_router.get("/products", response_model=pub.ProductsPage)
def products(
    slug: str,
    _: PublicIp,
    session: SessionDep,
    q: Annotated[str | None, Query(max_length=80)] = None,
    category: Annotated[str | None, Query(max_length=80)] = None,
    sort: Literal["default", "price_asc", "price_desc", "name"] = "default",
    page: Annotated[int, Query(ge=1, le=1000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=60)] = 24,
):
    return pub.products(session, slug, q=q, category=category, sort=sort, page=page, page_size=page_size)


@public_router.get("/products/{gid}", response_model=pub.ProductPage)
def product(slug: str, gid: str, _: PublicIp, session: SessionDep):
    return pub.product(session, slug, gid)


@public_router.get("/images/{image_id}")
def image(slug: str, image_id: str, _: PublicIp, session: SessionDep):
    img = pub.image(session, slug, image_id)
    return Response(
        content=img.data,
        media_type=img.content_type,
        headers={
            # المعرّف لا يتغير أبداً لنفس الصورة: تخزين طويل في المتصفح.
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Cross-Origin-Resource-Policy": "same-site",
            "Content-Disposition": "inline",
        },
    )


@public_router.post("/quote", response_model=pub.QuoteOut)
def quote(slug: str, data: pub.QuoteIn, _: PublicIp, session: SessionDep):
    return pub.quote(session, slug, data)


@public_router.post("/orders", response_model=pub.OrderCreated, status_code=201)
def create_order(slug: str, data: pub.OrderIn, ip: PublicIp, session: SessionDep):
    return pub.create_order(session, slug, data, ip=ip)


@public_router.get("/orders/{token}", response_model=pub.TrackOut)
def track(slug: str, token: str, _: PublicIp, session: SessionDep):
    return pub.track(session, slug, token)


@public_router.post("/orders/{token}/cancel", response_model=pub.TrackOut)
def cancel(slug: str, token: str, ip: PublicIp, session: SessionDep):
    return pub.cancel_by_customer(session, slug, token, ip=ip)
