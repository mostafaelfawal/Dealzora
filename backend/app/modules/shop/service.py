"""قواعد عمل المحل. create_initial لا يعمل commit: يُستدعى من معاملة الإعداد الأول في users."""

from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.base import uuid7
from app.core.errors import AppError, ConflictError
from app.core.security import Actor

from .constants import ENTITY_SHOP, ERROR_MESSAGES, ShopError
from .model import Shop
from .repository import ShopRepository
from .schema import ShopOut, ShopUpdate


def _err(exc: type[AppError], code: ShopError) -> AppError:
    return exc(code=code.value, message=ERROR_MESSAGES[code])


class ShopService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repo = ShopRepository(session)

    def get(self) -> ShopOut:
        shop = self.repo.get()
        return ShopOut(name=shop.name if shop else None)

    def create_initial(self, actor: Actor, name: str) -> None:
        if self.repo.get() is not None:
            raise _err(ConflictError, ShopError.ALREADY_EXISTS)
        shop = Shop(id=uuid7(), name=name, device_id=actor.device_id, created_by=actor.user_id)
        self.repo.add(shop)
        record_audit(self.session, actor, entity=ENTITY_SHOP, entity_id=shop.id, action="create", changes={"name": name})

    def rename(self, actor: Actor, data: ShopUpdate) -> ShopOut:
        shop = self.repo.get()
        if shop is None:
            self.create_initial(actor, data.name)
        elif shop.name != data.name:
            before = shop.name
            shop.name = data.name
            shop.mark_modified()
            record_audit(
                self.session, actor, entity=ENTITY_SHOP, entity_id=shop.id, action="rename",
                changes={"name": {"from": before, "to": data.name}},
            )
        self.session.commit()
        return ShopOut(name=data.name)