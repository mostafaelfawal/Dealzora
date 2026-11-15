"""دخول تطبيق الهاتف (المالك ومديرو الفروع) وجلساته.

- الحسابات هي نفسها حسابات البرنامج على السيرفر (الكتالوج): owner يرى كل فروع المحل،
  و staff بدور manager يرى فروعه (branches) فقط. الكاشير لا يدخل التطبيق.
- أسماء المستخدمين فريدة داخل المحل فقط، فالهاتف يُربط بالمحل أولاً بكود قصير (مرة واحدة، صلاحية
  قصيرة، مُجزّأ) يطلبه أي فرع من فروع المحل أو الإدارة، ثم يكتب المستخدم اسمه وكلمة مروره.
- كلمة المرور تُتحقق بـ Argon2id على التجزئة اللي رفعها البرنامج (نفس التطبيع NFKC)، ولا تُخزّن ولا تُسجَّل.
- جلسة لكل هاتف: توكن وصول قصير (JWT من نوع mobile) + refresh عشوائي يتغير مع كل تجديد.
  رجوع refresh قديم = تسريب ← تُلغى الجلسة كلها.
- كل طلب يعيد فحص الحساب (موجود، نشط، نفس الدور، نفس كلمة المرور) والمحل والترخيص وخطة «سلسلة»
  من القاعدة، فإيقاف مدير أو نقله أو تخفيض الخطة يسري فوراً حتى مع توكن ساري.
"""

import hashlib
import hmac
import secrets
import unicodedata
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from ..audit import record, record_now
from ..config import get_settings
from ..db import utcnow
from ..errors import BadRequest, Forbidden, NotFound, Unauthorized
from ..models import Branch, CatalogItem, MobileCode, MobileSession, Shop
from ..schemas import MobileCodeOut, MobileLoginIn, MobileTokensOut, MobileUserOut
from .catalog import USER_KINDS, match_key
from .pairing import ALPHABET, CODE_LEN, _aware, _normalize

ACTOR = "mobile"
REQUIRED_PLAN = "enterprise"

_hasher = PasswordHasher()


# ================= أدوات =================
def _code_hash(code: str) -> str:
    return hashlib.sha256(f"mobile|{_normalize(code)}".encode()).hexdigest()


def _refresh_hash(secret: str) -> str:
    return hashlib.sha256(f"mrt|{secret}".encode()).hexdigest()


def cred_fp(password_hash: str) -> str:
    return hashlib.sha256(f"cred|{password_hash}".encode()).hexdigest()


@lru_cache
def _dummy_hash() -> str:
    # تساوي زمن الرد لو المستخدم غير موجود (لا نكشف الأسماء الصحيحة).
    return _hasher.hash("dummy-password-for-timing")


def _verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, unicodedata.normalize("NFKC", password))
    except (VerificationError, InvalidHashError):
        return False


def _new_refresh(session_id: str) -> tuple[str, str]:
    """(التوكن للهاتف، تجزئته للقاعدة). التوكن = معرّف الجلسة + سر 256 بت."""
    secret = secrets.token_urlsafe(32)
    return f"{session_id}.{secret}", _refresh_hash(secret)


# ================= الخطة والترخيص =================
def check_shop(shop: Shop) -> None:
    """المحل نشط، وترخيصه ساري (بالمهلة)، وخطته «سلسلة». الخطأ يحمل ما يعرض شاشة الترقية."""
    settings = get_settings()
    if not shop.is_active:
        raise Forbidden("shop_disabled", "حساب المحل موقوف")
    grace = timedelta(days=settings.license_grace_days)
    if shop.license_expires_at is not None and utcnow() > _aware(shop.license_expires_at) + grace:
        raise Forbidden("license_expired", "انتهى ترخيص المحل. جدّد الاشتراك من الجهاز الرئيسي للمالك")
    plan = shop.license_plan or settings.legacy_shop_plan
    if plan not in settings.mobile_plans:
        raise Forbidden(
            "plan_upgrade_required",
            "تطبيق الهاتف متاح في خطة «سلسلة» فقط. رقِّ خطة المحل لتستخدمه",
            {"current_plan": plan, "required_plan": REQUIRED_PLAN},
        )


