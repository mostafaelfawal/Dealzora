"""ملخصات الفروع الجديدة (المرحلة 7): الرفع الصارم، النواقص واقتراح التحويل، الورديات والعمليات الحساسة،
الأكثر مبيعاً، حدود المالك، والتنبيهات."""

import re
from datetime import UTC, date, datetime

import pytest

from tests.conftest import admin
from tests.test_mobile import MGR_PW, OWNER_PW, bearer, chain, db, login, new_code  # noqa: F401 (fixture)
from tests.test_notifications import FakeExpo, rows, tick

TODAY = date.today().isoformat()


@pytest.fixture
def rep(client, chain):  # noqa: F811
    _, br = chain
    owner = bearer(login(client, new_code(br["A"]), "owner", OWNER_PW, device="owner-phone").json())
    mgr = bearer(login(client, new_code(br["B"]), "b.mgr", MGR_PW, device="mgr-phone").json())
    return br, owner, mgr


def push(branch, **body):
    r = branch.post("/v1/reports/push", json=body)
    assert r.status_code == 200, r.text
    return r.json()


MILK = {"key": "g:milk-gid-0001", "product_id": "p-milk-b", "barcode": "6221", "name": "لبن", "unit": "علبة",
        "qty": 2_000, "min": 10_000}  # fmt: skip


def shift(key: str, diff: int) -> dict:
    return {"key": f"shift:{key}", "kind": "shift", "day": TODAY, "at": datetime.now(UTC).isoformat(),
            "data": {"cashier": "c.cash", "opened_at": "2026-11-15T08:00:00+00:00",
                     "closed_at": "2026-11-15T16:00:00+00:00", "expected": 100_000, "counted": 100_000 + diff,
                     "difference": diff}}  # fmt: skip


def sensitive(key: str, type_: str = "discount", amount: int = 12_000) -> dict:
    return {"key": f"sens:{key}", "kind": "sensitive", "day": TODAY, "at": datetime.now(UTC).isoformat(),
            "data": {"type": type_, "number": 1042, "amount": amount, "total": 90_000, "cashier": "c.cash"}}  # fmt: skip


def top(day: str, *items: tuple) -> dict:
    return {"key": f"top:{day}", "kind": "top", "day": day,
            "data": {"items": [{"key": k, "name": n, "unit": "علبة", "qty": q, "revenue": r} for k, n, q, r in items]}}


# ================= النواقص والفائض =================
def test_shortages_with_surplus_suggestion(client, rep):
    br, owner, mgr = rep
    push(br["B"], shortages=[MILK])
    # الفروع الأخرى تعرف الأصناف المطلوبة فقط، وترفع مخزونها منها
    cfg = br["A"].get("/v1/reports/config").json()
    assert cfg["wanted"] == ["g:milk-gid-0001"] and cfg["discount_min"] == 5_000
    assert br["B"].get("/v1/reports/config").json()["wanted"] == []  # لا يُطلب منه مخزون نواقصه هو
    push(br["A"], wanted_stock=[{"key": "g:milk-gid-0001", "qty": 50_000, "min": 10_000}])
    push(br["C"], wanted_stock=[{"key": "g:milk-gid-0001", "qty": 12_000, "min": 10_000}])

    out = {b["branch_id"]: b for b in client.get("/mobile/v1/stock/shortages", headers=owner).json()}
    item = out[br["B"].id]["items"][0]
    assert item["need"] == 8_000 and out[br["B"].id]["updated_at"] is not None
    assert [(s["branch_id"], s["surplus"]) for s in item["suggestions"]] == [(br["A"].id, 40_000), (br["C"].id, 2_000)]
    # فرع لم يرسل شيئاً (إصدار أقدم): «لم يرسل بعد» لا قائمة فارغة كأن لا نواقص
    assert out[br["C"].id]["updated_at"] is None and out[br["C"].id]["items"] == []

    # المدير يرى فرعه فقط (والاقتراح من أي فرع في المحل)
    mine = client.get("/mobile/v1/stock/shortages", headers=mgr).json()
    assert [b["branch_id"] for b in mine] == [br["B"].id] and len(mine[0]["items"][0]["suggestions"]) == 2
    assert client.get("/mobile/v1/stock/shortages", headers=mgr, params={"branch_id": br["A"].id}).status_code == 404

    # لقطة غير مرسلة (None) لا تُمسح، وقائمة فارغة تمسح
    push(br["B"], expiring=[])
    assert client.get("/mobile/v1/stock/shortages", headers=owner, params={"branch_id": br["B"].id}).json()[0]["items"]
    push(br["B"], shortages=[])
    assert client.get("/mobile/v1/stock/shortages", headers=owner, params={"branch_id": br["B"].id}).json()[0]["items"] == []


