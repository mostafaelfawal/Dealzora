"""قراءة وحفظ الإعدادات العامة في القاعدة (لا في المتصفح).

- العملة: إعداد للمحل كله، يُنشر للمزامنة (Outbox).
- مجلد النسخ الاحتياطي: خاص بهذا الجهاز (مسار محلي)، فلا يُنشر للمزامنة.
"""

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.base import uuid7
from app.core.database import get_sessionmaker
from app.core.outbox import OutboxOp, enqueue_outbox
from app.core.security import Actor

from .constants import (
    DEFAULT_CASHIER_DISCOUNT_ENABLED,
    DEFAULT_CASHIER_DISCOUNT_PERCENT,
    DEFAULT_CURRENCY,
    ENTITY_SETTING,
    SettingKey,
)
from .model import AppSetting
from .payments import PaymentKind
from .scale import ScaleBarcodeConfig
from .schema import (
    CurrencyIn,
    CurrencyOut,
    DiscountLimitIn,
    DiscountLimitOut,
    PaymentConfigIn,
    PaymentConfigOut,
    PaymentMethodOut,
)

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

    def discount_limit(self) -> DiscountLimitOut:
        enabled_raw = self.get(SettingKey.DISCOUNT_LIMIT_ENABLED)
        percent_raw = self.get(SettingKey.DISCOUNT_LIMIT_PERCENT)
        enabled = DEFAULT_CASHIER_DISCOUNT_ENABLED if enabled_raw is None else enabled_raw == "1"
        try:
            percent = min(max(int(percent_raw), 0), 100) if percent_raw else DEFAULT_CASHIER_DISCOUNT_PERCENT
        except ValueError:  # قيمة تالفة: نرجع للافتراضي
            percent = DEFAULT_CASHIER_DISCOUNT_PERCENT
        return DiscountLimitOut(enabled=enabled, max_percent=percent)

    def scale_barcode(self) -> ScaleBarcodeConfig:
        raw = self.get(SettingKey.SCALE_BARCODE)
        if raw:
            try:
                return ScaleBarcodeConfig.model_validate_json(raw)
            except ValueError:  # قيمة تالفة: متوقف حتى يُحفظ من جديد
                pass
        return ScaleBarcodeConfig()

    def payment_config(self) -> PaymentConfigOut:
        raw = self.get(SettingKey.PAY_METHODS)
        if raw:
            try:
                return PaymentConfigOut.model_validate(json.loads(raw))
            except ValueError:  # قيمة تالفة (مزامنة/تعديل يدوي): نتعامل كأن لا طرق
                return PaymentConfigOut(country=None, methods=[])
        return self._legacy_payment_config()

    def payment_methods(self) -> dict[str, PaymentMethodOut]:
        """معرّف ← الطريقة (المفعّلة وغير المفعّلة)."""
        return {m.id: m for m in self.payment_config().methods}

    def _legacy_payment_config(self) -> PaymentConfigOut:
        """قبل القوالب: رقم فودافون كاش وعنوان إنستاباي في مفتاحين منفصلين."""
        methods = []
        if vf := self.get(SettingKey.PAY_VODAFONE_CASH):
            methods.append(
                PaymentMethodOut(id="vodafone_cash", name="فودافون كاش", kind=PaymentKind.WALLET, account=vf, enabled=True)
            )
        if ip := self.get(SettingKey.PAY_INSTAPAY):
            methods.append(
                PaymentMethodOut(id="instapay", name="إنستاباي", kind=PaymentKind.TRANSFER, account=ip, enabled=True)
            )
        return PaymentConfigOut(country="EG" if methods else None, methods=methods)

    # ---------- كتابة ----------
    def set_payment_config(self, actor: Actor, data: PaymentConfigIn) -> PaymentConfigOut:
        before = self.payment_config()
        after = PaymentConfigOut.model_validate(data.model_dump())
        self._set(actor, SettingKey.PAY_METHODS, after.model_dump_json())
        if after != before:
            old = {m.id: m for m in before.methods}
            new = {m.id: m for m in after.methods}
            record_audit(
                self.session, actor, entity=ENTITY_SETTING, entity_id="payments", action="update",
                changes={
                    "payment_methods": {
                        "from": [m.name for m in before.methods if m.enabled],
                        "to": [m.name for m in after.methods if m.enabled],
                    },
                    **({"country": {"from": before.country, "to": after.country}} if before.country != after.country else {}),
                    **({"added": added} if (added := [new[k].name for k in new.keys() - old.keys()]) else {}),
                    **({"removed": removed} if (removed := [old[k].name for k in old.keys() - new.keys()]) else {}),
                },
            )  # fmt: skip
        self.session.commit()
        return after

    def set_scale_barcode(self, actor: Actor, data: ScaleBarcodeConfig) -> ScaleBarcodeConfig:
        before = self.scale_barcode()
        self._set(actor, SettingKey.SCALE_BARCODE, data.model_dump_json())
        if data != before:
            record_audit(
                self.session, actor, entity=ENTITY_SETTING, entity_id="scale_barcode", action="update",
                changes={"scale_barcode": {"from": before.model_dump(mode="json"), "to": data.model_dump(mode="json")}},
            )  # fmt: skip
        self.session.commit()
        return data

    def set_discount_limit(self, actor: Actor, data: DiscountLimitIn) -> DiscountLimitOut:
        before = self.discount_limit()
        self._set(actor, SettingKey.DISCOUNT_LIMIT_ENABLED, "1" if data.enabled else "0")
        self._set(actor, SettingKey.DISCOUNT_LIMIT_PERCENT, str(data.max_percent))
        after = self.discount_limit()
        if after != before:
            record_audit(
                self.session, actor, entity=ENTITY_SETTING, entity_id="discount_limit", action="update",
                changes={"discount_limit": {"from": before.model_dump(), "to": after.model_dump()}},
            )  # fmt: skip
        self.session.commit()
        return after

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
