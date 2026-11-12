"""شاشة الصلاحية: الدفعات المنتهية والقريبة، وإعدام دفعة. ميزة خطة «سلسلة»."""

from datetime import date, timedelta
from enum import StrEnum
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import QTY_SCALE
from app.core.deps import ActorDep, SessionDep
from app.core.errors import BadRequestError, NotFoundError
from app.core.periods import local_today
from app.core.permissions import require_manager, require_manager_write
from app.core.plan import Feature, require_feature
from app.core.text import normalize_search
from app.modules.products.model import Product
from app.modules.products.service import ProductService
from app.modules.products.types import MovementType

from .model import ProductBatch

router = APIRouter(
    prefix="/batches",
    tags=["batches"],
    dependencies=[require_feature(Feature.EXPIRY)],
)


class ExpiryStatus(StrEnum):
    EXPIRED = "expired"
    SOON = "soon"  # خلال days يوم
    VALID = "valid"
    ALL = "all"


class BatchOut(BaseModel):
    id: str
    product_id: str
    product_name: str
    unit: str
    batch_no: str | None
    expiry_date: date | None
    days_left: int | None  # سالب = منتهي منذ كذا يوم
    qty_in: int
    qty_remaining: int
    unit_cost: int
    value: int  # قيمة المتبقي بالتكلفة
    received_on: date
    source: str


class ExpiryListOut(BaseModel):
    items: list[BatchOut]
    total: int


class ExpirySummaryOut(BaseModel):
    tracked_products: int
    expired_batches: int
    expired_value: int
    soon_7: int
    soon_30: int
    soon_30_value: int


class WriteOffIn(BaseModel):
    note: str | None = Field(None, max_length=200)


def _out(b: ProductBatch, p: Product, today: date) -> BatchOut:
    return BatchOut(
        id=b.id,
        product_id=p.id,
        product_name=p.name,
        unit=p.unit,
        batch_no=b.batch_no,
        expiry_date=b.expiry_date,
        days_left=(b.expiry_date - today).days if b.expiry_date else None,
        qty_in=b.qty_in,
        qty_remaining=b.qty_remaining,
        unit_cost=b.unit_cost,
        value=b.qty_remaining * b.unit_cost // QTY_SCALE,
        received_on=b.received_on,
        source=b.source,
    )


def _live(session: Session):
    return session.execute(
        select(ProductBatch, Product)
        .join(Product, Product.id == ProductBatch.product_id)
        .where(
            ProductBatch.qty_remaining > 0,
            ProductBatch.deleted_at.is_(None),
            Product.deleted_at.is_(None),
            Product.track_expiry.is_(True),
        )
    ).all()


@router.get("/expiry", response_model=ExpiryListOut, dependencies=[Depends(require_manager)])
def expiry_list(
    session: SessionDep,
    status: ExpiryStatus = ExpiryStatus.SOON,
    days: Annotated[int, Query(ge=1, le=365)] = 30,
    q: Annotated[str, Query(max_length=100)] = "",
):
    today = local_today()
    limit = today + timedelta(days=days)
    term = normalize_search(q)
    items = []
    for b, p in _live(session):
        exp = b.expiry_date
        if status is ExpiryStatus.EXPIRED and not (exp and exp < today):
            continue
        if status is ExpiryStatus.SOON and not (exp and today <= exp <= limit):
            continue
        if status is ExpiryStatus.VALID and exp and exp < today:
            continue
        if term and term not in normalize_search(p.name) and term not in (b.batch_no or ""):
            continue
        items.append(_out(b, p, today))
    items.sort(key=lambda x: (x.expiry_date is None, x.expiry_date or date.max, x.product_name))
    return ExpiryListOut(items=items, total=len(items))


@router.get("/summary", response_model=ExpirySummaryOut, dependencies=[Depends(require_manager)])
def summary(session: SessionDep):
    today = local_today()
    s = dict(expired_batches=0, expired_value=0, soon_7=0, soon_30=0, soon_30_value=0)
    for b, _p in _live(session):
        if not b.expiry_date:
            continue
        value = b.qty_remaining * b.unit_cost // QTY_SCALE
        left = (b.expiry_date - today).days
        if left < 0:
            s["expired_batches"] += 1
            s["expired_value"] += value
        elif left <= 30:
            s["soon_30"] += 1
            s["soon_30_value"] += value
            if left <= 7:
                s["soon_7"] += 1
    tracked = len(
        session.scalars(
            select(Product.id).where(Product.track_expiry.is_(True), Product.deleted_at.is_(None))
        ).all()
    )
    return ExpirySummaryOut(tracked_products=tracked, **s)


@router.get(
    "/product/{product_id}", response_model=ExpiryListOut, dependencies=[Depends(require_manager)]
)
def product_batches(product_id: str, session: SessionDep):
    today = local_today()
    rows = [(b, p) for b, p in _live(session) if p.id == product_id]
    items = sorted(
        (_out(b, p, today) for b, p in rows),
        key=lambda x: (x.expiry_date is None, x.expiry_date or date.max),
    )
    return ExpiryListOut(items=items, total=len(items))


@router.post(
    "/{batch_id}/write-off", response_model=BatchOut, dependencies=[Depends(require_manager_write)]
)
def write_off(batch_id: str, data: WriteOffIn, session: SessionDep, actor: ActorDep):
    """إعدام دفعة بالكامل (منتهية أو تالفة): حركة «تالف» من هذه الدفعة تحديداً."""
    batch = session.get(ProductBatch, batch_id)
    if batch is None or batch.deleted_at is not None:
        raise NotFoundError("batch_not_found", "الدفعة غير موجودة")
    if batch.qty_remaining <= 0:
        raise BadRequestError("batch_empty", "الدفعة لا يوجد بها رصيد")
    products = ProductService(session, actor)
    product = products.get_for_update(batch.product_id)
    qty = min(batch.qty_remaining, max(product.stock_qty, 0)) or batch.qty_remaining
    label = f"دفعة {batch.batch_no}" if batch.batch_no else "دفعة"
    expiry = f" صلاحية {batch.expiry_date.isoformat()}" if batch.expiry_date else ""
    products.write_off_batch(
        product,
        batch.id,
        qty,
        note=(data.note or f"إعدام {label}{expiry}"),
    )
    session.refresh(batch)
    return _out(batch, product, local_today())
