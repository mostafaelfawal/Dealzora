import uuid

from tests.conftest import admin


def gid() -> str:
    return str(uuid.uuid4())


def product(**over):  # noqa: ANN003
    return {"name": "لبن جهينة 1 لتر", "barcode": "6221234", "unit": "علبة", "sale_price": 3500, **over}


def push(branch, *items):  # noqa: ANN001, ANN002
    r = branch.post("/v1/catalog/push", json={"items": list(items)})
    assert r.status_code == 200, r.text
    return r.json()


def pull(branch, after=0):  # noqa: ANN001
    r = branch.get("/v1/catalog/pull", params={"after": after})
    assert r.status_code == 200, r.text
    return r.json()


def test_create_pull_and_merge_by_barcode(shop):
    _, b = shop
    g = gid()
    [res] = push(b["A"], {"kind": "product", "gid": g, "data": product()})
    assert res["status"] == "ok" and res["version"] == 1

    got = pull(b["B"])
    assert [i["gid"] for i in got["items"]] == [g]
    assert got["items"][0]["data"]["sale_price"] == 3500 and got["next_after"] == got["last_seq"]

    # نفس الباركود عند فرع B بمعرّف آخر قبل الربط = دمج لا تكرار
    [res] = push(b["B"], {"kind": "product", "gid": gid(), "data": product(sale_price=4000)})
    assert res["status"] == "merged" and res["canonical_gid"] == g
    assert res["data"]["sale_price"] == 3500  # أول فرع رفع هو المرجع
    assert len(pull(b["C"])["items"]) == 1


def test_merge_by_name_when_no_barcode_and_customer_by_phone(shop):
    _, b = shop
    g = gid()
    push(b["A"], {"kind": "product", "gid": g, "data": product(barcode=None, name="طماطم", unit="كيلو")})
    [res] = push(b["B"], {"kind": "product", "gid": gid(), "data": product(barcode=None, name="  طماطم ", unit="كيلو")})
    assert res["status"] == "merged" and res["canonical_gid"] == g

    c = gid()
    push(b["A"], {"kind": "customer", "gid": c, "data": {"name": "محمد", "phone": "01012345678"}})
    [res] = push(b["B"], {"kind": "customer", "gid": gid(), "data": {"name": "محمد علي", "phone": "01012345678"}})
    assert res["status"] == "merged" and res["canonical_gid"] == c
    # عميل بدون تليفون: لا دمج (أسماء الناس بتتكرر)
    [r1] = push(b["A"], {"kind": "customer", "gid": gid(), "data": {"name": "أحمد"}})
    [r2] = push(b["B"], {"kind": "customer", "gid": gid(), "data": {"name": "أحمد"}})
    assert r1["status"] == r2["status"] == "ok"


def test_field_level_merge_and_versioning(shop):
    _, b = shop
    g = gid()
    push(b["A"], {"kind": "product", "gid": g, "data": product()})
    # A غيّر السعر، و B (في نفس الوقت، من بيانات قديمة) غيّر الاسم: الاثنين يتحفظوا
    push(b["A"], {"kind": "product", "gid": g, "data": product(sale_price=3800), "fields": ["sale_price"]})
    [res] = push(b["B"], {"kind": "product", "gid": g, "data": product(name="لبن جهينة لتر"), "fields": ["name"]})
    assert res["status"] == "ok" and res["version"] == 3
    assert res["data"]["sale_price"] == 3800 and res["data"]["name"] == "لبن جهينة لتر"

    # رفع بدون تغيير فعلي: لا نسخة جديدة ولا seq جديد
    last = pull(b["C"])["last_seq"]
    [res] = push(b["A"], {"kind": "product", "gid": g, "data": res["data"]})
    assert res["version"] == 3 and pull(b["C"])["last_seq"] == last
    # السحب بعد آخر seq: فاضي
    assert pull(b["C"], after=last)["items"] == []


