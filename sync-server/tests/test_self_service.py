"""التسجيل الذاتي بالترخيص وإدارة المالك لفروعه (بدون المورّد)."""

import base64
import json
import time
import uuid

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from tests.conftest import BranchClient, admin


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


VENDOR = Ed25519PrivateKey.generate()


def license_key(signer=VENDOR, *, plan="enterprise", days=365, license_id=None, **extra):  # noqa: ANN001, ANN003, ANN201
    payload = {"license_id": license_id or str(uuid.uuid4()), "machine_id": "m" * 64,
               "shop_name": "سوبر ماركت النور", "expires_at": int(time.time()) + days * 86400,
               "terminals": 2, **({"plan": plan} if plan else {}), **extra}  # fmt: skip
    body = b64(json.dumps(payload).encode())
    return f"{body}.{b64(signer.sign(body.encode()))}", payload


@pytest.fixture
def vendor(client, monkeypatch):  # noqa: ANN001, ANN201
    from app.config import get_settings

    pub = VENDOR.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
    monkeypatch.setattr(get_settings(), "vendor_pubkey", b64(pub))
    return client


def register(client, key, **kw):  # noqa: ANN001, ANN003, ANN201
    return client.post("/v1/shops/register", json={"license_key": key, **kw})


def as_branch(client, creds):  # noqa: ANN001, ANN201
    return BranchClient(client, creds["branch_id"], creds["secret"])


def test_disabled_without_vendor_key(client):
    key, _ = license_key()
    r = register(client, key)
    assert r.status_code == 403 and r.json()["error"]["code"] == "self_register_disabled"


def test_owner_registers_and_manages_branches(vendor):
    key, lic = license_key()
    r = register(vendor, key, branch_name="المعادي", branch_code="ma")
    assert r.status_code == 201, r.text
    creds = r.json()
    assert creds["shop_name"] == "سوبر ماركت النور" and creds["branch_code"] == "MA"
    owner = as_branch(vendor, creds)

    info = owner.get("/v1/shop").json()
    assert info["is_admin"] and info["license_plan"] == "enterprise" and info["branches"] == 1

    # فرع جديد + كود ربط فوراً، والجهاز يربط بالكود (نفس مسار الربط القديم)
    r = owner.post("/v1/shop/branches", json={"name": "مدينة نصر", "code": "nc"})
    assert r.status_code == 201, r.text
    new = r.json()
    assert new["branch"]["paired"] is False and new["pairing"]["code"]
    paired = vendor.post("/v1/auth/pair", json={"code": new["pairing"]["code"]}).json()
    nc = as_branch(vendor, paired)
    rows = {b["code"]: b for b in owner.get("/v1/shop/branches").json()}
    assert rows["NC"]["paired"] and rows["MA"]["is_me"] and rows["MA"]["is_admin"]

    # الفرع العادي لا يدير الفروع
    assert nc.get("/v1/shop/branches").status_code == 403
    assert nc.post("/v1/shop/branches", json={"name": "x2", "code": "X"}).status_code == 403

    # إيقاف/تفعيل، وإلغاء ربط الجهاز (يتوقف فوراً)
    r = vendor.patch(f"/v1/shop/branches/{paired['branch_id']}", json={"is_active": False}, headers=owner.headers)
    assert r.status_code == 200 and r.json()["is_active"] is False
    assert nc.get("/v1/branches").status_code == 403
    vendor.patch(f"/v1/shop/branches/{paired['branch_id']}", json={"is_active": True}, headers=owner.headers)
    r = owner.post(f"/v1/shop/branches/{paired['branch_id']}/revoke")
    assert r.status_code == 200 and r.json()["paired"] is False
    assert nc.get("/v1/branches").json()["error"]["code"] == "token_revoked"
    old = vendor.post("/v1/auth/token", json={"branch_id": paired["branch_id"], "secret": paired["secret"]})
    assert old.status_code == 401
    # كود جديد يربط جهازاً جديداً
    code = owner.post(f"/v1/shop/branches/{paired['branch_id']}/pairing-code").json()["code"]
    assert vendor.post("/v1/auth/pair", json={"code": code}).status_code == 200

    # الفرع الرئيسي لا يطلع كود لنفسه ولا يوقف نفسه ولا يلغي ربط نفسه
    me = creds["branch_id"]
    assert owner.post(f"/v1/shop/branches/{me}/pairing-code").json()["error"]["code"] == "self_pairing"
    assert vendor.patch(f"/v1/shop/branches/{me}", json={"is_active": False}, headers=owner.headers).status_code == 400
    assert owner.post(f"/v1/shop/branches/{me}/revoke").status_code == 400


