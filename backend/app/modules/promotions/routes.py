"""طبقة HTTP فقط. الإدارة للمدير، والعروض السارية لكل من يبيع (الكاشير يحسبها فوراً)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.core.deps import BaseVersionQuery, service_dependency
from app.core.permissions import require_authenticated, require_manager, require_manager_write

from .schema import PromotionIn, PromotionOut, PromotionsSummaryOut, PromotionUpdate
from .service import PromotionService

router = APIRouter(prefix="/promotions", tags=["promotions"])
Service = service_dependency(PromotionService)
Write = [Depends(require_manager_write)]


@router.get("/active", response_model=list[PromotionOut], dependencies=[Depends(require_authenticated)])
def list_active(service: Service):
    return service.list_active()


@router.get("/summary", response_model=PromotionsSummaryOut, dependencies=[Depends(require_manager)])
def summary(service: Service):
    return service.summary()


@router.get("", response_model=list[PromotionOut], dependencies=[Depends(require_manager)])
def list_all(service: Service):
    return service.list_all()


@router.post("", response_model=PromotionOut, status_code=status.HTTP_201_CREATED, dependencies=Write)
def create(data: PromotionIn, service: Service):
    return service.create(data)


@router.put("/{promo_id}", response_model=PromotionOut, dependencies=Write)
def update(promo_id: str, data: PromotionUpdate, service: Service):
    return service.update(promo_id, data)


@router.post("/{promo_id}/toggle", response_model=PromotionOut, dependencies=Write)
def toggle(promo_id: str, base_version: BaseVersionQuery, service: Service):
    return service.toggle(promo_id, base_version)


@router.delete("/{promo_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=Write)
def delete(promo_id: str, base_version: Annotated[int, Query(ge=1)], service: Service):
    service.delete(promo_id, base_version)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
