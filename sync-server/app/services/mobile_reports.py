"""تقارير تطبيق الهاتف من الملخصات اليومية (daily_stats) وحالة الفروع.

- التجميع نسخة طبق الأصل من backend/app/modules/branch_sync/branch_stats.py:combine (تقرير الفروع في
  البرنامج المكتبي)، فالأرقام تتطابق لنفس الفترة. ملف tests/fixtures/branch_report_golden.json يحرس ذلك
  من الجهتين (اختبار هنا واختبار في backend): أي تغيير في أحدهما يكسر الاختبار.
- الصلاحيات: الفروع المسموحة فقط (المالك = كل فروع المحل، المدير = فروعه)، والإجمالي مجموعها.
- الأيام بتاريخ الفرع المحلي كما رفعها (التطبيق يرسل الفترة بتاريخ الهاتف، مثل البرنامج المكتبي).
- فرع لم يرسل ملخص يوم ≠ صفر مبيعات: لكل فرع عدد الأيام المرسلة والمتوقعة، و «آخر تحديث من الفرع».
- المال بالقروش (integer) دائماً.
"""

from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import utcnow
from ..errors import BadRequest
from ..models import Branch, DailyStat, Shop

# نفس ترتيب وحقول branch_stats.FIELDS في البرنامج.
FIELDS = (
    "count", "revenue", "returns", "net", "cost", "profit", "discounts", "cash", "credit", "wallet", "expenses",
    "eta_waiting", "eta_accepted", "eta_rejected",
)  # fmt: skip
MAX_RANGE_DAYS = 366


def _aware(value: datetime | None) -> datetime | None:
    return value if value is None or value.tzinfo else value.replace(tzinfo=UTC)


def _empty() -> dict[str, int]:
    return dict.fromkeys(FIELDS, 0)


def iter_days(d1: date, d2: date):
    day = d1
    while day <= d2:
        yield day
        day += timedelta(days=1)


def check_range(d1: date, d2: date) -> None:
    if d1 > d2 or (d2 - d1).days >= MAX_RANGE_DAYS:
        raise BadRequest("bad_range", "الفترة غير صالحة (حتى سنة)")


# ================= التجميع (مطابق للبرنامج المكتبي) =================
def combine(stats: list[dict], branches: list[dict], d1: date, d2: date) -> dict[str, Any]:
    """صفوف (فرع × يوم) ← إجمالي، وكل فرع (الأعلى صافياً أولاً)، واتجاه يومي. نفس combine في البرنامج."""
    known = {b["id"]: b for b in branches}
    per_branch: dict[str, dict[str, int]] = {}
    per_day: dict[str, dict[str, Any]] = {
        d.isoformat(): {"day": d.isoformat(), **_empty(), "branches": {}} for d in iter_days(d1, d2)
    }
    last_update: dict[str, str] = {}
    for row in stats:
        bid, day, data = row["branch_id"], row["day"], row.get("data") or {}
        totals = per_branch.setdefault(bid, _empty())
        bucket = per_day.get(day)
        for f in FIELDS:
            v = int(data.get(f) or 0)
            totals[f] += v
            if bucket is not None:
                bucket[f] += v
        if bucket is not None:
            bucket["branches"][bid] = int(data.get("net") or 0)
        stamp = row.get("updated_at") or ""
        if stamp > last_update.get(bid, ""):
            last_update[bid] = stamp

    rows = []
    for bid in list(known) + [b for b in per_branch if b not in known]:
        b = known.get(bid, {})
        t = per_branch.get(bid, _empty())
        rows.append({
            "id": bid, "name": b.get("name") or "فرع محذوف", "code": b.get("code") or "",
            "is_active": b.get("is_active", True),
            "last_update": last_update.get(bid), "net_profit": t["profit"] - t["expenses"], **t,
        })  # fmt: skip
    shop = _empty()
    for r in rows:
        for f in FIELDS:
            shop[f] += r[f]
    rows.sort(key=lambda r: r["net"], reverse=True)
    return {
        "date_from": d1.isoformat(), "date_to": d2.isoformat(),
        "totals": {**shop, "net_profit": shop["profit"] - shop["expenses"]},
        "branches": rows,
        "days": list(per_day.values()),
    }  # fmt: skip


# ================= القراءة من القاعدة =================
def _branches(session: Session, shop_id: str, branch_ids: list[str]) -> list[Branch]:
    if not branch_ids:
        return []
    return list(
        session.scalars(
            select(Branch).where(Branch.shop_id == shop_id, Branch.id.in_(branch_ids)).order_by(Branch.created_at)
        ).all()
    )


