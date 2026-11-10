"""وحدات القياس. جدول الأقسام نفسه في products.model (الصنف يرتبط به بـ FK).

الصنف يحفظ اسم الوحدة كنص (products.unit / product_units.name)، وهذا الجدول هو
القائمة التي يختار منها المدير. إعادة التسمية تُحدّث الأصناف في نفس المعاملة.
"""

from sqlalchemy import Boolean, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, SyncMixin

from .constants import MAX_UNIT_LEN


class MeasureUnit(SyncMixin, Base):
    __tablename__ = "measure_units"

    name: Mapped[str] = mapped_column(String(MAX_UNIT_LEN))
    allow_decimal: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    __table_args__ = (
        Index(
            "uq_measure_units_name_live",
            "name",
            unique=True,
            sqlite_where=text("deleted_at IS NULL"),
        ),
    )
