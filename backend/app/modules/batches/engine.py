"""محرك الدفعات: يوزّع كل حركة مخزون لصنف متتبَّع على دفعاته. داخل معاملة المستدعي (بلا commit).

القواعد:
- دخول (+): مرتجع بيع ← لنفس الدفعات التي بيع منها. غير ذلك ← دفعة جديدة (بصلاحيتها إن وُجدت).
- خروج (−):
  - البيع: الأقرب انتهاءً أولاً (FEFO) من الصالح فقط. الكمية المنتهية لا تُباع أبداً.
  - مرتجع الشراء: من دفعات نفس فاتورة الشراء أولاً.
  - التالف/الجرد/الهدايا: الدفعة المحددة، ثم المنتهي، ثم FEFO.
- الصنف بلا صلاحية في دفعة (None) يُعامل كصالح دائماً ويُستهلك آخراً.
"""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.base import uuid7
from app.core.constants import QTY_SCALE
from app.core.errors import ConflictError
from app.core.periods import local_today
from app.core.security import Actor

from .model import BatchMove, ProductBatch

SALE = "sale"
SALE_RETURN = "sale_return"
PURCHASE = "purchase"
PURCHASE_RETURN = "purchase_return"


@dataclass(frozen=True, slots=True)
class BatchIn:
    batch_no: str | None = None
    expiry_date: date | None = None


def is_expired(batch: ProductBatch, today: date) -> bool:
    return batch.expiry_date is not None and batch.expiry_date < today


def _fefo_key(b: ProductBatch):
    return (b.expiry_date is None, b.expiry_date or date.max, b.id)


def _qty_text(qty: int) -> str:
    value = qty / QTY_SCALE
    return f"{value:g}"


