"""نقاط الولاء: كشف نقاط العميل (لمن يبيع) والتعديل اليدوي (للمدير). الإعداد في /settings/loyalty."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.deps import ActorDep, SessionDep
from app.core.permissions import require_authenticated, require_manager_write
from app.core.plan import Feature, require_feature_for_writes

from .service import AdjustIn, LoyaltyHistoryOut, LoyaltyService

router = APIRouter(
    prefix="/loyalty",
    tags=["loyalty"],
    dependencies=[require_feature_for_writes(Feature.CUSTOMERS)],
)


@router.get(
    "/customers/{customer_id}",
    response_model=LoyaltyHistoryOut,
    dependencies=[Depends(require_authenticated)],
)
def history(
    customer_id: str,
    session: SessionDep,
    actor: ActorDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
):
    return LoyaltyService(session, actor).history(customer_id, page, page_size)


@router.post(
    "/customers/{customer_id}/adjust",
    response_model=LoyaltyHistoryOut,
    dependencies=[Depends(require_manager_write)],
)
def adjust(customer_id: str, data: AdjustIn, session: SessionDep, actor: ActorDep):
    return LoyaltyService(session, actor).adjust(customer_id, data)
