"""قواعد العمل. كل أمر كتابة = معاملة واحدة: العميل + حركة الحساب + Audit + Outbox ثم commit واحد."""

from datetime import timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.base import uuid7, utcnow
from app.core.errors import (
    AppError,
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)
from app.core.outbox import OutboxOp, enqueue_outbox
from app.core.security import Actor, Role

from .constants import (
    DEFAULT_PAYMENT_NOTE,
    ENTITY_CUSTOMER,
    ENTITY_LEDGER_ENTRY,
    ERROR_MESSAGES,
    OPENING_NOTE,
    OVERDUE_DAYS,
    CustomerError,
)
from .helper import (
    build_search_text,
    calc_available_credit,
    calc_credit_level,
    customer_snapshot,
    diff_snapshots,
    is_overdue,
)
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


def _err(exc: type[AppError], code: CustomerError, **details) -> AppError:
    return exc(code=code.value, message=ERROR_MESSAGES[code], details=details or None)


class CustomerService:
    def __init__(self, session: Session, actor: Actor) -> None:
        self.session = session
        self.actor = actor
        self.repo = CustomerRepository(session)

    @property
    def is_admin(self) -> bool:
        return self.actor.role is Role.MANAGER

    @staticmethod
    def _overdue_before():
        return utcnow() - timedelta(days=OVERDUE_DAYS)

    # ================= قراءة =================
    def list_customers(self, query: CustomerListQuery) -> CustomerListOut:
        if query.sort is CustomerSort.SALES and not self.is_admin:
            raise ForbiddenError("forbidden", "الترتيب بإجمالي المشتريات للمدير فقط")

        filters = CustomerFilters(
            overdue_before=self._overdue_before(),
            query=query.q,
            filter=query.filter,
            sort=query.sort,
            only_active=not self.is_admin,  # الكاشير لا يرى المعطّل
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

        self._audit(customer, "create", customer_snapshot(customer))
        self._enqueue(customer, base_version=None)
        self._commit()
        return self._to_out(customer)

    def update_customer(self, customer_id: str, data: CustomerUpdate) -> CustomerOut:
        customer = self._get_or_404(customer_id)
        self._check_version(customer, data.base_version)
        self._check_phone(data.phone, exclude_customer_id=customer.id)

        before = customer_snapshot(customer)
        self._apply_fields(customer, data)
        self._refresh_search_text(customer)
        customer.mark_modified()
        self.repo.flush()

        self._audit(customer, "update", diff_snapshots(before, customer_snapshot(customer)))
        self._enqueue(customer, base_version=data.base_version)
        self._commit()
        return self._to_out(customer)

    def toggle_active(self, customer_id: str, base_version: int) -> CustomerOut:
        customer = self._get_or_404(customer_id)
        self._check_version(customer, base_version)

        was_active = customer.is_active
        customer.is_active = not was_active
        customer.mark_modified()
        self._audit(
            customer,
            "toggle_active",
            {"is_active": {"from": was_active, "to": customer.is_active}},
        )
        self._enqueue(customer, base_version=base_version)
        self._commit()
        return self._to_out(customer)

    def delete_customer(self, customer_id: str, base_version: int) -> None:
        customer = self._get_or_404(customer_id)
        self._check_version(customer, base_version)
        if customer.balance != 0:
            raise _err(ConflictError, CustomerError.HAS_BALANCE, balance=customer.balance)

        customer.mark_deleted()  # tombstone: يبقى في الجدول ويُنشر للمزامنة، والهاتف يتحرر
        self._audit(customer, "delete", {"name": customer.name, "balance": customer.balance})
        self._enqueue(customer, base_version=base_version, op=OutboxOp.DELETE)
        self._commit()

    def collect_payment(self, customer_id: str, data: PaymentIn) -> CustomerOut:
        customer = self._get_or_404(customer_id)
        if customer.balance <= 0:
            raise _err(BadRequestError, CustomerError.NO_DEBT)
        if data.amount > customer.balance:
            raise _err(
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

    # ================= داخلي =================
    def _get_or_404(self, customer_id: str) -> Customer:
        customer = self.repo.get(customer_id)
        if customer is None:
            raise _err(NotFoundError, CustomerError.NOT_FOUND)
        return customer

    def _get_visible(self, customer_id: str) -> Customer:
        customer = self._get_or_404(customer_id)
        if not self.is_admin and not customer.is_active:
            raise _err(NotFoundError, CustomerError.NOT_FOUND)
        return customer

    @staticmethod
    def _check_version(customer: Customer, base_version: int) -> None:
        if base_version != customer.version:
            raise _err(
                ConflictError, CustomerError.VERSION_CONFLICT, current_version=customer.version
            )

    def _check_phone(self, phone: str | None, exclude_customer_id: str | None = None) -> None:
        if phone and self.repo.phone_taken(phone, exclude_customer_id=exclude_customer_id):
            raise _err(ConflictError, CustomerError.PHONE_TAKEN, phone=phone)

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
        customer.search_text = build_search_text(customer.name, customer.phone)

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
        enqueue_outbox(
            self.session,
            entity=ENTITY_LEDGER_ENTRY,
            entity_id=entry.id,
            op=OutboxOp.UPSERT,
            device_id=self.actor.device_id,
            payload={
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

    def _audit(self, customer: Customer, action: str, changes: dict) -> None:
        record_audit(
            self.session,
            self.actor,
            entity=ENTITY_CUSTOMER,
            entity_id=customer.id,
            action=action,
            changes=changes,
        )

    def _enqueue(
        self,
        customer: Customer,
        *,
        base_version: int | None,
        op: OutboxOp = OutboxOp.UPSERT,
    ) -> None:
        payload = {
            "id": customer.id,
            "version": customer.version,
            "deleted_at": customer.deleted_at.isoformat() if customer.deleted_at else None,
            **customer_snapshot(customer),
        }
        enqueue_outbox(
            self.session,
            entity=ENTITY_CUSTOMER,
            entity_id=customer.id,
            op=op,
            payload=payload,
            base_version=base_version,
            device_id=self.actor.device_id,
        )

    def _commit(self) -> None:
        try:
            self.session.commit()
        except IntegrityError as exc:  # سباق على الهاتف الفريد (الفحص المسبق يغطي الحالة العادية)
            self.session.rollback()
            raise _err(ConflictError, CustomerError.PHONE_TAKEN) from exc

    def _to_out(self, c: Customer) -> CustomerOut:
        """الكاشير لا يرى إجمالي المشتريات ولا الملاحظات."""
        return CustomerOut(
            id=c.id,
            name=c.name,
            phone=c.phone,
            address=c.address,
            notes=c.notes if self.is_admin else None,
            balance=c.balance,
            credit_limit=c.credit_limit,
            available_credit=calc_available_credit(c.balance, c.credit_limit),
            credit_level=calc_credit_level(c.balance, c.credit_limit),
            is_overdue=is_overdue(c.balance, c.last_payment_at, c.created_at, utcnow()),
            is_active=c.is_active,
            total_sales=c.total_sales if self.is_admin else None,
            last_purchase_at=c.last_purchase_at,
            last_payment_at=c.last_payment_at,
            version=c.version,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
