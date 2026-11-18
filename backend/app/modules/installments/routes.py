"""طبقة HTTP فقط: استقبال الطلب، حماية الدور، استدعاء الـ service. لا منطق عمل هنا.

ترتيب المسارات مهم: الثابتة (summary) قبل /{plan_id}.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.permissions import require_admin, require_admin_write
from app.core.plan import Feature, require_feature
from app.core.security import Actor, get_actor

from .schema import (
    PlanCreate,
    PlanDetailOut,
    PlanListQuery,
    PlanOut,
    PlanPaymentIn,
    PlansSummaryOut,
)
from .service import InstallmentService

# نظام التقسيط كله (قراءة وكتابة) من خطة «سوق».
router = APIRouter(
    prefix="/installments",
    tags=["installments"],
    dependencies=[require_feature(Feature.INSTALLMENTS)],
)


def get_installment_service(
    session: Annotated[Session, Depends(get_session)],
    actor: Annotated[Actor, Depends(get_actor)],
) -> InstallmentService:
    return InstallmentService(session, actor)


Service = Annotated[InstallmentService, Depends(get_installment_service)]


# ---------- قراءة: مدير ----------
@router.get("", response_model=list[PlanOut], dependencies=[Depends(require_admin)])
def list_plans(service: Service, query: Annotated[PlanListQuery, Query()]):
    return service.list_plans(query)


@router.get("/summary", response_model=PlansSummaryOut, dependencies=[Depends(require_admin)])
def plans_summary(service: Service):
    return service.summary()


@router.get("/{plan_id}", response_model=PlanDetailOut, dependencies=[Depends(require_admin)])
def get_plan(plan_id: str, service: Service):
    return service.get_plan(plan_id)


# ---------- كتابة: مدير + تصريح كتابة ----------
@router.post(
    "",
    response_model=PlanDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_write)],
)
def create_plan(data: PlanCreate, service: Service):
    return service.create_plan(data)


@router.post(
    "/{plan_id}/payments",
    response_model=PlanDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_write)],
)
def pay_installment(plan_id: str, data: PlanPaymentIn, service: Service):
    return service.pay(plan_id, data)


@router.post(
    "/{plan_id}/cancel",
    response_model=PlanDetailOut,
    dependencies=[Depends(require_admin_write)],
)
def cancel_plan(plan_id: str, service: Service, base_version: Annotated[int, Query(ge=1)]):
    return service.cancel(plan_id, base_version)
