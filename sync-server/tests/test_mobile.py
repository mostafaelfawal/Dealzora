"""تطبيق الهاتف (المرحلة 1): الدخول، الجلسات، الصلاحيات، فرض خطة «سلسلة»، وفصل توكنات الهاتف عن الفروع."""

import uuid
from datetime import timedelta

import pytest
from argon2 import PasswordHasher

from tests.conftest import admin

# تجزئة حقيقية بمعاملات خفيفة (الاختبارات أسرع)، والتحقق يقرأ المعاملات من التجزئة نفسها.
_fast = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1)
OWNER_PW = "كلمة سر المالك 1"
MGR_PW = "manager-pass"


def hashed(pw: str) -> str:
    return _fast.hash(pw)


def db():
    from app.db import get_sessionmaker

    return get_sessionmaker()()


def push_user(branch, kind: str, username: str, pw: str, **data):
    gid = str(uuid.uuid4())
    [res] = branch.post("/v1/catalog/push", json={"items": [
        {"kind": kind, "gid": gid, "data": {"username": username, "password_hash": hashed(pw), **data}},
    ]}).json()  # fmt: skip
    assert res["status"] == "ok", res
    return gid


@pytest.fixture
def chain(client, shop):
    """محل (A, B, C) بحساب مالك، ومدير لفرع B، وكاشير لفرع C."""
    s, br = shop
    push_user(br["A"], "owner", "owner", OWNER_PW)
    push_user(br["B"], "staff", "b.mgr", MGR_PW, role="manager", branches=[br["B"].id])
    push_user(br["C"], "staff", "c.cash", "cash-pass", role="cashier", branches=[br["C"].id])
    return s, br


def new_code(branch) -> str:
    r = branch.post("/v1/shop/mobile-code")
    assert r.status_code == 201, r.text
    return r.json()["code"]


def login(client, code: str, username: str, pw: str, device: str = "phone-0001", **kw):
    return client.post("/mobile/v1/auth/login", json={
        "code": code, "username": username, "password": pw, "device_id": device,
        "device_name": "Samsung A54", "platform": "android", **kw,
    })  # fmt: skip


def bearer(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def audit_actions(client) -> list[str]:
    return [a["action"] for a in admin(client, "GET", "/v1/admin/audit").json()]


# ================= الدخول =================
def test_owner_login_sees_all_branches(client, chain):
    _, br = chain
    r = login(client, new_code(br["B"]), "Owner", OWNER_PW)  # الاسم يُطبَّع لحروف صغيرة
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["user"]["role"] == "owner" and set(t["user"]["branch_ids"]) == {br[k].id for k in "ABC"}
    assert t["refresh_token"].startswith(t["session_id"] + ".")

    me = client.get("/mobile/v1/me", headers=bearer(t))
    assert me.status_code == 200 and me.json()["username"] == "owner"
    rows = client.get("/mobile/v1/branches", headers=bearer(t)).json()
    assert {b["id"] for b in rows} == {br[k].id for k in "ABC"}
    assert all("last_seen_at" in b and "online" in b for b in rows)
    assert "mobile_login" in audit_actions(client)


def test_bad_login(client, chain):
    _, br = chain
    code = new_code(br["A"])
    r = login(client, code, "owner", "wrong")
    assert r.status_code == 401 and r.json()["error"]["code"] == "bad_credentials"
    r = login(client, code, "nobody", OWNER_PW)  # نفس الرد لمستخدم غير موجود
    assert r.status_code == 401 and r.json()["error"]["code"] == "bad_credentials"
    r = login(client, "AAAA-BBBB-CCCC", "owner", OWNER_PW)
    assert r.status_code == 400 and r.json()["error"]["code"] == "mobile_code_invalid"
    # الكاشير لا يدخل التطبيق
    r = login(client, code, "c.cash", "cash-pass")
    assert r.status_code == 403 and r.json()["error"]["code"] == "mobile_role_denied"
    # الكود يعمل بعد الفشل (لم يتجاوز الحد)، ثم لا يتكرر استخدامه
    assert login(client, code, "owner", OWNER_PW).status_code == 200
    r = login(client, code, "owner", OWNER_PW, device="phone-0002")
    assert r.json()["error"]["code"] == "mobile_code_invalid"

    log = admin(client, "GET", "/v1/admin/audit").json()
    failed = [a for a in log if a["action"] == "mobile_login_failed"]
    assert len(failed) >= 4
    # لا كلمة مرور ولا كود ولا توكن في السجل الأمني
    blob = str(log)
    assert OWNER_PW not in blob and "wrong" not in blob and code not in blob


def test_code_burned_after_max_attempts(client, chain):
    _, br = chain
    code = new_code(br["A"])
    for _ in range(5):
        assert login(client, code, "owner", "wrong").status_code == 401
    r = login(client, code, "owner", OWNER_PW)
    assert r.json()["error"]["code"] == "mobile_code_invalid"


def test_expired_code(client, chain):
    from app.models import MobileCode

    _, br = chain
    code = new_code(br["A"])
    with db() as s:
        row = s.query(MobileCode).one()
        row.expires_at = row.created_at - timedelta(minutes=1)
        s.commit()
    assert login(client, code, "owner", OWNER_PW).json()["error"]["code"] == "mobile_code_invalid"


def test_login_rate_limited(client, chain, monkeypatch):
    from app import ratelimit
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "auth_rate_per_min", 3)
    ratelimit._auth_window = ratelimit._Window()
    codes = [login(client, "AAAA-BBBB-CCCC", "owner", "x").status_code for _ in range(4)]
    assert codes[:3] == [400, 400, 400] and codes[3] == 429


