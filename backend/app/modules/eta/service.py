"""منظومة الإيصال الإلكتروني (المرحلة 2): البيانات والإعدادات وفحص الجاهزية فقط، بلا أي اتصال بالمنظومة.

- إعدادات المحل (eta.config) وبيانات الفرع (eta.branch، محلية لهذا الجهاز الأساسي) في app_settings.
- بيانات كل جهاز في devices.DeviceEtaProfile، والأسرار مشفّرة (core/secret_box.py).
- كود وحدة القياس على قائمة الوحدات (catalog.MeasureUnit.eta_unit_type).
- التفعيل يُرفض ما دام فحص الجاهزية فيه بند مانع.

سجل التدقيق: كل تغيير يُسجَّل، والأسرار تظهر فيه فقط كـ «عُيّن/مُسح» بلا قيمة.
"""

import json
from enum import StrEnum
from typing import Any

from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.base import uuid7
from app.core.config import get_settings
from app.core.errors import AppError, BadRequestError, ConflictError, NotFoundError
from app.core.repository import live
from app.core.secret_box import open_secret, seal_secret
from app.core.security import Actor
from app.core.service_base import EntityService
from app.modules.catalog.constants import ENTITY_MEASURE_UNIT
from app.modules.catalog.model import MeasureUnit
from app.modules.catalog.registry import enqueue_unit
from app.modules.devices.model import Device, DeviceEtaProfile
from app.modules.products.model import Product, ProductUnit
from app.modules.settings.constants import SettingKey
from app.modules.settings.service import SettingsService
from app.modules.tax.service import load_config as load_tax

from .codes import CodeTable, is_valid, suggest_unit_code, table
from .constants import (
    ADDRESS_COUNTRY,
    ENTITY_ETA,
    ENTITY_ETA_DEVICE,
    ERROR_MESSAGES,
    MAIN_DEVICE_NAME,
    SAMPLE_LIMIT,
    EtaError,
)
from .schema import (
    CodeOut,
    DeviceProfileIn,
    DeviceProfileOut,
    EtaBranch,
    EtaConfig,
    ReadinessItem,
    ReadinessOut,
    ReadinessSection,
    ReadinessSeverity,
    SecretAction,
    SecretState,
    UnitMappingIn,
    UnitMappingOut,
)

_SECRET_FIELDS = {"client_secret": "client_secret_enc", "preshared_key": "preshared_key_enc"}
_DEVICE_FIELDS = ("pos_serial", "pos_os_version", "pos_model_framework", "client_id")


def _secret_context(pos_device_id: str, field: str) -> str:
    """aad للتشفير: النص المشفّر صالح لهذا الجهاز وهذا الحقل فقط."""
    return f"device_eta_profiles:{pos_device_id}:{field}"


def _secret_state(sealed: str | None, pos_device_id: str, field: str) -> SecretState:
    if not sealed:
        return SecretState.UNSET
    if open_secret(sealed, _secret_context(pos_device_id, field)) is None:
        return SecretState.UNREADABLE
    return SecretState.SET


def _load(model: type[BaseModel], raw: str | None) -> BaseModel:
    if raw:
        try:
            return model.model_validate_json(raw)
        except ValueError:  # قيمة تالفة: نبدأ من الافتراضي (والتفعيل متوقف فيه)
            pass
    return model()


class _Keep(dict):
    def __missing__(self, key: str) -> str:
        return "{" + key + "}"


def _diff(before: dict, after: dict) -> dict:
    return {k: {"from": before.get(k), "to": v} for k, v in after.items() if before.get(k) != v}


