"""طبقة HTTP فقط. الثابتة (current/open) قبل /{shift_id}."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import service_dependency
from app.core.permissions import (
    require_authenticated,
    require_authenticated_write,
    require_manager,
)

from .schema import ShiftCloseIn, ShiftListOut, ShiftListQuery, ShiftOpenIn, ShiftOut
from .service import ShiftService

router = APIRouter(prefix="/shifts", tags=["shifts"])
Service = service_dependency(ShiftService)


@router.get(
    "/current", response_model=ShiftOut | None, dependencies=[Depends(require_authenticated)]
)
def current_shift(service: Service):
    return service.current()


@router.get("", response_model=ShiftListOut, dependencies=[Depends(require_manager)])
def list_shifts(service: Service, query: Annotated[ShiftListQuery, Query()]):
    return service.list_shifts(query)


@router.post(
    "/open",
    response_model=ShiftOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_authenticated_write)],
)
def open_shift(data: ShiftOpenIn, service: Service):
    return service.open_shift(data)


@router.post(
    "/current/close",
    response_model=ShiftOut,
    dependencies=[Depends(require_authenticated_write)],
)
def close_shift(data: ShiftCloseIn, service: Service):
    return service.close_current(data)


@router.get("/{shift_id}", response_model=ShiftOut, dependencies=[Depends(require_manager)])
def get_shift(shift_id: str, service: Service):
    return service.get_shift(shift_id)
