"""تقارير تطبيق الهاتف (المرحلة 3): مطابقة تقرير الفروع في البرنامج، الصلاحيات، الأيام الناقصة، المقارنة،
وحالة الفروع."""

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from tests.conftest import admin
from tests.test_mobile import MGR_PW, OWNER_PW, bearer, chain, db, login, new_code  # noqa: F401 (fixture)

GOLDEN = json.loads((Path(__file__).parent / "fixtures" / "branch_report_golden.json").read_text(encoding="utf-8"))
FIELDS = ("count", "revenue", "returns", "net", "cost", "profit", "discounts", "cash", "credit", "wallet",
          "expenses", "eta_waiting", "eta_accepted", "eta_rejected", "net_profit")  # fmt: skip


@pytest.fixture
def loaded(client, chain):  # noqa: F811
    """المحل (A, B, C) وكل فرع رفع ملخصات الملف المشترك بنفسه (/v1/stats/batch مثل البرنامج)."""
    _, br = chain
    ids = {g["id"]: br[g["code"]] for g in GOLDEN["branches"]}
    for gid, branch in ids.items():
        days = [{"day": s["day"], "data": s["data"]} for s in GOLDEN["stats"] if s["branch_id"] == gid]
        if days:
            r = branch.post("/v1/stats/batch", json={"days": days})
            assert r.status_code == 200, r.text
    real = {gid: b.id for gid, b in ids.items()}
    return br, real


def owner_headers(client, br) -> dict:
    return bearer(login(client, new_code(br["A"]), "owner", OWNER_PW).json())


def summary(client, headers, d1: str, d2: str, **params):
    return client.get("/mobile/v1/summary", headers=headers, params={"date_from": d1, "date_to": d2, **params})


def test_matches_desktop_branches_report(client, loaded):
    """نفس أرقام «تقرير الفروع» في البرنامج لنفس الفترة (الناتج المحفوظ من دالة البرنامج نفسها)."""
    br, real = loaded
    r = summary(client, owner_headers(client, br), GOLDEN["date_from"], GOLDEN["date_to"])
    assert r.status_code == 200, r.text
    out, exp = r.json(), GOLDEN["expected"]
    back = {v: k for k, v in real.items()}

    assert {f: out["totals"][f] for f in FIELDS} == exp["totals"]
    assert [{"id": back[b["id"]], **{f: b[f] for f in FIELDS}} for b in out["branches"]] == exp["branches"]
    got_days = [
        {"day": d["day"], "count": d["count"], "net": d["net"], "profit": d["profit"], "expenses": d["expenses"],
         "branches": {back[k]: v for k, v in d["branches"].items()}}
        for d in out["days"]
    ]  # fmt: skip
    assert got_days == exp["days"]
    # الترتيب: الأعلى صافياً أولاً، والفرع بلا بيانات في الآخر بأصفار (ومعلَّم أنه لم يرسل)
    assert out["branches"][-1]["id"] == real[GOLDEN["branches"][2]["id"]]
    assert out["branches"][-1]["reported_days"] == 0 and out["branches"][-1]["last_update"] is None


def test_manager_sees_only_assigned_branch(client, loaded):
    br, _ = loaded
    h = bearer(login(client, new_code(br["B"]), "b.mgr", MGR_PW).json())
    out = summary(client, h, GOLDEN["date_from"], GOLDEN["date_to"]).json()
    assert [b["id"] for b in out["branches"]] == [br["B"].id] and out["branches_total"] == 1
    b_exp = next(b for b in GOLDEN["expected"]["branches"] if b["id"] == GOLDEN["branches"][1]["id"])
    assert {f: out["totals"][f] for f in FIELDS} == {f: b_exp[f] for f in FIELDS}  # إجماليه = فرعه فقط
    assert all(set(d["branches"]) <= {br["B"].id} for d in out["days"])

    for other in (br["A"].id, br["C"].id):
        r = summary(client, h, "2026-11-15", "2026-11-15", branch_id=other)
        assert r.status_code == 404 and r.json()["error"]["code"] == "branch_not_found"
    assert [b["id"] for b in client.get("/mobile/v1/branches", headers=h).json()] == [br["B"].id]
    # فرعه نفسه مسموح
    assert summary(client, h, "2026-11-15", "2026-11-15", branch_id=br["B"].id).status_code == 200


