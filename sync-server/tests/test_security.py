"""الأمان: ربط الأجهزة، إلغاء التوكنات فوراً، حد المحاولات، قيود الإدارة، خصوصية الأحداث، السجل الأمني."""

from datetime import timedelta

from app import ratelimit
from app.config import get_settings
from app.db import get_sessionmaker, utcnow
from app.models import PairingCode
from tests.conftest import BranchClient, admin, event


def _pair_code(client, branch_id: str) -> str:  # noqa: ANN001
    r = admin(client, "POST", f"/v1/admin/branches/{branch_id}/pairing-code")
    assert r.status_code == 200, r.text
    code = r.json()["code"]
    assert len(code) == 14 and code.count("-") == 2  # XXXX-XXXX-XXXX
    return code


def test_pairing_flow_and_old_device_revoked(client, shop):
    _, b = shop
    old = b["A"]
    code = _pair_code(client, old.id)

    # يقبل الكود بحروف صغيرة وبدون شرط
    r = client.post("/v1/auth/pair", json={"code": code.lower().replace("-", "")})
    assert r.status_code == 200, r.text
    creds = r.json()
    assert creds["branch_id"] == old.id and creds["branch_code"] == "A" and creds["secret"]

    # الجهاز القديم: توكنه وسرّه توقفوا فوراً
    r = old.get("/v1/sync/status")
    assert r.status_code == 401 and r.json()["error"]["code"] == "token_revoked"
    new = BranchClient(client, creds["branch_id"], creds["secret"])
    assert new.get("/v1/sync/status").status_code == 200

    # مرة واحدة فقط
    r = client.post("/v1/auth/pair", json={"code": code})
    assert r.status_code == 400 and r.json()["error"]["code"] == "pairing_invalid"


def test_pairing_expired_wrong_and_replaced(client, shop):
    _, b = shop
    code = _pair_code(client, b["B"].id)
    with get_sessionmaker()() as s:
        row = s.query(PairingCode).one()
        row.expires_at = utcnow() - timedelta(seconds=1)
        s.commit()
    assert client.post("/v1/auth/pair", json={"code": code}).json()["error"]["code"] == "pairing_invalid"

    assert client.post("/v1/auth/pair", json={"code": "AAAA-BBBB-CCCC"}).status_code == 400

    first = _pair_code(client, b["B"].id)
    second = _pair_code(client, b["B"].id)  # الجديد يلغي القديم
    assert client.post("/v1/auth/pair", json={"code": first}).status_code == 400
    assert client.post("/v1/auth/pair", json={"code": second}).status_code == 200


def test_pairing_disabled_branch(client, shop):
    _, b = shop
    code = _pair_code(client, b["C"].id)
    admin(client, "PATCH", f"/v1/admin/branches/{b['C'].id}", json={"is_active": False})
    assert client.post("/v1/auth/pair", json={"code": code}).status_code == 400
    r = admin(client, "POST", f"/v1/admin/branches/{b['C'].id}/pairing-code")
    assert r.json()["error"]["code"] == "branch_disabled"


def test_rotate_secret_revokes_tokens_immediately(client, shop):
    _, b = shop
    admin(client, "POST", f"/v1/admin/branches/{b['A'].id}/rotate-secret")
    r = b["A"].get("/v1/branches")
    assert r.status_code == 401 and r.json()["error"]["code"] == "token_revoked"


def test_shop_disable_blocks_all_branches(client, shop):
    s, b = shop
    admin(client, "PATCH", f"/v1/admin/shops/{s['id']}", json={"is_active": False})
    for br in b.values():
        r = br.get("/v1/sync/status")
        assert r.status_code == 403 and r.json()["error"]["code"] == "shop_disabled"


def test_auth_rate_limit(client, shop, monkeypatch):
    _, b = shop
    monkeypatch.setattr(get_settings(), "auth_rate_per_min", 3)
    monkeypatch.setattr(ratelimit, "_auth_window", ratelimit._Window())
    body = {"branch_id": b["A"].id, "secret": "w" * 40}
    codes = [client.post("/v1/auth/token", json=body).status_code for _ in range(4)]
    assert codes == [401, 401, 401, 429]
    r = client.post("/v1/auth/pair", json={"code": "AAAA-BBBB-CCCC"})
    assert r.status_code == 429 and r.json()["error"]["details"]["retry_after"] > 0


