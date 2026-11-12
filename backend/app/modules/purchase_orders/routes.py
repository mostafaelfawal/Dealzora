"""طبقة HTTP فقط. طلبات الشراء للمدير فقط (ضمن ميزة الموردين والمشتريات).
المسارات الثابتة (suggestions، summary) قبل /{order_id}."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import service_dependency
from app.core.permissions import require_manager, require_manager_write
from app.core.plan import Feature, require_feature_for_writes

from .schema import (
    OrderAction,
    OrderCreate,
    OrderListOut,
    OrderListQuery,
    OrderOut,
    OrdersSummaryOut,
    OrderUpdate,
    SuggestionsOut,
    SuggestionsQuery,
)
from .service import PurchaseOrderService

router = APIRouter(
    prefix="/purchase-orders",
    tags=["purchase-orders"],
    dependencies=[require_feature_for_writes(Feature.SUPPLIERS)],
)
Service = service_dependency(PurchaseOrderService)
Read = [Depends(require_manager)]
Write = [Depends(require_manager_write)]


@router.get("/suggestions", response_model=SuggestionsOut, dependencies=Read)
def suggestions(service: Service, query: Annotated[SuggestionsQuery, Query()]):
    """النواقص المتوقعة والكمية المقترحة لكل صنف (لا يكتب شيئاً)."""
    return service.suggestions(query)


@router.get("/summary", response_model=OrdersSummaryOut, dependencies=Read)
def summary(service: Service):
    return service.summary()


@router.get("", response_model=OrderListOut, dependencies=Read)
def list_orders(service: Service, query: Annotated[OrderListQuery, Query()]):
    return service.list_orders(query)


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED, dependencies=Write)
def create_order(data: OrderCreate, service: Service):
    return service.create_order(data)


@router.get("/{order_id}", response_model=OrderOut, dependencies=Read)
def get_order(order_id: str, service: Service):
    return service.get_order(order_id)


@router.put("/{order_id}", response_model=OrderOut, dependencies=Write)
def update_order(order_id: str, data: OrderUpdate, service: Service):
    return service.update_order(order_id, data)


@router.post("/{order_id}/send", response_model=OrderOut, dependencies=Write)
def mark_sent(order_id: str, data: OrderAction, service: Service):
    return service.mark_sent(order_id, data.base_version)


@router.post("/{order_id}/cancel", response_model=OrderOut, dependencies=Write)
def cancel(order_id: str, data: OrderAction, service: Service):
    return service.cancel(order_id, data.base_version)
