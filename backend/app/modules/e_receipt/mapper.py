"""تحويل فاتورة/مرتجع Dealzora إلى مستند الإيصال v1.2. دوال نقية (بلا قاعدة بيانات) سهلة الاختبار.

القاعدة: أرقام كل سطر مأخوذة من الضريبة المخزّنة وقت البيع (المرحلة 1)، فإجماليات المستند = الفاتورة:
  unitPrice  = سعر وحدة البيع قبل الضريبة (شامل: السعر ÷ (1 + النسبة)، بخمس منازل)
  totalSale  = quantity × unitPrice                                  (main-calculations rule 11)
  netSale    = SaleLine.taxable_amount (الصافي قبل الضريبة بعد كل الخصومات)
  الخصومات   = totalSale − netSale، مفصّلة في commercialDiscountData (قبل الضريبة):
               العرض، خصم الكاشير، نصيب السطر من خصم الفاتورة ومن نقاط الولاء     (rule 13)
  T1         = SaleLine.tax_amount بنسبة السطر وقت البيع                      (rule 42)
  total      = netSale + T1 = SaleLine.net_total (ما دفعه العميل في السطر)     (rule 17)
خصم الفاتورة والولاء يُوزَّعان على السطور قبل الضريبة (هكذا حُسبت الضريبة)، فهما commercial discount
وليسا extraReceiptDiscountData (الذي يُطرح بعد الضريبة).
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from .constants import (
    BUYER_PERSON,
    DISCOUNT_INVOICE,
    DISCOUNT_LINE,
    DISCOUNT_LOYALTY,
    DISCOUNT_PROMO,
    CURRENCY,
    MAX_BUYER_MOBILE,
    MAX_BUYER_NAME,
    MAX_DESCRIPTION,
    MAX_DISCOUNT_DESCRIPTION,
    MONEY_SCALE,
    Q5,
    QTY_SCALE,
    RATE_SCALE,
    TYPE_VERSION,
    VAT_SUBTYPES,
    VAT_TAX_TYPE,
)


def q5(value: Decimal) -> Decimal:
    return value.quantize(Q5, rounding=ROUND_HALF_UP)


def money(cents: int) -> Decimal:
    return Decimal(cents) / MONEY_SCALE


@dataclass(frozen=True, slots=True)
class LineSpec:
    internal_code: str
    description: str
    item_type: str | None
    item_code: str | None
    unit_type: str | None
    qty: int  # بوحدة البيع × 1000
    unit_price: int  # سعر وحدة البيع كما بيعت (قروش، بطبيعة إعداد الضريبة: شامل/غير شامل)
    tax_mode: str | None  # off/inclusive/exclusive وقت البيع
    tax_type: str | None  # taxable/exempt/zero (لقطة السطر)
    tax_rate: int  # النسبة المطبقة فعلاً (نقاط أساس)
    taxable: int  # الصافي قبل الضريبة (قروش)
    tax: int
    total: int  # المدفوع = taxable + tax
    # الخصومات بقيمتها في الفاتورة (قروش، بنفس طبيعة السعر). (الوصف، المبلغ) بالترتيب.
    discounts: list[tuple[str, Decimal]] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class BuyerSpec:
    type: str = BUYER_PERSON
    id: str | None = None
    name: str | None = None
    mobile: str | None = None


@dataclass(frozen=True, slots=True)
class SellerSpec:
    rin: str | None
    trade_name: str | None
    branch_code: str | None
    branch_address: dict[str, str | None]  # بأسماء الـ SDK وترتيب جدول BranchAddress
    device_serial: str | None
    activity_code: str | None


@dataclass(frozen=True, slots=True)
class ReceiptSpec:
    receipt_type: str  # SR / r
    issued_at: datetime
    receipt_number: str
    previous_uuid: str
    reference_uuid: str | None  # للمرتجع فقط
    seller: SellerSpec
    buyer: BuyerSpec
    payment_code: str
    lines: list[LineSpec]


def discount_parts(
    *, promo_name: str | None, promo: int, line_discount: int, line_total: int, net: int,
    invoice_discount: int, loyalty_discount: int,
) -> list[tuple[str, Decimal]]:  # fmt: skip
    """خصومات السطر بقيمتها في الفاتورة (قروش بطبيعة السعر): العرض، خصم الكاشير، ونصيب السطر من
    خصم الفاتورة ونقاط الولاء (line_total − net، مقسوماً بنسبتهما على مستوى الفاتورة).
    net = صافي السطر بعد خصم الفاتورة بطبيعة السعر (tax/calc TaxLineOut.net)."""
    share = Decimal(line_total - net)
    pooled = invoice_discount + loyalty_discount
    invoice_share = share * invoice_discount / pooled if pooled else share
    return [
        (promo_name or DISCOUNT_PROMO, Decimal(promo)),
        (DISCOUNT_LINE, Decimal(line_discount)),
        (DISCOUNT_INVOICE, invoice_share),
        (DISCOUNT_LOYALTY, share - invoice_share),
    ]


def iso_utc(moment: datetime) -> str:
    """dateTimeIssued: «DateTime in UTC» مثل 2022-02-03T00:00:00Z."""
    if moment.tzinfo is None:  # SQLite يرجع التاريخ بلا منطقة (مخزّن UTC)
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _split(total: Decimal, parts: list[tuple[str, Decimal]]) -> list[tuple[str, Decimal]]:
    """يوزّع total (5 منازل) على الأجزاء بنسبتها، والباقي على آخر جزء، فالمجموع = total بالضبط."""
    weights = [(d, w) for d, w in parts if w > 0]
    if total <= 0:
        return []
    if not weights:
        return [(parts[0][0] if parts else "", total)]
    base = sum(w for _, w in weights)
    out: list[tuple[str, Decimal]] = []
    used = Decimal(0)
    for i, (desc, w) in enumerate(weights):
        amount = total - used if i == len(weights) - 1 else q5(total * w / base)
        used += amount
        out.append((desc, amount))
    return [(d, a) for d, a in out if a > 0]


def build_item(line: LineSpec) -> dict[str, Any]:
    rate = Decimal(line.tax_rate) / RATE_SCALE
    divisor = 1 + rate if line.tax_mode == "inclusive" else Decimal(1)
    unit_price = q5(money(line.unit_price) / divisor)
    quantity = Decimal(line.qty) / QTY_SCALE
    total_sale = q5(quantity * unit_price)
    net_sale = money(line.taxable)
    discounts = _split(
        total_sale - net_sale,
        [(desc[:MAX_DISCOUNT_DESCRIPTION], amount / MONEY_SCALE / divisor) for desc, amount in line.discounts],
    )
    item: dict[str, Any] = {
        "internalCode": line.internal_code,
        "description": line.description[:MAX_DESCRIPTION],
        "itemType": line.item_type or "",
        "itemCode": line.item_code or "",
        "unitType": line.unit_type or "",
        "quantity": quantity,
        "unitPrice": unit_price,
        "netSale": net_sale,
        "totalSale": total_sale,
        "total": money(line.total),
    }
    if discounts:
        item["commercialDiscountData"] = [{"amount": a, "description": d} for d, a in discounts]
    if line.tax_type is not None and line.tax_mode not in (None, "off"):
        item["taxableItems"] = [
            {
                "taxType": VAT_TAX_TYPE,
                "amount": money(line.tax),
                "subType": VAT_SUBTYPES.get(line.tax_type, ""),
                "rate": Decimal(line.tax_rate) / 100,  # نسبة مئوية بمنزلتين كحد أقصى (rule 32)
            }
        ]
    return item


def build_document(spec: ReceiptSpec) -> dict[str, Any]:
    """المستند بترتيب جداول الـ SDK (الترتيب يدخل في التسلسل فيجب أن يبقى ثابتاً). header.uuid فارغ."""
    header: dict[str, Any] = {
        "dateTimeIssued": iso_utc(spec.issued_at),
        "receiptNumber": spec.receipt_number,
        "uuid": "",
        "previousUUID": spec.previous_uuid,
    }
    if spec.reference_uuid is not None:
        header["referenceUUID"] = spec.reference_uuid
    header["currency"] = CURRENCY

    s = spec.seller
    seller = {
        "rin": s.rin or "",
        "companyTradeName": s.trade_name or "",
        "branchCode": s.branch_code or "",
        "branchAddress": {k: v for k, v in s.branch_address.items() if v not in (None, "")},
        "deviceSerialNumber": s.device_serial or "",
        "activityCode": s.activity_code or "",
    }
    buyer: dict[str, Any] = {"type": spec.buyer.type}
    if spec.buyer.id:
        buyer["id"] = spec.buyer.id
    if spec.buyer.name:
        buyer["name"] = spec.buyer.name[:MAX_BUYER_NAME]
    if spec.buyer.mobile:
        buyer["mobileNumber"] = spec.buyer.mobile[:MAX_BUYER_MOBILE]

    items = [build_item(line) for line in spec.lines]
    taxes = [t for item in items for t in item.get("taxableItems", [])]
    document: dict[str, Any] = {
        "header": header,
        "documentType": {"receiptType": spec.receipt_type, "typeVersion": TYPE_VERSION},
        "seller": seller,
        "buyer": buyer,
        "itemData": items,
        "totalSales": sum((i["totalSale"] for i in items), Decimal(0)),
        "totalCommercialDiscount": sum(
            (d["amount"] for i in items for d in i.get("commercialDiscountData", [])), Decimal(0)
        ),
        "netAmount": sum((i["netSale"] for i in items), Decimal(0)),
        "totalAmount": sum((i["total"] for i in items), Decimal(0)),
    }
    if taxes:
        document["taxTotals"] = [{"taxType": VAT_TAX_TYPE, "amount": sum((t["amount"] for t in taxes), Decimal(0))}]
    document["paymentMethod"] = spec.payment_code
    return document
