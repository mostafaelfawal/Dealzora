"""مزامنة الأصناف والعملاء بين الفروع عبر سيرفر الفروع.

ما يُشارك: بيانات التعريف فقط (الاسم، الباركود، القسم، الوحدات، سعر البيع والجملة، كود
الميزان، تتبع الصلاحية، الإيقاف؛ والعميل: الاسم، التليفون، العنوان، الملاحظات، حد الائتمان،
عميل جملة). ما لا يُشارك أبداً: المخزون، التكلفة، حد الطلب، ديون العملاء ونقاطهم ومشترياتهم.

حساب المالك: واحد لكل الفروع. يمر اسم المستخدم وتجزئة كلمة المرور (Argon2id) والتفعيل فقط،
ونرفع حسابات المالك وحدها (المديرون والكاشيرية خاصين بكل فرع). تغيير كلمة السر أو الإيقاف
من فرع يلغي جلسات المالك المفتوحة في باقي الفروع.

موظفو الفروع (مدير/كاشير): كل موظف مربوط بفروع (branches) من إدارة المالك المركزية. الفرع يطبّق
موظفيه فقط، ويحذف من نُقل منه (وتُقفل جلساته)، ويرفع موظفيه المحليين لنفسه فقط.

الدورة (run): 1) إعادة تطبيق ما فشل سابقاً  2) سحب تغييرات السيرفر وتطبيقها  3) رفع تعديلاتنا.
- لا معاملة مفتوحة أثناء الاتصال بالسيرفر (commit قبل كل طلب): الكاشير لا يتعطل.
- كل سجل يُطبَّق داخل savepoint: سجل فاشل (باركود محجوز محلياً مثلاً) يُسجَّل كخطأ ولا يوقف الباقي.
- التطبيق يمر بنفس تحقق شاشة الأصناف/العملاء (ProductCreate/CustomerUpdate...): بيانات
  غير صالحة من فرع آخر لا تدخل قاعدتنا أبداً.
- تعديل محلي لم يُرفع + تعديل من فرع آخر على نفس السجل: حقولنا المتغيرة تبقى وتُرفع،
  وباقي الحقول تأخذ قيمة السيرفر.
"""

import hashlib
import json
import threading
from collections.abc import Callable, Iterator
from datetime import timedelta
from typing import Any

from pydantic import ValidationError
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.base import utcnow, uuid7
from app.core.errors import AppError, ConflictError
from app.core.security import Actor, Role
from app.core.snapshots import diff_snapshots
from app.modules.customers.model import Customer
from app.modules.customers.schema import CustomerCreate, CustomerUpdate
from app.modules.customers.service import CustomerService
from app.modules.products.model import Category, Product
from app.modules.products.schema import ProductCreate, ProductUpdate, UnitIn
from app.modules.products.service import ProductService
from app.modules.users.model import User

from .client import RemoteError, SyncAuthLost, SyncClient, SyncUnavailable
from .model import CatalogLink, CatalogState

PRODUCT, CUSTOMER, OWNER, STAFF = "product", "customer", "owner", "staff"
KINDS = (PRODUCT, CUSTOMER, OWNER, STAFF)
STAFF_ROLES = (Role.MANAGER.value, Role.CASHIER.value)
PUSH_BATCH = 200
PULL_PAGE = 500
MAX_PAGES = 40  # حتى 20 ألف تغيير في الدورة الواحدة، والباقي في الدورة التالية
SCAN_OVERLAP = timedelta(seconds=5)

_run_lock = threading.Lock()


# ================= استخراج البيانات المشتركة =================
def product_data(p: Product) -> dict[str, Any]:
    category = p.category.name if p.category is not None and p.category.deleted_at is None else None
    units = sorted(
        ({"name": u.name, "factor": u.factor, "barcode": u.barcode, "sale_price": u.sale_price} for u in p.units),
        key=lambda u: (u["name"], u["factor"]),
    )
    return {
        "name": p.name,
        "barcode": p.barcode,
        "category": category,
        "unit": p.unit,
        "allow_decimal": p.allow_decimal,
        "sale_price": p.sale_price,
        "scale_code": p.scale_code,
        "wholesale_price": p.wholesale_price,
        "wholesale_min_qty": p.wholesale_min_qty,
        "track_expiry": p.track_expiry,
        "is_active": p.is_active,
        "units": units,
    }