def _stats(session: Session, shop_id: str, branch_ids: list[str], d1: date, d2: date) -> list[dict]:
    if not branch_ids:
        return []
    rows = session.scalars(
        select(DailyStat)
        .where(DailyStat.shop_id == shop_id, DailyStat.branch_id.in_(branch_ids), DailyStat.day.between(d1, d2))
        .order_by(DailyStat.day, DailyStat.branch_id)
    ).all()
    return [
        {"branch_id": r.branch_id, "day": r.day.isoformat(), "data": r.data,
         "updated_at": _aware(r.updated_at).isoformat()}  # type: ignore[union-attr]
        for r in rows
    ]  # fmt: skip


def _totals(session: Session, shop_id: str, branch_ids: list[str], d1: date, d2: date) -> dict[str, Any]:
    """إجمالي فترة المقارنة (نفس الفروع) + عدد الفروع التي أرسلت فيها."""
    stats = _stats(session, shop_id, branch_ids, d1, d2)
    out = combine(stats, [], d1, d2)
    return {"date_from": out["date_from"], "date_to": out["date_to"], "totals": out["totals"],
            "branches_reported": len({r["branch_id"] for r in stats})}  # fmt: skip


def summary(session: Session, shop_id: str, branch_ids: list[str], d1: date, d2: date) -> dict[str, Any]:
    """ملخص فترة للفروع المسموحة + مقارنة بالفترة السابقة (ولليوم الواحد: نفس اليوم الأسبوع الماضي)."""
    check_range(d1, d2)
    branches = _branches(session, shop_id, branch_ids)
    ids = [b.id for b in branches]
    stats = _stats(session, shop_id, ids, d1, d2)
    meta = [{"id": b.id, "name": b.name, "code": b.code, "is_active": b.is_active} for b in branches]
    out = combine(stats, meta, d1, d2)

    # أيام أرسلها كل فرع مقابل المتوقع (من يوم إنشاء الفرع): الناقص يُعرض «لم يرسل» لا صفراً.
    sent: dict[str, set[str]] = {}
    for row in stats:
        sent.setdefault(row["branch_id"], set()).add(row["day"])
    created = {b.id: (_aware(b.created_at) or utcnow()).date() for b in branches}
    for row in out["branches"]:
        start = max(d1, created.get(row["id"], d1))
        expected = sum(1 for _ in iter_days(start, d2)) if start <= d2 else 0
        row["reported_days"] = len(sent.get(row["id"], ()))
        row["expected_days"] = expected
    for day in out["days"]:
        day["reported_branches"] = len(day["branches"])

    span = (d2 - d1).days + 1
    compare: dict[str, Any] = {
        "previous": _totals(session, shop_id, ids, d1 - timedelta(days=span), d2 - timedelta(days=span)),
    }
    if span == 1:
        compare["week_ago"] = _totals(session, shop_id, ids, d1 - timedelta(days=7), d2 - timedelta(days=7))
    out["compare"] = compare
    out["branches_total"] = len(branches)
    out["generated_at"] = utcnow().isoformat()
    return out


# ================= حالة الفروع =================
def branch_status(b: Branch, now: datetime) -> tuple[str, int | None]:
    """(الحالة، ثوانٍ منذ آخر ظهور). online ≤ نافذة الاتصال، late ≤ mobile_late_minutes، offline بعدها."""
    settings = get_settings()
    seen = _aware(b.last_seen_at)
    if not b.is_active:
        status = "disabled"
    elif seen is None:
        status = "never"
    elif now - seen <= timedelta(seconds=settings.online_window_seconds):
        status = "online"
    elif now - seen <= timedelta(minutes=settings.mobile_late_minutes):
        status = "late"
    else:
        status = "offline"
    return status, (int((now - seen).total_seconds()) if seen else None)


def branch_states(session: Session, shop_id: str, branch_ids: list[str]) -> list[dict[str, Any]]:
    branches = _branches(session, shop_id, branch_ids)
    shop = session.get(Shop, shop_id)
    last_seq = shop.last_seq if shop else 0
    stamps = dict(
        session.execute(
            select(DailyStat.branch_id, func.max(DailyStat.updated_at))
            .where(DailyStat.shop_id == shop_id, DailyStat.branch_id.in_([b.id for b in branches] or [""]))
            .group_by(DailyStat.branch_id)
        ).all()
    )
    now = utcnow()
    out = []
    for b in branches:
        status, ago = branch_status(b, now)
        out.append({
            "id": b.id, "name": b.name, "code": b.code, "is_active": b.is_active,
            "online": status == "online", "status": status, "last_seen_at": _aware(b.last_seen_at),
            "seconds_since_seen": ago,
            # أحداث باقي الفروع التي لم يؤكد هذا الفرع تطبيقها بعد (تأخر المزامنة).
            "pending_events": max(last_seq - (b.acked_seq or 0), 0),
            "stats_updated_at": _aware(stamps.get(b.id)),
        })  # fmt: skip
    return out
