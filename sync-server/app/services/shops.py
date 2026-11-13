"""إدارة المحلات والفروع (لك أنت كمورّد البرنامج): الإنشاء، الإيقاف، وأسرار الدخول."""

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..audit import record
from ..errors import Conflict, NotFound
from ..models import Branch, Shop
from ..schemas import BranchCredentials, BranchIn, BranchOut, BranchPatch, ShopIn, ShopOut, ShopPatch
from ..security import hash_secret, new_secret


def branch_out(b: Branch) -> BranchOut:
    return BranchOut(
        id=b.id,
        shop_id=b.shop_id,
        name=b.name,
        code=b.code,
        is_active=b.is_active,
        last_seen_at=b.last_seen_at,
        last_pushed_seq=b.last_pushed_seq,
        acked_seq=b.acked_seq,
    )


def shop_out(s: Shop) -> ShopOut:
    return ShopOut(
        id=s.id,
        name=s.name,
        is_active=s.is_active,
        last_seq=s.last_seq,
        created_at=s.created_at,
        branches=[branch_out(b) for b in s.branches],
    )


def _shop(session: Session, shop_id: str) -> Shop:
    shop = session.get(Shop, shop_id)
    if shop is None:
        raise NotFound("shop_not_found", "المحل غير موجود")
    return shop


def _branch(session: Session, branch_id: str) -> Branch:
    branch = session.get(Branch, branch_id)
    if branch is None:
        raise NotFound("branch_not_found", "الفرع غير موجود")
    return branch


def list_shops(session: Session) -> list[ShopOut]:
    return [shop_out(s) for s in session.scalars(select(Shop).order_by(Shop.created_at)).all()]


def create_shop(session: Session, data: ShopIn, *, ip: str | None = None) -> ShopOut:
    shop = Shop(id=str(uuid.uuid4()), name=data.name.strip(), last_seq=0, last_transfer_no=0)
    session.add(shop)
    record(session, "shop_created", actor="admin", shop_id=shop.id, ip=ip, details={"name": shop.name})
    session.commit()
    return shop_out(shop)


def update_shop(session: Session, shop_id: str, data: ShopPatch, *, ip: str | None = None) -> ShopOut:
    shop = _shop(session, shop_id)
    if data.name is not None:
        shop.name = data.name.strip()
    if data.is_active is not None:
        shop.is_active = data.is_active
    record(
        session, "shop_updated", actor="admin", shop_id=shop.id, ip=ip,
        details=data.model_dump(exclude_none=True),
    )  # fmt: skip
    session.commit()
    return shop_out(shop)


def create_branch(
    session: Session, shop_id: str, data: BranchIn, *, ip: str | None = None
) -> BranchCredentials:
    _shop(session, shop_id)
    secret = new_secret()
    branch = Branch(
        id=str(uuid.uuid4()),
        shop_id=shop_id,
        name=data.name.strip(),
        code=data.code,
        secret_hash=hash_secret(secret),
        last_pushed_seq=0,
        acked_seq=0,
        token_version=1,
    )
    session.add(branch)
    record(
        session, "branch_created", actor="admin", shop_id=shop_id, branch_id=branch.id, ip=ip,
        details={"name": branch.name, "code": branch.code},
    )  # fmt: skip
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise Conflict("branch_code_taken", "كود الفرع مستخدم في هذا المحل") from exc
    return BranchCredentials(branch=branch_out(branch), branch_id=branch.id, secret=secret)


def update_branch(
    session: Session, branch_id: str, data: BranchPatch, *, ip: str | None = None
) -> BranchOut:
    branch = _branch(session, branch_id)
    if data.name is not None:
        branch.name = data.name.strip()
    if data.is_active is not None:
        branch.is_active = data.is_active
    record(
        session, "branch_updated", actor="admin", shop_id=branch.shop_id, branch_id=branch.id,
        ip=ip, details=data.model_dump(exclude_none=True),
    )  # fmt: skip
    session.commit()
    return branch_out(branch)


def rotate_secret(session: Session, branch_id: str, *, ip: str | None = None) -> BranchCredentials:
    """سر جديد (جهاز ضاع أو اتسرّق). السر القديم وكل التوكنات الحالية تتوقف فوراً."""
    branch = _branch(session, branch_id)
    secret = new_secret()
    branch.secret_hash = hash_secret(secret)
    branch.token_version += 1
    record(session, "secret_rotated", actor="admin", shop_id=branch.shop_id, branch_id=branch.id, ip=ip)
    session.commit()
    return BranchCredentials(branch=branch_out(branch), branch_id=branch.id, secret=secret)
