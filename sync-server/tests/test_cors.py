"""CORS لنسخة الويب من تطبيق الهاتف: النطاق المسموح فقط، وبلا إعداد = لا CORS إطلاقاً."""

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app

ORIGIN = "https://app.example.com"


def _client(monkeypatch, origins: str) -> TestClient:
    monkeypatch.setenv("SYNC_CORS_ORIGINS", origins)
    get_settings.cache_clear()
    try:
        return TestClient(create_app())
    finally:
        get_settings.cache_clear()


def _preflight(client: TestClient, origin: str):
    return client.options(
        "/mobile/v1/me",
        headers={"Origin": origin, "Access-Control-Request-Method": "GET",
                 "Access-Control-Request-Headers": "authorization"},
    )  # fmt: skip


def test_allowed_origin(monkeypatch):
    r = _preflight(_client(monkeypatch, f"{ORIGIN}/"), ORIGIN)
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == ORIGIN
    assert "access-control-allow-credentials" not in r.headers


def test_other_origin_and_disabled(monkeypatch):
    assert "access-control-allow-origin" not in _preflight(_client(monkeypatch, ORIGIN), "https://evil.example").headers
    assert "access-control-allow-origin" not in _preflight(_client(monkeypatch, ""), ORIGIN).headers