def test_one_shop_per_license_and_recover(vendor):
    key, lic = license_key()
    first = register(vendor, key).json()
    r = register(vendor, key)
    assert r.status_code == 409 and r.json()["error"]["code"] == "shop_exists"

    # استرجاع على جهاز جديد: نفس المحل، سر جديد، والجهاز القديم يتوقف
    r = register(vendor, key, recover=True)
    assert r.status_code == 201
    again = r.json()
    assert again["shop_id"] == first["shop_id"] and again["branch_id"] == first["branch_id"]
    old = vendor.post("/v1/auth/token", json={"branch_id": first["branch_id"], "secret": first["secret"]})
    assert old.status_code == 401
    as_branch(vendor, again)

    other, _ = license_key()
    assert register(vendor, other, recover=True).json()["error"]["code"] == "shop_not_found"


def test_rejects_bad_licenses(vendor):
    forged, _ = license_key(Ed25519PrivateKey.generate())
    expired, _ = license_key(days=-1)
    pro, _ = license_key(plan="pro")
    key, _ = license_key()
    body, sig = key.split(".")
    tampered_body = b64(json.dumps({**json.loads(base64.urlsafe_b64decode(body + "==")), "plan": "enterprise",
                                    "expires_at": 4102444800}).encode())  # fmt: skip
    cases = {
        forged: "license_invalid",
        f"{tampered_body}.{sig}": "license_invalid",
        "not-a-license-key-at-all-xxxxxxxx": "license_invalid",
        expired: "license_expired",
        pro: "license_plan",
    }
    for k, code in cases.items():
        r = register(vendor, k)
        assert r.json()["error"]["code"] == code, (code, r.text)
    # ترخيص قديم بلا خطة = كل الميزات
    legacy, _ = license_key(plan=None)
    assert register(vendor, legacy).status_code == 201


def test_license_expiry_and_renewal(vendor):
    from app.db import get_sessionmaker
    from app.models import Shop

    lid = str(uuid.uuid4())
    key, _ = license_key(license_id=lid, days=30)
    creds = register(vendor, key).json()
    owner = as_branch(vendor, creds)
    with get_sessionmaker()() as s:  # الترخيص انتهى من 10 أيام (أكبر من المهلة)
        shop = s.get(Shop, creds["shop_id"])
        shop.license_expires_at = shop.license_expires_at.replace(year=2020)
        s.commit()
    r = owner.get("/v1/branches")
    assert r.status_code == 403 and r.json()["error"]["code"] == "license_expired"

    # مفتاح ترخيص آخر لا يجدد هذا المحل
    other, _ = license_key()
    assert owner.post("/v1/shop/license", json={"license_key": other}).json()["error"]["code"] == "license_mismatch"
    renewed, _ = license_key(license_id=lid, days=365)
    r = owner.post("/v1/shop/license", json={"license_key": renewed})
    assert r.status_code == 200, r.text
    assert owner.get("/v1/branches").status_code == 200