def test_missing_day_is_not_zero_and_compare(client, loaded):
    from app.models import Branch

    br, _ = loaded
    with db() as s:  # الفروع موجودة من قبل الفترة (لا نتوقع أياماً قبل إنشائها)
        for b in s.query(Branch).all():
            b.created_at = datetime(2026, 1, 1, tzinfo=UTC)
        s.commit()
    h = owner_headers(client, br)
    out = summary(client, h, "2026-11-15", "2026-11-15").json()
    rows = {b["id"]: b for b in out["branches"]}
    assert rows[br["A"].id]["reported_days"] == 1 and rows[br["A"].id]["last_update"] is not None
    assert rows[br["C"].id]["reported_days"] == 0 and rows[br["C"].id]["expected_days"] == 1  # لم يرسل اليوم
    assert out["days"][0]["reported_branches"] == 2

    # مقارنة: أمس (لا بيانات) ونفس اليوم الأسبوع الماضي (صف 11-08 خارج الفترة الأصلية)
    assert out["compare"]["previous"]["date_from"] == "2026-11-14"
    assert out["compare"]["previous"]["totals"]["net"] == 0 and out["compare"]["previous"]["branches_reported"] == 0
    assert out["compare"]["week_ago"]["date_from"] == "2026-11-08"
    assert out["compare"]["week_ago"]["totals"]["revenue"] == 9_999_999

    # فترة أسبوع: المقارنة بالأسبوع السابق، ولا «نفس اليوم الأسبوع الماضي»
    week = summary(client, h, "2026-11-09", "2026-11-15").json()
    assert week["compare"]["previous"]["date_from"] == "2026-11-02" and week["compare"]["previous"]["date_to"] == "2026-11-08"
    assert week["compare"]["week_ago"] is None
    c = next(b for b in week["branches"] if b["id"] == br["C"].id)
    assert c["expected_days"] == 7 and c["reported_days"] == 0


def test_expected_days_start_at_branch_creation(client, loaded):
    from app.models import Branch

    br, _ = loaded
    with db() as s:
        s.get(Branch, br["C"].id).created_at = datetime(2026, 11, 13, 9, tzinfo=UTC)
        s.commit()
    out = summary(client, owner_headers(client, br), "2026-11-09", "2026-11-15").json()
    assert next(b for b in out["branches"] if b["id"] == br["C"].id)["expected_days"] == 3


def test_bad_range(client, loaded):
    br, _ = loaded
    h = owner_headers(client, br)
    assert summary(client, h, "2026-11-15", "2026-11-14").json()["error"]["code"] == "bad_range"
    assert summary(client, h, "2025-01-01", "2026-11-15").json()["error"]["code"] == "bad_range"
    assert summary(client, h, "2025-11-16", "2026-11-15").status_code == 200  # سنة كاملة مسموحة


def test_branch_status_and_sync_lag(client, loaded):
    from app.models import Branch, Shop

    br, _ = loaded
    h = owner_headers(client, br)
    now = datetime.now(UTC)
    with db() as s:
        s.get(Branch, br["A"].id).last_seen_at = now
        s.get(Branch, br["B"].id).last_seen_at = now - timedelta(minutes=10)
        s.get(Branch, br["C"].id).last_seen_at = now - timedelta(hours=3)
        shop = s.get(Shop, s.get(Branch, br["A"].id).shop_id)
        shop.last_seq = 10
        s.get(Branch, br["A"].id).acked_seq = 10
        s.get(Branch, br["B"].id).acked_seq = 4
        s.commit()
    # طلبات الفروع نفسها تحدّث last_seen_at: نقرأ قبل أي طلب فرع آخر
    rows = {b["id"]: b for b in client.get("/mobile/v1/branches", headers=h).json()}
    a, b, c = rows[br["A"].id], rows[br["B"].id], rows[br["C"].id]
    assert (a["status"], b["status"], c["status"]) == ("online", "late", "offline")
    assert a["online"] and not b["online"]
    assert 3 * 3600 - 60 <= c["seconds_since_seen"] <= 3 * 3600 + 60
    assert (a["pending_events"], b["pending_events"], c["pending_events"]) == (0, 6, 10)
    assert a["stats_updated_at"] is not None and c["stats_updated_at"] is None

    one = client.get(f"/mobile/v1/branches/{br['B'].id}", headers=h).json()
    assert one["status"] == "late" and one["pending_events"] == 6

    admin(client, "PATCH", f"/v1/admin/branches/{br['C'].id}", json={"is_active": False})
    assert client.get(f"/mobile/v1/branches/{br['C'].id}", headers=h).json()["status"] == "disabled"


def test_summary_requires_chain_plan(client, loaded):
    from app.models import Shop

    br, _ = loaded
    h = owner_headers(client, br)
    with db() as s:
        s.query(Shop).one().license_plan = "pro"
        s.commit()
    r = summary(client, h, "2026-11-15", "2026-11-15")
    assert r.status_code == 403 and r.json()["error"]["code"] == "plan_upgrade_required"
