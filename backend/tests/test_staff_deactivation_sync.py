"""موظف أوقفه المالك (من البرنامج الرئيسي أو من تطبيق الهاتف) لا يدخل جهاز الفرع بعد المزامنة،
وجلسته المفتوحة تُقفل فوراً عند تطبيق التغيير.

قاعدة SQLCipher مؤقتة خاصة بالاختبار (لا تلمس قاعدة البرنامج الحقيقية أبداً).
التشغيل من مجلد backend:  .venv/Scripts/python -m unittest tests.test_staff_deactivation_sync -v
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

from app.core import database  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.core.errors import UnauthorizedError  # noqa: E402
from app.core.passwords import hash_password  # noqa: E402
from app.core.security import Actor, Role  # noqa: E402

DEVICE = "dev-staff-test"
GID = "0190f0aa-0000-7000-8000-00000000c0de"
PASSWORD = "cash-pass-123"


class StaffDeactivationSyncTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="dealzora-staff-test-")
        settings = get_settings()
        cls._saved = (settings.db_path, settings.device_id)
        settings.db_path = str(Path(cls.tmp) / "test.db")
        settings.device_id = DEVICE
        assert cls.tmp in settings.db_path  # لا نلمس قاعدة البرنامج أبداً
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

    def _sync(self, session):  # noqa: ANN001, ANN202
        from app.modules.branch_sync.catalog_sync import CatalogSync

        return CatalogSync(session, Actor("system", Role.OWNER, DEVICE), mock.Mock(), "branch-1")

    def test_deactivated_staff_cannot_login_after_sync(self):
        from app.modules.auth.schema import LoginIn
        from app.modules.auth.service import AuthService
        from app.modules.users.model import User

        data = {"username": "c.cash", "password_hash": hash_password(PASSWORD), "role": "cashier",
                "is_active": True, "branches": ["branch-1"]}  # fmt: skip
        with database.get_write_sessionmaker()() as s:
            self._sync(s)._create_staff(GID, data)  # وصل الموظف مع المزامنة
            s.commit()
            out = AuthService(s).login(LoginIn(username="c.cash", password=PASSWORD), DEVICE)
            token = out.token
            AuthService(s).authenticate(token, DEVICE)  # جلسة مفتوحة على جهاز الفرع

        # المالك أوقفه (من الهاتف): نفس السجل يصل بـ is_active=False مع المزامنة التالية
        with database.get_write_sessionmaker()() as s:
            user = s.get(User, GID)
            self._sync(s)._update_staff(user, {**data, "is_active": False})
            s.commit()

        with database.get_write_sessionmaker()() as s:
            with self.assertRaises(UnauthorizedError):  # جلسته المفتوحة أُقفلت
                AuthService(s).authenticate(token, DEVICE)
            with self.assertRaises(UnauthorizedError):  # ولا يقدر يدخل من جديد
                AuthService(s).login(LoginIn(username="c.cash", password=PASSWORD), DEVICE)
            self.assertFalse(s.get(User, GID).is_active)


if __name__ == "__main__":
    unittest.main()
