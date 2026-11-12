"""العروض التلقائية: تُطبَّق على الفاتورة بدون تدخل الكاشير (والسيرفر يعيد حسابها ويتحقق منها).

الأنواع:
- percent: خصم نسبة من سعر الصنف (value = النسبة 1..100).
- amount:  خصم مبلغ ثابت على كل وحدة أساسية (value = قروش).
- buy_get: اشتري X وخد Y مجاناً من نفس الصنف (buy_qty / get_qty).
"""

from datetime import date

from sqlalchemy import JSON, Boolean, Date, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, SyncMixin

from .constants import MAX_NAME_LEN, PromoScope


class Promotion(SyncMixin, Base):
    __tablename__ = "promotions"

    name: Mapped[str] = mapped_column(String(MAX_NAME_LEN))
    kind: Mapped[str] = mapped_column(String(16))
    value: Mapped[int] = mapped_column(Integer, default=0)
    buy_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    get_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    min_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)  # × 1000 (للخصومات)
    scope: Mapped[str] = mapped_column(String(16), default=PromoScope.PRODUCTS.value)
    category_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    product_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    starts_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    ends_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
