"""حالة في الذاكرة فقط (عملية الـ backend على الجهاز الأساسي تعيش وتموت مع البرنامج نفسه).

1) عقد الترخيص (lease): أجهزة الكاشير ليس لديها ترخيص خاص؛ تكتب تحت ترخيص الجهاز الأساسي.
   واجهة الجهاز الأساسي تطلب من Rust كل دقيقتين عقداً موقّعاً بسر تصريح الكتابة:
   "<expires>.<max_terminals>.<hmac>"، وتسلّمه للـ backend. لو انتهى الترخيص أو أُغلق
   البرنامج، يتوقف تجديد العقد فتصبح أجهزة الكاشير للقراءة فقط خلال دقائق.
2) كود الاقتران: 6 أرقام، صالح 10 دقائق، 5 محاولات خاطئة ثم يُلغى.
"""

import hashlib
import hmac
import secrets
import threading
import time
from dataclasses import dataclass

from app.core.config import get_settings

PAIRING_TTL_SECONDS = 10 * 60
PAIRING_MAX_ATTEMPTS = 5
# حماية إضافية من التخمين: لو كثرت المحاولات الخاطئة عموماً نوقف الاقتران مؤقتاً.
GLOBAL_FAIL_WINDOW = 10 * 60
GLOBAL_FAIL_LIMIT = 20
LEASE_MAX_AHEAD = 60 * 60  # لا نقبل عقداً يمتد أكثر من ساعة (حتى لو سُرّب)

_lock = threading.Lock()


# ================= العقد =================
@dataclass(frozen=True, slots=True)
class Lease:
    expires_at: int
    max_terminals: int
    # الخطة من الترخيص (Rust) ونهايتها (0 = بلا نهاية/مجانية). None في صيغة العقد القديمة.
    plan: str | None = None
    plan_expires_at: int = 0


_lease: Lease | None = None


def parse_lease(raw: str, now: float | None = None) -> Lease | None:
    now = now if now is not None else time.time()
    parts = raw.strip().split(".")
    plan: str | None = None
    plan_expires = 0
    try:
        if len(parts) == 5:  # <exp>.<max>.<plan>.<plan_exp>.<sig>
            exp_s, max_s, plan, plan_exp_s, sig = parts
            plan_expires = int(plan_exp_s)
            message = f"lease|{exp_s}|{max_s}|{plan}|{plan_exp_s}"
        elif len(parts) == 3:  # الصيغة القديمة بدون خطة
            exp_s, max_s, sig = parts
            message = f"lease|{exp_s}|{max_s}"
        else:
            return None
        expires, max_terminals = int(exp_s), int(max_s)
    except ValueError:
        return None
    expected = hmac.new(
        get_settings().write_permit_secret.encode(), message.encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return None
    if not now < expires <= now + LEASE_MAX_AHEAD or not 0 <= max_terminals <= 1000:
        return None
    if plan is not None and (not plan.isalpha() or len(plan) > 20):
        return None
    return Lease(expires, max_terminals, plan, plan_expires)


def set_lease(lease: Lease) -> None:
    """الأحدث يحل محل السابق دائماً (كله موقّع من Rust): تفعيل/انتهاء الخطة يظهر فوراً."""
    global _lease
    with _lock:
        _lease = lease


def active_lease(now: float | None = None) -> Lease | None:
    now = now if now is not None else time.time()
    with _lock:
        return _lease if _lease and _lease.expires_at > now else None


# ================= الاقتران =================
@dataclass(slots=True)
class _Pairing:
    code_hash: str
    expires_at: float
    attempts: int = 0


_pairing: _Pairing | None = None
_failures: list[float] = []


def _hash(code: str) -> str:
    return hashlib.sha256(f"pair|{code}".encode()).hexdigest()


def new_pairing_code(now: float | None = None) -> tuple[str, float]:
    """كود جديد يلغي أي كود سابق."""
    global _pairing
    now = now if now is not None else time.time()
    code = f"{secrets.randbelow(1_000_000):06d}"
    with _lock:
        _pairing = _Pairing(_hash(code), now + PAIRING_TTL_SECONDS)
    return code, now + PAIRING_TTL_SECONDS


def consume_pairing_code(code: str, now: float | None = None) -> str | None:
    """None = صحيح (ويُستهلك). وإلا سبب الرفض: invalid | expired | locked."""
    global _pairing
    now = now if now is not None else time.time()
    with _lock:
        _failures[:] = [t for t in _failures if now - t < GLOBAL_FAIL_WINDOW]
        if len(_failures) >= GLOBAL_FAIL_LIMIT:
            return "locked"
        if _pairing is None:
            _failures.append(now)
            return "invalid"
        if now >= _pairing.expires_at:
            _pairing = None
            return "expired"
        if not hmac.compare_digest(_pairing.code_hash, _hash(code.strip())):
            _pairing.attempts += 1
            _failures.append(now)
            if _pairing.attempts >= PAIRING_MAX_ATTEMPTS:
                _pairing = None
            return "invalid"
        _pairing = None  # كود لمرة واحدة
        return None


def pairing_status(now: float | None = None) -> float | None:
    """وقت انتهاء الكود الحالي (لو موجود)."""
    now = now if now is not None else time.time()
    with _lock:
        return _pairing.expires_at if _pairing and _pairing.expires_at > now else None
