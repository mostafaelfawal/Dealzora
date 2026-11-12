"""تحويل سطر سجل العمليات لعربي مقروء: جملة واحدة + تفاصيل «الحقل: قبل ← بعد».

طبقة عرض فقط: لا تغيّر ما يُخزَّن، فتعمل على السجلات القديمة والجديدة معاً.
- الأسماء بدل المعرّفات (الصنف، العميل، المستخدم، رقم الفاتورة...) من القاعدة دفعة واحدة لكل صفحة.
- المال بعملة المحل (القروش ← جنيه)، والكميات (× 1000 ← عادية)، والتواريخ بتوقيت الجهاز.
- أي مفتاح غير معروف يظهر كما هو بدل أن يختفي (لا نخفي معلومة عن المدير).
"""

from collections import defaultdict
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import AuditLog

QTY_SCALE = 1000
MONEY_SCALE = 100


@dataclass(frozen=True, slots=True)
class Detail:
    label: str
    before: str | None  # None = قيمة واحدة (إضافة/حذف) وليس تغييراً
    after: str


@dataclass(frozen=True, slots=True)
class Described:
    summary: str
    details: list[Detail]


# ================= الأسماء =================
ENTITY_LABELS: dict[str, str] = {
    "product": "صنف",
    "category": "قسم",
    "measure_unit": "وحدة قياس",
    "customer": "عميل",
    "supplier": "مورد",
    "sale": "فاتورة بيع",
    "purchase": "فاتورة شراء",
    "expense": "مصروف",
    "cash_entry": "حركة خزنة",
    "shift": "وردية",
    "user": "مستخدم",
    "device": "جهاز كاشير",
    "shop": "المحل",
    "app_setting": "إعدادات",
    "backup": "نسخة احتياطية",
    "devtools": "بيانات تجريبية",
    "held_invoice": "فاتورة معلّقة",
}

# مع «ال» للجمل: «عدّل الصنف «سكر»».
_THE = {
    "product": "الصنف",
    "category": "القسم",
    "measure_unit": "الوحدة",
    "customer": "العميل",
    "supplier": "المورد",
    "sale": "فاتورة البيع",
    "purchase": "فاتورة الشراء",
    "expense": "المصروف",
    "cash_entry": "حركة الخزنة",
    "shift": "الوردية",
    "user": "المستخدم",
    "device": "جهاز الكاشير",
    "shop": "المحل",
    "app_setting": "الإعدادات",
    "backup": "النسخة الاحتياطية",
}

ACTION_LABELS: dict[str, str] = {
    "create": "إضافة",
    "update": "تعديل",
    "delete": "حذف",
    "toggle_active": "تفعيل/تعطيل",
    "duplicate": "نسخ",
    "stock_adjust": "تعديل مخزون",
    "price_from_purchase": "سعر من فاتورة شراء",
    "collect_payment": "تحصيل دفعة",
    "payment": "سداد مورد",
    "return": "مرتجع",
    "open": "فتح وردية",
    "close": "قفل وردية",
    "rename": "تغيير الاسم",
    "revoke": "إلغاء ربط جهاز",
    "restore": "استعادة نسخة",
    "demo_clear": "مسح البيانات التجريبية",
    "hold": "تعليق فاتورة",
    "recall": "استرجاع فاتورة معلّقة",
    "discard": "حذف فاتورة معلّقة",
    "login": "تسجيل دخول",
    "login_failed": "محاولة دخول فاشلة",
    "logout": "تسجيل خروج",
    "password_change": "تغيير كلمة المرور",
    "password_change_failed": "محاولة فاشلة لتغيير كلمة المرور",
    "password_reset": "إعادة تعيين كلمة المرور",
    "setup": "الإعداد الأول",
    "user_create": "إضافة مستخدم",
    "user_update": "تعديل مستخدم",
    "user_delete": "حذف مستخدم",
}

# عمليات تُبرز للمدير (حذف، أموال/مخزون خارج المسار العادي، أمان).
DANGER_ACTIONS = frozenset(
    {
        "delete",
        "user_delete",
        "stock_adjust",
        "return",
        "restore",
        "revoke",
        "demo_clear",
        "login_failed",
        "password_change_failed",
        "password_reset",
    }
)

_VERB = {
    "create": "أضاف",
    "update": "عدّل",
    "delete": "حذف",
    "rename": "غيّر اسم",
}

