"""ملخصات جديدة لسيرفر الفروع وتطبيق الهاتف (المرحلة 7). نفس أسلوب الملخص اليومي (branch_stats):

- تُحسب في الخلفية مع المزامنة (sync_now) من جداول موجودة بقراءة فقط: لا شيء يُضاف لمسار البيع، فالبيع لا يبطؤ.
- يُرفع ما تغيّر فقط (بصمة لكل لقطة ولكل سجل)، فالمزامنة العادية لا ترفع شيئاً تقريباً.
- لا يُرفع المخزون كاملاً ولا أي بيانات عملاء: النواقص، القريب من الانتهاء، مخزون الأصناف الناقصة في فروع أخرى
  فقط (wanted)، إغلاق الورديات، العمليات الحساسة، والأكثر مبيعاً. الكاشير باسم المستخدم فقط.

العمليات الحساسة (لا يوجد في البرنامج «إلغاء فاتورة» ولا «تعديل سعر عند البيع»، فنرفع ما يحدث فعلاً):
  discount     خصم الكاشير (أسطر + فاتورة) على فاتورة ≥ حد المالك
  return       مرتجع ≥ حد المالك
  full_return  مرتجع أكمل الفاتورة كلها (يقابل «إلغاء فاتورة»)
"""

import hashlib
import json
import time
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.periods import local_today
from app.core.timeutils import aware

from .catalog_sync import PRODUCT
from .model import CatalogLink

WINDOW_DAYS = 7
# مهلة قصيرة بين مراحل الحساب: البيع الجاري في نفس العملية يأخذ دوره بدل أن ينتظر الحساب كله.
YIELD_SECONDS = 0.005
MAX_ITEMS = 300
TOP_N = 20


def _digest(data: Any) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()[:16]


def _iso(value: datetime | None) -> str | None:
    return aware(value).isoformat() if value else None


def _local_day(value: datetime) -> date:
    """يوم الفرع المحلي لوقت مخزّن (SQLite يرجّعه بلا منطقة = UTC)."""
    return aware(value).astimezone().date()


def _keys(session: Session, products: list) -> dict[str, str]:
    """مفتاح الصنف المشترك بين الفروع: المعرّف العام للكتالوج، وإلا الباركود، وإلا المحلي (لا يُطابَق)."""
    ids = [p.id for p in products]
    links = dict(
        session.execute(
            select(CatalogLink.local_id, CatalogLink.gid).where(CatalogLink.kind == PRODUCT, CatalogLink.local_id.in_(ids))
        ).all()
    ) if ids else {}  # fmt: skip
    out = {}
    for p in products:
        gid = links.get(p.id)
        out[p.id] = f"g:{gid}" if gid else f"b:{p.barcode}" if p.barcode else f"p:{p.id}"
    return out


def _usernames(session: Session, ids: set[str | None]) -> dict[str, str]:
    from app.modules.users.model import User

    ids = {i for i in ids if i}
    if not ids:
        return {}
    return dict(session.execute(select(User.id, User.username).where(User.id.in_(ids))).all())


# ================= اللقطات =================
def shortages(session: Session) -> list[dict[str, Any]]:
    """نفس شرط تقرير النواقص في البرنامج: حد طلب > 0 والمخزون ≤ الحد."""
    from app.modules.products.model import Product

    rows = list(session.scalars(
        select(Product).where(
            Product.deleted_at.is_(None), Product.is_active.is_(True), Product.min_stock > 0,
            Product.stock_qty <= Product.min_stock,
        ).order_by((Product.stock_qty * 1.0 / Product.min_stock).asc(), Product.name).limit(MAX_ITEMS)
    ).all())  # fmt: skip
    keys = _keys(session, rows)
    return [{"key": keys[p.id][:80], "product_id": p.id, "barcode": (p.barcode or None) and p.barcode[:32],
             "name": p.name[:200], "unit": p.unit[:30], "qty": int(p.stock_qty), "min": int(p.min_stock)} for p in rows]  # fmt: skip


def expiring(session: Session, days: int) -> list[dict[str, Any]]:
    from app.modules.batches.model import ProductBatch
    from app.modules.products.model import Product

    limit_day = local_today() + timedelta(days=days)
    rows = session.execute(
        select(ProductBatch, Product).join(Product, Product.id == ProductBatch.product_id).where(
            ProductBatch.qty_remaining > 0, ProductBatch.expiry_date.is_not(None),
            ProductBatch.expiry_date <= limit_day, Product.deleted_at.is_(None), Product.is_active.is_(True),
        ).order_by(ProductBatch.expiry_date).limit(MAX_ITEMS)
    ).all()  # fmt: skip
    keys = _keys(session, [p for _, p in rows])
    return [{"key": keys[p.id][:80], "product_id": p.id, "name": p.name[:200], "unit": p.unit[:30],
             "batch_no": (b.batch_no or None) and str(b.batch_no)[:40], "expiry": b.expiry_date.isoformat(),
             "qty": int(b.qty_remaining)} for b, p in rows]  # fmt: skip


