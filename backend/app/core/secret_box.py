"""تشفير الأسرار المخزّنة في القاعدة (Client Secret ومفتاح الجهاز المشترك لمنظومة الضرائب).

- AES-256-GCM بمفتاح مشتق (HKDF-SHA256) من كلمة سر القاعدة POS_DB_PASSWORD التي يمرّرها Rust.
  المفتاح نفسه لا يُخزَّن في أي مكان: يُشتق في الذاكرة عند الحاجة.
- كل قيمة مربوطة بسياقها (aad = الجدول/الصف/الحقل)، فلا يصلح نقل نص مشفّر من صف لآخر.
- الشكل المخزّن: "v1:" + base64(nonce 12 بايت + النص المشفّر مع وسم التحقق).

النسخ الاحتياطية: مشفّرة أصلاً بمفتاح الجهاز ولا تُستعاد إلا على نفس الجهاز (backup/service.py)،
فالأسرار المستعادة تُفك عادي. لو تعذّر الفك (القاعدة نُقلت لجهاز بكلمة سر أخرى)، open_secret
ترجع None فيعاملها النظام كـ«غير معيّن ويحتاج إعادة إدخال»، ولا يتعطل شيء آخر.

القيم المفكوكة تُستخدم داخل الـ backend فقط (المصادقة مع المنظومة)، ولا ترجع في أي API.
"""

import base64
import os
from functools import lru_cache

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from .config import get_settings

_VERSION = "v1"
_SALT = b"dealzora/secret-box"
_INFO = b"dealzora secret-box v1 aes-256-gcm"
_NONCE_LEN = 12


@lru_cache
def _key() -> bytes:
    password = get_settings().db_password.encode("utf-8")
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=_SALT, info=_INFO).derive(password)


def seal_secret(plain: str, context: str) -> str:
    nonce = os.urandom(_NONCE_LEN)
    data = AESGCM(_key()).encrypt(nonce, plain.encode("utf-8"), context.encode("utf-8"))
    return f"{_VERSION}:" + base64.b64encode(nonce + data).decode("ascii")


def open_secret(sealed: str | None, context: str) -> str | None:
    """None لو غير معيّن أو تعذّر فكه (مفتاح مختلف/قيمة تالفة/سياق مختلف)."""
    if not sealed:
        return None
    version, _, body = sealed.partition(":")
    if version != _VERSION or not body:
        return None
    try:
        raw = base64.b64decode(body, validate=True)
        plain = AESGCM(_key()).decrypt(raw[:_NONCE_LEN], raw[_NONCE_LEN:], context.encode("utf-8"))
    except (ValueError, InvalidTag):
        return None
    return plain.decode("utf-8")
