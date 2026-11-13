"""ربط جهاز الفرع بكود قصير بدل نسخ سر طويل.

1) أنت (الإدارة) تطلع كود للفرع: XXXX-XXXX-XXXX، صالح دقائق، ومرة واحدة.
2) المالك يكتبه في برنامج الفرع، فيأخذ الجهاز سرّه الدائم (يُحفظ مشفّراً عنده).
3) الربط يغيّر السر ويزيد token_version: أي جهاز قديم بنفس الفرع يتوقف فوراً.

الكود 12 حرفاً من 31 رمزاً (حوالي 59 بت) ومُجزّأ في القاعدة، ومع حد الطلبات لكل IP التخمين مستحيل عملياً.
"""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..audit import record, record_now
from ..config import get_settings
from ..db import utcnow
from ..errors import BadRequest, NotFound
from ..models import Branch, PairingCode, Shop
from ..schemas import PairingCodeOut, PairOut
from ..security import hash_secret, new_secret

# بدون 0/O و 1/I/L لتفادي الخلط عند الكتابة.
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LEN = 12


def _normalize(code: str) -> str:
    return "".join(ch for ch in code.upper() if ch.isalnum())


def _hash(code: str) -> str:
    return hashlib.sha256(f"pair|{_normalize(code)}".encode()).hexdigest()


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def create_code(session: Session, branch_id: str, *, ip: str | None = None) -> PairingCodeOut:
    branch = session.get(Branch, branch_id)
    if branch is None:
        raise NotFound("branch_not_found", "الفرع غير موجود")
    if not branch.is_active:
        raise BadRequest("branch_disabled", "الفرع موقوف، فعّله أولاً")
    raw = "".join(secrets.choice(ALPHABET) for _ in range(CODE_LEN))
    code = "-".join(raw[i : i + 4] for i in range(0, CODE_LEN, 4))
    expires = utcnow() + timedelta(minutes=get_settings().pairing_ttl_minutes)
    # كود واحد صالح لكل فرع: الجديد يلغي القديم.
    session.execute(delete(PairingCode).where(PairingCode.branch_id == branch_id))
    session.add(PairingCode(code_hash=_hash(code), branch_id=branch_id, expires_at=expires))
    record(
        session, "pairing_code_created", actor="admin",
        shop_id=branch.shop_id, branch_id=branch.id, ip=ip,
    )  # fmt: skip
    session.commit()
    return PairingCodeOut(branch_id=branch.id, branch_name=branch.name, code=code, expires_at=expires)


def redeem(session: Session, code: str, *, ip: str) -> PairOut:
    normalized = _normalize(code)
    row = None
    if len(normalized) == CODE_LEN:
        row = session.execute(
            select(PairingCode, Branch, Shop)
            .join(Branch, Branch.id == PairingCode.branch_id)
            .join(Shop, Shop.id == Branch.shop_id)
            .where(PairingCode.code_hash == _hash(normalized))
            .with_for_update()
        ).first()
    now = utcnow()
    # رسالة واحدة لكل أسباب الفشل (لا نكشف هل الكود موجود).
    if (
        row is None
        or row[0].used_at is not None
        or _aware(row[0].expires_at) <= now
        or not row[1].is_active
        or not row[2].is_active
    ):
        record_now(
            session, "pairing_failed", actor="anonymous", ip=ip,
            branch_id=row[1].id if row else None, shop_id=row[2].id if row else None,
        )  # fmt: skip
        raise BadRequest("pairing_invalid", "الكود غير صحيح أو انتهت صلاحيته. اطلب كوداً جديداً")

    pairing, branch, shop = row
    secret = new_secret()
    branch.secret_hash = hash_secret(secret)
    branch.token_version += 1
    pairing.used_at = now
    record(session, "branch_paired", actor="anonymous", shop_id=shop.id, branch_id=branch.id, ip=ip)
    session.commit()
    return PairOut(
        branch_id=branch.id,
        secret=secret,
        branch_name=branch.name,
        branch_code=branch.code,
        shop_id=shop.id,
        shop_name=shop.name,
    )
