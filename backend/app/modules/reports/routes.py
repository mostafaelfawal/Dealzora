"""طبقة HTTP فقط. كل التقارير للمدير (فيها التكلفة والأرباح)."""

from typing import Annotated

from datetime import timedelta

from fastapi import APIRouter, Depends, Query

from app.core.plan import FREE_LIMITS, Feature, ensure_feature, is_free, upgrade_error
from app.core.periods import local_today
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
from .extended import (
    CashiersReportOut,
    CustomersReportOut,
    ExtendedReportService,
    PromotionsReportOut,
    PurchasesReportOut,
    ReturnsReportOut,
)
from .service import ReportService

router = APIRouter(prefix="/reports", tags=["reports"], dependencies=[Depends(require_manager)])
Service = service_dependency(ReportService)


def _check_range(query: RangeQuery) -> None:
    """بَسطة: تقارير آخر 7 أيام فقط (اليوم + 6 قبله)."""
    if is_free():
        oldest = local_today() - timedelta(days=FREE_LIMITS["report_days"] - 1)
        if query.date_from < oldest:
            raise upgrade_error(Feature.FULL_REPORTS)


@router.get("/overview", response_model=OverviewOut)
def overview(service: Service, query: Annotated[RangeQuery, Query()]):
    _check_range(query)
    return service.overview(query)


@router.get("/sales", response_model=SalesReportOut)
def sales_report(service: Service, query: Annotated[RangeQuery, Query()]):
    _check_range(query)
    return service.sales(query)


@router.get("/products", response_model=ProductsReportOut)
def products_report(service: Service, query: Annotated[ProductsQuery, Query()]):
    _check_range(query)
    return service.products(query)


@router.get("/stock", response_model=StockReportOut)
def stock_report(service: Service, query: Annotated[StockQuery, Query()]):
    return service.stock(query)


@router.get("/debts", response_model=DebtsReportOut)
def debts_report(service: Service):
    ensure_feature(Feature.FULL_REPORTS)  # الديون = العملاء والآجل (خطة مدفوعة)
    return service.debts()


@router.get("/treasury", response_model=TreasuryReportOut)
def treasury_report(service: Service, query: Annotated[RangeQuery, Query()]):
    _check_range(query)
    return service.treasury(query)


# ================= تقارير الميزات الإضافية (extended.py) =================
Extended = service_dependency(ExtendedReportService)


@router.get("/purchases", response_model=PurchasesReportOut)
def purchases_report(service: Extended, query: Annotated[RangeQuery, Query()]):
    ensure_feature(Feature.SUPPLIERS)
    _check_range(query)
    return service.purchases(query)


@router.get("/promotions", response_model=PromotionsReportOut)
def promotions_report(service: Extended, query: Annotated[RangeQuery, Query()]):
    _check_range(query)
    return service.promotions(query)


@router.get("/returns", response_model=ReturnsReportOut)
def returns_report(service: Extended, query: Annotated[RangeQuery, Query()]):
    _check_range(query)
    return service.returns(query)


@router.get("/customers", response_model=CustomersReportOut)
def customers_report(service: Extended, query: Annotated[RangeQuery, Query()]):
    ensure_feature(Feature.CUSTOMERS)
    _check_range(query)
    return service.customers(query)


@router.get("/cashiers", response_model=CashiersReportOut)
def cashiers_report(service: Extended, query: Annotated[RangeQuery, Query()]):
    _check_range(query)
    return service.cashiers(query)
