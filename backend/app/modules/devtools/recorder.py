"""يلتقط تلقائياً كل صف جديد يُدرج أثناء التوليد ويسجّله في demo_records داخل نفس المعاملة.

- after_flush: نجمع (الجدول، المفتاح) لكل كائن جديد.
- before_commit: نضيف صفوف DemoRecord فتُحفظ مع البيانات في نفس الـ commit (لا بيانات يتيمة).
- after_rollback: نتجاهل ما جُمع من معاملة فشلت.
لا يحتاج أي موديول أن يعرف أنه يعمل في وضع تجريبي.
"""

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session

from app.core.base import uuid7

from .model import DemoRecord


@contextmanager
def record_new_rows(session: Session) -> Iterator[list[int]]:
    """يسجّل كل إدراج داخل الكتلة. يعيد عدّاداً [إجمالي المسجَّل]."""
    pending: list[tuple[str, str]] = []
    counter = [0]

    def after_flush(sess: Session, _ctx) -> None:
        for obj in sess.new:
            if isinstance(obj, DemoRecord):
                continue
            mapper = inspect(obj).mapper
            table = mapper.local_table.name  # type: ignore[union-attr]
            key = inspect(obj).identity
            if key and len(key) == 1:
                pending.append((table, str(key[0])))
            else:  # مفتاح غير id (مثل token_hash) أو مركّب: نستخدم أول عمود مفتاح
                pk = mapper.primary_key[0].key
                pending.append((table, str(getattr(obj, pk))))

    def before_commit(sess: Session) -> None:
        # الخدمات تضيف Audit/Outbox ثم commit مباشرة: نفرّغها الآن حتى يلتقطها after_flush
        # في نفس المعاملة (وإلا تُكتب بعد هذا الحدث ولا تُسجَّل).
        sess.flush()
        if not pending:
            return
        for table, row_id in pending:
            sess.add(DemoRecord(id=uuid7(), table_name=table, row_id=row_id))
        counter[0] += len(pending)
        pending.clear()

    def after_rollback(_sess: Session) -> None:
        pending.clear()

    event.listen(session, "after_flush", after_flush)
    event.listen(session, "before_commit", before_commit)
    event.listen(session, "after_rollback", after_rollback)
    try:
        yield counter
    finally:
        event.remove(session, "after_flush", after_flush)
        event.remove(session, "before_commit", before_commit)
        event.remove(session, "after_rollback", after_rollback)
