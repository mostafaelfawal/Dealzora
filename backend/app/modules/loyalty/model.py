"""كشف نقاط العميل (append-only مثل كشف الحساب). الرصيد المخزّن في customers.loyalty_points."""

from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, SyncMixin


class LoyaltyEntry(SyncMixin, Base):
    __tablename__ = "loyalty_ledger"

    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"))
    kind: Mapped[str] = mapped_column(String(16))  # earn / redeem / return / restore / adjust
    points: Mapped[int] = mapped_column(Integer)  # موقّعة
    balance_after: Mapped[int] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(String(200), nullable=True)
    ref_type: Mapped[str | None] = mapped_column(String(24), nullable=True)
    ref_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    __table_args__ = (Index("ix_loyalty_customer", "customer_id", "id"),)
