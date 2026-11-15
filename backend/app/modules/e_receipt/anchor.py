"""مرساة السلسلة: حماية من كسرها بصمت عند الاستعادة من نسخة احتياطية أقدم.

المشكلة: الاستعادة تستبدل القاعدة كلها، فيرجع «آخر UUID» لكل جهاز لقيمة قديمة، وأول إيصال بعدها
يحمل previousUUID قديماً بينما المنظومة رأت إيصالات أحدث صدرت بعد تلك النسخة → السلسلة تنكسر.

الحل: ملف صغير بجانب القاعدة (eta-chain.anchor.json) فيه لكل جهاز {seq, uuid} لآخر إيصال صدر.
- خارج القاعدة، فلا تشمله النسخ الاحتياطية ولا تُرجعه الاستعادة.
- يُكتب بعد نجاح commit فقط (after_commit)، وبشكل ذري (ملف مؤقت ثم استبدال)، ولا يتراجع أبداً
  (نكتب فقط الأكبر seq). فشل الكتابة لا يوقف البيع (القاعدة تسبق المرساة ← لا تنبيه كاذب).
- قبل كل إيصال: لو المرساة أكبر من القاعدة (أو نفس الترتيب بـ UUID مختلف) = القاعدة رجعت للخلف.
  حينها لا يدخل الإيصال السلسلة (حالة «خطأ تحقق» برسالة واضحة) ويظهر بند مانع في الجاهزية، حتى
  يعتمد المدير «متابعة السلسلة من آخر إيصال صادر» (adopt_anchor): السلسلة تكمل من UUID المرساة،
  فتبقى متصلة كما تراها المنظومة. الإيصالات التي صدرت بعد النسخة ضاعت من القاعدة نفسها (لا من المنظومة).

حدود الحماية: حذف ملف المرساة يدوياً ثم الاستعادة لا يُكتشف (لا مرجع للمقارنة).
"""

import json
import logging
import os
import threading
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.core.config import get_settings

from .constants import ANCHOR_FILE_NAME

log = logging.getLogger(__name__)
_lock = threading.Lock()
_PENDING = "e_receipt_anchor_pending"
_LISTENING = "e_receipt_anchor_listening"


@dataclass(frozen=True, slots=True)
class Link:
    seq: int
    uuid: str


def anchor_path() -> Path:
    return Path(get_settings().db_path).parent / ANCHOR_FILE_NAME


def read_anchor() -> dict[str, Link]:
    try:
        raw = json.loads(anchor_path().read_text(encoding="utf-8"))
        return {d: Link(int(v["seq"]), str(v["uuid"])) for d, v in raw.get("devices", {}).items()}
    except FileNotFoundError:
        return {}
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        log.warning("ملف مرساة سلسلة الإيصالات تالف؛ يُعاد إنشاؤه من القاعدة")
        return {}


def _write(updates: dict[str, Link], *, force: bool = False) -> None:
    with _lock:
        current = read_anchor()
        for device, link in updates.items():
            old = current.get(device)
            if force or old is None or link.seq > old.seq:
                current[device] = link
        path = anchor_path()
        tmp = path.with_suffix(".tmp")
        payload = {"devices": {d: {"seq": l.seq, "uuid": l.uuid} for d, l in current.items()}}
        tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, path)


def _after_commit(session: Session) -> None:
    pending: dict[str, Link] = session.info.pop(_PENDING, {})
    if not pending:
        return
    try:
        _write(pending)
    except OSError:  # القاعدة سبقت المرساة: آمن (لا تنبيه كاذب)، وتلحق في الإيصال التالي
        log.exception("تعذّر تحديث مرساة سلسلة الإيصالات")


def _after_rollback(session: Session) -> None:
    session.info.pop(_PENDING, None)


def remember(session: Session, device_id: str, link: Link) -> None:
    """يُسجَّل الآن ويُكتب في الملف بعد نجاح commit المعاملة فقط."""
    session.info.setdefault(_PENDING, {})[device_id] = link
    if not session.info.get(_LISTENING):
        event.listen(session, "after_commit", _after_commit)
        event.listen(session, "after_soft_rollback", lambda s, _tx: _after_rollback(s))
        session.info[_LISTENING] = True


def reset_device(device_id: str, link: Link) -> None:
    """بعد اعتماد المدير: المرساة = السلسلة الحالية لهذا الجهاز (حتى لو أصغر)."""
    _write({device_id: link}, force=True)


def gap(db: Link, anchor: Link | None) -> bool:
    """القاعدة أقدم من آخر إيصال صدر فعلاً؟"""
    if anchor is None:
        return False
    return anchor.seq > db.seq or (anchor.seq == db.seq and anchor.uuid != db.uuid)
