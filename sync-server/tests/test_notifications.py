"""تنبيهات الهاتف (المرحلة 5): التسجيل، الاكتشاف، منع التكرار، التجميع، ساعات الهدوء، والمحتوى الآمن."""

import re
import uuid
from datetime import UTC, date, datetime, timedelta

import pytest

from tests.conftest import admin
from tests.test_mobile import MGR_PW, OWNER_PW, bearer, chain, db, login, new_code  # noqa: F401 (fixture)


class FakeExpo:
    """بديل خدمة Expo: يسجّل الرسائل ويرد بتذكرة لكل رسالة."""

    def __init__(self) -> None:
        self.batches: list[list[dict]] = []
        self.unregistered: set[str] = set()

    def __call__(self, messages: list[dict]) -> list[dict]:
        self.batches.append(messages)
        return [
            {"status": "error", "details": {"error": "DeviceNotRegistered"}} if m["to"] in self.unregistered
            else {"status": "ok", "id": str(uuid.uuid4())}
            for m in messages
        ]  # fmt: skip

    def to(self, token: str) -> list[dict]:
        return [m for b in self.batches for m in b if m["to"] == token]


OWNER_TOKEN = "ExponentPushToken[owner-phone-1]"
MGR_TOKEN = "ExponentPushToken[mgr-phone-1]"


def register(client, h, token, offset=120):
    return client.put("/mobile/v1/push-token", headers=h, json={"token": token, "utc_offset_minutes": offset})


@pytest.fixture
def ctx(client, chain):  # noqa: F811
    _, br = chain
    owner = bearer(login(client, new_code(br["A"]), "owner", OWNER_PW, device="owner-phone").json())
    mgr = bearer(login(client, new_code(br["B"]), "b.mgr", MGR_PW, device="mgr-phone").json())
    assert register(client, owner, OWNER_TOKEN).status_code == 204
    assert register(client, mgr, MGR_TOKEN).status_code == 204
    # النتيجة لا تعتمد على ساعة تشغيل الاختبار: ساعات الهدوء الافتراضية (11م–8ص) موقوفة هنا،
    # واختبار ساعات الهدوء يضبط نافذته بنفسه.
    for h in (owner, mgr):
        set_prefs(client, h, quiet={"enabled": False})
    return br, owner, mgr, FakeExpo()


def tick(push, now=None):
    from app.services import notifications

    with db() as s:
        return notifications.tick(s, push, now or datetime.now(UTC))


def rows(account_name: str | None = None) -> list:
    from app.models import CatalogItem, Notification

    with db() as s:
        q = s.query(Notification)
        if account_name:
            acc = next(c for c in s.query(CatalogItem).all() if (c.data or {}).get("username") == account_name)
            q = q.filter(Notification.account_id == acc.id)
        out = q.order_by(Notification.created_at).all()
        s.expunge_all()
        return out


def ask(requester, source):
    r = requester.post("/v1/transfers/requests", json={
        "id": str(uuid.uuid4()), "from_branch_id": source.id, "requested_by": "منى",
        "lines": [{"product_id": "p-milk", "name": "لبن", "unit": "علبة", "qty": 20_000}],
    })  # fmt: skip
    assert r.status_code == 201, r.text
    return r.json()


def set_prefs(client, h, offset=120, **over):
    body = client.get("/mobile/v1/notification-prefs", headers=h).json()
    body.pop("push_on_this_device")
    for k, v in over.items():
        body[k] = {**body[k], **v}
    body["utc_offset_minutes"] = offset
    r = client.put("/mobile/v1/notification-prefs", headers=h, json=body)
    assert r.status_code == 200, r.text
    return r.json()


def day_data(net: int, **extra) -> dict:
    return {"count": 10, "revenue": net, "returns": 0, "net": net, "cost": 0, "profit": net, **extra}


