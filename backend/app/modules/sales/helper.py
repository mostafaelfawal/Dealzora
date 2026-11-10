"""دوال حسابية نقية (بدون قاعدة بيانات ولا HTTP)، سهلة الاختبار. كل المبالغ أعداد صحيحة بالقروش."""

from app.core.constants import QTY_SCALE


def round_div(numerator: int, denominator: int) -> int:
    """قسمة صحيحة مع تقريب النصف لأعلى (للموجب)، بدون float."""
    if denominator <= 0:
        return 0
    return (numerator * 2 + denominator) // (denominator * 2)


def qty_amount(qty: int, unit_price: int) -> int:
    """قيمة كمية (× 1000) بسعر وحدة (قروش)."""
    return round_div(qty * unit_price, QTY_SCALE)


def base_qty(qty: int, factor: int) -> int:
    """الكمية بوحدة البيع (× 1000) → الوحدة الأساسية (× 1000)."""
    return round_div(qty * factor, QTY_SCALE)


def allocate(total_discount: int, amounts: list[int]) -> list[int]:
    """يوزّع خصم الفاتورة على السطور بنسبة قيمتها، والباقي من التقريب على آخر سطر له قيمة.
    مجموع الناتج = sum(amounts) - total_discount بالضبط.
    """
    base = sum(amounts)
    if base <= 0 or total_discount <= 0:
        return list(amounts)
    shares = [total_discount * a // base for a in amounts]
    remainder = total_discount - sum(shares)
    for i in range(len(amounts) - 1, -1, -1):
        if amounts[i] - shares[i] >= remainder:
            shares[i] += remainder
            break
    return [a - s for a, s in zip(amounts, shares, strict=True)]


def proportional(part_qty: int, full_qty: int, value: int) -> int:
    return round_div(value * part_qty, full_qty) if full_qty > 0 else 0


def exceeds_percent(discount: int, base: int, max_percent: int) -> bool:
    return discount * 100 > base * max_percent
