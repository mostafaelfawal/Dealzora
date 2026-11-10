"""طبقة HTTP فقط. كل التقارير للمدير (فيها التكلفة والأرباح)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.deps import service_dependency
from app.core.permissions import require_manager

from .schema import (
    DebtsReportOut,
    OverviewOut,
    ProductsQuery,
    ProductsReportOut,
    RangeQuery,
    SalesReportOut,
    StockQuery,
    StockReportOut,
    TreasuryReportOut,
)
from .service import ReportService

router = APIRouter(prefix="/reports", tags=["reports"], dependencies=[Depends(require_manager)])
Service = service_dependency(ReportService)


@router.get("/overview", response_model=OverviewOut)
def overview(service: Service, query: Annotated[RangeQuery, Query()]):
    return service.overview(query)


@router.get("/sales", response_model=SalesReportOut)
def sales_report(service: Service, query: Annotated[RangeQuery, Query()]):
    return service.sales(query)


@router.get("/products", response_model=ProductsReportOut)
def products_report(service: Service, query: Annotated[ProductsQuery, Query()]):
    return service.products(query)


@router.get("/stock", response_model=StockReportOut)
def stock_report(service: Service, query: Annotated[StockQuery, Query()]):
    return service.stock(query)


@router.get("/debts", response_model=DebtsReportOut)
def debts_report(service: Service):
    return service.debts()


@router.get("/treasury", response_model=TreasuryReportOut)
def treasury_report(service: Service, query: Annotated[RangeQuery, Query()]):
    return service.treasury(query)
