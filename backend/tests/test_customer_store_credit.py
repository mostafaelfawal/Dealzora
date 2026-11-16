"""رصيد العميل لدى المحل: الباقي يُحفظ رصيداً، ويُدفع منه لاحقاً، ويرجع له في المرتجع، ويُصرف نقداً.

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

DEVICE = "dev-credit-test"
OWNER = Actor(user_id="owner-credit", role=Role.OWNER, device_id=DEVICE)
PRICE = 4750  # 47.50


class StoreCreditTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._lease_state = dict(branch_lease._state)
        branch_lease._state.update(loaded=True, plan=None, terminals=0, exp=0)
        cls.tmp = tempfile.mkdtemp(prefix="dealzora-credit-test-")
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
    def _sell(self, *, qty=1000, customer=True, received=0, keep=0, use=0, method="cash"):
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

    # ---------- الاختبارات (بالترتيب: الرصيد يتراكم عبرها) ----------
    def test_1_keep_change_as_credit(self):
        drawer = self._expected_drawer()
        sale = self._sell(received=5000, keep=250)  # 50 مقابل 47.50، يترك 2.50
        self.assertEqual((sale.change, sale.change_kept), (0, 250))
        self.assertEqual(sale.customer_balance, -250)  # له 2.50 لدى المحل
        self.assertEqual(self._balance(), -250)
        # الدرج استلم 50 كاملة: 47.50 مبيعات + 2.50 رصيد للعميل.
        self.assertEqual(self._expected_drawer() - drawer, 5000)

    def test_2_partial_keep_hands_rest(self):
        sale = self._sell(received=10_000, keep=250)  # باقي 52.50: يأخذ 50 ويترك 2.50
        self.assertEqual((sale.change, sale.change_kept), (5000, 250))
        self.assertEqual(self._balance(), -500)

    def test_3_pay_from_balance(self):
        drawer = self._expected_drawer()
        sale = self._sell(use=500, received=4250)  # 47.50 - 5 رصيد = 42.50 كاش
        self.assertEqual((sale.balance_used, sale.cash_amount, sale.total), (500, 4250, PRICE))
        self.assertEqual(self._balance(), 0)
        self.assertEqual(self._expected_drawer() - drawer, 4250)

    def test_4_return_goes_back_to_balance(self):
        from app.modules.sales.schema import ReturnCreate
        from app.modules.sales.service import SaleService

        sale = self._sell(received=5000, keep=250)  # الرصيد = -250
        drawer = self._expected_drawer()
        with self.session() as s:
            ret = SaleService(s, OWNER).create_return(
                sale.id,
                ReturnCreate(reason="other", lines=[{"sale_line_id": sale.lines[0].id, "qty": 1000}],
                             refund_via="balance"),  # fmt: skip
            )
        self.assertEqual((ret.balance_refund, ret.cash_refund), (PRICE, 0))
        self.assertEqual(self._balance(), -250 - PRICE)
        self.assertEqual(self._expected_drawer(), drawer)  # لم يخرج شيء من الدرج

    def test_5_payout_in_cash(self):
        from app.modules.customers.schema import PaymentIn
        from app.modules.customers.service import CustomerService

        credit = -self._balance()
        with self.session() as s:
            out = CustomerService(s, OWNER).payout_balance(self.customer_id, PaymentIn(amount=credit))
        self.assertEqual(out.balance, 0)
        with self.session() as s, self.assertRaises(AppError):
            CustomerService(s, OWNER).payout_balance(self.customer_id, PaymentIn(amount=100))

    def test_6_rules(self):
        with self.assertRaises(AppError):  # بلا عميل
            self._sell(customer=False, received=5000, keep=250)
        with self.assertRaises(AppError):  # أكثر من الباقي
            self._sell(received=5000, keep=300)
        with self.assertRaises(AppError):  # أكثر من الرصيد
            self._sell(use=100, received=PRICE - 100)

    def test_7_ledger_matches_balance(self):
        from sqlalchemy import func, select

        from app.modules.customers.model import CustomerLedgerEntry

        with self.session() as s:
            debit, credit = s.execute(
                select(func.sum(CustomerLedgerEntry.debit), func.sum(CustomerLedgerEntry.credit)).where(
                    CustomerLedgerEntry.customer_id == self.customer_id
                )
            ).one()
        self.assertEqual((debit or 0) - (credit or 0), self._balance())


if __name__ == "__main__":
    unittest.main()
