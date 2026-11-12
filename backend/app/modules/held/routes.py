"""الفواتير المعلّقة (لكل كاشير ومدير). التعليق يحتاج وردية مفتوحة على الجهاز."""

from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel, ConfigDict

from app.core.deps import ActorDep, SessionDep
from app.core.permissions import require_authenticated, require_authenticated_write

from .service import HeldService

router = APIRouter(prefix="/held", tags=["held"])


def get_service(session: SessionDep, actor: ActorDep) -> HeldService:
    return HeldService(session, actor)


Service = Annotated[HeldService, Depends(get_service)]


class HoldIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    invoice: dict[str, Any]


class HeldOut(BaseModel):
    id: str
    held_at: datetime
    invoice: dict[str, Any]
    item_count: int
    total: int  # قروش
    customer_name: str | None
    cashier_name: str | None
    device_name: str | None


@router.get("", response_model=list[HeldOut], dependencies=[Depends(require_authenticated)])
def list_held(service: Service):
    return service.list_all()


@router.post(
    "",
    response_model=HeldOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_authenticated_write)],
)
def hold(data: HoldIn, service: Service):
    return service.hold(data.invoice)


@router.post(
    "/{held_id}/recall",
    response_model=dict[str, Any],
    dependencies=[Depends(require_authenticated_write)],
)
def recall(held_id: str, service: Service):
    """يرجّع الفاتورة ويحذفها من المعلّقة في نفس المعاملة (جهاز واحد فقط يأخذها)."""
    return service.recall(held_id)


@router.delete(
    "/{held_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_authenticated_write)],
)
def discard(held_id: str, service: Service):
    service.discard(held_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