_ENUMS: dict[str, dict[str, str]] = {
    "role": {"manager": "مدير", "cashier": "كاشير"},
    "direction": {"in": "داخل للخزنة", "out": "خارج من الخزنة"},
    "kind": {
        "expense": "مصروف",
        "manual_in": "إيداع يدوي",
        "manual_out": "سحب يدوي",
        "sale": "بيع نقدي",
        "sale_return": "رد نقدية لمرتجع بيع",
        "purchase": "شراء نقدي",
        "purchase_return": "نقدية من مرتجع شراء",
        "customer_payment": "تحصيل من عميل",
        "supplier_payment": "سداد لمورد",
        "shift_diff": "عجز/زيادة درج",
    },
    "refund_method": {"balance": "خصم من مستحقات المورد", "cash": "نقدية للخزنة"},
    "payment_method": {"cash": "كاش", "credit": "آجل", "mixed": "مختلط"},
    "adjust_reason": {"count": "جرد", "damage": "تالف", "gift": "هدية", "other": "سبب آخر"},
    "return_reason": {
        "wrong_item": "صنف خطأ",
        "defective": "عيب في الصنف",
        "customer_changed": "العميل غيّر رأيه",
        "other": "سبب آخر",
    },
}

# حقول لا تفيد المدير (ترتيب داخلي، مراجع تقنية).
_HIDDEN = frozenset({"sort_order", "source_entity", "version"})

_LABELS: dict[str, str] = {
    "name": "الاسم",
    "username": "اسم المستخدم",
    "role": "الصلاحية",
    "is_active": "الحالة",
    "barcode": "الباركود",
    "category_id": "القسم",
    "unit": "وحدة البيع",
    "units": "وحدات إضافية",
    "allow_decimal": "يُباع بالوزن",
    "cost_price": "سعر الشراء",
    "sale_price": "سعر البيع",
    "min_stock": "الحد الأدنى للمخزون",
    "stock_qty": "الرصيد",
    "qty_delta": "التغيير في الكمية",
    "reason": "السبب",
    "phone": "الهاتف",
    "address": "العنوان",
    "notes": "ملاحظات",
    "note": "ملاحظة",
    "credit_limit": "الحد الائتماني",
    "amount": "المبلغ",
    "category": "البند",
    "spent_at": "التاريخ",
    "occurred_at": "التاريخ",
    "direction": "الاتجاه",
    "kind": "النوع",
    "source_id": "مرتبطة بـ",
    "cashier_id": "الكاشير",
    "opened_at": "فُتحت",
    "closed_at": "قُفلت",
    "opening_float": "فكّة البداية",
    "expected_cash": "المتوقع في الدرج",
    "counted_cash": "المعدود فعلاً",
    "difference": "الفرق (عجز/زيادة)",
    "number": "رقم الفاتورة",
    "return_number": "رقم المرتجع",
    "total": "الإجمالي",
    "paid": "المدفوع",
    "cash": "كاش",
    "credit": "آجل",
    "discount": "الخصم",
    "cash_refund": "رد نقدي",
    "credit_refund": "خصم من الحساب",
    "refund_method": "طريقة الرد",
    "customer_id": "العميل",
    "supplier_id": "المورد",
    "purchase_id": "فاتورة الشراء",
    "items": "عدد الأصناف",
    "balance_after": "الرصيد بعدها",
    "locked": "قُفل الحساب",
    "currency": "العملة",
    "backup_dir": "مكان النسخ",
    "size": "الحجم",
    "source": "المصدر",
    "safety_backup": "نسخة الأمان قبلها",
    "detached_products": "أصناف أصبحت بدون قسم",
    "held_cleared": "فواتير معلّقة حُذفت مع القفل",
    "deleted": "المحذوف",
}

_MONEY = frozenset(
    {
        "cost_price", "sale_price", "credit_limit", "amount", "opening_float", "expected_cash",
        "counted_cash", "difference", "total", "paid", "cash", "credit", "discount",
        "cash_refund", "credit_refund",
    }
)  # fmt: skip
_QTY = frozenset({"min_stock", "stock_qty", "qty_delta"})
_DATES = frozenset({"opened_at", "closed_at", "occurred_at", "spent_at"})


