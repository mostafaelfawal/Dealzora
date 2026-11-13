from tests.conftest import ADMIN, BranchClient, admin


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_admin_requires_token(client):
    assert client.get("/v1/admin/shops").status_code == 401
    r = client.get("/v1/admin/shops", headers={"Authorization": "Bearer " + "x" * 40})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "admin_only"
    assert admin(client, "GET", "/v1/admin/shops").status_code == 200


def test_branch_code_unique_per_shop(client, shop):
    s, _ = shop
    r = admin(client, "POST", f"/v1/admin/shops/{s['id']}/branches", json={"name": "تاني", "code": "a"})
    assert r.status_code == 409  # الكود يتحول لحروف كبيرة: A موجود
    other = admin(client, "POST", "/v1/admin/shops", json={"name": "محل تاني"}).json()
    r = admin(client, "POST", f"/v1/admin/shops/{other['id']}/branches", json={"name": "فرع", "code": "A"})
    assert r.status_code == 201  # نفس الكود مسموح في محل آخر


def test_token_bad_secret_and_disabled(client, shop):
    _, b = shop
    r = client.post("/v1/auth/token", json={"branch_id": b["A"].id, "secret": "w" * 40})
    assert r.status_code == 401 and r.json()["error"]["code"] == "bad_credentials"

    admin(client, "PATCH", f"/v1/admin/branches/{b['A'].id}", json={"is_active": False})
    # التوكن الحالي يتوقف فوراً
    r = b["A"].get("/v1/sync/status")
    assert r.status_code == 403 and r.json()["error"]["code"] == "branch_disabled"


def test_rotate_secret(client, shop):
    _, b = shop
    creds = admin(client, "POST", f"/v1/admin/branches/{b['B'].id}/rotate-secret").json()
    new = BranchClient(client, creds["branch_id"], creds["secret"])
    assert new.get("/v1/sync/status").status_code == 200


def test_invalid_token(client):
    r = client.get("/v1/sync/status", headers={"Authorization": "Bearer abc"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "token_invalid"
    # توكن الإدارة ليس توكن فرع
    r = client.get("/v1/sync/status", headers={"Authorization": f"Bearer {ADMIN}"})
    assert r.status_code == 401
