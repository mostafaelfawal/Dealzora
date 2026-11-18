"""جدول SQLAlchemy. المال بالقروش.

جدول الأقساط لا يُخزَّن: يُحسب دائماً من (الإجمالي، العدد، الدورية، تاريخ أول قسط)،
وحالة كل قسط تُحسب بتوزيع المدفوع على الأقساط بالترتيب (helper.build_schedule).
"""

from datetime import date

from sqlalchemy import Date, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, SyncMixin

from .constants import MAX_NOTE_LEN, MAX_TITLE_LEN


class InstallmentPlan(SyncMixin, Base):
    __tablename__ = "installment_plans"

    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"))
    title: Mapped[str] = mapped_column(String(MAX_TITLE_LEN))  # «ثلاجة 16 قدم»
    principal: Mapped[int] = mapped_column(Integer)  # المبلغ قبل المقدّم
    down_payment: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer)  # المقسَّط فعلاً = الأصل − المقدّم (بلا أي زيادة: لا ربا)
    installments_count: Mapped[int] = mapped_column(Integer)
    frequency: Mapped[str] = mapped_column(String(12))
    start_date: Mapped[date] = mapped_column(Date)  # موعد أول قسط
    # المدفوع من الأقساط (بلا المقدّم). مخزّن ويتحدّث داخل نفس معاملة التحصيل.
    paid_amount: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(12))
    note: Mapped[str | None] = mapped_column(String(MAX_NOTE_LEN), nullable=True)

    __table_args__ = (
        Index("ix_installment_plans_customer", "customer_id"),
        Index("ix_installment_plans_live_status", "deleted_at", "status"),
    )
