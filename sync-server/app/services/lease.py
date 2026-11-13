"""شهادة الفرع (lease): جهاز الفرع يرث خطة محله طالما هو مربوط وترخيص المحل ساري.

الشهادة = base64url(JSON) + "." + base64url(توقيع Ed25519) بمفتاح السيرفر الخاص (SYNC_LEASE_KEY).
مفتاحها العام مثبّت داخل نسخة البرنامج وقت البناء، فلا يقدر تاجر يشغّل سيرفراً مزيفاً يفتح خطة لنفسه.
عمرها قصير (SYNC_LEASE_TTL_DAYS) وتتجدد مع كل مزامنة: فرع فُصل أو محل انتهى ترخيصه يرجع
لخطته الأصلية تلقائياً بعد انتهائها، حتى لو انقطع عن السيرفر.
"""

import base64
import json
from datetime import UTC, datetime, timedelta

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from ..config import get_settings
from ..errors import Forbidden
from ..models import Branch, Shop


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _key() -> Ed25519PrivateKey:
    raw = get_settings().lease_key
    if not raw:
        raise Forbidden("lease_disabled", "شهادات الفروع غير مفعّلة على هذا السيرفر")
    return Ed25519PrivateKey.from_private_bytes(base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)))


def issue(shop: Shop, branch: Branch) -> tuple[str, dict]:
    settings = get_settings()
    now = datetime.now(UTC)
    expires = now + timedelta(days=settings.lease_ttl_days)
    if shop.license_expires_at is not None:  # لا تتجاوز ترخيص المحل (+ المهلة)
        lic = shop.license_expires_at if shop.license_expires_at.tzinfo else shop.license_expires_at.replace(tzinfo=UTC)
        expires = min(expires, lic + timedelta(days=settings.license_grace_days))
    payload = {
        "v": 1,
        "shop_id": shop.id,
        "branch_id": branch.id,
        "plan": shop.license_plan or settings.legacy_shop_plan,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    return f"{body}.{_b64(_key().sign(body.encode()))}", payload
