"""الوصول لقاعدة البيانات فقط. لا قواعد عمل ولا commit هنا (الـ service يملك المعاملة)."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.customers.model import Customer, CustomerLedgerEntry
from app.modules.customers.types import LedgerType

from .constants import REF_TYPE_PLAN
from .model import InstallmentPlan
from .types import PlanStatus


class InstallmentRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, plan_id: str) -> InstallmentPlan | None:
        stmt = select(InstallmentPlan).where(
            InstallmentPlan.id == plan_id, InstallmentPlan.deleted_at.is_(None)
        )
        return self.session.scalars(stmt).first()

    def list_with_customers(
        self, *, status: PlanStatus | None = None, customer_id: str | None = None
    ) -> list[tuple[InstallmentPlan, Customer]]:
        stmt = (
            select(InstallmentPlan, Customer)
            .join(Customer, Customer.id == InstallmentPlan.customer_id)
            .where(InstallmentPlan.deleted_at.is_(None))
            .order_by(InstallmentPlan.created_at.desc(), InstallmentPlan.id.desc())
        )
        if status is not None:
            stmt = stmt.where(InstallmentPlan.status == status.value)
        if customer_id:
            stmt = stmt.where(InstallmentPlan.customer_id == customer_id)
        return [(p, c) for p, c in self.session.execute(stmt).all()]

    def scheduled_remaining(self, customer_id: str, exclude_plan_id: str | None = None) -> int:
        """ما هو مقسّط بالفعل من دين العميل (المتبقي على خططه النشطة)."""
        stmt = select(
            func.coalesce(func.sum(InstallmentPlan.total - InstallmentPlan.paid_amount), 0)
        ).where(
            InstallmentPlan.customer_id == customer_id,
            InstallmentPlan.status == PlanStatus.ACTIVE.value,
            InstallmentPlan.deleted_at.is_(None),
        )
        if exclude_plan_id:
            stmt = stmt.where(InstallmentPlan.id != exclude_plan_id)
        return int(self.session.scalar(stmt) or 0)

    def payments(self, plan_id: str) -> list[CustomerLedgerEntry]:
        """دفعات الأقساط = حركات «دفعة» في كشف العميل مرجعها الخطة (بلا المقدّم)."""
        stmt = (
            select(CustomerLedgerEntry)
            .where(
                CustomerLedgerEntry.ref_type == REF_TYPE_PLAN,
                CustomerLedgerEntry.ref_id == plan_id,
                CustomerLedgerEntry.entry_type == LedgerType.PAYMENT.value,
                CustomerLedgerEntry.deleted_at.is_(None),
            )
            .order_by(CustomerLedgerEntry.id.desc())
        )
        return list(self.session.scalars(stmt).all())

    def add(self, plan: InstallmentPlan) -> None:
        self.session.add(plan)

    def flush(self) -> None:
        self.session.flush()