def test_legacy_admin_shop_and_branch_limit(vendor, monkeypatch, shop):
    s, b = shop  # محل أنشأه المورّد يدوياً: لا فرع رئيسي ولا انتهاء
    assert b["A"].get("/v1/shop/branches").status_code == 403
    assert b["A"].get("/v1/branches").status_code == 200
    from app.cli import main

    assert main(["make-admin", b["A"].id]) == 0
    assert b["A"].get("/v1/shop/branches").status_code == 200

    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "max_branches_per_shop", 3)
    r = b["A"].post("/v1/shop/branches", json={"name": "رابع", "code": "D"})
    assert r.json()["error"]["code"] == "branch_limit"
    assert admin(vendor, "GET", "/v1/admin/shops").status_code == 200


def test_branch_lease(vendor, monkeypatch):
    from app.config import get_settings

    owner_reg = register(vendor, license_key(days=30)[0]).json()
    owner = as_branch(vendor, owner_reg)
    assert owner.get("/v1/shop/lease").json()["error"]["code"] == "lease_disabled"

    signer = Ed25519PrivateKey.generate()
    raw = signer.private_bytes_raw() if hasattr(signer, "private_bytes_raw") else None
    monkeypatch.setattr(get_settings(), "lease_key", b64(raw))
    new = owner.post("/v1/shop/branches", json={"name": "فرع 2", "code": "B2"}).json()
    branch = as_branch(vendor, vendor.post("/v1/auth/pair", json={"code": new["pairing"]["code"]}).json())

    out = branch.get("/v1/shop/lease").json()
    body, sig = out["lease"].split(".")
    signer.public_key().verify(base64.urlsafe_b64decode(sig + "=="), body.encode())  # توقيع صحيح
    payload = json.loads(base64.urlsafe_b64decode(body + "=="))
    assert payload["plan"] == "enterprise" and payload["branch_id"] == new["branch"]["id"]
    # لا تتجاوز ترخيص المحل + المهلة، ولا عمر الشهادة
    assert payload["exp"] - payload["iat"] <= 7 * 86400 + 5


H = "$argon2id$v=19$m=65536,t=3,p=4$" + "a" * 22 + "$" + "b" * 43


def staff_item(gid_, branches, role="cashier", username="cash1", **kw):  # noqa: ANN001, ANN003, ANN201
    return {"kind": "staff", "gid": gid_, "data": {"username": username, "password_hash": H, "role": role,
            "is_active": True, "branches": branches}, **kw}  # fmt: skip


