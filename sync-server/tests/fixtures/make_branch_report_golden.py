"""يولّد branch_report_golden.json من دالة البرنامج المكتبي نفسها (backend branch_stats.combine).

الملف الناتج يحرس تطابق أرقام تطبيق الهاتف مع «تقرير الفروع» في البرنامج:
- sync-server/tests/test_mobile_reports.py: نقطة /mobile/v1/summary على نفس المدخلات = نفس الناتج.
- backend/tests/test_branch_report_golden.py: combine في البرنامج = نفس الناتج.

أعد التوليد فقط عن قصد (بعد تغيير منطق التقرير في البرنامج)، من مجلد backend:
    PYTHONPATH=. .venv/Scripts/python -X utf8 ../sync-server/tests/fixtures/make_branch_report_golden.py
ثم طبّق نفس التغيير على sync-server/app/services/mobile_reports.py:combine.
"""

import json
from datetime import date
from pathlib import Path

from app.modules.branch_sync.branch_stats import combine

A, B, C = "aaaaaaaa-0000-4000-8000-000000000001", "bbbbbbbb-0000-4000-8000-000000000002", "cccccccc-0000-4000-8000-000000000003"
D1, D2 = date(2026, 11, 9), date(2026, 11, 15)

BRANCHES = [
    {"id": A, "name": "المعادي", "code": "A"},
    {"id": B, "name": "مدينة نصر", "code": "B"},
    {"id": C, "name": "الدقي", "code": "C"},  # لم يرسل أي ملخص في الفترة
]


def day(count, revenue, returns, cost, r_cost, discounts=None, cash=0, credit=0, wallet=0, expenses=0, eta=None):
    """نفس حساب day_rows في البرنامج: net = revenue - returns، profit = net - (cost - r_cost)."""
    net, net_cost = revenue - returns, cost - r_cost
    data = {"count": count, "revenue": revenue, "returns": returns, "net": net, "cost": net_cost,
            "profit": net - net_cost, "cash": cash, "credit": credit, "wallet": wallet, "expenses": expenses}  # fmt: skip
    if discounts is not None:  # فرع بإصدار أقدم لا يرسل الخصومات ولا الإيصال الإلكتروني
        data["discounts"] = discounts
    if eta is not None:
        data.update(eta_waiting=eta[0], eta_accepted=eta[1], eta_rejected=eta[2])
    return data


STATS = [
    {"branch_id": A, "day": "2026-11-09", "data": day(41, 1_250_050, 0, 900_000, 0, 1_500, 800_050, 300_000, 150_000, 20_000, (0, 41, 0))},
    {"branch_id": A, "day": "2026-11-10", "data": day(38, 980_000, 45_000, 700_000, 30_000, 0, 600_000, 200_000, 135_000, 0, (2, 35, 1))},
    {"branch_id": A, "day": "2026-11-12", "data": day(55, 1_600_075, 12_500, 1_100_000, 8_000, 3_250, 1_000_000, 400_000, 187_575, 75_000, (0, 55, 0))},
    {"branch_id": A, "day": "2026-11-15", "data": day(12, 310_000, 0, 220_000, 0, 0, 310_000, 0, 0, 0, (12, 0, 0))},
    # مدينة نصر: إصدار أقدم (بلا خصومات ولا إيصال)، ويوم مرتجعه أكبر من مبيعاته، ومصروف بلا مبيعات
    {"branch_id": B, "day": "2026-11-09", "data": day(20, 450_000, 0, 300_000, 0)},
    {"branch_id": B, "day": "2026-11-11", "data": day(3, 20_000, 95_000, 14_000, 70_000, cash=20_000)},
    {"branch_id": B, "day": "2026-11-13", "data": day(0, 0, 0, 0, 0, expenses=150_000)},
    {"branch_id": B, "day": "2026-11-15", "data": day(30, 760_000, 10_000, 500_000, 6_000, cash=500_000, credit=260_000)},
    # خارج الفترة: لا يدخل في أي رقم
    {"branch_id": A, "day": "2026-11-08", "data": day(99, 9_999_999, 0, 1, 0, 0)},
]


def main() -> None:
    inside = [s for s in STATS if D1.isoformat() <= s["day"] <= D2.isoformat()]  # السيرفر يرجع الفترة فقط
    out = combine([{**s, "updated_at": "2026-11-15T10:00:00+00:00"} for s in inside], BRANCHES, D1, D2)
    expected = {
        "totals": out["totals"],
        "branches": [
            {k: v for k, v in r.items() if k not in ("name", "code", "is_me", "is_active", "online", "last_update")}
            for r in out["branches"]
        ],
        "days": [{k: d[k] for k in ("day", "count", "net", "profit", "expenses", "branches")} for d in out["days"]],
    }
    golden = {"date_from": D1.isoformat(), "date_to": D2.isoformat(), "branches": BRANCHES, "stats": STATS,
              "expected": expected}  # fmt: skip
    path = Path(__file__).with_name("branch_report_golden.json")
    path.write_text(json.dumps(golden, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"written {path}")


if __name__ == "__main__":
    main()
