"""عميل HTTP لمنظومة الإيصال الإلكتروني. مكتبة بايثون القياسية فقط (مثل branch_sync/client.py).

- المصادقة (ereceiptapi/01-authenticate-pos): POST /connect/token بـ client_credentials في الـ body
  وبيانات الجهاز في الـ headers (posserial, pososversion, posmodelframework, presharedkey).
  التوكن يُحفظ في الذاكرة لكل جهاز حتى قبل انتهائه بدقيقة («access tokens should be cached for the
  lifetime of the token»، integrationpractices)، ويتجدد تلقائياً أو عند رد 401.
- الأخطاء أربعة أنواع (الفرق بينها يحدد ما يحدث بعدها):
    EtaNetworkError   شبكة/مهلة/5xx       ← مؤقت: يُعاد لاحقاً تلقائياً
    EtaRateLimited    429 أو 422 مكرر      ← مؤقت: ننتظر أكثر من Retry-After
    EtaAuthError      بيانات الجهاز خاطئة  ← يوقف الإرسال لهذا الجهاز وينبّه
    EtaRequestError   خطأ بنية/حجم الطلب   ← لا يُعاد تلقائياً، يُعرض للمستخدم
- لا يُسجَّل في الـ logs أي توكن أو سر أو مستند: فقط الحالة والـ correlationId ورسالة مختصرة.
- طبقة النقل قابلة للاستبدال (Transport) فتُختبر بلا شبكة.
"""

import json
import logging
import socket
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.modules.eta.constants import EtaEnvironment

from .environments import (
    ENVIRONMENTS,
    RECEIPT_DETAILS_PATH,
    SUBMISSION_PATH,
    SUBMIT_PATH,
    TOKEN_PATH,
    ssl_context,
)

log = logging.getLogger(__name__)

TIMEOUT_SECONDS = 30
REFRESH_BEFORE = 60  # نجدد التوكن قبل انتهائه بدقيقة
DEFAULT_RETRY_AFTER = 3  # 503: «from 1 seconds and up to 3 seconds» (apigovernance)
RETRY_AFTER_MARGIN = 1  # «a value to wait should be larger then the value returned» في Retry-After
MAX_MESSAGE = 300


# ================= النقل =================
@dataclass(frozen=True, slots=True)
class HttpResponse:
    status: int
    headers: dict[str, str]  # أسماء بحروف صغيرة
    body: bytes

    def json(self) -> Any:
        try:
            return json.loads(self.body.decode("utf-8-sig") or "null")
        except ValueError:
            return None


Transport = Callable[[str, str, dict[str, str], bytes | None, EtaEnvironment], HttpResponse]


def urllib_transport(
    method: str, url: str, headers: dict[str, str], body: bytes | None, env: EtaEnvironment
) -> HttpResponse:
    request = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS, context=ssl_context(env)) as resp:  # noqa: S310 - https فقط
            return HttpResponse(resp.status, {k.lower(): v for k, v in resp.headers.items()}, resp.read())
    except HTTPError as exc:
        return HttpResponse(exc.code, {k.lower(): v for k, v in (exc.headers or {}).items()}, exc.read() or b"")
    except (URLError, TimeoutError, OSError) as exc:
        reason = getattr(exc, "reason", exc)
        # رفض الاتصال/فشل DNS = الطلب لم يخرج أصلاً. المهلة/قطع الاتصال = ربما وصل ولم يصلنا الرد.
        not_sent = isinstance(reason, ConnectionRefusedError | socket.gaierror)
        raise EtaNetworkError(str(reason), maybe_sent=not not_sent) from exc


# ================= الأخطاء =================
class EtaError(Exception):
    kind = "error"

    def __init__(self, message: str, *, status: int | None = None, correlation_id: str | None = None) -> None:
        super().__init__(message[:MAX_MESSAGE])
        self.message = message[:MAX_MESSAGE]
        self.status = status
        self.correlation_id = correlation_id


class EtaNetworkError(EtaError):
    kind = "network"

    def __init__(self, message: str, *, maybe_sent: bool = True, **kw: Any) -> None:
        super().__init__(message, **kw)
        # False = مؤكد أن الطلب لم يصل الخادم (رفض اتصال/DNS) فإعادته آمنة فوراً.
        self.maybe_sent = maybe_sent


class EtaRateLimited(EtaError):
    kind = "rate_limited"

    def __init__(self, message: str, retry_after: float, **kw: Any) -> None:
        super().__init__(message, **kw)
        self.retry_after = retry_after


class EtaAuthError(EtaError):
    kind = "auth_failed"


class EtaRequestError(EtaError):
    kind = "bad_request"


