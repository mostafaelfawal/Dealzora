"""تسعير سطور الفاتورة: سعر الجملة والعروض التلقائية. السيرفر هو المرجع.

نفس الحساب مكتوب في الكاشير (frontend/features/pos/lib/pricing.ts) حرفياً بالقروش،
والسيرفر يقارن ما رآه الكاشير بما حسبه هنا ويرفض أي اختلاف (السعر تغيّر / العرض تغيّر).

القواعد:
1) سعر الجملة: الصنف له سعر جملة، والعميل «عميل جملة» أو الكمية من الصنف في الفاتورة
   (كل وحداته) وصلت «كمية الجملة». الكرتونة بسعر خاص لا تتأثر؛ المحسوبة من سعر القطعة
   تُحسب من سعر الجملة. سعر الجملة لا يزيد عن القطاعي أبداً.
2) العروض: على سعر القطاعي فقط (لا تجتمع مع الجملة). لكل سطر أفضل عرض للعميل.
   - percent: نسبة من قيمة السطر.
   - amount:  مبلغ ثابت × الكمية بالوحدة الأساسية.
   - buy_get: اشتري X وخد Y على الوحدة الأساسية فقط وبالقطع الكاملة.
   - min_qty (للخصومات): يُطبق لو كمية السطر بالوحدة الأساسية وصلتها.
"""

from collections import defaultdict
from dataclasses import dataclass

from app.core.constants import QTY_SCALE
from app.modules.products.model import Product, ProductUnit
from app.modules.promotions.constants import PromoKind, PromoScope
from app.modules.promotions.model import Promotion

from .helper import base_qty, qty_amount, round_div


@dataclass(frozen=True, slots=True)
class LineInput:
    product: Product
    unit: ProductUnit | None
    qty: int  # بوحدة البيع × 1000


@dataclass(frozen=True, slots=True)
class LinePrice:
    factor: int
    unit_name: str
    base: int  # بالوحدة الأساسية × 1000
    price: int  # سعر وحدة البيع الفعلي (قطاعي أو جملة)
    wholesale: bool
    gross: int
    promo: int
    promo_id: str | None
    promo_name: str | None


def unit_prices(product: Product, unit: ProductUnit | None) -> tuple[int, int, str, int | None]:
    """(المعامل، سعر القطاعي، اسم الوحدة، سعر الجملة أو None)."""
    wholesale = product.wholesale_price
    if unit is None:
        return QTY_SCALE, product.sale_price, product.unit, wholesale
    retail = unit.sale_price or qty_amount(unit.factor, product.sale_price)
    unit_wholesale = (
        qty_amount(unit.factor, wholesale) if wholesale is not None and not unit.sale_price else None
    )
    return unit.factor, retail, unit.name, unit_wholesale


def promo_matches(promo: Promotion, product: Product) -> bool:
    if promo.scope == PromoScope.ALL.value:
        return True
    if promo.scope == PromoScope.CATEGORY.value:
        return bool(product.category_id) and product.category_id == promo.category_id
    return product.id in (promo.product_ids or [])


def promo_amount(promo: Promotion, *, is_base_unit: bool, base: int, price: int, gross: int) -> int:
    if promo.kind == PromoKind.BUY_GET.value:
        if not is_base_unit or not promo.buy_qty or not promo.get_qty:
            return 0
        group = promo.buy_qty + promo.get_qty
        free = (base // QTY_SCALE) // group * promo.get_qty
        return min(gross, free * price)
    if promo.min_qty and base < promo.min_qty:
        return 0
    if promo.kind == PromoKind.PERCENT.value:
        return min(gross, round_div(gross * promo.value, 100))
    if promo.kind == PromoKind.AMOUNT.value:
        return min(gross, qty_amount(base, promo.value))
    return 0


def price_lines(
    lines: list[LineInput], *, wholesale_customer: bool, promos: list[Promotion]
) -> list[LinePrice]:
    infos = [unit_prices(line.product, line.unit) for line in lines]
    bases = [base_qty(line.qty, info[0]) for line, info in zip(lines, infos, strict=True)]
    demand: dict[str, int] = defaultdict(int)
    for line, base in zip(lines, bases, strict=True):
        demand[line.product.id] += base

    out: list[LinePrice] = []
    for line, (factor, retail, unit_name, wholesale), base in zip(lines, infos, bases, strict=True):
        p = line.product
        reached = bool(p.wholesale_min_qty) and demand[p.id] >= (p.wholesale_min_qty or 0)
        use_wholesale = wholesale is not None and wholesale < retail and (wholesale_customer or reached)
        price = wholesale if use_wholesale and wholesale is not None else retail
        gross = qty_amount(line.qty, price)

        best, best_promo = 0, None
        if not use_wholesale:
            for promo in promos:
                if not promo_matches(promo, p):
                    continue
                amount = promo_amount(
                    promo, is_base_unit=line.unit is None, base=base, price=price, gross=gross
                )
                if amount > best:
                    best, best_promo = amount, promo
        out.append(
            LinePrice(
                factor=factor,
                unit_name=unit_name,
                base=base,
                price=price,
                wholesale=use_wholesale,
                gross=gross,
                promo=best,
                promo_id=best_promo.id if best_promo else None,
                promo_name=best_promo.name if best_promo else None,
            )
        )
    return out
