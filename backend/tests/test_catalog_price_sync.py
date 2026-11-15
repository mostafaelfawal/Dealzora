"""سعر عدّله المالك من الهاتف يصل للفرع مع المزامنة: البيع الجديد بالسعر الجديد، والفواتير السابقة كما هي.

قاعدة SQLCipher مؤقتة خاصة بالاختبار (لا تلمس قاعدة البرنامج الحقيقية أبداً).
التشغيل من مجلد backend:  .venv/Scripts/python -m unittest tests.test_catalog_price_sync -v
"""

import os
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest import mock

os.environ.setdefault("POS_DB_PASSWORD", "unit-test-password")
os.environ.setdefault("POS_SESSION_TOKEN", "t")
os.environ.setdefault("POS_WRITE_PERMIT_SECRET", "t")
os.environ.setdefault("POS_DEVICE_ID", "dev-test")

from app.core import database
from app.core.base import uuid7
from app.core.config import get_settings
from app.core.errors import ConflictError
from app.core.security import Actor, Role

DEVICE = "dev-price-test"
GID = "0190f0aa-0000-7000-8000-00000000017e"
OWNER = Actor(user_id="owner-price", role=Role.OWNER, device_id=DEVICE)
DATA = {"name": "زيت عباد الشمس", "barcode": "6221004001", "unit": "زجاجة", "allow_decimal": False, "sale_price": 9_000,
        "wholesale_price": None, "wholesale_min_qty": None, "track_expiry": False, "is_active": True, "units": []}  # fmt: skip


class CatalogPriceSyncTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="dealzora-price-test-")
        settings = get_settings()
        cls._saved = (settings.db_path, settings.device_id, settings.plan)
        settings.db_path = str(Path(cls.tmp) / "test.db")
        settings.device_id = DEVICE
        settings.plan = "enterprise"
        assert cls.tmp in settings.db_path  # لا نلمس قاعدة البرنامج أبداً
        for f in (database.get_engine, database.get_sessionmaker, database.get_write_sessionmaker):
            f.cache_clear()
        from app.core.init_db import init_db
        from app.modules.shifts.schema import ShiftOpenIn
        from app.modules.shifts.service import ShiftService

        init_db()
        with database.get_write_sessionmaker()() as s:
            ShiftService(s, OWNER).open_shift(ShiftOpenIn(opening_float=0))

    @classmethod
    def tearDownClass(cls):
        for f in (database.get_engine, database.get_sessionmaker, database.get_write_sessionmaker):
            if f.cache_info().currsize:
                database.get_engine().dispose()
            f.cache_clear()
        settings = get_settings()
        settings.db_path, settings.device_id, settings.plan = cls._saved
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def _apply(self, version: int, data: dict) -> None:
        """نفس ما تفعله المزامنة عند سحب سجل من الكتالوج المشترك."""
        from sqlalchemy import select

        from app.modules.branch_sync.catalog_sync import PRODUCT, CatalogSync
        from app.modules.branch_sync.model import CatalogLink

        with database.get_write_sessionmaker()() as s:
            link = s.scalar(select(CatalogLink).where(CatalogLink.kind == PRODUCT, CatalogLink.gid == GID))
            CatalogSync(s, OWNER, mock.Mock(), "branch-1")._apply(PRODUCT, GID, version, data, False, link)
            s.commit()

    def _sell(self, price: int):
        from app.modules.branch_sync.catalog_sync import local_product_id
        from app.modules.sales.schema import SaleCreate, SaleLineIn
        from app.modules.sales.service import SaleService

        with database.get_write_sessionmaker()() as s:
            pid = local_product_id(s, GID)
            return SaleService(s, OWNER).create_sale(SaleCreate(
                client_ref=uuid7(), payment_method="cash", cash_amount=price, received=price,
                lines=[SaleLineIn(product_id=pid, qty=1000, unit_price=price)],
            ))  # fmt: skip

    def test_new_price_applies_and_old_invoices_unchanged(self):
        from app.modules.sales.model import SaleLine

        self._apply(1, DATA)  # الصنف وصل من الكتالوج
        self._stock()
        old = self._sell(9_000)

        self._apply(2, {**DATA, "sale_price": 9_500})  # المالك عدّل السعر من الهاتف
        with self.assertRaises(ConflictError):  # السعر القديم لم يعد مقبولاً عند البيع
            self._sell(9_000)
        new = self._sell(9_500)

        with database.get_sessionmaker()() as s:
            old_line = s.query(SaleLine).filter(SaleLine.sale_id == old.id).one()
            new_line = s.query(SaleLine).filter(SaleLine.sale_id == new.id).one()
            self.assertEqual(old_line.unit_price, 9_000)  # الفاتورة السابقة كما هي
            self.assertEqual(new_line.unit_price, 9_500)

    def _stock(self) -> None:
        from app.modules.branch_sync.catalog_sync import local_product_id
        from app.modules.products.model import Product

        with database.get_write_sessionmaker()() as s:
            s.get(Product, local_product_id(s, GID)).stock_qty = 100_000
            s.commit()


if __name__ == "__main__":
    unittest.main()
