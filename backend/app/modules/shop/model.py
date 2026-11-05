"""جدول المحل (صف واحد فقط، يُفرض في الـ service)."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, SyncMixin

from .constants import MAX_SHOP_NAME_LEN


class Shop(SyncMixin, Base):
    __tablename__ = "shop"

    name: Mapped[str] = mapped_column(String(MAX_SHOP_NAME_LEN))