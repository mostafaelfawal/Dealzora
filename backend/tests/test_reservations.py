"""الحجوزات: العربون رصيد للعميل ونقدية في الدرج، وفاتورة الاستلام تدفع منه وتُغلق الحجز.

قاعدة اختبار مؤقتة وخدمات حقيقية (البيع، كشف الحساب، الخزنة، الوردية) لأن الصحة هنا محاسبية:
الدرج والكشف والخزنة لازم يتفقوا بالقرش.
"""

import os
import shutil
import tempfile
import unittest
import uuid
from pathlib import Path

os.environ.setdefault("POS_DB_PASSWORD", "unit-test-password")
os.environ.setdefault("POS_SESSION_TOKEN", "t")
os.environ.setdefault("POS_WRITE_PERMIT_SECRET", "t")
os.environ.setdefault("POS_DEVICE_ID", "dev-test")

from app.core import branch_lease, database  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.core.errors import AppError  # noqa: E402
from app.core.security import Actor, Role  # noqa: E402

DEVICE = "dev-reserve-test"
OWNER = Actor(user_id="owner-reserve", role=Role.OWNER, device_id=DEVICE)
PRICE = 4750  # 47.50


class ReservationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._lease_state = dict(branch_lease._state)
        branch_lease._state.update(loaded=True, plan=None, terminals=0, exp=0)
        cls.tmp = tempfile.mkdtemp(prefix="dealzora-reserve-test-")
        settings = get_settings()
        cls._saved = (settings.db_path, settings.device_id, settings.plan)
        settings.db_path = str(Path(cls.tmp) / "test.db")
        settings.device_id = DEVICE
        settings.plan = "basic"
        assert cls.tmp in settings.db_path  # لا نلمس قاعدة البرنامج أبداً
        for f in (database.get_engine, database.get_sessionmaker, database.get_write_sessionmaker):
            f.cache_clear()
        from app.core.init_db import init_db

        init_db()

        from app.modules.customers.schema import CustomerCreate
        from app.modules.customers.service import CustomerService
        from app.modules.products.schema import ProductCreate
        from app.modules.products.service import ProductService
        from app.modules.shifts.schema import ShiftOpenIn
        from app.modules.shifts.service import ShiftService

        with cls.session() as s:
            cls.product_id = ProductService(s, OWNER).create_product(
                ProductCreate(name="أرز", sale_price=PRICE, cost_price=4000, opening_stock=100_000)
            ).id
            cls.customer_id = CustomerService(s, OWNER).create_customer(
                CustomerCreate.model_validate(
                    {"name": "أحمد", "phone": "01011112222", "address": "", "notes": "",
                     "credit_limit": 0, "opening_balance": 0, "is_active": True, "is_wholesale": False}  # fmt: skip
                )
            ).id
            ShiftService(s, OWNER).open_shift(ShiftOpenIn(opening_float=0))

    @classmethod
    def tearDownClass(cls):
        for f in (database.get_engine, database.get_sessionmaker, database.get_write_sessionmaker):
            if f.cache_info().currsize:
                database.get_engine().dispose()
            f.cache_clear()
        settings = get_settings()
        settings.db_path, settings.device_id, settings.plan = cls._saved
        branch_lease._state.clear()
        branch_lease._state.update(cls._lease_state)
        shutil.rmtree(cls.tmp, ignore_errors=True)

    @staticmethod
    def session():
        return database.get_write_sessionmaker()()

    # ---------- مساعدات ----------
    def _sell(self, *, qty=1000, customer=True, received=0, keep=0, use=0, method="cash", reservation_id=None):
        from app.modules.sales.schema import SaleCreate
        from app.modules.sales.service import SaleService

        due = PRICE * qty // 1000 - use
        with self.session() as s:
            return SaleService(s, OWNER).create_sale(
                SaleCreate(
                    client_ref=str(uuid.uuid4()),
                    customer_id=self.customer_id if customer else None,
                    lines=[{"product_id": self.product_id, "qty": qty, "unit_price": PRICE,
                            "discount": 0, "promo_discount": 0}],  # fmt: skip
                    payment_method=method,
                    cash_amount=due if method == "cash" else 0,
                    received=received,
                    use_balance=use,
                    keep_change=keep,
                    reservation_id=reservation_id,
                )
            )

    def _balance(self):
        from app.modules.customers.model import Customer

        with self.session() as s:
            return s.get(Customer, self.customer_id).balance

    def _expected_drawer(self):
        from app.modules.shifts.service import ShiftService

        with self.session() as s:
            shift = ShiftService(s, OWNER).require_open()
            totals = ShiftService(s, OWNER).repo.totals([shift.id])[shift.id]
            return totals.expected(shift.opening_float)

    def _reserve(self, deposit=0, qty=2000):
        from app.modules.reservations.schema import ReservationCreate
        from app.modules.reservations.service import ReservationService

        invoice = {"lines": [{"productId": self.product_id, "name": "أرز", "price": PRICE / 100,
                              "qty": qty / 1000, "unit": "قطعة"}], "customer": None, "discount": None}  # fmt: skip
        with self.session() as s:
            return ReservationService(s, OWNER).create(
                ReservationCreate(client_ref=str(uuid.uuid4()), customer_id=self.customer_id,
                                  invoice=invoice, deposit=deposit)  # fmt: skip
            )

    def test_1_deposit_is_credit_and_drawer_cash(self):
        drawer = self._expected_drawer()
        r = self._reserve(deposit=3000, qty=2000)
        self.assertEqual((r.status, r.deposit, r.total, r.item_count), ("pending", 3000, PRICE * 2, 1))
        self.assertEqual(self._balance(), -3000)
        self.assertEqual(self._expected_drawer() - drawer, 3000)

    def test_2_pickup_uses_deposit_and_closes(self):
        from app.modules.reservations.service import ReservationService

        r = self._reserve(deposit=2000, qty=1000)
        before = self._balance()
        sale = self._sell(qty=1000, use=2000, received=PRICE - 2000, reservation_id=r.id)
        self.assertEqual((sale.balance_used, sale.cash_amount), (2000, PRICE - 2000))
        self.assertEqual(self._balance(), before + 2000)
        with self.session() as s:
            got = ReservationService(s, OWNER).get(r.id)
        self.assertEqual((got.status, got.sale_id, got.sale_number), ("picked_up", sale.id, sale.number))
        # حجز مستلم لا يُستلم مرة ثانية.
        with self.assertRaises(AppError):
            self._sell(qty=1000, reservation_id=r.id)

    def test_3_wrong_customer_rejected(self):
        r = self._reserve()
        with self.assertRaises(AppError):
            self._sell(qty=1000, customer=False, reservation_id=r.id)

    def test_4_cancel_keeps_deposit_as_credit(self):
        from app.modules.reservations.service import ReservationService

        r = self._reserve(deposit=1000)
        before = self._balance()
        with self.session() as s:
            got = ReservationService(s, OWNER).cancel(r.id)
        self.assertEqual(got.status, "cancelled")
        self.assertEqual(self._balance(), before)
        with self.session() as s, self.assertRaises(AppError):
            ReservationService(s, OWNER).set_ready(r.id, True)

    def test_5_list_filters_and_counts(self):
        from app.modules.reservations.schema import ReservationListQuery
        from app.modules.reservations.service import ReservationService

        r = self._reserve()
        with self.session() as s:
            svc = ReservationService(s, OWNER)
            svc.set_ready(r.id, True)
            out = svc.list_reservations(ReservationListQuery(filter="ready"))
            self.assertIn(r.id, [i.id for i in out.items])
            self.assertGreaterEqual(out.counts.ready, 1)
            found = svc.list_reservations(ReservationListQuery(q="أحمد", filter="all"))
            self.assertGreaterEqual(found.total, 1)
            by_number = svc.list_reservations(ReservationListQuery(q=str(r.number), filter="all"))
            self.assertEqual([i.id for i in by_number.items], [r.id])

    def test_6_deposit_rejected_for_debtor(self):
        from app.modules.customers.model import Customer

        with self.session() as s:
            c = s.get(Customer, self.customer_id)
            saved, c.balance = c.balance, 500
            s.commit()
        try:
            with self.assertRaises(AppError):
                self._reserve(deposit=100)
        finally:
            with self.session() as s:
                s.get(Customer, self.customer_id).balance = saved
                s.commit()


if __name__ == "__main__":
    unittest.main()