# ================= تنسيق القيم =================
def _num(value: float, decimals: int) -> str:
    text = f"{value:,.{decimals}f}"
    return text.rstrip("0").rstrip(".") if decimals and "." in text else text


class _Fmt:
    def __init__(self, symbol: str, names: "_Names") -> None:
        self.symbol = symbol
        self.names = names

    def money(self, cents: Any) -> str:
        if not isinstance(cents, (int, float)):
            return str(cents)
        return f"{cents / MONEY_SCALE:,.2f} {self.symbol}"

    @staticmethod
    def qty(value: Any, signed: bool = False) -> str:
        if not isinstance(value, (int, float)):
            return str(value)
        text = _num(value / QTY_SCALE, 3)
        return f"+{text}" if signed and value > 0 else text

    @staticmethod
    def when(value: Any) -> str:
        try:
            if isinstance(value, str):
                value = datetime.fromisoformat(value) if "T" in value or " " in value else date.fromisoformat(value)
            if isinstance(value, datetime):
                return value.astimezone().strftime("%Y-%m-%d %H:%M")
            if isinstance(value, date):
                return value.isoformat()
        except ValueError:
            pass
        return str(value)

    def value(self, key: str, value: Any, row: AuditLog) -> str:
        if key == "backup_dir":  # الفارغ هنا له معنى: المجلد الافتراضي
            return str(value) if value else "المجلد الافتراضي"
        if value is None or value == "" or value == []:
            return "—"
        if key in _MONEY:
            return self.money(value)
        if key in _QTY:
            return self.qty(value, signed=key == "qty_delta")
        if key == "balance_after":  # رصيد مخزون أو رصيد حساب حسب العملية
            return self.qty(value) if row.action == "stock_adjust" else self.money(value)
        if key in _DATES:
            return self.when(value)
        if key == "is_active":
            return "نشط" if value else "معطّل"
        if key in ("allow_decimal", "locked"):
            return "نعم" if value else "لا"
        if key == "reason":
            enum = "adjust_reason" if row.action == "stock_adjust" else "return_reason"
            return _ENUMS[enum].get(value, str(value))
        if key in ("role", "direction", "kind", "refund_method", "payment_method"):
            return _ENUMS[key].get(value, str(value))
        if key == "category" and row.entity == "expense":
            from app.modules.expenses.constants import CATEGORY_LABELS

            return CATEGORY_LABELS.get(value, str(value))
        if key == "category_id":
            return self.names.get("category", value) or "بدون قسم"
        if key in ("customer_id", "supplier_id", "cashier_id", "purchase_id"):
            entity = {"customer_id": "customer", "supplier_id": "supplier",
                      "cashier_id": "user", "purchase_id": "purchase"}[key]  # fmt: skip
            return self.names.get(entity, value) or "—"
        if key == "source_id" and row.action == "duplicate":
            return self.names.get("product", value) or "—"
        if key == "units":
            return self.units(value)
        if key == "currency" and isinstance(value, dict):
            return f"{value.get('name', '')} ({value.get('symbol', '')})"
        if key == "size" and isinstance(value, (int, float)):
            return f"{value / (1024 * 1024):,.1f} ميجا"
        if key in ("number", "return_number"):
            return f"#{value}"
        if key == "items":
            return str(value)
        if key == "detached_products":
            return "لا يوجد" if not value else str(value)
        if key == "deleted" and isinstance(value, dict):
            return f"{sum(v for v in value.values() if isinstance(v, int)):,} سجل"
        if isinstance(value, bool):
            return "نعم" if value else "لا"
        if isinstance(value, (dict, list)):
            return "، ".join(f"{k}: {v}" for k, v in value.items()) if isinstance(value, dict) else "، ".join(map(str, value))
        return str(value)

    def units(self, value: Any) -> str:
        if not isinstance(value, list):
            return str(value)
        parts = []
        for u in value:
            if not isinstance(u, dict) or u.get("deleted_at"):
                continue
            text = f"{u.get('name', '')} ({self.qty(u.get('factor', 0))})"
            if u.get("sale_price") is not None:
                text += f" بسعر {self.money(u['sale_price'])}"
            parts.append(text)
        return "، ".join(parts) or "لا يوجد"


