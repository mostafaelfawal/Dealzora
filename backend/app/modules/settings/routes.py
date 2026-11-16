"""الإعدادات العامة. القراءة بتوكن التطبيق فقط (مثل /shop) لأن العملة تظهر في كل الشاشات."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.permissions import require_authenticated_write, require_manager_write
from app.core.security import Actor, get_actor, require_app_token

from app.core.plan import Feature, require_feature

from .exchange import ExchangeConfig, ExchangeOut
from .receipt import ReceiptConfig
from .scale import ScaleBarcodeConfig
from app.modules.loyalty.config import LoyaltyConfig
from app.modules.tax.config import TaxConfig
from .schema import (
    CurrencyIn,
    CurrencyOut,
    DiscountLimitIn,
    DiscountLimitOut,
    PaymentConfigIn,
    PaymentConfigOut,
    PublicSettingsOut,
)
from .service import SettingsService

router = APIRouter(prefix="/settings", tags=["settings"], dependencies=[Depends(require_app_token)])

DbSession = Annotated[Session, Depends(get_session)]


@router.get("", response_model=PublicSettingsOut)
def get_settings_public(session: DbSession):
    service = SettingsService(session)
    return PublicSettingsOut(
        currency=service.currency(),
        payments=service.payment_config(),
        discount_limit=service.discount_limit(),
        scale_barcode=service.scale_barcode(),
        loyalty=service.loyalty(),
        tax=service.tax(),
        receipt=service.receipt(),
        exchange=service.exchange(),
    )


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


@router.put("/discount-limit", response_model=DiscountLimitOut, dependencies=[Depends(require_manager_write)])
def set_discount_limit(
    data: DiscountLimitIn, session: DbSession, actor: Annotated[Actor, Depends(get_actor)]
):
    return SettingsService(session).set_discount_limit(actor, data)


@router.put(
    "/scale-barcode",
    response_model=ScaleBarcodeConfig,
    dependencies=[Depends(require_manager_write), require_feature(Feature.SCALE_BARCODE)],
)
def set_scale_barcode(
    data: ScaleBarcodeConfig, session: DbSession, actor: Annotated[Actor, Depends(get_actor)]
):
    return SettingsService(session).set_scale_barcode(actor, data)


@router.put(
    "/loyalty",
    response_model=LoyaltyConfig,
    dependencies=[Depends(require_manager_write), require_feature(Feature.LOYALTY)],
)
def set_loyalty(data: LoyaltyConfig, session: DbSession, actor: Annotated[Actor, Depends(get_actor)]):
    return SettingsService(session).set_loyalty(actor, data)


# ضريبة القيمة المضافة: متاحة لكل الخطط.
@router.put("/tax", response_model=TaxConfig, dependencies=[Depends(require_manager_write)])
def set_tax(data: TaxConfig, session: DbSession, actor: Annotated[Actor, Depends(get_actor)]):
    return SettingsService(session).set_tax(actor, data)


# شكل الفاتورة المطبوعة: متاح لكل الخطط.
@router.put("/receipt", response_model=ReceiptConfig, dependencies=[Depends(require_manager_write)])
def set_receipt(data: ReceiptConfig, session: DbSession, actor: Annotated[Actor, Depends(get_actor)]):
    return SettingsService(session).set_receipt(actor, data)


# العملة الثانية وسعر الصرف: متاحة لكل الخطط.
@router.put("/exchange", response_model=ExchangeOut, dependencies=[Depends(require_manager_write)])
def set_exchange(data: ExchangeConfig, session: DbSession, actor: Annotated[Actor, Depends(get_actor)]):
    return SettingsService(session).set_exchange(actor, data)


# تحديث السعر من الإنترنت: أي مستخدم (اللوحة تحدّثه تلقائياً لو قديم).
@router.post(
    "/exchange/refresh", response_model=ExchangeOut, dependencies=[Depends(require_authenticated_write)]
)
def refresh_exchange(session: DbSession, actor: Annotated[Actor, Depends(get_actor)]):
    return SettingsService(session).refresh_exchange_rate(actor)
