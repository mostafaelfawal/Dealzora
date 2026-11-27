"""طبقة HTTP فقط. الحجز يحتاج عميلاً، فهو من خطة العملاء. الثابتة (customer) قبل /{id}."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import service_dependency
from app.core.permissions import require_authenticated, require_authenticated_write
from app.core.plan import Feature, require_feature

from .schema import (
    ReservationCreate,
    ReservationListOut,
    ReservationListQuery,
    ReservationOut,
    ReservationUpdate,
)
from .service import ReservationService

router = APIRouter(
    prefix="/reservations",
    tags=["reservations"],
    dependencies=[require_feature(Feature.CUSTOMERS)],
)
Service = service_dependency(ReservationService)


@router.get("", response_model=ReservationListOut, dependencies=[Depends(require_authenticated)])
def list_reservations(service: Service, query: Annotated[ReservationListQuery, Query()]):
    return service.list_reservations(query)


@router.get(
    "/customer/{customer_id}",
    response_model=list[ReservationOut],
    dependencies=[Depends(require_authenticated)],
)
def open_for_customer(customer_id: str, service: Service):
    return service.open_for_customer(customer_id)


@router.get("/{reservation_id}", response_model=ReservationOut, dependencies=[Depends(require_authenticated)])
def get_reservation(reservation_id: str, service: Service):
    return service.get(reservation_id)


@router.post(
    "",
    response_model=ReservationOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_authenticated_write)],
)
def create_reservation(data: ReservationCreate, service: Service):
    return service.create(data)


@router.patch(
    "/{reservation_id}", response_model=ReservationOut, dependencies=[Depends(require_authenticated_write)]
)
def update_reservation(reservation_id: str, data: ReservationUpdate, service: Service):
    return service.update(reservation_id, data)


@router.post(
    "/{reservation_id}/ready", response_model=ReservationOut, dependencies=[Depends(require_authenticated_write)]
)
def mark_ready(reservation_id: str, service: Service, ready: bool = True):
    return service.set_ready(reservation_id, ready)


@router.post(
    "/{reservation_id}/cancel", response_model=ReservationOut, dependencies=[Depends(require_authenticated_write)]
)
def cancel_reservation(reservation_id: str, service: Service):
    return service.cancel(reservation_id)