def test_request_transfer_from_phone(client, rep):
    br, owner, mgr = rep
    push(br["B"], shortages=[MILK])
    body = {"to_branch_id": br["B"].id, "from_branch_id": br["A"].id, "lines": [{"key": MILK["key"], "qty": 8_000}]}
    r = client.post("/mobile/v1/stock/request-transfer", headers=mgr, json=body)
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["status"] == "requested" and t["from_branch_id"] == br["A"].id and t["to_branch_id"] == br["B"].id
    assert t["requested_by"] == "b.mgr (من الهاتف)"
    line = t["lines"][0]
    assert (line["product_id"], line["barcode"], line["qty_requested"]) == ("p-milk-b", "6221", 8_000)
    # فرع المعادي يصله الطلب كأي طلب من البرنامج، ويقدر يوافق عليه (من البرنامج أو الهاتف)
    ev = [e for e in br["A"].get("/v1/sync/pull").json()["events"] if e["entity"] == "stock_transfer"]
    assert [e["op"] for e in ev] == ["requested"]
    assert client.get(f"/mobile/v1/transfers/{t['id']}", headers=owner).json()["can_approve"] is True
    entry = next(a for a in admin(client, "GET", "/v1/admin/audit").json() if a["action"] == "transfer_requested")
    assert entry["actor"] == "mobile" and entry["details"]["from_phone"] and entry["details"]["username"] == "b.mgr"

    # المدير يطلب لفرعه فقط، وصنف غير موجود في النواقص مرفوض
    r = client.post("/mobile/v1/stock/request-transfer", headers=mgr, json={**body, "to_branch_id": br["A"].id, "from_branch_id": br["C"].id})
    assert r.status_code == 404
    r = client.post("/mobile/v1/stock/request-transfer", headers=mgr, json={**body, "lines": [{"key": "g:other", "qty": 1000}]})
    assert r.json()["error"]["code"] == "shortage_unknown"
    r = client.post("/mobile/v1/stock/request-transfer", headers=mgr, json={**body, "from_branch_id": br["B"].id})
    assert r.json()["error"]["code"] == "transfer_same_branch"


# ================= الرفع الصارم =================
def test_push_is_strict(client, rep):
    br, _, _ = rep
    # لا حقول زائدة (بيانات عملاء مثلاً)
    r = br["B"].post("/v1/reports/push", json={"shortages": [{**MILK, "customer_phone": "0100"}]})
    assert r.status_code == 422
    r = br["B"].post("/v1/reports/push", json={"records": [{**shift("s1", 0), "data": {"cashier": "x"}}]})
    assert r.status_code == 400 and r.json()["error"]["code"] == "report_invalid"
    bad = sensitive("s2")
    bad["data"]["customer"] = "أحمد"
    assert br["B"].post("/v1/reports/push", json={"records": [bad]}).status_code == 400
    r = br["B"].post("/v1/reports/push", json={"records": [{**shift("s3", 0), "key": "evil:1"}]})
    assert r.status_code == 422
    # بلا توكن فرع
    assert client.post("/v1/reports/push", json={}).status_code == 401


