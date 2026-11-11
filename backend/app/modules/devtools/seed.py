"""مولّد بيانات تجريبية واقعية لمحل بقالة/سوبر ماركت (60 يوماً).

كل شيء يمر عبر خدمات النظام الحقيقية (بيع، شراء، ورديات، مصروفات، تحصيل…)،
فتبقى الأرصدة وحركة المخزون وكشوف الحساب والخزنة متسقة تماماً كما لو أدخلها مستخدم.
"""

import random
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.base import frozen_now, uuid7
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.passwords import hash_password
from app.core.security import Actor, Role
from app.modules.customers.schema import CustomerCreate, PaymentIn
from app.modules.customers.service import CustomerService
from app.modules.expenses.schema import ExpenseCreate
from app.modules.expenses.service import ExpenseService
from app.modules.expenses.types import ExpenseCategory
from app.modules.products.model import Category, Product
from app.modules.products.schema import ProductCreate, StockAdjustIn
from app.modules.products.service import ProductService
from app.modules.products.types import AdjustReason
from app.modules.purchases.schema import PurchaseCreate, PurchaseLineIn
from app.modules.purchases.service import PurchaseService
from app.modules.sales.schema import ReturnCreate, ReturnLineIn, SaleCreate, SaleLineIn
from app.modules.sales.service import SaleService
from app.modules.sales.types import PaymentMethod, ReturnReason
from app.modules.shifts.schema import ShiftCloseIn, ShiftOpenIn
from app.modules.shifts.service import ShiftService
from app.modules.suppliers.model import Supplier
from app.modules.suppliers.schema import SupplierCreate, SupplierPaymentIn
from app.modules.suppliers.service import SupplierService
from app.modules.treasury.schema import ManualEntryCreate
from app.modules.treasury.service import TreasuryService
from app.modules.treasury.types import CashDirection
from app.modules.users.model import User

DAYS = 60
SEED = 2026
DEMO_PASSWORD = "Demo-Pass-2026"  # لتجربة دخول الكاشير التجريبي
Q = 1000  # الكميات × 1000

CATEGORIES = ["مشروبات", "ألبان وأجبان", "بقالة جافة", "منظفات", "حلويات وسناكس", "عناية شخصية"]

# (الاسم، القسم، الوحدة، سعر البيع، سعر الشراء، الحد الأدنى، الرصيد الافتتاحي، الشعبية)
PRODUCTS = [
    ("بيبسي 1 لتر", 0, "قطعة", 25, 20, 24, 120, 9),
    ("مياه معدنية 1.5 لتر", 0, "قطعة", 8, 6, 48, 300, 10),
    ("عصير جهينة مانجو", 0, "قطعة", 15, 12, 24, 96, 6),
    ("شاي العروسة 250 جم", 0, "قطعة", 45, 38, 12, 60, 7),
    ("نسكافيه 3×1", 0, "قطعة", 7, 5.5, 50, 300, 8),
    ("لبن جهينة 1 لتر", 1, "قطعة", 38, 33, 20, 80, 9),
    ("زبادي دانون", 1, "قطعة", 9, 7, 30, 120, 7),
    ("جبنة دومتي 500 جم", 1, "قطعة", 42, 35, 10, 40, 5),
    ("جبنة رومي", 1, "كيلو", 280, 230, 3, 15, 4),
    ("بيض (طبق 30)", 1, "قطعة", 165, 145, 6, 30, 6),
    ("أرز مصري", 2, "كيلو", 34, 28, 25, 150, 8),
    ("سكر", 2, "كيلو", 32, 27, 30, 200, 9),
    ("مكرونة الملكة 400 جم", 2, "قطعة", 16, 12.5, 30, 150, 7),
    ("زيت عافية 1 لتر", 2, "قطعة", 95, 82, 12, 60, 6),
    ("عدس أصفر", 2, "كيلو", 55, 45, 8, 40, 3),
    ("دقيق 1 كيلو", 2, "قطعة", 28, 23, 15, 80, 4),
    ("صلصة هاينز", 2, "قطعة", 22, 17, 12, 60, 4),
    ("تونة صن شاين", 2, "قطعة", 48, 40, 12, 50, 4),
    ("برسيل أوتوماتيك 2.5 كجم", 3, "قطعة", 210, 180, 5, 20, 3),
    ("فيري 650 مل", 3, "قطعة", 45, 37, 8, 36, 4),
    ("كلوركس 1 لتر", 3, "قطعة", 30, 24, 8, 36, 3),
    ("مناديل فاين", 3, "قطعة", 18, 14, 20, 100, 5),
    ("شيبسي عائلي", 4, "قطعة", 20, 16, 30, 120, 8),
    ("بسكويت شوكولاتة", 4, "قطعة", 10, 7.5, 30, 150, 7),
    ("شوكولاتة كادبوري", 4, "قطعة", 30, 24, 15, 60, 5),
    ("لبان تريدنت", 4, "قطعة", 12, 9, 20, 80, 3),
    ("شامبو بانتين", 5, "قطعة", 85, 70, 6, 24, 2),
    ("صابون لوكس", 5, "قطعة", 18, 14, 15, 60, 3),
    ("معجون سيجنال", 5, "قطعة", 40, 33, 8, 30, 2),
    # راكد عمداً (لتظهر في تقرير الراكد): شعبية صفر
    ("كريم شعر قديم", 5, "قطعة", 120, 95, 2, 12, 0),
]