# ================= التسجيل =================
def test_push_token_lifecycle(client, ctx):
    from app.models import MobileSession

    br, owner, mgr, _ = ctx
    assert register(client, owner, "not-a-token").status_code == 422
    prefs = client.get("/mobile/v1/notification-prefs", headers=owner).json()
    assert prefs["push_on_this_device"] is True

    # الخروج يمسح الـ token
    assert client.post("/mobile/v1/auth/logout", headers=mgr).status_code == 204
    with db() as s:
        tokens = [m.push_token for m in s.query(MobileSession).all() if m.push_token]
    assert tokens == [OWNER_TOKEN]

    # نفس الهاتف بحساب آخر: الحساب القديم لا يستقبل بعد ذلك
    mgr2 = bearer(login(client, new_code(br["B"]), "b.mgr", MGR_PW, device="owner-phone-2").json())
    register(client, mgr2, OWNER_TOKEN)
    with db() as s:
        holders = [m.username for m in s.query(MobileSession).all() if m.push_token == OWNER_TOKEN]
    assert holders == ["b.mgr"]

    # الخروج من كل الأجهزة يمسح كل tokens الحساب، وحذف صريح
    register(client, owner, "ExponentPushToken[owner-phone-9]")
    assert client.delete("/mobile/v1/push-token", headers=owner).status_code == 204
    assert client.get("/mobile/v1/notification-prefs", headers=owner).json()["push_on_this_device"] is False
    client.post("/mobile/v1/auth/logout-all", headers=mgr2)
    with db() as s:
        assert [m for m in s.query(MobileSession).all() if m.push_token] == []
    acts = [a["action"] for a in admin(client, "GET", "/v1/admin/audit").json()]
    assert "push_token_registered" in acts and "push_token_removed" in acts


# ================= منع التكرار والصلاحيات =================
def test_transfer_request_once_and_only_for_approvers(client, ctx):
    br, _, _, push = ctx
    t = ask(br["C"], br["B"])  # يحتاج موافقة مدينة نصر: المالك ومديرها
    ask(br["A"], br["C"])  # يحتاج موافقة الدقي: المالك فقط
    tick(push)
    tick(push)  # دورة ثانية: لا شيء جديد
    assert len(rows("owner")) == 2 and len(rows("b.mgr")) == 1
    mgr_msg = push.to(MGR_TOKEN)
    assert len(mgr_msg) == 1 and mgr_msg[0]["data"]["url"] == f"/transfer/{t['id']}"
    assert mgr_msg[0]["title"] == "طلب تحويل جديد" and mgr_msg[0]["channelId"] == "alerts"
    # المالك: حدثان متقاربان = إشعار واحد مجمّع يفتح شاشة التنبيهات
    owner_msg = push.to(OWNER_TOKEN)
    assert len(owner_msg) == 1 and owner_msg[0]["title"] == "تنبيهان جديدان" and owner_msg[0]["data"]["url"] == "/alerts"


def test_answered_request_is_dropped_before_sending(client, ctx):
    br, _, _, push = ctx
    t = ask(br["C"], br["B"])
    from app.services import notifications

    with db() as s:
        notifications.produce(s)
    br["B"].post(f"/v1/transfers/{t['id']}/reject", json={"reason": "لا"})
    tick(push)
    assert push.batches == [] and {r.status for r in rows()} == {"dropped"}
    assert client.get("/mobile/v1/notifications", headers=ctx[1]).json()["items"] == []  # المسقط لا يظهر


def test_grouping_with_min_gap(client, ctx):
    br, _, _, push = ctx
    now = datetime.now(UTC)
    ask(br["C"], br["B"])
    tick(push, now)
    assert len(push.to(MGR_TOKEN)) == 1
    # حدثان جديدان بعد دقيقة: داخل مهلة التجميع (3 دقائق) فلا إشعار الآن
    ask(br["C"], br["B"])
    ask(br["A"], br["B"])
    tick(push, now + timedelta(minutes=1))
    assert len(push.to(MGR_TOKEN)) == 1
    tick(push, now + timedelta(minutes=4))
    msgs = push.to(MGR_TOKEN)
    assert len(msgs) == 2 and msgs[1]["title"] == "تنبيهان جديدان" and msgs[1]["body"] == "طلب تحويل جديد"


def test_quiet_hours_defer_then_send_grouped(client, ctx):
    br, _, mgr, push = ctx
    now = datetime.now(UTC)
    local = now + timedelta(minutes=120)
    start = (local - timedelta(hours=1)).strftime("%H:%M")
    end = (local + timedelta(hours=1)).strftime("%H:%M")
    set_prefs(client, mgr, quiet={"enabled": True, "start": start, "end": end})
    ask(br["C"], br["B"])
    tick(push, now)
    assert push.to(MGR_TOKEN) == [] and rows("b.mgr")[0].status == "pending"
    # يظهر في سجل التطبيق فوراً حتى لو لم يُرسل push
    assert len(client.get("/mobile/v1/notifications", headers=mgr).json()["items"]) == 1
    tick(push, now + timedelta(hours=2))  # بعد ساعات الهدوء
    assert len(push.to(MGR_TOKEN)) == 1 and rows("b.mgr")[0].status == "sent"


