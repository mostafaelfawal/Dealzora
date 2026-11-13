import uuid

from tests.conftest import BranchClient, admin


def make_transfer(src, dst, lines=None):  # noqa: ANN001
    body = {
        "id": str(uuid.uuid4()),
        "to_branch_id": dst.id,
        "sent_by": "أحمد",
        "lines": lines
        or [
            {"product_id": "p-milk", "name": "لبن", "unit": "علبة", "qty": 10_000, "unit_cost": 1500,
             "batch_no": "L7", "expiry_date": "2026-12-01"},
            {"product_id": "p-rice", "name": "أرز", "unit": "كيس", "qty": 5_000, "unit_cost": 3000},
        ],
    }  # fmt: skip
    return body, src.post("/v1/transfers", json=body)


def test_full_receive_flow(shop):
    _, b = shop
    body, r = make_transfer(b["A"], b["B"])
    assert r.status_code == 201
    t = r.json()
    assert t["status"] == "sent" and t["number"] == 1 and t["total_cost"] == 15000 + 15000
    assert t["from_branch_name"] == "المعادي" and t["to_branch_name"] == "مدينة نصر"

    # نفس الطلب مرة ثانية (انقطاع): نفس التحويل بدون رقم جديد
    again = b["A"].post("/v1/transfers", json=body).json()
    assert again["id"] == t["id"] and again["number"] == 1

    # فرع الاستلام يراه وارداً، وفرع ثالث لا يراه
    assert b["B"].get("/v1/transfers", params={"direction": "in"}).json()["total"] == 1
    assert b["C"].get(f"/v1/transfers/{t['id']}").status_code == 404

    # المرسل لا يستلم
    r = b["A"].post(f"/v1/transfers/{t['id']}/receive", json={})
    assert r.status_code == 403

    # استلام بعجز علبتين لبن
    milk = next(l for l in t["lines"] if l["product_id"] == "p-milk")
    r = b["B"].post(
        f"/v1/transfers/{t['id']}/receive",
        json={"lines": [{"line_id": milk["id"], "qty_received": 8_000}], "note": "علبتين مكسورين"},
    ).json()
    assert r["status"] == "partial" and r["shortage_cost"] == 3000
    rice = next(l for l in r["lines"] if l["product_id"] == "p-rice")
    assert rice["qty_received"] == 5_000  # غير المذكور = استُلم كاملاً

    # استلام مرة ثانية: نفس النتيجة، والإلغاء بعد الاستلام ممنوع
    assert b["B"].post(f"/v1/transfers/{t['id']}/receive", json={}).json()["status"] == "partial"
    assert b["A"].post(f"/v1/transfers/{t['id']}/cancel").status_code == 409

    # كل فرع يعرف بالتغيير من سجل الأحداث
    a_events = b["A"].get("/v1/sync/pull").json()["events"]
    assert [(e["entity"], e["op"]) for e in a_events] == [("stock_transfer", "received")]
    assert a_events[0]["payload"]["shortage_cost"] == 3000
    b_events = b["B"].get("/v1/sync/pull").json()["events"]
    assert [(e["entity"], e["op"]) for e in b_events] == [("stock_transfer", "sent")]
    assert b_events[0]["payload"]["lines"][0]["batch_no"] == "L7"


def test_cancel_flow(shop):
    _, b = shop
    _, r = make_transfer(b["A"], b["C"])
    t = r.json()
    assert b["C"].post(f"/v1/transfers/{t['id']}/cancel").status_code == 403  # المستلم لا يلغي
    r = b["A"].post(f"/v1/transfers/{t['id']}/cancel").json()
    assert r["status"] == "cancelled"
    assert b["C"].post(f"/v1/transfers/{t['id']}/receive", json={}).status_code == 409


def test_validation(client, shop):
    s, b = shop
    _, r = make_transfer(b["A"], b["A"])
    assert r.json()["error"]["code"] == "transfer_same_branch"

    other = admin(client, "POST", "/v1/admin/shops", json={"name": "محل تاني"}).json()
    creds = admin(
        client, "POST", f"/v1/admin/shops/{other['id']}/branches", json={"name": "فرع", "code": "X"}
    ).json()
    outsider = BranchClient(client, creds["branch_id"], creds["secret"])
    _, r = make_transfer(b["A"], outsider)
    assert r.status_code == 404  # لا تحويل لفرع محل آخر

    admin(client, "PATCH", f"/v1/admin/branches/{b['C'].id}", json={"is_active": False})
    _, r = make_transfer(b["A"], b["C"])
    assert r.json()["error"]["code"] == "branch_disabled"

    _, r = make_transfer(b["A"], b["B"])
    t = r.json()
    line = t["lines"][0]
    r = b["B"].post(
        f"/v1/transfers/{t['id']}/receive",
        json={"lines": [{"line_id": line["id"], "qty_received": line["qty_sent"] + 1}]},
    )
    assert r.json()["error"]["code"] == "transfer_over_receive"


def test_numbers_are_sequential_per_shop(shop):
    _, b = shop
    nums = [make_transfer(b["A"], b["B"])[1].json()["number"] for _ in range(3)]
    nums.append(make_transfer(b["B"], b["A"])[1].json()["number"])
    assert nums == [1, 2, 3, 4]