# ================= الحسابات =================
@dataclass(frozen=True, slots=True)
class Account:
    id: str
    username: str
    role: str  # owner / manager
    branch_ids: tuple[str, ...]
    password_hash: str


def _find_account(session: Session, shop_id: str, username: str) -> CatalogItem | None:
    key = match_key("owner", {"username": username})
    if key is None:
        return None
    return session.scalars(
        select(CatalogItem).where(
            CatalogItem.shop_id == shop_id,
            CatalogItem.kind.in_(USER_KINDS),
            CatalogItem.match_key == key,
            CatalogItem.deleted.is_(False),
        )
    ).first()


def _account(session: Session, row: CatalogItem | None, shop_id: str) -> Account | None:
    """None = الحساب لا يدخل التطبيق (محذوف، موقوف، كاشير). الفروع = فروع المحل الفعلية فقط."""
    if row is None or row.deleted or row.shop_id != shop_id or not row.data.get("is_active", True):
        return None
    shop_branches = session.scalars(select(Branch.id).where(Branch.shop_id == shop_id).order_by(Branch.created_at)).all()
    if row.kind == "owner":
        role, allowed = "owner", list(shop_branches)
    elif row.kind == "staff" and row.data.get("role") == "manager":
        mine = set(row.data.get("branches") or [])
        role, allowed = "manager", [b for b in shop_branches if b in mine]
    else:
        return None
    return Account(id=row.id, username=row.data["username"], role=role, branch_ids=tuple(allowed),
                   password_hash=row.data["password_hash"])  # fmt: skip


def user_out(account: Account, shop: Shop) -> MobileUserOut:
    return MobileUserOut(account_id=account.id, username=account.username, role=account.role,  # type: ignore[arg-type]
                         shop_id=shop.id, shop_name=shop.name, branch_ids=list(account.branch_ids))  # fmt: skip


# ================= كود ربط الهاتف =================
def create_code(session: Session, shop_id: str, *, by_branch_id: str | None, actor: str, ip: str | None) -> MobileCodeOut:
    shop = session.get(Shop, shop_id)
    if shop is None:
        raise NotFound("shop_not_found", "المحل غير موجود")
    check_shop(shop)
    now = utcnow()
    raw = "".join(secrets.choice(ALPHABET) for _ in range(CODE_LEN))
    code = "-".join(raw[i : i + 4] for i in range(0, CODE_LEN, 4))
    expires = now + timedelta(minutes=get_settings().mobile_code_ttl_minutes)
    # تنظيف أكواد المحل المنتهية (أكثر من كود ساري مسموح: المالك ومدير يجهّزون هواتفهم معاً).
    session.execute(delete(MobileCode).where(MobileCode.shop_id == shop_id, MobileCode.expires_at < now))
    session.add(MobileCode(code_hash=_code_hash(code), shop_id=shop_id, created_by_branch_id=by_branch_id,
                           expires_at=expires, attempts=0))  # fmt: skip
    record(session, "mobile_code_created", actor=actor, shop_id=shop_id, branch_id=by_branch_id, ip=ip)
    session.commit()
    return MobileCodeOut(code=code, shop_name=shop.name, expires_at=expires)


# ================= الدخول والتجديد والخروج =================
def _issue(session: Session, ms: MobileSession, account: Account, shop: Shop) -> MobileTokensOut:
    from ..mobile_security import issue_access  # تفادي استيراد دائري

    settings = get_settings()
    refresh, refresh_hash = _new_refresh(ms.id)
    ms.refresh_hash = refresh_hash
    ms.refresh_expires_at = utcnow() + timedelta(days=settings.mobile_refresh_days)
    access, expires = issue_access(ms)
    session.commit()
    return MobileTokensOut(access_token=access, expires_at=expires, refresh_token=refresh,
                           refresh_expires_at=ms.refresh_expires_at, session_id=ms.id,
                           user=user_out(account, shop))  # fmt: skip


