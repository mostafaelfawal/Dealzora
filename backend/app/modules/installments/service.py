"""قواعد التقسيط. كل أمر كتابة = معاملة واحدة: الخطة + كشف حساب العميل + الخزنة + Audit + Outbox.

- الخطة لا تملك ديناً منفصلاً: الدين دائماً في رصيد العميل (customers.balance)، والخطة جدول لسداده.
  فتحصيل قسط = «دفعة» في كشف العميل + نقدية داخلة للخزنة + زيادة المدفوع على الخطة.
- التقسيط دائماً لدين مسجّل (فاتورة آجلة من الكاشير)، فلا يغيّر الرصيد ولا يتجاوز الدين غير المقسّط.
  البيع بالتقسيط = بيع آجل عادي (مخزون + فاتورة + ضريبة + إيصال) ثم تقسيط مديونيته.
- لا زيادة على الأقساط إطلاقاً (الزيادة مقابل الأجل ربا).
- أي نقص في الدين من خارج الخطة (تحصيل من صفحة العميل، مرتجع، باقٍ محفوظ) يُحسب على الخطط
  الجارية من الأقدم (absorb_outside_credit)، فلا يزيد المتبقي على الخطط عن دين العميل أبداً.
- الإلغاء يوقف الجدول فقط: المتبقي يبقى ديناً عادياً على العميل.
"""

from datetime import date

from sqlalchemy.orm import Session

from app.core.base import uuid7
from app.core.errors import BadRequestError, ConflictError, NotFoundError
from app.core.periods import local_today
from app.core.security import Actor
from app.core.service_base import EntityService
from app.core.snapshots import diff_snapshots

from app.modules.customers.constants import ENTITY_LEDGER_ENTRY
from app.modules.customers.model import Customer
from app.modules.customers.service import CustomerService
from app.modules.customers.types import LedgerType

from .constants import (
    DOWN_PAYMENT_NOTE,
    ENTITY_PLAN,
    ERROR_MESSAGES,
    PLAN_SNAPSHOT_FIELDS,
    REF_TYPE_DOWN,
    REF_TYPE_PLAN,
    InstallmentError,
)
from .helper import build_schedule, due_date, is_due_soon, plan_progress, split_amounts
from .model import InstallmentPlan
from .repository import InstallmentRepository
from .schema import (
    DueOut,
    PlanCreate,
    PlanDetailOut,
    PlanListQuery,
    PlanOut,
    PlanPaymentIn,
    PlanPaymentOut,
    PlansSummaryOut,
)
from .types import DueRow, Frequency, PlanFilter, PlanStatus

_STATUS_FILTERS = {
    PlanFilter.ACTIVE: PlanStatus.ACTIVE,
    PlanFilter.OVERDUE: PlanStatus.ACTIVE,
    PlanFilter.DUE_SOON: PlanStatus.ACTIVE,
    PlanFilter.COMPLETED: PlanStatus.COMPLETED,
    PlanFilter.CANCELLED: PlanStatus.CANCELLED,
}


