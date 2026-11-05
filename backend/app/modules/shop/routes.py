"""طبقة HTTP فقط. GET عام (بتوكن التطبيق) كي تعرض شاشة الدخول اسم المحل."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import Actor, get_actor, require_app_token
from app.core.permissions import require_manager_write

from .schema import ShopOut, ShopUpdate
from .service import ShopService

router = APIRouter(prefix="/shop", tags=["shop"], dependencies=[Depends(require_app_token)])


@router.get("", response_model=ShopOut)
def get_shop(session: Annotated[Session, Depends(get_session)]):
    return ShopService(session).get()


@router.patch("", response_model=ShopOut, dependencies=[Depends(require_manager_write)])
def rename_shop(
    data: ShopUpdate,
    session: Annotated[Session, Depends(get_session)],
    actor: Annotated[Actor, Depends(get_actor)],
):
    return ShopService(session).rename(actor, data)