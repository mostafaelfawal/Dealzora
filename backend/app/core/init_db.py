"""إنشاء الجداول مباشرة من الـ models (بدون Alembic). الـ migrations تُضاف بعد الإطلاق.

أثناء التطوير: غيّرت أي model؟ احذف ملفات القاعدة (pos.db*) وستُنشأ من جديد.
create_all لا يعدّل جدولاً موجوداً، ينشئ فقط الجداول الناقصة.
"""

from app.core.base import Base
from app.core.database import get_engine

# الاستيراد وحده يسجّل الجداول في Base.metadata. أضف هنا أي module جديد.
import app.core.audit  # noqa: F401
import app.core.outbox  # noqa: F401
import app.modules.users.model  # noqa: F401
import app.modules.customers.model  # noqa: F401
import app.modules.auth.model  # noqa: F401
import app.modules.products.model  # noqa: F401
import app.modules.catalog.model  # noqa: F401
import app.modules.shop.model  # noqa: F401
import app.modules.settings.model  # noqa: F401
import app.modules.devices.model  # noqa: F401
import app.modules.held.model  # noqa: F401
import app.modules.expenses.model  # noqa: F401
import app.modules.suppliers.model  # noqa: F401
import app.modules.treasury.model  # noqa: F401
import app.modules.shifts.model  # noqa: F401
import app.modules.sales.model  # noqa: F401
import app.modules.purchases.model  # noqa: F401
import app.modules.devtools.model  # noqa: F401

# تعديلات على جداول موجودة (create_all لا يعدّل جدولاً قائماً). كل خطوة آمنة للتكرار.
_UPGRADES = (
    # وردية واحدة للنظام كله ← وردية لكل جهاز (تعدد أجهزة الكاشير).
    "DROP INDEX IF EXISTS uq_shifts_single_open",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_shifts_open_per_device "
    "ON shifts (device_id) WHERE is_open = 1 AND deleted_at IS NULL",
)

# أعمدة جديدة في جداول قائمة: (الجدول، العمود، التعريف). تُضاف فقط إن لم تكن موجودة.
_NEW_COLUMNS = (
    # فودافون كاش وإنستاباي
    ("sales", "wallet_amount", "INTEGER NOT NULL DEFAULT 0"),
    ("sales", "payment_ref", "VARCHAR(40)"),
    ("sale_returns", "wallet_refund", "INTEGER NOT NULL DEFAULT 0"),
    # طرق الدفع حسب الدولة: لقطة اسم الطريقة الإلكترونية وقت البيع
    ("sales", "payment_label", "VARCHAR(40)"),
)


def init_db() -> None:
    engine = get_engine()
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        for sql in _UPGRADES:
            conn.exec_driver_sql(sql)
        for table, column, ddl in _NEW_COLUMNS:
            existing = {row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({table})")}
            if column not in existing:
                conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")