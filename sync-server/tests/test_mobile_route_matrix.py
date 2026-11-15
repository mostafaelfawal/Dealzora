"""مصفوفة صلاحيات كل مسارات الهاتف (مراجعة ما قبل الإطلاق). تمر على كل مسار /mobile/v1 تلقائياً، فمسار جديد
يُضاف بلا حماية يُكسر هذا الاختبار:
  - بلا توكن، أو بتوكن فرع ← 401 (عدا الدخول والتجديد)
  - المدير على مسارات /admin ← 403 owner_only
  - محل بخطة أقل ← 403 plan_upgrade_required (عدا الدخول والتجديد والخروج وحذف push token)
"""

import re

import pytest
from fastapi.routing import APIRoute

from tests.test_mobile import MGR_PW, OWNER_PW, bearer, chain, db, login, new_code  # noqa: F401 (fixture)

PUBLIC = {"/mobile/v1/auth/login", "/mobile/v1/auth/refresh"}
# تعمل بجلسة سارية حتى لو نزلت الخطة (الخروج مسموح دائماً).
SESSION_ONLY = {"/mobile/v1/auth/logout", "/mobile/v1/auth/logout-all", "/mobile/v1/push-token:DELETE"}
FAKE_ID = "00000000-0000-4000-8000-000000000000"


def _flatten(routes, prefix: str = "") -> list[tuple[str, APIRoute]]:
    """FastAPI الحديث يحتفظ بالـ routers المضمَّنة كما هي (_IncludedRouter): نفكّها مع البادئة."""
    out = []
    for r in routes:
        if isinstance(r, APIRoute):
            out.append((prefix + r.path, r))
        elif hasattr(r, "original_router") and hasattr(r, "include_context"):
            out += _flatten(r.original_router.routes, prefix + (r.include_context.prefix or ""))
    return out


def mobile_routes(client) -> list[tuple[str, str]]:
    out = []
    for full, r in _flatten(client.app.routes):
        if full.startswith("/mobile/v1"):
            path = re.sub(r"\{[^}]+\}", FAKE_ID, full)
            out += [(m, path) for m in sorted(r.methods - {"HEAD", "OPTIONS"})]
    return out


def call(client, method, path, headers=None):
    return client.request(method, path, headers=headers or {}, params={"date_from": "2026-11-16", "date_to": "2026-11-16"},
                          json={} if method in ("POST", "PUT") else None)  # fmt: skip


@pytest.fixture
def who(client, chain):  # noqa: F811
    _, br = chain
    owner = bearer(login(client, new_code(br["A"]), "owner", OWNER_PW).json())
    mgr = bearer(login(client, new_code(br["B"]), "b.mgr", MGR_PW).json())
    return br, owner, mgr


def test_every_mobile_route_requires_mobile_token(client, who):
    br, _, _ = who
    routes = mobile_routes(client)
    assert len(routes) >= 30  # المصفوفة تغطي كل المسارات فعلاً
    for method, path in routes:
        if path in PUBLIC:
            continue
        r = call(client, method, path)
        assert r.status_code == 401, (method, path, r.status_code)
        r = call(client, method, path, br["A"].headers)  # توكن فرع
        assert r.status_code == 401, (method, path, r.status_code)


def test_admin_routes_are_owner_only(client, who):
    _, owner, mgr = who
    admin_routes = [(m, p) for m, p in mobile_routes(client) if p.startswith("/mobile/v1/admin/")]
    assert len(admin_routes) >= 10
    for method, path in admin_routes:
        r = call(client, method, path, mgr)
        assert r.status_code == 403 and r.json()["error"]["code"] == "owner_only", (method, path, r.status_code)
        assert call(client, method, path, owner).status_code != 403, (method, path)


def test_lower_plan_blocks_everything_but_signing_out(client, who):
    from app.models import Shop

    _, owner, _ = who
    with db() as s:
        s.query(Shop).one().license_plan = "pro"
        s.commit()
    for method, path in mobile_routes(client):
        if path in PUBLIC or path in SESSION_ONLY or f"{path}:{method}" in SESSION_ONLY:
            continue
        r = call(client, method, path, owner)
        assert r.status_code == 403 and r.json()["error"]["code"] == "plan_upgrade_required", (method, path, r.status_code)
    assert client.delete("/mobile/v1/push-token", headers=owner).status_code == 204
    assert client.post("/mobile/v1/auth/logout", headers=owner).status_code == 204
