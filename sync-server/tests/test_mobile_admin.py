"""أمان المحل من الهاتف (المرحلة 6): للمالك فقط. الموظفون، أجهزة الفروع، وجلسات الهاتف."""

import uuid

import pytest

from tests.conftest import admin
from tests.test_mobile import MGR_PW, OWNER_PW, bearer, chain, db, login, new_code  # noqa: F401 (fixture)

ADMIN_GETS = ("/mobile/v1/admin/staff", "/mobile/v1/admin/devices", "/mobile/v1/admin/sessions")


@pytest.fixture
def sec(client, chain):  # noqa: F811
    """المعادي (A) هو الفرع الرئيسي (جهاز المالك)، ومالك ومدير مدينة نصر مسجّلان على الهاتف."""
    from app.models import Branch

    _, br = chain
    with db() as s:
        s.get(Branch, br["A"].id).is_admin = True
        s.commit()
    owner = bearer(login(client, new_code(br["A"]), "owner", OWNER_PW, device="owner-phone").json())
    mgr = bearer(login(client, new_code(br["B"]), "b.mgr", MGR_PW, device="mgr-phone").json())
    return br, owner, mgr


def staff_id(client, owner, username: str) -> str:
    return next(s["id"] for s in client.get("/mobile/v1/admin/staff", headers=owner).json() if s["username"] == username)


def audit(client) -> list[dict]:
    return admin(client, "GET", "/v1/admin/audit").json()


# ================= الصلاحيات =================
def test_manager_cannot_use_any_security_screen(client, sec):
    br, owner, mgr = sec
    sid = staff_id(client, owner, "c.cash")
    sessions = client.get("/mobile/v1/admin/sessions", headers=owner).json()
    calls = [
        *[("GET", url) for url in ADMIN_GETS],
        ("POST", f"/mobile/v1/admin/staff/{sid}/deactivate"),
        ("POST", f"/mobile/v1/admin/staff/{sid}/activate"),
        ("POST", f"/mobile/v1/admin/devices/{br['C'].id}/revoke"),
        ("POST", f"/mobile/v1/admin/devices/{br['C'].id}/pairing-code"),
        ("POST", f"/mobile/v1/admin/sessions/{sessions[0]['id']}/revoke"),
    ]
    for method, url in calls:
        r = client.request(method, url, headers=mgr)
        assert r.status_code == 403 and r.json()["error"]["code"] == "owner_only", (method, url)
    # ولا شيء تغيّر
    assert all(s["is_active"] for s in client.get("/mobile/v1/admin/staff", headers=owner).json())
    assert br["C"].get("/v1/sync/status").status_code == 200
    # توكن الفرع لا يصلح لهذه المسارات
    for url in ADMIN_GETS:
        assert client.get(url, headers=br["A"].headers).status_code == 401


def test_owner_lists_staff_without_secrets(client, sec):
    br, owner, _ = sec
    rows = client.get("/mobile/v1/admin/staff", headers=owner).json()
    assert {r["username"] for r in rows} == {"b.mgr", "c.cash"}
    mgr = next(r for r in rows if r["username"] == "b.mgr")
    assert mgr["role"] == "manager" and mgr["branches"] == [{"id": br["B"].id, "name": "مدينة نصر"}]
    assert "password_hash" not in str(rows)


# ================= إيقاف موظف =================
def test_deactivated_staff_reaches_branch_via_sync(client, sec):
    br, owner, _ = sec
    sid = staff_id(client, owner, "c.cash")
    after = br["C"].get("/v1/catalog/pull").json()["last_seq"]

    r = client.post(f"/mobile/v1/admin/staff/{sid}/deactivate", headers=owner)
    assert r.status_code == 200 and r.json()["is_active"] is False
    # جهاز الدقي يسحب التغيير مع مزامنته العادية (والبرنامج يوقف الحساب ويقفل جلساته)
    items = br["C"].get("/v1/catalog/pull", params={"after": after}).json()["items"]
    cash = next(i for i in items if i["gid"] == sid)
    assert cash["data"]["is_active"] is False and cash["data"]["username"] == "c.cash"

    # تكرار الإيقاف لا يغيّر شيئاً (لا seq جديد)
    seq = br["C"].get("/v1/catalog/pull").json()["last_seq"]
    client.post(f"/mobile/v1/admin/staff/{sid}/deactivate", headers=owner)
    assert br["C"].get("/v1/catalog/pull").json()["last_seq"] == seq

    entry = next(a for a in audit(client) if a["action"] == "staff_updated")
    assert entry["actor"] == "mobile" and entry["details"]["from_phone"] is True
    assert entry["details"]["username"] == "owner" and entry["details"]["is_active"] is False

    # إعادة التفعيل بنفس المسار
    assert client.post(f"/mobile/v1/admin/staff/{sid}/activate", headers=owner).json()["is_active"] is True


