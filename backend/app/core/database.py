"""اتصال SQLCipher (WAL) + جلسة لكل طلب. كل أمر (command) = معاملة واحدة."""

from collections.abc import Iterator
from functools import lru_cache

import sqlcipher3
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import QueuePool

from app.core.config import get_settings


@lru_cache
def get_engine() -> Engine:
    settings = get_settings()

    def _connect():
        # isolation_level=None: نتحكم بالمعاملات يدوياً (وصفة SQLAlchemy الرسمية لـ SQLite).
        conn = sqlcipher3.connect(settings.db_path, check_same_thread=False, isolation_level=None)
        password = settings.db_password.replace("'", "''")
        conn.execute(f"PRAGMA key = '{password}'")  # لازم يكون أول أمر
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = FULL")
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA busy_timeout = 5000")
        return conn

    engine = create_engine(
        "sqlite+pysqlite://",
        creator=_connect,
        poolclass=QueuePool,
        pool_size=5,
        max_overflow=5,
    )

    @event.listens_for(engine, "begin")
    def _begin(conn):  # noqa: ANN001
        conn.exec_driver_sql("BEGIN")

    return engine


@lru_cache
def get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def get_session() -> Iterator[Session]:
    with get_sessionmaker()() as session:
        try:
            yield session
        except Exception:
            session.rollback()
            raise