def wanted_stock(session: Session, wanted: list[str]) -> list[dict[str, Any]]:
    """مخزون هذا الفرع من أصناف ناقصة في فروع أخرى فقط (يحددها السيرفر)."""
    from app.modules.products.model import Product

    gids = [k[2:] for k in wanted if k.startswith("g:")]
    barcodes = [k[2:] for k in wanted if k.startswith("b:")]
    out: list[dict[str, Any]] = []
    if gids:
        rows = session.execute(
            select(CatalogLink.gid, Product.stock_qty, Product.min_stock)
            .join(Product, Product.id == CatalogLink.local_id)
            .where(CatalogLink.kind == PRODUCT, CatalogLink.gid.in_(gids), Product.deleted_at.is_(None))
        ).all()
        out += [{"key": f"g:{gid}", "qty": int(q), "min": int(m)} for gid, q, m in rows]
    if barcodes:
        rows = session.execute(
            select(Product.barcode, Product.stock_qty, Product.min_stock)
            .where(Product.barcode.in_(barcodes), Product.deleted_at.is_(None))
        ).all()
        out += [{"key": f"b:{bc}", "qty": int(q), "min": int(m)} for bc, q, m in rows]
    return out[:MAX_ITEMS]


# ================= السجلات (آخر WINDOW_DAYS يوم) =================
def shift_records(session: Session, since: date) -> list[dict[str, Any]]:
    from app.modules.shifts.model import Shift

    rows = list(session.scalars(
        select(Shift).where(Shift.is_open.is_(False), Shift.closed_at.is_not(None), Shift.deleted_at.is_(None))
        .order_by(Shift.closed_at.desc()).limit(MAX_ITEMS)
    ).all())  # fmt: skip
    rows = [s for s in rows if _local_day(s.closed_at) >= since]
    names = _usernames(session, {s.cashier_id for s in rows})
    return [{
        "key": f"shift:{s.id}", "kind": "shift", "day": _local_day(s.closed_at).isoformat(), "at": _iso(s.closed_at),
        "data": {"cashier": names.get(s.cashier_id, "—")[:50], "opened_at": _iso(s.opened_at), "closed_at": _iso(s.closed_at),
                 "expected": int(s.expected_cash or 0), "counted": int(s.counted_cash or 0),
                 "difference": int(s.difference or 0)},
    } for s in rows]  # fmt: skip


def sensitive_records(session: Session, since: date, discount_min: int, return_min: int) -> list[dict[str, Any]]:
    """أعمدة محددة فقط (لا كائنات فاتورة كاملة بمستند الإيصال الإلكتروني): أسرع وأخف على البيع الجاري."""
    from app.modules.sales.model import Sale, SaleReturn

    out: list[dict[str, Any]] = []
    discount = Sale.lines_discount + Sale.invoice_discount
    sales = session.execute(
        select(Sale.id, Sale.number, Sale.sold_on, Sale.created_at, Sale.created_by, discount, Sale.total)
        .where(Sale.deleted_at.is_(None), Sale.sold_on >= since, discount > 0, discount >= discount_min)
        .order_by(Sale.number.desc()).limit(MAX_ITEMS)
    ).all()  # fmt: skip
    returns = session.execute(
        select(SaleReturn.id, SaleReturn.number, SaleReturn.returned_on, SaleReturn.created_at, SaleReturn.created_by,
               SaleReturn.total, Sale.id, Sale.number, Sale.total, Sale.returned_total)
        .join(Sale, Sale.id == SaleReturn.sale_id)
        .where(SaleReturn.deleted_at.is_(None), SaleReturn.returned_on >= since).order_by(SaleReturn.number.desc())
        .limit(MAX_ITEMS)
    ).all()  # fmt: skip
    names = _usernames(session, {r[4] for r in sales} | {r[4] for r in returns})
    for sid, number, sold_on, created_at, by, amount, total in sales:
        out.append({"key": f"sens:discount:{sid}", "kind": "sensitive", "day": sold_on.isoformat(), "at": _iso(created_at),
                    "data": {"type": "discount", "number": number, "amount": int(amount), "total": int(total),
                             "cashier": names.get(by or "", "—")[:50]}})  # fmt: skip
    full_done: set[str] = set()
    for rid, rnum, ron, rat, rby, rtotal, sid, snum, stotal, sreturned in returns:
        if stotal > 0 and sreturned >= stotal:
            if sid in full_done:
                continue
            full_done.add(sid)
            out.append({"key": f"sens:full_return:{sid}", "kind": "sensitive", "day": ron.isoformat(), "at": _iso(rat),
                        "data": {"type": "full_return", "number": snum, "amount": int(stotal), "total": int(stotal),
                                 "cashier": names.get(rby or "", "—")[:50]}})  # fmt: skip
        elif rtotal > 0 and rtotal >= return_min:
            out.append({"key": f"sens:return:{rid}", "kind": "sensitive", "day": ron.isoformat(), "at": _iso(rat),
                        "data": {"type": "return", "number": rnum, "amount": int(rtotal), "total": int(stotal),
                                 "cashier": names.get(rby or "", "—")[:50]}})  # fmt: skip
    return out


