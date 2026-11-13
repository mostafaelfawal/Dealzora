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