# ================= الأسماء من القاعدة (دفعة واحدة لكل صفحة) =================
class _Names:
    """entity ← {id: اسم للعرض}. يشمل المحذوف (الحذف ناعم) فيبقى السجل مفهوماً بعد الحذف."""

    def __init__(self, session: Session, wanted: dict[str, set[str]]) -> None:
        self._map: dict[str, dict[str, str]] = defaultdict(dict)
        for entity, ids in wanted.items():
            ids = {i for i in ids if isinstance(i, str) and i}
            loader = _LOADERS.get(entity)
            if ids and loader:
                self._map[entity] = loader(session, ids)

    def get(self, entity: str, entity_id: Any) -> str | None:
        return self._map.get(entity, {}).get(entity_id) if isinstance(entity_id, str) else None


def _by_name(model_path: str, field: str = "name") -> Callable[[Session, set[str]], dict[str, str]]:
    def load(session: Session, ids: set[str]) -> dict[str, str]:
        module, cls = model_path.rsplit(".", 1)
        model = getattr(__import__(module, fromlist=[cls]), cls)
        col = getattr(model, field)
        return {i: str(v) for i, v in session.execute(select(model.id, col).where(model.id.in_(ids))).all()}

    return load


def _by_number(model_path: str) -> Callable[[Session, set[str]], dict[str, str]]:
    inner = _by_name(model_path, "number")

    def load(session: Session, ids: set[str]) -> dict[str, str]:
        return {k: f"#{v}" for k, v in inner(session, ids).items()}

    return load


def _shifts(session: Session, ids: set[str]) -> dict[str, str]:
    from app.modules.shifts.model import Shift

    rows = session.execute(select(Shift.id, Shift.opened_at).where(Shift.id.in_(ids))).all()
    return {i: _Fmt.when(opened) for i, opened in rows}


def _expenses(session: Session, ids: set[str]) -> dict[str, str]:
    from app.modules.expenses.constants import CATEGORY_LABELS
    from app.modules.expenses.model import Expense

    rows = session.execute(select(Expense.id, Expense.category).where(Expense.id.in_(ids))).all()
    return {i: CATEGORY_LABELS.get(c, c) for i, c in rows}


def _devices(session: Session, ids: set[str]) -> dict[str, str]:
    from app.modules.devices.model import Device

    return {i: n for i, n in session.execute(select(Device.id, Device.name).where(Device.id.in_(ids))).all()}


_LOADERS: dict[str, Callable[[Session, set[str]], dict[str, str]]] = {
    "product": _by_name("app.modules.products.model.Product"),
    "category": _by_name("app.modules.products.model.Category"),
    "measure_unit": _by_name("app.modules.catalog.model.MeasureUnit"),
    "customer": _by_name("app.modules.customers.model.Customer"),
    "supplier": _by_name("app.modules.suppliers.model.Supplier"),
    "user": _by_name("app.modules.users.model.User", "username"),
    "sale": _by_number("app.modules.sales.model.Sale"),
    "purchase": _by_number("app.modules.purchases.model.Purchase"),
    "shift": _shifts,
    "expense": _expenses,
    "device": _devices,
}

_REF_KEYS = {
    "category_id": "category",
    "customer_id": "customer",
    "supplier_id": "supplier",
    "cashier_id": "user",
    "purchase_id": "purchase",
}


def _collect_ids(rows: Iterable[AuditLog]) -> dict[str, set[str]]:
    wanted: dict[str, set[str]] = defaultdict(set)
    for r in rows:
        wanted[r.entity].add(r.entity_id)
        for key, value in (r.changes or {}).items():
            entity = _REF_KEYS.get(key) or ("product" if key == "source_id" and r.action == "duplicate" else None)
            if not entity:
                continue
            values = [value.get("from"), value.get("to")] if _is_diff(value) else [value]
            wanted[entity].update(v for v in values if isinstance(v, str))
    return wanted


def _is_diff(value: Any) -> bool:
    return isinstance(value, dict) and set(value) == {"from", "to"}


# ================= الجملة =================
def _quoted(name: str | None) -> str:
    return f" «{name}»" if name else ""


