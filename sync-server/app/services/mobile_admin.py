"""أمان المحل عن بُعد من الهاتف — للمالك فقط (المدير يأخذ 403 owner_only ولا يرى الشاشات أصلاً).

- الموظفون: نفس إدارة الموظفين المركزية للمالك (services/staff) بنفس قواعدها. الإيقاف يزيد seq الكتالوج،
  فيصل لأجهزة الفروع مع المزامنة الموجودة، وجهاز الفرع يوقف الحساب ويقفل جلساته المفتوحة.
  جلسات الهاتف للمدير الموقوف تتوقف فوراً (كل طلب يعيد فحص الحساب).
- أجهزة الفروع: إلغاء ربط جهاز (نفس revoke: سر فارغ + token_version، فيتوقف فوراً) وكود ربط لفرع.
  الفرق الوحيد عن البرنامج: الهاتف ليس «الجهاز نفسه»، فالمالك يقدر يلغي الجهاز الرئيسي لو اتسرق (يسترجعه
  بمفتاح الترخيص على جهاز جديد). كود الربط للفرع الرئيسي ممنوع كما في البرنامج (حتى لا يُسرق بكود).
- جلسات تطبيق الهاتف لكل المستخدمين: عرض وإلغاء.
كل إجراء في السجل الأمني بـ actor=mobile و from_phone واسم المالك والجهاز.
"""

from datetime import UTC, datetime
from typing import Any

from pydantic import ValidationError
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..audit import record
from ..db import utcnow
from ..errors import BadRequest, Conflict, Forbidden, NotFound
from ..mobile_security import MobileUser
from ..models import Branch, CatalogItem, MobileSession
from ..schemas import (
    BranchRef,
    CatalogProductOut,
    MobileDeviceOut,
    MobileShopSessionOut,
    MobileStaffOut,
    PairingCodeOut,
    PriceUpdateIn,
    StaffPatch,
)
from ..security import Caller
from . import pairing, staff
from .catalog import _validate
from .events import lock_shop
from .mobile_auth import _revoke
from .mobile_reports import branch_status
from .self_service import _admin_branch


def _aware(value: datetime | None) -> datetime | None:
    return value if value is None or value.tzinfo else value.replace(tzinfo=UTC)


def require_owner(user: MobileUser) -> None:
    if user.role != "owner":
        raise Forbidden("owner_only", "هذه الشاشة لمالك المحل فقط")


def _via(user: MobileUser) -> dict[str, Any]:
    return {"from_phone": True, "username": user.username, "session_id": user.session_id, "device": user.device_name}


def _owner_caller(session: Session, user: MobileUser) -> Caller:
    """إدارة الموظفين المركزية تعمل باسم الفرع الرئيسي (نفس مسار البرنامج)."""
    main = _admin_branch(session, user.shop_id)
    if main is None:
        raise BadRequest("no_main_branch", "المحل ليس له جهاز رئيسي. حدّده أولاً من إعدادات الفروع في البرنامج")
    return Caller(branch_id=main.id, shop_id=user.shop_id, branch_name=main.name, token_exp=utcnow(), ip=user.ip)


# ================= الموظفون =================
def list_staff(session: Session, user: MobileUser) -> list[MobileStaffOut]:
    require_owner(user)
    caller = _owner_caller(session, user)
    names = dict(session.execute(select(Branch.id, Branch.name).where(Branch.shop_id == user.shop_id)).all())
    return [
        MobileStaffOut(
            id=s.id,
            username=s.username,
            role=s.role,
            is_active=s.is_active,
            branches=[BranchRef(id=b, name=names.get(b, "فرع محذوف")) for b in s.branches],
            updated_at=_aware(s.updated_at),
        )
        for s in staff.list_staff(session, caller)
    ]


def set_staff_active(session: Session, user: MobileUser, staff_id: str, active: bool) -> MobileStaffOut:
    """إيقاف (أو إعادة تفعيل) موظف بنفس update المركزي: يصل للفروع مع المزامنة. نفس الحالة = لا تغيير."""
    require_owner(user)
    caller = _owner_caller(session, user)
    staff.update(session, caller, staff_id, StaffPatch.model_validate({"is_active": active}), via=_via(user))
    return next(s for s in list_staff(session, user) if s.id == staff_id)


