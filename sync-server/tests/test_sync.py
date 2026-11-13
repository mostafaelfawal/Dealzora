from tests.conftest import BranchClient, admin, event


def test_push_assigns_contiguous_seq_and_ignores_duplicates(shop):
    _, b = shop
    batch = [event(n=i) for i in range(3)]
    r = b["A"].post("/v1/sync/push", json={"events": batch})
    assert r.json() == {"accepted": 3, "duplicates": 0, "last_seq": 3}
    # إعادة نفس الحزمة (النت قطع بعد الحفظ) + حدث مكرر داخل نفس الحزمة
    again = batch + [batch[0]]
    r = b["A"].post("/v1/sync/push", json={"events": again})
    assert r.json() == {"accepted": 0, "duplicates": 4, "last_seq": 3}
    r = b["B"].post("/v1/sync/push", json={"events": [event(), event()]})
    assert r.json()["last_seq"] == 5


def test_pull_excludes_own_and_cursor_advances(shop):
    _, b = shop
    b["A"].post("/v1/sync/push", json={"events": [event(n=1), event(n=2)]})
    b["B"].post("/v1/sync/push", json={"events": [event(n=3)]})
    b["A"].post("/v1/sync/push", json={"events": [event(n=4)]})

    r = b["B"].get("/v1/sync/pull", params={"after": 0}).json()
    assert [e["payload"]["n"] for e in r["events"]] == [1, 2, 4]
    assert all(e["branch_id"] == b["A"].id for e in r["events"])
    assert r["next_after"] == 4 and r["has_more"] is False and r["last_seq"] == 4

    r = b["A"].get("/v1/sync/pull", params={"after": 0}).json()
    assert [e["payload"]["n"] for e in r["events"]] == [3]
    assert r["next_after"] == 4  # تخطّى أحداثه هو لكن المؤشر تقدّم

    r = b["A"].get("/v1/sync/pull", params={"after": 4}).json()
    assert r["events"] == [] and r["next_after"] == 4


def test_pull_paging(shop):
    _, b = shop
    b["A"].post("/v1/sync/push", json={"events": [event(n=i) for i in range(7)]})
    seen, after = [], 0
    while True:
        r = b["B"].get("/v1/sync/pull", params={"after": after, "limit": 3}).json()
        seen += [e["payload"]["n"] for e in r["events"]]
        after = r["next_after"]
        if not r["has_more"]:
            break
    assert seen == list(range(7))


def test_shops_are_isolated(client, shop):
    _, b = shop
    b["A"].post("/v1/sync/push", json={"events": [event(secret="shop1")]})
    other = admin(client, "POST", "/v1/admin/shops", json={"name": "منافس"}).json()
    creds = admin(
        client, "POST", f"/v1/admin/shops/{other['id']}/branches", json={"name": "فرع", "code": "X"}
    ).json()
    x = BranchClient(client, creds["branch_id"], creds["secret"])
    r = x.get("/v1/sync/pull", params={"after": 0}).json()
    assert r["events"] == [] and r["last_seq"] == 0
    # نفس id حدث من محل آخر لا يُسرَّب ولا يُستبدل
    leaked = event()
    b["A"].post("/v1/sync/push", json={"events": [leaked]})
    r = x.post("/v1/sync/push", json={"events": [leaked]}).json()
    assert r["accepted"] == 0 and r["duplicates"] == 1


def test_push_limits(shop):
    _, b = shop
    r = b["A"].post("/v1/sync/push", json={"events": [event() for _ in range(51)]})
    assert r.status_code == 400 and r.json()["error"]["code"] == "push_too_large"
    r = b["A"].post("/v1/sync/push", json={"events": []})
    assert r.status_code == 422


def test_ack_and_status(shop):
    _, b = shop
    b["A"].post("/v1/sync/push", json={"events": [event(), event()]})
    st = b["B"].post("/v1/sync/ack", json={"seq": 99}).json()
    assert st["my_acked_seq"] == 2  # لا يتجاوز آخر رقم موجود
    st = b["B"].post("/v1/sync/ack", json={"seq": 1}).json()
    assert st["my_acked_seq"] == 2  # لا يرجع للخلف
    names = {br["code"]: br for br in st["branches"]}
    assert set(names) == {"A", "B", "C"} and names["A"]["last_pushed_seq"] == 2


def test_stream_notifies_changes(shop):
    _, b = shop
    b["A"].post("/v1/sync/push", json={"events": [event()]})
    events = []
    with b["B"].c.stream("GET", "/v1/sync/stream", params={"after": 0}, headers=b["B"].headers) as r:
        assert r.headers["content-type"].startswith("text/event-stream")
        for line in r.iter_lines():
            if line.startswith("event:"):
                events.append(line.split(":", 1)[1].strip())
    # hello ← changed (فيه حدث بعد 0) ← reconnect (أقصى مدة في الاختبار نصف ثانية)
    assert events[:2] == ["hello", "changed"] and events[-1] == "reconnect"


def test_daily_stats(shop):
    _, b = shop
    b["A"].put("/v1/stats/2026-11-10", json={"data": {"sales": 1500, "count": 12}})
    b["A"].put("/v1/stats/2026-11-10", json={"data": {"sales": 1700, "count": 13}})  # تحديث
    b["B"].put("/v1/stats/2026-11-10", json={"data": {"sales": 900, "count": 7}})
    rows = b["C"].get("/v1/stats", params={"date_from": "2026-11-01", "date_to": "2026-11-30"}).json()
    totals = {r["branch_id"]: r["data"]["sales"] for r in rows}
    assert totals == {b["A"].id: 1700, b["B"].id: 900}
