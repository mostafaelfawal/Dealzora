"""نظام التقسيط: الجدول، والمقدّم (بلا زيادة)، وتحصيل الأقساط، وحماية الخطة.

الصحة هنا محاسبية: رصيد العميل وكشف حسابه والخزنة والمدفوع على الخطة لازم يتفقوا بالقرش.
"""

import os
import shutil
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

os.environ.setdefault("POS_DB_PASSWORD", "unit-test-password")
os.environ.setdefault("POS_SESSION_TOKEN", "t")
os.environ.setdefault("POS_WRITE_PERMIT_SECRET", "t")
os.environ.setdefault("POS_DEVICE_ID", "dev-test")

from app.core import branch_lease, database  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.core.errors import AppError  # noqa: E402
from app.core.security import Actor, Role  # noqa: E402
from app.modules.installments.helper import (  # noqa: E402
    add_months,
    build_schedule,
    split_amounts,
)
from app.modules.installments.types import DueStatus, Frequency  # noqa: E402

DEVICE = "dev-installments-test"
OWNER = Actor(user_id="owner-inst", role=Role.OWNER, device_id=DEVICE)


class ScheduleMathTests(unittest.TestCase):
    def test_split_puts_remainder_on_last(self):
        self.assertEqual(split_amounts(10_000, 3), [3333, 3333, 3334])
        self.assertEqual(sum(split_amounts(123_457, 7)), 123_457)

    def test_month_end_is_clamped(self):
        self.assertEqual(add_months(date(2026, 1, 31), 1), date(2026, 2, 28))
        self.assertEqual(add_months(date(2026, 11, 30), 3), date(2027, 2, 28))

    def test_paid_is_allocated_oldest_first(self):
        start = date(2026, 1, 1)
        rows = build_schedule(9000, 3, Frequency.MONTHLY, start, 4000, today=date(2026, 2, 15))
        self.assertEqual([r.status for r in rows], [DueStatus.PAID, DueStatus.OVERDUE, DueStatus.UPCOMING])
        self.assertEqual([r.paid for r in rows], [3000, 1000, 0])
        weekly = build_schedule(300, 3, Frequency.WEEKLY, start, 0, today=start)
        self.assertEqual(weekly[2].due_date, date(2026, 1, 15))


class InstallmentServiceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._lease_state = dict(branch_lease._state)
        branch_lease._state.update(loaded=True, plan=None, terminals=0, exp=0)
        cls.tmp = tempfile.mkdtemp(prefix="dealzora-inst-test-")
        settings = get_settings()
        cls._saved = (settings.db_path, settings.device_id, settings.plan)
        settings.db_path = str(Path(cls.tmp) / "test.db")
        settings.device_id = DEVICE
        settings.plan = "pro"
        assert cls.tmp in settings.db_path  # لا نلمس قاعدة البرنامج أبداً
        for f in (database.get_engine, database.get_sessionmaker, database.get_write_sessionmaker):
            f.cache_clear()
        from app.core.init_db import init_db

        init_db()

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

    def _customer(self, phone: str, opening: int = 0) -> str:
        from app.modules.customers.schema import CustomerCreate
        from app.modules.customers.service import CustomerService

        with self.session() as s:
            return CustomerService(s, OWNER).create_customer(
                CustomerCreate.model_validate(
                    {"name": f"عميل {phone}", "phone": phone, "address": "", "notes": "",
                     "credit_limit": 0, "opening_balance": opening, "is_active": True,
                     "is_wholesale": False}  # fmt: skip
                )
            ).id

    def _create(self, customer_id: str, **kw):
        from app.modules.installments.schema import PlanCreate
        from app.modules.installments.service import InstallmentService

        body = {"customer_id": customer_id, "title": "ثلاجة", "principal": 120_000,
                "installments_count": 4, "start_date": date.today().isoformat()} | kw  # fmt: skip
        with self.session() as s:
            return InstallmentService(s, OWNER).create_plan(PlanCreate.model_validate(body))

    def _pay(self, plan_id: str, amount: int):
        from app.modules.installments.schema import PlanPaymentIn
        from app.modules.installments.service import InstallmentService

        with self.session() as s:
            return InstallmentService(s, OWNER).pay(plan_id, PlanPaymentIn(amount=amount))

    def _balance(self, customer_id: str) -> int:
        from app.modules.customers.model import Customer

        with self.session() as s:
            return s.get(Customer, customer_id).balance

    def _treasury(self) -> int:
        from app.modules.treasury.service import TreasuryService

        with self.session() as s:
            return TreasuryService(s, OWNER).summary().balance

    def test_markup_field_is_rejected(self):
        from pydantic import ValidationError

        from app.modules.installments.schema import PlanCreate

        with self.assertRaises(ValidationError):  # لا فائدة على التقسيط إطلاقاً
            PlanCreate.model_validate({"customer_id": "c", "title": "ثلاجة", "principal": 100,
                                       "installments_count": 2, "start_date": "2026-01-01",
                                       "markup_bp": 1000})  # fmt: skip

    def test_empty_and_long_notes(self):
        from pydantic import ValidationError

        from app.modules.installments.schema import PlanCreate, PlanPaymentIn

        body = {"customer_id": "c", "title": "ثلاجة", "principal": 100,
                "installments_count": 2, "start_date": "2026-01-01"}  # fmt: skip
        for note in (None, "", "   "):  # الواجهة ترسل null للملاحظة الفارغة
            self.assertIsNone(PlanCreate.model_validate(body | {"note": note}).note)
            self.assertIsNone(PlanPaymentIn.model_validate({"amount": 100, "note": note}).note)
        with self.assertRaises(ValidationError):
            PlanCreate.model_validate(body | {"note": "x" * 201})

    def test_adds_debt_is_gone(self):
        from pydantic import ValidationError

        from app.modules.installments.schema import PlanCreate

        with self.assertRaises(ValidationError):  # البيع بالتقسيط يمر بالكاشير (بيع آجل) لا هنا
            PlanCreate.model_validate({"customer_id": "c", "title": "ثلاجة", "principal": 100,
                                       "installments_count": 2, "start_date": "2026-01-01",
                                       "adds_debt": True})  # fmt: skip

    def test_debt_with_down_payment(self):
        cid = self._customer("01000000001", opening=120_000)
        cash = self._treasury()
        # 1200 دين، 200 مقدّم = 1000 على 4 أقساط (بلا أي زيادة).
        plan = self._create(cid, down_payment=20_000)
        self.assertEqual((plan.total, plan.installment_amount), (100_000, 25_000))
        self.assertEqual(self._balance(cid), 100_000)
        self.assertEqual(self._treasury() - cash, 20_000)  # المقدّم دخل الخزنة
        self.assertEqual(plan.payments, [])  # المقدّم ليس قسطاً

        plan = self._pay(plan.id, 30_000)  # أكثر من قسط: يُوزَّع على الأقدم
        self.assertEqual([r.status for r in plan.schedule[:2]], [DueStatus.PAID, DueStatus.PARTIAL])
        self.assertEqual((plan.remaining, plan.paid_count), (70_000, 1))
        self.assertEqual(self._balance(cid), 70_000)
        self.assertEqual(self._treasury() - cash, 50_000)

        with self.assertRaises(AppError):
            self._pay(plan.id, 70_001)  # أكثر من المتبقي
        plan = self._pay(plan.id, 70_000)
        self.assertEqual((plan.status.value, plan.remaining, len(plan.payments)), ("completed", 0, 2))
        self.assertEqual(self._balance(cid), 0)
        with self.assertRaises(AppError):
            self._pay(plan.id, 100)  # الخطة منتهية

    def test_existing_debt_cannot_be_scheduled_twice(self):
        cid = self._customer("01000000002", opening=50_000)
        plan = self._create(cid, principal=30_000, installments_count=3)
        self.assertEqual(self._balance(cid), 50_000)  # تقسيط دين موجود لا يغيّر الرصيد
        with self.assertRaises(AppError):
            self._create(cid, principal=20_001)  # المتبقي غير المقسّط 200 فقط
        self._create(cid, principal=20_000)

    def test_overdue_and_cancel(self):
        from app.modules.installments.schema import PlanListQuery
        from app.modules.installments.service import InstallmentService
        from app.modules.installments.types import PlanFilter

        cid = self._customer("01000000003", opening=60_000)
        start = date.today() - timedelta(days=40)
        plan = self._create(cid, principal=60_000, installments_count=3, start_date=start.isoformat())
        self.assertEqual((plan.overdue_count, plan.overdue_amount), (2, 40_000))
        with self.session() as s:
            svc = InstallmentService(s, OWNER)
            self.assertIn(plan.id, [p.id for p in svc.list_plans(PlanListQuery(filter=PlanFilter.OVERDUE))])
            self.assertGreaterEqual(svc.summary().overdue_amount, 40_000)
            cancelled = svc.cancel(plan.id, plan.version)
        self.assertEqual((cancelled.status.value, cancelled.overdue_count), ("cancelled", 0))
        self.assertEqual(self._balance(cid), 60_000)  # الإلغاء لا يمسح الدين

    def _collect_outside(self, customer_id: str, amount: int) -> None:
        """«تحصيل دفعة» من صفحة العملاء (خارج شاشة التقسيط)."""
        from app.modules.customers.schema import PaymentIn
        from app.modules.customers.service import CustomerService

        with self.session() as s:
            CustomerService(s, OWNER).collect_payment(customer_id, PaymentIn(amount=amount))

    def _get(self, plan_id: str):
        from app.modules.installments.service import InstallmentService

        with self.session() as s:
            return InstallmentService(s, OWNER).get_plan(plan_id)

    def test_outside_payment_counts_on_plan(self):
        # دين 1500: 1000 مقسّط + 500 غير مقسّط.
        cid = self._customer("01000000004", opening=150_000)
        plan = self._create(cid, principal=100_000, installments_count=4)

        self._collect_outside(cid, 40_000)  # يغطي جزءاً من غير المقسّط فقط
        self.assertEqual(self._get(plan.id).remaining, 100_000)

        self._collect_outside(cid, 30_000)  # الدين 800 < المقسّط 1000: الفرق 200 على الخطة
        plan = self._get(plan.id)
        self.assertEqual((plan.remaining, plan.settled_outside, plan.paid_count), (80_000, 20_000, 0))

        plan = self._pay(plan.id, 80_000)  # القسط الباقي يُحصَّل كاملاً بلا رفض
        self.assertEqual((plan.status.value, plan.remaining, self._balance(cid)), ("completed", 0, 0))

    def test_outside_payment_completes_oldest_plan_first(self):
        cid = self._customer("01000000005", opening=100_000)
        first = self._create(cid, principal=40_000, installments_count=2)
        second = self._create(cid, principal=60_000, installments_count=3)
        self._collect_outside(cid, 50_000)  # الدين 500 والمقسّط 1000: 500 على الأقدم ثم التالي
        first, second = self._get(first.id), self._get(second.id)
        self.assertEqual((first.status.value, first.remaining), ("completed", 0))
        self.assertEqual((second.status.value, second.remaining), ("active", 50_000))

    def test_customer_with_active_plan_cannot_be_deleted(self):
        from app.modules.customers.model import Customer
        from app.modules.customers.service import CustomerService

        cid = self._customer("01000000006", opening=30_000)
        plan = self._create(cid, principal=30_000, installments_count=3)
        with self.session() as s:  # رصيد صفر يدوياً: يتخطى فحص الدين ليصل لفحص الخطة
            c = s.get(Customer, cid)
            c.balance = 0
            s.commit()
            with self.assertRaises(AppError):
                CustomerService(s, OWNER).delete_customer(cid, c.version)
        self.assertEqual(self._get(plan.id).status.value, "active")

    def test_plan_gated_to_pro(self):
        from app.core.plan import Feature, has_feature

        settings = get_settings()
        settings.plan = "basic"
        try:
            self.assertFalse(has_feature(Feature.INSTALLMENTS))
        finally:
            settings.plan = "pro"
        self.assertTrue(has_feature(Feature.INSTALLMENTS))


if __name__ == "__main__":
    unittest.main()
