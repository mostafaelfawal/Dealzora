"""المتجر الإلكتروني (للمالك من الجهاز الرئيسي، خطة «سلسلة»). كل شيء يمر لسيرفر الفروع."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query

from app.core.deps import ActorDep, SessionDep
from app.core.permissions import require_owner, require_owner_write
from app.core.plan import Feature, require_feature

from .schemas import BulkIn, ImageIn, NoteIn, ProductPatchIn, StatusIn, StoreIn, ThemeIn
from .service import StoreService

router = APIRouter(prefix="/store", tags=["store"])
_Plan = require_feature(Feature.ONLINE_STORE)
Read = [Depends(require_owner), _Plan]
Write = [Depends(require_owner_write), _Plan]


def _svc(session: SessionDep, actor: ActorDep) -> StoreService:
    return StoreService(session, actor)


Svc = Annotated[StoreService, Depends(_svc)]


@router.get("", dependencies=Read)
def state(svc: Svc):
    """إعدادات المتجر (null قبل الإنشاء) + رابط مقترح + فروع المحل لاختيار فرع التجهيز."""
    return svc.state()


@router.put("", dependencies=Write)
def save(data: StoreIn, svc: Svc):
    return svc.save(data)


@router.put("/theme", dependencies=Write)
def save_theme(data: ThemeIn, svc: Svc):
    """تخصيص واجهة المتجر: اللون، الوضع، الغلاف، شريط الإعلان، روابط التواصل."""
    return svc.save_theme(data)


@router.get("/slug", dependencies=Read)
def slug_check(svc: Svc, slug: Annotated[str, Query(max_length=60)]):
    return svc.slug_check(slug)


@router.post("/images", dependencies=Write, status_code=201)
def upload_image(data: ImageIn, svc: Svc):
    return svc.upload_image(data)


@router.get("/products", dependencies=Read)
def products(
    svc: Svc,
    q: Annotated[str | None, Query(max_length=100)] = None,
    status: Literal["all", "published", "hidden"] = "all",
    category: Annotated[str | None, Query(max_length=80)] = None,
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
):
    params = {"q": q, "status": status, "category": category, "page": page, "page_size": page_size}
    return svc.products(params)


@router.post("/products/bulk", dependencies=Write)
def bulk(data: BulkIn, svc: Svc):
    return svc.bulk(data)


@router.patch("/products/{gid}", dependencies=Write)
def update_product(gid: str, data: ProductPatchIn, svc: Svc):
    return svc.update_product(gid, data)


@router.get("/orders", dependencies=Read)
def orders(
    svc: Svc,
    status: Annotated[str | None, Query(max_length=16)] = None,
    q: Annotated[str | None, Query(max_length=80)] = None,
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 30,
):
    return svc.orders({"status": status, "q": q, "page": page, "page_size": page_size})


@router.get("/orders/{order_id}", dependencies=Read)
def order(order_id: str, svc: Svc):
    return svc.order(order_id)


@router.post("/orders/{order_id}/status", dependencies=Write)
def set_status(order_id: str, data: StatusIn, svc: Svc):
    return svc.set_status(order_id, data)


@router.put("/orders/{order_id}/note", dependencies=Write)
def set_note(order_id: str, data: NoteIn, svc: Svc):
    return svc.set_note(order_id, data)


@router.get("/summary", dependencies=Read)
def summary(svc: Svc, utc_offset_minutes: Annotated[int, Query(ge=-840, le=840)] = 120):
    return svc.summary(utc_offset_minutes)