def test_branch_offline_threshold_per_user_and_once_per_outage(client, ctx):
    from app.models import Branch

    br, owner, _, push = ctx
    set_prefs(client, owner, branch_offline={"enabled": True, "minutes": 30})
    now = datetime.now(UTC)

    def seen(ago: timedelta) -> None:
        with db() as s:
            for b in s.query(Branch).all():
                b.last_seen_at = now - (ago if b.id == br["B"].id else timedelta(seconds=10))
            s.commit()

    seen(timedelta(minutes=45))
    tick(push, now)
    owner_rows = [r for r in rows("owner") if r.kind == "branch_offline"]
    assert len(owner_rows) == 1 and owner_rows[0].route == f"/branch/{br['B'].id}"
    assert [r for r in rows("b.mgr") if r.kind == "branch_offline"] == []  # حده 60 دقيقة (الافتراضي)
    tick(push, now + timedelta(minutes=10))  # نفس الانقطاع: لا تكرار
    assert len([r for r in rows("owner") if r.kind == "branch_offline"]) == 1

    # رجع ثم انقطع من جديد = انقطاع جديد
    seen(timedelta(minutes=90))
    tick(push, now + timedelta(minutes=20))
    assert len([r for r in rows("owner") if r.kind == "branch_offline"]) == 2
    assert len([r for r in rows("b.mgr") if r.kind == "branch_offline"]) == 1


def test_offline_resolved_before_send_is_dropped(client, ctx):
    from app.models import Branch
    from app.services import notifications

    br, _, _, push = ctx
    now = datetime.now(UTC)
    with db() as s:
        s.get(Branch, br["C"].id).last_seen_at = now - timedelta(hours=3)
        s.commit()
        notifications.produce(s, now)
    br["C"].get("/v1/branches")  # الفرع رجع واتصل قبل الإرسال
    tick(push, now + timedelta(minutes=1))
    assert all(r.status == "dropped" for r in rows() if r.kind == "branch_offline")
    assert not any(m["title"] == "فرع غير متصل" for b in push.batches for m in b)


def test_eta_rejected_new_only(client, ctx):
    br, _, _, push = ctx
    today = date.today().isoformat()
    br["B"].put(f"/v1/stats/{today}", json={"data": day_data(500_000, eta_rejected=2)})
    tick(push)
    br["B"].put(f"/v1/stats/{today}", json={"data": day_data(600_000, eta_rejected=2)})  # نفس العدد
    tick(push, datetime.now(UTC) + timedelta(minutes=5))
    assert len([r for r in rows("b.mgr") if r.kind == "eta_rejected"]) == 1
    br["B"].put(f"/v1/stats/{today}", json={"data": day_data(600_000, eta_rejected=3)})  # مرفوض جديد
    tick(push, datetime.now(UTC) + timedelta(minutes=10))
    eta = [r for r in rows("b.mgr") if r.kind == "eta_rejected"]
    assert len(eta) == 2 and eta[0].route == "/receipts"


def test_low_sales_compared_to_same_weekday(client, ctx):
    br, owner, _, push = ctx
    now = datetime.now(UTC)
    # توقيت المستخدم = 12 ظهراً (بعد ساعة الفحص 10)
    offset = ((12 - now.hour) % 24) * 60 - now.minute
    offset = offset - 24 * 60 if offset > 14 * 60 else offset
    set_prefs(client, owner, offset=offset)
    # المدير: الساعة 7 صباحاً عنده (قبل ساعة الفحص)
    early = ((7 - now.hour) % 24) * 60 - now.minute
    early = early - 24 * 60 if early > 14 * 60 else early
    set_prefs(client, ctx[2], offset=early)
    yesterday = (now + timedelta(minutes=offset)).date() - timedelta(days=1)
    days = [{"day": (yesterday - timedelta(weeks=w)).isoformat(), "data": day_data(100_000)} for w in range(1, 5)]
    days.append({"day": yesterday.isoformat(), "data": day_data(30_000)})  # أقل من نصف المعتاد
    assert br["B"].post("/v1/stats/batch", json={"days": days}).status_code == 200
    # فرع آخر بلا تاريخ كافٍ: لا حكم
    br["C"].post("/v1/stats/batch", json={"days": [{"day": yesterday.isoformat(), "data": day_data(1)}]})
    tick(push, now)
    low = [r for r in rows("owner") if r.kind == "low_sales"]
    assert [r.ref_id for r in low] == [br["B"].id]

    # قبل الساعة 10 بتوقيت المستخدم: لا فحص (ملخصات أمس قد لا تكون اكتملت)
    tick(push, now + timedelta(minutes=5))
    assert [r for r in rows("b.mgr") if r.kind == "low_sales"] == []


