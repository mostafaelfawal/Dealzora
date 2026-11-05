"""طبقة HTTP فقط. الثابتة (summary) قبل /{entry_id}."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import Actor, get_actor

from app.core.permissions import require_admin, require_admin_write
from .schema import (
    CashEntryOut,
    CashListOut,
    CashListQuery,
    ManualEntryCreate,
    TreasurySummaryOut,
)
from .service import TreasuryService

router = APIRouter(prefix="/treasury", tags=["treasury"])


def get_treasury_service(
    session: Annotated[Session, Depends(get_session)],
    actor: Annotated[Actor, Depends(get_actor)],
) -> TreasuryService:
    return TreasuryService(session, actor)


Service = Annotated[TreasuryService, Depends(get_treasury_service)]


@router.get("", response_model=CashListOut, dependencies=[Depends(require_admin)])
def list_entries(service: Service, query: Annotated[CashListQuery, Query()]):
    return service.list_entries(query)


@router.get("/summary", response_model=TreasurySummaryOut, dependencies=[Depends(require_admin)])
def treasury_summary(service: Service):
    return service.summary()


@router.post(
    "/manual",
    response_model=CashEntryOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_write)],
)
def create_manual_entry(data: ManualEntryCreate, service: Service):
    return service.create_manual(data)


@router.delete(
    "/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin_write)],
)
def delete_manual_entry(entry_id: str, service: Service, base_version: Annotated[int, Query(ge=1)]):
    service.delete_manual(entry_id, base_version)
    return Response(status_code=status.HTTP_204_NO_CONTENT)