"""الوصول لقاعدة البيانات فقط. لا قواعد عمل ولا commit هنا."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from .model import Shop


class ShopRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self) -> Shop | None:
        stmt = select(Shop).where(Shop.deleted_at.is_(None)).limit(1)
        return self.session.scalars(stmt).first()

    def add(self, shop: Shop) -> None:
        self.session.add(shop)