# ================= أجهزة الفروع =================
def _device_out(b: Branch, now: datetime) -> MobileDeviceOut:
    status, ago = branch_status(b, now)
    return MobileDeviceOut(
        id=b.id, name=b.name, code=b.code, is_active=b.is_active, is_admin=b.is_admin,
        paired=b.token_version > 0 and b.secret_hash != "", status=status,  # type: ignore[arg-type]
        last_seen_at=_aware(b.last_seen_at), seconds_since_seen=ago,
    )  # fmt: skip


def list_devices(session: Session, user: MobileUser) -> list[MobileDeviceOut]:
    require_owner(user)
    now = utcnow()
    rows = session.scalars(select(Branch).where(Branch.shop_id == user.shop_id).order_by(Branch.created_at)).all()
    return [_device_out(b, now) for b in rows]


def _branch(session: Session, user: MobileUser, branch_id: str) -> Branch:
    b = session.get(Branch, branch_id)
    if b is None or b.shop_id != user.shop_id:
        raise NotFound("branch_not_found", "الفرع غير موجود")
    return b


def revoke_device(session: Session, user: MobileUser, branch_id: str) -> MobileDeviceOut:
    """جهاز مسروق/مفقود: يتوقف فوراً (كل توكناته ترفض token_revoked)، ويُربط جهاز جديد بكود جديد."""
    require_owner(user)
    b = _branch(session, user, branch_id)
    if b.token_version == 0 or b.secret_hash == "":
        return _device_out(b, utcnow())  # لا جهاز مربوط أصلاً
    b.secret_hash = ""
    b.token_version += 1
    record(session, "device_revoked", actor="mobile", shop_id=user.shop_id, branch_id=b.id, ip=user.ip,
           details={**_via(user), "main_device": b.is_admin})  # fmt: skip
    session.commit()
    return _device_out(b, utcnow())


def pairing_code(session: Session, user: MobileUser, branch_id: str) -> PairingCodeOut:
    require_owner(user)
    b = _branch(session, user, branch_id)
    if b.is_admin:
        # كما في البرنامج: الجهاز الرئيسي لا يُربط بكود (يُسترجع بمفتاح الترخيص فقط).
        raise BadRequest("main_branch_pairing", "الجهاز الرئيسي يُسترجع بمفتاح الترخيص على الجهاز الجديد، لا بكود ربط")
    return pairing.create_code(session, b.id, ip=user.ip, actor="mobile", details=_via(user))


# ================= جلسات تطبيق الهاتف =================
def list_sessions(session: Session, user: MobileUser) -> list[MobileShopSessionOut]:
    require_owner(user)
    now = utcnow()
    rows = session.scalars(
        select(MobileSession)
        .where(MobileSession.shop_id == user.shop_id, MobileSession.revoked_at.is_(None))
        .order_by(MobileSession.username, MobileSession.created_at)
    ).all()
    return [
        MobileShopSessionOut(
            id=s.id,
            username=s.username,
            device_name=s.device_name,
            platform=s.platform,
            created_at=s.created_at,
            last_used_at=_aware(s.last_used_at),
            is_current=s.id == user.session_id,
        )
        for s in rows
        if (_aware(s.refresh_expires_at) or now) > now  # المنتهية لا تُحسب جلسة
    ]


def revoke_session(session: Session, user: MobileUser, session_id: str) -> None:
    require_owner(user)
    ms = session.get(MobileSession, session_id)
    if ms is None or ms.shop_id != user.shop_id:
        raise NotFound("session_not_found", "الجلسة غير موجودة")
    if ms.revoked_at is not None:
        return
    _revoke(ms, "owner_revoked")
    record(session, "mobile_session_revoked", actor="mobile", shop_id=user.shop_id, ip=user.ip,
           details={**_via(user), "target_session": ms.id, "target_user": ms.username,
                    "target_device": ms.device_name})  # fmt: skip
    session.commit()


