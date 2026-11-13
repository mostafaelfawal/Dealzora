"""اقتران وإدارة أجهزة الكاشير على الجهاز الأساسي."""

import secrets
import socket
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.base import utcnow, uuid7
from app.core.caller import hash_device_token
from app.core.config import get_settings
from app.core.errors import ConflictError, ForbiddenError, NotFoundError, UnauthorizedError
from app.core.security import Actor

from . import runtime
from .model import Device

ENTITY_DEVICE = "device"
ONLINE_WINDOW = timedelta(minutes=2)

_PAIR_ERRORS = {
    "invalid": "كود الاقتران غير صحيح",
    "expired": "انتهت صلاحية الكود. اطلب كوداً جديداً من الجهاز الأساسي",
    "locked": "محاولات كثيرة خاطئة. انتظر 10 دقائق ثم اطلب كوداً جديداً",
}


def lan_addresses() -> list[str]:
    """عناوين IPv4 لهذا الجهاز على الشبكة المحلية (لعرضها للمدير عند ربط جهاز كاشير)."""
    found: set[str] = set()
    try:
        # لا يُرسل أي بيانات؛ فقط يحدد كارت الشبكة المستخدم للخروج.
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            found.add(s.getsockname()[0])
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            found.add(info[4][0])
    except OSError:
        pass
    return sorted(a for a in found if not a.startswith("127.") and not a.startswith("169.254."))


class DeviceService:
    def __init__(self, session: Session) -> None:
        self.session = session

    # ---------- قراءة ----------
    def live_devices(self) -> list[Device]:
        stmt = select(Device).where(Device.deleted_at.is_(None)).order_by(Device.created_at)
        return list(self.session.scalars(stmt).all())

    def count_live(self) -> int:
        stmt = select(func.count()).select_from(Device).where(Device.deleted_at.is_(None))
        return self.session.scalar(stmt) or 0

    @staticmethod
    def is_online(device: Device) -> bool:
        seen = device.last_seen_at
        if seen is None:
            return False
        now = utcnow()
        seen = seen if seen.tzinfo else seen.replace(tzinfo=now.tzinfo)
        return now - seen < ONLINE_WINDOW

    # ---------- اقتران ----------
    def pair(self, code: str, name: str) -> tuple[Device, str]:
        """يرجع الجهاز الجديد والتوكن الخام (يُرسل مرة واحدة فقط، ولا نخزّن إلا hash له)."""
        lease = runtime.active_lease()
        if lease is None:
            raise ForbiddenError(
                "main_license_inactive",
                "الجهاز الأساسي غير جاهز: افتح البرنامج عليه وتأكد أن الترخيص فعّال",
            )
        reason = runtime.consume_pairing_code(code)
        if reason:
            raise UnauthorizedError(f"pairing_{reason}", _PAIR_ERRORS[reason])
        limit = runtime.max_terminals(lease)
        if self.count_live() >= limit:
            raise ConflictError(
                "device_limit_reached",
                f"وصلت للحد الأقصى لأجهزة الكاشير في ترخيصك ({limit}). "
                "ألغِ جهازاً قديماً أو رقِّ الترخيص",
            )
        token = secrets.token_urlsafe(32)
        device = Device(
            id=uuid7(),
            name=name,
            token_hash=hash_device_token(token),
            device_id=get_settings().device_id,  # أُنشئ على الجهاز الأساسي
            last_seen_at=utcnow(),
        )
        self.session.add(device)
        self.session.flush()
        self.session.commit()
        return device, token

    def revoke(self, actor: Actor, device_id: str) -> None:
        device = self.session.get(Device, device_id)
        if device is None or device.deleted_at is not None:
            raise NotFoundError("device_not_found", "الجهاز غير موجود")
        device.mark_deleted()
        record_audit(
            self.session, actor, entity=ENTITY_DEVICE, entity_id=device.id, action="revoke",
            changes={"name": device.name},
        )  # fmt: skip
        self.session.commit()

    def rename(self, actor: Actor, device_id: str, name: str) -> Device:
        device = self.session.get(Device, device_id)
        if device is None or device.deleted_at is not None:
            raise NotFoundError("device_not_found", "الجهاز غير موجود")
        if device.name != name:
            before = device.name
            device.name = name
            device.mark_modified()
            record_audit(
                self.session, actor, entity=ENTITY_DEVICE, entity_id=device.id, action="rename",
                changes={"name": {"from": before, "to": name}},
            )  # fmt: skip
            self.session.commit()
        return device


def device_names(session: Session) -> dict[str, str]:
    """device_id ← اسم للعرض (يشمل الأجهزة الملغاة، لأن ورديات قديمة قد تخصها)."""
    from app.core.caller import MAIN_DEVICE_NAME

    names = {d_id: name for d_id, name in session.execute(select(Device.id, Device.name)).all()}
    names[get_settings().device_id] = MAIN_DEVICE_NAME
    return names
