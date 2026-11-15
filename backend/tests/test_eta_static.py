"""اختبارات وحدة: تشفير الأسرار (core/secret_box.py) وجداول أكواد المنظومة (eta/codes).

التشغيل من مجلد backend:  .venv/Scripts/python -m unittest discover -s tests -t . -v
"""

import hashlib
import os
import re
import unittest
from pathlib import Path

# قيم بيئة وهمية للاختبار فقط (الإعدادات تُقرأ من POS_*).
os.environ.setdefault("POS_DB_PASSWORD", "unit-test-password")
os.environ.setdefault("POS_SESSION_TOKEN", "t")
os.environ.setdefault("POS_WRITE_PERMIT_SECRET", "t")
os.environ.setdefault("POS_DEVICE_ID", "dev-test")

from app.core import secret_box  # noqa: E402
from app.modules.eta.codes import CodeTable, codes, is_valid, suggest_unit_code, table  # noqa: E402
from app.modules.eta.constants import UNIT_SUGGESTIONS  # noqa: E402

CODES_DIR = Path(__file__).resolve().parents[1] / "app" / "modules" / "eta" / "codes"


class SecretBoxTests(unittest.TestCase):
    def setUp(self):
        secret_box._key.cache_clear()

    def tearDown(self):
        secret_box._key.cache_clear()

    def test_roundtrip_and_not_plaintext(self):
        sealed = secret_box.seal_secret("client-secret-value", "ctx:a")
        self.assertTrue(sealed.startswith("v1:"))
        self.assertNotIn("client-secret-value", sealed)
        self.assertEqual(secret_box.open_secret(sealed, "ctx:a"), "client-secret-value")

    def test_random_nonce(self):
        self.assertNotEqual(secret_box.seal_secret("x", "c"), secret_box.seal_secret("x", "c"))

    def test_bound_to_context(self):
        sealed = secret_box.seal_secret("x", "device:1:client_secret")
        self.assertIsNone(secret_box.open_secret(sealed, "device:2:client_secret"))

    def test_other_key_or_garbage_returns_none(self):
        sealed = secret_box.seal_secret("x", "c")
        settings = secret_box.get_settings()
        original = settings.db_password
        try:
            settings.db_password = "different-password"
            secret_box._key.cache_clear()
            self.assertIsNone(secret_box.open_secret(sealed, "c"))
        finally:
            settings.db_password = original
        for bad in (None, "", "v1:", "v2:abcd", "v1:not-base64!!", "plain-text"):
            self.assertIsNone(secret_box.open_secret(bad, "c"))


class CodeTablesTests(unittest.TestCase):
    def test_files_match_recorded_sha256(self):
        """الملفات كما نزلت من الـ SDK: بصمتها = المسجلة في SOURCE.md."""
        source = (CODES_DIR / "SOURCE.md").read_text(encoding="utf-8")
        recorded = dict(re.findall(r"\| (\w+\.json) \|.*\| ([0-9a-f]{64}) \|", source))
        files = sorted(p.name for p in CODES_DIR.glob("*.json"))
        self.assertEqual(sorted(recorded), files)
        for name, digest in recorded.items():
            self.assertEqual(hashlib.sha256((CODES_DIR / name).read_bytes()).hexdigest(), digest, name)

    def test_every_table_loads(self):
        for name in CodeTable:
            self.assertTrue(table(name), name)
            self.assertTrue(all(e.code for e in table(name)))

    def test_duplicate_code_in_source_is_kept_once(self):
        units = [e.code for e in table(CodeTable.UNITS)]
        self.assertEqual(len(units), len(set(units)))
        self.assertIn("ST", units)

    def test_known_codes(self):
        self.assertTrue(is_valid(CodeTable.UNITS, "KGM"))
        self.assertFalse(is_valid(CodeTable.UNITS, "kg"))  # مثال الصفحة ليس في الجدول
        self.assertTrue(is_valid(CodeTable.TAX_TYPES, "T1"))
        self.assertTrue(is_valid(CodeTable.ACTIVITIES, "0111"))
        self.assertEqual({e.ref for e in table(CodeTable.TAX_SUBTYPES) if e.code.startswith("V")}, {"T1"})
        self.assertEqual(codes(CodeTable.BUYER_TYPES), frozenset({"B", "P", "F"}))

    def test_unit_suggestions_exist_in_table(self):
        for name, code in UNIT_SUGGESTIONS.items():
            self.assertTrue(is_valid(CodeTable.UNITS, code), f"{name} → {code}")
        self.assertEqual(suggest_unit_code("كرتونة"), "CT")
        self.assertIsNone(suggest_unit_code("وحدة غريبة"))


if __name__ == "__main__":
    unittest.main()