def customer_data(c: Customer) -> dict[str, Any]:
    return {
        "name": c.name,
        "phone": c.phone,
        "address": c.address or "",
        "notes": c.notes or "",
        "credit_limit": c.credit_limit,
        "is_wholesale": c.is_wholesale,
        "is_active": c.is_active,
    }


def owner_data(u: User) -> dict[str, Any]:
    return {"username": u.username, "password_hash": u.password_hash, "is_active": u.is_active}


def staff_data(u: User) -> dict[str, Any]:
    """بدون الفروع: الفرع لا يعرف إلا نفسه، والفروع تأتي من آخر نسخة متفق عليها مع السيرفر."""
    return {"username": u.username, "password_hash": u.password_hash, "role": u.role, "is_active": u.is_active}


EXTRACT: dict[str, Callable[[Any], dict[str, Any]]] = {
    PRODUCT: product_data, CUSTOMER: customer_data, OWNER: owner_data, STAFF: staff_data,
}  # fmt: skip
MODEL: dict[str, type] = {PRODUCT: Product, CUSTOMER: Customer, OWNER: User, STAFF: User}


def display_name(row: Any) -> str:
    return getattr(row, "name", None) or getattr(row, "username", "") or ""


def digest(data: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def match_key(kind: str, data: dict[str, Any]) -> str | None:
    """نفس مفتاح الدمج على السيرفر."""
    if kind == PRODUCT:
        if data.get("barcode"):
            return "b:" + str(data["barcode"]).strip()
        name = " ".join(str(data.get("name", "")).split()).casefold()
        return "n:" + name if name else None
    if kind in (OWNER, STAFF):
        name = str(data.get("username") or "").strip().lower()
        return "u:" + name if name else None
    phone = "".join(ch for ch in str(data.get("phone") or "") if ch.isdigit())
    return "p:" + phone if phone else None


def _message(exc: Exception) -> str:
    if isinstance(exc, AppError):
        return exc.message
    if isinstance(exc, ValidationError):
        first = exc.errors()[0] if exc.errors() else {}
        return f"بيانات غير صالحة: {str(first.get('msg', ''))[:150]}"
    return str(exc)[:200] or "خطأ غير متوقع"


def _chunks(items: list, size: int) -> Iterator[list]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


# ================= ربط الأصناف في التحويلات =================
def local_product_id(session: Session, gid: str | None) -> str | None:
    """المعرّف المحلي لصنف بمعرّفه العام (لو مربوط)."""
    if not gid:
        return None
    return session.scalar(
        select(CatalogLink.local_id).where(CatalogLink.kind == PRODUCT, CatalogLink.gid == gid)
    )


def global_product_id(session: Session, local_id: str) -> str:
    """المعرّف العام لصنف محلي (لو مربوط)، وإلا المحلي نفسه."""
    gid = session.scalar(
        select(CatalogLink.gid).where(CatalogLink.kind == PRODUCT, CatalogLink.local_id == local_id)
    )
    return gid or local_id


# ================= المحرك =================
class CatalogSync:
    def __init__(self, session: Session, actor: Actor, client: SyncClient, branch_id: str) -> None:
        self.session = session
        self.actor = actor
        self.client = client
        self.branch_id = branch_id
        self.products = ProductService(session, actor)
        self.customers = CustomerService(session, actor)
        self.stats = {"pulled": 0, "applied": 0, "pushed": 0, "errors": 0}

    # ---------- الدورة ----------
    def run(self) -> dict[str, Any]:
        if not _run_lock.acquire(blocking=False):
            return {"ok": True, "running": True, **self.stats}
        try:
            state = self._state()
            try:
                self._retry_failed()
                self._pull(state)
                self._push(state)
            except (SyncUnavailable, SyncAuthLost, RemoteError) as exc:
                self.session.rollback()
                state = self._state()
                state.last_error = (
                    "سيرفر الفروع غير متاح الآن" if isinstance(exc, SyncUnavailable)
                    else "أُلغي الربط من السيرفر: أعد ربط الفرع بكود جديد" if isinstance(exc, SyncAuthLost)
                    else exc.message
                )  # fmt: skip
                self.session.commit()
                return {"ok": False, "error": state.last_error, "unpaired": isinstance(exc, SyncAuthLost),
                        **self.stats}  # fmt: skip
            state.last_sync_at = utcnow()
            state.last_error = None
            self.session.commit()
            return {"ok": True, **self.stats}
        finally:
            _run_lock.release()

    def _state(self) -> CatalogState:
        state = self.session.get(CatalogState, "catalog")
        if state is None or state.branch_id != self.branch_id:
            # أول مرة، أو الجهاز اتربط بفرع/محل آخر: الروابط القديمة لا تخص المحل الجديد.
            self.session.execute(delete(CatalogLink))
            if state is None:
                state = CatalogState(id="catalog", branch_id=self.branch_id)
                self.session.add(state)
            state.branch_id = self.branch_id
            state.after = 0
            state.scan_at = None
            state.last_sync_at = None
            state.last_error = None
            self.session.commit()
        return state

    # ---------- السحب ----------
    def _pull(self, state: CatalogState) -> None:
        for _ in range(MAX_PAGES):
            after = state.after or 0
            self.session.commit()  # لا معاملة مفتوحة أثناء الشبكة
            page = self.client.call("GET", "/catalog/pull", params={"after": after, "limit": PULL_PAGE})
            for item in page.get("items") or []:
                self.stats["pulled"] += 1
                self._apply_remote(item)
            state.after = int(page.get("next_after") or after)
            self.session.commit()
            if not page.get("has_more"):
                return

    def _retry_failed(self) -> None:
        links = self.session.scalars(select(CatalogLink).where(CatalogLink.remote.is_not(None))).all()
        for link in links:
            self._apply_remote(dict(link.remote or {}))
        self.session.commit()

    def _apply_remote(self, item: dict[str, Any]) -> None:
        kind, gid = item.get("kind"), item.get("gid")
        if kind not in KINDS or not isinstance(gid, str) or not gid:
            return
        version = int(item.get("version") or 0)
        link = self._link(kind, gid=gid)
        if link is not None and link.local_id and link.remote is None and link.version >= version:
            return  # صدى رفعنا نحن، أو طبّقناه قبل كده
        try:
            with self.session.begin_nested():
                self._apply(kind, gid, version, item.get("data") or {}, bool(item.get("deleted")), link)
            self.stats["applied"] += 1
        except (AppError, ValidationError, ValueError) as exc:
            link = self._link(kind, gid=gid) or self._new_link(kind, gid=gid)
            link.remote = item
            link.error = _message(exc)
            self.stats["errors"] += 1

    def _apply(
        self, kind: str, gid: str, version: int, data: dict[str, Any], deleted: bool,
        link: CatalogLink | None,
    ) -> None:  # fmt: skip
        if kind == STAFF and self.branch_id not in (data.get("branches") or []):
            deleted = True  # نُقل لفرع آخر أو لا يخصنا: يُحذف من هنا (لو موجود)
        row = self._local_row(kind, gid, link, data)
        if row is not None and row.deleted_at is not None:
            # محذوف عندنا: لا نرجّعه، والرفع يبلغ السيرفر بالحذف.
            self._bind(kind, gid, row.id, version, data)
            return
        if deleted:
            if row is not None:
                self._retire(kind, row)
            # الحذف جاء من السيرفر: نفك ربط السجل المحلي المحذوف، فلا نرفع «حذفاً» مرتداً
            # (مهم للموظف المنقول لفرع آخر: هو لم يُحذف من المحل).
            keep = row is not None and row.deleted_at is None  # صنف/عميل أُوقف فقط لأن عليه رصيد
            self._bind(kind, gid, row.id if keep else None, version, data)
            return

        target = dict(data)
        if row is not None and link is not None and link.synced and link.local_id == row.id:
            now = EXTRACT[kind](row)
            target.update({f: v for f, v in now.items() if v != link.synced.get(f)})  # تعديلاتنا تبقى
        if row is None:
            row = self._create(kind, gid, target)
        else:
            self._update(kind, row, target)
        self._bind(kind, gid, row.id, version, data)

    def _local_row(self, kind: str, gid: str, link: CatalogLink | None, data: dict[str, Any]) -> Any:
        model = MODEL[kind]
        if link is not None and link.local_id:
            row = self.session.get(model, link.local_id)
            if row is not None:
                return row
        taken = select(CatalogLink.local_id).where(
            CatalogLink.kind == kind, CatalogLink.gid.is_not(None), CatalogLink.gid != gid,
            CatalogLink.local_id.is_not(None),
        )  # fmt: skip
        row = self.session.get(model, gid)
        if row is not None and not self.session.scalar(select(CatalogLink.id).where(
            CatalogLink.kind == kind, CatalogLink.local_id == row.id, CatalogLink.gid.is_not(None),
            CatalogLink.gid != gid,
        )):  # fmt: skip
            return row
        # أول ربط: نفس الصنف موجود عندنا قبل الربط (بالباركود أو الاسم) أو العميل (بالتليفون).
        key = match_key(kind, data)
        if not key:
            return None
        if kind == STAFF:
            user = self.session.scalars(
                select(User).where(User.username == key[2:], User.deleted_at.is_(None), User.id.not_in(taken))
            ).first()
            if user is not None and user.role == Role.OWNER.value:
                raise ConflictError("staff_username_taken", f"اسم المستخدم «{user.username}» هو حساب المالك")
            return user
        if kind == OWNER:
            user = self.session.scalars(
                select(User).where(User.username == key[2:], User.deleted_at.is_(None), User.id.not_in(taken))
            ).first()
            if user is not None and user.role != Role.OWNER.value:
                raise ConflictError(
                    "owner_username_taken",
                    f"اسم المستخدم «{user.username}» مستخدم لمدير أو كاشير في هذا الفرع. غيّر اسمه ليصل حساب المالك",
                )
            return user
        if kind == PRODUCT:
            if key.startswith("b:"):
                cond = Product.barcode == key[2:]
            else:
                cond = Product.barcode.is_(None)
            candidates = self.session.scalars(
                select(Product).where(cond, Product.deleted_at.is_(None), Product.id.not_in(taken)).limit(500)
            ).all()
            if key.startswith("n:"):
                candidates = [p for p in candidates if match_key(PRODUCT, {"name": p.name}) == key]
        else:
            candidates = [
                c for c in self.session.scalars(
                    select(Customer).where(Customer.phone.is_not(None), Customer.deleted_at.is_(None),
                                           Customer.id.not_in(taken))
                ).all()
                if match_key(CUSTOMER, {"phone": c.phone}) == key
            ]  # fmt: skip
        return candidates[0] if len(candidates) == 1 else None

    # ---------- تطبيق على الأصناف ----------
    def _category_id(self, name: str | None) -> str | None:
        name = (name or "").strip()[:80]
        if not name:
            return None
        cat = self.session.scalars(
            select(Category).where(Category.name == name, Category.deleted_at.is_(None)).limit(1)
        ).first()
        if cat is None:
            cat = Category(id=uuid7(), name=name, sort_order=0, device_id=self.actor.device_id,
                           created_by=self.actor.user_id)  # fmt: skip
            self.session.add(cat)
            self.session.flush()
        return cat.id

    def _product_in(self, d: dict[str, Any], row: Product | None) -> ProductCreate | ProductUpdate:
        existing = {u.name: u.id for u in row.units} if row is not None else {}
        units = [
            UnitIn(id=existing.get(u.get("name")), name=u.get("name"), factor=u.get("factor"),
                   barcode=u.get("barcode"), sale_price=u.get("sale_price"))
            for u in (d.get("units") or [])
        ]  # fmt: skip
        fields = dict(
            name=d.get("name"), barcode=d.get("barcode"), category_id=self._category_id(d.get("category")),
            unit=d.get("unit"), allow_decimal=bool(d.get("allow_decimal")),
            cost_price=row.cost_price if row is not None else 0, sale_price=d.get("sale_price"),
            min_stock=row.min_stock if row is not None else 0, is_active=d.get("is_active", True),
            scale_code=d.get("scale_code"), wholesale_price=d.get("wholesale_price"),
            wholesale_min_qty=d.get("wholesale_min_qty"), track_expiry=bool(d.get("track_expiry")),
            extra_units=units,
        )  # fmt: skip
        if row is None:
            return ProductCreate(**fields)
        return ProductUpdate(base_version=row.version, **fields)

    def _create_product(self, gid: str, d: dict[str, Any]) -> Product:
        svc = self.products
        data = self._product_in(d, None)
        svc._check_plan(data, new_product=True)
        svc._check_expiry_plan(data)
        svc._check_barcodes(data)
        pid = gid if self.session.get(Product, gid) is None else uuid7()
        product = Product(id=pid, device_id=self.actor.device_id, created_by=self.actor.user_id, stock_qty=0)
        svc._apply_fields(product, data)
        svc._register_units(product, data)
        svc._sync_units(product, data.extra_units)
        svc._refresh_search_text(product)
        self.session.add(product)
        self.session.flush()
        svc._audit(product, "sync_create", svc._snapshot(product))
        svc._enqueue(product, base_version=None)
        return product

    def _update_product(self, product: Product, d: dict[str, Any]) -> None:
        if product_data(product) == {**product_data(product), **d}:
            return
        svc = self.products
        data = self._product_in(d, product)
        svc._check_plan(data, new_product=False)
        svc._check_barcodes(data, exclude_product_id=product.id)
        svc._check_expiry_plan(data, was=product.track_expiry)
        started_tracking = data.track_expiry and not product.track_expiry
        before = svc._snapshot(product)
        svc._apply_fields(product, data)
        svc._register_units(product, data)
        svc._sync_units(product, data.extra_units)
        svc._refresh_search_text(product)
        product.mark_modified()
        self.session.flush()
        if started_tracking:
            from app.modules.batches.engine import BatchEngine

            BatchEngine(self.session, self.actor).reconcile(product)
        svc._audit(product, "sync_update", diff_snapshots(before, svc._snapshot(product)))
        svc._enqueue(product, base_version=None)

    # ---------- تطبيق على العملاء ----------
    @staticmethod
    def _customer_fields(d: dict[str, Any]) -> dict[str, Any]:
        return dict(
            name=d.get("name"), phone=d.get("phone"), address=d.get("address") or "",
            notes=d.get("notes") or "", credit_limit=d.get("credit_limit") or 0,
            is_active=d.get("is_active", True), is_wholesale=bool(d.get("is_wholesale")),
        )  # fmt: skip

    def _create_customer(self, gid: str, d: dict[str, Any]) -> Customer:
        svc = self.customers
        data = CustomerCreate(**self._customer_fields(d))
        svc._check_phone(data.phone)
        cid = gid if self.session.get(Customer, gid) is None else uuid7()
        customer = Customer(id=cid, device_id=self.actor.device_id, created_by=self.actor.user_id,
                            balance=0, total_sales=0)  # fmt: skip
        svc._apply_fields(customer, data)
        svc._refresh_search_text(customer)
        self.session.add(customer)
        self.session.flush()
        svc._audit(customer, "sync_create", svc._snapshot(customer))
        svc._enqueue(customer, base_version=None)
        return customer

    def _update_customer(self, customer: Customer, d: dict[str, Any]) -> None:
        if customer_data(customer) == {**customer_data(customer), **d}:
            return
        svc = self.customers
        data = CustomerUpdate(base_version=customer.version, **self._customer_fields(d))
        svc._check_phone(data.phone, exclude_customer_id=customer.id)
        before = svc._snapshot(customer)
        svc._apply_fields(customer, data)
        svc._refresh_search_text(customer)
        customer.mark_modified()
        self.session.flush()
        svc._audit(customer, "sync_update", diff_snapshots(before, svc._snapshot(customer)))
        svc._enqueue(customer, base_version=None)

    # ---------- حساب المالك ----------
    def _owner_fields(self, d: dict[str, Any]) -> tuple[str, str, bool]:
        import re

        from app.modules.users.constants import USERNAME_PATTERN

        username = str(d.get("username") or "").strip().lower()
        password_hash = str(d.get("password_hash") or "")
        if not re.fullmatch(USERNAME_PATTERN, username) or not password_hash.startswith("$argon2id$"):
            raise ValueError("بيانات الحساب غير صالحة")
        return username, password_hash, bool(d.get("is_active", True))

    def _username_taken(self, username: str, exclude_id: str | None) -> bool:
        q = select(User.id).where(User.username == username, User.deleted_at.is_(None))
        if exclude_id:
            q = q.where(User.id != exclude_id)
        return self.session.scalar(q.limit(1)) is not None

    def _audit_user(self, user: User, action: str, changes: dict | None) -> None:
        record_audit(self.session, self.actor, entity="user", entity_id=user.id, action=action, changes=changes)

    def _end_sessions(self, user_id: str) -> None:
        from app.modules.auth.repository import AuthRepository

        AuthRepository(self.session).delete_user_sessions(user_id)

    def _create_owner(self, gid: str, d: dict[str, Any]) -> User:
        username, password_hash, active = self._owner_fields(d)
        if self._username_taken(username, None):
            raise ConflictError("owner_username_taken", f"اسم المستخدم «{username}» مستخدم في هذا الفرع")
        user = User(
            id=gid if self.session.get(User, gid) is None else uuid7(),
            username=username, password_hash=password_hash, role=Role.OWNER.value, is_active=active,
            device_id=self.actor.device_id, created_by=None, password_changed_at=utcnow(),
        )  # fmt: skip
        self.session.add(user)
        self.session.flush()
        self._audit_user(user, "sync_create", {"username": username, "role": Role.OWNER.value})
        return user

    def _update_owner(self, user: User, d: dict[str, Any]) -> None:
        if user.role != Role.OWNER.value:
            raise ConflictError("owner_username_taken", "الحساب المحلي ليس حساب مالك")
        username, password_hash, active = self._owner_fields(d)
        if (user.username, user.password_hash, user.is_active) == (username, password_hash, active):
            return
        if username != user.username and self._username_taken(username, user.id):
            raise ConflictError("owner_username_taken", f"اسم المستخدم «{username}» مستخدم في هذا الفرع")
        changes: dict[str, Any] = {}
        if username != user.username:
            changes["username"] = {"from": user.username, "to": username}
            user.username = username
        if password_hash != user.password_hash:
            changes["password"] = "changed"  # التجزئة نفسها لا تُسجَّل أبداً
            user.password_hash = password_hash
            user.password_changed_at = utcnow()
            user.failed_attempts = 0
            user.locked_until = None
        if active != user.is_active:
            changes["is_active"] = {"from": user.is_active, "to": active}
            user.is_active = active
        if "password" in changes or not active:
            self._end_sessions(user.id)  # كلمة السر اتغيرت أو الحساب اتوقف: الجلسات القديمة تقفل
        user.mark_modified()
        self._audit_user(user, "sync_update", changes)

    def _retire_owner(self, user: User) -> None:
        if user.role != Role.OWNER.value:
            return
        others = self.session.scalar(
            select(func.count()).select_from(User).where(
                User.role == Role.OWNER.value, User.is_active.is_(True), User.deleted_at.is_(None), User.id != user.id
            )
        )  # fmt: skip
        if not others:
            raise ConflictError("last_owner", "لا يمكن حذف آخر حساب مالك في هذا الفرع")
        self._end_sessions(user.id)
        user.mark_deleted()
        self._audit_user(user, "sync_delete", {"username": user.username})

    # ---------- موظفو الفروع ----------
    def _staff_fields(self, d: dict[str, Any]) -> tuple[str, str, bool, str]:
        username, password_hash, active = self._owner_fields(d)
        role = d.get("role")
        if role not in STAFF_ROLES:
            raise ValueError("دور الموظف غير صالح")
        return username, password_hash, active, role

    def _create_staff(self, gid: str, d: dict[str, Any]) -> User:
        username, password_hash, active, role = self._staff_fields(d)
        if self._username_taken(username, None):
            raise ConflictError("staff_username_taken", f"اسم المستخدم «{username}» مستخدم في هذا الفرع")
        user = User(
            id=gid if self.session.get(User, gid) is None else uuid7(),
            username=username, password_hash=password_hash, role=role, is_active=active,
            device_id=self.actor.device_id, created_by=None, password_changed_at=utcnow(),
        )  # fmt: skip
        self.session.add(user)
        self.session.flush()
        self._audit_user(user, "sync_create", {"username": username, "role": role})
        return user

    def _update_staff(self, user: User, d: dict[str, Any]) -> None:
        if user.role not in STAFF_ROLES:
            raise ConflictError("staff_username_taken", "الحساب المحلي ليس حساب موظف")
        username, password_hash, active, role = self._staff_fields(d)
        if (user.username, user.password_hash, user.is_active, user.role) == (username, password_hash, active, role):
            return
        if username != user.username and self._username_taken(username, user.id):
            raise ConflictError("staff_username_taken", f"اسم المستخدم «{username}» مستخدم في هذا الفرع")
        changes: dict[str, Any] = {}
        for field, new in (("username", username), ("role", role), ("is_active", active)):
            if getattr(user, field) != new:
                changes[field] = {"from": getattr(user, field), "to": new}
                setattr(user, field, new)
        if password_hash != user.password_hash:
            changes["password"] = "changed"
            user.password_hash = password_hash
            user.password_changed_at = utcnow()
            user.failed_attempts = 0
            user.locked_until = None
        if "password" in changes or "role" in changes or not active:
            self._end_sessions(user.id)  # صلاحيات أو كلمة سر جديدة: الجلسات القديمة تقفل
        user.mark_modified()
        self._audit_user(user, "sync_update", changes)

    def _retire_staff(self, user: User) -> None:
        if user.role not in STAFF_ROLES:
            return
        self._end_sessions(user.id)
        user.mark_deleted()
        self._audit_user(user, "sync_delete", {"username": user.username})

    def _create(self, kind: str, gid: str, d: dict[str, Any]) -> Any:
        if kind == STAFF:
            return self._create_staff(gid, d)
        if kind == OWNER:
            return self._create_owner(gid, d)
        return self._create_product(gid, d) if kind == PRODUCT else self._create_customer(gid, d)

    def _update(self, kind: str, row: Any, d: dict[str, Any]) -> None:
        if kind == STAFF:
            self._update_staff(row, d)
        elif kind == OWNER:
            self._update_owner(row, d)
        elif kind == PRODUCT:
            self._update_product(row, d)
        else:
            self._update_customer(row, d)

    def _retire(self, kind: str, row: Any) -> None:
        """اتحذف من فرع آخر: نحذفه عندنا، إلا لو عندنا عليه رصيد/دين فنوقفه بس."""
        if kind == STAFF:
            self._retire_staff(row)
            return
        if kind == OWNER:
            self._retire_owner(row)
            return
        svc = self.products if kind == PRODUCT else self.customers
        busy = row.stock_qty != 0 if kind == PRODUCT else (row.balance != 0 or row.loyalty_points != 0)
        if busy:
            if row.is_active:
                row.is_active = False
                row.mark_modified()
                svc._audit(row, "sync_deactivate", {"is_active": {"from": True, "to": False}})
                svc._enqueue(row, base_version=None)
            return
        row.mark_deleted()
        svc._audit(row, "sync_delete", svc._snapshot(row))
        from app.core.outbox import OutboxOp

        svc._enqueue(row, base_version=None, op=OutboxOp.DELETE)

    # ---------- الروابط ----------
    def _link(self, kind: str, *, gid: str | None = None, local_id: str | None = None) -> CatalogLink | None:
        col = CatalogLink.gid if gid is not None else CatalogLink.local_id
        return self.session.scalars(
            select(CatalogLink).where(CatalogLink.kind == kind, col == (gid if gid is not None else local_id))
        ).first()

    def _new_link(self, kind: str, *, gid: str | None = None, local_id: str | None = None) -> CatalogLink:
        link = CatalogLink(id=uuid7(), kind=kind, gid=gid, local_id=local_id, version=0)
        self.session.add(link)
        self.session.flush()
        return link

    def _bind(self, kind: str, gid: str, local_id: str | None, version: int, synced: dict[str, Any]) -> None:
        by_gid = self._link(kind, gid=gid)
        by_local = self._link(kind, local_id=local_id) if local_id else None
        if by_gid is not None and by_local is not None and by_gid.id != by_local.id:
            self.session.delete(by_local)  # رابط خطأ قديم لنفس السجل المحلي
            self.session.flush()
            by_local = None
        link = by_gid or by_local or self._new_link(kind, gid=gid, local_id=local_id)
        link.gid = gid
        link.local_id = local_id
        link.version = max(version, link.version or 0)
        link.synced = synced
        link.remote = None
        link.error = None
        link.error_hash = None

    # ---------- الرفع ----------
    def _push(self, state: CatalogState) -> None:
        started = utcnow()
        since = state.scan_at - SCAN_OVERLAP if state.scan_at else None
        outgoing: list[dict[str, Any]] = []
        for kind in KINDS:
            outgoing.extend(self._collect(kind, since))
        self.session.commit()
        for chunk in _chunks(outgoing, PUSH_BATCH):
            results = self.client.call("POST", "/catalog/push", body={"items": [o["wire"] for o in chunk]})
            for out, res in zip(chunk, results or [], strict=False):
                try:
                    with self.session.begin_nested():
                        self._handle(out, res)
                except (AppError, ValidationError, ValueError) as exc:
                    self._fail(out, _message(exc))
            self.session.commit()
        state.scan_at = started
        self.session.commit()

    def _collect(self, kind: str, since: Any) -> list[dict[str, Any]]:
        model = MODEL[kind]
        linked = {
            link.local_id: link
            for link in self.session.scalars(
                select(CatalogLink).where(CatalogLink.kind == kind, CatalogLink.local_id.is_not(None))
            ).all()
        }
        synced_ids = select(CatalogLink.local_id).where(
            CatalogLink.kind == kind, CatalogLink.gid.is_not(None), CatalogLink.local_id.is_not(None)
        )
        query = select(model)
        if kind == OWNER:
            query = query.where(User.role == Role.OWNER.value)
        elif kind == STAFF:
            query = query.where(User.role.in_(STAFF_ROLES))
        if since is not None:
            query = query.where(or_(model.updated_at >= since, model.id.not_in(synced_ids)))
        out: list[dict[str, Any]] = []
        for row in self.session.scalars(query).all():
            link = linked.get(row.id)
            if row.deleted_at is not None:
                if link is not None and link.gid:
                    data = link.synced or EXTRACT[kind](row)
                    out.append({"kind": kind, "local_id": row.id, "data": data,
                                "wire": {"kind": kind, "gid": link.gid, "data": data, "deleted": True}})  # fmt: skip
                continue
            data = EXTRACT[kind](row)
            if kind == STAFF:
                data["branches"] = list((link.synced or {}).get("branches") or [self.branch_id]) if link else [self.branch_id]
            h = digest(data)
            if link is not None and link.error_hash == h:
                continue  # فشل قبل كده بنفس البيانات: نستنى تعديل جديد
            if link is None or not link.gid:
                wire = {"kind": kind, "gid": row.id, "data": data, "fields": None}
            else:
                synced = link.synced or {}
                fields = [f for f, v in data.items() if v != synced.get(f)]
                if not fields:
                    continue
                wire = {"kind": kind, "gid": link.gid, "data": data, "fields": fields}
            out.append({"kind": kind, "local_id": row.id, "data": data, "wire": wire})
        return out

    def _handle(self, out: dict[str, Any], res: dict[str, Any]) -> None:
        kind, local_id, sent = out["kind"], out["local_id"], out["data"]
        status = res.get("status")
        gid = res.get("gid") or out["wire"]["gid"]
        version = int(res.get("version") or 0)
        if status == "ok":
            self.stats["pushed"] += 1
            if out["wire"].get("deleted"):
                link = self._link(kind, local_id=local_id)
                if link is not None:
                    self.session.delete(link)
                return
            self._bind(kind, gid, local_id, version, sent)
            server = res.get("data")
            if server and server != sent:
                # السيرفر دمج تعديلنا مع تعديلات فرع آخر على حقول تانية: ناخد النسخة المدموجة.
                self._apply(kind, gid, version, server, False, self._link(kind, gid=gid))
            return
        if status == "merged":
            canonical = res.get("canonical_gid")
            other = self._link(kind, gid=canonical)
            if other is not None and other.local_id and other.local_id != local_id:
                self._fail(out, "مكرر: الصنف/العميل نفسه مسجّل لديك مرتين. ادمجهما أو غيّر الباركود/رقم الهاتف")
                return
            # أول ربط: بيانات السيرفر (أول فرع رفع الصنف) هي المرجع لسجلنا.
            link = self._link(kind, local_id=local_id) or self._new_link(kind, local_id=local_id)
            link.synced = None
            self._apply(kind, canonical, version, res.get("data") or {}, False, link)
            return
        if status == "deleted":
            self._apply(kind, gid, version, {}, True, self._link(kind, gid=gid))
            return
        self._fail(out, res.get("message") or "رفض السيرفر هذا السجل")

    def _fail(self, out: dict[str, Any], message: str) -> None:
        kind, local_id = out["kind"], out["local_id"]
        link = self._link(kind, local_id=local_id) or self._new_link(kind, local_id=local_id)
        link.error = message
        link.error_hash = digest(out["data"])
        self.stats["errors"] += 1


# ================= الحالة للواجهة =================
def catalog_status(session: Session) -> dict[str, Any]:
    state = session.get(CatalogState, "catalog")
    linked = {
        kind: session.scalar(
            select(func.count()).select_from(CatalogLink).where(
                CatalogLink.kind == kind, CatalogLink.gid.is_not(None), CatalogLink.local_id.is_not(None)
            )
        ) or 0
        for kind in KINDS
    }  # fmt: skip
    errors = []
    for link in session.scalars(
        select(CatalogLink).where(CatalogLink.error.is_not(None)).order_by(CatalogLink.updated_at.desc()).limit(30)
    ).all():
        row = session.get(MODEL[link.kind], link.local_id) if link.local_id else None
        remote = (link.remote or {}).get("data") or {}
        name = display_name(row) if row is not None else (remote.get("name") or remote.get("username") or "")
        errors.append({"kind": link.kind, "name": name, "error": link.error, "local_id": link.local_id})
    error_count = session.scalar(
        select(func.count()).select_from(CatalogLink).where(CatalogLink.error.is_not(None))
    ) or 0
    return {
        "last_sync_at": state.last_sync_at if state else None,
        "last_error": state.last_error if state else None,
        "products": linked[PRODUCT],
        "customers": linked[CUSTOMER],
        "owners": linked[OWNER],
        "staff": linked[STAFF],
        "error_count": error_count,
        "errors": errors,
    }
