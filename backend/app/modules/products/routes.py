"""طبقة HTTP فقط: استقبال الطلب، حماية الدور، استدعاء الـ service. لا منطق عمل هنا.

ترتيب المسارات مهم: الثابتة (categories/summary/by-barcode) قبل /{product_id}.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import Actor, get_actor

from app.core.permissions import require_admin, require_admin_write, require_cashier
from .schema import (
    BarcodeLookupOut,
    CategoryOut,
    LedgerQuery,
    ProductCreate,
    ProductListOut,
    ProductListQuery,
    ProductOut,
    ProductsSummaryOut,
    ProductUpdate,
    StockAdjustIn,
    StockLedgerOut,
    StockMovementOut,
    BulkIn,
    BulkResultOut
)
from .service import ProductService

router = APIRouter(prefix="/products", tags=["products"])


def get_product_service(
session: Annotated[Session, Depends(get_session)],
actor: Annotated[Actor, Depends(get_actor)],
) -> ProductService:
    return ProductService(session, actor)


Service = Annotated[ProductService, Depends(get_product_service)]


# ---------- قراءة: كاشير + أدمن ----------
@router.get("", response_model=ProductListOut, dependencies=[Depends(require_cashier)])
def list_products(service: Service, query: Annotated[ProductListQuery, Query()]):
    return service.list_products(query)


@router.get("/summary", response_model=ProductsSummaryOut, dependencies=[Depends(require_cashier)])
def products_summary(service: Service):
    return service.summary()


@router.get("/categories", response_model=list[CategoryOut], dependencies=[Depends(require_cashier)])
def list_categories(service: Service):
    return service.list_categories()


@router.get("/by-barcode/{barcode}", response_model=BarcodeLookupOut, dependencies=[Depends(require_cashier)])
def find_by_barcode(barcode: str, service: Service):
    return service.find_by_barcode(barcode)


@router.get("/{product_id}", response_model=ProductOut, dependencies=[Depends(require_cashier)])
def get_product(product_id: str, service: Service):
    return service.get_product(product_id)


# ---------- قراءة: أدمن ----------
@router.get("/{product_id}/stock-ledger", response_model=StockLedgerOut, dependencies=[Depends(require_admin)])
def stock_ledger(product_id: str, service: Service, query: Annotated[LedgerQuery, Query()]):
    return service.list_ledger(product_id, query)


# ---------- كتابة: أدمن + تصريح كتابة ----------
@router.post(
"",
response_model=ProductOut,
status_code=status.HTTP_201_CREATED,
dependencies=[Depends(require_admin_write)],
)
def create_product(data: ProductCreate, service: Service):
    return service.create_product(data)

@router.post(
    "/bulk-delete",
    response_model=BulkResultOut,
    dependencies=[Depends(require_admin_write)]
)
def bulk_delete_products(data: BulkIn, service: Service):
    return service.bulk_delete(data)

@router.post(
    "/bulk-deactivate",
    response_model=BulkResultOut,
    dependencies=[Depends(require_admin_write)],
)
def bulk_deactivate_products(data: BulkIn, service: Service):
    return service.bulk_deactivate(data)

@router.put("/{product_id}", response_model=ProductOut, dependencies=[Depends(require_admin_write)])
def update_product(product_id: str, data: ProductUpdate, service: Service):
    return service.update_product(product_id, data)



@router.post(
"/{product_id}/duplicate",
response_model=ProductOut,
status_code=status.HTTP_201_CREATED,
dependencies=[Depends(require_admin_write)],
)
def duplicate_product(product_id: str, service: Service):
    return service.duplicate_product(product_id)


@router.post("/{product_id}/toggle-active", response_model=ProductOut, dependencies=[Depends(require_admin_write)])
def toggle_active(product_id: str, service: Service, base_version: Annotated[int, Query(ge=1)]):
    return service.toggle_active(product_id, base_version)


@router.post(
"/{product_id}/stock-adjustments",
response_model=StockMovementOut,
status_code=status.HTTP_201_CREATED,
dependencies=[Depends(require_admin_write)],
)
def adjust_stock(product_id: str, data: StockAdjustIn, service: Service):
    return service.adjust_stock(product_id, data)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin_write)])
def delete_product(product_id: str, service: Service, base_version: Annotated[int, Query(ge=1)]):
    service.delete_product(product_id, base_version)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
