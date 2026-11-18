"""مخزون المتجر الإلكتروني من فرع التجهيز: يُرفع رصيد الأصناف المعروضة فقط، وما تغيّر فقط،
ويتوقف بهدوء مع سيرفر أقدم بلا المتجر.

قاعدة SQLCipher مؤقتة خاصة بالاختبار (لا تلمس قاعدة البرنامج الحقيقية أبداً).
التشغيل من مجلد backend:  .venv/Scripts/python -m unittest tests.test_store_stock -v
"""

import os
import shutil
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("POS_DB_PASSWORD", "unit-test-password")
os.environ.setdefault("POS_SESSION_TOKEN", "t")
os.environ.setdefault("POS_WRITE_PERMIT_SECRET", "t")
os.environ.setdefault("POS_DEVICE_ID", "dev-test")

from app.core import database
from app.core.base import uuid7
from app.core.config import get_settings
from app.core.security import Actor, Role
from app.modules.branch_sync import store_stock
from app.modules.branch_sync.client import RemoteError

DEVICE = "dev-store-stock-test"
OWNER = Actor(user_id="owner-store", role=Role.OWNER, device_id=DEVICE)


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


class StoreStockTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="dealzora-store-test-")
        settings = get_settings()
        cls._saved = (settings.db_path, settings.device_id, settings.plan)
        settings.db_path = str(Path(cls.tmp) / "test.db")
        settings.device_id = DEVICE
        settings.plan = "enterprise"
        assert cls.tmp in settings.db_path
        for f in (database.get_engine, database.get_sessionmaker, database.get_write_sessionmaker):
            f.cache_clear()
        from app.core.init_db import init_db
        from app.modules.branch_sync.model import CatalogLink
        from app.modules.products.model import Product

        init_db()
        cls.gids = {"milk": str(uuid7()), "rice": str(uuid7()), "unknown": str(uuid7())}
        with database.get_write_sessionmaker()() as s:
            for key, qty in (("milk", 12_000), ("rice", 0)):
                p = Product(id=str(uuid7()), name=key, unit="قطعة", sale_price=1000, stock_qty=qty, device_id=DEVICE)
                s.add(p)
                s.flush()
                s.add(CatalogLink(id=str(uuid7()), kind="product", local_id=p.id, gid=cls.gids[key], version=1))
            s.commit()

    @classmethod
    def tearDownClass(cls):
        database.get_engine().dispose()
        settings = get_settings()
        settings.db_path, settings.device_id, settings.plan = cls._saved
        for f in (database.get_engine, database.get_sessionmaker, database.get_write_sessionmaker):
            f.cache_clear()
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def session(self):
        return database.get_write_sessionmaker()()

    def test_pushes_only_requested_products_and_only_changes(self):
        g = self.gids
        client = FakeClient({("GET", "/store/stock-request"): {"gids": [g["milk"], g["rice"], g["unknown"]]},
                             ("POST", "/store/stock"): {"updated": 2}})  # fmt: skip
        with self.session() as s:
            cfg = store_stock.push(s, {}, client)
        posted = [c for c in client.calls if c[0] == "POST"]
        self.assertEqual(len(posted), 1)
        sent = {x["gid"]: x["qty"] for x in posted[0][2]["items"]}
        self.assertEqual(sent, {g["milk"]: 12_000, g["rice"]: 0})  # الصنف غير المربوط لا يُرسل
        self.assertTrue(cfg["store_digest"])

        # لا تغيير ← لا رفع (بعد مهلة الدورة)
        client.calls.clear()
        cfg["store_last_at"] = 0
        with self.session() as s:
            cfg2 = store_stock.push(s, cfg, client)
        self.assertFalse([c for c in client.calls if c[0] == "POST"])
        self.assertEqual(cfg2["store_digest"], cfg["store_digest"])

    def test_not_fulfillment_branch_sends_nothing(self):
        client = FakeClient({("GET", "/store/stock-request"): {"gids": []}})
        with self.session() as s:
            cfg = store_stock.push(s, {}, client)
        self.assertEqual([c[0] for c in client.calls], ["GET"])
        self.assertIsNone(cfg["store_digest"])

    def test_old_server_backs_off(self):
        client = FakeClient({("GET", "/store/stock-request"): RemoteError(404, "http_404", "Not Found")})
        with self.session() as s:
            cfg = store_stock.push(s, {}, client)
        self.assertGreater(cfg["store_retry_at"], 0)
        client.calls.clear()
        with self.session() as s:
            self.assertIsNone(store_stock.push(s, cfg, client))
        self.assertEqual(client.calls, [])


if __name__ == "__main__":
    unittest.main()