def test_barcode_conflict_and_delete(shop):
    _, b = shop
    g1, g2 = gid(), gid()
    push(b["A"], {"kind": "product", "gid": g1, "data": product()},
         {"kind": "product", "gid": g2, "data": product(name="أرز", barcode="999")})  # fmt: skip
    [res] = push(b["B"], {"kind": "product", "gid": g2, "data": product(name="أرز", barcode="6221234"), "fields": ["barcode"]})
    assert res["status"] == "conflict" and "6221234" in res["message"]

    [res] = push(b["A"], {"kind": "product", "gid": g1, "data": product(), "deleted": True})
    assert res["status"] == "ok"
    items = {i["gid"]: i for i in pull(b["B"])["items"]}
    assert items[g1]["deleted"] is True
    # بعد الحذف: الباركود اتحرر، وأي تعديل على المحذوف يرجع deleted
    [res] = push(b["B"], {"kind": "product", "gid": g2, "data": product(name="أرز", barcode="6221234"), "fields": ["barcode"]})
    assert res["status"] == "ok"
    [res] = push(b["B"], {"kind": "product", "gid": g1, "data": product(sale_price=1)})
    assert res["status"] == "deleted"


def test_validation_and_isolation(shop, client):
    _, b = shop
    bad = [
        {"kind": "product", "gid": gid(), "data": {**product(), "stock_qty": 5}},  # حقل غير مسموح
        {"kind": "product", "gid": gid(), "data": product(sale_price=-1)},
        {"kind": "product", "gid": gid(), "data": product(name="")},
        {"kind": "product", "gid": gid(), "data": product(sale_price="35")},  # نوع خاطئ
        {"kind": "product", "gid": gid(), "data": product(wholesale_price=3500)},  # جملة = قطاعي
    ]
    assert [r["status"] for r in push(b["A"], *bad)] == ["invalid"] * 5
    assert pull(b["B"])["items"] == []

    r = b["A"].post("/v1/catalog/push", json={"items": [{"kind": "supplier", "gid": gid(), "data": {}}]})
    assert r.status_code == 422

    # محل تاني ما يشوفش ولا يقدر يكتب على سجلات المحل الأول
    g = gid()
    push(b["A"], {"kind": "product", "gid": g, "data": product()})
    s2 = admin(client, "POST", "/v1/admin/shops", json={"name": "محل تاني"}).json()
    creds = admin(client, "POST", f"/v1/admin/shops/{s2['id']}/branches", json={"name": "فرع", "code": "Z"}).json()
    from tests.conftest import BranchClient

    other = BranchClient(client, creds["branch_id"], creds["secret"])
    assert pull(other)["items"] == []
    [res] = push(other, {"kind": "product", "gid": g, "data": product(sale_price=1)})
    assert res["status"] == "invalid"
    assert pull(b["B"])["items"][0]["data"]["sale_price"] == 3500

    assert client.get("/v1/catalog/pull").status_code == 401


def test_push_limit(shop, monkeypatch):
    _, b = shop
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "max_catalog_push", 2)
    items = [{"kind": "product", "gid": gid(), "data": product(barcode=str(i))} for i in range(3)]
    r = b["A"].post("/v1/catalog/push", json={"items": items})
    assert r.status_code == 400 and r.json()["error"]["code"] == "push_too_large"


HASH = "$argon2id$v=19$m=65536,t=3,p=4$" + "a" * 22 + "$" + "b" * 43


def test_owner_account_sync(shop):
    _, b = shop
    g = gid()
    [res] = push(b["A"], {"kind": "owner", "gid": g, "data": {"username": "owner", "password_hash": HASH}})
    assert res["status"] == "ok"
    # نفس اسم المستخدم من فرع تاني = نفس الحساب (دمج)، وتجزئة الفرع الأول هي المرجع
    [res] = push(b["B"], {"kind": "owner", "gid": gid(), "data": {"username": "owner", "password_hash": HASH[:-1] + "c"}})
    assert res["status"] == "merged" and res["canonical_gid"] == g and res["data"]["password_hash"] == HASH
    items = pull(b["C"])["items"]
    assert [(i["kind"], i["data"]["username"]) for i in items] == [("owner", "owner")]

    bad = [
        {"kind": "owner", "gid": gid(), "data": {"username": "x2", "password_hash": "plaintext-password-123456789012345678901234"}},
        {"kind": "owner", "gid": gid(), "data": {"username": "Owner Two", "password_hash": HASH}},
        {"kind": "owner", "gid": gid(), "data": {"username": "o3", "password_hash": HASH, "role": "owner"}},
        {"kind": "owner", "gid": gid(), "data": {"username": "o4", "password_hash": "$argon2i$" + "x" * 50}},
    ]
    assert [r["status"] for r in push(b["A"], *bad)] == ["invalid"] * 4