def test_content_is_safe_for_lock_screen(client, ctx):
    """لا مبالغ ولا أرقام مبيعات ولا أسماء أصناف في نص الإشعار."""
    br, _, _, push = ctx
    today = date.today().isoformat()
    br["B"].put(f"/v1/stats/{today}", json={"data": day_data(987_654, eta_rejected=7)})
    ask(br["C"], br["B"])
    tick(push)
    texts = [f"{r.title} {r.body}" for r in rows()] + [f"{m['title']} {m['body']}" for b in push.batches for m in b]
    assert texts
    for text in texts:
        assert "987" not in text and "9,876" not in text and "لبن" not in text
        assert not re.search(r"\d{3,}", text)


def test_disabled_kind_and_prefs_audit(client, ctx):
    br, _, mgr, push = ctx
    out = set_prefs(client, mgr, transfer_request={"enabled": False})
    assert out["transfer_request"]["enabled"] is False
    ask(br["C"], br["B"])
    tick(push)
    assert rows("b.mgr") == [] and len(rows("owner")) == 1
    entry = next(a for a in admin(client, "GET", "/v1/admin/audit").json() if a["action"] == "notification_prefs_updated")
    assert entry["actor"] == "mobile" and entry["details"]["from_phone"] and entry["details"]["username"] == "b.mgr"
    bad = client.put("/mobile/v1/notification-prefs", headers=mgr, json={**out, "quiet": {"enabled": True, "start": "25:00", "end": "08:00"}})
    assert bad.status_code == 422


def test_device_not_registered_clears_token(client, ctx):
    from app.models import MobileSession

    br, _, _, push = ctx
    push.unregistered.add(MGR_TOKEN)
    ask(br["C"], br["B"])
    tick(push)
    with db() as s:
        assert [m.push_token for m in s.query(MobileSession).all() if m.username == "b.mgr"] == [None]


def test_network_failure_keeps_pending(client, ctx):
    br, _, _, _ = ctx

    def broken(_messages):
        raise OSError("no route")

    ask(br["C"], br["B"])
    tick(broken)
    assert {r.status for r in rows()} == {"pending"}  # تُعاد في الدورة التالية
    good = FakeExpo()
    tick(good)
    assert {r.status for r in rows()} == {"sent"} and len(good.batches) == 2


def test_plan_downgrade_drops_pending(client, ctx):
    from app.models import Shop
    from app.services import notifications

    br, _, _, push = ctx
    ask(br["C"], br["B"])
    with db() as s:
        notifications.produce(s)
        s.query(Shop).one().license_plan = "pro"
        s.commit()
    tick(push)
    assert push.batches == [] and {r.status for r in rows()} == {"dropped"}


def test_notifications_list_and_read(client, ctx):
    br, owner, _, push = ctx
    ask(br["C"], br["B"])
    ask(br["A"], br["C"])
    tick(push)
    out = client.get("/mobile/v1/notifications", headers=owner).json()
    assert out["unread"] == 2 and len(out["items"]) == 2
    first = out["items"][0]["id"]
    out = client.post("/mobile/v1/notifications/read", headers=owner, json={"ids": [first]}).json()
    assert out["unread"] == 1
    out = client.post("/mobile/v1/notifications/read", headers=owner, json={}).json()
    assert out["unread"] == 0
    # لا يرى تنبيهات غيره
    assert client.get("/mobile/v1/notifications", headers=ctx[2]).json()["unread"] == 1


