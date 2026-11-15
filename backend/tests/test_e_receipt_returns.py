"""المرتجعات والاستبدال في منظومة الإيصال الإلكتروني (المرحلة 7)، عبر مسار البيع والمرتجع الحقيقي.

القرارات الموثّقة (وكل منها له اختبار هنا):
  - إيصال المرتجع (receiptType «r») يشير لـ UUID الفاتورة الأصلية، وضريبته من سطرها المخزّن وقت البيع
    (لا النسبة الحالية للصنف). المرتجع الجزئي المتكرر: كل مرة إيصال مستقل، ومجموعها = الفاتورة بالقرش.
  - الاستبدال = إيصال مرتجع ثم إيصال بيع جديد بالترتيب في سلسلة الجهاز (معاملة واحدة).
  - فاتورة قبل تفعيل المنظومة (بلا UUID): المرتجع «غير مطلوب» (لم تُبلَّغ أصلاً، فلا يُبلَّغ مرتجعها).
  - فاتورة «خطأ تحقق» (بلا UUID): المرتجع «خطأ تحقق» برسالة، ويُعاد توليده بعد تصحيح الأصل.
  - فاتورة معلّقة: إيصال المرتجع يتولد فوراً، والإرسال ينتظر قبول الأصل (ومعه سلسلة الجهاز).
  - فاتورة مرفوضة: يتولد، والسلسلة موقوفة بتنبيه حتى قرار المدير (المرحلة 5).
  - فاتورة من جهاز آخر في نفس الفرع: الإيصال في سلسلة الجهاز الذي نفّذ المرتجع وبياناته، ويشير للأصل.
  - فاتورة من فرع آخر: غير ممكن في النظام أصلاً (كل فرع قاعدته، والمرتجع لفاتورة محلية فقط).
  - أكثر من 540 يوماً على الأصل (حد الـ SDK): المرتجع يتم في المحل، وإيصاله «خطأ تحقق».
  - مرتجع المشتريات للموردين خارج المنظومة: لا يلمس السلسلة ولا يولّد شيئاً.
"""

import json
import unittest
from datetime import date, timedelta
from decimal import Decimal

from app.core import database
from app.core.base import uuid7
from app.core.security import Actor, Role
from app.modules.e_receipt.client import EtaClient
from tests.test_e_receipt_reliability import FakeEtaServer
from tests.test_e_receipt_sender import DEVICE, PSK, SECRET, Clock, EtaDbCase

DEVICE2 = "dev-2"
OWNER = Actor(user_id="owner-test", role=Role.OWNER, device_id=DEVICE)
OTHER = Actor(user_id="owner-test", role=Role.OWNER, device_id=DEVICE2)
CONFIG = {"enabled": True, "environment": "preprod", "rin": "123456789", "company_trade_name": "شركة الاختبار",
          "activity_code": "4711"}  # fmt: skip