# ================= أسعار الأصناف المشتركة =================
def _product_out(session: Session, row: CatalogItem) -> CatalogProductOut:
    d = row.data or {}
    by = None
    if row.updated_by_branch_id:
        b = session.get(Branch, row.updated_by_branch_id)
        by = b.name if b else None
    elif row.version > 1:
        by = "الهاتف"
    return CatalogProductOut(
        gid=row.id, name=d.get("name", ""), barcode=d.get("barcode"), unit=d.get("unit", ""),
        sale_price=int(d.get("sale_price") or 0), wholesale_price=d.get("wholesale_price"),
        wholesale_min_qty=d.get("wholesale_min_qty"), is_active=bool(d.get("is_active", True)),
        version=row.version, updated_at=_aware(row.updated_at), updated_by=by,
    )  # fmt: skip


def search_products(session: Session, user: MobileUser, q: str, limit: int = 30) -> list[CatalogProductOut]:
    """بحث في الكتالوج المشترك بالاسم (يحتوي) أو الباركود (يبدأ بـ). صنف غير مربوط بالكتالوج لا يظهر."""
    require_owner(user)
    text = " ".join(q.split())
    if len(text) < 2:
        return []
    name = CatalogItem.data["name"].as_string()
    barcode = CatalogItem.data["barcode"].as_string()
    rows = session.scalars(
        select(CatalogItem).where(
            CatalogItem.shop_id == user.shop_id, CatalogItem.kind == "product", CatalogItem.deleted.is_(False),
            or_(name.contains(text, autoescape=True), barcode.startswith(text, autoescape=True)),
        ).order_by(name).limit(limit)
    ).all()  # fmt: skip
    return [_product_out(session, r) for r in rows]


def update_price(session: Session, user: MobileUser, gid: str, data: PriceUpdateIn) -> CatalogProductOut:
    """تعديل سعر البيع/الجملة لكل الفروع. نسخة (version) قديمة = تعدّل من فرع آخر ← 409 بلا كتابة فوقه.
    يأخذ seq كتالوج جديد، فيصل لكل الفروع مع المزامنة الحالية. الفواتير السابقة لا تتأثر (السعر محفوظ في سطرها)."""
    require_owner(user)
    shop = lock_shop(session, user.shop_id)
    row = session.execute(select(CatalogItem).where(CatalogItem.id == gid).with_for_update()).scalar_one_or_none()
    if row is None or row.shop_id != user.shop_id or row.kind != "product" or row.deleted:
        raise NotFound("product_not_found", "الصنف غير موجود في الكتالوج المشترك")
    if row.version != data.version:
        raise Conflict(
            "catalog_changed", "تعدّل هذا الصنف من فرع آخر بعد فتحك له. راجع السعر الحالي ثم عدّل من جديد",
            {"product": _product_out(session, row).model_dump(mode="json")},
        )
    if data.wholesale_price is not None and data.wholesale_price >= data.sale_price:
        raise BadRequest("wholesale_not_lower", "سعر الجملة يجب أن يكون أقل من سعر البيع (القطاعي)")
    old = row.data or {}
    merged = {**old, "sale_price": data.sale_price, "wholesale_price": data.wholesale_price}
    if data.wholesale_price is None:
        merged["wholesale_min_qty"] = None  # نفس البرنامج: بلا سعر جملة لا حد أدنى له
    try:
        merged = _validate("product", merged)
    except ValidationError as exc:
        raise BadRequest("product_invalid", str(exc.errors()[0].get("msg", "بيانات غير صالحة"))[:200]) from exc
    if merged == old:
        return _product_out(session, row)
    shop.last_catalog_seq += 1
    row.data = merged
    row.version += 1
    row.seq = shop.last_catalog_seq
    row.updated_at = utcnow()
    row.updated_by_branch_id = None  # من الهاتف: كل الفروع تطبّقه (لا فرع «صاحب التعديل»)
    record(session, "catalog_price_updated", actor="mobile", shop_id=user.shop_id, ip=user.ip,
           details={**_via(user), "gid": row.id, "name": merged.get("name"),
                    "sale_price": [old.get("sale_price"), merged["sale_price"]],
                    "wholesale_price": [old.get("wholesale_price"), merged.get("wholesale_price")]})  # fmt: skip
    session.commit()
    return _product_out(session, row)