def test_central_staff_management(vendor):
    owner = as_branch(vendor, register(vendor, license_key()[0], branch_name="المعادي", branch_code="MA").json())
    me = owner.get("/v1/shop/branches").json()[0]["id"]
    nb = owner.post("/v1/shop/branches", json={"name": "مدينة نصر", "code": "NC"}).json()
    nc_id = nb["branch"]["id"]
    nc = as_branch(vendor, vendor.post("/v1/auth/pair", json={"code": nb["pairing"]["code"]}).json())

    # المالك يضيف مدير لفرع مدينة نصر، وكاشير يعمل في الفرعين
    r = owner.post("/v1/shop/staff", json={"username": "nasr.mgr", "password_hash": H, "role": "manager",
                                          "branches": [nc_id]})  # fmt: skip
    assert r.status_code == 201, r.text
    mgr = r.json()
    assert "password_hash" not in mgr
    cash = owner.post("/v1/shop/staff", json={"username": "ali", "password_hash": H, "role": "cashier",
                                             "branches": [me, nc_id]}).json()  # fmt: skip
    # مدير ثاني لنفس الفرع مرفوض، واسم مكرر مرفوض (حتى مع اسم المالك)، وفرع من محل آخر مرفوض
    r = owner.post("/v1/shop/staff", json={"username": "mgr2", "password_hash": H, "role": "manager", "branches": [nc_id]})
    assert r.json()["error"]["code"] == "manager_exists"
    r = owner.post("/v1/shop/staff", json={"username": "ali", "password_hash": H, "role": "cashier", "branches": [me]})
    assert r.json()["error"]["code"] == "username_taken"
    r = owner.post("/v1/shop/staff", json={"username": "x99", "password_hash": H, "role": "cashier",
                                          "branches": [str(uuid.uuid4())]})  # fmt: skip
    assert r.json()["error"]["code"] == "staff_bad_branch"
    # الفرع العادي لا يستخدم الإدارة المركزية
    assert nc.get("/v1/shop/staff").status_code == 403

    # الموظفون يصلون مع سحب الكتالوج (بفروعهم)
    staff = {i["data"]["username"]: i for i in nc.get("/v1/catalog/pull").json()["items"] if i["kind"] == "staff"}
    assert staff["nasr.mgr"]["data"]["branches"] == [nc_id] and set(staff["ali"]["data"]["branches"]) == {me, nc_id}

    # فرع يرفع كاشير محلي لنفسه فقط
    [r1] = nc.post("/v1/catalog/push", json={"items": [staff_item(str(uuid.uuid4()), [nc_id], username="nasr.c1")]}).json()
    assert r1["status"] == "ok"
    [r2] = nc.post("/v1/catalog/push", json={"items": [staff_item(str(uuid.uuid4()), [me], username="spy")]}).json()
    assert r2["status"] == "invalid"
    # اسم موجود في فرع آخر = تعارض (لا دمج حسابات أشخاص مختلفين)
    [r3] = nc.post("/v1/catalog/push", json={"items": [staff_item(str(uuid.uuid4()), [nc_id], username="ali")]}).json()
    assert r3["status"] == "conflict"
    # الفرع لا يغيّر فروع موظف، ولا دور/حذف موظف مشترك
    [r4] = nc.post("/v1/catalog/push", json={"items": [staff_item(cash["id"], [nc_id], username="ali",
                                                                 fields=["branches"])]}).json()  # fmt: skip
    assert r4["status"] == "ok" and set(r4["data"]["branches"]) == {me, nc_id}
    [r5] = nc.post("/v1/catalog/push", json={"items": [staff_item(cash["id"], [me, nc_id], role="manager", username="ali",
                                                                 fields=["role"])]}).json()  # fmt: skip
    assert r5["status"] == "invalid"
    [r6] = nc.post("/v1/catalog/push", json={"items": [staff_item(cash["id"], [me, nc_id], username="ali", deleted=True)]}).json()
    assert r6["status"] == "invalid"
    # لكن يقدر يغيّر كلمة سر موظف يعمل عنده
    [r7] = nc.post("/v1/catalog/push", json={"items": [{**staff_item(cash["id"], [me, nc_id], username="ali"),
               "data": {**staff_item(cash["id"], [me, nc_id], username="ali")["data"], "password_hash": H[:-1] + "c"},
               "fields": ["password_hash"]}]}).json()  # fmt: skip
    assert r7["status"] == "ok"

    # المالك ينقل المدير، ويوقف، ويحذف
    r = vendor.patch(f"/v1/shop/staff/{cash['id']}", json={"branches": [me]}, headers=owner.headers)
    assert r.status_code == 200 and r.json()["branches"] == [me]
    assert vendor.delete(f"/v1/shop/staff/{mgr['id']}", headers=owner.headers).status_code == 204
    names = {s["username"] for s in owner.get("/v1/shop/staff").json()}
    assert names == {"ali", "nasr.c1"}


def test_owner_cannot_merge_into_staff(vendor):
    owner = as_branch(vendor, register(vendor, license_key()[0]).json())
    me = owner.get("/v1/shop/branches").json()[0]["id"]
    owner.post("/v1/shop/staff", json={"username": "zed", "password_hash": H, "role": "cashier", "branches": [me]})
    [r] = owner.post("/v1/catalog/push", json={"items": [{"kind": "owner", "gid": str(uuid.uuid4()),
                     "data": {"username": "zed", "password_hash": H}}]}).json()  # fmt: skip
    assert r["status"] == "conflict"
    assert [i["kind"] for i in owner.get("/v1/catalog/pull").json()["items"]] == ["staff"]
