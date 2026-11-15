"""اختبارات وحدة لحساب ضريبة القيمة المضافة (app/modules/tax/calc.py).

التشغيل من مجلد backend:  .venv/Scripts/python -m unittest discover -s tests -v
"""

import random
import unittest

from app.modules.sales.helper import qty_amount
from app.modules.tax.calc import TaxLineIn, applied_rate, compute_invoice, return_split, split_line
from app.modules.tax.constants import TaxMode, TaxType

T, E, Z = TaxType.TAXABLE.value, TaxType.EXEMPT.value, TaxType.ZERO.value
INC, EXC, OFF = TaxMode.INCLUSIVE, TaxMode.EXCLUSIVE, TaxMode.OFF


def line(amount: int, tax_type: str = T, rate: int = 1400) -> TaxLineIn:
    return TaxLineIn(amount=amount, tax_type=tax_type, rate=rate)


class SplitLineTests(unittest.TestCase):
    def test_inclusive_extracts_tax_and_keeps_total(self):
        self.assertEqual(split_line(11400, 1400, INC), (10000, 1400, 11400))

    def test_exclusive_adds_tax_on_top(self):
        self.assertEqual(split_line(10000, 1400, EXC), (10000, 1400, 11400))

    def test_rounding_half_piaster_up(self):
        # 2500 × 14 / 114 = 307.017… → 307 ؛ 50 × 14% = 7.0 ؛ 25 × 14% = 3.5 → 4
        self.assertEqual(split_line(2500, 1400, INC), (2193, 307, 2500))
        self.assertEqual(split_line(25, 1400, EXC), (25, 4, 29))

    def test_zero_or_negative_amount(self):
        self.assertEqual(split_line(0, 1400, INC), (0, 0, 0))


class AppliedRateTests(unittest.TestCase):
    def test_exempt_and_zero_and_off(self):
        self.assertEqual(applied_rate(INC, E, 1400), 0)
        self.assertEqual(applied_rate(EXC, Z, 1400), 0)
        self.assertEqual(applied_rate(OFF, T, 1400), 0)
        self.assertEqual(applied_rate(INC, T, 500), 500)


class InvoiceTests(unittest.TestCase):
    def test_inclusive_total_unchanged(self):
        inv = compute_invoice([line(11400), line(5700)], 0, INC)
        self.assertEqual(inv.total, 17100)
        self.assertEqual(inv.tax, 1400 + 700)
        self.assertEqual(inv.taxable, 17100 - 2100)

    def test_exclusive_total_includes_tax(self):
        inv = compute_invoice([line(10000), line(5000)], 0, EXC)
        self.assertEqual(inv.taxable, 15000)
        self.assertEqual(inv.tax, 2100)
        self.assertEqual(inv.total, 17100)

    def test_exempt_and_zero_rated_lines(self):
        inv = compute_invoice([line(10000, E), line(5000, Z), line(11400)], 0, INC)
        exempt, zero, taxed = inv.lines
        self.assertEqual((exempt.tax, exempt.rate, exempt.tax_type), (0, 0, E))
        self.assertEqual((zero.tax, zero.rate, zero.tax_type), (0, 0, Z))
        self.assertEqual(taxed.tax, 1400)
        self.assertEqual(inv.total, 26400)
        self.assertEqual(inv.tax, 1400)

    def test_off_mode_is_exactly_old_behaviour(self):
        inv = compute_invoice([line(10000), line(5000, E)], 1500, OFF)
        self.assertEqual([l.total for l in inv.lines], [9000, 4500])
        self.assertEqual(inv.total, 13500)  # = المجموع - الخصم كما قبل الإضافة
        self.assertEqual(inv.tax, 0)
        self.assertTrue(all(l.tax_type is None and l.rate == 0 for l in inv.lines))

    def test_line_discount_is_before_tax(self):
        # 3 قطع × 10 ج = 3000، عرض 0 وخصم سطر 5 ج → الوعاء 2500 (شامل)
        gross, promo, discount = qty_amount(3000, 1000), 0, 500
        inv = compute_invoice([line(gross - promo - discount)], 0, INC)
        self.assertEqual(inv.lines[0].tax, 307)
        self.assertEqual(inv.total, 2500)

    def test_promo_and_line_discount_exclusive(self):
        # 12 قطعة × 5 ج = 6000، عرض 10% = 600، خصم سطر 400 → 5000 قبل الضريبة
        inv = compute_invoice([line(6000 - 600 - 400)], 0, EXC)
        self.assertEqual((inv.taxable, inv.tax, inv.total), (5000, 700, 5700))

    def test_invoice_discount_is_allocated_before_tax(self):
        inv = compute_invoice([line(10000), line(5000)], 1500, EXC)
        self.assertEqual([l.net for l in inv.lines], [9000, 4500])
        self.assertEqual([l.tax for l in inv.lines], [1260, 630])
        self.assertEqual(inv.tax, 1890)
        self.assertEqual(inv.total, 13500 + 1890)

    def test_invoice_plus_loyalty_discount_inclusive(self):
        # خصم فاتورة 1000 + ولاء 500 يُوزَّعان معاً ويُنقصان الوعاء.
        inv = compute_invoice([line(11400), line(11400, E)], 1000 + 500, INC)
        self.assertEqual(sum(l.net for l in inv.lines), 22800 - 1500)
        self.assertEqual(inv.total, 21300)
        taxed = inv.lines[0]
        self.assertEqual(taxed.tax, round(taxed.net * 14 / 114))

    def test_decimal_quantities(self):
        # 1.250 كجم × 45.99 ج = 57.4875 → 5749 قرش ؛ 0.333 كجم × 120 ج = 39.96 → 3996
        a, b = qty_amount(1250, 4599), qty_amount(333, 12000)
        self.assertEqual((a, b), (5749, 3996))
        inv = compute_invoice([line(a), line(b, rate=500)], 0, EXC)
        self.assertEqual([l.tax for l in inv.lines], [805, 200])  # 804.86→805 ، 199.8→200
        self.assertEqual(inv.total, a + b + 1005)

    def test_extra_unit_carton_line(self):
        # كرتونة (12 قطعة) بسعر خاص 100 ج، كميتها 2 → 20000 ؛ نفس نسبة الصنف.
        inv = compute_invoice([line(qty_amount(2000, 10000))], 0, INC)
        self.assertEqual((inv.taxable, inv.tax), (17544, 2456))

    def test_line_taxes_sum_to_invoice_tax_randomised(self):
        rnd = random.Random(20261115)
        for _ in range(500):
            n = rnd.randint(1, 12)
            lines = [
                line(rnd.randint(1, 500_000), rnd.choice([T, T, T, E, Z]), rnd.choice([1400, 500, 1000]))
                for _ in range(n)
            ]
            base = sum(l.amount for l in lines)
            discount = rnd.randint(0, base)
            for mode in (INC, EXC, OFF):
                inv = compute_invoice(lines, discount, mode)
                self.assertEqual(inv.tax, sum(l.tax for l in inv.lines))
                self.assertEqual(inv.taxable, sum(l.taxable for l in inv.lines))
                self.assertEqual(inv.total, inv.taxable + inv.tax)
                self.assertEqual(sum(l.net for l in inv.lines), base - discount)
                if mode is not EXC:  # شامل/متوقف: ما يدفعه العميل لا يتغير أبداً
                    self.assertEqual(inv.total, base - discount)


