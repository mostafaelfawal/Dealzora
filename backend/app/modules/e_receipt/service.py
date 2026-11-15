"""توليد الإيصال الإلكتروني لحظة إتمام البيع/المرتجع، داخل نفس المعاملة وبدون إنترنت (لا إرسال هنا).

إيقاف الميزة (المنظومة غير مفعّلة أو الخطة ليست «سلسلة») = لا يتولد أي شيء وتبقى الحقول NULL.

الخطوات لكل إيصال:
  1) بيانات المحل والفرع والجهاز (eta) + السطور والضريبة المخزّنة (sales) ← ReceiptSpec ← المستند (mapper).
  2) التحقق المحلي (validator). أي خطأ ← الحالة «خطأ تحقق» برسالة عربية، ولا يدخل السلسلة، والبيع يكمل.
  3) السلسلة: previousUUID = آخر UUID لهذا الجهاز، ثم الـ UUID (serializer.seal)، ثم تحديث مشروط
     (compare-and-swap) لصف السلسلة داخل نفس المعاملة، وتُسجَّل المرساة بعد commit (anchor.py).
"""

import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.errors import AppError, BadRequestError, ConflictError
from app.core.plan import Feature, has_feature
from app.core.security import Actor
from app.modules.catalog.model import MeasureUnit
from app.modules.devices.model import DeviceEtaProfile
from app.modules.eta.constants import EtaEnvironment
from app.modules.eta.service import EtaService, eta_enabled
from app.modules.settings.constants import SettingKey
from app.modules.products.model import Product, ProductUnit
from app.modules.sales.model import Sale, SaleLine, SaleReturn
from app.modules.settings.payments import PaymentKind, is_electronic

from . import anchor
from .constants import (
    AMENDMENT_HOURS,
    ENTITY_E_RECEIPT,
    ERROR_MESSAGES,
    PAYMENT_CODE_CARD,
    PAYMENT_CODE_OTHER,
    PAYMENT_CODES,
    PROD_CONFIRM_TEXT,
    RECEIPT_TYPE_RETURN,
    RECEIPT_TYPE_SALE,
    RETURN_MAX_DAYS,
    RETURN_NUMBER_PREFIX,
    EReceiptError,
    EReceiptStatus,
)
from .mapper import BuyerSpec, LineSpec, ReceiptSpec, SellerSpec, build_document, discount_parts
from .model import EReceiptChain
from .serializer import seal
from .validator import validate

log = logging.getLogger(__name__)

CHAIN_GAP_MESSAGE = (
    "سلسلة إيصالات هذا الجهاز أقدم من آخر إيصال صدر فعلاً (غالباً استعادة نسخة احتياطية قديمة). "
    "لم يدخل الإيصال السلسلة. من الإعدادات ← الإيصال الإلكتروني: «متابعة السلسلة من آخر إيصال صادر»"
)


def _utc(moment: datetime) -> datetime:
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


def is_active(session: Session) -> bool:
    """الميزة تعمل: الخطة «سلسلة» والمنظومة مفعّلة في الإعدادات."""
    return has_feature(Feature.E_RECEIPT) and eta_enabled(session)


# ================= السلسلة =================
def _chain(session: Session, device_id: str) -> EReceiptChain:
    row = session.get(EReceiptChain, device_id)
    if row is None:
        row = EReceiptChain(pos_device_id=device_id, last_seq=0, last_uuid="")
        session.add(row)
        session.flush()
    return row


def chain_gap(session: Session, device_id: str) -> anchor.Link | None:
    """رابط المرساة لو القاعدة رجعت للخلف لهذا الجهاز، وإلا None."""
    row = session.get(EReceiptChain, device_id)
    db = anchor.Link(row.last_seq, row.last_uuid) if row else anchor.Link(0, "")
    link = anchor.read_anchor().get(device_id)
    return link if anchor.gap(db, link) else None