def _summary(r: AuditLog, name: str | None, fmt: _Fmt) -> str:
    c = r.changes or {}
    the = _THE.get(r.entity, ENTITY_LABELS.get(r.entity, r.entity))
    a = r.action

    # ---- الدخول والمستخدمون ----
    if a == "login":
        return "سجّل الدخول"
    if a == "logout":
        return "سجّل الخروج"
    if a == "login_failed":
        target = f" على حساب{_quoted(name)}" if name else ""
        return f"محاولة دخول بكلمة مرور خاطئة{target}" + (" (وقُفل الحساب مؤقتاً)" if c.get("locked") else "")
    if a == "password_change":
        return "غيّر كلمة المرور الخاصة به"
    if a == "password_change_failed":
        return "محاولة فاشلة لتغيير كلمة المرور" + (" (قُفل الحساب مؤقتاً)" if c.get("locked") else "")
    if a == "password_reset":
        return f"أعاد تعيين كلمة مرور المستخدم{_quoted(name)}"
    if a == "setup":
        return f"أعدّ البرنامج لأول مرة وأنشأ حساب المدير{_quoted(name)}"
    if a == "user_create":
        role = _ENUMS["role"].get(c.get("role", ""), "")
        return f"أضاف المستخدم{_quoted(name)}" + (f" ({role})" if role else "")
    if a == "user_update":
        return f"عدّل المستخدم{_quoted(name)}"
    if a == "user_delete":
        return f"حذف المستخدم{_quoted(name or c.get('username'))}"

    # ---- عمليات خاصة ----
    if a == "toggle_active":
        to = c.get("is_active", {}).get("to") if _is_diff(c.get("is_active")) else None
        return f"{'فعّل' if to else 'عطّل'} {the}{_quoted(name)}"
    if a == "duplicate":
        src = fmt.names.get("product", c.get("source_id"))
        return f"نسخ الصنف{_quoted(src)}" + (f" إلى{_quoted(name)}" if name else "")
    if a == "stock_adjust":
        reason = _ENUMS["adjust_reason"].get(c.get("reason", ""), "")
        delta = fmt.qty(c.get("qty_delta", 0), signed=True)
        return f"عدّل مخزون{_quoted(name)} ({reason}) بمقدار {delta}"
    if a == "price_from_purchase":
        purchase = fmt.names.get("purchase", c.get("purchase_id"))
        return f"تحدّث سعر{_quoted(name)} تلقائياً من فاتورة الشراء {purchase or ''}".rstrip()
    if a == "collect_payment":
        return f"حصّل {fmt.money(c.get('amount'))} من العميل{_quoted(name)}"
    if a == "payment":
        return f"سدّد {fmt.money(c.get('amount'))} للمورد{_quoted(name)}"
    if a == "return" and r.entity == "sale":
        return f"سجّل مرتجعاً بقيمة {fmt.money(c.get('total'))} من فاتورة البيع {name or ''}".rstrip()
    if a == "return" and r.entity == "purchase":
        return f"سجّل مرتجع شراء بقيمة {fmt.money(c.get('total'))} من الفاتورة {name or ''}".rstrip()
    if a == "open":
        return f"فتح وردية بفكّة {fmt.money(c.get('opening_float', 0))}"
    if a == "close":
        diff = c.get("difference") or 0
        tail = "مطابقة" if not diff else (f"زيادة {fmt.money(diff)}" if diff > 0 else f"عجز {fmt.money(-diff)}")
        held = c.get("held_cleared")
        return f"قفل الوردية ({tail})" + (f" وحُذفت {held} فاتورة معلّقة" if held else "")
    if r.entity == "held_invoice" and a in ("hold", "recall", "discard"):
        verb = {"hold": "علّق", "recall": "استرجع", "discard": "حذف"}[a]
        suffix = "" if a == "hold" else " المعلّقة"
        return f"{verb} فاتورة{suffix} ({c.get('items', 0)} صنف) بقيمة {fmt.money(c.get('total'))}"
    if a == "revoke":
        return f"ألغى ربط جهاز الكاشير{_quoted(name or c.get('name'))}"
    if a == "restore":
        return "استعاد نسخة احتياطية (كل البيانات استُبدلت بها)"
    if a == "demo_clear":
        return "مسح البيانات التجريبية"
    if r.entity == "backup" and a == "create":
        return "أنشأ نسخة احتياطية"
    if r.entity == "sale" and a == "create":
        method = "آجل" if c.get("credit") and not c.get("cash") else ("مختلط" if c.get("credit") else "كاش")
        who = fmt.names.get("customer", c.get("customer_id"))
        return f"باع فاتورة {name or ''} بقيمة {fmt.money(c.get('total'))} ({method})" + (
            f" للعميل{_quoted(who)}" if who else ""
        )
    if r.entity == "purchase" and a == "create":
        who = fmt.names.get("supplier", c.get("supplier_id"))
        return f"سجّل فاتورة شراء {name or ''} بقيمة {fmt.money(c.get('total'))}" + (
            f" من{_quoted(who)}" if who else ""
        )
    if r.entity == "app_setting":
        if "currency" in c:
            to = c["currency"].get("to") if _is_diff(c["currency"]) else c["currency"]
            return f"غيّر عملة المحل إلى {fmt.value('currency', to, r)}"
        if "backup_dir" in c:
            return "غيّر مكان حفظ النسخ الاحتياطية"
    if r.entity == "cash_entry":
        kind = c.get("kind")
        kind = kind.get("to") if _is_diff(kind) else kind
        amount = c.get("amount")
        amount = amount.get("to") if _is_diff(amount) else amount
        label = _ENUMS["kind"].get(kind or "", "حركة")
        verb = {"create": "سجّل", "update": "عدّل", "delete": "حذف"}.get(a, ACTION_LABELS.get(a, a))
        return f"{verb} حركة خزنة ({label})" + (f" بقيمة {fmt.money(amount)}" if amount is not None else "")
    if r.entity == "expense":
        amount = c.get("amount")
        amount = amount.get("to") if _is_diff(amount) else amount
        verb = _VERB.get(a, ACTION_LABELS.get(a, a))
        return f"{verb} مصروف «{name or ''}»" + (f" بقيمة {fmt.money(amount)}" if amount is not None else "")
    if r.entity == "shop" and a == "rename":
        return f"غيّر اسم المحل إلى «{c.get('name', {}).get('to', '')}»" if _is_diff(c.get("name")) else "غيّر اسم المحل"

    # ---- عام: أضاف/عدّل/حذف + النوع + الاسم ----
    verb = _VERB.get(a)
    if verb:
        if not name and isinstance(c.get("name"), str):
            name = c["name"]
        return f"{verb} {the}{_quoted(name)}"
    return f"{ACTION_LABELS.get(a, a)} — {ENTITY_LABELS.get(r.entity, r.entity)}{_quoted(name)}"


