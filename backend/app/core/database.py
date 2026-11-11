"""اتصال SQLCipher (WAL) + جلسة لكل طلب. كل أمر (command) = معاملة واحدة.

تعدد الأجهزة (كاشير متصل بالجهاز الأساسي): طلبات الكتابة تبدأ بـ BEGIN IMMEDIATE.
- تأخذ قفل الكتابة من أول المعاملة، فطلبات الكتابة المتزامنة تنتظر دورها (busy_timeout)
  بدل أن تفشل في منتصفها بـ "database is locked" (ترقية قفل القراءة لكتابة في WAL لا تنتظر).
- فيصبح فحص المخزون وحد الائتمان ورقم الفاتورة التالي داخل معاملة متسلسلة فعلاً.
طلبات القراءة (GET) تبقى BEGIN عادي فلا توقف الكتابة.
"""

from collections.abc import Iterator
from functools import lru_cache

import sqlcipher3
from fastapi import Request
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import QueuePool

from app.core.config import get_settings

# انتظار قفل الكتابة: مع عدة أجهزة كاشير نفضّل الانتظار قليلاً على فشل البيع.
BUSY_TIMEOUT_MS = 15_000
_READ_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
_IMMEDIATE = "dealzora_immediate"


@lru_cache
def get_engine() -> Engine:
    settings = get_settings()

    def _connect():
        # isolation_level=None: نتحكم بالمعاملات يدوياً (وصفة SQLAlchemy الرسمية لـ SQLite).
        conn = sqlcipher3.connect(
            settings.db_path, check_same_thread=False, isolation_level=None
        )
        password = settings.db_password.replace("'", "''")
        conn.execute(f"PRAGMA key = '{password}'")  # لازم يكون أول أمر
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = FULL")
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute(f"PRAGMA busy_timeout = {BUSY_TIMEOUT_MS}")
        return conn

    engine = create_engine(
        "sqlite+pysqlite://",
        creator=_connect,
        poolclass=QueuePool,
        pool_size=8,
        max_overflow=8,
    )

    @event.listens_for(engine, "begin")
    def _begin(conn):  # noqa: ANN001
        immediate = conn.get_execution_options().get(_IMMEDIATE, False)
        conn.exec_driver_sql("BEGIN IMMEDIATE" if immediate else "BEGIN")

    return engine


@lru_cache
def get_sessionmaker() -> sessionmaker[Session]:
    """للقراءة وللمهام الخلفية. الطلبات تستخدم get_session (تختار تلقائياً)."""
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


@lru_cache
def get_write_sessionmaker() -> sessionmaker[Session]:
    """كل معاملة تبدأ BEGIN IMMEDIATE (نفس الـ pool، خيار تنفيذ مختلف)."""
    return sessionmaker(
        bind=get_engine().execution_options(**{_IMMEDIATE: True}),
        expire_on_commit=False,
    )


def get_session(request: Request) -> Iterator[Session]:
    maker = (
        get_sessionmaker()
        if request.method in _READ_METHODS
        else get_write_sessionmaker()
    )
    with maker() as session:
        try:
            yield session
        except Exception:
            session.rollback()
            raise
