"""قواعد العمل. كل أمر كتابة = معاملة واحدة: المورد + الحركة + Audit + Outbox ثم commit واحد."""

from sqlalchemy.orm import Session

from app.core.base import uuid7
from app.core.periods import local_today
from app.core.bulk import BulkIn, BulkResultOut
from app.core.errors import ConflictError, NotFoundError
from app.core.security import Actor
from app.core.service_base import EntityService
from app.core.snapshots import diff_snapshots
from app.core.text import build_search_text

from .constants import (
    ENTITY_SUPPLIER,
    ENTITY_SUPPLIER_TXN,
    ERROR_MESSAGES,
    SUPPLIER_SNAPSHOT_FIELDS,
    SupplierError,
)
from .model import Supplier, SupplierTransaction
from .repository import SupplierRepository
from .schema import (
    StatementQuery,
    SupplierBase,
    SupplierCreate,
    SupplierListOut,
    SupplierListQuery,
    SupplierOut,
    SupplierPaymentIn,
    SupplierStatementOut,
    SuppliersSummaryOut,
    SupplierTransactionOut,
    SupplierUpdate,
)
from .types import SupplierFilters, TransactionType


class SupplierService(EntityService):
    """الموردون للمدير فقط (يضمن ذلك core.permissions.require_manager في routes)."""

    entity = ENTITY_SUPPLIER
    messages = ERROR_MESSAGES
    version_conflict_error = SupplierError.VERSION_CONFLICT
    unique_conflict_error = SupplierError.NAME_TAKEN
    snapshot_fields = SUPPLIER_SNAPSHOT_FIELDS

    def __init__(self, session: Session, actor: Actor) -> None:
        super().__init__(session, actor)
        self.repo = SupplierRepository(session)

    # ================= قراءة =================
    def list_suppliers(self, query: SupplierListQuery) -> SupplierListOut:
        filters = SupplierFilters(
            query=query.q,
            balance=query.balance,
            sort=query.sort,
            page=query.page,
            page_size=query.page_size,
        )
        rows, total = self.repo.list_suppliers(filters)
        return SupplierListOut(
            items=[SupplierOut.model_validate(s) for s in rows],
            total=total,
            page=query.page,
            page_size=query.page_size,
        )

    def summary(self) -> SuppliersSummaryOut:
        s = self.repo.summary()
        return SuppliersSummaryOut(
            total=s.total, owed=s.owed, inactive=s.inactive, total_payable=s.total_payable
        )

    def get_supplier(self, supplier_id: str) -> SupplierOut:
        return SupplierOut.model_validate(self._get_or_404(supplier_id))

    def list_statement(self, supplier_id: str, query: StatementQuery) -> SupplierStatementOut:
        self._get_or_404(supplier_id)
        rows, total = self.repo.list_transactions(supplier_id, query.page, query.page_size)
        return SupplierStatementOut(
            items=[SupplierTransactionOut.model_validate(t) for t in rows],
            total=total,
            page=query.page,
            page_size=query.page_size,
        )

    # ================= كتابة =================
    def create_supplier(self, data: SupplierCreate) -> SupplierOut:
        self._check_name(data.name)

        supplier = Supplier(
            id=uuid7(),
            device_id=self.actor.device_id,
            created_by=self.actor.user_id,
            balance=0,
        )
        self._apply_fields(supplier, data)
        self._refresh_search_text(supplier)
        self.repo.add(supplier)
        self.repo.flush()

        if data.opening_balance > 0:
            self._record_transaction(
                supplier,
                TransactionType.OPENING,
                data.opening_balance,
                note="رصيد افتتاحي",
            )

        self._audit(supplier, "create", self._snapshot(supplier))
        self._enqueue(supplier, base_version=None)
        self._commit()
        return SupplierOut.model_validate(supplier)

    def update_supplier(self, supplier_id: str, data: SupplierUpdate) -> SupplierOut:
        supplier = self._get_or_404(supplier_id)
        self._check_version(supplier, data.base_version)
        self._check_name(data.name, exclude_id=supplier.id)

        before = self._snapshot(supplier)
        self._apply_fields(supplier, data)
        self._refresh_search_text(supplier)
        supplier.mark_modified()
        self.repo.flush()

        self._audit(supplier, "update", diff_snapshots(before, self._snapshot(supplier)))
        self._enqueue(supplier, base_version=data.base_version)
        self._commit()
        return SupplierOut.model_validate(supplier)

    def toggle_active(self, supplier_id: str, base_version: int) -> SupplierOut:
        supplier = self._get_or_404(supplier_id)
        self._set_active(supplier, not supplier.is_active, base_version)
        return SupplierOut.model_validate(supplier)

    def delete_supplier(self, supplier_id: str, base_version: int) -> None:
        supplier = self._get_or_404(supplier_id)
        self._check_version(supplier, base_version)
        if supplier.balance != 0:
            raise self._err(ConflictError, SupplierError.HAS_BALANCE, balance=supplier.balance)
        self._soft_delete(
            supplier, base_version, {"name": supplier.name, "balance": supplier.balance}
        )

    def record_payment(
        self, supplier_id: str, data: SupplierPaymentIn
    ) -> SupplierTransactionOut:
        """دفعة سداد للمورد. السداد الزائد مسموح (يصير الرصيد سالباً = دفعة مقدّمة)."""
        supplier = self._get_or_404(supplier_id)
        txn = self._record_transaction(
            supplier, TransactionType.PAYMENT, -data.amount, note=data.note
        )
        self._audit(
            supplier,
            "payment",
            {"amount": data.amount, "balance_after": txn.balance_after},
        )
        # السداد نقدية خارجة من الخزنة في نفس المعاملة.
        from app.modules.treasury.service import TreasuryService
        from app.modules.treasury.types import CashDirection, CashKind

        TreasuryService(self.session, self.actor).post_entry(
            direction=CashDirection.OUT,
            kind=CashKind.SUPPLIER_PAYMENT,
            amount=data.amount,
            occurred_at=local_today(),
            note=data.note or f"سداد لـ {supplier.name}",
            source_entity=ENTITY_SUPPLIER_TXN,
            source_id=txn.id,
        )
        self._commit()
        return SupplierTransactionOut.model_validate(txn)

    # ================= عمليات جماعية =================
    def bulk_delete(self, data: BulkIn) -> BulkResultOut:
        return self._run_bulk(
            data, lambda item: self.delete_supplier(item.id, item.base_version)
        )

    def bulk_deactivate(self, data: BulkIn) -> BulkResultOut:
        return self._bulk_deactivate(data, self._get_or_404)

    # ================= داخلي =================
    def _get_or_404(self, supplier_id: str) -> Supplier:
        supplier = self.repo.get(supplier_id)
        if supplier is None:
            raise self._err(NotFoundError, SupplierError.NOT_FOUND)
        return supplier

    def _check_name(self, name: str, exclude_id: str | None = None) -> None:
        if self.repo.name_taken(name, exclude_id=exclude_id):
            raise self._err(ConflictError, SupplierError.NAME_TAKEN, name=name)

    @staticmethod
    def _apply_fields(supplier: Supplier, data: SupplierBase) -> None:
        supplier.name = data.name
        supplier.phone = data.phone
        supplier.address = data.address
        supplier.notes = data.notes
        supplier.is_active = data.is_active

    @staticmethod
    def _refresh_search_text(supplier: Supplier) -> None:
        supplier.search_text = build_search_text(supplier.name, [supplier.phone])

    # ================= واجهة للموديولات الأخرى (بدون commit) =================
    def get_for_update(self, supplier_id: str) -> Supplier:
        return self._get_or_404(supplier_id)

    def record_transaction(
        self,
        supplier: Supplier,
        txn_type: TransactionType,
        delta: int,
        *,
        note: str | None = None,
        ref_type: str | None = None,
        ref_id: str | None = None,
    ) -> SupplierTransaction:
        return self._record_transaction(
            supplier, txn_type, delta, note=note, ref_type=ref_type, ref_id=ref_id
        )

    def _record_transaction(
        self,
        supplier: Supplier,
        txn_type: TransactionType,
        delta: int,
        *,
        note: str | None = None,
        ref_type: str | None = None,
        ref_id: str | None = None,
    ) -> SupplierTransaction:
        balance = supplier.balance + delta
        txn = SupplierTransaction(
            id=uuid7(),
            device_id=self.actor.device_id,
            created_by=self.actor.user_id,
            supplier_id=supplier.id,
            txn_type=txn_type.value,
            amount_delta=delta,
            balance_after=balance,
            note=note,
            ref_type=ref_type,
            ref_id=ref_id,
        )
        supplier.balance = balance  # الرصيد المخزّن، داخل نفس المعاملة
        self.repo.add_transaction(txn)
        self._enqueue_event(
            ENTITY_SUPPLIER_TXN,
            txn.id,
            {
                "id": txn.id,
                "supplier_id": supplier.id,
                "txn_type": txn.txn_type,
                "amount_delta": delta,
                "balance_after": balance,
                "note": note,
                "ref_type": ref_type,
                "ref_id": ref_id,
            },
        )
        return txn