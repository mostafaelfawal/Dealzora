"""تحويلات من الهاتف (المرحلة 4): الموافقة ينفّذها جهاز الفرع بنفس مسار البرنامج، والرفض مباشر،
مع التعارض والصلاحيات وسجل التدقيق «من الهاتف»."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from tests.conftest import admin
from tests.test_mobile import MGR_PW, OWNER_PW, bearer, chain, db, login, new_code  # noqa: F401 (fixture)


def ask(requester, source):
    """فرع يطلب بضاعة من فرع آخر (نفس ما يرسله البرنامج)."""
    r = requester.post("/v1/transfers/requests", json={
        "id": str(uuid.uuid4()), "from_branch_id": source.id, "requested_by": "منى",
        "lines": [
            {"product_id": "p-milk", "name": "لبن", "unit": "علبة", "qty": 20_000},
            {"product_id": "p-oil", "name": "زيت", "unit": "زجاجة", "qty": 6_000},
        ],
    })  # fmt: skip
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def phones(client, chain):  # noqa: F811
    _, br = chain
    owner = bearer(login(client, new_code(br["A"]), "owner", OWNER_PW, device="owner-phone").json())
    mgr = bearer(login(client, new_code(br["B"]), "b.mgr", MGR_PW, device="mgr-phone").json())
    return br, owner, mgr


def mget(client, h, tid):
    return client.get(f"/mobile/v1/transfers/{tid}", headers=h)


def approve(client, h, t, **body):
    return client.post(f"/mobile/v1/transfers/{t['id']}/approve", headers=h, json={"version": t["version"], **body})


def desktop_executes(branch, cmd: dict) -> dict:
    """ما يفعله جهاز الفرع (backend): يستلم الأمر، يخصم المخزون محلياً، ثم يوافق بنفس طلب البرنامج."""
    r = branch.post(f"/v1/transfers/commands/{cmd['id']}/claim")
    assert r.status_code == 200, r.text
    lines = [{"line_id": l["line_id"], "qty": l["qty"], "unit_cost": 1500 if l["qty"] else 0} for l in cmd["lines"]]
    r = branch.post(f"/v1/transfers/{cmd['transfer_id']}/approve",
                    json={"lines": lines, "note": cmd["note"], "sent_by": f"{cmd['requested_by']} (من الهاتف)"})  # fmt: skip
    assert r.status_code == 200, r.text
    return r.json()


def audit(client) -> list[dict]:
    return admin(client, "GET", "/v1/admin/audit").json()


# ================= الدورة الكاملة =================
def test_phone_approval_completes_cycle_like_desktop(client, phones):
    br, owner, _ = phones
    t = ask(br["C"], br["B"])  # الدقي يطلب من مدينة نصر
    oil = next(l for l in t["lines"] if l["product_id"] == "p-oil")

    out = approve(client, owner, t, lines=[{"line_id": oil["id"], "qty": 0}], note="الزيت خلصان")
    assert out.status_code == 200, out.text
    out = out.json()
    # لم يتحرك شيء بعد: الطلب ينتظر تنفيذ الفرع
    assert out["status"] == "requested" and out["approval"]["status"] == "pending"
    assert out["approval"]["requested_by"] == "owner" and out["approval"]["device_name"] == "Samsung A54"
    assert out["can_approve"] is False

    # جهاز مدينة نصر يأخذ الأمر مع مزامنته (والفروع الأخرى لا تراه)
    cmds = br["B"].get("/v1/transfers/commands").json()
    assert len(cmds) == 1 and cmds[0]["transfer_id"] == t["id"] and cmds[0]["note"] == "الزيت خلصان"
    assert {l["line_id"]: l["qty"] for l in cmds[0]["lines"]} == {
        next(l["id"] for l in t["lines"] if l["product_id"] == "p-milk"): 20_000, oil["id"]: 0,
    }  # fmt: skip
    assert br["A"].get("/v1/transfers/commands").json() == []
    assert br["C"].get("/v1/transfers/commands").json() == []

    sent = desktop_executes(br["B"], cmds[0])
    assert sent["status"] == "sent" and sent["sent_by"] == "owner (من الهاتف)"
    assert [l["product_id"] for l in sent["lines"]] == ["p-milk"]  # غير المتوفر حُذف كما في البرنامج

    out = mget(client, owner, t["id"]).json()
    assert out["status"] == "sent" and out["approval"]["status"] == "done"
    assert br["B"].get("/v1/transfers/commands").json() == []

    # الفرع الطالب يصله نفس حدث «sent» كأي موافقة من البرنامج، ويستلم عادي
    ops = [e["op"] for e in br["C"].get("/v1/sync/pull").json()["events"] if e["entity"] == "stock_transfer"]
    assert ops == ["sent"]
    r = br["C"].post(f"/v1/transfers/{t['id']}/receive", json={}).json()
    assert r["status"] == "received" and r["total_cost"] == 20 * 1500

    log = audit(client)
    req = next(a for a in log if a["action"] == "transfer_approve_requested")
    assert req["actor"] == "mobile" and req["details"]["from_phone"] is True and req["details"]["username"] == "owner"
    assert any(a["action"] == "transfer_command_done" and a["details"]["from_phone"] for a in log)


def test_reject_from_phone(client, phones):
    br, _, mgr = phones
    t = ask(br["C"], br["B"])
    r = client.post(f"/mobile/v1/transfers/{t['id']}/reject", headers=mgr, json={"version": t["version"], "reason": "مش متوفر"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "rejected" and r.json()["reject_reason"] == "مش متوفر"
    # الفرع الطالب يصله الرفض كالمعتاد
    ev = [e for e in br["C"].get("/v1/sync/pull").json()["events"] if e["entity"] == "stock_transfer"]
    assert [e["op"] for e in ev] == ["rejected"] and ev[0]["payload"]["reject_reason"] == "مش متوفر"
    entry = next(a for a in audit(client) if a["action"] == "transfer_rejected")
    assert entry["actor"] == "mobile" and entry["branch_id"] == br["B"].id
    assert entry["details"]["from_phone"] and entry["details"]["username"] == "b.mgr"
    assert entry["details"]["device"] == "Samsung A54"
    # سبب الرفض إجباري
    t2 = ask(br["C"], br["B"])
    r = client.post(f"/mobile/v1/transfers/{t2['id']}/reject", headers=mgr, json={"version": t2["version"], "reason": ""})
    assert r.status_code == 422


# ================= التعارض =================
def test_conflict_changed_from_another_device(client, phones):
    br, owner, mgr = phones
    t = ask(br["C"], br["B"])
    # المدير رفضه من البرنامج في الفرع، والمالك ما زال يرى النسخة القديمة
    assert br["B"].post(f"/v1/transfers/{t['id']}/reject", json={"reason": "لا"}).status_code == 200
    r = approve(client, owner, t)
    assert r.status_code == 409 and r.json()["error"]["code"] == "transfer_changed"
    assert r.json()["error"]["details"]["transfer"]["status"] == "rejected"  # الحالة الحالية للتحديث
    r = client.post(f"/mobile/v1/transfers/{t['id']}/reject", headers=mgr, json={"version": t["version"], "reason": "تاني"})
    assert r.json()["error"]["code"] == "transfer_changed"


def test_no_double_execution(client, phones):
    br, owner, mgr = phones
    t = ask(br["C"], br["B"])
    assert approve(client, owner, t).status_code == 200
    # موافقة ثانية (هاتف آخر أو ضغطتين) أثناء انتظار الفرع
    r = approve(client, mgr, t)
    assert r.status_code == 409 and r.json()["error"]["code"] == "approval_pending"

    cmd = br["B"].get("/v1/transfers/commands").json()[0]
    assert br["B"].post(f"/v1/transfers/commands/{cmd['id']}/claim").status_code == 200
    again = br["B"].post(f"/v1/transfers/commands/{cmd['id']}/claim")
    assert again.status_code == 409 and again.json()["error"]["code"] == "command_not_pending"
    # الرفض والإلغاء ممنوعان أثناء التنفيذ
    r = client.post(f"/mobile/v1/transfers/{t['id']}/reject", headers=mgr, json={"version": t["version"], "reason": "لا"})
    assert r.json()["error"]["code"] == "approval_in_progress"
    assert client.post(f"/mobile/v1/transfers/{t['id']}/approval/cancel", headers=owner).json()["error"]["code"] == "approval_in_progress"

    lines = [{"line_id": l["line_id"], "qty": l["qty"], "unit_cost": 100} for l in cmd["lines"]]
    first = br["B"].post(f"/v1/transfers/{t['id']}/approve", json={"lines": lines})
    retry = br["B"].post(f"/v1/transfers/{t['id']}/approve", json={"lines": lines})  # إعادة بعد انقطاع
    assert first.json()["status"] == retry.json()["status"] == "sent"
    sent_events = [e for e in br["C"].get("/v1/sync/pull").json()["events"] if e["op"] == "sent"]
    assert len(sent_events) == 1  # لا إرسال مزدوج


def test_request_changed_while_waiting_for_branch(client, phones):
    br, owner, _ = phones
    # 1) الفرع وافق من البرنامج مباشرة قبل أن يأخذ أمر الهاتف
    t = ask(br["C"], br["B"])
    approve(client, owner, t)
    assert br["B"].post(f"/v1/transfers/{t['id']}/approve", json={}).json()["status"] == "sent"
    out = mget(client, owner, t["id"]).json()
    assert out["approval"]["status"] == "superseded" and "مباشرة" in out["approval"]["error_message"]
    assert br["B"].get("/v1/transfers/commands").json() == []

    # 2) صاحب الطلب سحبه بعد أن استلم الفرع الأمر: موافقة الفرع تُرفض (والبرنامج يرجّع المخزون)
    t = ask(br["C"], br["B"])
    approve(client, owner, t)
    cmd = br["B"].get("/v1/transfers/commands").json()[0]
    assert br["B"].post(f"/v1/transfers/commands/{cmd['id']}/claim").status_code == 200
    assert br["C"].post(f"/v1/transfers/{t['id']}/withdraw").status_code == 200
    r = br["B"].post(f"/v1/transfers/{t['id']}/approve", json={})
    assert r.status_code == 409 and r.json()["error"]["code"] == "transfer_not_requested"
    assert mget(client, owner, t["id"]).json()["approval"]["status"] == "superseded"

    # 3) الطلب تغيّر قبل الاستلام: الاستلام نفسه يُرفض ويُحسم الأمر
    t = ask(br["C"], br["B"])
    approve(client, owner, t)
    cmd = br["B"].get("/v1/transfers/commands").json()[0]
    br["C"].post(f"/v1/transfers/{t['id']}/withdraw")
    assert br["B"].post(f"/v1/transfers/commands/{cmd['id']}/claim").status_code == 409


def test_branch_reports_failure(client, phones):
    br, owner, _ = phones
    t = ask(br["C"], br["B"])
    approve(client, owner, t)
    cmd = br["B"].get("/v1/transfers/commands").json()[0]
    br["B"].post(f"/v1/transfers/commands/{cmd['id']}/claim")
    r = br["B"].post(f"/v1/transfers/commands/{cmd['id']}/fail",
                     json={"code": "insufficient_stock", "message": "الكمية المتاحة من «لبن» أقل من المطلوب"})  # fmt: skip
    assert r.json() == {"status": "failed"}
    out = mget(client, owner, t["id"]).json()
    assert out["status"] == "requested" and out["approval"]["status"] == "failed"
    assert "لبن" in out["approval"]["error_message"]
    assert out["can_approve"] is True  # يقدر يحاول تاني بكمية أقل


def test_expired_when_branch_never_picks_up(client, phones):
    """فرع بإصدار أقدم لا يعرف الأوامر: الموافقة تنتهي بعد المهلة ولا يتأثر الفرع."""
    from app.models import TransferCommand

    br, owner, _ = phones
    t = ask(br["C"], br["B"])
    approve(client, owner, t)
    with db() as s:
        s.query(TransferCommand).one().created_at = datetime.now(UTC) - timedelta(hours=25)
        s.commit()
    out = mget(client, owner, t["id"]).json()
    assert out["approval"]["status"] == "expired" and out["can_approve"] is True
    assert br["B"].get("/v1/transfers/commands").json() == []
    assert out["status"] == "requested"  # الطلب نفسه لم يتغير


def test_cancel_pending_approval(client, phones):
    br, owner, mgr = phones
    t = ask(br["C"], br["B"])
    approve(client, mgr, t)
    r = client.post(f"/mobile/v1/transfers/{t['id']}/approval/cancel", headers=owner)  # المالك يقدر
    assert r.status_code == 200 and r.json()["approval"]["status"] == "cancelled"
    assert br["B"].get("/v1/transfers/commands").json() == []
    assert client.post(f"/mobile/v1/transfers/{t['id']}/approval/cancel", headers=mgr).json()["error"]["code"] == "no_pending_approval"
    # المدير (يرى الطلب لأنه من فرعه) لا يلغي موافقة طلبها المالك
    t2 = ask(br["C"], br["B"])
    approve(client, owner, t2)
    r = client.post(f"/mobile/v1/transfers/{t2['id']}/approval/cancel", headers=mgr)
    assert r.status_code == 403 and r.json()["error"]["code"] == "approval_not_yours"


# ================= الصلاحيات =================
def test_permissions_match_desktop(client, phones):
    br, owner, mgr = phones
    a_to_c = ask(br["C"], br["A"])  # بين فرعين ليسا للمدير
    b_asks = ask(br["B"], br["A"])  # مدينة نصر هي الطالبة (ليست المطلوب منها)

    # المدير لا يرى تحويلات فروع غيره (404 لا 403)
    assert mget(client, mgr, a_to_c["id"]).status_code == 404
    assert a_to_c["id"] not in [x["id"] for x in client.get("/mobile/v1/transfers", headers=mgr).json()["items"]]
    assert approve(client, mgr, a_to_c).status_code == 404

    # يرى طلب فرعه، لكن الموافقة/الرفض من الفرع المطلوب منه فقط (مثل البرنامج)
    seen = mget(client, mgr, b_asks["id"]).json()
    assert seen["can_approve"] is False and seen["can_reject"] is False
    r = approve(client, mgr, b_asks)
    assert r.status_code == 403 and r.json()["error"]["code"] == "transfer_not_yours"
    r = client.post(f"/mobile/v1/transfers/{b_asks['id']}/reject", headers=mgr, json={"version": 1, "reason": "لا"})
    assert r.status_code == 403

    # المالك يقدر في أي فرع
    assert mget(client, owner, a_to_c["id"]).json()["can_approve"] is True
    # needs_action: ما ينتظر موافقتي أنا
    pending_owner = client.get("/mobile/v1/transfers", headers=owner, params={"needs_action": True}).json()
    assert {x["id"] for x in pending_owner["items"]} == {a_to_c["id"], b_asks["id"]}
    assert client.get("/mobile/v1/transfers", headers=mgr, params={"needs_action": True}).json()["total"] == 0

    # فرع لا يستلم أوامر فرع آخر
    approve(client, owner, a_to_c)
    cmd = br["A"].get("/v1/transfers/commands").json()[0]
    assert br["B"].post(f"/v1/transfers/commands/{cmd['id']}/claim").status_code == 404
    # ولا يلمس تحويلاً لا يراه
    assert client.post(f"/mobile/v1/transfers/{a_to_c['id']}/approval/cancel", headers=mgr).status_code == 404
    # كمية أكبر من المطلوب مرفوضة
    t = ask(br["C"], br["B"])
    r = approve(client, mgr, t, lines=[{"line_id": t["lines"][0]["id"], "qty": 999_999}])
    assert r.json()["error"]["code"] == "transfer_over_request"


def test_branch_token_and_plan_guard(client, phones):
    from app.models import Shop

    br, owner, _ = phones
    assert client.get("/mobile/v1/transfers", headers=br["A"].headers).status_code == 401
    with db() as s:
        s.query(Shop).one().license_plan = "pro"
        s.commit()
    assert client.get("/mobile/v1/transfers", headers=owner).json()["error"]["code"] == "plan_upgrade_required"


def test_migration_0008_reversible(client):
    from pathlib import Path

    from alembic.config import Config
    from sqlalchemy import inspect

    from alembic import command
    from app.db import get_engine

    root = Path(__file__).resolve().parents[1]
    cfg = Config(str(root / "alembic.ini"))
    cfg.set_main_option("script_location", str(root / "alembic"))
    command.downgrade(cfg, "0007")
    get_engine().dispose()
    assert "transfer_commands" not in inspect(get_engine()).get_table_names()
    command.upgrade(cfg, "head")
    get_engine().dispose()
    assert "transfer_commands" in inspect(get_engine()).get_table_names()
