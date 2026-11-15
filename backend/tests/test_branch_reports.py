"""ملخصات المرحلة 7 على الفرع: الحساب من بيانات حقيقية (بيع، مرتجع، وردية، دفعات)، رفع المتغيّر فقط،
التوافق مع سيرفر أقدم، وعدم رفع بيانات العملاء.

قاعدة SQLCipher مؤقتة خاصة بالاختبار (لا تلمس قاعدة البرنامج الحقيقية أبداً).
التشغيل من مجلد backend:  .venv/Scripts/python -m unittest tests.test_branch_reports -v
"""

import json
import os
import shutil
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path

os.environ.setdefault("POS_DB_PASSWORD", "unit-test-password")
os.environ.setdefault("POS_SESSION_TOKEN", "t")
os.environ.setdefault("POS_WRITE_PERMIT_SECRET", "t")
os.environ.setdefault("POS_DEVICE_ID", "dev-test")

from app.core import database
from app.core.base import uuid7
from app.core.config import get_settings
from app.core.periods import local_today
from app.core.security import Actor, Role
from app.modules.branch_sync import branch_reports
from app.modules.branch_sync.client import RemoteError

DEVICE = "dev-reports-test"
CASHIER_ID = "0190f0aa-0000-7000-8000-0000000ca5e1"
CASHIER = Actor(user_id=CASHIER_ID, role=Role.MANAGER, device_id=DEVICE)
CONFIG = {"discount_min": 5_000, "return_min": 1_000, "cash_diff_min": 5_000, "expiry_days": 30, "wanted": []}


class FakeClient:
    def __init__(self, replies: dict) -> None:
        self.replies = replies
        self.calls: list[tuple] = []

    def call(self, method: str, path: str, body=None, **_):
        self.calls.append((method, path, body))
        reply = self.replies.get((method, path))
        if isinstance(reply, Exception):
            raise reply
        return reply


class BranchReportsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="dealzora-reports-test-")
        settings = get_settings()
        cls._saved = (settings.db_path, settings.device_id, settings.plan)
        settings.db_path = str(Path(cls.tmp) / "test.db")
        settings.device_id = DEVICE
        settings.plan = "enterprise"
        assert cls.tmp in settings.db_path  # لا نلمس قاعدة البرنامج أبداً
        for f in (database.get_engine, database.get_sessionmaker, database.get_write_sessionmaker):
            f.cache_clear()
        from app.core.init_db import init_db
        from app.core.passwords import hash_password
        from app.modules.products.schema import ProductCreate
        from app.modules.products.service import ProductService
        from app.modules.shifts.schema import ShiftOpenIn
        from app.modules.shifts.service import ShiftService
        from app.modules.users.model import User

        init_db()
        with database.get_write_sessionmaker()() as s:
            s.add(User(id=CASHIER_ID, username="c.cash", password_hash=hash_password("x-pass-123"), role="manager",
                       is_active=True, device_id=DEVICE))  # fmt: skip
            s.commit()
            products = ProductService(s, CASHIER)
            cls.milk = products.create_product(ProductCreate(name="لبن", barcode="6221001", sale_price=2_000,
                                                             opening_stock=3_000, min_stock=10_000))  # fmt: skip
            cls.oil = products.create_product(ProductCreate(
                name="زيت", barcode="6221002", sale_price=10_000, opening_stock=50_000, min_stock=5_000,
                track_expiry=True, opening_expiry=local_today() + timedelta(days=10), opening_batch_no="L7"))  # fmt: skip
            s.commit()
            ShiftService(s, CASHIER).open_shift(ShiftOpenIn(opening_float=0))

    @classmethod
    def tearDownClass(cls):
        for f in (database.get_engine, database.get_sessionmaker, database.get_write_sessionmaker):
            if f.cache_info().currsize:
                database.get_engine().dispose()
            f.cache_clear()
        settings = get_settings()
        settings.db_path, settings.device_id, settings.plan = cls._saved
        shutil.rmtree(cls.tmp, ignore_errors=True)

    # ---------- أدوات ----------
    def _sell(self, product, qty: int, *, invoice_discount: int = 0):
        from app.modules.sales.schema import SaleCreate, SaleLineIn
        from app.modules.sales.service import SaleService

        total = qty * product.sale_price - invoice_discount
        with database.get_write_sessionmaker()() as s:
            return SaleService(s, CASHIER).create_sale(SaleCreate(
                client_ref=uuid7(), payment_method="cash", cash_amount=total, received=total, invoice_discount=invoice_discount,
                lines=[SaleLineIn(product_id=product.id, qty=qty * 1000, unit_price=product.sale_price)],
            ))  # fmt: skip

    def _return(self, sale, qty: int):
        from app.modules.sales.schema import ReturnCreate, ReturnLineIn
        from app.modules.sales.service import SaleService

        with database.get_write_sessionmaker()() as s:
            return SaleService(s, CASHIER).create_return(
                sale.id, ReturnCreate(reason="other", lines=[ReturnLineIn(sale_line_id=sale.lines[0].id, qty=qty * 1000)])
            )

    def _collect(self, cfg: dict | None = None, config: dict | None = None):
        with database.get_sessionmaker()() as s:
            return branch_reports.collect(s, cfg or {}, config or CONFIG)

    # ---------- الاختبارات ----------
    def test_1_collect_from_real_activity(self):
        from app.modules.shifts.schema import ShiftCloseIn
        from app.modules.shifts.service import ShiftService

        discounted = self._sell(self.oil, 2, invoice_discount=6_000)  # خصم 60 ج.م ≥ الحد (50)
        self._sell(self.oil, 1)  # بلا خصم: ليست حساسة
        partial = self._sell(self.oil, 3)
        self._return(partial, 1)  # مرتجع 100 ج.م ≥ الحد (10)
        full = self._sell(self.milk, 1)
        self._return(full, 1)  # أكمل الفاتورة = «مرتجع فاتورة كاملة»
        with database.get_write_sessionmaker()() as s:
            ShiftService(s, CASHIER).close_current(ShiftCloseIn(counted_cash=1_000))  # عجز في الدرج

        payload, fresh = self._collect()
        short = payload["shortages"]
        self.assertEqual([i["name"] for i in short], ["لبن"])
        self.assertEqual((short[0]["key"], short[0]["min"]), ("b:6221001", 10_000))
        self.assertEqual([(i["name"], i["batch_no"]) for i in payload["expiring"]], [("زيت", "L7")])
        self.assertEqual(payload["wanted_stock"], [])

        recs = {r["key"]: r for r in payload["records"]}
        sens = sorted((r["data"]["type"], r["data"]["number"]) for r in recs.values() if r["kind"] == "sensitive")
        self.assertEqual(sens, sorted([("discount", discounted.number), ("return", 1), ("full_return", full.number)]))
        disc = next(r for r in recs.values() if r["kind"] == "sensitive" and r["data"]["type"] == "discount")
        self.assertEqual((disc["data"]["amount"], disc["data"]["cashier"]), (6_000, "c.cash"))
        shift = next(r for r in recs.values() if r["kind"] == "shift")
        self.assertEqual(shift["data"]["cashier"], "c.cash")
        self.assertEqual(shift["data"]["difference"], shift["data"]["counted"] - shift["data"]["expected"])
        self.assertLess(shift["data"]["difference"], 0)
        top = next(r for r in recs.values() if r["kind"] == "top")
        self.assertEqual(top["data"]["items"][0]["name"], "زيت")

        # لا بيانات عملاء أبداً، والحمولة تمر بنفس قيود السيرفر (أسماء الحقول)
        blob = json.dumps(payload, ensure_ascii=False)
        for word in ("customer", "phone", "address"):
            self.assertNotIn(word, blob)
        self.__class__.fresh = fresh

    def test_2_only_changes_are_sent(self):
        from app.modules.shifts.schema import ShiftOpenIn
        from app.modules.shifts.service import ShiftService

        payload, _ = self._collect({"reports_sent": self.fresh})
        self.assertEqual(payload, {})  # لا شيء تغيّر = لا رفع
        with database.get_write_sessionmaker()() as s:
            ShiftService(s, CASHIER).open_shift(ShiftOpenIn(opening_float=0))  # الاختبار السابق أغلق الوردية
        self._sell(self.milk, 1)  # المخزون نقص + الأكثر مبيعاً لليوم تغيّر
        payload, _ = self._collect({"reports_sent": self.fresh})
        self.assertEqual(set(payload), {"shortages", "records"})
        self.assertEqual({r["kind"] for r in payload["records"]}, {"top"})

    def test_3_wanted_stock_only_for_requested_items(self):
        payload, _ = self._collect(config={**CONFIG, "wanted": ["b:6221002", "g:unknown"]})
        self.assertEqual(len(payload["wanted_stock"]), 1)
        self.assertEqual(payload["wanted_stock"][0]["key"], "b:6221002")
        self.assertEqual(payload["wanted_stock"][0]["min"], 5_000)

    def _service(self, s):
        from app.modules.branch_sync.service import BranchSyncService
        from app.modules.settings.constants import SettingKey

        svc = BranchSyncService(s, Actor("system", Role.OWNER, DEVICE))
        svc.settings.set_local(svc.actor, SettingKey.BRANCH_SYNC, json.dumps({"branch_id": "b-1", "server_url": "x",
                                                                                "secret": "y"}))  # fmt: skip
        s.commit()
        return svc

    def test_4_old_server_is_skipped_without_breaking_sync(self):
        with database.get_write_sessionmaker()() as s:
            svc = self._service(s)
            old = FakeClient({("GET", "/reports/config"): RemoteError(404, "http_404", "Not Found")})
            self.assertIsNone(svc._push_reports(old))
            self.assertGreater(svc.config()["reports_retry_at"], 0)
            again = FakeClient({})
            self.assertIsNone(svc._push_reports(again))
            self.assertEqual(again.calls, [])  # لا محاولة قبل انتهاء المهلة

    def test_5_new_server_receives_and_second_sync_sends_nothing(self):
        with database.get_write_sessionmaker()() as s:
            svc = self._service(s)
            client = FakeClient({("GET", "/reports/config"): CONFIG, ("POST", "/reports/push"): {"records": 0}})
            out = svc._push_reports(client)
            self.assertGreater(out["sent"], 0)
            self.assertLess(out["ms"], 2_000)
            pushes = [c for c in client.calls if c[1] == "/reports/push"]
            self.assertIn("shortages", pushes[0][2])
            client.calls.clear()
            self.assertIsNone(svc._push_reports(client))  # كل 5 دقائق لا كل مزامنة
            self.assertEqual(client.calls, [])
            # بعد المهلة: لا رفع بلا تغيير (طلب الحدود فقط)
            from app.modules.settings.constants import SettingKey

            cfg = svc.config()
            cfg["reports_last_at"] = 0
            svc.settings.set_local(svc.actor, SettingKey.BRANCH_SYNC, json.dumps(cfg))
            s.commit()
            self.assertEqual(svc._push_reports(client)["sent"], 0)
            self.assertEqual([c[1] for c in client.calls], ["/reports/config"])


if __name__ == "__main__":
    unittest.main()
