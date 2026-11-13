"""كتالوج الأصناف والعملاء المشترك بين الفروع.

القواعد:
- كل سجل له معرّف عام (gid) واحد في كل الفروع. الفرع اللي ينشئ السجل يرفعه بمعرّفه المحلي.
- الدمج عند أول ربط: سجل جديد مفتاحه (باركود/اسم الصنف، تليفون العميل) موجود عند فرع آخر
  لا يُنشأ مرتين: يرجع «merged» بالمعرّف المعتمد وبياناته، والفرع يربط سجله المحلي به.
  (أول فرع يرفع الصنف هو المرجع لبياناته.)
- التعديل يدمج الحقول المتغيّرة فقط (fields): فرع غيّر السعر وفرع آخر غيّر الاسم في نفس الوقت
  = الاثنين يُحفظوا. نفس الحقل من فرعين = آخر رفع يكسب.
- المفتاح فريد بين السجلات الحية: تعديل يجعل باركود صنف = باركود صنف آخر يُرفض (conflict).
- البيانات تُتحقق بنموذج صارم لكل نوع (لا حقول زائدة): فرع مخترق لا يقدر يزرع شيئاً
  غريباً عند باقي الفروع (وكل فرع يتحقق مرة ثانية قبل التطبيق).
- كل تغيير فعلي يأخذ seq جديد تحت قفل صف المحل، والفروع تسحب «بعد آخر seq».
- المخزون والتكلفة وأرصدة العملاء ونقاطهم لا تمر من هنا: كل فرع له أرقامه.
- حساب المالك (owner): واحد لكل فروع المحل. يمر اسم المستخدم وتجزئة كلمة المرور (Argon2id) فقط،
  ولا تمر كلمة المرور نفسها أبداً. الفرع يرفع حسابات المالك فقط (لا مديرين ولا كاشيرية).
"""

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import utcnow
from ..errors import BadRequest
from ..models import CatalogItem, Shop
from .events import lock_shop

Kind = Literal["product", "customer", "owner"]
Gid = Annotated[str, StringConstraints(min_length=8, max_length=36, pattern=r"^[0-9A-Za-z-]+$")]
Money = Annotated[int, Field(ge=0, le=10**12)]
Name200 = Annotated[str, StringConstraints(min_length=1, max_length=200)]
Name100 = Annotated[str, StringConstraints(min_length=1, max_length=100)]
UnitName = Annotated[str, StringConstraints(min_length=1, max_length=30)]
Barcode = Annotated[str, StringConstraints(min_length=1, max_length=32)]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class UnitData(_Strict):
    name: UnitName
    factor: Annotated[int, Field(gt=0, le=10**9)]
    barcode: Barcode | None = None
    sale_price: Money | None = None


class ProductData(_Strict):
    name: Name200
    barcode: Barcode | None = None
    category: Annotated[str, StringConstraints(max_length=80)] | None = None
    unit: UnitName
    allow_decimal: bool = False
    sale_price: Money
    scale_code: Annotated[int, Field(ge=1, le=999_999)] | None = None
    wholesale_price: Money | None = None
    wholesale_min_qty: Annotated[int, Field(ge=1, le=10**12)] | None = None
    track_expiry: bool = False
    is_active: bool = True
    units: list[UnitData] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def _rules(self):
        if self.wholesale_price is not None and self.wholesale_price >= self.sale_price:
            raise ValueError("سعر الجملة يجب أن يكون أقل من سعر البيع")
        return self


class CustomerData(_Strict):
    name: Name100
    phone: Annotated[str, StringConstraints(max_length=16)] | None = None
    address: Annotated[str, StringConstraints(max_length=200)] = ""
    notes: Annotated[str, StringConstraints(max_length=300)] = ""
    credit_limit: Money = 0
    is_wholesale: bool = False
    is_active: bool = True