def top_records(session: Session, since: date, today: date) -> list[dict[str, Any]]:
    """أعلى TOP_N صنف بالإيراد لكل يوم (الكمية بالوحدة الأساسية × 1000)."""
    from app.modules.products.model import Product
    from app.modules.sales.model import Sale, SaleLine

    rows = session.execute(
        select(Sale.sold_on, SaleLine.product_id, func.max(SaleLine.name),
               func.sum(SaleLine.qty * SaleLine.factor / 1000), func.sum(SaleLine.net_total))
        .join(Sale, Sale.id == SaleLine.sale_id)
        .where(Sale.deleted_at.is_(None), SaleLine.deleted_at.is_(None), Sale.sold_on.between(since, today))
        .group_by(Sale.sold_on, SaleLine.product_id)
    ).all()  # fmt: skip
    by_day: dict[date, list[tuple]] = defaultdict(list)
    for day, pid, name, qty, revenue in rows:
        by_day[day].append((pid, name, int(qty or 0), int(revenue or 0)))
    pids = {pid for items in by_day.values() for pid, *_ in items}
    products = list(session.scalars(select(Product).where(Product.id.in_(pids))).all()) if pids else []
    keys, units = _keys(session, products), {p.id: p.unit for p in products}
    out = []
    for day, items in sorted(by_day.items()):
        items.sort(key=lambda i: i[3], reverse=True)
        out.append({"key": f"top:{day.isoformat()}", "kind": "top", "day": day.isoformat(), "at": None, "data": {"items": [
            {"key": keys.get(pid, f"p:{pid}")[:80], "name": (name or "")[:200] or "—", "unit": (units.get(pid) or "—")[:30],
             "qty": qty, "revenue": revenue} for pid, name, qty, revenue in items[:TOP_N]]}})  # fmt: skip
    return out


# ================= ما يُرفع الآن =================
def collect(session: Session, cfg: dict[str, Any], config: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    """(الحمولة المطلوب رفعها، البصمات بعد الرفع). حمولة بلا لقطات ولا سجلات = لا شيء تغيّر."""
    today = local_today()
    since = today - timedelta(days=WINDOW_DAYS - 1)
    sent: dict[str, Any] = cfg.get("reports_sent") or {}
    snap_sent: dict[str, str] = sent.get("snapshots") or {}
    rec_sent: dict[str, str] = sent.get("records") or {}

    def step(fn, *args):
        result = fn(*args)
        time.sleep(YIELD_SECONDS)
        return result

    snapshots = {
        "shortages": step(shortages, session),
        "expiring": step(expiring, session, int(config.get("expiry_days") or 30)),
        "wanted_stock": step(wanted_stock, session, list(config.get("wanted") or [])),
    }
    payload: dict[str, Any] = {}
    fresh_snaps: dict[str, str] = {}
    for kind, items in snapshots.items():
        h = _digest(items)
        fresh_snaps[kind] = h
        if snap_sent.get(kind) != h:
            payload[kind] = items

    # الأكثر مبيعاً للأيام الماضية نادراً ما يتغير: النافذة كاملة مرة يومياً، وغير ذلك اليوم وأمس فقط
    # (بصمات الأيام الأقدم تبقى كما هي).
    full_top = sent.get("top_day") != today.isoformat()
    top_since = since if full_top else today - timedelta(days=1)
    recs = (
        step(shift_records, session, since)
        + step(sensitive_records, session, since, int(config.get("discount_min") or 0), int(config.get("return_min") or 0))
        + step(top_records, session, top_since, today)
    )
    fresh_recs: dict[str, str] = {} if full_top else {
        k: v for k, v in rec_sent.items() if k.startswith("top:") and since.isoformat() <= k[4:] < top_since.isoformat()
    }
    changed = []
    for rec in recs:
        h = _digest(rec)
        fresh_recs[rec["key"]] = h
        if rec_sent.get(rec["key"]) != h:
            changed.append(rec)
    if changed:
        payload["records"] = changed
    return payload, {"snapshots": fresh_snaps, "records": fresh_recs, "top_day": today.isoformat()}
