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
import app.modules.installments.model  # noqa: F401
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
import app.modules.purchase_orders.model  # noqa: F401
import app.modules.promotions.model  # noqa: F401
import app.modules.loyalty.model  # noqa: F401
import app.modules.batches.model  # noqa: F401
import app.modules.branch_sync.model  # noqa: F401
import app.modules.devtools.model  # noqa: F401
import app.modules.e_receipt.model  # noqa: F401

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
    # باركود الميزان: كود الصنف على الميزان (PLU)
    ("products", "scale_code", "INTEGER"),
    # أسعار الجملة: سعر الجملة للوحدة الأساسية + الكمية التي يبدأ منها (× 1000)
    ("products", "wholesale_price", "INTEGER"),
    ("products", "wholesale_min_qty", "INTEGER"),
    ("customers", "is_wholesale", "BOOLEAN NOT NULL DEFAULT 0"),
    # العروض التلقائية في الفاتورة
    ("sales", "promo_discount", "INTEGER NOT NULL DEFAULT 0"),
    ("sale_lines", "promo_discount", "INTEGER NOT NULL DEFAULT 0"),
    ("sale_lines", "promo_name", "VARCHAR(80)"),
    ("sale_lines", "is_wholesale", "BOOLEAN NOT NULL DEFAULT 0"),
    # نقاط الولاء
    ("customers", "loyalty_points", "INTEGER NOT NULL DEFAULT 0"),
    # تتبع الصلاحية والدفعات
    ("products", "track_expiry", "BOOLEAN NOT NULL DEFAULT 0"),
    ("sales", "loyalty_redeemed", "INTEGER NOT NULL DEFAULT 0"),
    ("sales", "loyalty_discount", "INTEGER NOT NULL DEFAULT 0"),
    ("sales", "loyalty_earned", "INTEGER NOT NULL DEFAULT 0"),
    ("sales", "loyalty_earn_reversed", "INTEGER NOT NULL DEFAULT 0"),
    ("sales", "loyalty_redeem_restored", "INTEGER NOT NULL DEFAULT 0"),
    ("sale_returns", "loyalty_reversed", "INTEGER NOT NULL DEFAULT 0"),
    ("sale_returns", "loyalty_restored", "INTEGER NOT NULL DEFAULT 0"),
    # ضريبة القيمة المضافة (المرحلة 1 من الإيصال الإلكتروني).
    # الأصناف القائمة تأخذ الافتراضي: خاضع بنسبة 14% (لا أثر لها حتى يُفعّل المحل الضريبة).
    ("products", "tax_type", "VARCHAR(8) NOT NULL DEFAULT 'taxable'"),
    ("products", "tax_rate", "INTEGER NOT NULL DEFAULT 1400"),
    # الفواتير والمرتجعات القديمة: أعمدة الضريبة NULL = «لم تُحسب» (لا نخترع ضريبة بأثر رجعي).
    ("sales", "tax_mode", "VARCHAR(10)"),
    ("sales", "taxable_total", "INTEGER"),
    ("sales", "tax_total", "INTEGER"),
    ("sale_lines", "tax_type", "VARCHAR(8)"),
    ("sale_lines", "tax_rate", "INTEGER"),
    ("sale_lines", "taxable_amount", "INTEGER"),
    ("sale_lines", "tax_amount", "INTEGER"),
    ("sale_lines", "returned_tax", "INTEGER NOT NULL DEFAULT 0"),
    ("sale_returns", "taxable_total", "INTEGER"),
    ("sale_returns", "tax_total", "INTEGER"),
    ("sale_return_lines", "taxable_amount", "INTEGER"),
    ("sale_return_lines", "tax_amount", "INTEGER"),
    # الإيصال الإلكتروني (المرحلة 2): كود الصنف في المنظومة، وكود وحدة القياس على قائمة الوحدات.
    ("products", "eta_item_type", "VARCHAR(3)"),
    ("products", "eta_item_code", "VARCHAR(100)"),
    ("measure_units", "eta_unit_type", "VARCHAR(30)"),
    # الإيصال الإلكتروني (المرحلة 3): الـ UUID والسلسلة والحالة على الفاتورة والمرتجع. NULL = لم يتولد.
    ("sales", "eta_status", "VARCHAR(12)"),
    ("sales", "eta_uuid", "VARCHAR(64)"),
    ("sales", "eta_previous_uuid", "VARCHAR(64)"),
    ("sales", "eta_receipt_number", "VARCHAR(50)"),
    ("sales", "eta_device_id", "VARCHAR(36)"),
    ("sales", "eta_seq", "INTEGER"),
    ("sales", "eta_document", "TEXT"),
    ("sales", "eta_error", "TEXT"),
    ("sale_returns", "eta_status", "VARCHAR(12)"),
    ("sale_returns", "eta_uuid", "VARCHAR(64)"),
    ("sale_returns", "eta_previous_uuid", "VARCHAR(64)"),
    ("sale_returns", "eta_reference_uuid", "VARCHAR(64)"),
    ("sale_returns", "eta_receipt_number", "VARCHAR(50)"),
    ("sale_returns", "eta_device_id", "VARCHAR(36)"),
    ("sale_returns", "eta_seq", "INTEGER"),
    ("sale_returns", "eta_document", "TEXT"),
    ("sale_returns", "eta_error", "TEXT"),
    # الإيصال الإلكتروني (المرحلة 4): رقم دفعة الإرسال و longId المنظومة ووقت الإرسال.
    ("sales", "eta_submission_uuid", "VARCHAR(64)"),
    ("sales", "eta_long_id", "VARCHAR(100)"),
    ("sales", "eta_sent_at", "DATETIME"),
    ("sale_returns", "eta_submission_uuid", "VARCHAR(64)"),
    ("sale_returns", "eta_long_id", "VARCHAR(100)"),
    ("sale_returns", "eta_sent_at", "DATETIME"),
    # المرحلة 5: قرار المدير بإرسال مرتجع رغم رفض فاتورته الأصلية (يفك إيقاف سلسلة الجهاز).
    ("sale_returns", "eta_release", "BOOLEAN NOT NULL DEFAULT 0"),
    # المرحلة 8: بيئة الإيصال (تجريبية/فعلية) و UUID الإيصال المرفوض الذي صُحّح (referenceOldUUID).
    ("sales", "eta_environment", "VARCHAR(10)"),
    ("sales", "eta_replaced_uuid", "VARCHAR(64)"),
    # رصيد العميل لدى المحل (باقٍ محفوظ، دفع من الرصيد، مرتجع للرصيد).
    ("sales", "change_kept", "INTEGER NOT NULL DEFAULT 0"),
    ("sales", "balance_used", "INTEGER NOT NULL DEFAULT 0"),
    ("sale_returns", "balance_refund", "INTEGER NOT NULL DEFAULT 0"),
    ("sale_returns", "eta_environment", "VARCHAR(10)"),
    ("sale_returns", "eta_replaced_uuid", "VARCHAR(64)"),
)

