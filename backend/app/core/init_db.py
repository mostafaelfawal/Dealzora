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
import app.modules.auth.model  # noqa: F401
import app.modules.products.model  # noqa: F401


def init_db() -> None:
    Base.metadata.create_all(get_engine())