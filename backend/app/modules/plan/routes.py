"""الخطة الحالية وحدودها، لتقفل الواجهة الميزات غير المتاحة وتعرض رسالة الترقية.
الإنفاذ الفعلي في الـ backend (core/plan.py)؛ هذا للعرض فقط."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.plan import FREE_LIMITS, PLAN_NAMES, current_plan, enabled_features, is_free
from app.core.security import require_app_token

router = APIRouter(prefix="/plan", tags=["plan"], dependencies=[Depends(require_app_token)])


class PlanLimitsOut(BaseModel):
    products: int | None  # None = بلا حد
    users: int | None
    report_days: int | None


class PlanOut(BaseModel):
    plan: str
    name: str
    is_free: bool
    features: list[str]
    limits: PlanLimitsOut


@router.get("", response_model=PlanOut)
def get_plan():
    plan = current_plan()
    free = is_free()
    return PlanOut(
        plan=plan.value,
        name=PLAN_NAMES[plan],
        is_free=free,
        features=[f.value for f in enabled_features()],
        limits=PlanLimitsOut(**FREE_LIMITS) if free else PlanLimitsOut(products=None, users=None, report_days=None),
    )