# ================= البيانات =================
@dataclass(frozen=True, slots=True)
class DeviceCredentials:
    device_id: str
    environment: EtaEnvironment
    client_id: str
    client_secret: str
    pos_serial: str
    pos_os_version: str
    pos_model_framework: str
    preshared_key: str | None = None

    def __repr__(self) -> str:  # لا تظهر الأسرار في أي traceback أو log
        return f"DeviceCredentials(device_id={self.device_id!r}, environment={self.environment.value!r})"


@dataclass(frozen=True, slots=True)
class TokenInfo:
    expires_in: int
    scope: str | None


@dataclass(frozen=True, slots=True)
class RejectedDoc:
    uuid: str | None
    receipt_number: str | None
    message: str


@dataclass(frozen=True, slots=True)
class SubmitResult:
    submission_uuid: str | None
    accepted: dict[str, str | None]  # uuid ← longId
    rejected: list[RejectedDoc]
    correlation_id: str | None


@dataclass(frozen=True, slots=True)
class ReceiptState:
    uuid: str
    status: str  # Valid / Invalid / Cancelled / InProgress
    message: str | None


@dataclass(frozen=True, slots=True)
class SubmissionState:
    status: str  # InProgress / Valid / Invalid
    receipts: list[ReceiptState]
    total_pages: int


@dataclass
class _Token:
    value: str
    expires_at: float


# ================= أدوات =================
def _retry_after(resp: HttpResponse) -> float:
    raw = resp.headers.get("retry-after")
    try:
        return max(float(raw), 0) + RETRY_AFTER_MARGIN if raw else DEFAULT_RETRY_AFTER
    except ValueError:
        return DEFAULT_RETRY_AFTER


def _error_text(payload: Any, fallback: str) -> str:
    """رسالة من شكل الخطأ القياسي {"error": {code, message, details[]}} أو 429/503 أو OAuth."""
    if not isinstance(payload, dict):
        return fallback
    err = payload.get("error")
    if isinstance(err, dict):
        parts = [str(err.get("message") or err.get("code") or "")]
        parts += [str(d.get("message")) for d in err.get("details") or [] if isinstance(d, dict) and d.get("message")]
        return " | ".join(p for p in parts if p) or fallback
    if isinstance(err, str):  # OAuth: {"error": "invalid_posserial"} أو 429: {"error": "...", "message": "..."}
        return f"{err}: {payload.get('message') or payload.get('error_description') or ''}".strip(": ")
    return str(payload.get("message") or fallback)


def _submission_error(err: Any) -> str:
    """Submission Error: errorAr/error/propertyPath مع innerError (06-get-receipt-submission)."""
    texts: list[str] = []
    while isinstance(err, dict) and len(texts) < 5:
        text = err.get("errorAr") or err.get("error") or err.get("errorCode")
        if text:
            texts.append(f"{text} ({err['propertyPath']})" if err.get("propertyPath") else str(text))
        err = err.get("innerError")
    return " | ".join(texts)


def classify(resp: HttpResponse, *, auth_call: bool = False) -> EtaError:
    payload = resp.json()
    correlation = resp.headers.get("correlationid")
    text = _error_text(payload, f"HTTP {resp.status}")
    kw = {"status": resp.status, "correlation_id": correlation}
    code = payload.get("error", {}).get("code") if isinstance(payload, dict) and isinstance(payload.get("error"), dict) else None
    if resp.status == 429 or (resp.status == 422 and code == "DuplicateSubmission"):
        return EtaRateLimited(text, _retry_after(resp), **kw)
    if resp.status >= 500:
        return EtaRateLimited(text, _retry_after(resp), **kw) if resp.status == 503 else EtaNetworkError(text, **kw)
    if resp.status in (401, 403) or auth_call:
        return EtaAuthError(text, **kw)
    return EtaRequestError(text, **kw)