CUSTOMERS = [
    ("أم أحمد", "01011110001", 3000),
    ("الحاج محمود", "01011110002", 5000),
    ("مطعم الأمل", "01011110003", 15000),
    ("كافيه النيل", "01011110004", 8000),
    ("أستاذ سامي", "01011110005", 2000),
    ("مدام نجلاء", "01011110006", 0),
    ("عم رجب", "01011110007", 2500),
    ("صيدلية الشفاء", "01011110008", 6000),
    ("مكتب المحاماة", "01011110009", 4000),
    ("أسرة يوسف", "01011110010", 0),
]

SUPPLIERS = [
    ("شركة المشروبات المتحدة", "01022220001", [0, 4]),
    ("مزارع الدلتا للألبان", "01022220002", [5, 9]),
    ("الجملة للمواد الغذائية", "01022220003", [10, 17]),
    ("منظفات المستقبل", "01022220004", [18, 21]),
    ("توكيل الحلويات والعناية", "01022220005", [22, 29]),
]

# أوزان الساعات (ذروة الظهر والمساء) — تظهر بوضوح في خريطة أوقات الذروة.
HOUR_WEIGHTS = {9: 2, 10: 4, 11: 6, 12: 8, 13: 9, 14: 7, 15: 4, 16: 4, 17: 6, 18: 8, 19: 10, 20: 10, 21: 8, 22: 4}
# Python: الاثنين = 0 … الخميس = 3، الجمعة = 4.
WEEKDAY_FACTOR = {3: 1.35, 4: 1.5, 5: 0.9}


@dataclass
class SeedStats:
    products: int = 0
    customers: int = 0
    suppliers: int = 0
    sales: int = 0
    returns: int = 0
    purchases: int = 0
    expenses: int = 0
    shifts: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)


def _cents(pounds: float) -> int:
    return round(pounds * 100)