def test_send_test_reaches_every_phone_immediately(client, ctx):
    """test-notify: يصل لكل هاتف فوراً (بلا انتظار التجميع)، ويظهر في السجل، ولا token في الناتج."""
    from app.services import notifications

    _, owner, mgr, push = ctx
    with db() as s:
        lines = notifications.send_test(s, push)
        lines += notifications.send_test(s, push)  # مرتين متتاليتين: لا تجميع ولا منع تكرار
    assert len(lines) == 4 and not any("ExponentPushToken" in x for x in lines)
    assert len(push.to(OWNER_TOKEN)) == 2 and len(push.to(MGR_TOKEN)) == 2
    out = client.get("/mobile/v1/notifications", headers=owner).json()
    assert [i["kind"] for i in out["items"]] == ["test", "test"] and out["unread"] == 2
    assert tick(push)["pushed"] == 0  # أُرسلت بالفعل: الـ notifier لا يعيدها


def test_migration_0009_reversible(client):
    from pathlib import Path

    from alembic.config import Config
    from sqlalchemy import inspect

    from alembic import command
    from app.db import get_engine

    root = Path(__file__).resolve().parents[1]
    cfg = Config(str(root / "alembic.ini"))
    cfg.set_main_option("script_location", str(root / "alembic"))
    command.downgrade(cfg, "0008")
    get_engine().dispose()
    insp = inspect(get_engine())
    assert "notifications" not in insp.get_table_names()
    assert "push_token" not in {c["name"] for c in insp.get_columns("mobile_sessions")}
    command.upgrade(cfg, "head")
    get_engine().dispose()
    assert "notifications" in inspect(get_engine()).get_table_names()


def _offset_for_hour(now: datetime, hour: int) -> int:
    """فرق توقيت يجعل الساعة المحلية للمستخدم = hour الآن (في حدود ±14 ساعة)."""
    offset = ((hour - now.hour) % 24) * 60 - now.minute
    return offset - 24 * 60 if offset > 14 * 60 else offset


def test_recap_daily_and_weekly_after_user_hour(client, ctx):
    br, owner, mgr, push = ctx
    now = datetime.now(UTC)
    offset = _offset_for_hour(now, 22)
    set_prefs(client, owner, offset=offset, recap={"mode": "both", "hour": 22})
    # المدير «أسبوعي فقط» بنفس التوقيت: لا ملخص يومي له أبداً (والأسبوعي يوم الجمعة فقط).
    set_prefs(client, mgr, offset=offset, recap={"mode": "week", "hour": 22})
    local_day = (now + timedelta(minutes=offset)).date()
    # أسبوع كامل حتى «اليوم» المحلي: لو اليوم جمعة يصل ملخص الأسبوع أيضاً.
    days = [{"day": (local_day - timedelta(days=d)).isoformat(), "data": day_data(50_000)} for d in range(7)]
    assert br["B"].post("/v1/stats/batch", json={"days": days}).status_code == 200

    tick(push, now)
    tick(push, now + timedelta(minutes=1))  # لا تكرار
    recaps = sorted(r.dedup_key for r in rows("owner") if r.kind == "recap")
    expected = [f"recap:day:{local_day.isoformat()}"]
    if local_day.weekday() == 4:
        expected.append(f"recap:week:{local_day.isoformat()}")
    assert recaps == sorted(expected)
    day_row = next(r for r in rows("owner") if r.dedup_key == expected[0])
    assert day_row.route == f"/recap/day/{local_day.isoformat()}"
    assert not re.search(r"\d", f"{day_row.title} {day_row.body}")  # لا أرقام على شاشة القفل

    mgr_recaps = [r.dedup_key for r in rows("b.mgr") if r.kind == "recap"]
    assert mgr_recaps == ([f"recap:week:{local_day.isoformat()}"] if local_day.weekday() == 4 else [])


def test_recap_waits_for_hour_and_needs_sales(client, ctx):
    br, owner, _, push = ctx
    now = datetime.now(UTC)
    offset = _offset_for_hour(now, 20)
    set_prefs(client, owner, offset=offset, recap={"hour": 22})
    local_day = (now + timedelta(minutes=offset)).date()
    assert br["B"].post("/v1/stats/batch", json={"days": [{"day": local_day.isoformat(), "data": day_data(9_000)}]}).status_code == 200
    tick(push, now)  # الساعة 8 مساءً عند المستخدم وموعده 10
    assert [r for r in rows("owner") if r.kind == "recap"] == []

    set_prefs(client, owner, offset=offset, recap={"hour": 20})
    # يوم بلا فواتير: لا ملخص
    assert br["B"].put(f"/v1/stats/{local_day.isoformat()}", json={"data": {**day_data(0), "count": 0}}).status_code in (200, 204)
    tick(push, now)
    assert [r for r in rows("owner") if r.kind == "recap"] == []