# ================= العميل =================
@dataclass
class EtaClient:
    transport: Transport = urllib_transport
    clock: Callable[[], float] = time.monotonic
    _tokens: dict[tuple[str, str, str], _Token] = field(default_factory=dict)
    _lock: threading.Lock = field(default_factory=threading.Lock)

    # ---------- المصادقة ----------
    def authenticate(self, creds: DeviceCredentials) -> TokenInfo:
        """طلب توكن جديد دائماً (اختبار الاتصال يستخدمه مباشرة)."""
        env = ENVIRONMENTS[creds.environment]
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "posserial": creds.pos_serial,
            "pososversion": creds.pos_os_version,
            "posmodelframework": creds.pos_model_framework,
        }
        if creds.preshared_key:
            headers["presharedkey"] = creds.preshared_key
        body = urlencode(
            {"grant_type": "client_credentials", "client_id": creds.client_id, "client_secret": creds.client_secret}
        ).encode()
        resp = self.transport("POST", env.identity_url + TOKEN_PATH, headers, body, creds.environment)
        if resp.status != 200:
            raise classify(resp, auth_call=resp.status < 500 and resp.status != 429)
        payload = resp.json() or {}
        token = payload.get("access_token")
        if not token:
            raise EtaAuthError("المنظومة لم ترجع توكن", status=resp.status)
        expires_in = int(payload.get("expires_in") or 3600)
        with self._lock:
            self._tokens[self._key(creds)] = _Token(token, self.clock() + expires_in)
        log.info("eta auth ok device=%s env=%s expires_in=%s", creds.device_id, creds.environment.value, expires_in)
        return TokenInfo(expires_in, payload.get("scope"))

    @staticmethod
    def _key(creds: DeviceCredentials) -> tuple[str, str, str]:
        return (creds.environment.value, creds.device_id, creds.client_id)

    def ensure_token(self, creds: DeviceCredentials) -> None:
        """توكن صالح قبل الإرسال: فشل المصادقة/الشبكة هنا يعني أن الإيصالات لم تخرج أبداً."""
        self._token(creds)

    def _token(self, creds: DeviceCredentials) -> str:
        with self._lock:
            cached = self._tokens.get(self._key(creds))
            if cached and cached.expires_at - REFRESH_BEFORE > self.clock():
                return cached.value
        self.authenticate(creds)
        return self._tokens[self._key(creds)].value

    def forget(self, creds: DeviceCredentials) -> None:
        with self._lock:
            self._tokens.pop(self._key(creds), None)

    def _api(self, creds: DeviceCredentials, method: str, path: str, body: bytes | None = None) -> HttpResponse:
        """طلب مصادَق. 401 = التوكن انتهى/أُلغي: توكن جديد ومحاولة واحدة أخرى."""
        url = ENVIRONMENTS[creds.environment].api_url + path
        for attempt in (1, 2):
            headers = {"Authorization": f"Bearer {self._token(creds)}", "Accept": "application/json",
                       "Accept-Language": "ar"}  # fmt: skip
            if body is not None:
                headers["Content-Type"] = "application/json"
            resp = self.transport(method, url, headers, body, creds.environment)
            if resp.status == 401 and attempt == 1:
                self.forget(creds)
                continue
            return resp
        return resp  # pragma: no cover

    # ---------- الإرسال ----------
    def submit(self, creds: DeviceCredentials, documents: list[str]) -> SubmitResult:
        """documents = نصوص المستندات المخزّنة حرفياً (نفس البايتات التي حُسب منها الـ UUID).
        signatures فارغة: قرار المرحلة 4 (التحقق من التوقيع غير مفعّل في المنظومة حسب الـ SDK)."""
        body = ('{"receipts":[' + ",".join(documents) + '],"signatures":[]}').encode("utf-8")
        resp = self._api(creds, "POST", SUBMIT_PATH, body)
        if resp.status not in (200, 202):
            raise classify(resp)
        payload = resp.json() or {}
        rejected = [
            RejectedDoc(
                uuid=d.get("uuid"),
                receipt_number=d.get("receiptNumber"),
                message=_error_text({"error": d.get("error")}, "مرفوض"),
            )
            for d in payload.get("rejectedDocuments") or []
            if isinstance(d, dict)
        ]
        accepted = {
            d["uuid"]: d.get("longId")
            for d in payload.get("acceptedDocuments") or []
            if isinstance(d, dict) and d.get("uuid")
        }
        return SubmitResult(payload.get("submissionUUID") or payload.get("submissionUuid"), accepted, rejected,
                            resp.headers.get("correlationid"))  # fmt: skip

    def submission(self, creds: DeviceCredentials, submission_uuid: str, page: int = 1, page_size: int = 100) -> SubmissionState:
        path = SUBMISSION_PATH.format(uuid=submission_uuid) + "?" + urlencode({"PageNo": page, "PageSize": page_size})
        resp = self._api(creds, "GET", path)
        if resp.status != 200:
            raise classify(resp)
        payload = resp.json() or {}
        receipts = [
            ReceiptState(
                uuid=r.get("uuid", ""),
                status=r.get("status") or "InProgress",
                message=" | ".join(filter(None, (_submission_error(e.get("error")) for e in r.get("errors") or [] if isinstance(e, dict))))
                or None,
            )
            for r in payload.get("receipts") or []
            if isinstance(r, dict)
        ]
        meta = payload.get("metadata") or {}
        return SubmissionState(payload.get("status") or "InProgress", receipts, int(meta.get("totalPages") or 1))

    def receipt(self, creds: DeviceCredentials, uuid: str) -> ReceiptState:
        """حالة إيصال واحد (بعد 422 DuplicateSubmission لا نعرف رقم الدفعة)."""
        resp = self._api(creds, "GET", RECEIPT_DETAILS_PATH.format(uuid=uuid))
        if resp.status == 404:
            return ReceiptState(uuid, "NotFound", None)
        if resp.status != 200:
            raise classify(resp)
        receipt = (resp.json() or {}).get("receipt") or {}
        return ReceiptState(uuid, receipt.get("status") or "InProgress", receipt.get("statusReason"))
