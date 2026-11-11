"""أدوات التطوير: توليد بيانات تجريبية وحذفها بالكامل. تعمل فقط مع POS_DEBUG=true.

الحذف يعتمد على demo_records فقط (ما أنشأه المولّد بالضبط)، فلا يمس أي بيانات حقيقية.
"""

import time
from itertools import groupby

from pydantic import BaseModel
from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.base import Base, uuid7
from app.core.config import get_settings
from app.core.errors import ConflictError, NotFoundError
from app.core.security import Actor
from app.modules.shifts.repository import ShiftRepository

from .model import DemoRecord
from .recorder import record_new_rows
from .seed import DAYS, DEMO_PASSWORD, DemoSeeder

DELETE_BATCH = 500


class DemoStatusOut(BaseModel):
    enabled: bool
    loaded: bool
    records: int
    tables: dict[str, int]
    demo_password: str


class DemoSeedOut(BaseModel):
    days: int
    records: int
    seconds: float
    products: int
    customers: int
    suppliers: int
    sales: int
    returns: int
    purchases: int
    expenses: int
    shifts: int
    skipped: int
    notes: list[str]


class DemoClearOut(BaseModel):
    deleted: int
    seconds: float


def ensure_enabled() -> None:
    if not get_settings().debug:
        raise NotFoundError("not_found", "غير متاح")


class DemoService:
    def __init__(self, session: Session, actor: Actor) -> None:
        self.session = session
        self.actor = actor

    def status(self) -> DemoStatusOut:
        rows = self.session.execute(
            select(DemoRecord.table_name, func.count()).group_by(DemoRecord.table_name)
        ).all()
        tables = {t: n for t, n in rows}
        total = sum(tables.values())
        return DemoStatusOut(
            enabled=True,
            loaded=total > 0,
            records=total,
            tables=tables,
            demo_password=DEMO_PASSWORD,
        )

    def seed(self) -> DemoSeedOut:
        if self.session.scalar(select(func.count()).select_from(DemoRecord)):
            raise ConflictError("demo_exists", "البيانات التجريبية موجودة بالفعل. احذفها أولاً")
        if ShiftRepository(self.session).current(self.actor.device_id) is not None:
            raise ConflictError("shift_open", "اقفل الوردية المفتوحة أولاً، فالمولّد يفتح ويقفل ورديات")
        self.session.commit()  # إنهاء معاملة القراءة قبل البدء

        started = time.perf_counter()
        with record_new_rows(self.session) as counter:
            stats = DemoSeeder(self.session, self.actor).run(DAYS)
        return DemoSeedOut(
            days=DAYS,
            records=counter[0],
            seconds=round(time.perf_counter() - started, 1),
            products=stats.products,
            customers=stats.customers,
            suppliers=stats.suppliers,
            sales=stats.sales,
            returns=stats.returns,
            purchases=stats.purchases,
            expenses=stats.expenses,
            shifts=stats.shifts,
            skipped=stats.skipped,
            notes=stats.errors,
        )

    def clear(self) -> DemoClearOut:
        """يحذف كل صف مسجّل، الأحدث أولاً (الأبناء قبل الآباء)، في معاملة واحدة."""
        started = time.perf_counter()
        records = self.session.execute(
            select(DemoRecord.table_name, DemoRecord.row_id).order_by(DemoRecord.id.desc())
        ).all()
        if not records:
            raise NotFoundError("demo_empty", "لا توجد بيانات تجريبية")

        # فحص المفاتيح الأجنبية يُؤجَّل لحظة الـ commit: ترتيب الحذف داخل المعاملة لا يهم،
        # ولو أشار أي صف حقيقي لصف تجريبي يفشل الـ commit ويُلغى الحذف كله (لا ضرر).
        self.session.execute(text("PRAGMA defer_foreign_keys = ON"))
        tables = Base.metadata.tables
        deleted = 0
        # نجمع المتتالي من نفس الجدول في دفعة واحدة مع الحفاظ على الترتيب العكسي.
        for table_name, group in groupby(records, key=lambda r: r[0]):
            table = tables.get(table_name)
            if table is None:  # لا نثق إلا بأسماء الجداول المعرّفة في الكود
                continue
            pk = list(table.primary_key.columns)[0]
            ids = [r[1] for r in group]
            for i in range(0, len(ids), DELETE_BATCH):
                result = self.session.execute(delete(table).where(pk.in_(ids[i : i + DELETE_BATCH])))
                deleted += result.rowcount or 0
        self.session.execute(delete(DemoRecord))
        record_audit(
            self.session, self.actor, entity="devtools", entity_id=uuid7(), action="demo_clear",
            changes={"deleted": deleted},
        )  # fmt: skip
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise ConflictError(
                "demo_referenced",
                "بيانات حقيقية مرتبطة ببيانات تجريبية (مثل بيع صنف تجريبي)، لذلك لم يُحذف شيء",
            ) from exc
        # استرجاع المساحة بعد حذف آلاف الصفوف (خارج أي معاملة).
        self.session.execute(text("PRAGMA wal_checkpoint(TRUNCATE)"))
        return DemoClearOut(deleted=deleted, seconds=round(time.perf_counter() - started, 1))
