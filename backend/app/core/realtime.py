"""مزامنة لحظية بين الأجهزة (بدل أن يسأل كل جهاز السيرفر كل ثوانٍ).

- كل معاملة ناجحة (commit) تُعلن «أي مواضيع تغيّرت» (products، sales، held ...) حسب الجداول التي لمستها.
- الأجهزة المتصلة بـ GET /api/v1/events (Server-Sent Events) تستلم الإعلان فوراً وتعيد جلب ما يخصها فقط.
- الإعلان لا يحمل بيانات (أسماء مواضيع فقط): البيانات نفسها تُجلب بالطلبات العادية بصلاحياتها.

الـ backend عملية واحدة (uvicorn بدون workers)، فالموزّع في الذاكرة يكفي.
الـ routes متزامنة (threadpool) والمشتركون async: النشر يمر عبر call_soon_threadsafe.
"""

import asyncio
import logging
import threading
from typing import Any

from sqlalchemy import event
from sqlalchemy.orm import Session

log = logging.getLogger("dealzora.realtime")

# جدول ← موضوع. الجداول غير المذكورة (الجلسات، السجل، outbox ...) لا تُعلَن.
TABLE_TOPICS: dict[str, str] = {
    "products": "products",
    "product_units": "products",
    "categories": "products",
    "measure_units": "products",
    "stock_movements": "products",
    "customers": "customers",
    "customer_ledger": "customers",
    "sales": "sales",
    "sale_lines": "sales",
    "sale_returns": "sales",
    "sale_return_lines": "sales",
    "held_invoices": "held",
    "shifts": "shifts",
    "cash_entries": "treasury",
    "expenses": "expenses",
    "purchases": "purchases",
    "purchase_lines": "purchases",
    "purchase_returns": "purchases",
    "purchase_return_lines": "purchases",
    "purchase_orders": "purchases",
    "purchase_order_lines": "purchases",
    "suppliers": "suppliers",
    "supplier_transactions": "suppliers",
    "users": "users",
    "app_settings": "settings",
    "shop": "settings",
    "devices": "devices",
}

_PENDING = "dz_realtime_topics"
_QUEUE_MAX = 100  # مشترك بطيء جداً: نُسقط الأقدم بدل أن تكبر الذاكرة


class _Hub:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._subs: set[tuple[asyncio.AbstractEventLoop, asyncio.Queue[Any]]] = set()

    def subscribe(self) -> tuple[asyncio.AbstractEventLoop, asyncio.Queue[Any]]:
        sub = (asyncio.get_running_loop(), asyncio.Queue(maxsize=_QUEUE_MAX))
        with self._lock:
            self._subs.add(sub)
        return sub

    def unsubscribe(self, sub: tuple[asyncio.AbstractEventLoop, asyncio.Queue[Any]]) -> None:
        with self._lock:
            self._subs.discard(sub)

    def publish(self, topics: set[str]) -> None:
        if not topics:
            return
        message = sorted(topics)
        with self._lock:
            subs = list(self._subs)
        for loop, queue in subs:
            try:
                loop.call_soon_threadsafe(_offer, queue, message)
            except RuntimeError:
                pass  # الـ loop أُغلق (إيقاف السيرفر)


def _offer(queue: asyncio.Queue[Any], message: list[str]) -> None:
    if queue.full():
        try:
            queue.get_nowait()
        except asyncio.QueueEmpty:
            pass
    queue.put_nowait(message)


hub = _Hub()


# ---------------- ربط الإعلان بمعاملات SQLAlchemy ----------------
def _mark(session: Session, table: str | None) -> None:
    topic = TABLE_TOPICS.get(table or "")
    if topic:
        session.info.setdefault(_PENDING, set()).add(topic)


def _after_flush(session: Session, _ctx: Any) -> None:
    for obj in (*session.new, *session.dirty, *session.deleted):
        table = getattr(obj, "__tablename__", None)
        if table and (obj not in session.dirty or session.is_modified(obj)):
            _mark(session, table)


def _do_orm_execute(state: Any) -> None:
    # update()/delete()/insert() مباشرة (العمليات الجماعية) لا تمر على flush.
    if state.is_update or state.is_delete or state.is_insert:
        table = getattr(getattr(state.statement, "table", None), "name", None)
        _mark(state.session, table)


def _after_commit(session: Session) -> None:
    topics = session.info.pop(_PENDING, None)
    if topics:
        try:
            hub.publish(topics)
        except Exception:  # الإعلان لا يُفشل العملية أبداً
            log.exception("realtime publish failed")


def _after_rollback(session: Session) -> None:
    session.info.pop(_PENDING, None)


_installed = False


def install() -> None:
    """يُستدعى مرة عند الإقلاع. على مستوى Session كلها (طلبات ومهام خلفية)."""
    global _installed
    if _installed:
        return
    event.listen(Session, "after_flush", _after_flush)
    event.listen(Session, "do_orm_execute", _do_orm_execute)
    event.listen(Session, "after_commit", _after_commit)
    event.listen(Session, "after_rollback", _after_rollback)
    _installed = True
