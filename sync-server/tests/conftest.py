"""كل اختبار على قاعدة SQLite جديدة، مبنية بنفس الـ migrations اللي هتشتغل في الإنتاج."""

import os
import uuid
from pathlib import Path

import pytest

ADMIN = "a" * 40
os.environ.update(
    SYNC_JWT_SECRET="j" * 40,
    SYNC_ADMIN_TOKEN=ADMIN,
    SYNC_STREAM_POLL_SECONDS="0.05",
    SYNC_STREAM_MAX_SECONDS="0.5",
    SYNC_MAX_PUSH_EVENTS="50",
    # الاختبارات كلها من نفس «IP»: حد عالٍ هنا، واختبار الحد نفسه يخفّضه مؤقتاً.
    SYNC_AUTH_RATE_PER_MIN="100000",
)


@pytest.fixture
def client(tmp_path: Path):
    os.environ["SYNC_DATABASE_URL"] = f"sqlite:///{tmp_path / 'sync.db'}"
    from app.config import get_settings
    from app.db import get_engine, get_sessionmaker

    for cached in (get_settings, get_engine, get_sessionmaker):
        cached.cache_clear()

    from alembic import command
    from alembic.config import Config

    root = Path(__file__).resolve().parents[1]
    cfg = Config(str(root / "alembic.ini"))
    cfg.set_main_option("script_location", str(root / "alembic"))
    command.upgrade(cfg, "head")

    from fastapi.testclient import TestClient

    from app.main import create_app

    from app import ratelimit

    ratelimit._auth_window = ratelimit._Window()
    with TestClient(create_app()) as c:
        yield c
    get_engine().dispose()


def admin(client, method: str, url: str, **kw):  # noqa: ANN001
    return client.request(method, url, headers={"Authorization": f"Bearer {ADMIN}"}, **kw)


class BranchClient:
    """فرع مسجّل دخوله: يرسل الطلبات بتوكنه."""

    def __init__(self, client, branch_id: str, secret: str) -> None:  # noqa: ANN001
        self.c = client
        self.id = branch_id
        r = client.post("/v1/auth/token", json={"branch_id": branch_id, "secret": secret})
        assert r.status_code == 200, r.text
        self.headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

    def get(self, url: str, **kw):
        return self.c.get(url, headers=self.headers, **kw)

    def post(self, url: str, **kw):
        return self.c.post(url, headers=self.headers, **kw)

    def put(self, url: str, **kw):
        return self.c.put(url, headers=self.headers, **kw)


@pytest.fixture
def shop(client):
    """محل بثلاث فروع (A, B, C) جاهزة."""
    s = admin(client, "POST", "/v1/admin/shops", json={"name": "سوبر ماركت النور"}).json()
    branches = {}
    for code, name in (("A", "المعادي"), ("B", "مدينة نصر"), ("C", "الدقي")):
        r = admin(client, "POST", f"/v1/admin/shops/{s['id']}/branches", json={"name": name, "code": code})
        assert r.status_code == 201, r.text
        creds = r.json()
        branches[code] = BranchClient(client, creds["branch_id"], creds["secret"])
    return s, branches


def event(entity: str = "sale", **payload) -> dict:  # noqa: ANN003
    return {
        "id": str(uuid.uuid4()),
        "entity": entity,
        "entity_id": str(uuid.uuid4()),
        "op": "upsert",
        "payload": payload or {"total": 100},
    }
