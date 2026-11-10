"""طبقة HTTP فقط: الأقسام (/categories) ووحدات القياس (/units).

القراءة للكاشير والمدير (الفلاتر وفورم الصنف)، والكتابة للمدير + تصريح كتابة.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.permissions import require_admin_write, require_cashier
from app.core.security import Actor, get_actor

from .schema import (
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    MeasureUnitCreate,
    MeasureUnitOut,
    MeasureUnitUpdate,
)
from .service import CategoryService, MeasureUnitService

router = APIRouter(tags=["catalog"])

DbSession = Annotated[Session, Depends(get_session)]
CurrentActor = Annotated[Actor, Depends(get_actor)]
BaseVersion = Annotated[int, Query(ge=1)]


def get_category_service(session: DbSession, actor: CurrentActor) -> CategoryService:
    return CategoryService(session, actor)


def get_unit_service(session: DbSession, actor: CurrentActor) -> MeasureUnitService:
    return MeasureUnitService(session, actor)


Categories = Annotated[CategoryService, Depends(get_category_service)]
Units = Annotated[MeasureUnitService, Depends(get_unit_service)]


# ================= الأقسام =================
@router.get("/categories", response_model=list[CategoryOut], dependencies=[Depends(require_cashier)])
def list_categories(service: Categories):
    return service.list_categories()


@router.post(
    "/categories",
    response_model=CategoryOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_write)],
)
def create_category(data: CategoryCreate, service: Categories):
    return service.create_category(data)


@router.put("/categories/{category_id}", response_model=CategoryOut, dependencies=[Depends(require_admin_write)])
def update_category(category_id: str, data: CategoryUpdate, service: Categories):
    return service.update_category(category_id, data)


@router.delete(
    "/categories/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin_write)],
)
def delete_category(category_id: str, service: Categories, base_version: BaseVersion):
    service.delete_category(category_id, base_version)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ================= الوحدات =================
@router.get("/units", response_model=list[MeasureUnitOut], dependencies=[Depends(require_cashier)])
def list_units(service: Units):
    return service.list_units()


@router.post(
    "/units",
    response_model=MeasureUnitOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_write)],
)
def create_unit(data: MeasureUnitCreate, service: Units):
    return service.create_unit(data)


@router.put("/units/{unit_id}", response_model=MeasureUnitOut, dependencies=[Depends(require_admin_write)])
def update_unit(unit_id: str, data: MeasureUnitUpdate, service: Units):
    return service.update_unit(unit_id, data)


@router.delete(
    "/units/{unit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin_write)],
)
def delete_unit(unit_id: str, service: Units, base_version: BaseVersion):
    service.delete_unit(unit_id, base_version)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
