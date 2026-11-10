"""قراءة وحفظ الإعدادات العامة في القاعدة (لا في المتصفح).

- العملة: إعداد للمحل كله، يُنشر للمزامنة (Outbox).
- مجلد النسخ الاحتياطي: خاص بهذا الجهاز (مسار محلي)، فلا يُنشر للمزامنة.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.base import uuid7
from app.core.database import get_sessionmaker
from app.core.outbox import OutboxOp, enqueue_outbox
from app.core.security import Actor

from .constants import DEFAULT_CURRENCY, ENTITY_SETTING, SettingKey
from .model import AppSetting
from .schema import CurrencyIn, CurrencyOut

# مفاتيح خاصة بالجهاز لا تُرفع للسحابة.
_LOCAL_KEYS = frozenset({SettingKey.BACKUP_DIR})


def _get_row(session: Session, key: SettingKey) -> AppSetting | None:
    stmt = select(AppSetting).where(AppSetting.key == key.value, AppSetting.deleted_at.is_(None))
    return session.scalars(stmt).first()


def read_setting(key: SettingKey) -> str | None:
    """قراءة خارج طلب HTTP (النسخ التلقائي عند الإقلاع). جلسة قصيرة خاصة."""
    try:
        with get_sessionmaker()() as session:
            row = _get_row(session, key)
            return row.value if row and row.value else None
    except Exception:  # noqa: BLE001 - قبل init_db أو أثناء الاستعادة: نرجع للافتراضي
        return None


class SettingsService:
    def __init__(self, session: Session) -> None:
        self.session = session

    # ---------- قراءة ----------
    def get(self, key: SettingKey) -> str | None:
        row = _get_row(self.session, key)
        return row.value if row and row.value else None

    def currency(self) -> CurrencyOut:
        return CurrencyOut(
            code=self.get(SettingKey.CURRENCY_CODE) or DEFAULT_CURRENCY["code"],
            symbol=self.get(SettingKey.CURRENCY_SYMBOL) or DEFAULT_CURRENCY["symbol"],
            name=self.get(SettingKey.CURRENCY_NAME) or DEFAULT_CURRENCY["name"],
        )

    # ---------- كتابة ----------
    def set_currency(self, actor: Actor, data: CurrencyIn) -> CurrencyOut:
        before = self.currency()
        self._set(actor, SettingKey.CURRENCY_CODE, data.code.upper())
        self._set(actor, SettingKey.CURRENCY_SYMBOL, data.symbol)
        self._set(actor, SettingKey.CURRENCY_NAME, data.name)
        after = self.currency()
        if after != before:
            record_audit(
                self.session, actor, entity=ENTITY_SETTING, entity_id="currency", action="update",
                changes={"currency": {"from": before.model_dump(), "to": after.model_dump()}},
            )  # fmt: skip
        self.session.commit()
        return after

    def set_backup_dir(self, actor: Actor, path: str | None) -> None:
        """لا commit هنا: المستدعي (مسار النسخ الاحتياطي) يتحقق من المجلد ثم يحفظ."""
        before = self.get(SettingKey.BACKUP_DIR)
        self._set(actor, SettingKey.BACKUP_DIR, path or "")
        if (path or None) != before:
            record_audit(
                self.session, actor, entity=ENTITY_SETTING, entity_id="backup_dir", action="update",
                changes={"backup_dir": {"from": before, "to": path}},
            )  # fmt: skip

    def _set(self, actor: Actor, key: SettingKey, value: str) -> None:
        row = _get_row(self.session, key)
        if row is None:
            row = AppSetting(
                id=uuid7(), key=key.value, value=value,
                device_id=actor.device_id, created_by=actor.user_id,
            )  # fmt: skip
            self.session.add(row)
            base_version = None
        elif row.value == value:
            return
        else:
            base_version = row.version
            row.value = value
            row.mark_modified()
        self.session.flush()
        if key not in _LOCAL_KEYS:
            enqueue_outbox(
                self.session,
                entity=ENTITY_SETTING,
                entity_id=row.id,
                op=OutboxOp.UPSERT,
                payload={"id": row.id, "version": row.version, "key": row.key, "value": row.value},
                base_version=base_version,
                device_id=actor.device_id,
            )