# فهارس على أعمدة أُضيفت بـ _NEW_COLUMNS (تُنشأ بعدها).
_POST_COLUMN_UPGRADES = (
    # الـ UUID فريد، وموضع كل إيصال في سلسلة جهازه فريد (بيعاً أو مرتجعاً): حماية إضافية من كسر السلسلة.
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_eta_uuid ON sales (eta_uuid) WHERE eta_uuid IS NOT NULL",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_sale_returns_eta_uuid ON sale_returns (eta_uuid) WHERE eta_uuid IS NOT NULL",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_eta_seq ON sales (eta_device_id, eta_seq) WHERE eta_seq IS NOT NULL",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_sale_returns_eta_seq "
    "ON sale_returns (eta_device_id, eta_seq) WHERE eta_seq IS NOT NULL",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_products_scale_code_live "
    "ON products (scale_code) WHERE deleted_at IS NULL AND scale_code IS NOT NULL",
    # دور المالك: النسخ القديمة بلا مالك ← أقدم مدير (نشط أولاً) يصبح المالك. مرة واحدة فقط.
    "UPDATE users SET role = 'owner' WHERE id = ("
    "  SELECT id FROM users WHERE role = 'manager' AND deleted_at IS NULL"
    "  ORDER BY is_active DESC, created_at, id LIMIT 1"
    ") AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'owner' AND deleted_at IS NULL)",
)


# أعمدة أُلغيت: تُحذف إن وُجدت في قاعدة قديمة (NOT NULL بلا قيمة افتراضية يكسر الإدخال).
_DROPPED_COLUMNS = (
    # زيادة التقسيط (فائدة = ربا) أُلغيت نهائياً.
    ("installment_plans", "markup_bp"),
    ("installment_plans", "markup_amount"),
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
        for table, column in _DROPPED_COLUMNS:
            existing = {row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({table})")}
            if column in existing:
                conn.exec_driver_sql(f"ALTER TABLE {table} DROP COLUMN {column}")
        for sql in _POST_COLUMN_UPGRADES:
            conn.exec_driver_sql(sql)