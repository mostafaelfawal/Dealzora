"""شهادة الفرع: جهاز فرع مربوط بمحل خطته «سلسلة» يرث الخطة نفسها، دون مفتاح ترخيص خاص به.

الشهادة يوقّعها سيرفر الفروع، ونتحقق منها بالمفتاح العام المثبّت في البرنامج (build_keys).
تُحفظ مع إعدادات الربط وتتجدد مع كل مزامنة، ولها عمر قصير: لو فُصل الفرع أو انتهى ترخيص المحل
يرجع الجهاز لخطته الأصلية بعد انتهائها تلقائياً، حتى بدون اتصال.
"""

import base64
import binascii
import json
import sys
import threading
import time
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from .build_keys import SYNC_LEASE_PUBKEY

_lock = threading.Lock()
_state: dict[str, Any] = {"loaded": False, "plan": None, "exp": 0}
_FROZEN = getattr(sys, "frozen", False)


def _b64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _pubkey() -> str:
    if _FROZEN:  # النسخة المبنية: المفتاح المثبّت فقط (لا يُستبدل من البيئة على جهاز التاجر)
        return SYNC_LEASE_PUBKEY
    from .config import get_settings

    # التطوير: POS_SYNC_LEASE_PUBKEY (لو موجود) لتجربة سيرفر بمفتاح آخر، وإلا المثبّت.
    return get_settings().sync_lease_pubkey or SYNC_LEASE_PUBKEY


def verify(token: str | None, branch_id: str | None) -> dict | None:
    """الحمولة لو الشهادة صحيحة وتخص هذا الفرع وسارية، وإلا None."""
    key = _pubkey()
    if not token or not branch_id or not key or token.count(".") != 1:
        return None
    body, sig = token.split(".")
    try:
        Ed25519PublicKey.from_public_bytes(_b64(key)).verify(_b64(sig), body.encode())
        payload = json.loads(_b64(body))
    except (InvalidSignature, ValueError, binascii.Error, TypeError):
        return None
    if not isinstance(payload, dict) or payload.get("branch_id") != branch_id:
        return None
    if not isinstance(payload.get("exp"), int) or payload["exp"] <= time.time():
        return None
    return payload


def remember(token: str | None, branch_id: str | None) -> dict | None:
    payload = verify(token, branch_id)
    with _lock:
        _state.update(loaded=True, plan=payload["plan"] if payload else None, exp=payload["exp"] if payload else 0)
    return payload


def forget() -> None:
    with _lock:
        _state.update(loaded=True, plan=None, exp=0)


def _load() -> None:
    from app.modules.settings.constants import SettingKey  # متأخر: لا دوران
    from app.modules.settings.service import read_setting

    raw = read_setting(SettingKey.BRANCH_SYNC)
    cfg: dict = {}
    if raw:
        try:
            cfg = json.loads(raw)
        except ValueError:
            cfg = {}
    remember(cfg.get("lease"), cfg.get("branch_id"))


def current_plan() -> str | None:
    """الخطة الموروثة من المحل الآن (أو None)."""
    if not _state["loaded"]:
        _load()
    with _lock:
        if _state["plan"] and _state["exp"] > time.time():
            return _state["plan"]
    return None


def info() -> dict:
    current_plan()
    with _lock:
        return {"plan": _state["plan"], "expires_at": _state["exp"] or None}
