"""حساب ضريبة القيمة المضافة والتقريب: المكان الوحيد في النظام. دوال نقية (بلا قاعدة بيانات ولا HTTP).

كل المبالغ أعداد صحيحة بالقروش، والنسب بنقاط الأساس (1400 = 14%). نفس الحساب حرفياً في
الكاشير (frontend/lib/tax.ts)، والسيرفر هو المرجع.

ترتيب التطبيق (لكل سطر، ثم الفاتورة):
  1) سعر وحدة البيع: قطاعي أو جملة، والكرتونة/الدستة بسعرها الخاص أو سعر القطعة × العدد
     (sales/pricing.py). الكمية العشرية تُضرب في السعر وتُقرَّب لأقرب قرش (qty_amount).
  2) العرض التلقائي (promotion) على قيمة السطر.
  3) خصم الكاشير على السطر.
     ← amount = قيمة السطر بعد 2 و3 (SaleLine.line_total).
  4) خصم الفاتورة ثم خصم نقاط الولاء: يُوزَّعان معاً على السطور بنسبة قيمتها (allocate)،
     والباقي من التقريب على آخر سطر. الولاء خصم يُنقص الوعاء الضريبي، لا وسيلة دفع.
     ← net = صافي السطر بعد كل الخصومات، بنفس طبيعة سعر البيع (شامل أو غير شامل).
  5) الضريبة على net لكل سطر بنسبة صنفه، وتُقرَّب لكل سطر على حدة (نصف القرش لأعلى):
     - شامل:     tax = net × r ÷ (1 + r)   والإجمالي = net (لا يتغير ما يدفعه العميل)
     - غير شامل: tax = net × r            والإجمالي = net + tax
     - معفى / نسبة صفر / الضريبة متوقفة: tax = 0
  6) الفاتورة = مجموع السطور حرفياً (الوعاء والضريبة والإجمالي)، فلا يوجد فرق تقريب بين
     مجموع ضرائب السطور وضريبة الفاتورة.

المرتجع: يأخذ من ضريبة السطر الأصلي المخزّنة نسبةَ الكمية المرتجعة (لا النسبة الحالية للصنف)،
وآخر كمية متبقية تأخذ الباقي بالضبط، فمرتجع السطر كاملاً على دفعات = ضريبته بالقرش.
"""

from dataclasses import dataclass

from app.modules.sales.helper import allocate, proportional, round_div

from .constants import RATE_SCALE, TaxMode, TaxType


@dataclass(frozen=True, slots=True)
class TaxLineIn:
    amount: int  # قيمة السطر بعد العرض وخصم السطر (قبل خصم الفاتورة)
    tax_type: str  # TaxType
    rate: int  # نسبة الصنف (نقاط أساس)


@dataclass(frozen=True, slots=True)
class TaxLineOut:
    tax_type: str | None  # لقطة نوع الصنف، None لو الضريبة متوقفة
    rate: int  # النسبة المطبقة فعلاً (0 للمعفى/الصفري/المتوقف)
    net: int  # بعد توزيع خصم الفاتورة والولاء
    taxable: int  # الصافي قبل الضريبة
    tax: int
    total: int  # المدفوع فعلاً = taxable + tax


@dataclass(frozen=True, slots=True)
class InvoiceTax:
    mode: TaxMode
    lines: list[TaxLineOut]
    taxable: int
    tax: int
    total: int


@dataclass(frozen=True, slots=True)
class ReturnSplit:
    amount: int  # ما يُرد للعميل من السطر (شامل الضريبة)
    tax: int | None  # None لسطر بيع قبل إضافة الضريبة (لم تُحسب له)


def applied_rate(mode: TaxMode, tax_type: str, rate: int) -> int:
    """النسبة التي تُطبق فعلاً على السطر."""
    if mode is TaxMode.OFF or tax_type != TaxType.TAXABLE.value:
        return 0
    return max(rate, 0)


def split_line(net: int, rate: int, mode: TaxMode) -> tuple[int, int, int]:
    """(الوعاء، الضريبة، الإجمالي) لصافي سطر واحد."""
    if rate <= 0 or net <= 0:
        return net, 0, net
    if mode is TaxMode.INCLUSIVE:
        tax = round_div(net * rate, RATE_SCALE + rate)
        return net - tax, tax, net
    tax = round_div(net * rate, RATE_SCALE)  # EXCLUSIVE
    return net, tax, net + tax


def compute_invoice(lines: list[TaxLineIn], discount: int, mode: TaxMode) -> InvoiceTax:
    """discount = خصم الفاتورة + خصم الولاء (يُوزَّعان معاً على السطور)."""
    nets = allocate(discount, [line.amount for line in lines])
    out: list[TaxLineOut] = []
    for line, net in zip(lines, nets, strict=True):
        rate = applied_rate(mode, line.tax_type, line.rate)
        taxable, tax, total = split_line(net, rate, mode)
        out.append(
            TaxLineOut(
                tax_type=None if mode is TaxMode.OFF else line.tax_type,
                rate=rate,
                net=net,
                taxable=taxable,
                tax=tax,
                total=total,
            )
        )
    return InvoiceTax(
        mode=mode,
        lines=out,
        taxable=sum(line.taxable for line in out),
        tax=sum(line.tax for line in out),
        total=sum(line.total for line in out),
    )


def return_split(
    *,
    qty: int,
    line_qty: int,
    line_total: int,
    line_tax: int | None,
    returned_qty: int,
    returned_amount: int,
    returned_tax: int,
) -> ReturnSplit:
    """قيمة وضريبة إرجاع qty من سطر بيع (الكميات × 1000).
    line_total = المدفوع في السطر (SaleLine.net_total)، line_tax = ضريبته المخزّنة وقت البيع.
    """
    last = qty == line_qty - returned_qty
    amount = line_total - returned_amount if last else proportional(qty, line_qty, line_total)
    if line_tax is None:
        return ReturnSplit(amount=amount, tax=None)
    tax = line_tax - returned_tax if last else proportional(qty, line_qty, line_tax)
    return ReturnSplit(amount=amount, tax=min(max(tax, 0), amount))