# ================= الورديات والعمليات الحساسة والأكثر مبيعاً =================
def test_records_shifts_sensitive_top(client, rep):
    br, owner, mgr = rep
    push(br["B"], records=[shift("s1", -7_500), sensitive("d1"), top(TODAY, ("g:milk", "لبن", 30_000, 45_000))])
    push(br["B"], records=[shift("s1", -8_000)])  # نفس المفتاح = تحديث لا تكرار
    push(br["A"], records=[top(TODAY, ("g:milk", "لبن", 10_000, 15_000), ("g:oil", "زيت", 5_000, 60_000))])
    params = {"date_from": TODAY, "date_to": TODAY}

    shifts = client.get("/mobile/v1/shifts", headers=owner, params=params).json()
    assert len(shifts) == 1 and shifts[0]["data"]["difference"] == -8_000 and shifts[0]["branch_name"] == "مدينة نصر"
    sens = client.get("/mobile/v1/sensitive", headers=owner, params=params).json()
    assert [s["data"]["type"] for s in sens] == ["discount"]

    tops = client.get("/mobile/v1/top-sellers", headers=owner, params=params).json()
    assert [(t["key"], t["qty"], t["revenue"], t["branches"]) for t in tops] == [
        ("g:milk", 40_000, 60_000, 2), ("g:oil", 5_000, 60_000, 1),
    ]  # fmt: skip
    # المدير: فرعه فقط
    assert len(client.get("/mobile/v1/top-sellers", headers=mgr, params=params).json()) == 1
    assert client.get("/mobile/v1/shifts", headers=mgr, params={**params, "branch_id": br["A"].id}).status_code == 404
    assert client.get("/mobile/v1/shifts", headers=owner, params={"date_from": TODAY, "date_to": "2000-01-01"}).status_code == 400


# ================= حدود المالك =================
def test_report_config_owner_only_and_reaches_branches(client, rep):
    br, owner, mgr = rep
    body = {"discount_min": 10_000, "return_min": 30_000, "cash_diff_min": 2_000, "expiry_days": 14}
    assert client.put("/mobile/v1/admin/report-config", headers=mgr, json=body).json()["error"]["code"] == "owner_only"
    assert client.get("/mobile/v1/admin/report-config", headers=mgr).status_code == 403
    assert client.put("/mobile/v1/admin/report-config", headers=owner, json=body).json() == body
    cfg = br["C"].get("/v1/reports/config").json()  # يصل للفروع مع مزامنتها
    assert {k: cfg[k] for k in body} == body
    entry = next(a for a in admin(client, "GET", "/v1/admin/audit").json() if a["action"] == "report_config_updated")
    assert entry["actor"] == "mobile" and entry["details"]["from_phone"]
    assert client.put("/mobile/v1/admin/report-config", headers=owner, json={**body, "expiry_days": 0}).status_code == 422


# ================= التنبيهات =================
def test_sensitive_and_cash_diff_notifications(client, rep):
    br, _, mgr = rep
    client.put("/mobile/v1/push-token", headers=mgr, json={"token": "ExponentPushToken[m-1]", "utc_offset_minutes": 120})
    push(br["B"], records=[sensitive("r1", "full_return", 90_000), shift("big", -7_500), shift("small", 1_000)])
    expo = FakeExpo()
    tick(expo)
    tick(expo)  # لا تكرار
    kinds = sorted(r.kind for r in rows("b.mgr"))
    assert kinds == ["cash_diff", "sensitive_op"]  # الفرق الصغير تحت حد المالك (50 ج.م)
    for r in rows("b.mgr"):
        assert not re.search(r"\d", r.body)  # لا مبالغ على شاشة القفل
    assert {r.route for r in rows("b.mgr")} == {"/sensitive", "/shifts"}
    # إيقاف النوع من الإعدادات
    prefs = client.get("/mobile/v1/notification-prefs", headers=mgr).json()
    prefs.pop("push_on_this_device")
    prefs["sensitive_op"]["enabled"] = False
    client.put("/mobile/v1/notification-prefs", headers=mgr, json=prefs)
    push(br["B"], records=[sensitive("r2", "return", 50_000)])
    tick(expo)
    assert sum(1 for r in rows("b.mgr") if r.kind == "sensitive_op") == 1


def test_migration_0010_reversible(client):
    from pathlib import Path

    from alembic.config import Config
    from sqlalchemy import inspect

    from alembic import command
    from app.db import get_engine

    root = Path(__file__).resolve().parents[1]
    cfg = Config(str(root / "alembic.ini"))
    cfg.set_main_option("script_location", str(root / "alembic"))
    command.downgrade(cfg, "0009")
    get_engine().dispose()
    assert "branch_records" not in inspect(get_engine()).get_table_names()
    command.upgrade(cfg, "head")
    get_engine().dispose()
    assert {"branch_records", "branch_reports", "shop_report_config"} <= set(inspect(get_engine()).get_table_names())
    with db() as s:  # الجداول جديدة وفارغة: لا مساس بالبيانات الموجودة
        from app.models import Shop

        assert s.query(Shop).count() == 0
