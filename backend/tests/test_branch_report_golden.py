"""تقرير الفروع في البرنامج = نفس أرقام تطبيق الهاتف «سلسلة».

الملف المشترك sync-server/tests/fixtures/branch_report_golden.json يُختبر من الجهتين:
- هنا: branch_stats.combine (تقرير الفروع في البرنامج المكتبي) على المدخلات = الناتج المحفوظ.
- في sync-server: نقطة /mobile/v1/summary على نفس المدخلات = نفس الناتج.
لو فشل هذا الاختبار بعد تغيير متعمَّد في التقرير: أعد توليد الملف (التعليمات داخل المولّد)
وطبّق التغيير نفسه في sync-server/app/services/mobile_reports.py.

التشغيل من مجلد backend:  .venv/Scripts/python -m unittest tests.test_branch_report_golden -v
"""

import json
import unittest
from datetime import date
from pathlib import Path

from app.modules.branch_sync.branch_stats import combine

GOLDEN = Path(__file__).resolve().parents[2] / "sync-server" / "tests" / "fixtures" / "branch_report_golden.json"


@unittest.skipUnless(GOLDEN.exists(), "مجلد sync-server غير موجود بجانب backend")
class BranchReportGoldenTests(unittest.TestCase):
    def test_combine_matches_golden(self):
        g = json.loads(GOLDEN.read_text(encoding="utf-8"))
        d1, d2 = date.fromisoformat(g["date_from"]), date.fromisoformat(g["date_to"])
        inside = [{**s, "updated_at": "x"} for s in g["stats"] if g["date_from"] <= s["day"] <= g["date_to"]]
        out = combine(inside, g["branches"], d1, d2)
        exp = g["expected"]

        self.assertEqual(out["totals"], exp["totals"])
        drop = ("name", "code", "is_me", "is_active", "online", "last_update")
        self.assertEqual([{k: v for k, v in r.items() if k not in drop} for r in out["branches"]], exp["branches"])
        keys = ("day", "count", "net", "profit", "expenses", "branches")
        self.assertEqual([{k: d[k] for k in keys} for d in out["days"]], exp["days"])


if __name__ == "__main__":
    unittest.main()
