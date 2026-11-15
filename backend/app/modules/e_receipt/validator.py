"""تحقق محلي من مستند الإيصال قبل دخوله السلسلة: قواعد الـ SDK المعروفة، والأخطاء بالعربي.

المصادر: جداول retail/return receipt v1.2 (الإلزامي والأطوال)، و main-calculations (الحسابات،
بتسامح ± 0.5 ومنازل عشرية حتى 5)، و receiptissuancefaq (Core fields validator).
لا يغني عن تحقق المنظومة نفسها: قواعد لا نعرفها تظهر عند الإرسال (المرحلة 4).
"""

import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from app.modules.eta.codes import CodeTable, is_valid

from .constants import (
    BUYER_BUSINESS,
    BUYER_ID_THRESHOLD,
    BUYER_PERSON,
    CURRENCY,
    DECIMALS,
    MAX_DESCRIPTION,
    MAX_DISCOUNT_DESCRIPTION,
    MAX_INTERNAL_CODE,
    MAX_ITEMS,
    MAX_RECEIPT_NUMBER,
    RECEIPT_TYPE_RETURN,
    RECEIPT_TYPE_SALE,
    TOLERANCE,
    TYPE_VERSION,
    VAT_TAX_TYPE,
)

_HEX64 = re.compile(r"^[0-9a-fA-F]{64}$")
_DIGITS = {9: re.compile(r"^\d{9}$"), 14: re.compile(r"^\d{14}$")}
_REQUIRED_ADDRESS = (
    ("country", "الدولة"),
    ("governate", "المحافظة"),
    ("regionCity", "المدينة/المنطقة"),
    ("street", "الشارع"),
    ("buildingNumber", "رقم المبنى"),
)
_CLOCK_SKEW = timedelta(minutes=5)


def _dec(value: Any) -> Decimal:
    return value if isinstance(value, Decimal) else Decimal(str(value))


def _places(value: Decimal) -> int:
    exponent = value.normalize().as_tuple().exponent
    return -exponent if isinstance(exponent, int) and exponent < 0 else 0


def _close(a: Decimal, b: Decimal) -> bool:
    return abs(a - b) <= TOLERANCE


def validate(doc: dict[str, Any], *, now: datetime | None = None) -> list[str]:
    errors: list[str] = []
    err = errors.append
    header = doc.get("header") or {}
    seller = doc.get("seller") or {}
    buyer = doc.get("buyer") or {}
    items: list[dict[str, Any]] = doc.get("itemData") or []
    kind = (doc.get("documentType") or {}).get("receiptType")

    # ---- header ----
    if (doc.get("documentType") or {}).get("typeVersion") != TYPE_VERSION:
        err(f"إصدار المستند يجب أن يكون {TYPE_VERSION}")
    if kind not in (RECEIPT_TYPE_SALE, RECEIPT_TYPE_RETURN):
        err("نوع الإيصال غير معروف")
    number = header.get("receiptNumber") or ""
    if not number or len(number) > MAX_RECEIPT_NUMBER:
        err("رقم الإيصال مطلوب (حتى 50 حرفاً)")
    issued = header.get("dateTimeIssued") or ""
    try:
        moment = datetime.strptime(issued, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        if moment > (now or datetime.now(timezone.utc)) + _CLOCK_SKEW:
            err("تاريخ الإيصال في المستقبل. راجع ساعة الجهاز")
    except ValueError:
        err("تاريخ الإيصال غير صالح")
    previous = header.get("previousUUID", None)
    if previous is None or (previous != "" and not _HEX64.match(previous)):
        err("الـ UUID السابق للجهاز غير صالح")
    if kind == RECEIPT_TYPE_RETURN and not _HEX64.match(header.get("referenceUUID") or ""):
        err("إيصال المرتجع يحتاج UUID فاتورة البيع الأصلية")
    if header.get("currency") != CURRENCY:
        err("عملة الإيصال يجب أن تكون الجنيه المصري (EGP)")

    # ---- seller ----
    if not _DIGITS[9].match(seller.get("rin") or ""):
        err("رقم التسجيل الضريبي (RIN) يجب أن يكون 9 أرقام")
    if not seller.get("companyTradeName"):
        err("الاسم التجاري للمحل غير مكتوب")
    if not seller.get("branchCode"):
        err("كود الفرع في المنظومة غير مكتوب")
    address = seller.get("branchAddress") or {}
    missing = [label for key, label in _REQUIRED_ADDRESS if not address.get(key)]
    if missing:
        err("عنوان الفرع ناقص: " + "، ".join(missing))
    if address.get("country") and address.get("country") != "EG":
        err("دولة الفرع يجب أن تكون EG")
    if not seller.get("deviceSerialNumber"):
        err("الرقم التسلسلي للجهاز في المنظومة غير مكتوب")
    if not is_valid(CodeTable.ACTIVITIES, seller.get("activityCode")):
        err("كود النشاط غير موجود في جدول المنظومة")

    # ---- buyer ----
    total_amount = _dec(doc.get("totalAmount", 0))
    btype = buyer.get("type")
    if btype not in (BUYER_BUSINESS, BUYER_PERSON, "F"):
        err("نوع المشتري غير معروف")
    if btype == BUYER_BUSINESS:
        if not _DIGITS[9].match(buyer.get("id") or "") or not buyer.get("name"):
            err("المشتري شركة: رقم تسجيلها الضريبي (9 أرقام) واسمها مطلوبان")
        elif buyer.get("id") == seller.get("rin"):
            err("المشتري لا يكون المحل نفسه")
    if btype == BUYER_PERSON:
        if buyer.get("id") and not _DIGITS[14].match(buyer["id"]):
            err("الرقم القومي للمشتري يجب أن يكون 14 رقماً")
        if total_amount >= BUYER_ID_THRESHOLD and (not buyer.get("id") or not buyer.get("name")):
            err("إيصال بقيمة 150,000 جنيه أو أكثر يحتاج اسم المشتري ورقمه القومي")

    # ---- الأصناف ----
    if not items:
        err("الإيصال بلا أصناف")
    if len(items) > MAX_ITEMS:
        err(f"أقصى عدد أصناف في الإيصال {MAX_ITEMS}")
    for item in items:
        name = (item.get("description") or "صنف")[:40]

        def bad(msg: str, _name: str = name) -> None:
            err(f"«{_name}»: {msg}")

        if not item.get("internalCode") or len(item["internalCode"]) > MAX_INTERNAL_CODE:
            bad("الكود الداخلي مطلوب (حتى 50 حرفاً)")
        if not item.get("description") or len(item["description"]) > MAX_DESCRIPTION:
            bad("الوصف مطلوب")
        if item.get("itemType") not in ("EGS", "GS1"):
            bad("نوع كود المنظومة (EGS/GS1) غير محدد")
        if not item.get("itemCode"):
            bad("كود الصنف في المنظومة غير مكتوب")
        if not is_valid(CodeTable.UNITS, item.get("unitType")):
            bad("وحدة القياس بلا كود في المنظومة")
        qty, price = _dec(item["quantity"]), _dec(item["unitPrice"])
        total_sale, net_sale, total = _dec(item["totalSale"]), _dec(item["netSale"]), _dec(item["total"])
        if qty <= 0:
            bad("الكمية يجب أن تكون أكبر من صفر")
        if price < 0:
            bad("سعر الوحدة لا يكون سالباً")
        if any(_places(v) > DECIMALS for v in (qty, price, total_sale, net_sale, total)):
            bad("رقم بأكثر من 5 منازل عشرية")
        if not _close(total_sale, qty * price):
            bad("إجمالي البيع ≠ الكمية × السعر")
        discounts = item.get("commercialDiscountData") or []
        for d in discounts:
            if _dec(d["amount"]) < 0 or not d.get("description") or len(d["description"]) > MAX_DISCOUNT_DESCRIPTION:
                bad("بيانات خصم غير صالحة")
        if not _close(net_sale, total_sale - sum((_dec(d["amount"]) for d in discounts), Decimal(0))):
            bad("الصافي ≠ إجمالي البيع − الخصومات")
        taxes = item.get("taxableItems") or []
        types = [t.get("taxType") for t in taxes]
        if len(types) != len(set(types)):
            bad("نوع الضريبة مكرر في السطر")
        vat = next((t for t in taxes if t.get("taxType") == VAT_TAX_TYPE), None)
        if vat is None:
            bad("بلا ضريبة قيمة مضافة (فعّل الضريبة من الإعدادات)")
            continue
        if not is_valid(CodeTable.TAX_SUBTYPES, vat.get("subType")):
            bad("النوع الفرعي للضريبة غير موجود في الجدول")
        rate, amount = _dec(vat.get("rate", 0)), _dec(vat["amount"])
        if amount < 0 or _places(amount) > DECIMALS or _places(rate) > 2 or not 0 <= rate <= 999:
            bad("قيمة/نسبة الضريبة غير صالحة")
        if not _close(amount, net_sale * rate / 100):
            bad("قيمة الضريبة ≠ الصافي × النسبة")
        if not _close(total, net_sale + amount):
            bad("إجمالي السطر ≠ الصافي + الضريبة")

    # ---- الإجماليات ----
    def total_check(field: str, value: Decimal, label: str) -> None:
        if not _close(_dec(doc.get(field, 0)), value):
            err(f"{label} لا يطابق مجموع السطور")

    total_check("totalSales", sum((_dec(i["totalSale"]) for i in items), Decimal(0)), "إجمالي المبيعات")
    total_check(
        "totalCommercialDiscount",
        sum((_dec(d["amount"]) for i in items for d in i.get("commercialDiscountData") or []), Decimal(0)),
        "إجمالي الخصومات",
    )
    total_check("netAmount", sum((_dec(i["netSale"]) for i in items), Decimal(0)), "الصافي")
    total_check("totalAmount", sum((_dec(i["total"]) for i in items), Decimal(0)), "إجمالي الإيصال")
    vat_lines = sum(
        (_dec(t["amount"]) for i in items for t in i.get("taxableItems") or [] if t.get("taxType") == VAT_TAX_TYPE),
        Decimal(0),
    )
    vat_total = sum(
        (_dec(t["amount"]) for t in doc.get("taxTotals") or [] if t.get("taxType") == VAT_TAX_TYPE), Decimal(0)
    )
    if not _close(vat_total, vat_lines):
        err("إجمالي الضريبة لا يطابق مجموع ضرائب السطور")
    if not is_valid(CodeTable.PAYMENT_METHODS, doc.get("paymentMethod")):
        err("طريقة الدفع بلا كود في المنظومة")
    return errors
