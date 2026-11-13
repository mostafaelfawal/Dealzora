"""خدمة المالك الذاتية: يسجّل محله بترخيصه، ويدير فروعه وأكواد ربطها من الجهاز الرئيسي.

- التسجيل: مفتاح ترخيص «سلسلة» صالح (موقّع منك) ← محل جديد + الفرع الرئيسي (is_admin) لهذا الجهاز.
  محل واحد لكل ترخيص. نفس الترخيص على جهاز جديد = «استرجاع»: سر جديد للفرع الرئيسي، والجهاز
  القديم يتوقف فوراً (المفتاح نفسه هو إثبات الملكية، ويصل للمالك وحده).
- الإدارة: الفرع الرئيسي وحده يضيف فروعاً، ويطلع أكواد ربط، ويوقف فرعاً، أو يلغي ربط جهاز.
  لا يقدر يطلع كود ربط لنفسه (حتى لا يُسرق الفرع الرئيسي بكود).
- التجديد: مفتاح جديد لنفس الترخيص يمد صلاحية المحل.
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..audit import record
from ..config import get_settings
from ..db import utcnow
from ..errors import BadRequest, Conflict, Forbidden, NotFound
from ..models import Branch, Shop
from ..schemas import (
    AdminBranchOut,
    BranchIn,
    NewBranchOut,
    PairingCodeOut,
    PairOut,
    RegisterIn,
    ShopInfoOut,
)
from ..security import Caller, hash_secret, new_secret
from . import licensing, pairing


def _aware(value: datetime | None) -> datetime | None:
    return value if value is None or value.tzinfo else value.replace(tzinfo=UTC)


def _admin_branch(session: Session, shop_id: str) -> Branch | None:
    return session.scalars(
        select(Branch).where(Branch.shop_id == shop_id, Branch.is_admin.is_(True)).limit(1)
    ).first()


def _credentials(shop: Shop, branch: Branch) -> PairOut:
    secret = new_secret()
    branch.secret_hash = hash_secret(secret)
    branch.token_version += 1  # أي جهاز قديم بنفس الفرع يتوقف فوراً
    return PairOut(branch_id=branch.id, secret=secret, branch_name=branch.name, branch_code=branch.code,
                   shop_id=shop.id, shop_name=shop.name)  # fmt: skip


# ================= التسجيل والاسترجاع =================
def register(session: Session, data: RegisterIn, *, ip: str) -> PairOut:
    lic = licensing.verify(data.license_key)
    shop = session.scalars(select(Shop).where(Shop.license_id == lic.license_id)).first()

    if shop is not None:
        if not data.recover:
            raise Conflict(
                "shop_exists",
                "هذا الترخيص مسجّل له محل بالفعل. إن كان هذا جهازاً جديداً للمالك فاختر «استرجاع المحل»",
            )
        branch = _admin_branch(session, shop.id)
        if branch is None:
            raise Conflict("no_admin_branch", "لا يوجد فرع رئيسي لهذا المحل. تواصل مع الدعم")
        _apply_license(shop, lic)
        out = _credentials(shop, branch)
        branch.is_active = True
        record(session, "shop_recovered", actor="owner", shop_id=shop.id, branch_id=branch.id, ip=ip)
        session.commit()
        return out

    if data.recover:
        raise NotFound("shop_not_found", "لا يوجد محل مسجّل بهذا الترخيص. اختر «محل جديد»")
    shop = Shop(id=str(uuid.uuid4()), name=(data.shop_name or lic.shop_name or "محل").strip(),
                last_seq=0, last_transfer_no=0, license_id=lic.license_id)  # fmt: skip
    _apply_license(shop, lic)
    branch = Branch(
        id=str(uuid.uuid4()), shop_id=shop.id, name=data.branch_name.strip(), code=data.branch_code,
        secret_hash="", last_pushed_seq=0, acked_seq=0, token_version=0, is_admin=True,
    )  # fmt: skip
    session.add_all([shop, branch])
    out = _credentials(shop, branch)
    record(session, "shop_self_registered", actor="owner", shop_id=shop.id, branch_id=branch.id, ip=ip,
           details={"name": shop.name, "plan": lic.plan, "license": lic.license_id[:8]})  # fmt: skip
    try:
        session.commit()
    except IntegrityError as exc:  # نفس الترخيص من جهازين في نفس اللحظة
        session.rollback()
        raise Conflict("shop_exists", "هذا الترخيص مسجّل له محل بالفعل") from exc
    return out


def _apply_license(shop: Shop, lic: licensing.License) -> None:
    current = _aware(shop.license_expires_at)
    if current is None or lic.expires_at > current:
        shop.license_expires_at = lic.expires_at
    shop.license_plan = lic.plan


def renew(session: Session, caller: Caller, key: str) -> ShopInfoOut:
    shop, branch = _admin(session, caller)
    lic = licensing.verify(key)
    if shop.license_id != lic.license_id:
        raise Forbidden("license_mismatch", "هذا المفتاح يخص ترخيصاً آخر غير ترخيص المحل")
    _apply_license(shop, lic)
    record(session, "license_renewed", actor="owner", shop_id=shop.id, branch_id=branch.id, ip=caller.ip,
           details={"expires_at": shop.license_expires_at.isoformat() if shop.license_expires_at else None})  # fmt: skip
    session.commit()
    return info(session, caller)


# ================= إدارة الفروع (الفرع الرئيسي فقط) =================
def _admin(session: Session, caller: Caller) -> tuple[Shop, Branch]:
    branch = session.get(Branch, caller.branch_id)
    shop = session.get(Shop, caller.shop_id)
    if branch is None or shop is None or not branch.is_admin:
        raise Forbidden("not_admin_branch", "إدارة الفروع من الجهاز الرئيسي للمالك فقط")
    return shop, branch


def _target(session: Session, shop: Shop, branch_id: str) -> Branch:
    target = session.get(Branch, branch_id)
    if target is None or target.shop_id != shop.id:
        raise NotFound("branch_not_found", "الفرع غير موجود")
    return target


def info(session: Session, caller: Caller) -> ShopInfoOut:
    shop = session.get(Shop, caller.shop_id)
    branch = session.get(Branch, caller.branch_id)
    count = session.scalar(select(func.count()).select_from(Branch).where(Branch.shop_id == shop.id)) or 0
    return ShopInfoOut(
        shop_id=shop.id, shop_name=shop.name, is_admin=bool(branch and branch.is_admin),
        license_plan=shop.license_plan, license_expires_at=_aware(shop.license_expires_at),
        branches=count, max_branches=get_settings().max_branches_per_shop,
    )  # fmt: skip


def list_branches(session: Session, caller: Caller) -> list[AdminBranchOut]:
    shop, _ = _admin(session, caller)
    window = timedelta(seconds=get_settings().online_window_seconds)
    now = utcnow()
    rows = session.scalars(select(Branch).where(Branch.shop_id == shop.id).order_by(Branch.created_at)).all()
    return [
        AdminBranchOut(
            id=b.id, name=b.name, code=b.code, is_active=b.is_active, is_admin=b.is_admin,
            is_me=b.id == caller.branch_id, last_seen_at=_aware(b.last_seen_at),
            online=bool(b.is_active and b.last_seen_at and now - _aware(b.last_seen_at) <= window),
            paired=b.token_version > 0 and b.secret_hash != "",
        )  # fmt: skip
        for b in rows
    ]


def create_branch(session: Session, caller: Caller, data: BranchIn) -> NewBranchOut:
    shop, _ = _admin(session, caller)
    limit = get_settings().max_branches_per_shop
    count = session.scalar(select(func.count()).select_from(Branch).where(Branch.shop_id == shop.id)) or 0
    if count >= limit:
        raise BadRequest("branch_limit", f"وصلت للحد الأقصى ({limit} فرعاً)")
    branch = Branch(
        id=str(uuid.uuid4()), shop_id=shop.id, name=data.name.strip(), code=data.code,
        # لا سر صالح حتى يُربط الجهاز بكود (السر يُولَّد عند الربط).
        secret_hash="", last_pushed_seq=0, acked_seq=0, token_version=0,
    )  # fmt: skip
    session.add(branch)
    record(session, "branch_created", actor="owner", shop_id=shop.id, branch_id=branch.id, ip=caller.ip,
           details={"name": branch.name, "code": branch.code})  # fmt: skip
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise Conflict("branch_code_taken", "كود الفرع مستخدم في هذا المحل") from exc
    code = pairing.create_code(session, branch.id, ip=caller.ip, actor="owner")
    return NewBranchOut(branch=_one(session, caller, branch.id), pairing=code)


def _one(session: Session, caller: Caller, branch_id: str) -> AdminBranchOut:
    return next(b for b in list_branches(session, caller) if b.id == branch_id)


def pairing_code(session: Session, caller: Caller, branch_id: str) -> PairingCodeOut:
    shop, me = _admin(session, caller)
    target = _target(session, shop, branch_id)
    if target.id == me.id:
        raise BadRequest("self_pairing", "لا يمكن إصدار كود ربط للفرع الرئيسي نفسه")
    return pairing.create_code(session, target.id, ip=caller.ip, actor="owner")


def update_branch(
    session: Session, caller: Caller, branch_id: str, *, name: str | None, is_active: bool | None
) -> AdminBranchOut:
    shop, me = _admin(session, caller)
    target = _target(session, shop, branch_id)
    if target.id == me.id and is_active is False:
        raise BadRequest("self_disable", "لا يمكن إيقاف الفرع الرئيسي")
    if name is not None:
        target.name = name.strip()
    if is_active is not None:
        target.is_active = is_active
    record(session, "branch_updated", actor="owner", shop_id=shop.id, branch_id=target.id, ip=caller.ip,
           details={"name": name, "is_active": is_active})  # fmt: skip
    session.commit()
    return _one(session, caller, target.id)


def revoke_device(session: Session, caller: Caller, branch_id: str) -> AdminBranchOut:
    """إلغاء ربط جهاز الفرع (ضاع أو اتسرق أو هيتغير): يتوقف فوراً، ويُربط جهاز جديد بكود جديد."""
    shop, me = _admin(session, caller)
    target = _target(session, shop, branch_id)
    if target.id == me.id:
        raise BadRequest("self_revoke", "لا يمكن إلغاء ربط الجهاز الرئيسي من نفسه")
    target.secret_hash = ""
    target.token_version += 1
    record(session, "device_revoked", actor="owner", shop_id=shop.id, branch_id=target.id, ip=caller.ip)
    session.commit()
    return _one(session, caller, target.id)
