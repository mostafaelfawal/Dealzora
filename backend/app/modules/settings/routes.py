"""الإعدادات العامة. القراءة بتوكن التطبيق فقط (مثل /shop) لأن العملة تظهر في كل الشاشات."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.permissions import require_manager_write
from app.core.security import Actor, get_actor, require_app_token

from app.core.plan import Feature, require_feature

from .schema import CurrencyIn, CurrencyOut, PaymentConfigIn, PaymentConfigOut, PublicSettingsOut
from .service import SettingsService

router = APIRouter(prefix="/settings", tags=["settings"], dependencies=[Depends(require_app_token)])

DbSession = Annotated[Session, Depends(get_session)]


@router.get("", response_model=PublicSettingsOut)
def get_settings_public(session: DbSession):
    service = SettingsService(session)
    return PublicSettingsOut(currency=service.currency(), payments=service.payment_config())


@router.put("/currency", response_model=CurrencyOut, dependencies=[Depends(require_manager_write)])
def set_currency(data: CurrencyIn, session: DbSession, actor: Annotated[Actor, Depends(get_actor)]):
    return SettingsService(session).set_currency(actor, data)


@router.put(
    "/payments",
    response_model=PaymentConfigOut,
    dependencies=[Depends(require_manager_write), require_feature(Feature.WALLETS)],
)
def set_payment_config(
    data: PaymentConfigIn, session: DbSession, actor: Annotated[Actor, Depends(get_actor)]
):
    return SettingsService(session).set_payment_config(actor, data)
