"""طبقة HTTP لمنظومة الإيصال الإلكتروني. كلها لخطة «سلسلة» (رسالة الترقية المعتادة لغيرها) وللمدير."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.errors import NotFoundError
from app.core.permissions import require_manager, require_manager_write
from app.core.plan import Feature, require_feature
from app.core.security import Actor, get_actor

from .codes import CodeTable
from .constants import ERROR_MESSAGES, EtaError
from .schema import (
    CodeOut,
    DeviceProfileIn,
    DeviceProfileOut,
    EtaBranch,
    EtaConfig,
    ReadinessOut,
    UnitMappingIn,
    UnitMappingOut,
)
from .service import EtaService

router = APIRouter(prefix="/eta", tags=["eta"], dependencies=[require_feature(Feature.E_RECEIPT)])

DbSession = Annotated[Session, Depends(get_session)]


def get_service(session: DbSession, actor: Annotated[Actor, Depends(get_actor)]) -> EtaService:
    return EtaService(session, actor)


Service = Annotated[EtaService, Depends(get_service)]
READ = [Depends(require_manager)]
WRITE = [Depends(require_manager_write)]


@router.get("/config", response_model=EtaConfig, dependencies=READ)
def get_config(service: Service):
    return service.config()


@router.put("/config", response_model=EtaConfig, dependencies=WRITE)
def set_config(data: EtaConfig, service: Service):
    return service.set_config(data)


@router.get("/branch", response_model=EtaBranch, dependencies=READ)
def get_branch(service: Service):
    return service.branch()


@router.put("/branch", response_model=EtaBranch, dependencies=WRITE)
def set_branch(data: EtaBranch, service: Service):
    return service.set_branch(data)


@router.get("/devices", response_model=list[DeviceProfileOut], dependencies=READ)
def list_devices(service: Service):
    return service.devices()


@router.put("/devices/{device_id}", response_model=DeviceProfileOut, dependencies=WRITE)
def set_device(device_id: str, data: DeviceProfileIn, service: Service):
    return service.set_device(device_id, data)


@router.get("/units", response_model=list[UnitMappingOut], dependencies=READ)
def list_units(service: Service):
    return service.units()


@router.put("/units/{unit_id}", response_model=UnitMappingOut, dependencies=WRITE)
def set_unit(unit_id: str, data: UnitMappingIn, service: Service):
    return service.set_unit(unit_id, data)


@router.get("/readiness", response_model=ReadinessOut, dependencies=READ)
def readiness(service: Service):
    return service.readiness()


@router.get("/codes/{name}", response_model=list[CodeOut], dependencies=READ)
def get_codes(name: str):
    try:
        table = CodeTable(name)
    except ValueError as exc:
        raise NotFoundError(EtaError.UNKNOWN_TABLE.value, ERROR_MESSAGES[EtaError.UNKNOWN_TABLE]) from exc
    return EtaService.codes(table)
