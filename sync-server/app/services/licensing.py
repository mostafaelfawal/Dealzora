"""التحقق من مفتاح ترخيص Dealzora (نفس صيغة البرنامج license.rs وأداة المورّد license_keygen).

المفتاح = base64url(JSON) + "." + base64url(توقيع Ed25519 على النص الأول).
السيرفر يحمل المفتاح العام فقط: لا يقدر أحد يصنع ترخيصاً، والمورّد لا يتدخل في التسجيل.
"""

import base64
import binascii
import json
from dataclasses import dataclass
from datetime import UTC, datetime

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from ..config import get_settings
from ..errors import BadRequest, Forbidden

MAX_KEY_LEN = 4096


@dataclass(frozen=True, slots=True)
class License:
    license_id: str
    machine_id: str
    shop_name: str
    plan: str | None
    expires_at: datetime


def _b64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _invalid() -> BadRequest:
    return BadRequest("license_invalid", "مفتاح الترخيص غير صحيح. انسخه كاملاً كما وصلك")


def verify(key: str) -> License:
    settings = get_settings()
    if not settings.vendor_pubkey:
        raise Forbidden("self_register_disabled", "التسجيل الذاتي غير مفعّل على هذا السيرفر")
    key = (key or "").strip()
    if not key or len(key) > MAX_KEY_LEN or key.count(".") != 1:
        raise _invalid()
    body, sig = key.split(".")
    try:
        public = Ed25519PublicKey.from_public_bytes(_b64(settings.vendor_pubkey))
        public.verify(_b64(sig), body.encode())
        payload = json.loads(_b64(body))
    except (InvalidSignature, ValueError, binascii.Error, TypeError) as exc:
        raise _invalid() from exc
    if not isinstance(payload, dict):
        raise _invalid()
    try:
        lic = License(
            license_id=str(payload["license_id"])[:64],
            machine_id=str(payload["machine_id"])[:128],
            shop_name=str(payload.get("shop_name") or "")[:120],
            plan=payload.get("plan"),
            expires_at=datetime.fromtimestamp(int(payload["expires_at"]), tz=UTC),
        )
    except (KeyError, ValueError, TypeError, OverflowError, OSError) as exc:
        raise _invalid() from exc
    if lic.expires_at <= datetime.now(UTC):
        raise BadRequest("license_expired", "مفتاح الترخيص منتهي الصلاحية. جدّد الاشتراك أولاً")
    if lic.plan is not None and lic.plan not in settings.register_plans:
        raise Forbidden("license_plan", "تعدد الفروع متاح في خطة «سلسلة» فقط. رقِّ خطتك أولاً")
    return lic
