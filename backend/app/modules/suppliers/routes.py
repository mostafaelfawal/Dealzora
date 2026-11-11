"""طبقة HTTP فقط: استقبال الطلب، حماية الدور، استدعاء الـ service. لا منطق عمل هنا.

ترتيب المسارات مهم: الثابتة (summary/bulk-*) قبل /{supplier_id}.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.plan import Feature, require_feature_for_writes
from app.core.database import get_session
from app.core.security import Actor, get_actor

from app.core.permissions import require_admin, require_admin_write
from .schema import (
    BulkIn,
    BulkResultOut,
    StatementQuery,
    SupplierCreate,
    SupplierListOut,
    SupplierListQuery,
    SupplierOut,
    SupplierPaymentIn,
    SupplierStatementOut,
    SuppliersSummaryOut,
    SupplierTransactionOut,
    SupplierUpdate,
)
from .service import SupplierService

# خطة «بَسطة» المجانية: القراءة متاحة، والكتابة تحتاج خطة مدفوعة.
router = APIRouter(
    prefix="/suppliers",
    tags=["suppliers"],
    dependencies=[require_feature_for_writes(Feature.SUPPLIERS)],
)


def get_supplier_service(
    session: Annotated[Session, Depends(get_session)],
    actor: Annotated[Actor, Depends(get_actor)],
) -> SupplierService:
    return SupplierService(session, actor)


Service = Annotated[SupplierService, Depends(get_supplier_service)]


# ---------- قراءة: مدير ----------
@router.get("", response_model=SupplierListOut, dependencies=[Depends(require_admin)])
def list_suppliers(service: Service, query: Annotated[SupplierListQuery, Query()]):
    return service.list_suppliers(query)


@router.get("/summary", response_model=SuppliersSummaryOut, dependencies=[Depends(require_admin)])
def suppliers_summary(service: Service):
    return service.summary()


@router.get("/{supplier_id}", response_model=SupplierOut, dependencies=[Depends(require_admin)])
def get_supplier(supplier_id: str, service: Service):
    return service.get_supplier(supplier_id)


@router.get(
    "/{supplier_id}/statement",
    response_model=SupplierStatementOut,
    dependencies=[Depends(require_admin)],
)
def supplier_statement(
    supplier_id: str, service: Service, query: Annotated[StatementQuery, Query()]
):
    return service.list_statement(supplier_id, query)


# ---------- كتابة: مدير + تصريح كتابة ----------
@router.post(
    "",
    response_model=SupplierOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_write)],
)
def create_supplier(data: SupplierCreate, service: Service):
    return service.create_supplier(data)


@router.post(
    "/bulk-delete",
    response_model=BulkResultOut,
    dependencies=[Depends(require_admin_write)],
)
def bulk_delete_suppliers(data: BulkIn, service: Service):
    return service.bulk_delete(data)


@router.post(
    "/bulk-deactivate",
    response_model=BulkResultOut,
    dependencies=[Depends(require_admin_write)],
)
def bulk_deactivate_suppliers(data: BulkIn, service: Service):
    return service.bulk_deactivate(data)


@router.put("/{supplier_id}", response_model=SupplierOut, dependencies=[Depends(require_admin_write)])
def update_supplier(supplier_id: str, data: SupplierUpdate, service: Service):
    return service.update_supplier(supplier_id, data)


@router.post(
    "/{supplier_id}/toggle-active",
    response_model=SupplierOut,
    dependencies=[Depends(require_admin_write)],
)
def toggle_active(supplier_id: str, service: Service, base_version: Annotated[int, Query(ge=1)]):
    return service.toggle_active(supplier_id, base_version)


@router.post(
    "/{supplier_id}/payments",
    response_model=SupplierTransactionOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_write)],
)
def create_payment(supplier_id: str, data: SupplierPaymentIn, service: Service):
    return service.record_payment(supplier_id, data)


@router.delete(
    "/{supplier_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin_write)],
)
def delete_supplier(supplier_id: str, service: Service, base_version: Annotated[int, Query(ge=1)]):
    service.delete_supplier(supplier_id, base_version)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