def test_deactivating_manager_stops_his_phone_at_once(client, sec):
    _, owner, mgr = sec
    assert client.get("/mobile/v1/me", headers=mgr).status_code == 200
    client.post(f"/mobile/v1/admin/staff/{staff_id(client, owner, 'b.mgr')}/deactivate", headers=owner)
    r = client.get("/mobile/v1/me", headers=mgr)
    assert r.status_code == 401 and r.json()["error"]["code"] == "session_revoked"


def test_unknown_staff_and_shop_without_main_device(client, sec):
    from app.models import Branch

    br, owner, _ = sec
    r = client.post(f"/mobile/v1/admin/staff/{uuid.uuid4()}/deactivate", headers=owner)
    assert r.status_code == 404
    with db() as s:
        s.get(Branch, br["A"].id).is_admin = False
        s.commit()
    r = client.get("/mobile/v1/admin/staff", headers=owner)
    assert r.status_code == 400 and r.json()["error"]["code"] == "no_main_branch"


# ================= أجهزة الفروع =================
def test_revoked_device_stops_immediately_and_can_repair(client, sec):
    from tests.conftest import BranchClient

    br, owner, _ = sec
    devices = {d["id"]: d for d in client.get("/mobile/v1/admin/devices", headers=owner).json()}
    assert devices[br["B"].id]["paired"] is True and devices[br["A"].id]["is_admin"] is True

    r = client.post(f"/mobile/v1/admin/devices/{br['B'].id}/revoke", headers=owner)
    assert r.status_code == 200 and r.json()["paired"] is False
    # التوكن الساري للجهاز المسروق يتوقف فوراً
    r = br["B"].get("/v1/sync/status")
    assert r.status_code == 401 and r.json()["error"]["code"] == "token_revoked"
    entry = next(a for a in audit(client) if a["action"] == "device_revoked")
    assert entry["actor"] == "mobile" and entry["branch_id"] == br["B"].id and entry["details"]["from_phone"]

    # كود ربط لجهاز جديد
    code = client.post(f"/mobile/v1/admin/devices/{br['B'].id}/pairing-code", headers=owner)
    assert code.status_code == 200, code.text
    creds = client.post("/v1/auth/pair", json={"code": code.json()["code"]}).json()
    assert BranchClient(client, creds["branch_id"], creds["secret"]).get("/v1/sync/status").status_code == 200
    assert any(a["action"] == "pairing_code_created" and a["actor"] == "mobile" for a in audit(client))


def test_main_device_rules(client, sec):
    br, owner, _ = sec
    # لا كود ربط للجهاز الرئيسي (يُسترجع بالترخيص)، كما في البرنامج
    r = client.post(f"/mobile/v1/admin/devices/{br['A'].id}/pairing-code", headers=owner)
    assert r.status_code == 400 and r.json()["error"]["code"] == "main_branch_pairing"
    # لكن الجهاز الرئيسي المسروق يُلغى من الهاتف
    assert client.post(f"/mobile/v1/admin/devices/{br['A'].id}/revoke", headers=owner).status_code == 200
    assert br["A"].get("/v1/shop").json()["error"]["code"] == "token_revoked"
    entry = next(a for a in audit(client) if a["action"] == "device_revoked")
    assert entry["details"]["main_device"] is True
    # فرع من محل آخر غير موجود
    assert client.post(f"/mobile/v1/admin/devices/{uuid.uuid4()}/revoke", headers=owner).status_code == 404


# ================= جلسات تطبيق الهاتف =================
def test_owner_sees_and_revokes_any_phone_session(client, sec):
    _, owner, mgr = sec
    rows = client.get("/mobile/v1/admin/sessions", headers=owner).json()
    assert {(r["username"], r["is_current"]) for r in rows} == {("owner", True), ("b.mgr", False)}
    target = next(r for r in rows if r["username"] == "b.mgr")
    assert client.post(f"/mobile/v1/admin/sessions/{target['id']}/revoke", headers=owner).status_code == 204
    r = client.get("/mobile/v1/me", headers=mgr)
    assert r.status_code == 401 and r.json()["error"]["code"] == "session_revoked"
    assert [r["username"] for r in client.get("/mobile/v1/admin/sessions", headers=owner).json()] == ["owner"]
    entry = next(a for a in audit(client) if a["action"] == "mobile_session_revoked" and a["actor"] == "mobile")
    assert entry["details"]["target_user"] == "b.mgr" and entry["details"]["from_phone"]
    assert client.post(f"/mobile/v1/admin/sessions/{uuid.uuid4()}/revoke", headers=owner).status_code == 404