class InstallmentService(EntityService):
    entity = ENTITY_PLAN
    messages = ERROR_MESSAGES
    version_conflict_error = InstallmentError.VERSION_CONFLICT
    snapshot_fields = PLAN_SNAPSHOT_FIELDS

    def __init__(self, session: Session, actor: Actor) -> None:
        super().__init__(session, actor)
        self.repo = InstallmentRepository(session)
        self.customers = CustomerService(session, actor)

    # ================= قراءة =================
    def list_plans(self, query: PlanListQuery) -> list[PlanOut]:
        today = local_today()
        rows = self.repo.list_with_customers(
            status=_STATUS_FILTERS.get(query.filter), customer_id=query.customer_id
        )
        out = [self._to_out(p, c) for p, c in rows]
        if query.filter is PlanFilter.OVERDUE:
            out = [p for p in out if p.overdue_count > 0]
        elif query.filter is PlanFilter.DUE_SOON:
            out = [p for p in out if _due_soon(p, today)]
        return out

    def summary(self) -> PlansSummaryOut:
        today = local_today()
        plans = [self._to_out(p, c) for p, c in self.repo.list_with_customers()]
        active = [p for p in plans if p.status is PlanStatus.ACTIVE]
        overdue = [p for p in active if p.overdue_count > 0]
        soon = [p for p in active if _due_soon(p, today)]
        return PlansSummaryOut(
            active=len(active),
            remaining=sum(p.remaining for p in active),
            overdue_plans=len(overdue),
            overdue_amount=sum(p.overdue_amount for p in overdue),
            due_soon_plans=len(soon),
            due_soon_amount=sum(p.next_due_amount for p in soon),
            completed=sum(1 for p in plans if p.status is PlanStatus.COMPLETED),
            collected=sum(p.paid_amount for p in plans),
        )

    def get_plan(self, plan_id: str) -> PlanDetailOut:
        plan = self._get_or_404(plan_id)
        return self._to_detail(plan, self.customers.get_for_update(plan.customer_id))

    # ================= كتابة =================
    def create_plan(self, data: PlanCreate) -> PlanDetailOut:
        customer = self.customers.get_for_update(data.customer_id)
        if not customer.is_active:
            raise self._err(BadRequestError, InstallmentError.CUSTOMER_INACTIVE)

        unscheduled = customer.balance - self.repo.scheduled_remaining(customer.id)
        if data.principal > unscheduled:
            raise self._err(
                BadRequestError, InstallmentError.EXCEEDS_DEBT, available=max(unscheduled, 0)
            )

        financed = data.principal - data.down_payment
        total = financed  # لا زيادة على الأقساط: الزيادة مقابل الأجل ربا محرّم
        if total <= 0:
            raise self._err(BadRequestError, InstallmentError.NOTHING_TO_FINANCE)

        plan = InstallmentPlan(
            id=uuid7(),
            device_id=self.actor.device_id,
            created_by=self.actor.user_id,
            customer_id=customer.id,
            title=data.title,
            principal=data.principal,
            down_payment=data.down_payment,
            total=total,
            installments_count=data.installments_count,
            frequency=data.frequency.value,
            start_date=data.start_date,
            paid_amount=0,
            status=PlanStatus.ACTIVE.value,
            note=data.note,
        )
        self.repo.add(plan)
        self.repo.flush()

        if data.down_payment > 0:
            self._collect(
                customer,
                plan,
                data.down_payment,
                note=f"{DOWN_PAYMENT_NOTE}: {data.title}",
                ref_type=REF_TYPE_DOWN,
            )

        self._audit(plan, "create", self._snapshot(plan))
        self._enqueue(plan, base_version=None)
        self._commit()
        return self._to_detail(plan, customer)

    def pay(self, plan_id: str, data: PlanPaymentIn) -> PlanDetailOut:
        plan = self._get_or_404(plan_id)
        if plan.status != PlanStatus.ACTIVE.value:
            raise self._err(ConflictError, InstallmentError.NOT_ACTIVE)
        remaining = plan.total - plan.paid_amount
        if data.amount > remaining:
            raise self._err(
                BadRequestError, InstallmentError.PAYMENT_EXCEEDS_REMAINING, remaining=remaining
            )
        customer = self.customers.get_for_update(plan.customer_id)
        if data.amount > customer.balance:
            raise self._err(
                BadRequestError,
                InstallmentError.PAYMENT_EXCEEDS_BALANCE,
                balance=max(customer.balance, 0),
            )

        base_version = plan.version
        self._collect(
            customer,
            plan,
            data.amount,
            note=data.note or f"قسط: {plan.title}",
            ref_type=REF_TYPE_PLAN,
        )
        plan.paid_amount += data.amount
        if plan.paid_amount >= plan.total:
            plan.status = PlanStatus.COMPLETED.value
        plan.mark_modified()
        self.repo.flush()

        self._audit(
            plan,
            "installment_pay",
            {"amount": data.amount, "paid_amount": plan.paid_amount, "status": plan.status},
        )
        self._enqueue(plan, base_version=base_version)
        self._commit()
        return self._to_detail(plan, customer)

    def cancel(self, plan_id: str, base_version: int) -> PlanDetailOut:
        plan = self._get_or_404(plan_id)
        self._check_version(plan, base_version)
        if plan.status != PlanStatus.ACTIVE.value:
            raise self._err(ConflictError, InstallmentError.NOT_ACTIVE)
        before = self._snapshot(plan)
        plan.status = PlanStatus.CANCELLED.value
        plan.mark_modified()
        self.repo.flush()
        self._audit(plan, "installment_cancel", diff_snapshots(before, self._snapshot(plan)))
        self._enqueue(plan, base_version=base_version)
        self._commit()
        return self._to_detail(plan, self.customers.get_for_update(plan.customer_id))

    # ================= واجهة للموديولات الأخرى (بدون commit) =================
    def absorb_outside_credit(self, customer: Customer) -> None:
        """دين العميل نقص من خارج الخطط: يُحسب الفرق على خططه الجارية من الأقدم.

        القاعدة: المتبقي على الخطط ≤ دين العميل دائماً. الدين غير المقسّط يُسدَّد أولاً،
        وما زاد عنه يُعدّ سداداً للخطط (وتكتمل الخطة إن سُدّدت كلها).
        """
        excess = self.repo.scheduled_remaining(customer.id) - max(customer.balance, 0)
        if excess <= 0:
            return
        for plan in self.repo.active_for_customer(customer.id):
            take = min(excess, plan.total - plan.paid_amount)
            if take <= 0:
                continue
            base_version = plan.version
            plan.paid_amount += take
            if plan.paid_amount >= plan.total:
                plan.status = PlanStatus.COMPLETED.value
            plan.mark_modified()
            self._audit(
                plan,
                "installment_settle",
                {"amount": take, "paid_amount": plan.paid_amount, "status": plan.status},
            )
            self._enqueue(plan, base_version=base_version)
            excess -= take
            if excess <= 0:
                break
        self.repo.flush()

    # ================= داخلي =================
    def _get_or_404(self, plan_id: str) -> InstallmentPlan:
        plan = self.repo.get(plan_id)
        if plan is None:
            raise self._err(NotFoundError, InstallmentError.NOT_FOUND)
        return plan

    def _collect(
        self, customer: Customer, plan: InstallmentPlan, amount: int, *, note: str, ref_type: str
    ) -> None:
        """دفعة في كشف العميل + نقدية داخلة للخزنة (نفس مسار «تحصيل دفعة»)، بلا commit."""
        entry = self.customers.post_entry(
            customer,
            LedgerType.PAYMENT,
            credit=amount,
            note=note,
            ref_type=ref_type,
            ref_id=plan.id,
        )
        from app.modules.treasury.service import TreasuryService
        from app.modules.treasury.types import CashDirection, CashKind

        TreasuryService(self.session, self.actor).post_entry(
            direction=CashDirection.IN,
            kind=CashKind.CUSTOMER_PAYMENT,
            amount=amount,
            occurred_at=local_today(),
            note=f"{note} - {customer.name}",
            source_entity=ENTITY_LEDGER_ENTRY,
            source_id=entry.id,
        )

    @staticmethod
    def _schedule(plan: InstallmentPlan):
        return build_schedule(
            plan.total,
            plan.installments_count,
            Frequency(plan.frequency),
            plan.start_date,
            plan.paid_amount,
            local_today(),
        )

    def _to_out(self, plan: InstallmentPlan, customer: Customer) -> PlanOut:
        return self._build_out(PlanOut, plan, customer)

    def _to_detail(self, plan: InstallmentPlan, customer: Customer) -> PlanDetailOut:
        rows = self._schedule(plan)
        payments = self.repo.payments(plan.id)
        return self._build_out(
            PlanDetailOut,
            plan,
            customer,
            rows=rows,
            schedule=[_due_out(r) for r in rows],
            payments=[
                PlanPaymentOut(id=e.id, amount=e.credit, note=e.note, created_at=e.created_at)
                for e in payments
            ],
            # ما سُدّد من خارج شاشة التقسيط (صفحة العميل، مرتجع...) وحُسب على الخطة.
            settled_outside=max(plan.paid_amount - sum(e.credit for e in payments), 0),
        )

    def _build_out(
        self,
        cls: type[PlanOut],
        plan: InstallmentPlan,
        customer: Customer,
        rows: list[DueRow] | None = None,
        **extra: object,
    ):
        rows = rows if rows is not None else self._schedule(plan)
        progress = plan_progress(rows, plan.total, plan.paid_amount)
        active = plan.status == PlanStatus.ACTIVE.value
        frequency = Frequency(plan.frequency)
        return cls(
            id=plan.id,
            customer_id=customer.id,
            customer_name=customer.name,
            customer_phone=customer.phone,
            title=plan.title,
            principal=plan.principal,
            down_payment=plan.down_payment,
            total=plan.total,
            installments_count=plan.installments_count,
            installment_amount=split_amounts(plan.total, plan.installments_count)[0],
            frequency=frequency,
            start_date=plan.start_date,
            end_date=due_date(plan.start_date, frequency, plan.installments_count - 1),
            paid_amount=plan.paid_amount,
            remaining=progress.remaining if active else max(plan.total - plan.paid_amount, 0),
            paid_count=progress.paid_count,
            # الملغاة والمنتهية لا متأخرات لها ولا قسط قادم.
            overdue_amount=progress.overdue_amount if active else 0,
            overdue_count=progress.overdue_count if active else 0,
            next_due_date=progress.next_due_date if active else None,
            next_due_amount=progress.next_due_amount if active else 0,
            status=PlanStatus(plan.status),
            note=plan.note,
            version=plan.version,
            created_at=plan.created_at,
            **extra,
        )


def _due_out(row: DueRow) -> DueOut:
    return DueOut(
        seq=row.seq, due_date=row.due_date, amount=row.amount, paid=row.paid, status=row.status
    )


def _due_soon(p: PlanOut, today: date) -> bool:
    return is_due_soon(p.overdue_count, p.next_due_date, today)
