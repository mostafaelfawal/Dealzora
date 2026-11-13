"""طلبات التحويل: فرع يطلب، والفرع المطلوب منه يوافق ويرسل أو يرفض، وصاحب الطلب يقدر يسحبه."""

import uuid


def ask(requester, source, lines=None):  # noqa: ANN001
    body = {
        "id": str(uuid.uuid4()),
        "from_branch_id": source.id,
        "requested_by": "منى",
        "note": "ناقص عندنا",
        "lines": lines
        or [
            {"product_id": "p-milk", "name": "لبن", "unit": "علبة", "qty": 20_000},
            {"product_id": "p-oil", "name": "زيت", "unit": "زجاجة", "qty": 6_000},
        ],
    }
    return body, requester.post("/v1/transfers/requests", json=body)


def test_request_approve_receive(shop):
    _, b = shop
    body, r = ask(b["B"], b["A"])  # مدينة نصر تطلب من المعادي
    assert r.status_code == 201, r.text
    t = r.json()
    assert t["status"] == "requested" and t["from_branch_id"] == b["A"].id
    assert t["to_branch_id"] == b["B"].id and t["total_cost"] == 0
    assert b["B"].post("/v1/transfers/requests", json=body).json()["id"] == t["id"]  # إعادة آمنة

    # المعادي يشوف الطلب في سجل أحداثه، والدقي لا
    a_ev = b["A"].get("/v1/sync/pull").json()["events"]
    assert [(e["entity"], e["op"]) for e in a_ev] == [("stock_transfer", "requested")]
    assert b["C"].get("/v1/sync/pull").json()["events"] == []

    # صاحب الطلب لا يوافق على طلبه
    assert b["B"].post(f"/v1/transfers/{t['id']}/approve", json={}).status_code == 403

    milk = next(l for l in t["lines"] if l["product_id"] == "p-milk")
    oil = next(l for l in t["lines"] if l["product_id"] == "p-oil")
    r = b["A"].post(
        f"/v1/transfers/{t['id']}/approve",
        json={
            "sent_by": "أحمد",
            "lines": [
                {"line_id": milk["id"], "qty": 15_000, "unit_cost": 1500, "batch_no": "L9", "expiry_date": "2026-12-20"},
                {"line_id": oil["id"], "qty": 0},  # غير متوفر
            ],
        },
    ).json()  # fmt: skip
    assert r["status"] == "sent" and r["sent_by"] == "أحمد"
    assert [(l["product_id"], l["qty_requested"], l["qty_sent"]) for l in r["lines"]] == [
        ("p-milk", 20_000, 15_000)
    ]
    assert r["total_cost"] == 15 * 1500
    # موافقة مرة ثانية: نفس النتيجة، والسحب بعد الإرسال ممنوع
    assert b["A"].post(f"/v1/transfers/{t['id']}/approve", json={}).json()["status"] == "sent"
    assert b["B"].post(f"/v1/transfers/{t['id']}/withdraw").status_code == 409

    r = b["B"].post(f"/v1/transfers/{t['id']}/receive", json={}).json()
    assert r["status"] == "received" and r["lines"][0]["qty_received"] == 15_000


def test_approve_validation(shop):
    _, b = shop
    _, r = ask(b["B"], b["A"])
    t = r.json()
    r = b["A"].post(
        f"/v1/transfers/{t['id']}/approve",
        json={"lines": [{"line_id": l["id"], "qty": 0} for l in t["lines"]]},
    )
    assert r.json()["error"]["code"] == "transfer_empty"
    r = b["A"].post(f"/v1/transfers/{t['id']}/approve", json={"lines": [{"line_id": "x", "qty": 1}]})
    assert r.json()["error"]["code"] == "transfer_line_unknown"


def test_reject_and_withdraw(shop):
    _, b = shop
    _, r = ask(b["B"], b["A"])
    t = r.json()
    assert b["B"].post(f"/v1/transfers/{t['id']}/reject", json={"reason": "مش متاح"}).status_code == 403
    r = b["A"].post(f"/v1/transfers/{t['id']}/reject", json={"reason": "الكمية مش متاحة"}).json()
    assert r["status"] == "rejected" and r["reject_reason"] == "الكمية مش متاحة"
    assert b["A"].post(f"/v1/transfers/{t['id']}/approve", json={}).status_code == 409
    b_ev = b["B"].get("/v1/sync/pull").json()["events"]
    assert [e["op"] for e in b_ev] == ["rejected"]

    _, r = ask(b["C"], b["A"])
    t2 = r.json()
    assert b["A"].post(f"/v1/transfers/{t2['id']}/withdraw").status_code == 403
    r = b["C"].post(f"/v1/transfers/{t2['id']}/withdraw").json()
    assert r["status"] == "withdrawn"
    assert b["A"].post(f"/v1/transfers/{t2['id']}/approve", json={}).status_code == 409


def test_request_privacy_and_validation(shop):
    _, b = shop
    _, r = ask(b["B"], b["B"])
    assert r.json()["error"]["code"] == "transfer_same_branch"
    _, r = ask(b["B"], b["A"])
    t = r.json()
    assert b["C"].get(f"/v1/transfers/{t['id']}").status_code == 404
    assert b["C"].post(f"/v1/transfers/{t['id']}/approve", json={}).status_code == 404
    # نفس id من فرع آخر = تعارض، لا استيلاء على الطلب
    body = {
        "id": t["id"],
        "from_branch_id": b["A"].id,
        "lines": [{"product_id": "p", "name": "x", "unit": "u", "qty": 1}],
    }
    assert b["C"].post("/v1/transfers/requests", json=body).status_code == 409

    lists = {
        who: b[who].get("/v1/transfers", params={"status": "requested"}).json()["total"]
        for who in ("A", "B", "C")
    }
    assert lists == {"A": 1, "B": 1, "C": 0}
