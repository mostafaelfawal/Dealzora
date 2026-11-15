"""تعديل أسعار الأصناف المشتركة من الهاتف (المرحلة 8): للمالك فقط، يصل لكل الفروع، والتعارض بالـ version."""

import uuid

import pytest

from tests.conftest import admin
from tests.test_mobile import MGR_PW, OWNER_PW, bearer, chain, login, new_code  # noqa: F401 (fixture)

PRODUCT = {"name": "زيت عباد الشمس 1 لتر", "barcode": "6221004001", "unit": "زجاجة", "sale_price": 9_000,
           "wholesale_price": 8_500, "wholesale_min_qty": 12_000}  # fmt: skip


@pytest.fixture
def cat(client, chain):  # noqa: F811
    _, br = chain
    gid = str(uuid.uuid4())
    [res] = br["A"].post("/v1/catalog/push", json={"items": [{"kind": "product", "gid": gid, "data": PRODUCT}]}).json()
    assert res["status"] == "ok", res
    owner = bearer(login(client, new_code(br["A"]), "owner", OWNER_PW).json())
    mgr = bearer(login(client, new_code(br["B"]), "b.mgr", MGR_PW).json())
    return br, owner, mgr, gid


def search(client, h, q):
    return client.get("/mobile/v1/admin/catalog/search", headers=h, params={"q": q})


def price(client, h, gid, **body):
    return client.post(f"/mobile/v1/admin/catalog/{gid}/price", headers=h, json=body)


def test_search_by_name_and_barcode(client, cat):
    _, owner, _, gid = cat
    assert [p["gid"] for p in search(client, owner, "عباد").json()] == [gid]
    assert [p["gid"] for p in search(client, owner, "622100").json()] == [gid]
    assert search(client, owner, "شاي").json() == []
    assert search(client, owner, "a").json() == []  # حرف واحد: لا بحث
    assert search(client, owner, "%").json() == []  # لا حقن LIKE
    out = search(client, owner, "زيت").json()[0]
    assert (out["sale_price"], out["wholesale_price"], out["version"], out["updated_by"]) == (9_000, 8_500, 1, "المعادي")


def test_price_reaches_all_branches_with_audit(client, cat):
    br, owner, _, gid = cat
    after = br["B"].get("/v1/catalog/pull").json()["last_seq"]
    r = price(client, owner, gid, version=1, sale_price=9_500, wholesale_price=9_000)
    assert r.status_code == 200, r.text
    assert (r.json()["sale_price"], r.json()["version"], r.json()["updated_by"]) == (9_500, 2, "الهاتف")

    # كل الفروع (حتى اللي أنشأه) تسحب التعديل مع المزامنة الحالية
    for code in ("A", "B", "C"):
        items = br[code].get("/v1/catalog/pull", params={"after": after}).json()["items"]
        item = next(i for i in items if i["gid"] == gid)
        assert item["data"]["sale_price"] == 9_500 and item["version"] == 2
        assert item["updated_by_branch_id"] is None  # لا فرع يتجاهله كأنه تعديله هو
        assert item["data"]["name"] == PRODUCT["name"]  # باقي الحقول كما هي

    entry = next(a for a in admin(client, "GET", "/v1/admin/audit").json() if a["action"] == "catalog_price_updated")
    assert entry["actor"] == "mobile" and entry["details"]["from_phone"] and entry["details"]["username"] == "owner"
    assert entry["details"]["sale_price"] == [9_000, 9_500]

    # نفس السعر مرة أخرى: لا نسخة جديدة ولا seq جديد
    seq = br["B"].get("/v1/catalog/pull").json()["last_seq"]
    assert price(client, owner, gid, version=2, sale_price=9_500, wholesale_price=9_000).json()["version"] == 2
    assert br["B"].get("/v1/catalog/pull").json()["last_seq"] == seq


def test_conflict_with_branch_edit_does_not_overwrite(client, cat):
    br, owner, _, gid = cat
    seen = search(client, owner, "زيت").json()[0]  # المالك فتح الصنف (version 1)
    # فرع غيّر الاسم في نفس الوقت
    [res] = br["B"].post("/v1/catalog/push", json={"items": [
        {"kind": "product", "gid": gid, "data": {**PRODUCT, "name": "زيت عباد 1 لتر"}, "fields": ["name"]},
    ]}).json()  # fmt: skip
    assert res["status"] == "ok" and res["version"] == 2

    r = price(client, owner, gid, version=seen["version"], sale_price=10_000, wholesale_price=None)
    assert r.status_code == 409 and r.json()["error"]["code"] == "catalog_changed"
    current = r.json()["error"]["details"]["product"]
    assert current["version"] == 2 and current["name"] == "زيت عباد 1 لتر" and current["sale_price"] == 9_000
    # لا كتابة فوق تعديل الفرع، والسعر لم يتغير
    item = next(i for i in br["C"].get("/v1/catalog/pull").json()["items"] if i["gid"] == gid)
    assert item["data"]["sale_price"] == 9_000 and item["data"]["name"] == "زيت عباد 1 لتر"
    # بعد التحديث بالنسخة الحالية: ينجح
    assert price(client, owner, gid, version=2, sale_price=10_000, wholesale_price=None).status_code == 200


def test_same_validation_as_desktop(client, cat):
    _, owner, _, gid = cat
    r = price(client, owner, gid, version=1, sale_price=9_000, wholesale_price=9_000)
    assert r.status_code == 400 and r.json()["error"]["code"] == "wholesale_not_lower"
    assert price(client, owner, gid, version=1, sale_price=0, wholesale_price=None).status_code == 422  # سعر البيع > 0
    assert price(client, owner, gid, version=1, sale_price=-5, wholesale_price=None).status_code == 422
    # إلغاء سعر الجملة يمسح حده الأدنى (نفس البرنامج)
    out = price(client, owner, gid, version=1, sale_price=9_000, wholesale_price=None).json()
    assert out["wholesale_price"] is None and out["wholesale_min_qty"] is None


def test_owner_only_and_scope(client, cat):
    br, owner, mgr, gid = cat
    assert search(client, mgr, "زيت").json()["error"]["code"] == "owner_only"
    r = price(client, mgr, gid, version=1, sale_price=1, wholesale_price=None)
    assert r.status_code == 403 and r.json()["error"]["code"] == "owner_only"
    assert client.get("/mobile/v1/admin/catalog/search", headers=br["A"].headers, params={"q": "زيت"}).status_code == 401
    assert price(client, owner, str(uuid.uuid4()), version=1, sale_price=1_000, wholesale_price=None).status_code == 404
    # صنف محذوف
    br["A"].post("/v1/catalog/push", json={"items": [{"kind": "product", "gid": gid, "data": PRODUCT, "deleted": True}]})
    assert price(client, owner, gid, version=2, sale_price=1_000, wholesale_price=None).status_code == 404
    assert search(client, owner, "زيت").json() == []