class OwnerData(_Strict):
    username: Annotated[str, StringConstraints(pattern=r"^[a-z0-9._\-]{3,50}$")]
    # تجزئة Argon2id فقط (لا كلمة مرور صريحة ولا خوارزمية أضعف).
    password_hash: Annotated[str, StringConstraints(min_length=40, max_length=255, pattern=r"^\$argon2id\$")]
    is_active: bool = True


MODELS: dict[str, type[BaseModel]] = {"product": ProductData, "customer": CustomerData, "owner": OwnerData}


class PushItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Kind
    gid: Gid
    data: dict[str, Any]
    # الحقول اللي اتغيّرت عند الفرع (None = السجل كله، مثلاً أول رفع).
    fields: list[Annotated[str, StringConstraints(max_length=40)]] | None = Field(None, max_length=40)
    deleted: bool = False


class PushIn(BaseModel):
    items: list[PushItem] = Field(max_length=2000)


class PushResult(BaseModel):
    gid: str
    # ok: اتحفظ · merged: موجود عند فرع آخر بمعرّف canonical_gid · conflict: المفتاح محجوز
    # deleted: السجل اتحذف من فرع آخر · invalid: بيانات غير صالحة
    status: Literal["ok", "merged", "conflict", "deleted", "invalid"]
    canonical_gid: str | None = None
    version: int = 0
    seq: int | None = None
    data: dict[str, Any] | None = None
    message: str | None = None


class ItemOut(BaseModel):
    kind: str
    gid: str
    version: int
    seq: int
    deleted: bool
    data: dict[str, Any]
    updated_by_branch_id: str | None


class PullOut(BaseModel):
    items: list[ItemOut]
    next_after: int
    has_more: bool
    last_seq: int


def match_key(kind: str, data: dict[str, Any]) -> str | None:
    if kind == "product":
        if data.get("barcode"):
            return "b:" + str(data["barcode"]).strip()
        name = " ".join(str(data.get("name", "")).split()).casefold()
        return ("n:" + name)[:240] if name else None
    if kind == "owner":
        name = str(data.get("username") or "").strip().lower()
        return "u:" + name if name else None
    phone = "".join(ch for ch in str(data.get("phone") or "") if ch.isdigit())
    return "p:" + phone if phone else None


def _validate(kind: str, data: dict[str, Any]) -> dict[str, Any]:
    return MODELS[kind].model_validate(data).model_dump(mode="json")


def _key_owner(session: Session, shop_id: str, kind: str, key: str | None, gid: str) -> CatalogItem | None:
    if not key:
        return None
    return session.scalars(
        select(CatalogItem)
        .where(
            CatalogItem.shop_id == shop_id,
            CatalogItem.kind == kind,
            CatalogItem.match_key == key,
            CatalogItem.deleted.is_(False),
            CatalogItem.id != gid,
        )
        .limit(1)
    ).first()


def _conflict_message(key: str) -> str:
    if key.startswith("b:"):
        return f"الباركود {key[2:]} مستخدم لصنف آخر في فرع آخر"
    if key.startswith("p:"):
        return f"رقم الهاتف {key[2:]} مستخدم لعميل آخر في فرع آخر"
    if key.startswith("u:"):
        return f"اسم المستخدم {key[2:]} مستخدم لحساب مالك آخر"
    return "يوجد صنف آخر بالاسم نفسه وبدون باركود في فرع آخر"


def check_size(items: list[PushItem], max_items: int) -> None:
    if len(items) > max_items:
        raise BadRequest("push_too_large", f"أقصى عدد سجلات في الحزمة {max_items}", {"max": max_items})