class BatchEngine:
    def __init__(self, session: Session, actor: Actor) -> None:
        self.session = session
        self.actor = actor

    # ---------- قراءة ----------
    def live_batches(self, product_id: str) -> list[ProductBatch]:
        return list(
            self.session.scalars(
                select(ProductBatch).where(
                    ProductBatch.product_id == product_id,
                    ProductBatch.qty_remaining > 0,
                    ProductBatch.deleted_at.is_(None),
                )
            ).all()
        )

    # ---------- كتابة ----------
    def apply(
        self,
        product,  # noqa: ANN001 - Product (تفادي الاستيراد الدائري)
        *,
        movement_id: str | None,
        movement_type: str,
        delta: int,
        unit_cost: int,
        ref_type: str | None,
        ref_id: str | None,
        batch_in: BatchIn | None = None,
        batch_id: str | None = None,
        origin_id: str | None = None,
    ) -> None:
        if not product.track_expiry or delta == 0:
            return
        ctx = dict(movement_id=movement_id, ref_type=ref_type, ref_id=ref_id, origin_id=origin_id)
        if delta > 0:
            left = delta
            if movement_type == SALE_RETURN and origin_id:
                left = self._restore_sale(product, delta, origin_id, ctx)
            elif batch_id:
                batch = self.session.get(ProductBatch, batch_id)
                if batch is not None and batch.product_id == product.id:
                    batch.qty_remaining += left
                    self._move(batch, left, ctx)
                    left = 0
            if left > 0:
                self._new_batch(product, left, unit_cost, movement_type, batch_in, ctx)
            return
        self._consume(product, -delta, movement_type, batch_id, origin_id, ctx)

    def reconcile(self, product) -> None:  # noqa: ANN001
        """عند بدء التتبع (أو أي اختلاف): مجموع الدفعات = رصيد الصنف."""
        total = sum(b.qty_remaining for b in self.live_batches(product.id))
        diff = product.stock_qty - total
        ctx = dict(movement_id=None, ref_type="reconcile", ref_id=product.id, origin_id=None)
        if diff > 0:
            self._new_batch(product, diff, product.cost_price, "opening", None, ctx)
        elif diff < 0:
            self._take(self._order(product, "count", None, None), -diff, ctx)

    # ---------- داخلي ----------
    def _new_batch(self, product, qty, unit_cost, source, batch_in, ctx) -> ProductBatch:  # noqa: ANN001
        batch = ProductBatch(
            id=uuid7(),
            device_id=self.actor.device_id,
            created_by=self.actor.user_id,
            product_id=product.id,
            batch_no=batch_in.batch_no if batch_in else None,
            expiry_date=batch_in.expiry_date if batch_in else None,
            qty_in=qty,
            qty_remaining=qty,
            unit_cost=unit_cost,
            received_on=local_today(),
            source=source,
            ref_type=ctx["ref_type"],
            ref_id=ctx["ref_id"],
        )
        self.session.add(batch)
        self._move(batch, qty, ctx)
        return batch

    def _move(self, batch: ProductBatch, qty: int, ctx: dict) -> None:
        self.session.add(
            BatchMove(
                id=uuid7(),
                device_id=self.actor.device_id,
                created_by=self.actor.user_id,
                batch_id=batch.id,
                product_id=batch.product_id,
                qty=qty,
                **ctx,
            )
        )

    def _restore_sale(self, product, qty: int, sale_id: str, ctx: dict) -> int:  # noqa: ANN001
        """يرجّع المرتجع لنفس دفعات الفاتورة (ما بيع منها ناقص ما رجع قبل ذلك). يرجّع الباقي."""
        self.session.flush()
        sold = dict(
            self.session.execute(
                select(BatchMove.batch_id, -func.sum(BatchMove.qty))
                .where(
                    BatchMove.ref_type == SALE,
                    BatchMove.ref_id == sale_id,
                    BatchMove.product_id == product.id,
                )
                .group_by(BatchMove.batch_id)
            ).all()
        )
        back = dict(
            self.session.execute(
                select(BatchMove.batch_id, func.sum(BatchMove.qty))
                .where(
                    BatchMove.ref_type == SALE_RETURN,
                    BatchMove.origin_id == sale_id,
                    BatchMove.product_id == product.id,
                )
                .group_by(BatchMove.batch_id)
            ).all()
        )
        left = qty
        for batch_id in sorted(sold):
            room = (sold[batch_id] or 0) - (back.get(batch_id) or 0)
            if room <= 0 or left <= 0:
                continue
            batch = self.session.get(ProductBatch, batch_id)
            if batch is None:
                continue
            take = min(room, left)
            batch.qty_remaining += take
            self._move(batch, take, ctx)
            left -= take
        return left

    def _order(self, product, movement_type: str, batch_id, origin_id) -> list[ProductBatch]:  # noqa: ANN001
        today = local_today()
        batches = self.live_batches(product.id)
        valid = sorted((b for b in batches if not is_expired(b, today)), key=_fefo_key)
        if movement_type == SALE:
            return valid
        expired = sorted((b for b in batches if is_expired(b, today)), key=_fefo_key)
        preferred: list[ProductBatch] = []
        if batch_id:
            preferred = [b for b in batches if b.id == batch_id]
        elif movement_type == PURCHASE_RETURN and origin_id:
            preferred = sorted(
                (b for b in batches if b.ref_type == PURCHASE and b.ref_id == origin_id),
                key=_fefo_key,
            )
        seen: set[str] = set()
        ordered = []
        for b in [*preferred, *expired, *valid]:
            if b.id not in seen:
                seen.add(b.id)
                ordered.append(b)
        return ordered

    def _take(self, ordered: list[ProductBatch], need: int, ctx: dict) -> int:
        for batch in ordered:
            if need <= 0:
                break
            take = min(batch.qty_remaining, need)
            if take <= 0:
                continue
            batch.qty_remaining -= take
            self._move(batch, -take, ctx)
            need -= take
        return need

    def _consume(self, product, need: int, movement_type, batch_id, origin_id, ctx) -> None:  # noqa: ANN001
        ordered = self._order(product, movement_type, batch_id, origin_id)
        if movement_type == SALE:
            valid = sum(b.qty_remaining for b in ordered)
            expired = sum(b.qty_remaining for b in self.live_batches(product.id)) - valid
            if valid < need and expired > 0:
                raise ConflictError(
                    "expired_stock",
                    f"الكمية الصالحة من «{product.name}» {_qty_text(valid)} فقط، والباقي منتهي الصلاحية. "
                    "أعدم المنتهي من شاشة «الصلاحية»",
                    {"product": product.name, "valid": valid, "expired": expired},
                )
        # المتبقي بلا دفعات (رصيد سالب مسموح) يبقى بلا توزيع.
        self._take(ordered, need, ctx)


def expiry_info(session: Session, product_ids: list[str]) -> dict[str, tuple[date | None, int, int]]:
    """لكل صنف: (أقرب صلاحية للكمية الصالحة، الكمية المنتهية، كمية الدفعات الصالحة)."""
    if not product_ids:
        return {}
    today = local_today()
    rows = session.execute(
        select(ProductBatch.product_id, ProductBatch.expiry_date, ProductBatch.qty_remaining).where(
            ProductBatch.product_id.in_(product_ids),
            ProductBatch.qty_remaining > 0,
            ProductBatch.deleted_at.is_(None),
        )
    ).all()
    out: dict[str, list] = defaultdict(lambda: [None, 0, 0])
    for pid, expiry, qty in rows:
        info = out[pid]
        if expiry is not None and expiry < today:
            info[1] += qty
        else:
            info[2] += qty
            if expiry is not None and (info[0] is None or expiry < info[0]):
                info[0] = expiry
    return {pid: (v[0], v[1], v[2]) for pid, v in out.items()}