def login(session: Session, data: MobileLoginIn, *, ip: str) -> MobileTokensOut:
    settings = get_settings()
    now = utcnow()
    normalized = _normalize(data.code)
    row = None
    if len(normalized) == CODE_LEN:
        row = session.execute(
            select(MobileCode, Shop)
            .join(Shop, Shop.id == MobileCode.shop_id)
            .where(MobileCode.code_hash == _code_hash(normalized))
            .with_for_update()
        ).first()
    username = data.username.strip().lower()
    fail = {"username": username[:50], "device_name": data.device_name[:80]}
    if (
        row is None
        or row[0].used_at is not None
        or _aware(row[0].expires_at) <= now
        or row[0].attempts >= settings.mobile_code_max_attempts
    ):
        record_now(session, "mobile_login_failed", actor="anonymous", ip=ip, shop_id=row[1].id if row else None,
                   details={**fail, "reason": "code"})  # fmt: skip
        raise BadRequest("mobile_code_invalid", "كود ربط الهاتف غير صحيح أو انتهت صلاحيته. اطلب كوداً جديداً من البرنامج")
    code, shop = row
    check_shop(shop)

    item = _find_account(session, shop.id, username)
    ok = _verify_password(item.data["password_hash"] if item else _dummy_hash(), data.password)
    if not ok or item is None or not item.data.get("is_active", True):
        code.attempts += 1
        record(session, "mobile_login_failed", actor="anonymous", ip=ip, shop_id=shop.id,
               details={**fail, "reason": "credentials"})  # fmt: skip
        session.commit()
        raise Unauthorized("bad_credentials", "اسم المستخدم أو كلمة المرور غير صحيحة")
    account = _account(session, item, shop.id)
    if account is None:  # كاشير بكلمة مرور صحيحة
        record_now(session, "mobile_login_failed", actor="anonymous", ip=ip, shop_id=shop.id,
                   details={**fail, "reason": "role"})  # fmt: skip
        raise Forbidden("mobile_role_denied", "تطبيق الهاتف للمالك ومديري الفروع فقط")

    code.used_at = now
    # جلسة واحدة لكل هاتف: دخول جديد من نفس الهاتف يُلغي جلسته القديمة.
    session.execute(
        update(MobileSession)
        .where(
            MobileSession.account_id == account.id,
            MobileSession.device_id == data.device_id,
            MobileSession.revoked_at.is_(None),
        )
        .values(revoked_at=now, revoke_reason="replaced")
    )
    ms = MobileSession(
        id=str(uuid.uuid4()), shop_id=shop.id, account_id=account.id, username=account.username,
        device_id=data.device_id, device_name=data.device_name.strip()[:80], platform=data.platform,
        refresh_hash="", refresh_expires_at=now, cred_fp=cred_fp(account.password_hash),
        created_at=now, last_used_at=now, last_ip=ip,
    )  # fmt: skip
    session.add(ms)
    record(session, "mobile_login", actor=ACTOR, shop_id=shop.id, ip=ip,
           details={"username": account.username, "role": account.role, "session_id": ms.id,
                    "device_name": ms.device_name, "platform": ms.platform})  # fmt: skip
    return _issue(session, ms, account, shop)


def _revoke(ms: MobileSession, reason: str) -> None:
    if ms.revoked_at is None:
        ms.revoked_at = utcnow()
        ms.revoke_reason = reason


