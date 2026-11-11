"""أجهزة الكاشير.

بدون توكن (جهاز كاشير لم يُقترن بعد): /devices/hello و /devices/pair فقط — والاقتران محمي بالكود.
الباقي: أي جهاز معروف، وإدارة الاقتران من الجهاز الأساسي فقط.
"""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.caller import Caller, CallerDep, require_main_device
from app.core.config import get_settings
from app.core.deps import ActorDep, SessionDep
from app.core.errors import BadRequestError
from app.core.permissions import require_manager, require_manager_write
from app.core.text import collapse_spaces

from . import runtime
from .service import DeviceService, lan_addresses

router = APIRouter(prefix="/devices", tags=["devices"])

API_VERSION = 1
MainDevice = Annotated[Caller, Depends(require_main_device)]


def _clean_name(value: str) -> str:
    value = collapse_spaces(value)
    if not 2 <= len(value) <= 40:
        raise ValueError("اسم الجهاز من 2 إلى 40 حرفاً")
    return value


class PairIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(pattern=r"^\d{6}$")
    name: str

    _name = field_validator("name")(_clean_name)


class PairOut(BaseModel):
    device_id: str
    device_token: str  # يُعرض مرة واحدة فقط
    name: str


class LeaseIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lease: str = Field(max_length=200)


class RenameIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str

    _name = field_validator("name")(_clean_name)


class DeviceOut(BaseModel):
    id: str
    name: str
    last_seen_at: datetime | None
    online: bool
    paired_at: datetime


class NetworkOut(BaseModel):
    lan_enabled: bool  # الـ backend يستمع على الشبكة (لا 127.0.0.1 فقط)
    addresses: list[str]
    port: int
    max_terminals: int | None  # None = الترخيص غير مقروء بعد (البرنامج لم يجدد العقد)
    pairing_expires_at: datetime | None
    devices: list[DeviceOut]


class MeOut(BaseModel):
    device_id: str
    name: str
    is_main: bool


class PairingCodeOut(BaseModel):
    code: str
    expires_at: datetime


def _ts(value: float | None) -> datetime | None:
    return datetime.fromtimestamp(value, tz=timezone.utc) if value else None


# ================= بدون توكن =================
@router.get("/hello")
def hello():
    """اختبار الاتصال من جهاز الكاشير قبل الاقتران (لا يكشف أي بيانات)."""
    return {"app": "dealzora", "api": API_VERSION}


@router.post("/pair", response_model=PairOut, status_code=status.HTTP_201_CREATED)
def pair(data: PairIn, session: SessionDep):
    device, token = DeviceService(session).pair(data.code, data.name)
    return PairOut(device_id=device.id, device_token=token, name=device.name)


# ================= أي جهاز معروف =================
@router.get("/me", response_model=MeOut)
def me(caller: CallerDep):
    return MeOut(device_id=caller.device_id, name=caller.name, is_main=caller.is_main)


# ================= الجهاز الأساسي =================
@router.post("/lease", status_code=status.HTTP_204_NO_CONTENT)
def renew_lease(data: LeaseIn, _main: MainDevice):
    """واجهة الجهاز الأساسي تجدد عقد الترخيص كل دقيقتين (من Rust)."""
    lease = runtime.parse_lease(data.lease)
    if lease is None:
        raise BadRequestError("lease_invalid", "عقد الترخيص غير صالح")
    runtime.set_lease(lease)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("", response_model=NetworkOut, dependencies=[Depends(require_manager)])
def network(session: SessionDep):
    svc = DeviceService(session)
    settings = get_settings()
    lease = runtime.active_lease()
    return NetworkOut(
        lan_enabled=settings.host not in ("127.0.0.1", "localhost"),
        addresses=lan_addresses(),
        port=settings.port,
        max_terminals=lease.max_terminals if lease else None,
        pairing_expires_at=_ts(runtime.pairing_status()),
        devices=[
            DeviceOut(
                id=d.id,
                name=d.name,
                last_seen_at=d.last_seen_at,
                online=svc.is_online(d),
                paired_at=d.created_at,
            )
            for d in svc.live_devices()
        ],
    )


@router.post(
    "/pairing-code",
    response_model=PairingCodeOut,
    dependencies=[Depends(require_manager_write)],
)
def pairing_code(_main: MainDevice):
    code, expires = runtime.new_pairing_code()
    return PairingCodeOut(code=code, expires_at=_ts(expires))


@router.patch("/{device_id}", response_model=DeviceOut, dependencies=[Depends(require_manager_write)])
def rename(device_id: str, data: RenameIn, session: SessionDep, actor: ActorDep, _main: MainDevice):
    svc = DeviceService(session)
    d = svc.rename(actor, device_id, data.name)
    return DeviceOut(
        id=d.id, name=d.name, last_seen_at=d.last_seen_at, online=svc.is_online(d), paired_at=d.created_at
    )


@router.delete(
    "/{device_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_manager_write)],
)
def revoke(device_id: str, session: SessionDep, actor: ActorDep, _main: MainDevice):
    DeviceService(session).revoke(actor, device_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
