"""متابعة الإيصالات (المرحلة 8): التصحيح بطريقة الـ SDK، تغيير البيئة، القائمة والتقرير وترجمة الأخطاء."""

import json
import unittest
from datetime import timedelta

from app.core import database
from app.core.errors import AppError
from app.modules.e_receipt.client import EtaClient
from tests.test_e_receipt_reliability import FakeEtaServer
from tests.test_e_receipt_returns import CONFIG, OWNER, FullEtaCase
from tests.test_e_receipt_sender import DEVICE, Clock


class FollowupTests(FullEtaCase):
    def _sender(self, server):  # noqa: ANN001, ANN202
        from app.modules.e_receipt.sender import Sender

        clock = Clock()
        return Sender(EtaClient(transport=server, clock=clock), sleep=clock.sleep, clock=clock), clock

    def _cycles(self, sender, clock, n=4):  # noqa: ANN001, ANN202
        for _ in range(n):
            clock.now += 120
            sender.run_cycle()

    def _reject(self, server, sale_id):  # noqa: ANN001, ANN202
        """بيع يُرسل وترفضه المنظومة."""
        from app.modules.sales.model import Sale

        sale = self._row(Sale, sale_id)
        server.invalid.add(sale.eta_uuid)
        sender, clock = self._sender(server)
        self._cycles(sender, clock)
        return self._row(Sale, sale_id), sender, clock

    # ---------- التصحيح وإعادة الإرسال ----------
    def test_corrected_resubmission_follows_sdk(self):
        from app.modules.e_receipt.model import EReceiptChain
        from app.modules.e_receipt.service import resubmit_rejected
        from app.modules.sales.model import Sale

        server = FakeEtaServer()
        sale, sender, clock = self._reject(server, self._sell(2).id)
        self.assertEqual(sale.eta_status, "rejected")
        chain_before = self._row(EReceiptChain, DEVICE)
        with database.get_write_sessionmaker()() as s:
            resubmit_rejected(s, OWNER, s.get(Sale, sale.id))
            s.commit()
        fixed = self._row(Sale, sale.id)
        doc = json.loads(fixed.eta_document)
        self.assertEqual(fixed.eta_status, "not_sent")
        self.assertNotEqual(fixed.eta_uuid, sale.eta_uuid)  # UUID جديد
        self.assertEqual(fixed.eta_replaced_uuid, sale.eta_uuid)
        self.assertEqual(doc["header"]["referenceOldUUID"], sale.eta_uuid)
        self.assertEqual(doc["header"]["previousUUID"], sale.eta_previous_uuid)  # نفس السابق
        self.assertEqual(doc["header"]["dateTimeIssued"], json.loads(sale.eta_document)["header"]["dateTimeIssued"])
        self.assertEqual(fixed.eta_seq, sale.eta_seq)  # نفس موضعه في السلسلة
        chain_after = self._row(EReceiptChain, DEVICE)
        self.assertEqual((chain_after.last_seq, chain_after.last_uuid), (chain_before.last_seq, chain_before.last_uuid))
        self._cycles(sender, clock)
        self.assertIn(fixed.eta_uuid, server.received)
        self.assertEqual(self._row(Sale, sale.id).eta_status, "accepted")

    def test_return_waiting_on_rejected_original_follows_its_correction(self):
        from app.modules.e_receipt.service import resubmit_rejected
        from app.modules.sales.model import Sale, SaleReturn

        server = FakeEtaServer()
        sale, sender, clock = self._reject(server, self._sell(2).id)
        ret = self._row(SaleReturn, self._return(sale, 1).id)
        self._cycles(sender, clock, 2)
        self.assertNotIn(ret.eta_uuid, server.received)  # ينتظر: الأصل مرفوض
        with database.get_write_sessionmaker()() as s:
            resubmit_rejected(s, OWNER, s.get(Sale, sale.id))
            s.commit()
        self._cycles(sender, clock)
        self.assertEqual(self._row(Sale, sale.id).eta_status, "accepted")
        self.assertIn(ret.eta_uuid, server.received)  # تبع حالة الأصل المصحَّح (عبر UUID القديم)

    def test_correction_after_96_hours_needs_explicit_confirmation(self):
        from app.modules.e_receipt.service import resubmit_rejected
        from app.modules.sales.model import Sale

        sale, _, _ = self._reject(FakeEtaServer(), self._sell(1).id)
        with database.get_write_sessionmaker()() as s:
            row = s.get(Sale, sale.id)
            row.created_at = row.created_at - timedelta(hours=97)
            s.commit()
        with database.get_write_sessionmaker()() as s:
            with self.assertRaises(AppError) as ctx:
                resubmit_rejected(s, OWNER, s.get(Sale, sale.id))
            self.assertEqual(ctx.exception.code, "e_receipt_late_amendment")
            self.assertIn("96", ctx.exception.message)
            resubmit_rejected(s, OWNER, s.get(Sale, sale.id), accept_late=True)
            s.commit()
        self.assertEqual(self._row(Sale, sale.id).eta_status, "not_sent")

    def test_only_rejected_can_be_corrected(self):
        from app.modules.e_receipt.service import resubmit_rejected
        from app.modules.sales.model import Sale

        sale_id = self._sell(1).id
        with database.get_write_sessionmaker()() as s, self.assertRaises(AppError) as ctx:
            resubmit_rejected(s, OWNER, s.get(Sale, sale_id))
        self.assertEqual(ctx.exception.code, "e_receipt_not_rejected")

    # ---------- تغيير البيئة ----------
    def test_switch_to_production_requires_confirmation_and_resets_chains(self):
        from app.modules.e_receipt import anchor
        from app.modules.e_receipt.model import EReceiptChain
        from app.modules.e_receipt.service import environment_switch_preview, switch_environment
        from app.modules.eta.schema import EtaConfig
        from app.modules.eta.service import EtaService
        from app.modules.sales.model import Sale

        unsent = self._row(Sale, self._sell(1).id)
        self.assertEqual(unsent.eta_environment, "preprod")
        with database.get_write_sessionmaker()() as s:
            with self.assertRaises(AppError):  # الحفظ العادي لا يغيّر البيئة
                EtaService(s, OWNER).set_config(EtaConfig(**{**CONFIG, "environment": "prod"}))
            s.rollback()
            with self.assertRaises(AppError) as ctx:  # بلا كتابة «فعلي»
                switch_environment(s, OWNER, "prod", "نعم")
            self.assertEqual(ctx.exception.code, "e_receipt_env_confirm")
            s.rollback()
            self.assertGreaterEqual(environment_switch_preview(s, OWNER)["unsent"], 1)
            result = switch_environment(s, OWNER, "prod", " فعلي ")
        self.assertGreaterEqual(result["closed"], 1)
        closed = self._row(Sale, unsent.id)
        self.assertEqual(closed.eta_status, "not_required")  # لا يُرسل للفعلية أبداً
        self.assertIn("لم يكتمل إرساله", closed.eta_error)
        chain = self._row(EReceiptChain, DEVICE)
        self.assertEqual(chain.last_uuid, "")
        self.assertIsNone(_gap(DEVICE))  # المرساة اتبعت السلسلة الجديدة (لا تنبيه استعادة كاذب)
        first_prod = self._row(Sale, self._sell(1).id)
        self.assertEqual((first_prod.eta_environment, first_prod.eta_previous_uuid), ("prod", ""))
        self.assertEqual(first_prod.eta_seq, chain.last_seq + 1)
        # مرتجع لفاتورة صدرت على التجريبية بعد التحويل للفعلية: «غير مطلوب» (لم تُبلَّغ للفعلية)
        from app.modules.sales.model import SaleReturn

        accepted_preprod = self._row(Sale, unsent.id)
        ret = self._row(SaleReturn, self._return(accepted_preprod, 1).id)
        self.assertEqual((ret.eta_status, ret.eta_uuid), ("not_required", None))
        # إعادة طباعة إيصال تجريبي بعد التحويل: الـ QR على بوابة التجريبية (بيئة إصداره) لا الفعلية
        from app.modules.sales.service import SaleService

        with database.get_sessionmaker()() as s:
            old_qr = SaleService(s, OWNER)._eta_print(s.get(Sale, unsent.id)).qr_url
            new_qr = SaleService(s, OWNER)._eta_print(s.get(Sale, first_prod.id)).qr_url
        self.assertTrue(old_qr.startswith("https://preprod.invoicing.eta.gov.eg/"), old_qr)
        self.assertTrue(new_qr.startswith("https://invoicing.eta.gov.eg/"), new_qr)
        # إرجاع للتجريبية لباقي الاختبارات
        with database.get_write_sessionmaker()() as s:
            switch_environment(s, OWNER, "preprod", "")
        self.assertIsNotNone(anchor.read_anchor().get(DEVICE))

    # ---------- القائمة والتقرير والطابور ----------
    def test_listing_filters_help_and_report(self):
        from datetime import date

        from app.modules.e_receipt.listing import ReceiptFilters, list_receipts, report
        from app.modules.e_receipt.sender import queue_counts

        server = FakeEtaServer()
        bad = self._sell(1, product_id=self.uncoded.id, price=1000)  # خطأ تحقق محلي
        rejected, sender, clock = self._reject(server, self._sell(3).id)
        with database.get_sessionmaker()() as s:
            attention = list_receipts(s, OWNER, ReceiptFilters(status="attention", page_size=200))
            by_id = {i["id"]: i for i in attention["items"]}
            self.assertEqual(by_id[bad.id]["resend"], "regenerate")
            self.assertEqual(by_id[bad.id]["help_title"], "كود الصنف في المنظومة (EGS/GS1) خاطئ أو غير مسجّل")
            self.assertEqual(by_id[rejected.id]["resend"], "correct")
            self.assertTrue(by_id[rejected.id]["help_action"])
            only_returns = list_receipts(s, OWNER, ReceiptFilters(kind="return", page_size=200))
            self.assertTrue(all(i["kind"] == "return" for i in only_returns["items"]))
            numbered = list_receipts(s, OWNER, ReceiptFilters(number=rejected.number))
            self.assertEqual([i["id"] for i in numbered["items"] if i["kind"] == "sale"], [rejected.id])
            by_device = list_receipts(s, OWNER, ReceiptFilters(device_id="no-such-device"))
            self.assertEqual(by_device["total"], 0)
            today = date.today()
            r = report(s, today - timedelta(days=1), today + timedelta(days=1))
            self.assertGreaterEqual(r["rejected"], 1)
            self.assertGreaterEqual(r["sent"], r["accepted"] + r["rejected"])  # المرفوض من المنظومة أُرسل فعلاً
            self.assertEqual(r["tax_reported"], r["tax_sales"] - r["tax_returns"])
            counts = queue_counts(s)
            self.assertGreaterEqual(counts["rejected"], 2)


def _gap(device_id):  # noqa: ANN001, ANN202
    from app.modules.e_receipt.service import chain_gap

    with database.get_sessionmaker()() as s:
        return chain_gap(s, device_id)


if __name__ == "__main__":
    unittest.main()
