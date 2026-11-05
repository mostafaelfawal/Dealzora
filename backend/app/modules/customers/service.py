"""قواعد العمل. كل أمر كتابة = معاملة واحدة: العميل + حركة الحساب + Audit + Outbox ثم commit واحد.

الأساس المشترك (Audit/Outbox/النسخة/commit/الحذف الناعم/العمليات الجماعية) في core.service_base.EntityService.
"""

from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.base import utcnow, uuid7
from app.core.bulk import BulkIn, BulkResultOut
from app.core.errors import BadRequestError, ConflictError, ForbiddenError, NotFoundError
from app.core.security import Actor
from app.core.service_base import EntityService
from app.core.snapshots import diff_snapshots
from app.core.text import build_search_text

from .constants import (
    CUSTOMER_SNAPSHOT_FIELDS,
    DEFAULT_PAYMENT_NOTE,
    ENTITY_CUSTOMER,
    ENTITY_LEDGER_ENTRY,
    ERROR_MESSAGES,
    OPENING_NOTE,
    OVERDUE_DAYS,
    CustomerError,
)
from .helper import calc_available_credit, calc_credit_level, is_overdue
from .model import Customer, CustomerLedgerEntry
from .repository import CustomerRepository
from .schema import (
    CustomerBase,
    CustomerCreate,
    CustomerListOut,
    CustomerListQuery,
    CustomerOut,
    CustomersSummaryOut,
    CustomerUpdate,
    PaymentIn,
    StatementEntryOut,
    StatementOut,
    StatementQuery,
)
from .types import CustomerFilters, CustomerSort, LedgerType