class DemoSeeder:
    def __init__(self, session: Session, manager: Actor) -> None:
        self.s = session
        self.manager = manager
        self.rng = random.Random(SEED)
        self.device = get_settings().device_id
        self.tz = datetime.now().astimezone().tzinfo
        self.stats = SeedStats()
        self.products: list[Product] = []
        self.weights: list[int] = []
        self.customers: list[str] = []
        self.credit_customers: list[str] = []
        self.suppliers: list[tuple[str, list[int]]] = []
        self.cashiers: list[Actor] = []
        self.recent_sales: list[str] = []

    # ---------- أدوات ----------
    def _at(self, day: date, hour: int, minute: int = 0) -> None:
        local = datetime.combine(day, time(hour, minute), tzinfo=self.tz)
        frozen_now.set(local.astimezone(timezone.utc))

    def _safe(self, label: str, fn) -> object | None:
        """عملية واحدة؛ فشلها (رصيد غير كافٍ مثلاً) لا يوقف التوليد."""
        try:
            return fn()
        except AppError as exc:
            self.s.rollback()
            self.stats.skipped += 1
            if len(self.stats.errors) < 10:
                self.stats.errors.append(f"{label}: {exc.message}")
            return None

    def _actor(self, user_id: str) -> Actor:
        # دور المدير للتوليد فقط: يتجاوز حدود الخصم ومهلة المرتجع للكاشير.
        return Actor(user_id=user_id, role=Role.MANAGER, device_id=self.device)

    # ---------- الأساسيات ----------
    def _users(self) -> None:
        taken = set(self.s.scalars(select(User.username)).all())
        for i, _ in enumerate(("أحمد", "منى"), start=1):
            username = f"demo.cashier{i}"
            if username in taken:
                username = f"demo.cashier{i}.{uuid7()[-4:]}"
            user = User(
                id=uuid7(),
                username=username,
                password_hash=hash_password(DEMO_PASSWORD),
                role=Role.CASHIER.value,
                is_active=True,
                device_id=self.device,
                created_by=self.manager.user_id,
            )
            self.s.add(user)
            self.cashiers.append(self._actor(user.id))
        self.s.commit()

    def _catalog(self, start: date) -> None:
        self._at(start - timedelta(days=1), 10)
        cats: list[str] = []
        for name in CATEGORIES:
            existing = self.s.scalars(
                select(Category).where(Category.name == name, Category.deleted_at.is_(None))
            ).first()
            if existing:  # قسم حقيقي بنفس الاسم: نستخدمه ولا نسجّله فلا يُحذف
                cats.append(existing.id)
                continue
            cat = Category(id=uuid7(), name=name, device_id=self.device, created_by=self.manager.user_id)
            self.s.add(cat)
            self.s.flush()
            cats.append(cat.id)
        self.s.commit()

        svc = ProductService(self.s, self.manager)
        for i, (name, cat, unit, price, cost, min_stock, opening, pop) in enumerate(PRODUCTS):
            out = self._safe(
                name,
                lambda: svc.create_product(
                    ProductCreate(
                        name=name,
                        barcode=f"990{2026_0000 + i:08d}",
                        category_id=cats[cat],
                        unit=unit,
                        cost_price=_cents(cost),
                        sale_price=_cents(price),
                        min_stock=min_stock * Q,
                        opening_stock=opening * Q,
                    )
                ),
            )
            if out is not None:
                product = svc.get_for_update(out.id)  # type: ignore[attr-defined]
                self.products.append(product)
                self.weights.append(pop)
                self.stats.products += 1

        csvc = CustomerService(self.s, self.manager)
        for name, phone, limit in CUSTOMERS:
            out = self._safe(name, lambda: csvc.create_customer(CustomerCreate(name=name, phone=phone, credit_limit=_cents(limit))))
            if out is not None:
                self.customers.append(out.id)  # type: ignore[attr-defined]
                if limit:
                    self.credit_customers.append(out.id)  # type: ignore[attr-defined]
                self.stats.customers += 1

        ssvc = SupplierService(self.s, self.manager)
        for name, phone, (a, b) in SUPPLIERS:
            taken = self.s.scalar(select(Supplier.id).where(Supplier.name == name, Supplier.deleted_at.is_(None)))
            final = f"{name} (تجريبي)" if taken else name
            out = self._safe(
                name,
                lambda: ssvc.create_supplier(SupplierCreate(name=final, phone=phone, opening_balance=_cents(self.rng.choice([0, 2500, 5000])))),
            )
            if out is not None:
                self.suppliers.append((out.id, list(range(a, b + 1))))  # type: ignore[attr-defined]
                self.stats.suppliers += 1

        TreasuryService(self.s, self.manager).create_manual(
            ManualEntryCreate(direction=CashDirection.IN, amount=_cents(60000), occurred_at=start, note="رأس مال افتتاحي (تجريبي)")
        )

    # ---------- يوم عمل ----------
    def _day(self, day: date, index: int) -> None:
        cashier = self.cashiers[index % len(self.cashiers)]
        self._at(day, 9, self.rng.randint(0, 20))
        opened = self._safe("فتح وردية", lambda: ShiftService(self.s, cashier).open_shift(ShiftOpenIn(opening_float=_cents(500))))
        if opened is None:
            return
        self.stats.shifts += 1

        growth = 1 + index / DAYS * 0.35  # نمو تدريجي يظهر في الاتجاه
        count = max(2, round(self.rng.uniform(6, 11) * growth * WEEKDAY_FACTOR.get(day.weekday(), 1.0)))
        hours = self.rng.choices(list(HOUR_WEIGHTS), weights=list(HOUR_WEIGHTS.values()), k=count)
        is_today = day == datetime.now().astimezone().date()
        if is_today:  # اليوم الحالي: لا نكتب أوقاتاً في المستقبل
            hours = [h for h in hours if h < datetime.now().hour]
        for hour in sorted(hours):
            self._at(day, hour, self.rng.randint(0, 59))
            self._sale(cashier)

        if self.recent_sales and self.rng.random() < 0.25 and not is_today:
            self._at(day, 21, 30)
            self._return(cashier)

        if is_today:
            return  # وردية اليوم تبقى مفتوحة لتظهر "الوردية الحالية" في اللوحة
        # قفل الوردية: غالباً مطابق، وأحياناً عجز/زيادة بسيطة.
        self._at(day, 23, self.rng.randint(0, 30))
        shifts = ShiftService(self.s, self.manager)
        current = shifts.repo.current(self.device)
        if current is not None:
            expected = shifts.repo.totals([current.id])[current.id].expected(current.opening_float)
            diff = 0 if self.rng.random() < 0.7 else self.rng.choice([-2000, -1000, -500, 500, 1000])
            self._safe("قفل وردية", lambda: shifts.close_current(ShiftCloseIn(counted_cash=max(expected + diff, 0))))

    def _sale(self, cashier: Actor) -> None:
        picks = {p.id: p for p in self.rng.choices(self.products, weights=self.weights, k=self.rng.randint(1, 5))}
        lines = []
        for p in picks.values():
            if p.allow_decimal:
                qty = self.rng.choice([250, 500, 1000, 1500, 2000])
            else:
                qty = self.rng.choice([1, 1, 1, 2, 2, 3, 6]) * Q
            if p.stock_qty - qty < 0:
                continue
            discount = round(p.sale_price * qty / Q * 0.1) if self.rng.random() < 0.05 else 0
            lines.append(SaleLineIn(product_id=p.id, qty=qty, unit_price=p.sale_price, discount=discount))
        if not lines:
            self.stats.skipped += 1
            return
        subtotal = sum(round(line.unit_price * line.qty / Q) - line.discount for line in lines)
        invoice_discount = round(subtotal * 0.05) if subtotal > 50000 and self.rng.random() < 0.3 else 0
        total = subtotal - invoice_discount

        roll = self.rng.random()
        customer = None
        method = PaymentMethod.CASH
        cash = total
        if roll < 0.13 and self.credit_customers:
            customer, method, cash = self.rng.choice(self.credit_customers), PaymentMethod.CREDIT, 0
        elif roll < 0.2 and self.credit_customers and total > 200:
            customer, method = self.rng.choice(self.credit_customers), PaymentMethod.MIXED
            cash = total // 2
        elif roll < 0.35 and self.customers:
            customer = self.rng.choice(self.customers)
        received = cash
        if method is PaymentMethod.CASH:
            step = 5000 if total > 5000 else 1000
            received = -(-total // step) * step if self.rng.random() < 0.6 else total

        data = SaleCreate(
            client_ref=uuid7(),
            customer_id=customer,
            lines=lines,
            invoice_discount=invoice_discount,
            payment_method=method,
            cash_amount=cash,
            received=received,
        )
        out = self._safe("بيع", lambda: SaleService(self.s, cashier).create_sale(data))
        if out is not None:
            self.stats.sales += 1
            self.recent_sales = (self.recent_sales + [out.id])[-30:]  # type: ignore[attr-defined]

    def _return(self, cashier: Actor) -> None:
        svc = SaleService(self.s, cashier)
        sale = svc.repo.get(self.rng.choice(self.recent_sales))
        if sale is None:
            return
        line = next((l for l in sale.lines if l.qty - l.returned_qty >= Q), None)
        if line is None:
            return
        data = ReturnCreate(
            reason=self.rng.choice(list(ReturnReason)),
            lines=[ReturnLineIn(sale_line_id=line.id, qty=Q)],
        )
        if self._safe("مرتجع", lambda: svc.create_return(sale.id, data)) is not None:
            self.stats.returns += 1

    # ---------- عمليات دورية ----------
    def _purchases(self, day: date) -> None:
        self._at(day, 8, 30)
        svc = PurchaseService(self.s, self.manager)
        for supplier_id, indexes in self.suppliers:
            lines = []
            for i in indexes:
                if i >= len(self.products):
                    continue
                p = self.products[i]
                if self.weights[i] == 0:
                    continue
                target = max(p.min_stock * 4, 10 * Q)
                if p.stock_qty < p.min_stock * 2:
                    need = target - p.stock_qty
                    qty = need if p.allow_decimal else -(-need // Q) * Q
                    cost = round(p.cost_price * self.rng.uniform(0.97, 1.06))
                    lines.append(PurchaseLineIn(product_id=p.id, qty=qty, unit_cost=cost))
            if not lines:
                continue
            total = sum(round(line.qty * line.unit_cost / Q) for line in lines)
            paid = self.rng.choice([total, total, total // 2, 0])
            out = self._safe(
                "شراء",
                lambda: svc.create_purchase(
                    PurchaseCreate(supplier_id=supplier_id, purchased_on=day, lines=lines, paid_amount=paid, supplier_invoice=f"INV-{self.rng.randint(1000, 9999)}")
                ),
            )
            if out is not None:
                self.stats.purchases += 1

    def _expenses(self, day: date) -> None:
        svc = ExpenseService(self.s, self.manager)
        plan: list[tuple[ExpenseCategory, int, str | None]] = []
        if day.day == 1:
            plan += [(ExpenseCategory.RENT, 6000, "إيجار المحل"), (ExpenseCategory.SALARIES, 9000, "رواتب الكاشيرية")]
        if day.day == 10:
            plan.append((ExpenseCategory.ELECTRICITY, self.rng.randint(1200, 1900), "فاتورة الكهرباء"))
        if day.day == 15:
            plan.append((ExpenseCategory.WATER, self.rng.randint(150, 300), None))
        if self.rng.random() < 0.25:
            plan.append((self.rng.choice([ExpenseCategory.TRANSPORT, ExpenseCategory.SUPPLIES, ExpenseCategory.MAINTENANCE]), self.rng.randint(50, 400), None))
        self._at(day, 11)
        for category, amount, note in plan:
            if self._safe("مصروف", lambda: svc.create_expense(ExpenseCreate(category=category, amount=_cents(amount), spent_at=day, note=note))):
                self.stats.expenses += 1

    def _collections(self, day: date) -> None:
        self._at(day, 17, 15)
        csvc = CustomerService(self.s, self.manager)
        for cid in self.credit_customers:
            customer = csvc.get_for_update(cid)
            if customer.balance > 2000 and self.rng.random() < 0.6:
                amount = max(round(customer.balance * self.rng.uniform(0.3, 0.8)), 1000)
                self._safe("تحصيل", lambda: csvc.collect_payment(cid, PaymentIn(amount=min(amount, customer.balance), note="دفعة")))
        ssvc = SupplierService(self.s, self.manager)
        for sid, _ in self.suppliers:
            supplier = ssvc.get_for_update(sid)
            if supplier.balance > 0 and self.rng.random() < 0.5:
                amount = round(supplier.balance * self.rng.uniform(0.4, 1.0))
                self._safe("سداد", lambda: ssvc.record_payment(sid, SupplierPaymentIn(amount=max(amount, 100), note="سداد دفعة")))

    def _damage(self, day: date) -> None:
        self._at(day, 22)
        p = self.rng.choice(self.products)
        if p.stock_qty >= 2 * Q and not p.allow_decimal:
            svc = ProductService(self.s, self.manager)
            self._safe("تالف", lambda: svc.adjust_stock(p.id, StockAdjustIn(reason=AdjustReason.DAMAGE, qty=Q, note="تالف أثناء النقل")))

    # ---------- التشغيل ----------
    def run(self, days: int = DAYS) -> SeedStats:
        today = datetime.now().astimezone().date()
        start = today - timedelta(days=days - 1)
        token = frozen_now.set(None)
        try:
            self._users()
            self._catalog(start)
            for index in range(days):
                day = start + timedelta(days=index)
                if index % 7 == 3:
                    self._purchases(day)
                self._expenses(day)
                self._day(day, index)
                if day == today:
                    continue  # عمليات المساء لا تُكتب في المستقبل
                if index % 6 == 5:
                    self._collections(day)
                if index % 9 == 4:
                    self._damage(day)
        finally:
            frozen_now.reset(token)
        return self.stats
