"""نقاط الولاء: الإعداد، تسجيل الحركات على العميل، الكشف، والتعديل اليدوي.

البيع والمرتجع يستدعيان post() داخل معاملتهما (بدون commit هنا)، والتعديل اليدوي يعمل commit.
"""

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.base import uuid7
from app.core.errors import BadRequestError, NotFoundError
from app.core.outbox import OutboxOp, enqueue_outbox
from app.core.security import Actor
from app.modules.customers.model import Customer

from .config import LoyaltyConfig
from .model import LoyaltyEntry

ENTITY_LOYALTY = "loyalty_entry"


class LoyaltyKind(StrEnum):
    EARN = "earn"  # كسب من فاتورة
    REDEEM = "redeem"  # استبدال في فاتورة
    RETURN = "return"  # خصم المكتسب عند مرتجع
    RESTORE = "restore"  # رد المستبدل عند مرتجع
    ADJUST = "adjust"  # تعديل يدوي من المدير


class AdjustIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    points: int = Field(ge=-10_000_000, le=10_000_000)
    note: str = Field(min_length=2, max_length=200)


class LoyaltyEntryOut(BaseModel):
    id: str
    kind: LoyaltyKind
    points: int
    balance_after: int
    note: str | None
    created_at: str


class LoyaltyHistoryOut(BaseModel):
    balance: int
    items: list[LoyaltyEntryOut]
    total: int


def load_config(session: Session) -> LoyaltyConfig:
    from app.modules.settings.service import SettingsService  # متأخر: لا دوران

    return SettingsService(session).loyalty()


def post(
    session: Session,
    actor: Actor,
    customer: Customer,
    kind: LoyaltyKind,
    points: int,
    *,
    note: str,
    ref_type: str | None = None,
    ref_id: str | None = None,
) -> None:
    """حركة نقاط + تحديث الرصيد المخزّن، داخل معاملة المستدعي."""
    if points == 0:
        return
    customer.loyalty_points = max(customer.loyalty_points + points, 0)
    entry = LoyaltyEntry(
        id=uuid7(),
        device_id=actor.device_id,
        created_by=actor.user_id,
        customer_id=customer.id,
        kind=kind.value,
        points=points,
        balance_after=customer.loyalty_points,
        note=note,
        ref_type=ref_type,
        ref_id=ref_id,
    )
    session.add(entry)
    enqueue_outbox(
        session,
        entity=ENTITY_LOYALTY,
        entity_id=entry.id,
        op=OutboxOp.UPSERT,
        payload={
            "id": entry.id,
            "customer_id": customer.id,
            "kind": entry.kind,
            "points": points,
            "balance_after": entry.balance_after,
            "ref_type": ref_type,
            "ref_id": ref_id,
        },
        device_id=actor.device_id,
    )


class LoyaltyService:
    def __init__(self, session: Session, actor: Actor) -> None:
        self.session = session
        self.actor = actor

    def _customer(self, customer_id: str) -> Customer:
        customer = self.session.scalars(
            select(Customer).where(Customer.id == customer_id, Customer.deleted_at.is_(None))
        ).first()
        if customer is None:
            raise NotFoundError("customer_not_found", "العميل غير موجود")
        return customer

    def history(self, customer_id: str, page: int, page_size: int) -> LoyaltyHistoryOut:
        customer = self._customer(customer_id)
        cond = LoyaltyEntry.customer_id == customer_id
        total = self.session.scalar(select(func.count()).select_from(LoyaltyEntry).where(cond)) or 0
        rows = self.session.scalars(
            select(LoyaltyEntry)
            .where(cond)
            .order_by(LoyaltyEntry.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
        return LoyaltyHistoryOut(
            balance=customer.loyalty_points,
            total=total,
            items=[
                LoyaltyEntryOut(
                    id=r.id,
                    kind=LoyaltyKind(r.kind),
                    points=r.points,
                    balance_after=r.balance_after,
                    note=r.note,
                    created_at=r.created_at.isoformat(),
                )
                for r in rows
            ],
        )

    def adjust(self, customer_id: str, data: AdjustIn) -> LoyaltyHistoryOut:
        customer = self._customer(customer_id)
        if data.points == 0:
            raise BadRequestError("loyalty_zero", "اكتب عدد النقاط (موجب للإضافة، سالب للخصم)")
        if customer.loyalty_points + data.points < 0:
            raise BadRequestError(
                "loyalty_insufficient",
                "رصيد النقاط أقل من المطلوب خصمه",
                {"balance": customer.loyalty_points},
            )
        before = customer.loyalty_points
        post(self.session, self.actor, customer, LoyaltyKind.ADJUST, data.points, note=data.note)
        record_audit(
            self.session,
            self.actor,
            entity="customer",
            entity_id=customer.id,
            action="loyalty_adjust",
            changes={"loyalty_points": {"from": before, "to": customer.loyalty_points}, "note": data.note},
        )
        self.session.commit()
        return self.history(customer_id, 1, 20)