def test_admin_ip_allowlist(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "admin_allowed_ips", ["10.0.0.1"])
    r = admin(client, "GET", "/v1/admin/shops")
    assert r.status_code == 403 and r.json()["error"]["code"] == "admin_ip_denied"
    monkeypatch.setattr(get_settings(), "admin_allowed_ips", ["testclient"])
    assert admin(client, "GET", "/v1/admin/shops").status_code == 200


def test_payload_too_large(client, shop, monkeypatch):
    _, b = shop
    monkeypatch.setattr(get_settings(), "max_body_bytes", 10_000)
    big = event(blob="x" * 20_000)
    r = b["A"].post("/v1/sync/push", json={"events": [big]})
    assert r.status_code == 413 and r.json()["error"]["code"] == "payload_too_large"


def test_targeted_events_are_private(client, shop):
    _, b = shop
    to_b = event(note="لفرع مدينة نصر فقط") | {"target_branch_id": b["B"].id}
    r = b["A"].post("/v1/sync/push", json={"events": [to_b, event(note="للكل")]})
    assert r.json()["accepted"] == 2

    seen_b = [e["payload"]["note"] for e in b["B"].get("/v1/sync/pull").json()["events"]]
    seen_c = b["C"].get("/v1/sync/pull").json()
    assert seen_b == ["لفرع مدينة نصر فقط", "للكل"]
    assert [e["payload"]["note"] for e in seen_c["events"]] == ["للكل"]
    assert seen_c["next_after"] == 2  # المؤشر تخطّى الحدث الخاص

    own = b["A"].get("/v1/sync/pull", params={"include_own": True}).json()["events"]
    assert len(own) == 2  # المرسل يرى أحداثه كلها

    # استهداف نفسك أو فرع محل آخر مرفوض
    self_target = event() | {"target_branch_id": b["A"].id}
    r = b["A"].post("/v1/sync/push", json={"events": [self_target]})
    assert r.json()["error"]["code"] == "event_bad_target"
    other = admin(client, "POST", "/v1/admin/shops", json={"name": "محل تاني"}).json()
    creds = admin(
        client, "POST", f"/v1/admin/shops/{other['id']}/branches", json={"name": "فرع", "code": "X"}
    ).json()
    r = b["A"].post("/v1/sync/push", json={"events": [event() | {"target_branch_id": creds["branch_id"]}]})
    assert r.json()["error"]["code"] == "event_bad_target"


def test_branch_directory(client, shop):
    _, b = shop
    rows = b["A"].get("/v1/branches").json()
    assert [r["code"] for r in rows] == ["A", "B", "C"]
    me = next(r for r in rows if r["is_me"])
    assert me["code"] == "A" and me["online"] is True
    assert all("secret" not in str(r) and "hash" not in str(r) for r in rows)


def test_audit_log_records_without_secrets(client, shop):
    _, b = shop
    client.post("/v1/auth/token", json={"branch_id": b["A"].id, "secret": "w" * 40})
    rows = admin(client, "GET", "/v1/admin/audit").json()
    actions = [r["action"] for r in rows]
    assert "login_failed" in actions and "branch_created" in actions and "shop_created" in actions
    failed = next(r for r in rows if r["action"] == "login_failed")
    assert failed["branch_id"] == b["A"].id and failed["ip"]
    assert "w" * 40 not in str(rows)


def test_errors_never_leak_internals(client, shop, monkeypatch):
    _, b = shop
    from app.services import transfers

    def boom(*_a, **_k):  # noqa: ANN002, ANN003
        raise RuntimeError("SELECT secret FROM branches")

    monkeypatch.setattr(transfers, "list_for", boom)
    r = b["A"].get("/v1/transfers")
    assert r.status_code == 500 and r.json()["error"]["code"] == "server_error"
    assert "SELECT" not in r.text
