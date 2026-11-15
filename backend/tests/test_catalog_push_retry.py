"""سجل رفضه سيرفر الفروع لا يبقى معلّقاً للأبد: يُعاد رفعه بعد PUSH_RETRY_AFTER حتى بلا تعديل.

السبب: سيرفر قديم كان يرفض حقول الضريبة وكود المنظومة، فكل الأصناف فشل رفعها، والفشل بنفس البيانات كان
يُتجاهل حتى يُعدَّل الصنف يدوياً. بعد تحديث السيرفر تُرفع وحدها.

قاعدة SQLCipher مؤقتة خاصة بالاختبار. التشغيل من مجلد backend:
    .venv/Scripts/python -m unittest tests.test_catalog_push_retry -v
"""

import os
import shutil
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path
from unittest import mock

os.environ.setdefault("POS_DB_PASSWORD", "unit-test-password")
os.environ.setdefault("POS_SESSION_TOKEN", "t")
os.environ.setdefault("POS_WRITE_PERMIT_SECRET", "t")
os.environ.setdefault("POS_DEVICE_ID", "dev-test")

from app.core import database
from app.core.base import utcnow, uuid7
from app.core.config import get_settings
from app.core.security import Actor, Role

DEVICE = "dev-retry-test"
ACTOR = Actor("system", Role.OWNER, DEVICE)


class CatalogPushRetryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="dealzora-retry-test-")
        settings = get_settings()
        cls._saved = (settings.db_path, settings.device_id)
        settings.db_path = str(Path(cls.tmp) / "test.db")
        settings.device_id = DEVICE
        assert cls.tmp in settings.db_path
        for f in (database.get_engine, database.get_sessionmaker, database.get_write_sessionmaker):
            f.cache_clear()
        from app.core.init_db import init_db

        init_db()

    @classmethod
    def tearDownClass(cls):
        for f in (database.get_engine, database.get_sessionmaker, database.get_write_sessionmaker):
            if f.cache_info().currsize:
                database.get_engine().dispose()
            f.cache_clear()
        settings = get_settings()
        settings.db_path, settings.device_id = cls._saved
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def test_rejected_push_is_retried_after_an_hour(self):
        from app.modules.branch_sync.catalog_sync import PRODUCT, CatalogSync
        from app.modules.branch_sync.model import CatalogLink

        old_id, new_id = uuid7(), uuid7()
        with database.get_write_sessionmaker()() as s:
            for lid in (old_id, new_id):
                s.add(CatalogLink(id=uuid7(), kind=PRODUCT, local_id=lid, error="Extra inputs are not permitted",
                                  error_hash="abc"))  # fmt: skip
            s.commit()
            # أحدهما فشل منذ ساعتين، والآخر الآن
            s.query(CatalogLink).filter(CatalogLink.local_id == old_id).update(
                {"updated_at": utcnow() - timedelta(hours=2)}, synchronize_session=False
            )
            s.commit()
            CatalogSync(s, ACTOR, mock.Mock(), "branch-1")._retry_failed()

        with database.get_sessionmaker()() as s:
            links = {link.local_id: link for link in s.query(CatalogLink).all()}
            self.assertIsNone(links[old_id].error_hash)  # يُعاد رفعه في نفس الدورة
            self.assertEqual(links[new_id].error_hash, "abc")  # فشل حديث: ننتظر (لا نكرر الرفض كل دقيقة)
            self.assertEqual(links[old_id].error, "Extra inputs are not permitted")  # الرسالة تبقى حتى ينجح


    def test_manual_sync_retries_everything_now(self):
        """زر «مزامنة الآن» (وأول مزامنة بعد تشغيل البرنامج): كل المرفوض يُعاد رفعه فوراً، حتى الحديث."""
        from app.modules.branch_sync.catalog_sync import PRODUCT, CatalogSync
        from app.modules.branch_sync.model import CatalogLink

        lid = uuid7()
        with database.get_write_sessionmaker()() as s:
            s.add(CatalogLink(id=uuid7(), kind=PRODUCT, local_id=lid, error="رفض", error_hash="xyz"))
            s.commit()
            CatalogSync(s, ACTOR, mock.Mock(), "branch-1")._retry_failed(force=True)
        with database.get_sessionmaker()() as s:
            self.assertIsNone(s.query(CatalogLink).filter(CatalogLink.local_id == lid).one().error_hash)


if __name__ == "__main__":
    unittest.main()
