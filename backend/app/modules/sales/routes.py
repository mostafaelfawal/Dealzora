"""طبقة HTTP فقط. ترتيب المسارات مهم: الثابتة (summary/returns/exchange/by-number) قبل /{sale_id}."""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status

from app.core.deps import service_dependency
from app.core.permissions import (
    require_authenticated,
    require_authenticated_write,
    require_manager,
)

from .schema import (
    ExchangeCreate,
    ExchangeOut,
    ReturnCreate,
    ReturnListOut,
    ReturnListQuery,
    ReturnOut,
    SaleCreate,
    SaleListOut,
    SaleListQuery,
    SaleOut,
    SalesSummaryOut,
)
from .service import SaleService

router = APIRouter(prefix="/sales", tags=["sales"])
Service = service_dependency(SaleService)


# ---------- قراءة ----------
@router.get("", response_model=SaleListOut, dependencies=[Depends(require_authenticated)])
def list_sales(service: Service, query: Annotated[SaleListQuery, Query()]):
    return service.list_sales(query)


@router.get("/summary", response_model=SalesSummaryOut, dependencies=[Depends(require_manager)])
def sales_summary(service: Service):
    return service.summary()


@router.get("/returns", response_model=ReturnListOut, dependencies=[Depends(require_manager)])
def list_returns(service: Service, query: Annotated[ReturnListQuery, Query()]):
    return service.list_returns(query)


@router.get(
    "/by-number/{number}",
    response_model=SaleOut,
    dependencies=[Depends(require_authenticated)],
)
def get_by_number(number: Annotated[int, Path(ge=1)], service: Service):
    return service.get_by_number(number)


# ---------- كتابة: الكاشير والمدير (بتصريح كتابة ووردية مفتوحة) ----------
@router.post(
    "",
    response_model=SaleOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_authenticated_write)],
)
def create_sale(data: SaleCreate, service: Service):
    return service.create_sale(data)


@router.post(
    "/exchange",
    response_model=ExchangeOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_authenticated_write)],
)
def exchange(data: ExchangeCreate, service: Service):
    return service.exchange(data)


@router.get("/{sale_id}", response_model=SaleOut, dependencies=[Depends(require_authenticated)])
def get_sale(sale_id: str, service: Service):
    return service.get_sale(sale_id)


@router.post(
    "/{sale_id}/returns",
    response_model=ReturnOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_authenticated_write)],
)
def create_return(sale_id: str, data: ReturnCreate, service: Service):
    return service.create_return(sale_id, data)
