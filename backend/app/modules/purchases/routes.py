"""طبقة HTTP فقط. المشتريات للمدير فقط. الثابتة (summary) قبل /{purchase_id}."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import service_dependency
from app.core.permissions import require_manager, require_manager_write

from .schema import (
    PurchaseCreate,
    PurchaseListOut,
    PurchaseListQuery,
    PurchaseOut,
    PurchaseReturnCreate,
    PurchaseReturnOut,
    PurchasesSummaryOut,
)
from .service import PurchaseService

router = APIRouter(prefix="/purchases", tags=["purchases"])
Service = service_dependency(PurchaseService)


@router.get("", response_model=PurchaseListOut, dependencies=[Depends(require_manager)])
def list_purchases(service: Service, query: Annotated[PurchaseListQuery, Query()]):
    return service.list_purchases(query)


@router.get("/summary", response_model=PurchasesSummaryOut, dependencies=[Depends(require_manager)])
def purchases_summary(service: Service):
    return service.summary()


@router.post(
    "",
    response_model=PurchaseOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_manager_write)],
)
def create_purchase(data: PurchaseCreate, service: Service):
    return service.create_purchase(data)


@router.get("/{purchase_id}", response_model=PurchaseOut, dependencies=[Depends(require_manager)])
def get_purchase(purchase_id: str, service: Service):
    return service.get_purchase(purchase_id)


@router.post(
    "/{purchase_id}/returns",
    response_model=PurchaseReturnOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_manager_write)],
)
def create_purchase_return(purchase_id: str, data: PurchaseReturnCreate, service: Service):
    return service.create_return(purchase_id, data)