def validate_session(session: Session, ms: MobileSession) -> tuple[Account, Shop]:
    """الجلسة سارية والحساب لم يتغير. أي تغيير في الحساب يُلغي الجلسة نهائياً (يحتاج دخول جديد)."""
    if ms.revoked_at is not None:
        raise Unauthorized("session_revoked", "تم تسجيل الخروج من هذا الهاتف. سجّل الدخول من جديد")
    shop = session.get(Shop, ms.shop_id)
    account = _account(session, session.get(CatalogItem, ms.account_id), ms.shop_id)
    if shop is None or account is None or not hmac.compare_digest(cred_fp(account.password_hash), ms.cred_fp):
        _revoke(ms, "account_changed")
        record(session, "mobile_session_revoked", actor="system", shop_id=ms.shop_id,
               details={"username": ms.username, "session_id": ms.id, "reason": "account_changed"})  # fmt: skip
        session.commit()
        raise Unauthorized("session_revoked", "تغيّرت بيانات حسابك أو صلاحياته. سجّل الدخول من جديد")
    return account, shop


def refresh(session: Session, token: str, *, ip: str) -> MobileTokensOut:
    session_id, _, secret = token.partition(".")
    ms = session.get(MobileSession, session_id, with_for_update=True) if session_id and secret else None
    if ms is None or ms.revoked_at is not None:
        raise Unauthorized("refresh_invalid", "انتهت الجلسة. سجّل الدخول من جديد")
    if not hmac.compare_digest(_refresh_hash(secret), ms.refresh_hash):
        # توكن قديم رجع = نسخة مسرّبة (أو استخدام مزدوج): نلغي الجلسة كلها احتياطاً.
        _revoke(ms, "refresh_reuse")
        record(session, "mobile_refresh_reuse", actor="anonymous", shop_id=ms.shop_id, ip=ip,
               details={"username": ms.username, "session_id": ms.id, "device_name": ms.device_name})  # fmt: skip
        session.commit()
        raise Unauthorized("refresh_invalid", "انتهت الجلسة. سجّل الدخول من جديد")
    if _aware(ms.refresh_expires_at) <= utcnow():
        _revoke(ms, "expired")
        session.commit()
        raise Unauthorized("refresh_expired", "انتهت الجلسة لعدم الاستخدام. سجّل الدخول من جديد")
    account, shop = validate_session(session, ms)
    check_shop(shop)  # بلا إلغاء: الترقية تعيد الهاتف للعمل بنفس الجلسة
    ms.last_used_at = utcnow()
    ms.last_ip = ip
    return _issue(session, ms, account, shop)


def logout(session: Session, ms: MobileSession, *, ip: str) -> None:
    _revoke(ms, "logout")
    record(session, "mobile_logout", actor=ACTOR, shop_id=ms.shop_id, ip=ip,
           details={"username": ms.username, "session_id": ms.id, "device_name": ms.device_name})  # fmt: skip
    session.commit()


def logout_all(session: Session, ms: MobileSession, *, ip: str) -> int:
    """تسجيل الخروج من كل هواتف هذا الحساب (ومنها الحالي)."""
    now = utcnow()
    result = session.execute(
        update(MobileSession)
        .where(MobileSession.account_id == ms.account_id, MobileSession.revoked_at.is_(None))
        .values(revoked_at=now, revoke_reason="logout_all")
    )
    count = int(result.rowcount or 0)  # type: ignore[attr-defined]
    record(session, "mobile_logout_all", actor=ACTOR, shop_id=ms.shop_id, ip=ip,
           details={"username": ms.username, "session_id": ms.id, "device_name": ms.device_name,
                    "sessions": count})  # fmt: skip
    session.commit()
    return count


def active_sessions(session: Session, account_id: str) -> list[MobileSession]:
    now = utcnow()
    rows = session.scalars(
        select(MobileSession)
        .where(MobileSession.account_id == account_id, MobileSession.revoked_at.is_(None))
        .order_by(MobileSession.created_at)
    ).all()
    return [r for r in rows if _aware(r.refresh_expires_at) > now]


def aware(value: datetime | None) -> datetime | None:
    return value if value is None or value.tzinfo else value.replace(tzinfo=UTC)