def _advance(session: Session, device_id: str, expected_seq: int, uuid: str) -> None:
    """تحديث مشروط: ينجح فقط لو لم يتقدم أحد غيرنا بالسلسلة منذ قرأناها."""
    result = session.execute(
        update(EReceiptChain)
        .where(EReceiptChain.pos_device_id == device_id, EReceiptChain.last_seq == expected_seq)
        .values(last_seq=expected_seq + 1, last_uuid=uuid)
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:  # type: ignore[attr-defined]
        raise ConflictError(EReceiptError.CHAIN_CONFLICT.value, ERROR_MESSAGES[EReceiptError.CHAIN_CONFLICT])
    session.expire(session.get(EReceiptChain, device_id))  # type: ignore[arg-type]
    anchor.remember(session, device_id, anchor.Link(expected_seq + 1, uuid))


# ================= بناء المواصفات من القاعدة =================
def _seller(session: Session, actor: Actor, device_id: str) -> SellerSpec:
    eta = EtaService(session, actor)
    cfg, br = eta.config(), eta.branch()
    profile = session.scalar(
        select(DeviceEtaProfile).where(
            DeviceEtaProfile.pos_device_id == device_id, DeviceEtaProfile.deleted_at.is_(None)
        )
    )
    return SellerSpec(
        rin=cfg.rin,
        trade_name=cfg.company_trade_name,
        branch_code=br.branch_code,
        branch_address={
            "country": br.country,
            "governate": br.governate,
            "regionCity": br.region_city,
            "street": br.street,
            "buildingNumber": br.building_number,
            "postalCode": br.postal_code,
            "floor": br.floor,
            "room": br.room,
            "landmark": br.landmark,
            "additionalInformation": br.additional_information,
        },
        device_serial=profile.pos_serial if profile else None,
        activity_code=cfg.activity_code,
    )


def payment_code(session: Session, method: str) -> str:
    if method in PAYMENT_CODES:
        return PAYMENT_CODES[method]
    if is_electronic(method):
        from app.modules.settings.service import SettingsService

        found = SettingsService(session).payment_methods().get(method)
        if found is not None and found.kind == PaymentKind.CARD:
            return PAYMENT_CODE_CARD
    return PAYMENT_CODE_OTHER


def _buyer(session: Session, sale: Sale) -> BuyerSpec:
    """عميل مسجّل = شخص طبيعي باسمه وموبايله (لا نخزّن رقماً قومياً ولا تسجيلاً ضريبياً للعملاء)."""
    if not sale.customer_id:
        return BuyerSpec()
    from app.modules.customers.model import Customer

    customer = session.get(Customer, sale.customer_id)
    return BuyerSpec(name=sale.customer_name, mobile=customer.phone if customer else None)


def _price_terms_net(sale: Sale, line: SaleLine) -> int:
    """صافي السطر بعد خصم الفاتورة بنفس طبيعة السعر (غير شامل: قبل الضريبة)."""
    return (line.taxable_amount or 0) if sale.tax_mode == "exclusive" else line.net_total


def _line_discounts(sale: Sale, line: SaleLine) -> list[tuple[str, Decimal]]:
    return discount_parts(
        promo_name=line.promo_name, promo=line.promo_discount, line_discount=line.discount,
        line_total=line.line_total, net=_price_terms_net(sale, line),
        invoice_discount=sale.invoice_discount, loyalty_discount=sale.loyalty_discount,
    )  # fmt: skip


def _unit_codes(session: Session) -> dict[str, str | None]:
    rows = session.execute(
        select(MeasureUnit.name, MeasureUnit.eta_unit_type).where(MeasureUnit.deleted_at.is_(None))
    ).all()
    return {name: code for name, code in rows}


def _line_spec(
    session: Session, sale: Sale, line: SaleLine, units: dict[str, str | None], *, fraction: Decimal = Decimal(1),
    qty: int | None = None, taxable: int | None = None, tax: int | None = None, total: int | None = None,
) -> LineSpec:  # fmt: skip
    product = session.get(Product, line.product_id)
    code = product.barcode if product else None
    if line.unit_id:  # الكرتونة/الدستة بباركودها الخاص لو موجود
        unit = session.get(ProductUnit, line.unit_id)
        code = (unit.barcode if unit else None) or code
    return LineSpec(
        internal_code=code or line.product_id,
        description=line.name,
        item_type=product.eta_item_type if product else None,
        item_code=product.eta_item_code if product else None,
        unit_type=units.get(line.unit_name),
        qty=line.qty if qty is None else qty,
        unit_price=line.unit_price,
        tax_mode=sale.tax_mode,
        tax_type=line.tax_type,
        tax_rate=line.tax_rate or 0,
        taxable=(line.taxable_amount or 0) if taxable is None else taxable,
        tax=(line.tax_amount or 0) if tax is None else tax,
        total=line.net_total if total is None else total,
        discounts=[(d, a * fraction) for d, a in _line_discounts(sale, line)],
    )


# ================= التوليد =================
def _store(row: Sale | SaleReturn, *, status: EReceiptStatus, error: str | None = None, **fields: Any) -> None:
    row.eta_status = status.value
    row.eta_error = error
    for key, value in fields.items():
        setattr(row, key, value)


def _environment(session: Session, actor: Actor) -> str:
    return EtaService(session, actor).config().environment.value


def _issue(
    session: Session, actor: Actor, row: Sale | SaleReturn, device_id: str, build: "Any", receipt_number: str,
) -> None:  # fmt: skip
    """build(previous_uuid) ← المستند. التحقق أولاً، ثم السلسلة بشرط عدم وجود فجوة استعادة."""
    environment = _environment(session, actor)
    try:
        if chain_gap(session, device_id) is not None:
            _store(row, status=EReceiptStatus.INVALID, error=CHAIN_GAP_MESSAGE, eta_receipt_number=receipt_number,
                   eta_environment=environment)  # fmt: skip
            return
        chain = _chain(session, device_id)
        seq, previous = chain.last_seq, chain.last_uuid
        document = build(previous)
        errors = validate(document)
    except Exception:  # noqa: BLE001 - التوليد لا يوقف البيع أبداً
        log.exception("تعذّر بناء الإيصال الإلكتروني")
        _store(row, status=EReceiptStatus.INVALID, error="خطأ داخلي أثناء بناء الإيصال", eta_receipt_number=receipt_number,
               eta_environment=environment)  # fmt: skip
        return
    if errors:
        _store(row, status=EReceiptStatus.INVALID, error="\n".join(errors), eta_receipt_number=receipt_number,
               eta_environment=environment)  # fmt: skip
        return
    uuid, text = seal(document)
    _advance(session, device_id, seq, uuid)  # خطأ تزامن هنا يُلغي المعاملة كلها (أسلم من كسر السلسلة)
    _store(
        row, status=EReceiptStatus.NOT_SENT, eta_uuid=uuid, eta_previous_uuid=previous,
        eta_receipt_number=receipt_number, eta_device_id=device_id, eta_seq=seq + 1, eta_document=text,
        eta_environment=environment,
    )  # fmt: skip


def _sale_document(
    session: Session, actor: Actor, sale: Sale, device_id: str, previous: str, reference_old: str | None = None,
) -> dict[str, Any]:  # fmt: skip
    units = _unit_codes(session)
    return build_document(
        ReceiptSpec(
            receipt_type=RECEIPT_TYPE_SALE,
            issued_at=sale.created_at,
            receipt_number=str(sale.number),
            previous_uuid=previous,
            reference_uuid=None,
            seller=_seller(session, actor, device_id),
            buyer=_buyer(session, sale),
            payment_code=payment_code(session, sale.payment_method),
            lines=[_line_spec(session, sale, line, units) for line in sale.lines],
            reference_old_uuid=reference_old,
        )
    )


def _return_document(
    session: Session, actor: Actor, ret: SaleReturn, sale: Sale, device_id: str, previous: str,
    reference_old: str | None = None,
) -> dict[str, Any]:  # fmt: skip
    units = _unit_codes(session)
    by_id = {line.id: line for line in sale.lines}
    lines = []
    for rl in ret.lines:
        line = by_id[rl.sale_line_id]
        tax = rl.tax_amount or 0
        lines.append(
            _line_spec(session, sale, line, units, fraction=Decimal(rl.qty) / line.qty, qty=rl.qty,
                       taxable=rl.amount - tax, tax=tax, total=rl.amount)  # fmt: skip
        )
    return build_document(
        ReceiptSpec(
            receipt_type=RECEIPT_TYPE_RETURN,
            issued_at=ret.created_at,
            receipt_number=f"{RETURN_NUMBER_PREFIX}{ret.number}",
            previous_uuid=previous,
            reference_uuid=sale.eta_uuid,
            seller=_seller(session, actor, device_id),
            buyer=_buyer(session, sale),
            payment_code=payment_code(session, sale.payment_method),
            lines=lines,
            reference_old_uuid=reference_old,
        )
    )


def issue_sale_receipt(session: Session, actor: Actor, sale: Sale) -> None:
    """يُستدعى بعد إضافة سطور الفاتورة (flush) وقبل commit. لا يفعل شيئاً لو الميزة متوقفة."""
    if not is_active(session):
        return
    device_id = sale.device_id or actor.device_id
    _issue(session, actor, sale, device_id,
           lambda previous: _sale_document(session, actor, sale, device_id, previous), str(sale.number))  # fmt: skip


def issue_return_receipt(session: Session, actor: Actor, ret: SaleReturn, sale: Sale) -> None:
    """إيصال مرتجع (receiptType «r») يشير لـ UUID فاتورة البيع الأصلية."""
    if not is_active(session):
        return
    number = f"{RETURN_NUMBER_PREFIX}{ret.number}"
    if not sale.eta_uuid:
        if sale.eta_status in (None, EReceiptStatus.NOT_REQUIRED.value):
            # بيعت قبل تفعيل المنظومة: لم تُبلَّغ، فلا إيصال مرتجع لها.
            _store(ret, status=EReceiptStatus.NOT_REQUIRED, eta_receipt_number=number)
        else:
            _store(ret, status=EReceiptStatus.INVALID, eta_receipt_number=number,
                   error="فاتورة البيع الأصلية لم يصدر لها إيصال صحيح بعد. صحّحها أولاً ثم أعد توليد المرتجع")  # fmt: skip
        return
    if sale.eta_environment and sale.eta_environment != _environment(session, actor):
        # الأصل صدر على بيئة أخرى (مثلاً تجريبية قبل التحويل للفعلية): لم يُبلَّغ لهذه البيئة، فلا مرتجع له فيها.
        _store(ret, status=EReceiptStatus.NOT_REQUIRED, eta_receipt_number=number,
               error="فاتورة البيع الأصلية صدرت على بيئة أخرى (تجريبية/فعلية)")  # fmt: skip
        return
    ret.eta_reference_uuid = sale.eta_uuid
    sold, returned = _utc(sale.created_at), _utc(ret.created_at)
    if returned - sold > timedelta(days=RETURN_MAX_DAYS):
        # المرتجع نفسه يتم في المحل (المخزون والنقدية)، لكن المنظومة لا تقبل إيصاله بعد المهلة.
        _store(ret, status=EReceiptStatus.INVALID, eta_receipt_number=number,
               error=f"مر أكثر من {RETURN_MAX_DAYS} يوماً على فاتورة البيع الأصلية، وهو أقصى ما تقبله "
                     "المنظومة لإيصال المرتجع")  # fmt: skip
        return
    device_id = ret.device_id or actor.device_id
    _issue(session, actor, ret, device_id,
           lambda previous: _return_document(session, actor, ret, sale, device_id, previous), number)  # fmt: skip


# ================= تصحيح إيصال رفضته المنظومة =================
def _error(exc: type[AppError], code: EReceiptError, **details: Any) -> AppError:
    return exc(code.value, ERROR_MESSAGES[code].format(**details), details or None)


def resubmit_rejected(session: Session, actor: Actor, row: Sale | SaleReturn, *, accept_late: bool = False) -> None:
    """طريقة الـ SDK (receiptissuancefaq «Re-submitting Invalid Receipts»): مستند مصحَّح من البيانات الحالية،
    بـ UUID جديد، ونفس previousUUID للإيصال المرفوض، و referenceOldUUID = UUID المرفوض، ونفس تاريخ الإصدار.
    موضعه في السلسلة كما هو، والإيصالات بعده لا تتغير (كما في مثال الـ SDK: R3 يبقى previousUUID = R2).
    لا commit هنا (المستدعي يجمع عدة إيصالات في معاملة واحدة)."""
    if row.eta_status != EReceiptStatus.REJECTED.value or not row.eta_uuid:
        raise _error(ConflictError, EReceiptError.NOT_REJECTED)
    if row.eta_environment and row.eta_environment != _environment(session, actor):
        raise _error(ConflictError, EReceiptError.WRONG_ENVIRONMENT)
    issued = _utc(row.created_at)
    if not accept_late and datetime.now(timezone.utc) - issued > timedelta(hours=AMENDMENT_HOURS):
        raise _error(ConflictError, EReceiptError.LATE_AMENDMENT, hours=AMENDMENT_HOURS)
    device_id = row.eta_device_id or row.device_id
    if isinstance(row, Sale):
        document = _sale_document(session, actor, row, device_id, row.eta_previous_uuid or "", row.eta_uuid)
    else:
        sale = session.get(Sale, row.sale_id)
        if sale is None or not sale.eta_uuid:
            raise _error(ConflictError, EReceiptError.ORIGINAL_MISSING)
        row.eta_reference_uuid = sale.eta_uuid  # الأصل ربما صُحّح هو أيضاً (UUID جديد)
        document = _return_document(session, actor, row, sale, device_id, row.eta_previous_uuid or "", row.eta_uuid)
    errors = validate(document)
    if errors:
        raise BadRequestError("e_receipt_still_invalid", "الإيصال ما زال به أخطاء: " + "، ".join(errors[:5]))
    old = row.eta_uuid
    uuid, text = seal(document)
    _store(
        row, status=EReceiptStatus.NOT_SENT, eta_uuid=uuid, eta_replaced_uuid=old, eta_document=text,
        eta_submission_uuid=None, eta_sent_at=None, eta_long_id=None,
    )  # fmt: skip
    record_audit(
        session, actor, entity=ENTITY_E_RECEIPT, entity_id=row.id, action="resubmit_corrected",
        changes={"old_uuid": old, "new_uuid": uuid, "late": accept_late},
    )  # fmt: skip


# ================= تغيير البيئة =================
def _old_environment_rows(session: Session, current: str) -> list[Sale | SaleReturn]:
    """إيصالات البيئة الحالية التي لم يكتمل إرسالها (ستصبح «غير مطلوب» عند التحويل)."""
    statuses = [EReceiptStatus.NOT_SENT.value, EReceiptStatus.PENDING.value, EReceiptStatus.INVALID.value]
    rows: list[Sale | SaleReturn] = []
    for model in (Sale, SaleReturn):
        rows += session.scalars(
            select(model).where(
                model.eta_status.in_(statuses),
                or_(model.eta_environment == current, model.eta_environment.is_(None)),
            )
        ).all()
    return rows


def environment_switch_preview(session: Session, actor: Actor) -> dict[str, Any]:
    current = _environment(session, actor)
    return {"current": current, "unsent": len(_old_environment_rows(session, current))}


def switch_environment(session: Session, actor: Actor, target: str, confirm_text: str) -> dict[str, Any]:
    """تجريبية ↔ فعلية. للفعلية: تأكيد صريح بكتابة «فعلي».
    - كل جهاز يبدأ سلسلة جديدة: previousUUID فارغ («accepted only if this is the first receipt issued from
      this POS»)، والرقم التسلسلي الداخلي يستمر متصاعداً.
    - إيصالات البيئة القديمة التي لم يكتمل إرسالها ← «غير مطلوب» ولا تُرسل للبيئة الجديدة أبداً."""
    from .sender import sender  # متأخر: sender يعتمد على هذا الملف

    current = _environment(session, actor)
    if target == current:
        return {"environment": current, "closed": 0}
    if target == EtaEnvironment.PROD.value and confirm_text.strip() != PROD_CONFIRM_TEXT:
        raise _error(BadRequestError, EReceiptError.ENV_CONFIRM, text=PROD_CONFIRM_TEXT)
    if not sender._run_lock.acquire(timeout=60):  # لا تبديل في منتصف دورة إرسال
        raise _error(ConflictError, EReceiptError.SENDER_BUSY)
    try:
        rows = _old_environment_rows(session, current)
        note = f"إيصال على البيئة {'التجريبية' if current == 'preprod' else 'الفعلية'} لم يكتمل إرساله قبل تغيير البيئة"
        for row in rows:
            _store(row, status=EReceiptStatus.NOT_REQUIRED, error=note, eta_environment=current)
        chains = session.scalars(select(EReceiptChain)).all()
        for chain in chains:
            chain.last_uuid = ""
        eta = EtaService(session, actor)
        cfg = eta.config()
        cfg.environment = EtaEnvironment(target)
        eta.settings.put(actor, SettingKey.ETA_CONFIG, cfg.model_dump_json())
        record_audit(
            session, actor, entity=ENTITY_E_RECEIPT, entity_id="environment", action="switch_environment",
            changes={"environment": {"from": current, "to": target}, "closed_receipts": len(rows)},
        )  # fmt: skip
        links = [(c.pos_device_id, c.last_seq) for c in chains]
        session.commit()
        for device_id, seq in links:  # المرساة تتبع السلسلة الجديدة (وإلا تُفهم كاستعادة نسخة قديمة)
            anchor.reset_device(device_id, anchor.Link(seq, ""))
        return {"environment": target, "closed": len(rows)}
    finally:
        sender._run_lock.release()


def adopt_anchor(session: Session, actor: Actor, device_id: str) -> anchor.Link:
    """قرار المدير بعد استعادة نسخة قديمة: السلسلة تكمل من آخر إيصال صدر فعلاً (من المرساة)."""
    link = chain_gap(session, device_id)
    if link is None:
        raise ConflictError(EReceiptError.NO_ANCHOR_GAP.value, ERROR_MESSAGES[EReceiptError.NO_ANCHOR_GAP])
    row = _chain(session, device_id)
    before = {"seq": row.last_seq, "uuid": row.last_uuid}
    row.last_seq, row.last_uuid = link.seq, link.uuid
    record_audit(
        session, actor, entity=ENTITY_E_RECEIPT, entity_id=device_id, action="chain_adopt_anchor",
        changes={"from": before, "to": {"seq": link.seq, "uuid": link.uuid}},
    )  # fmt: skip
    session.commit()
    return link


def regenerate(session: Session, actor: Actor, row: Sale | SaleReturn) -> None:
    """إعادة توليد إيصال حالته «خطأ تحقق» بعد تصحيح البيانات (يأخذ موضعاً جديداً في السلسلة الآن)."""
    if row.eta_status != EReceiptStatus.INVALID.value:
        raise ConflictError(EReceiptError.NOT_INVALID.value, ERROR_MESSAGES[EReceiptError.NOT_INVALID])
    if not is_active(session):
        raise ConflictError(EReceiptError.DISABLED.value, ERROR_MESSAGES[EReceiptError.DISABLED])
    row.eta_status = None
    if isinstance(row, Sale):
        issue_sale_receipt(session, actor, row)
    else:
        issue_return_receipt(session, actor, row, session.get(Sale, row.sale_id))  # type: ignore[arg-type]
    record_audit(
        session, actor, entity=ENTITY_E_RECEIPT, entity_id=row.id, action="regenerate",
        changes={"status": row.eta_status, "uuid": row.eta_uuid},
    )  # fmt: skip
    session.commit()


def chains(session: Session) -> list[dict[str, Any]]:
    """حالة سلسلة كل جهاز، مع المرساة وهل توجد فجوة استعادة."""
    marks = anchor.read_anchor()
    rows = {r.pos_device_id: r for r in session.scalars(select(EReceiptChain)).all()}
    out = []
    for device_id in sorted(set(rows) | set(marks)):
        row = rows.get(device_id)
        db = anchor.Link(row.last_seq, row.last_uuid) if row else anchor.Link(0, "")
        mark = marks.get(device_id)
        out.append({
            "device_id": device_id, "last_seq": db.seq, "last_uuid": db.uuid,
            "anchor_seq": mark.seq if mark else None, "anchor_uuid": mark.uuid if mark else None,
            "gap": anchor.gap(db, mark),
        })  # fmt: skip
    return out
