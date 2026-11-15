"""قراءة الإيصالات لشاشة «الإيصالات الإلكترونية» والتقرير (فواتير البيع والمرتجعات معاً). قراءة فقط.

الشاشة لهذا الفرع فقط (كل فرع قاعدته ويرسل إيصالاته بنفسه)؛ أعداد الفروع الأخرى في التقرير المجمّع.
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import Actor
from app.modules.eta.service import EtaService
from app.modules.sales.model import Sale, SaleReturn

from .constants import AMENDMENT_HOURS, EReceiptStatus
from .errors_ar import explain
from .sender import LATE_WARNING, SUBMIT_WINDOW

_UNSENT = (EReceiptStatus.NOT_SENT.value, EReceiptStatus.PENDING.value)


@dataclass(frozen=True, slots=True)
class ReceiptFilters:
    status: str | None = None  # حالة واحدة أو "attention" (مرفوض + خطأ تحقق)
    kind: str | None = None  # sale / return
    device_id: str | None = None
    date_from: date | None = None
    date_to: date | None = None
    number: int | None = None
    page: int = 1
    page_size: int = 50


def _aware(moment: datetime | None) -> datetime | None:
    if moment is None:
        return None
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


def _query(model: type[Sale] | type[SaleReturn], f: ReceiptFilters):  # noqa: ANN202
    day = Sale.sold_on if model is Sale else SaleReturn.returned_on
    stmt = select(model).where(model.deleted_at.is_(None), model.eta_status.is_not(None))
    if f.status == "attention":
        stmt = stmt.where(model.eta_status.in_([EReceiptStatus.REJECTED.value, EReceiptStatus.INVALID.value]))
    elif f.status:
        stmt = stmt.where(model.eta_status == f.status)
    if f.device_id:
        stmt = stmt.where(func.coalesce(model.eta_device_id, model.device_id) == f.device_id)
    if f.date_from:
        stmt = stmt.where(day >= f.date_from)
    if f.date_to:
        stmt = stmt.where(day <= f.date_to)
    if f.number is not None:
        stmt = stmt.where(model.number == f.number)
    return stmt


def resend_mode(row: Sale | SaleReturn) -> str | None:
    """ماذا يفعل زر «إعادة الإرسال» لهذا الإيصال."""
    status = row.eta_status
    if status == EReceiptStatus.REJECTED.value:
        return "correct"  # مستند مصحَّح بطريقة الـ SDK (referenceOldUUID)
    if status == EReceiptStatus.INVALID.value:
        return "regenerate"  # خطأ تحقق محلي: يُعاد توليده بعد التصحيح
    if status == EReceiptStatus.NOT_SENT.value or (status == EReceiptStatus.PENDING.value and not row.eta_submission_uuid):
        return "send"  # إرسال فوري بدل انتظار الدورة
    return None


def _item(row: Sale | SaleReturn, devices: dict[str, str], now: datetime) -> dict[str, Any]:
    is_sale = isinstance(row, Sale)
    created = _aware(row.created_at) or now
    unsent = row.eta_status in _UNSENT and not row.eta_submission_uuid
    help_ = explain(row.eta_error) if row.eta_status in (
        EReceiptStatus.REJECTED.value, EReceiptStatus.INVALID.value) else None  # fmt: skip
    device = row.eta_device_id or row.device_id
    return {
        "kind": "sale" if is_sale else "return",
        "id": row.id,
        "sale_id": row.id if is_sale else row.sale_id,  # «فتح الفاتورة المرتبطة»
        "number": row.number,
        "receipt_number": row.eta_receipt_number,
        "issued_at": created,
        "device_id": device,
        "device_name": devices.get(device, device),
        "status": row.eta_status,
        "uuid": row.eta_uuid,
        "replaced_uuid": row.eta_replaced_uuid,
        "reference_uuid": None if is_sale else row.eta_reference_uuid,
        "environment": row.eta_environment,
        "total": row.total,
        "tax_total": row.tax_total,
        "error": row.eta_error,
        "help_title": help_.title if help_ else None,
        "help_action": help_.action if help_ else None,
        "sent_at": _aware(row.eta_sent_at),
        "late": unsent and now - created >= LATE_WARNING,
        "overdue": unsent and now - created >= SUBMIT_WINDOW,
        "amendment_late": row.eta_status == EReceiptStatus.REJECTED.value
        and now - created > timedelta(hours=AMENDMENT_HOURS),
        "resend": resend_mode(row),
    }


def list_receipts(session: Session, actor: Actor, f: ReceiptFilters) -> dict[str, Any]:
    models: list[type[Sale] | type[SaleReturn]] = (
        [Sale] if f.kind == "sale" else [SaleReturn] if f.kind == "return" else [Sale, SaleReturn]
    )
    limit = f.page * f.page_size
    rows: list[Sale | SaleReturn] = []
    total = 0
    for model in models:
        stmt = _query(model, f)
        total += session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        rows += session.scalars(stmt.order_by(model.created_at.desc()).limit(limit)).all()
    rows.sort(key=lambda r: _aware(r.created_at) or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    page = rows[(f.page - 1) * f.page_size : limit]
    devices = {d.device_id: d.name for d in EtaService(session, actor).devices()}
    now = datetime.now(timezone.utc)
    return {"items": [_item(r, devices, now) for r in page], "total": total, "page": f.page, "page_size": f.page_size,
            "devices": [{"id": i, "name": n} for i, n in devices.items()]}  # fmt: skip


def report(session: Session, d1: date, d2: date) -> dict[str, int]:
    """تقرير الفترة (حسب يوم الإصدار): الأعداد بالحالة، والمُرسل، والضريبة المُبلغ عنها (المقبول فقط:
    ضريبة فواتير البيع المقبولة − ضريبة المرتجعات المقبولة)."""
    out = {s.value: 0 for s in EReceiptStatus}
    sent = 0
    tax_sales = tax_returns = accepted_total = 0
    for model, day in ((Sale, Sale.sold_on), (SaleReturn, SaleReturn.returned_on)):
        base = (model.deleted_at.is_(None), model.eta_status.is_not(None), day.between(d1, d2))
        for status, count in session.execute(
            select(model.eta_status, func.count()).where(*base).group_by(model.eta_status)
        ).all():
            out[status] = out.get(status, 0) + int(count)
        sent += session.scalar(select(func.count()).select_from(model).where(*base, model.eta_sent_at.is_not(None))) or 0
        tax, amount = session.execute(
            select(func.coalesce(func.sum(model.tax_total), 0), func.coalesce(func.sum(model.total), 0)).where(
                *base, model.eta_status == EReceiptStatus.ACCEPTED.value
            )
        ).one()
        if model is Sale:
            tax_sales, accepted_total = int(tax), int(amount)
        else:
            tax_returns = int(tax)
            accepted_total -= int(amount)
    return {
        **out,
        "issued": sum(out.values()) - out.get(EReceiptStatus.NOT_REQUIRED.value, 0),
        "sent": int(sent),
        "tax_sales": tax_sales,
        "tax_returns": tax_returns,
        "tax_reported": tax_sales - tax_returns,
        "accepted_total": accepted_total,
    }