class EtaService(EntityService):
    entity = ENTITY_ETA
    messages = ERROR_MESSAGES

    def __init__(self, session: Session, actor: Actor) -> None:
        super().__init__(session, actor)
        self.settings = SettingsService(session)

    def _err(self, exc: type[AppError], error: StrEnum, /, **details: Any) -> AppError:
        """مثل الأساس، مع ملء {المتغيرات} في الرسالة من التفاصيل (المتغير الناقص يبقى كما هو)."""
        message = ERROR_MESSAGES[error].format_map(_Keep(details))  # type: ignore[index]
        return exc(code=error.value, message=message, details=details or None)

    # ================= إعدادات المحل =================
    def config(self) -> EtaConfig:
        return _load(EtaConfig, self.settings.get(SettingKey.ETA_CONFIG))  # type: ignore[return-value]

    def set_config(self, data: EtaConfig) -> EtaConfig:
        if data.activity_code and not is_valid(CodeTable.ACTIVITIES, data.activity_code):
            raise self._err(BadRequestError, EtaError.UNKNOWN_ACTIVITY_CODE, code=data.activity_code)
        if data.enabled:
            # التفعيل (أو حفظ تعديل وهو مفعّل) يُفحص بالقيم الجديدة نفسها.
            report = self.readiness(config=data)
            if not report.ready:
                raise self._err(
                    ConflictError,
                    EtaError.NOT_READY,
                    count=report.blockers,
                    items=[i.model_dump(mode="json") for i in report.items if i.severity is ReadinessSeverity.BLOCKER],
                )
        before = self.config()
        self.settings.put(self.actor, SettingKey.ETA_CONFIG, data.model_dump_json())
        changes = _diff(before.model_dump(mode="json"), data.model_dump(mode="json"))
        if changes:
            action = "enable" if data.enabled and not before.enabled else "disable" if before.enabled and not data.enabled else "update"
            record_audit(self.session, self.actor, entity=ENTITY_ETA, entity_id="config", action=action, changes=changes)
        self._commit()
        return data

    # ================= الفرع =================
    def branch(self) -> EtaBranch:
        return _load(EtaBranch, self.settings.get(SettingKey.ETA_BRANCH))  # type: ignore[return-value]

    def set_branch(self, data: EtaBranch) -> EtaBranch:
        before = self.branch()
        self.settings.put(self.actor, SettingKey.ETA_BRANCH, data.model_dump_json())
        changes = _diff(before.model_dump(mode="json"), data.model_dump(mode="json"))
        if changes:
            record_audit(self.session, self.actor, entity=ENTITY_ETA, entity_id="branch", action="update", changes=changes)
        self._commit()
        return data

    # ================= الأجهزة =================
    def _devices(self) -> list[tuple[str, str, bool]]:
        """(المعرّف، الاسم، أساسي؟): الجهاز الأساسي ثم أجهزة الكاشير المقترنة الحالية."""
        terminals = self.session.scalars(select(Device).where(live(Device)).order_by(Device.created_at)).all()
        return [(get_settings().device_id, MAIN_DEVICE_NAME, True), *((d.id, d.name, False) for d in terminals)]

    def _profiles(self) -> dict[str, DeviceEtaProfile]:
        rows = self.session.scalars(select(DeviceEtaProfile).where(live(DeviceEtaProfile))).all()
        return {r.pos_device_id: r for r in rows}

    @staticmethod
    def _device_out(device_id: str, name: str, is_main: bool, p: DeviceEtaProfile | None) -> DeviceProfileOut:
        return DeviceProfileOut(
            device_id=device_id,
            name=name,
            is_main=is_main,
            pos_serial=p.pos_serial if p else None,
            pos_os_version=p.pos_os_version if p else None,
            pos_model_framework=p.pos_model_framework if p else None,
            client_id=p.client_id if p else None,
            client_secret=_secret_state(p.client_secret_enc if p else None, device_id, "client_secret"),
            preshared_key=_secret_state(p.preshared_key_enc if p else None, device_id, "preshared_key"),
        )

    def devices(self) -> list[DeviceProfileOut]:
        profiles = self._profiles()
        return [self._device_out(i, n, m, profiles.get(i)) for i, n, m in self._devices()]

    def set_device(self, pos_device_id: str, data: DeviceProfileIn) -> DeviceProfileOut:
        known = {i: (n, m) for i, n, m in self._devices()}
        if pos_device_id not in known:
            raise self._err(NotFoundError, EtaError.DEVICE_NOT_FOUND)
        if data.pos_serial:
            other = self.session.scalar(
                select(DeviceEtaProfile.pos_device_id).where(
                    live(DeviceEtaProfile),
                    DeviceEtaProfile.pos_serial == data.pos_serial,
                    DeviceEtaProfile.pos_device_id != pos_device_id,
                )
            )
            if other is not None:
                raise self._err(ConflictError, EtaError.SERIAL_TAKEN, serial=data.pos_serial)

        profile = self._profiles().get(pos_device_id)
        is_new = profile is None
        if profile is None:
            profile = DeviceEtaProfile(
                id=uuid7(), pos_device_id=pos_device_id,
                device_id=self.actor.device_id, created_by=self.actor.user_id,
            )  # fmt: skip
            self.session.add(profile)

        before = {f: getattr(profile, f) for f in _DEVICE_FIELDS}
        for f in _DEVICE_FIELDS:
            setattr(profile, f, getattr(data, f))
        changes = _diff(before, {f: getattr(profile, f) for f in _DEVICE_FIELDS})

        # الأسرار: لا تظهر قيمتها في السجل أبداً، فقط ما حدث لها.
        for field, column in _SECRET_FIELDS.items():
            action: SecretAction = getattr(data, f"{field}_action")
            value: str | None = getattr(data, field)
            if action is SecretAction.SET:
                if not value:
                    raise BadRequestError("validation_error", "اكتب القيمة الجديدة أو اختر «بدون تغيير»")
                setattr(profile, column, seal_secret(value, _secret_context(pos_device_id, field)))
                changes[field] = "updated"
            elif action is SecretAction.CLEAR and getattr(profile, column):
                setattr(profile, column, None)
                changes[field] = "cleared"

        if changes:
            if not is_new:
                profile.mark_modified()
            self.session.flush()
            record_audit(
                self.session, self.actor, entity=ENTITY_ETA_DEVICE, entity_id=pos_device_id,
                action="update", changes=changes,
            )  # fmt: skip
            self._commit()
        name, is_main = known[pos_device_id]
        return self._device_out(pos_device_id, name, is_main, profile)

    # ================= الوحدات =================
    def _unit_usage(self) -> dict[str, int]:
        """اسم الوحدة ← عدد الأصناف النشطة التي تستخدمها (أساسية أو إضافية)."""
        usage: dict[str, int] = {}
        base = self.session.execute(
            select(Product.unit, func.count()).where(live(Product), Product.is_active.is_(True)).group_by(Product.unit)
        ).all()
        extra = self.session.execute(
            select(ProductUnit.name, func.count(func.distinct(ProductUnit.product_id)))
            .join(Product, Product.id == ProductUnit.product_id)
            .where(live(ProductUnit), live(Product), Product.is_active.is_(True))
            .group_by(ProductUnit.name)
        ).all()
        for name, count in [*base, *extra]:
            usage[name] = usage.get(name, 0) + int(count)
        return usage

    def units(self) -> list[UnitMappingOut]:
        usage = self._unit_usage()
        rows = self.session.scalars(select(MeasureUnit).where(live(MeasureUnit)).order_by(MeasureUnit.sort_order)).all()
        return [
            UnitMappingOut(
                id=u.id,
                name=u.name,
                eta_unit_type=u.eta_unit_type,
                suggested=suggest_unit_code(u.name),
                product_count=usage.get(u.name, 0),
            )
            for u in rows
        ]

    def set_unit(self, unit_id: str, data: UnitMappingIn) -> UnitMappingOut:
        unit = self.session.get(MeasureUnit, unit_id)
        if unit is None or unit.deleted_at is not None:
            raise self._err(NotFoundError, EtaError.UNIT_NOT_FOUND)
        code = data.eta_unit_type
        if code and not is_valid(CodeTable.UNITS, code):
            raise self._err(BadRequestError, EtaError.UNKNOWN_UNIT_CODE, code=code)
        if code != unit.eta_unit_type:
            before = unit.eta_unit_type
            base_version = unit.version
            unit.eta_unit_type = code
            unit.mark_modified()
            self.session.flush()
            record_audit(
                self.session, self.actor, entity=ENTITY_MEASURE_UNIT, entity_id=unit.id, action="update",
                changes={"eta_unit_type": {"from": before, "to": code}},
            )  # fmt: skip
            enqueue_unit(self.session, self.actor, unit, base_version=base_version)
            self._commit()
        return UnitMappingOut(
            id=unit.id, name=unit.name, eta_unit_type=unit.eta_unit_type,
            suggested=suggest_unit_code(unit.name), product_count=self._unit_usage().get(unit.name, 0),
        )  # fmt: skip

    # ================= جداول الأكواد =================
    @staticmethod
    def codes(name: CodeTable) -> list[CodeOut]:
        return [CodeOut(code=e.code, desc_en=e.desc_en, desc_ar=e.desc_ar, ref=e.ref) for e in table(name)]

    # ================= الجاهزية =================
    def readiness(self, config: EtaConfig | None = None) -> ReadinessOut:
        cfg = config or self.config()
        items: list[ReadinessItem] = []

        def add(key: str, section: ReadinessSection, title: str, *, warning: bool = False, **kw) -> None:  # noqa: ANN003
            items.append(
                ReadinessItem(
                    key=key, section=section, title=title,
                    severity=ReadinessSeverity.WARNING if warning else ReadinessSeverity.BLOCKER, **kw,
                )  # fmt: skip
            )

        # 1) ضريبة القيمة المضافة: الإيصال يحتاج ضريبة كل صنف (taxableItems).
        if not load_tax(self.session).enabled:
            add("tax.enabled", ReadinessSection.TAX, "ضريبة القيمة المضافة غير مفعّلة",
                detail="فعّلها من الإعدادات ← محلي ← ضريبة القيمة المضافة")  # fmt: skip

        # 2) المحل (seller)
        if not cfg.rin:
            add("shop.rin", ReadinessSection.SHOP, "رقم التسجيل الضريبي (RIN) غير مكتوب")
        if not cfg.company_trade_name:
            add("shop.trade_name", ReadinessSection.SHOP, "الاسم التجاري المسجّل غير مكتوب")
        if not cfg.activity_code:
            add("shop.activity_code", ReadinessSection.SHOP, "كود النشاط غير محدد")
        elif not is_valid(CodeTable.ACTIVITIES, cfg.activity_code):
            add("shop.activity_code", ReadinessSection.SHOP, "كود النشاط غير موجود في جدول المنظومة",
                detail=cfg.activity_code)  # fmt: skip

        # 3) الفرع (branchCode + branchAddress: الحقول الإلزامية في الـ SDK)
        br = self.branch()
        if not br.branch_code:
            add("branch.code", ReadinessSection.BRANCH, "كود الفرع في المنظومة غير مكتوب",
                detail="من ملف الممول على بوابة المنظومة")  # fmt: skip
        if br.country != ADDRESS_COUNTRY:
            add("branch.country", ReadinessSection.BRANCH, "دولة الفرع يجب أن تكون EG")
        missing = [label for label, value in (
            ("المحافظة", br.governate), ("المدينة/المنطقة", br.region_city),
            ("الشارع", br.street), ("رقم المبنى", br.building_number),
        ) if not value]  # fmt: skip
        if missing:
            add("branch.address", ReadinessSection.BRANCH, "عنوان الفرع ناقص", samples=missing, count=len(missing))

        # 4) الأجهزة: كل جهاز يصدر إيصالات يحتاج بياناته في المنظومة.
        profiles = self._profiles()
        serials: dict[str, list[str]] = {}
        for device_id, name, _main in self._devices():
            p = profiles.get(device_id)
            need = [label for label, value in (
                ("الرقم التسلسلي", p and p.pos_serial), ("إصدار نظام التشغيل", p and p.pos_os_version),
                ("Model Framework", p and p.pos_model_framework), ("Client ID", p and p.client_id),
            ) if not value]  # fmt: skip
            secret = _secret_state(p.client_secret_enc if p else None, device_id, "client_secret")
            if secret is SecretState.UNSET:
                need.append("Client Secret")
            if need:
                add(f"device.{device_id}", ReadinessSection.DEVICES, f"بيانات «{name}» في المنظومة ناقصة",
                    samples=need, count=len(need), ref_id=device_id)  # fmt: skip
            if secret is SecretState.UNREADABLE:
                add(f"device.{device_id}.client_secret", ReadinessSection.DEVICES,
                    f"تعذّر قراءة Client Secret لـ«{name}»: أعد إدخاله", ref_id=device_id)  # fmt: skip
            pre = _secret_state(p.preshared_key_enc if p else None, device_id, "preshared_key")
            if pre is SecretState.UNREADABLE:
                add(f"device.{device_id}.preshared_key", ReadinessSection.DEVICES,
                    f"تعذّر قراءة المفتاح المشترك لـ«{name}»: أعد إدخاله", ref_id=device_id)  # fmt: skip
            elif pre is SecretState.UNSET:
                # الـ SDK لا يذكر هل presharedkey إلزامي: تنبيه فقط حتى يتأكد.
                add(f"device.{device_id}.preshared_key", ReadinessSection.DEVICES,
                    f"المفتاح المشترك (presharedkey) غير مكتوب لـ«{name}»", warning=True,
                    detail="الـ SDK لا يوضح هل هو إلزامي", ref_id=device_id)  # fmt: skip
            if p and p.pos_serial:
                serials.setdefault(p.pos_serial, []).append(name)
        # سلسلة الإيصالات أقدم من آخر إيصال صدر (استعادة نسخة احتياطية قديمة): يُوقف التوليد حتى القرار.
        from app.modules.e_receipt.service import chain_gap  # متأخر: e_receipt يعتمد على eta

        for device_id, name, _main in self._devices():
            link = chain_gap(self.session, device_id)
            if link is not None:
                add(f"chain.{device_id}", ReadinessSection.DEVICES,
                    f"سلسلة إيصالات «{name}» أقدم من آخر إيصال صدر (استعادة نسخة احتياطية قديمة؟)",
                    detail=f"آخر إيصال صدر فعلاً رقمه {link.seq} في سلسلة الجهاز. "
                           "اعتمد «متابعة السلسلة من آخر إيصال صادر» ثم أعد توليد الإيصالات المعلّقة.",
                    ref_id=device_id)  # fmt: skip
        for serial, names in serials.items():
            if len(names) > 1:
                add(f"device.serial.{serial}", ReadinessSection.DEVICES, "نفس الرقم التسلسلي لأكثر من جهاز",
                    detail=serial, samples=names)  # fmt: skip

        # 5) الوحدات المستخدمة في أصناف نشطة ولا كود لها.
        usage = self._unit_usage()
        mapped = {
            u.name: u.eta_unit_type
            for u in self.session.scalars(select(MeasureUnit).where(live(MeasureUnit))).all()
        }
        unmapped = sorted(n for n in usage if not is_valid(CodeTable.UNITS, mapped.get(n)))
        if unmapped:
            add("units.unmapped", ReadinessSection.UNITS, "وحدات قياس بلا كود في المنظومة",
                count=len(unmapped), samples=unmapped[:SAMPLE_LIMIT])  # fmt: skip

        # 6) الأصناف النشطة بلا كود في المنظومة.
        missing_code = or_(Product.eta_item_type.is_(None), Product.eta_item_code.is_(None))
        active = (live(Product), Product.is_active.is_(True))
        count = self.session.scalar(select(func.count()).select_from(Product).where(*active, missing_code)) or 0
        if count:
            names = self.session.scalars(
                select(Product.name).where(*active, missing_code).order_by(Product.name).limit(SAMPLE_LIMIT)
            ).all()
            add("products.missing_code", ReadinessSection.PRODUCTS, "أصناف نشطة بلا كود في المنظومة",
                count=int(count), samples=list(names))  # fmt: skip

        blockers = sum(1 for i in items if i.severity is ReadinessSeverity.BLOCKER)
        return ReadinessOut(ready=blockers == 0, blockers=blockers, warnings=len(items) - blockers, items=items)


def eta_enabled(session: Session) -> bool:
    """للمراحل التالية: هل المنظومة مفعّلة على هذا المحل؟"""
    raw = SettingsService(session).get(SettingKey.ETA_CONFIG)
    try:
        return bool(raw and json.loads(raw).get("enabled"))
    except ValueError:
        return False