class ReturnsTests(EtaDbCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        from app.core.secret_box import seal_secret
        from app.modules.catalog.model import MeasureUnit
        from app.modules.devices.model import DeviceEtaProfile
        from app.modules.products.schema import ProductCreate
        from app.modules.products.service import ProductService
        from app.modules.settings.constants import SettingKey
        from app.modules.settings.service import SettingsService
        from app.modules.shifts.schema import ShiftOpenIn
        from app.modules.shifts.service import ShiftService
        from app.modules.tax.config import TaxConfig

        with database.get_write_sessionmaker()() as s:
            settings = SettingsService(s)
            settings.put(OWNER, SettingKey.ETA_CONFIG, json.dumps(CONFIG))
            settings.put(OWNER, SettingKey.ETA_BRANCH, json.dumps({
                "branch_code": "0", "country": "EG", "governate": "القاهرة", "region_city": "مدينة نصر",
                "street": "شارع عباس", "building_number": "12"}))  # fmt: skip
            s.commit()
            settings.set_tax(OWNER, TaxConfig(enabled=True))
            s.add(DeviceEtaProfile(
                pos_device_id=DEVICE2, device_id=DEVICE, pos_serial="SN-2", pos_os_version="Windows 11",
                pos_model_framework="1", client_id="client-2",
                client_secret_enc=seal_secret(SECRET, f"device_eta_profiles:{DEVICE2}:client_secret"),
                preshared_key_enc=seal_secret(PSK, f"device_eta_profiles:{DEVICE2}:preshared_key"),
            ))  # fmt: skip
            s.commit()
            products = ProductService(s, OWNER)
            cls.product = products.create_product(ProductCreate(
                name="بيبسي 1 لتر", sale_price=2500, opening_stock=1_000_000, eta_item_type="EGS",
                eta_item_code="EG-123456789-1"))  # fmt: skip
            cls.uncoded = products.create_product(ProductCreate(name="صنف بلا كود", sale_price=1000, opening_stock=100_000))
            for unit in s.query(MeasureUnit).all():
                unit.eta_unit_type = "EA"
            s.commit()
            ShiftService(s, OWNER).open_shift(ShiftOpenIn())
            ShiftService(s, OTHER).open_shift(ShiftOpenIn())

    # ---------- أدوات ----------
    def _sell(self, qty: int = 1, *, actor: Actor = OWNER, product_id: str | None = None, price: int = 2500):
        from app.modules.sales.schema import SaleCreate, SaleLineIn
        from app.modules.sales.service import SaleService

        total = qty * price
        with database.get_write_sessionmaker()() as s:
            return SaleService(s, actor).create_sale(SaleCreate(
                client_ref=uuid7(), payment_method="cash", cash_amount=total, received=total,
                lines=[SaleLineIn(product_id=product_id or self.product.id, qty=qty * 1000, unit_price=price,
                                  discount=0, promo_discount=0)],
            ))  # fmt: skip

    def _return(self, sale, qty: int, *, actor: Actor = OWNER):
        from app.modules.sales.schema import ReturnCreate, ReturnLineIn
        from app.modules.sales.service import SaleService

        with database.get_write_sessionmaker()() as s:
            return SaleService(s, actor).create_return(
                sale.id, ReturnCreate(reason="other", lines=[ReturnLineIn(sale_line_id=sale.lines[0].id, qty=qty * 1000)])
            )

    @staticmethod
    def _row(model, row_id):
        with database.get_sessionmaker()() as s:
            return s.get(model, row_id)

    @staticmethod
    def _doc(row) -> dict:
        return json.loads(row.eta_document, parse_float=Decimal, parse_int=Decimal)

    def _set_config(self, **patch) -> None:
        from app.modules.settings.constants import SettingKey
        from app.modules.settings.service import SettingsService

        with database.get_write_sessionmaker()() as s:
            SettingsService(s).put(OWNER, SettingKey.ETA_CONFIG, json.dumps({**CONFIG, **patch}))
            s.commit()

    # ---------- 1) مرتجع يشير للأصل وبضريبته الأصلية ----------
    def test_return_references_original_with_original_tax_rate(self):
        from app.modules.products.model import Product
        from app.modules.sales.model import Sale, SaleReturn

        sale = self._row(Sale, self._sell(3).id)
        with database.get_write_sessionmaker()() as s:  # الصنف تغيّرت نسبته بعد البيع
            s.get(Product, self.product.id).tax_rate = 500
            s.commit()
        try:
            ret = self._row(SaleReturn, self._return(sale, 1).id)
        finally:
            with database.get_write_sessionmaker()() as s:
                s.get(Product, self.product.id).tax_rate = 1400
                s.commit()
        doc = self._doc(ret)
        self.assertEqual(ret.eta_status, "not_sent")
        self.assertEqual(doc["documentType"]["receiptType"], "r")
        self.assertEqual(doc["header"]["referenceUUID"], sale.eta_uuid)
        self.assertEqual(ret.eta_reference_uuid, sale.eta_uuid)
        vat = doc["itemData"][0]["taxableItems"][0]
        self.assertEqual((vat["taxType"], vat["rate"]), ("T1", Decimal(14)))  # الأصلية لا 5%
        self.assertEqual(Decimal(ret.tax_total) / 100, vat["amount"])

    # ---------- 2) مرتجع جزئي متعدد المرات ----------
    def test_multiple_partial_returns_of_same_invoice(self):
        from app.modules.sales.model import Sale, SaleReturn

        sale = self._row(Sale, self._sell(5).id)
        rets = [self._row(SaleReturn, self._return(sale, q).id) for q in (1, 2, 2)]
        self.assertTrue(all(r.eta_status == "not_sent" and r.eta_reference_uuid == sale.eta_uuid for r in rets))
        self.assertEqual(sum(r.total for r in rets), sale.total)  # كاملة بالقرش
        self.assertEqual(sum(r.tax_total for r in rets), sale.tax_total)
        docs = [self._doc(r) for r in rets]
        self.assertEqual(sum(d["totalAmount"] for d in docs), Decimal(sale.total) / 100)
        self.assertEqual([d["itemData"][0]["quantity"] for d in docs], [1, 2, 2])
        self.assertEqual(len({r.eta_uuid for r in rets}), 3)
        # كلها في سلسلة الجهاز بالترتيب بعد الفاتورة
        self.assertEqual([r.eta_seq for r in rets], [sale.eta_seq + 1, sale.eta_seq + 2, sale.eta_seq + 3])
        self.assertEqual(rets[0].eta_previous_uuid, sale.eta_uuid)
        self.assertEqual(rets[2].eta_previous_uuid, rets[1].eta_uuid)
        self.assertEqual(len({r.eta_receipt_number for r in rets}), 3)

    # ---------- 3) الاستبدال ----------
    def test_exchange_is_return_then_new_sale_in_chain(self):
        from app.modules.sales.model import Sale, SaleReturn
        from app.modules.sales.schema import ExchangeCreate, ReturnCreate, ReturnLineIn, SaleCreate, SaleLineIn
        from app.modules.sales.service import SaleService

        original = self._row(Sale, self._sell(2).id)
        with database.get_write_sessionmaker()() as s:
            out = SaleService(s, OWNER).exchange(ExchangeCreate(
                sale_id=original.id,
                return_data=ReturnCreate(reason="wrong_item", lines=[ReturnLineIn(sale_line_id=original.lines[0].id, qty=1000)]),
                sale=SaleCreate(client_ref=uuid7(), payment_method="cash", cash_amount=5000, received=5000,
                                lines=[SaleLineIn(product_id=self.product.id, qty=2000, unit_price=2500,
                                                  discount=0, promo_discount=0)]),
            ))  # fmt: skip
        ret, new = self._row(SaleReturn, out.sale_return.id), self._row(Sale, out.sale.id)
        self.assertEqual((ret.eta_status, new.eta_status), ("not_sent", "not_sent"))
        self.assertEqual(ret.eta_reference_uuid, original.eta_uuid)
        self.assertEqual(new.eta_seq, ret.eta_seq + 1)  # المرتجع أولاً ثم البيع
        self.assertEqual(new.eta_previous_uuid, ret.eta_uuid)
        # الإرسال: الأصل أولاً، ثم (بعد قبوله) المرتجع ثم البيع الجديد بنفس الترتيب
        from app.modules.e_receipt.sender import Sender

        server, clock = FakeEtaServer(), Clock()
        sender = Sender(EtaClient(transport=server, clock=clock), sleep=clock.sleep, clock=clock)
        for _ in range(4):
            clock.now += 120
            sender.run_cycle()
        order = [u for u in server.received if u in (original.eta_uuid, ret.eta_uuid, new.eta_uuid)]
        self.assertEqual(order, [original.eta_uuid, ret.eta_uuid, new.eta_uuid])

    # ---------- 4) حالات خاصة ----------
    def test_return_of_sale_before_activation_is_not_required(self):
        from app.modules.e_receipt.model import EReceiptChain
        from app.modules.sales.model import Sale, SaleReturn

        self._set_config(enabled=False)
        try:
            old = self._row(Sale, self._sell(2).id)
        finally:
            self._set_config()
        self.assertIsNone(old.eta_status)
        chain_before = self._row(EReceiptChain, DEVICE).last_seq
        ret = self._row(SaleReturn, self._return(old, 1).id)
        self.assertEqual((ret.eta_status, ret.eta_uuid), ("not_required", None))
        self.assertEqual(self._row(EReceiptChain, DEVICE).last_seq, chain_before)

    def test_return_of_invalid_original_is_invalid_with_reason(self):
        from app.modules.sales.model import Sale, SaleReturn

        sale = self._row(Sale, self._sell(1, product_id=self.uncoded.id, price=1000).id)
        self.assertEqual(sale.eta_status, "invalid")  # الصنف بلا كود منظومة
        ret = self._row(SaleReturn, self._return(sale, 1).id)
        self.assertEqual(ret.eta_status, "invalid")
        self.assertIn("الأصلية", ret.eta_error)
        self.assertIsNone(ret.eta_uuid)

    def test_return_of_pending_or_rejected_original_waits(self):
        from app.modules.e_receipt.sender import Sender
        from app.modules.sales.model import Sale, SaleReturn

        server, clock = FakeEtaServer(), Clock()
        sender = Sender(EtaClient(transport=server, clock=clock), sleep=clock.sleep, clock=clock)
        sender.run_cycle()  # تفريغ ما قبله
        for _ in range(3):
            clock.now += 120
            sender.run_cycle()
        sale = self._row(Sale, self._sell(2).id)
        server.invalid.add(sale.eta_uuid)
        ret = self._row(SaleReturn, self._return(sale, 1).id)
        self.assertEqual(ret.eta_status, "not_sent")  # يتولد فوراً حتى والأصل لم يُرسل بعد
        for _ in range(4):
            clock.now += 120
            sender.run_cycle()
        self.assertEqual(self._row(Sale, sale.id).eta_status, "rejected")
        self.assertNotIn(ret.eta_uuid, server.received)  # لا يُرسل والأصل مرفوض
        self.assertEqual(sender.devices[DEVICE].held_return_id, ret.id)
        # تنظيف: قرار المدير حتى لا تبقى السلسلة موقوفة للاختبارات التالية
        from app.modules.e_receipt.sender import release_return

        with database.get_write_sessionmaker()() as s:
            release_return(s, OWNER, s.get(SaleReturn, ret.id))

    def test_return_on_another_device_uses_its_own_chain(self):
        from app.modules.sales.model import Sale, SaleReturn

        sale = self._row(Sale, self._sell(2).id)  # على الجهاز الأساسي
        ret = self._row(SaleReturn, self._return(sale, 1, actor=OTHER).id)  # على جهاز كاشير آخر
        doc = self._doc(ret)
        self.assertEqual(ret.eta_device_id, DEVICE2)
        self.assertEqual(doc["seller"]["deviceSerialNumber"], "SN-2")
        self.assertEqual(doc["header"]["referenceUUID"], sale.eta_uuid)
        self.assertEqual(sale.eta_device_id, DEVICE)

    def test_return_after_540_days_is_invalid(self):
        from app.modules.sales.model import Sale, SaleReturn

        sale_id = self._sell(1).id
        with database.get_write_sessionmaker()() as s:
            row = s.get(Sale, sale_id)
            row.created_at = row.created_at - timedelta(days=541)
            s.commit()
        sale = self._row(Sale, sale_id)
        ret = self._row(SaleReturn, self._return(sale, 1).id)
        self.assertEqual(ret.eta_status, "invalid")
        self.assertIn("540", ret.eta_error)
        self.assertEqual(ret.total, sale.total)  # المرتجع نفسه تم في المحل

    def test_purchase_return_is_outside_e_receipt(self):
        from sqlalchemy import func, select

        from app.modules.e_receipt.model import EReceiptChain
        from app.modules.purchases.schema import PurchaseCreate, PurchaseLineIn, PurchaseReturnCreate, PurchaseReturnLineIn
        from app.modules.purchases.service import PurchaseService
        from app.modules.sales.model import Sale, SaleReturn
        from app.modules.suppliers.schema import SupplierCreate
        from app.modules.suppliers.service import SupplierService

        with database.get_sessionmaker()() as s:
            before = (s.scalar(select(func.max(EReceiptChain.last_seq))),
                      s.scalar(select(func.count()).select_from(Sale)), s.scalar(select(func.count()).select_from(SaleReturn)))  # fmt: skip
        with database.get_write_sessionmaker()() as s:
            supplier = SupplierService(s, OWNER).create_supplier(SupplierCreate(name="مورد الاختبار"))
            purchase = PurchaseService(s, OWNER).create_purchase(PurchaseCreate(
                supplier_id=supplier.id, purchased_on=date.today(),
                lines=[PurchaseLineIn(product_id=self.product.id, qty=10_000, unit_cost=2000)]))  # fmt: skip
            PurchaseService(s, OWNER).create_return(purchase.id, PurchaseReturnCreate(
                refund_method="balance", lines=[PurchaseReturnLineIn(purchase_line_id=purchase.lines[0].id, qty=2000)]))  # fmt: skip
        with database.get_sessionmaker()() as s:
            after = (s.scalar(select(func.max(EReceiptChain.last_seq))),
                     s.scalar(select(func.count()).select_from(Sale)), s.scalar(select(func.count()).select_from(SaleReturn)))  # fmt: skip
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()