# ================= التوكنات والجلسات =================
def test_access_expiry_and_refresh_rotation(client, chain):
    import jwt

    from app.config import get_settings
    from app.mobile_security import _key

    _, br = chain
    t = login(client, new_code(br["A"]), "owner", OWNER_PW).json()

    # توكن منتهي (نفس المفتاح، exp في الماضي)
    claims = jwt.decode(t["access_token"], options={"verify_signature": False})
    claims["exp"] = claims["iat"] - 1
    expired = jwt.encode(claims, _key(get_settings().jwt_secret), algorithm="HS256")
    r = client.get("/mobile/v1/me", headers={"Authorization": f"Bearer {expired}"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "token_expired"

    # التجديد يعطي زوجاً جديداً، والـ refresh القديم لو رجع يلغي الجلسة كلها
    r = client.post("/mobile/v1/auth/refresh", json={"refresh_token": t["refresh_token"]})
    assert r.status_code == 200, r.text
    t2 = r.json()
    assert t2["refresh_token"] != t["refresh_token"] and t2["session_id"] == t["session_id"]
    assert client.get("/mobile/v1/me", headers=bearer(t2)).status_code == 200

    r = client.post("/mobile/v1/auth/refresh", json={"refresh_token": t["refresh_token"]})
    assert r.status_code == 401 and r.json()["error"]["code"] == "refresh_invalid"
    r = client.get("/mobile/v1/me", headers=bearer(t2))
    assert r.status_code == 401 and r.json()["error"]["code"] == "session_revoked"
    assert client.post("/mobile/v1/auth/refresh", json={"refresh_token": t2["refresh_token"]}).status_code == 401
    assert "mobile_refresh_reuse" in audit_actions(client)


def test_refresh_expired(client, chain):
    from app.models import MobileSession

    _, br = chain
    t = login(client, new_code(br["A"]), "owner", OWNER_PW).json()
    with db() as s:
        ms = s.get(MobileSession, t["session_id"])
        ms.refresh_expires_at = ms.created_at - timedelta(seconds=1)
        s.commit()
    r = client.post("/mobile/v1/auth/refresh", json={"refresh_token": t["refresh_token"]})
    assert r.status_code == 401 and r.json()["error"]["code"] == "refresh_expired"


def test_logout_and_logout_all(client, chain):
    _, br = chain
    p1 = login(client, new_code(br["A"]), "owner", OWNER_PW, device="phone-0001").json()
    p2 = login(client, new_code(br["A"]), "owner", OWNER_PW, device="phone-0002").json()
    p3 = login(client, new_code(br["A"]), "owner", OWNER_PW, device="phone-0003").json()
    mgr = login(client, new_code(br["B"]), "b.mgr", MGR_PW).json()

    devices = client.get("/mobile/v1/sessions", headers=bearer(p1)).json()
    assert len(devices) == 3 and [d["is_current"] for d in devices] == [True, False, False]

    # خروج هذا الهاتف فقط
    assert client.post("/mobile/v1/auth/logout", headers=bearer(p1)).status_code == 204
    r = client.get("/mobile/v1/me", headers=bearer(p1))
    assert r.status_code == 401 and r.json()["error"]["code"] == "session_revoked"
    assert client.post("/mobile/v1/auth/refresh", json={"refresh_token": p1["refresh_token"]}).status_code == 401
    assert client.get("/mobile/v1/me", headers=bearer(p2)).status_code == 200

    # الخروج من كل الأجهزة: هواتف هذا الحساب فقط، لا حسابات أخرى
    r = client.post("/mobile/v1/auth/logout-all", headers=bearer(p2))
    assert r.status_code == 200 and r.json()["revoked"] == 2
    for p in (p2, p3):
        assert client.get("/mobile/v1/me", headers=bearer(p)).status_code == 401
        assert client.post("/mobile/v1/auth/refresh", json={"refresh_token": p["refresh_token"]}).status_code == 401
    assert client.get("/mobile/v1/me", headers=bearer(mgr)).status_code == 200
    actions = audit_actions(client)
    assert "mobile_logout" in actions and "mobile_logout_all" in actions


def test_same_device_relogin_replaces_session(client, chain):
    _, br = chain
    old = login(client, new_code(br["A"]), "owner", OWNER_PW).json()
    new = login(client, new_code(br["A"]), "owner", OWNER_PW).json()
    assert client.get("/mobile/v1/me", headers=bearer(old)).status_code == 401
    assert len(client.get("/mobile/v1/sessions", headers=bearer(new)).json()) == 1


# ================= الصلاحيات =================
def test_manager_sees_only_assigned_branches(client, chain):
    _, br = chain
    t = login(client, new_code(br["B"]), "b.mgr", MGR_PW).json()
    assert t["user"]["role"] == "manager" and t["user"]["branch_ids"] == [br["B"].id]
    h = bearer(t)
    assert [b["id"] for b in client.get("/mobile/v1/branches", headers=h).json()] == [br["B"].id]
    assert client.get(f"/mobile/v1/branches/{br['B'].id}", headers=h).status_code == 200
    for other in (br["A"].id, br["C"].id, str(uuid.uuid4())):
        r = client.get(f"/mobile/v1/branches/{other}", headers=h)
        assert r.status_code == 404 and r.json()["error"]["code"] == "branch_not_found"


def test_account_change_revokes_session(client, chain):
    _, br = chain
    t = login(client, new_code(br["B"]), "b.mgr", MGR_PW).json()
    mgr_gid = t["user"]["account_id"]
    # تغيير كلمة مرور المدير من البرنامج ← جلسات الهاتف تتوقف فوراً
    [res] = br["B"].post("/v1/catalog/push", json={"items": [{
        "kind": "staff", "gid": mgr_gid, "fields": ["password_hash"],
        "data": {"username": "b.mgr", "password_hash": hashed("new-pass"), "role": "manager", "branches": [br["B"].id]},
    }]}).json()  # fmt: skip
    assert res["status"] == "ok", res
    r = client.get("/mobile/v1/me", headers=bearer(t))
    assert r.status_code == 401 and r.json()["error"]["code"] == "session_revoked"
    assert client.post("/mobile/v1/auth/refresh", json={"refresh_token": t["refresh_token"]}).status_code == 401


# ================= الخطة =================
def _set_plan(shop_id: str, plan: str | None) -> None:
    from app.models import Shop

    with db() as s:
        s.get(Shop, shop_id).license_plan = plan
        s.commit()


def test_lower_plan_rejected(client, chain):
    s, br = chain
    t = login(client, new_code(br["A"]), "owner", OWNER_PW).json()
    _set_plan(s["id"], "pro")

    # كل مسار بيانات يرفض، بخطأ واضح يعرض شاشة الترقية
    for url in ("/mobile/v1/me", "/mobile/v1/branches", "/mobile/v1/sessions"):
        r = client.get(url, headers=bearer(t))
        assert r.status_code == 403, url
        err = r.json()["error"]
        assert err["code"] == "plan_upgrade_required"
        assert err["details"] == {"current_plan": "pro", "required_plan": "enterprise"}
    r = client.post("/mobile/v1/auth/refresh", json={"refresh_token": t["refresh_token"]})
    assert r.json()["error"]["code"] == "plan_upgrade_required"
    # لا أكواد ربط جديدة، ولا دخول
    assert br["A"].post("/v1/shop/mobile-code").json()["error"]["code"] == "plan_upgrade_required"
    # تسجيل الخروج مسموح دائماً
    assert client.post("/mobile/v1/auth/logout", headers=bearer(t)).status_code == 204

    # الترقية تعيد التطبيق للعمل (دخول جديد)
    _set_plan(s["id"], "enterprise")
    code = new_code(br["A"])
    _set_plan(s["id"], "pro")
    assert login(client, code, "owner", OWNER_PW).json()["error"]["code"] == "plan_upgrade_required"
    _set_plan(s["id"], "enterprise")
    assert login(client, code, "owner", OWNER_PW).status_code == 200


def test_admin_can_issue_code(client, chain):
    s, _ = chain
    r = admin(client, "POST", f"/v1/admin/shops/{s['id']}/mobile-code")
    assert r.status_code == 201
    assert login(client, r.json()["code"], "owner", OWNER_PW).status_code == 200


# ================= فصل التوكنات =================
def test_tokens_not_interchangeable(client, chain):
    _, br = chain
    # توكن الفرع مرفوض على مسارات الهاتف
    for url in ("/mobile/v1/me", "/mobile/v1/branches"):
        r = client.get(url, headers=br["A"].headers)
        assert r.status_code == 401 and r.json()["error"]["code"] == "token_invalid"
    assert client.post("/mobile/v1/auth/logout", headers=br["A"].headers).status_code == 401
    # وتوكن الهاتف مرفوض على مسارات الفروع
    t = login(client, new_code(br["A"]), "owner", OWNER_PW).json()
    for url in ("/v1/branches", "/v1/sync/status", "/v1/stats"):
        r = client.get(url, headers=bearer(t))
        assert r.status_code == 401 and r.json()["error"]["code"] == "token_invalid", url
    # والـ refresh ليس توكن وصول
    r = client.get("/mobile/v1/me", headers={"Authorization": f"Bearer {t['refresh_token']}"})
    assert r.status_code == 401
    # بلا توكن
    assert client.get("/mobile/v1/me").status_code == 401


def test_migration_downgrade_upgrade(client):
    """0007 قابلة للتراجع وإعادة التطبيق."""
    from pathlib import Path

    from alembic.config import Config
    from sqlalchemy import inspect

    from alembic import command
    from app.db import get_engine

    root = Path(__file__).resolve().parents[1]
    cfg = Config(str(root / "alembic.ini"))
    cfg.set_main_option("script_location", str(root / "alembic"))
    command.downgrade(cfg, "0006")
    get_engine().dispose()
    tables = inspect(get_engine()).get_table_names()
    assert "mobile_sessions" not in tables and "mobile_codes" not in tables and "shops" in tables
    command.upgrade(cfg, "head")
    get_engine().dispose()
    assert {"mobile_sessions", "mobile_codes"} <= set(inspect(get_engine()).get_table_names())
