"""الملخص اليومي لهذا الفرع ← سيرفر الفروع، والتقرير المجمّع لكل الفروع عند المالك.

- نفس أرقام تقرير «المبيعات والأرباح» (repository التقارير)، يوماً بيوم، والمال بالقروش.
- الرفع: كل مزامنة نحسب آخر WINDOW_DAYS يوم (3 استعلامات مجمّعة)، ونرفع فقط الأيام التي تغيّرت
  أرقامها عن آخر رفع (بصمة لكل يوم)، فمصروف بتاريخ قديم أو مرتجع متأخر يصل أيضاً.
- الفواتير نفسها لا تُرفع: أرقام مجمّعة فقط.
"""

import hashlib
import json
from datetime import date, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.periods import iter_days, local_today
from app.modules.reports.repository import ReportRepository

WINDOW_DAYS = 90
FIELDS = ("count", "revenue", "returns", "net", "cost", "profit", "discounts", "cash", "credit", "wallet", "expenses")


def _expenses_by_day(session: Session, d1: date, d2: date) -> dict[date, int]:
    from sqlalchemy import func, select

    from app.core.repository import live
    from app.modules.expenses.model import Expense

    rows = session.execute(
        select(Expense.spent_at, func.sum(Expense.amount))
        .where(live(Expense), Expense.spent_at.between(d1, d2))
        .group_by(Expense.spent_at)
    ).all()
    out: dict[date, int] = {}
    for day, amount in rows:
        key = day.date() if hasattr(day, "date") and not isinstance(day, date) else day
        out[key] = out.get(key, 0) + int(amount or 0)
    return out


def day_rows(session: Session, d1: date, d2: date) -> dict[str, dict[str, int]]:
    """يوم (ISO) → أرقامه، لكل الأيام في الفترة (حتى الصفرية)."""
    repo = ReportRepository(session)
    sales = repo.sales_by_day(d1, d2)
    returns = repo.returns_by_day(d1, d2)
    expenses = _expenses_by_day(session, d1, d2)
    out = {}
    for day in iter_days(d1, d2):
        count, revenue, cost, discounts, cash, credit, wallet = sales.get(day, (0, 0, 0, 0, 0, 0, 0))
        r_total, r_cost = returns.get(day, (0, 0))
        net, net_cost = revenue - r_total, cost - r_cost
        out[day.isoformat()] = {
            "count": int(count), "revenue": int(revenue), "returns": int(r_total), "net": int(net),
            "cost": int(net_cost), "profit": int(net - net_cost), "discounts": int(discounts),
            "cash": int(cash), "credit": int(credit), "wallet": int(wallet), "expenses": int(expenses.get(day, 0)),
        }  # fmt: skip
    return out


def _digest(data: dict) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()[:16]


def pending_upload(session: Session, cfg: dict) -> tuple[list[dict[str, Any]], dict[str, str]]:
    """(الأيام المتغيرة المطلوب رفعها، بصمات أيام النافذة بعد الرفع)."""
    today = local_today()
    days = day_rows(session, today - timedelta(days=WINDOW_DAYS - 1), today)
    sent: dict[str, str] = cfg.get("stats_sent") or {}
    rows, fresh = [], {}
    for day, data in days.items():
        h = _digest(data)
        active = any(data.values())
        if active or day in sent or day == today.isoformat():  # اليوم دائماً: يظهر الفرع في التقرير
            fresh[day] = h
            if sent.get(day) != h:
                rows.append({"day": day, "data": data})
    return rows, fresh


# ================= التقرير المجمّع (المالك) =================
def _empty() -> dict[str, int]:
    return dict.fromkeys(FIELDS, 0)


def combine(stats: list[dict], branches: list[dict], d1: date, d2: date) -> dict[str, Any]:
    """صفوف السيرفر (فرع × يوم) ← إجمالي المحل، وكل فرع، واتجاه يومي (لكل فرع وللمحل)."""
    known = {b["id"]: b for b in branches}
    per_branch: dict[str, dict[str, int]] = {}
    per_day: dict[str, dict[str, Any]] = {d.isoformat(): {"day": d.isoformat(), **_empty(), "branches": {}} for d in iter_days(d1, d2)}
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
            "is_me": bool(b.get("is_me")), "is_active": b.get("is_active", True), "online": bool(b.get("online")),
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