class ReturnTests(unittest.TestCase):
    def _sold(self):
        # سطر 3 قطع مدفوعه 11400 شاملاً ضريبة 1400
        return dict(line_qty=3000, line_total=11400, line_tax=1400)

    def test_partial_returns_sum_exactly(self):
        sold = self._sold()
        r_qty = r_amount = r_tax = 0
        parts = []
        for qty in (1000, 1000, 1000):
            s = return_split(qty=qty, returned_qty=r_qty, returned_amount=r_amount, returned_tax=r_tax, **sold)
            parts.append((s.amount, s.tax))
            r_qty, r_amount, r_tax = r_qty + qty, r_amount + s.amount, r_tax + (s.tax or 0)
        self.assertEqual(parts, [(3800, 467), (3800, 467), (3800, 466)])
        self.assertEqual((r_amount, r_tax), (11400, 1400))

    def test_partial_return_decimal_qty(self):
        # 2.500 كجم مدفوعها 5749 (ضريبة 706)، يرجع 0.750 ثم الباقي.
        sold = dict(line_qty=2500, line_total=5749, line_tax=706)
        first = return_split(qty=750, returned_qty=0, returned_amount=0, returned_tax=0, **sold)
        self.assertEqual((first.amount, first.tax), (1725, 212))
        rest = return_split(
            qty=1750, returned_qty=750, returned_amount=first.amount, returned_tax=first.tax or 0, **sold
        )
        self.assertEqual(first.amount + rest.amount, 5749)
        self.assertEqual((first.tax or 0) + (rest.tax or 0), 706)

    def test_return_uses_original_line_tax_not_current_rate(self):
        # بيع بنسبة 14% ثم تغيّرت نسبة الصنف: الدالة لا تقرأ الصنف أصلاً، فقط ضريبة السطر المخزّنة.
        inv = compute_invoice([line(11400, rate=1400)], 0, INC)
        tl = inv.lines[0]
        s = return_split(qty=1000, line_qty=1000, line_total=tl.total, line_tax=tl.tax,
                         returned_qty=0, returned_amount=0, returned_tax=0)  # fmt: skip
        self.assertEqual((s.amount, s.tax), (11400, 1400))

    def test_legacy_line_without_tax(self):
        s = return_split(qty=1000, line_qty=2000, line_total=5000, line_tax=None,
                         returned_qty=0, returned_amount=0, returned_tax=0)  # fmt: skip
        self.assertEqual((s.amount, s.tax), (2500, None))


if __name__ == "__main__":
    unittest.main()
