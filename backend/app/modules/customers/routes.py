"""طبقة HTTP فقط: استقبال الطلب، حماية الدور، استدعاء الـ service. لا منطق عمل هنا.

ترتيب المسارات مهم: الثابتة (summary) قبل /{customer_id}.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.plan import Feature, require_feature_for_writes
from app.core.database import get_session
from app.core.security import Actor, get_actor

from app.core.permissions import require_admin, require_admin_write, require_cashier
from .schema import (
    CustomerCreate,
    CustomerListOut,
    CustomerListQuery,
    CustomerOut,
    CustomersSummaryOut,
    CustomerUpdate,
    PaymentIn,
    StatementOut,
    StatementQuery,
    BulkIn,
    BulkResultOut,
)
from .service import CustomerService

# خطة «بَسطة» المجانية: القراءة متاحة، والكتابة تحتاج خطة مدفوعة.
router = APIRouter(
    prefix="/customers",
    tags=["customers"],
    dependencies=[require_feature_for_writes(Feature.CUSTOMERS)],
)


def get_customer_service(
    session: Annotated[Session, Depends(get_session)],
    actor: Annotated[Actor, Depends(get_actor)],
) -> CustomerService:
    return CustomerService(session, actor)


Service = Annotated[CustomerService, Depends(get_customer_service)]


# ---------- قراءة: كاشير + مدير ----------
@router.get("", response_model=CustomerListOut, dependencies=[Depends(require_cashier)])
def list_customers(service: Service, query: Annotated[CustomerListQuery, Query()]):
    return service.list_customers(query)


# ---------- قراءة: مدير ----------
@router.get("/summary", response_model=CustomersSummaryOut, dependencies=[Depends(require_admin)])
def customers_summary(service: Service):
    return service.summary()


@router.get("/{customer_id}", response_model=CustomerOut, dependencies=[Depends(require_cashier)])
def get_customer(customer_id: str, service: Service):
    return service.get_customer(customer_id)


@router.get(
    "/{customer_id}/statement",
    response_model=StatementOut,
    dependencies=[Depends(require_admin)],
)
def customer_statement(
    customer_id: str, service: Service, query: Annotated[StatementQuery, Query()]
):
    return service.list_statement(customer_id, query)


# ---------- كتابة: مدير + تصريح كتابة ----------
@router.post(
    "",
    response_model=CustomerOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_write)],
)
def create_customer(data: CustomerCreate, service: Service):
    return service.create_customer(data)

@router.post("/bulk-delete", response_model=BulkResultOut, dependencies=[Depends(require_admin_write)])
def bulk_delete_customers(data: BulkIn, service: Service):
    return service.bulk_delete(data)


@router.post("/bulk-deactivate", response_model=BulkResultOut, dependencies=[Depends(require_admin_write)])
def bulk_deactivate_customers(data: BulkIn, service: Service):
    return service.bulk_deactivate(data)

@router.put("/{customer_id}", response_model=CustomerOut, dependencies=[Depends(require_admin_write)])
def update_customer(customer_id: str, data: CustomerUpdate, service: Service):
    return service.update_customer(customer_id, data)


@router.post(
    "/{customer_id}/toggle-active",
    response_model=CustomerOut,
    dependencies=[Depends(require_admin_write)],
)
def toggle_active(customer_id: str, service: Service, base_version: Annotated[int, Query(ge=1)]):
    return service.toggle_active(customer_id, base_version)


@router.post(
    "/{customer_id}/payments",
    response_model=CustomerOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_write)],
)
def collect_payment(customer_id: str, data: PaymentIn, service: Service):
    return service.collect_payment(customer_id, data)


@router.delete(
    "/{customer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin_write)],
)
def delete_customer(customer_id: str, service: Service, base_version: Annotated[int, Query(ge=1)]):
    service.delete_customer(customer_id, base_version)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