def push(session: Session, *, shop_id: str, branch_id: str, items: list[PushItem]) -> list[PushResult]:
    """نتيجة لكل سجل بنفس الترتيب. لا commit هنا."""
    shop = lock_shop(session, shop_id)
    now = utcnow()
    out: list[PushResult] = []

    def bump(row: CatalogItem) -> None:
        shop.last_catalog_seq += 1
        row.seq = shop.last_catalog_seq
        row.updated_at = now
        row.updated_by_branch_id = branch_id

    for item in items:
        row = session.get(CatalogItem, item.gid)
        if row is not None and (row.shop_id != shop_id or row.kind != item.kind):
            # معرّف مستخدم لمحل آخر أو نوع آخر: لا نكشف شيئاً عنه.
            out.append(PushResult(gid=item.gid, status="invalid", message="معرّف غير صالح"))
            continue
        try:
            data = _validate(item.kind, item.data)
        except ValidationError as exc:
            msg = str(exc.errors()[0].get("msg", "بيانات غير صالحة"))[:200]
            out.append(PushResult(gid=item.gid, status="invalid", message=msg))
            continue

        if row is None:
            if item.deleted:  # اتحذف قبل ما يترفع أصلاً
                out.append(PushResult(gid=item.gid, status="ok"))
                continue
            key = match_key(item.kind, data)
            owner = _key_owner(session, shop_id, item.kind, key, item.gid)
            if owner is not None:
                out.append(
                    PushResult(gid=item.gid, status="merged", canonical_gid=owner.id,
                               version=owner.version, seq=owner.seq, data=owner.data)
                )  # fmt: skip
                continue
            row = CatalogItem(
                id=item.gid, shop_id=shop_id, kind=item.kind, match_key=key,
                data=data, deleted=False, version=1, created_at=now,
            )  # fmt: skip
            bump(row)
            session.add(row)
            session.flush()
            out.append(PushResult(gid=row.id, status="ok", version=1, seq=row.seq, data=data))
            continue

        if row.deleted:
            out.append(PushResult(gid=row.id, status="deleted", version=row.version, seq=row.seq))
            continue
        if item.deleted:
            row.deleted = True
            row.version += 1
            bump(row)
            out.append(PushResult(gid=row.id, status="ok", version=row.version, seq=row.seq))
            continue

        allowed = MODELS[item.kind].model_fields
        wanted = item.fields if item.fields is not None else list(allowed)
        merged = {**row.data, **{f: data[f] for f in wanted if f in allowed}}
        try:
            merged = _validate(item.kind, merged)  # الدمج نفسه لازم يطلع سجل صالح
        except ValidationError as exc:
            msg = str(exc.errors()[0].get("msg", "بيانات غير صالحة"))[:200]
            out.append(PushResult(gid=row.id, status="invalid", version=row.version, data=row.data, message=msg))
            continue
        if merged == row.data:
            out.append(PushResult(gid=row.id, status="ok", version=row.version, seq=row.seq, data=merged))
            continue
        key = match_key(item.kind, merged)
        if _key_owner(session, shop_id, item.kind, key, row.id) is not None:
            out.append(
                PushResult(gid=row.id, status="conflict", version=row.version, data=row.data,
                           message=_conflict_message(key or ""))
            )  # fmt: skip
            continue
        row.data = merged
        row.match_key = key
        row.version += 1
        bump(row)
        out.append(PushResult(gid=row.id, status="ok", version=row.version, seq=row.seq, data=merged))
    return out


def pull(session: Session, *, shop_id: str, after: int, limit: int) -> PullOut:
    rows = session.scalars(
        select(CatalogItem)
        .where(CatalogItem.shop_id == shop_id, CatalogItem.seq > after)
        .order_by(CatalogItem.seq)
        .limit(limit + 1)
    ).all()
    has_more = len(rows) > limit
    rows = rows[:limit]
    last = session.scalar(select(Shop.last_catalog_seq).where(Shop.id == shop_id)) or 0
    return PullOut(
        items=[
            ItemOut(kind=r.kind, gid=r.id, version=r.version, seq=r.seq, deleted=r.deleted,
                    data=r.data, updated_by_branch_id=r.updated_by_branch_id)
            for r in rows
        ],  # fmt: skip
        next_after=rows[-1].seq if rows else after,
        has_more=has_more,
        last_seq=last,
    )
