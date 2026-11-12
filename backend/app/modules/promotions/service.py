"""إدارة العروض التلقائية + قائمة العروض السارية اليوم (للكاشير ولتسعير الفاتورة على السيرفر)."""

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.base import uuid7
from app.core.errors import BadRequestError, NotFoundError
from app.core.periods import local_today
from app.core.repository import live
from app.core.security import Actor
from app.core.service_base import EntityService
from app.modules.products.model import Category, Product

from .constants import (
    ENTITY_PROMOTION,
    ERROR_MESSAGES,
    PromoError,
    PromoKind,
    PromoScope,
    PromoStatus,
)
from .model import Promotion
from .schema import PromotionIn, PromotionOut, PromotionsSummaryOut, PromotionUpdate

_FIELDS = (
    "name", "kind", "value", "buy_qty", "get_qty", "min_qty", "scope",
    "category_id", "product_ids", "starts_on", "ends_on", "is_active",
)  # fmt: skip


def promo_status(p: Promotion, today: date) -> PromoStatus:
    if not p.is_active:
        return PromoStatus.PAUSED
    if p.starts_on and p.starts_on > today:
        return PromoStatus.SCHEDULED
    if p.ends_on and p.ends_on < today:
        return PromoStatus.EXPIRED
    return PromoStatus.ACTIVE


def active_promotions(session: Session, today: date | None = None) -> list[Promotion]:
    """العروض السارية اليوم (بترتيب ثابت: الأقدم أولاً، فالتعادل يحسمه نفس الترتيب في الكاشير)."""
    today = today or local_today()
    rows = session.scalars(
        select(Promotion)
        .where(live(Promotion), Promotion.is_active.is_(True))
        .order_by(Promotion.id)
    ).all()
    return [p for p in rows if promo_status(p, today) is PromoStatus.ACTIVE]


class PromotionService(EntityService):
    entity = ENTITY_PROMOTION
    messages = ERROR_MESSAGES
    version_conflict_error = PromoError.VERSION_CONFLICT
    snapshot_fields = _FIELDS

    def __init__(self, session: Session, actor: Actor) -> None:
        super().__init__(session, actor)

    # ================= قراءة =================
    def list_all(self) -> list[PromotionOut]:
        rows = self.session.scalars(
            select(Promotion).where(live(Promotion)).order_by(Promotion.id.desc())
        ).all()
        return self._out(list(rows))

    def list_active(self) -> list[PromotionOut]:
        return self._out(active_promotions(self.session))

    def summary(self) -> PromotionsSummaryOut:
        today = local_today()
        counts = {s: 0 for s in PromoStatus}
        for p in self.session.scalars(select(Promotion).where(live(Promotion))).all():
            counts[promo_status(p, today)] += 1
        return PromotionsSummaryOut(
            active=counts[PromoStatus.ACTIVE],
            scheduled=counts[PromoStatus.SCHEDULED],
            expired=counts[PromoStatus.EXPIRED],
            paused=counts[PromoStatus.PAUSED],
        )

    # ================= كتابة =================
    def create(self, data: PromotionIn) -> PromotionOut:
        self._check_refs(data)
        promo = Promotion(id=uuid7(), device_id=self.actor.device_id, created_by=self.actor.user_id)
        self._apply(promo, data)
        self.session.add(promo)
        self.session.flush()
        self._audit(promo, "create", self._snapshot(promo))
        self._enqueue(promo, base_version=None)
        self._commit()
        return self._out([promo])[0]

    def update(self, promo_id: str, data: PromotionUpdate) -> PromotionOut:
        promo = self._get_or_404(promo_id)
        self._check_version(promo, data.base_version)
        self._check_refs(data)
        before = self._snapshot(promo)
        self._apply(promo, data)
        promo.mark_modified()
        after = self._snapshot(promo)
        self._audit(
            promo,
            "update",
            {k: {"from": before[k], "to": after[k]} for k in after if before.get(k) != after[k]},
        )
        self._enqueue(promo, base_version=data.base_version)
        self._commit()
        return self._out([promo])[0]

    def toggle(self, promo_id: str, base_version: int) -> PromotionOut:
        promo = self._get_or_404(promo_id)
        self._set_active(promo, not promo.is_active, base_version)
        return self._out([promo])[0]

    def delete(self, promo_id: str, base_version: int) -> None:
        promo = self._get_or_404(promo_id)
        self._check_version(promo, base_version)
        self._soft_delete(promo, base_version, {"name": promo.name})

    # ================= مساعدات =================
    def _get_or_404(self, promo_id: str) -> Promotion:
        promo = self.session.scalars(
            select(Promotion).where(Promotion.id == promo_id, live(Promotion))
        ).first()
        if promo is None:
            raise self._err(NotFoundError, PromoError.NOT_FOUND)
        return promo

    def _check_refs(self, data: PromotionIn) -> None:
        if data.scope is PromoScope.CATEGORY:
            found = self.session.scalar(
                select(Category.id).where(Category.id == data.category_id, live(Category))
            )
            if not found:
                raise self._err(BadRequestError, PromoError.CATEGORY_NOT_FOUND)
        if data.scope is PromoScope.PRODUCTS:
            found = set(
                self.session.scalars(
                    select(Product.id).where(Product.id.in_(data.product_ids), live(Product))
                ).all()
            )
            if len(found) != len(data.product_ids):
                raise self._err(BadRequestError, PromoError.PRODUCT_NOT_FOUND)

    @staticmethod
    def _apply(promo: Promotion, data: PromotionIn) -> None:
        for field in _FIELDS:
            value = getattr(data, field)
            setattr(promo, field, value.value if isinstance(value, PromoKind | PromoScope) else value)

    def _snapshot(self, row: Promotion) -> dict:
        snap = super()._snapshot(row)
        for key in ("starts_on", "ends_on"):
            if snap.get(key) is not None and not isinstance(snap[key], str):
                snap[key] = snap[key].isoformat()
        return snap

    def _out(self, rows: list[Promotion]) -> list[PromotionOut]:
        today = local_today()
        cat_ids = {p.category_id for p in rows if p.category_id}
        prod_ids = {pid for p in rows for pid in (p.product_ids or [])}
        cats = dict(
            self.session.execute(select(Category.id, Category.name).where(Category.id.in_(cat_ids))).all()
        ) if cat_ids else {}
        names = dict(
            self.session.execute(select(Product.id, Product.name).where(Product.id.in_(prod_ids))).all()
        ) if prod_ids else {}
        return [
            PromotionOut(
                id=p.id,
                name=p.name,
                kind=PromoKind(p.kind),
                value=p.value,
                buy_qty=p.buy_qty,
                get_qty=p.get_qty,
                min_qty=p.min_qty,
                scope=PromoScope(p.scope),
                category_id=p.category_id,
                category_name=cats.get(p.category_id) if p.category_id else None,
                product_ids=list(p.product_ids or []),
                product_names=[names[i] for i in (p.product_ids or []) if i in names],
                starts_on=p.starts_on,
                ends_on=p.ends_on,
                is_active=p.is_active,
                status=promo_status(p, today),
                version=p.version,
                created_at=p.created_at,
            )
            for p in rows
        ]