class CustomerService(EntityService):
    entity = ENTITY_CUSTOMER
    messages = ERROR_MESSAGES
    version_conflict_error = CustomerError.VERSION_CONFLICT
    unique_conflict_error = CustomerError.PHONE_TAKEN
    snapshot_fields = CUSTOMER_SNAPSHOT_FIELDS

    def __init__(self, session: Session, actor: Actor) -> None:
        super().__init__(session, actor)
        self.repo = CustomerRepository(session)

    @staticmethod
    def _overdue_before():
        return utcnow() - timedelta(days=OVERDUE_DAYS)

    # ================= قراءة =================
    def list_customers(self, query: CustomerListQuery) -> CustomerListOut:
        if query.sort is CustomerSort.SALES and not self.is_manager:
            raise ForbiddenError("forbidden", "الترتيب بإجمالي المشتريات للمدير فقط")

        filters = CustomerFilters(
            overdue_before=self._overdue_before(),
            query=query.q,
            filter=query.filter,
            sort=query.sort,
            only_active=not self.is_manager,  # الكاشير لا يرى المعطّل
            page=query.page,
            page_size=query.page_size,
        )
        rows, total = self.repo.list_customers(filters)
        return CustomerListOut(
            items=[self._to_out(c) for c in rows],
            total=total,
            page=query.page,
            page_size=query.page_size,
        )

    def summary(self) -> CustomersSummaryOut:
        s = self.repo.summary(self._overdue_before())
        return CustomersSummaryOut(
            total=s.total,
            total_debt=s.total_debt,
            debtors=s.debtors,
            overdue=s.overdue,
            at_limit=s.at_limit,
            inactive=s.inactive,
        )

    def get_customer(self, customer_id: str) -> CustomerOut:
        return self._to_out(self._get_visible(customer_id))

    def list_statement(self, customer_id: str, query: StatementQuery) -> StatementOut:
        self._get_or_404(customer_id)
        rows, total = self.repo.list_entries(customer_id, query.page, query.page_size)
        return StatementOut(
            items=[StatementEntryOut.model_validate(e) for e in rows],
            total=total,
            page=query.page,
            page_size=query.page_size,
        )

    # ================= كتابة =================
    def create_customer(self, data: CustomerCreate) -> CustomerOut:
        self._check_phone(data.phone)

        customer = Customer(
            id=uuid7(),
            device_id=self.actor.device_id,
            created_by=self.actor.user_id,
            balance=0,
            total_sales=0,
        )
        self._apply_fields(customer, data)
        self._refresh_search_text(customer)
        self.repo.add(customer)
        self.repo.flush()

        if data.opening_balance > 0:
            self._post_entry(
                customer, LedgerType.OPENING, debit=data.opening_balance, note=OPENING_NOTE
            )

        self._audit(customer, "create", self._snapshot(customer))
        self._enqueue(customer, base_version=None)
        self._commit()
        return self._to_out(customer)

    def update_customer(self, customer_id: str, data: CustomerUpdate) -> CustomerOut:
        customer = self._get_or_404(customer_id)
        self._check_version(customer, data.base_version)
        self._check_phone(data.phone, exclude_customer_id=customer.id)

        before = self._snapshot(customer)
        self._apply_fields(customer, data)
        self._refresh_search_text(customer)
        customer.mark_modified()
        self.repo.flush()

        self._audit(customer, "update", diff_snapshots(before, self._snapshot(customer)))
        self._enqueue(customer, base_version=data.base_version)
        self._commit()
        return self._to_out(customer)

    def toggle_active(self, customer_id: str, base_version: int) -> CustomerOut:
        customer = self._get_or_404(customer_id)
        self._set_active(customer, not customer.is_active, base_version)
        return self._to_out(customer)

    def delete_customer(self, customer_id: str, base_version: int) -> None:
        customer = self._get_or_404(customer_id)
        self._check_version(customer, base_version)
        if customer.balance != 0:
            raise self._err(ConflictError, CustomerError.HAS_BALANCE, balance=customer.balance)
        self._soft_delete(
            customer, base_version, {"name": customer.name, "balance": customer.balance}
        )

    def collect_payment(self, customer_id: str, data: PaymentIn) -> CustomerOut:
        customer = self._get_or_404(customer_id)
        if customer.balance <= 0:
            raise self._err(BadRequestError, CustomerError.NO_DEBT)
        if data.amount > customer.balance:
            raise self._err(
                BadRequestError, CustomerError.AMOUNT_EXCEEDS_DEBT, balance=customer.balance
            )

        entry = self._post_entry(
            customer,
            LedgerType.PAYMENT,
            credit=data.amount,
            note=data.note or DEFAULT_PAYMENT_NOTE,
        )
        self._audit(
            customer,
            "collect_payment",
            {"amount": data.amount, "balance_after": entry.balance_after},
        )
        self._commit()
        return self._to_out(customer)

    # ================= عمليات جماعية =================
    def bulk_delete(self, data: BulkIn) -> BulkResultOut:
        return self._run_bulk(
            data, lambda item: self.delete_customer(item.id, item.base_version)
        )

    def bulk_deactivate(self, data: BulkIn) -> BulkResultOut:
        return self._bulk_deactivate(data, self._get_or_404)

    # ================= داخلي =================
    def _get_or_404(self, customer_id: str) -> Customer:
        customer = self.repo.get(customer_id)
        if customer is None:
            raise self._err(NotFoundError, CustomerError.NOT_FOUND)
        return customer

    def _get_visible(self, customer_id: str) -> Customer:
        customer = self._get_or_404(customer_id)
        if not self.is_manager and not customer.is_active:
            raise self._err(NotFoundError, CustomerError.NOT_FOUND)
        return customer

    def _check_phone(self, phone: str | None, exclude_customer_id: str | None = None) -> None:
        if phone and self.repo.phone_taken(phone, exclude_customer_id=exclude_customer_id):
            raise self._err(ConflictError, CustomerError.PHONE_TAKEN, phone=phone)

    @staticmethod
    def _apply_fields(customer: Customer, data: CustomerBase) -> None:
        customer.name = data.name
        customer.phone = data.phone
        customer.address = data.address
        customer.notes = data.notes
        customer.credit_limit = data.credit_limit
        customer.is_active = data.is_active

    @staticmethod
    def _refresh_search_text(customer: Customer) -> None:
        customer.search_text = build_search_text(customer.name, [customer.phone])

    def _post_entry(
        self,
        customer: Customer,
        entry_type: LedgerType,
        *,
        debit: int = 0,
        credit: int = 0,
        note: str | None = None,
        ref_type: str | None = None,
        ref_id: str | None = None,
    ) -> CustomerLedgerEntry:
        """يسجّل حركة في كشف الحساب ويحدّث الرصيد المخزّن داخل نفس المعاملة (لا commit).
        سيستدعيها موديول الكاشير لاحقاً للبيع الآجل والمرتجعات (entry_type=sale/return مع ref_id الفاتورة).
        """
        balance = customer.balance + debit - credit
        entry = CustomerLedgerEntry(
            id=uuid7(),
            device_id=self.actor.device_id,
            created_by=self.actor.user_id,
            customer_id=customer.id,
            entry_type=entry_type.value,
            debit=debit,
            credit=credit,
            balance_after=balance,
            note=note,
            ref_type=ref_type,
            ref_id=ref_id,
        )
        customer.balance = balance  # الرصيد المخزّن، داخل نفس المعاملة. لا تغيير في version.
        if entry_type is LedgerType.PAYMENT:
            customer.last_payment_at = utcnow()
        self.repo.add_entry(entry)
        self._enqueue_event(
            ENTITY_LEDGER_ENTRY,
            entry.id,
            {
                "id": entry.id,
                "customer_id": customer.id,
                "entry_type": entry.entry_type,
                "debit": debit,
                "credit": credit,
                "balance_after": balance,
                "note": note,
                "ref_type": ref_type,
                "ref_id": ref_id,
            },
        )
        return entry

    def _to_out(self, c: Customer) -> CustomerOut:
        """الكاشير لا يرى إجمالي المشتريات ولا الملاحظات."""
        return CustomerOut(
            id=c.id,
            name=c.name,
            phone=c.phone,
            address=c.address,
            notes=c.notes if self.is_manager else None,
            balance=c.balance,
            credit_limit=c.credit_limit,
            available_credit=calc_available_credit(c.balance, c.credit_limit),
            credit_level=calc_credit_level(c.balance, c.credit_limit),
            is_overdue=is_overdue(c.balance, c.last_payment_at, c.created_at, utcnow()),
            is_active=c.is_active,
            total_sales=c.total_sales if self.is_manager else None,
            last_purchase_at=c.last_purchase_at,
            last_payment_at=c.last_payment_at,
            version=c.version,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )