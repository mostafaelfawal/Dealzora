"""اختبارات الإيصال الإلكتروني (المرحلة 3): التسلسل الرسمي، الـ UUID، الـ mapper، والتحقق المحلي.

التشغيل من مجلد backend:  .venv/Scripts/python -m unittest discover -s tests -t . -v
العيّنات الرسمية ومصدرها في tests/fixtures/eta/SOURCE.md.
"""

import copy
import hashlib
import json
import os
import unittest
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

os.environ.setdefault("POS_DB_PASSWORD", "unit-test-password")
os.environ.setdefault("POS_SESSION_TOKEN", "t")
os.environ.setdefault("POS_WRITE_PERMIT_SECRET", "t")
os.environ.setdefault("POS_DEVICE_ID", "dev-test")

from app.modules.e_receipt.constants import PAYMENT_CODES  # noqa: E402
from app.modules.e_receipt.mapper import (  # noqa: E402
    BuyerSpec,
    LineSpec,
    ReceiptSpec,
    SellerSpec,
    build_document,
    discount_parts,
)
from app.modules.e_receipt.serializer import dumps, loads, seal, serialize_text, uuid_of  # noqa: E402
from app.modules.e_receipt.validator import validate  # noqa: E402
from app.modules.sales.helper import qty_amount  # noqa: E402
from app.modules.tax.calc import TaxLineIn, compute_invoice, return_split  # noqa: E402
from app.modules.tax.constants import TaxMode  # noqa: E402

FIX = Path(__file__).resolve().parent / "fixtures" / "eta"
PREV = "a" * 64


# ================= العيّنات الرسمية =================
class OfficialSerializationTests(unittest.TestCase):
    def test_official_one_doc_serialization_matches_byte_for_byte(self):
        """المثال الرسمي الوحيد للتسلسل: one-doc.json ← one-doc-serialized.json.txt حرفياً."""
        source = (FIX / "one-doc.json").read_text(encoding="utf-8-sig")
        expected = (FIX / "one-doc-serialized.json.txt").read_text(encoding="utf-8-sig")
        self.assertEqual(serialize_text(source), expected)

    def test_values_are_taken_as_written(self):
        """«0.0 must stay 0.0, not 0 or 0.00» (document-serialization-approach، القاعدة 3)."""
        self.assertEqual(serialize_text('{"a": 0.0, "b": 94.50, "c": [1, 2]}'), '"A""0.0""B""94.50""C""C""1""C""2"')

    @unittest.expectedFailure
    def test_official_batch_receipt_uuid(self):
        """الـ SDK لا يوفر مثال إيصال بـ UUID قابل لإعادة الإنتاج: uuid عيّنة BatchReceipt.json لا يطابق
        أي تفسير للخطوات الرسمية (والعيّنة تخالف القواعد نفسها). expectedFailure يوثّق ذلك، ويتحول
        «unexpected success» لو صحّحت المصلحة العيّنة أو تبيّن تفسير مختلف."""
        text = (FIX / "BatchReceipt.json").read_text(encoding="utf-8-sig")
        document = loads(text)["receipts"][0]
        expected = document["header"]["uuid"]
        self.assertEqual(uuid_of(dumps(document)), expected)  # الفشل = عدم تطابق (لا استثناء)


# ================= الـ UUID =================
class UuidTests(unittest.TestCase):
    def _doc(self, previous=PREV):
        return {"header": {"dateTimeIssued": "2026-11-15T10:00:00Z", "uuid": "x", "previousUUID": previous},
                "totalAmount": Decimal("10.50")}  # fmt: skip

    def test_uuid_is_sha256_hex_of_serialized_document_with_empty_uuid(self):
        doc = self._doc()
        uuid, text = seal(doc)
        expected_text = '"HEADER""DATETIMEISSUED""2026-11-15T10:00:00Z""UUID""""PREVIOUSUUID""' + PREV + '""TOTALAMOUNT""10.5"'
        self.assertEqual(uuid, hashlib.sha256(expected_text.encode()).hexdigest())
        self.assertRegex(uuid, r"^[0-9a-f]{64}$")
        self.assertEqual(json.loads(text)["header"]["uuid"], uuid)
        self.assertEqual(uuid_of(text), uuid)  # النص المخزّن يعيد نفس الـ UUID (يُرسل بنفس البايتات)

    def test_uuid_ignores_its_own_value_but_depends_on_previous(self):
        a, _ = seal(self._doc())
        doc = self._doc()
        doc["header"]["uuid"] = "anything"
        self.assertEqual(seal(doc)[0], a)
        self.assertNotEqual(seal(self._doc(previous="b" * 64))[0], a)


# ================= الـ mapper =================
SELLER = SellerSpec(
    rin="123456789", trade_name="شركة الاختبار", branch_code="0",
    branch_address={"country": "EG", "governate": "القاهرة", "regionCity": "مدينة نصر",
                    "street": "شارع عباس", "buildingNumber": "12", "postalCode": None},
    device_serial="SN-1", activity_code="4711",
)  # fmt: skip


def _sale_lines(rows, *, invoice=0, loyalty=0, mode=TaxMode.INCLUSIVE):
    """نفس حساب البيع الفعلي (sales.service + tax.calc) ← LineSpec بالطريقة نفسها التي يبنيها التوليد."""
    grosses = [qty_amount(r["qty"], r["price"]) for r in rows]
    amounts = [g - r.get("promo", 0) - r.get("discount", 0) for g, r in zip(grosses, rows, strict=True)]
    inv = compute_invoice(
        [TaxLineIn(a, r.get("type", "taxable"), r.get("rate", 1400)) for a, r in zip(amounts, rows, strict=True)],
        invoice + loyalty, mode,
    )  # fmt: skip
    specs = []
    for r, amount, tl in zip(rows, amounts, inv.lines, strict=True):
        specs.append(
            LineSpec(
                internal_code=r.get("code", "6221000000017"), description=r.get("name", "صنف"),
                item_type="EGS", item_code="EG-123456789-1", unit_type=r.get("unit", "EA"),
                qty=r["qty"], unit_price=r["price"], tax_mode=mode.value, tax_type=tl.tax_type, tax_rate=tl.rate,
                taxable=tl.taxable, tax=tl.tax, total=tl.total,
                discounts=discount_parts(promo_name=r.get("promo_name"), promo=r.get("promo", 0),
                                         line_discount=r.get("discount", 0), line_total=amount, net=tl.net,
                                         invoice_discount=invoice, loyalty_discount=loyalty),
            )
        )  # fmt: skip
    return specs, inv


def _doc(lines, *, payment="cash", buyer=BuyerSpec(), kind="SR", reference=None):
    return build_document(
        ReceiptSpec(
            receipt_type=kind, issued_at=datetime(2026, 11, 15, 8, 30, tzinfo=timezone.utc), receipt_number="1001",
            previous_uuid=PREV, reference_uuid=reference, seller=SELLER, buyer=buyer,
            payment_code=PAYMENT_CODES.get(payment, "O"), lines=lines,
        )
    )  # fmt: skip


class MapperTests(unittest.TestCase):
    def assertValid(self, doc):  # noqa: N802
        self.assertEqual(validate(doc, now=datetime(2026, 11, 16, tzinfo=timezone.utc)), [])

    def test_plain_inclusive_sale(self):
        lines, inv = _sale_lines([{"qty": 2000, "price": 11400}])
        doc = _doc(lines)
        item = doc["itemData"][0]
        self.assertEqual((item["unitPrice"], item["totalSale"], item["netSale"]), (Decimal("100"), Decimal("200"), Decimal("200")))
        self.assertEqual(item["taxableItems"][0], {"taxType": "T1", "amount": Decimal("28"), "subType": "V009", "rate": Decimal("14")})
        self.assertEqual(doc["totalAmount"], Decimal(inv.total) / 100)
        self.assertNotIn("commercialDiscountData", item)
        self.assertValid(doc)

    def test_line_and_invoice_discount(self):
        lines, inv = _sale_lines([{"qty": 3000, "price": 11400, "discount": 1140}, {"qty": 1000, "price": 5700}], invoice=2000)
        doc = _doc(lines)
        self.assertEqual(doc["totalAmount"], Decimal(inv.total) / 100)
        self.assertEqual(sum(t["amount"] for t in doc["taxTotals"]), Decimal(inv.tax) / 100)
        descs = [d["description"] for d in doc["itemData"][0]["commercialDiscountData"]]
        self.assertEqual(descs, ["خصم على الصنف", "خصم على الفاتورة"])
        self.assertValid(doc)

    def test_promotion_with_name(self):
        lines, _ = _sale_lines([{"qty": 12000, "price": 500, "promo": 600, "promo_name": "خصم 10% مشروبات"}])
        doc = _doc(lines)
        disc = doc["itemData"][0]["commercialDiscountData"]
        self.assertEqual(disc[0]["description"], "خصم 10% مشروبات")
        self.assertValid(doc)

    def test_credit_customer_buyer(self):
        lines, _ = _sale_lines([{"qty": 1000, "price": 25000}], loyalty=500)
        doc = _doc(lines, payment="credit", buyer=BuyerSpec(name="محمد علي", mobile="01012345678"))
        self.assertEqual(doc["buyer"], {"type": "P", "name": "محمد علي", "mobileNumber": "01012345678"})
        self.assertEqual(doc["paymentMethod"], "O")
        self.assertIn("خصم نقاط الولاء", [d["description"] for d in doc["itemData"][0]["commercialDiscountData"]])
        self.assertValid(doc)

    def test_mixed_payment_is_cash_code(self):
        lines, _ = _sale_lines([{"qty": 1000, "price": 9999}])
        self.assertEqual(_doc(lines, payment="mixed")["paymentMethod"], "C")

    def test_exclusive_exempt_zero_and_decimal_qty(self):
        lines, inv = _sale_lines(
            [{"qty": 1250, "price": 4599, "unit": "KGM"}, {"qty": 2000, "price": 1000, "type": "exempt", "rate": 0},
             {"qty": 1000, "price": 3000, "type": "zero", "rate": 0}],
            invoice=777, mode=TaxMode.EXCLUSIVE,
        )  # fmt: skip
        doc = _doc(lines)
        self.assertEqual([i["taxableItems"][0]["subType"] for i in doc["itemData"]], ["V009", "V003", "V010"])
        self.assertEqual(doc["totalAmount"], Decimal(inv.total) / 100)
        self.assertValid(doc)

    def test_partial_return_receipt(self):
        lines, inv = _sale_lines([{"qty": 3000, "price": 11400, "discount": 300}], invoice=500)
        sale_line, tl = lines[0], inv.lines[0]
        split = return_split(qty=1000, line_qty=3000, line_total=tl.total, line_tax=tl.tax,
                             returned_qty=0, returned_amount=0, returned_tax=0)  # fmt: skip
        ret_line = LineSpec(
            **{**{f: getattr(sale_line, f) for f in LineSpec.__slots__},  # type: ignore[attr-defined]
               "qty": 1000, "taxable": split.amount - split.tax, "tax": split.tax, "total": split.amount,
               "discounts": [(d, a / 3) for d, a in sale_line.discounts]},
        )  # fmt: skip
        doc = _doc([ret_line], kind="r", reference="c" * 64)
        self.assertEqual(doc["documentType"]["receiptType"], "r")
        self.assertEqual(doc["header"]["referenceUUID"], "c" * 64)
        self.assertEqual(list(doc["header"])[:5], ["dateTimeIssued", "receiptNumber", "uuid", "previousUUID", "referenceUUID"])
        self.assertEqual(doc["totalAmount"], Decimal(split.amount) / 100)
        self.assertValid(doc)

    def test_random_sales_always_valid(self):
        import random

        rnd = random.Random(2026)
        for _ in range(300):
            rows = [{"qty": rnd.choice([1000, 2000, 1500, 250, 12000]), "price": rnd.randint(50, 500_000),
                     "type": rnd.choice(["taxable", "taxable", "exempt", "zero"]), "rate": rnd.choice([1400, 500, 1000])}
                    for _ in range(rnd.randint(1, 8))]  # fmt: skip
            for r in rows:
                gross = qty_amount(r["qty"], r["price"])
                r["promo"] = rnd.randint(0, gross // 4)
                r["discount"] = rnd.randint(0, (gross - r["promo"]) // 4)
                if r["type"] != "taxable":
                    r["rate"] = 0
            base = sum(qty_amount(r["qty"], r["price"]) - r["promo"] - r["discount"] for r in rows)
            for mode in (TaxMode.INCLUSIVE, TaxMode.EXCLUSIVE):
                lines, inv = _sale_lines(rows, invoice=rnd.randint(0, base // 5), loyalty=rnd.randint(0, base // 10), mode=mode)
                doc = _doc(lines)
                if doc["totalAmount"] >= 150000:
                    continue  # يحتاج الرقم القومي (مُختبر في التحقق)
                self.assertValid(doc)
                self.assertEqual(doc["totalAmount"], Decimal(inv.total) / 100)


class ValidatorTests(unittest.TestCase):
    def test_reports_clear_arabic_errors(self):
        lines, _ = _sale_lines([{"qty": 1000, "price": 20_000_000}])  # 200 ألف جنيه
        bad = copy.deepcopy(SELLER.__class__(**{**{f: getattr(SELLER, f) for f in SellerSpec.__slots__}, "rin": "12"}))  # type: ignore[attr-defined]
        doc = build_document(ReceiptSpec("SR", datetime(2026, 11, 15, tzinfo=timezone.utc), "1", PREV, None, bad,
                                         BuyerSpec(name="عميل"), "C", lines))  # fmt: skip
        doc["itemData"][0]["unitType"] = "kg"
        errors = validate(doc, now=datetime(2026, 11, 16, tzinfo=timezone.utc))
        self.assertTrue(any("RIN" in e for e in errors))
        self.assertTrue(any("150,000" in e for e in errors))
        self.assertTrue(any("وحدة القياس" in e for e in errors))

    def test_totals_mismatch_detected(self):
        lines, _ = _sale_lines([{"qty": 1000, "price": 11400}])
        doc = _doc(lines)
        doc["totalAmount"] = doc["totalAmount"] + 1
        self.assertIn("إجمالي الإيصال لا يطابق مجموع السطور", validate(doc, now=datetime(2026, 11, 16, tzinfo=timezone.utc)))

    def test_missing_vat_when_tax_disabled(self):
        lines, _ = _sale_lines([{"qty": 1000, "price": 11400}], mode=TaxMode.OFF)
        errors = validate(_doc(lines), now=datetime(2026, 11, 16, tzinfo=timezone.utc))
        self.assertTrue(any("بلا ضريبة" in e for e in errors))


if __name__ == "__main__":
    unittest.main()
