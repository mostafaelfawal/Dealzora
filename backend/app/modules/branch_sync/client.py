"""عميل HTTP لسيرفر المزامنة بين الفروع (sync-server). مكتبة بايثون القياسية فقط (لا تبعيات إضافية للـ exe).

- التوكن يُطلب بسر الفرع ويُحفظ في الذاكرة ويتجدد تلقائياً قبل انتهائه أو عند 401 token_expired.
- «السيرفر غير متاح» (شبكة/5xx/429) = مؤقت: العملية تُعاد لاحقاً.
- «بيانات الفرع لم تعد صالحة» (token_revoked/bad_credentials) = يحتاج ربطاً جديداً بكود.
- السر لا يُرسل أبداً عبر http عادي إلا لعنوان محلي (localhost أو شبكة المحل) للتجربة.
"""

import ipaddress
import json
import threading
import time
from datetime import datetime
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

from app.core.errors import AppError

TIMEOUT_SECONDS = 12
_REFRESH_BEFORE = 60  # نجدد التوكن قبل انتهائه بدقيقة


class SyncUnavailable(AppError):
    status_code = 503

    def __init__(self, detail: str = "") -> None:
        super().__init__(
            "sync_unavailable",
            "سيرفر الفروع غير متاح الآن. تأكد من الإنترنت، والعملية تُعاد تلقائياً",
            {"reason": detail[:200]} if detail else None,
        )


class SyncAuthLost(AppError):
    status_code = 409

    def __init__(self) -> None:
        super().__init__(
            "branch_unpaired",
            "بيانات ربط هذا الفرع لم تعد صالحة (تم تغييرها أو إيقافها). اربط الفرع من جديد بكود جديد",
        )


class RemoteError(AppError):
    """رد خطأ من السيرفر (رسائله عربية جاهزة للعرض)."""

    def __init__(self, status: int, code: str, message: str, details: Any = None) -> None:
        super().__init__(code, message, details if isinstance(details, dict) else None)
        self.status_code = status if 400 <= status < 500 else 502

    @property
    def transient(self) -> bool:
        return self.status_code in (429, 502)


def is_transient(exc: Exception) -> bool:
    return isinstance(exc, SyncUnavailable) or (isinstance(exc, RemoteError) and exc.transient)


def normalize_server_url(raw: str) -> str:
    """https://sync.example.com أو http://localhost:8001 (http مسموح للعناوين المحلية فقط)."""
    text = raw.strip().rstrip("/")
    if not text.startswith(("http://", "https://")):
        text = "https://" + text
    parts = urlsplit(text)
    if not parts.hostname or parts.path not in ("", "/") or parts.query or parts.username:
        raise AppError("sync_url_invalid", "عنوان السيرفر غير صحيح. مثال: https://sync.example.com")
    if parts.scheme == "http" and not _is_local(parts.hostname):
        raise AppError(
            "sync_url_insecure",
            "لازم السيرفر يكون https (الاتصال مشفّر). http مسموح فقط لتجربة على نفس الجهاز أو شبكة المحل",
        )
    return f"{parts.scheme}://{parts.netloc}"


def _is_local(host: str) -> bool:
    if host == "localhost":
        return True
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return ip.is_loopback or ip.is_private


_tokens: dict[str, tuple[str, float]] = {}
_tokens_lock = threading.Lock()


def forget_token(branch_id: str) -> None:
    with _tokens_lock:
        _tokens.pop(branch_id, None)


class SyncClient:
    def __init__(self, base_url: str, branch_id: str | None = None, secret: str | None = None) -> None:
        self.base = base_url.rstrip("/")
        self.branch_id = branch_id
        self.secret = secret

    # ---------- HTTP خام ----------
    def _raw(
        self,
        method: str,
        path: str,
        body: Any = None,
        params: dict | None = None,
        token: str | None = None,
    ) -> tuple[int, Any]:
        query = {k: v for k, v in (params or {}).items() if v is not None}
        url = f"{self.base}{path}" + (f"?{urlencode(query)}" if query else "")
        headers = {"Accept": "application/json", "User-Agent": "Dealzora-Branch/1"}
        data = None
        if body is not None:
            data = json.dumps(body, ensure_ascii=False, default=str).encode()
            headers["Content-Type"] = "application/json"
        if token:
            headers["Authorization"] = f"Bearer {token}"
        req = Request(url, data=data, method=method, headers=headers)
        try:
            with urlopen(req, timeout=TIMEOUT_SECONDS) as resp:  # noqa: S310 - العنوان مُتحقق منه
                raw = resp.read()
                return resp.status, json.loads(raw) if raw else None
        except HTTPError as exc:
            raw = exc.read()
            try:
                return exc.code, json.loads(raw) if raw else None
            except ValueError:
                return exc.code, None
        except (URLError, TimeoutError, OSError, ValueError) as exc:
            raise SyncUnavailable(str(exc)) from exc

    @staticmethod
    def _error(status: int, data: Any) -> RemoteError:
        err = (data or {}).get("error") if isinstance(data, dict) else None
        if not err:
            return RemoteError(status, f"sync_http_{status}", "سيرفر الفروع رفض الطلب")
        return RemoteError(status, err.get("code", "sync_error"), err.get("message", "خطأ من سيرفر الفروع"), err.get("details"))

    # ---------- التوكن ----------
    def _token(self, force: bool = False) -> str:
        if not self.branch_id or not self.secret:
            raise SyncAuthLost()
        now = time.time()
        with _tokens_lock:
            cached = _tokens.get(self.branch_id)
        if cached and not force and cached[1] - _REFRESH_BEFORE > now:
            return cached[0]
        status, data = self._raw(
            "POST", "/v1/auth/token", {"branch_id": self.branch_id, "secret": self.secret}
        )
        if status in (401, 403):
            code = ((data or {}).get("error") or {}).get("code")
            if code in ("shop_disabled", "branch_disabled"):
                raise self._error(status, data)
            raise SyncAuthLost()
        if status >= 400:
            raise SyncUnavailable(f"token {status}") if status >= 429 else self._error(status, data)
        token = data["access_token"]
        try:
            expires = datetime.fromisoformat(data["expires_at"]).timestamp()
        except (KeyError, TypeError, ValueError):
            expires = now + 5 * 60  # أقل مدة يسمح بها السيرفر
        with _tokens_lock:
            _tokens[self.branch_id] = (token, expires)
        return token

    # ---------- واجهة عامة ----------
    def pair(self, code: str) -> dict:
        status, data = self._raw("POST", "/v1/auth/pair", {"code": code})
        if status >= 400:
            if status >= 500:
                raise SyncUnavailable(f"pair {status}")
            raise self._error(status, data)
        return data

    def health(self) -> bool:
        try:
            status, _ = self._raw("GET", "/health")
        except SyncUnavailable:
            return False
        return status == 200

    def call(self, method: str, path: str, body: Any = None, params: dict | None = None) -> Any:
        status, data = self._raw(method, f"/v1{path}", body, params, self._token())
        if status == 401:
            code = ((data or {}).get("error") or {}).get("code")
            if code in ("token_expired", "token_invalid"):
                status, data = self._raw(method, f"/v1{path}", body, params, self._token(force=True))
            if status == 401:
                forget_token(self.branch_id or "")
                raise SyncAuthLost()
        if status >= 500 or status == 429:
            raise SyncUnavailable(f"{method} {path} {status}")
        if status >= 400:
            raise self._error(status, data)
        return data