# ================= التفاصيل =================
# في الإضافة/الحذف (قيمة واحدة) نخفي ما لا يضيف معلومة: الفارغ، الأصفار الاختيارية، والقيم الافتراضية.
_OPTIONAL_ZERO = frozenset({"discount", "cash", "credit", "cash_refund", "credit_refund", "opening_float"})


def _is_noise(key: str, value: Any, shown: str) -> bool:
    if shown == "—":
        return True
    if key in _OPTIONAL_ZERO and value == 0:
        return True
    if key == "is_active" and value is True:  # الافتراضي «نشط»
        return True
    if key in ("allow_decimal", "locked") and not value:
        return True
    return False


def _details(r: AuditLog, fmt: _Fmt) -> list[Detail]:
    out: list[Detail] = []
    for key, value in (r.changes or {}).items():
        if key in _HIDDEN:
            continue
        if key == "source_id" and r.action != "duplicate":
            continue  # مراجع داخلية (حركة خزنة ← عملية أخرى)
        label = "نُسخ من" if key == "source_id" else _LABELS.get(key, key)
        if _is_diff(value):
            before = fmt.value(key, value["from"], r)
            after = fmt.value(key, value["to"], r)
            if before != after:
                out.append(Detail(label, before, after))
        else:
            shown = fmt.value(key, value, r)
            if not _is_noise(key, value, shown):
                out.append(Detail(label, None, shown))
    return out


def describe_rows(session: Session, rows: list[AuditLog]) -> list[Described]:
    from app.modules.settings.service import SettingsService

    symbol = SettingsService(session).currency().symbol
    names = _Names(session, _collect_ids(rows))
    fmt = _Fmt(symbol, names)
    result = []
    for r in rows:
        name = names.get(r.entity, r.entity_id)
        try:
            result.append(Described(_summary(r, name, fmt), _details(r, fmt)))
        except Exception:  # noqa: BLE001 - سطر سجل غير متوقع الشكل لا يُسقط الصفحة كلها
            label = ACTION_LABELS.get(r.action, r.action)
            result.append(Described(f"{label} — {ENTITY_LABELS.get(r.entity, r.entity)}", []))
    return result
