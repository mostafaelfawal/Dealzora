"""حماية الخطط: كل ميزة تُفتح من خطتها وما فوقها فقط، وحدود كل خطة، والتطبيق الفعلي وقت البيع.

الجدول المرجعي = صفحة الخطط (frontend/features/settings/config/plans.ts):
  دُكّان: العملاء، المحافظ، الموردين، المصروفات، الوحدات، الملصقات، Excel، واتساب، مكان النسخ، تقارير سنة، 4 مستخدمين
  سوق:   سجل العمليات، أجهزة الكاشير، الصلاحية، الإيصال الإلكتروني، الميزان، العروض، الجملة، طلبات الشراء، الولاء، التقسيط
  سلسلة: الفروع، المتجر الإلكتروني
"""

import shutil
import tempfile
import unittest
from pathlib import Path

from app.core import branch_lease, database
from app.core.config import get_settings
from app.core.errors import ForbiddenError
from app.core.plan import (
    PLAN_LIMITS,
    Feature,
    Plan,
    current_plan,
    enabled_features,
    has_feature,
    plan_allows,
    plan_limit,
)
from app.core.security import Actor, Role

DEVICE = "dev-plan-test"
OWNER = Actor(user_id="owner-plan", role=Role.OWNER, device_id=DEVICE)

BASIC = {
    Feature.CUSTOMERS, Feature.WALLETS, Feature.SUPPLIERS, Feature.EXPENSES, Feature.EXTRA_UNITS,
    Feature.BARCODE_LABELS, Feature.EXCEL, Feature.WHATSAPP, Feature.BACKUP_LOCATION, Feature.FULL_REPORTS,
    Feature.MULTI_USER,
}  # fmt: skip
PRO = {
    Feature.AUDIT_LOG, Feature.TERMINALS, Feature.EXPIRY, Feature.E_RECEIPT, Feature.SCALE_BARCODE,
    Feature.PROMOTIONS, Feature.WHOLESALE, Feature.PURCHASE_ORDERS, Feature.LOYALTY,
    Feature.STATEMENT_PDF, Feature.INSTALLMENTS,
}  # fmt: skip
ENTERPRISE = {Feature.BRANCHES, Feature.ONLINE_STORE}


class _NoInheritedPlan:
    """خطة الاختبار فقط: بدون شهادة فرع محفوظة على جهاز المطوّر (ترث خطة محل أعلى)."""

    def setUp(self):
        self._lease_state = dict(branch_lease._state)
        branch_lease._state.update(loaded=True, plan=None, terminals=0, exp=0)
        super().setUp()

    def tearDown(self):
        super().tearDown()
        branch_lease._state.clear()
        branch_lease._state.update(self._lease_state)


class PlanMatrixTests(unittest.TestCase):
    def test_every_feature_is_classified(self):
        self.assertEqual(BASIC | PRO | ENTERPRISE, set(Feature))

    def test_free_has_nothing(self):
        for f in Feature:
            self.assertFalse(plan_allows(Plan.FREE, f), f)

    def test_each_plan_gets_exactly_its_tier_and_below(self):
        expected = {
            Plan.BASIC: BASIC,
            Plan.PRO: BASIC | PRO,
            Plan.ENTERPRISE: BASIC | PRO | ENTERPRISE,
        }
        for plan, allowed in expected.items():
            for f in Feature:
                self.assertEqual(plan_allows(plan, f), f in allowed, f"{plan} / {f}")

    def test_limits_grow_with_the_plan(self):
        self.assertEqual(PLAN_LIMITS[Plan.FREE], {"products": 300, "users": 1, "report_days": 7})
        self.assertEqual(PLAN_LIMITS[Plan.BASIC], {"products": None, "users": 4, "report_days": 366})
        for plan in (Plan.PRO, Plan.ENTERPRISE):
            self.assertEqual(PLAN_LIMITS[plan], {"products": None, "users": None, "report_days": None})


class CurrentPlanTests(_NoInheritedPlan, unittest.TestCase):
    def setUp(self):
        super().setUp()
        s = get_settings()
        self._saved = (s.plan, s.plan_expires_at)

    def tearDown(self):
        s = get_settings()
        s.plan, s.plan_expires_at = self._saved
        super().tearDown()

    def test_basic_cannot_use_pro_features(self):
        get_settings().plan = "basic"
        self.assertTrue(has_feature(Feature.CUSTOMERS))
        for f in PRO | ENTERPRISE:
            self.assertFalse(has_feature(f), f)
        self.assertEqual(plan_limit("users"), 4)

    def test_unknown_plan_is_free(self):
        get_settings().plan = "gold"
        self.assertIs(current_plan(), Plan.FREE)
        self.assertEqual(enabled_features(), [])

    def test_expired_subscription_falls_back_to_free(self):
        s = get_settings()
        s.plan, s.plan_expires_at = "enterprise", 1  # انتهى في 1970
        self.assertIs(current_plan(), Plan.FREE)


class SaleTimeGatingTests(_NoInheritedPlan, unittest.TestCase):
    """الميزات اللي تغيّر السعر: تحت الخطة تتصرف كأنها متوقفة (الكاشير والسيرفر نفس الحساب)."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="dealzora-plan-test-")
        settings = get_settings()
        cls._saved = (settings.db_path, settings.device_id, settings.plan)
        settings.db_path = str(Path(cls.tmp) / "test.db")
        settings.device_id = DEVICE
        settings.plan = "enterprise"
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
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def tearDown(self):
        get_settings().plan = "enterprise"
        super().tearDown()

    def test_loyalty_and_scale_are_off_below_pro_but_kept(self):
        from app.modules.loyalty.config import LoyaltyConfig
        from app.modules.settings.scale import ScaleBarcodeConfig
        from app.modules.settings.service import SettingsService

        with database.get_write_sessionmaker()() as s:
            svc = SettingsService(s)
            svc.set_loyalty(OWNER, LoyaltyConfig.model_validate({**LoyaltyConfig().model_dump(), "enabled": True}))
            svc.set_scale_barcode(OWNER, ScaleBarcodeConfig(enabled=True))
            s.commit()
        get_settings().plan = "basic"
        with database.get_sessionmaker()() as s:
            self.assertFalse(SettingsService(s).loyalty().enabled)
            self.assertFalse(SettingsService(s).scale_barcode().enabled)
        get_settings().plan = "pro"  # الترقية ترجّع الإعداد المحفوظ كما هو
        with database.get_sessionmaker()() as s:
            self.assertTrue(SettingsService(s).loyalty().enabled)
            self.assertTrue(SettingsService(s).scale_barcode().enabled)

    def test_promotions_inactive_below_pro(self):
        from app.modules.promotions.service import active_promotions

        get_settings().plan = "basic"
        with database.get_sessionmaker()() as s:
            self.assertEqual(active_promotions(s), [])

    def test_wholesale_price_is_retail_below_pro(self):
        from app.modules.products.model import Product
        from app.modules.sales.pricing import LineInput, price_lines

        p = Product(id="p1", name="أرز", sale_price=3000, wholesale_price=2500, wholesale_min_qty=None)
        line = [LineInput(p, None, 1000)]
        self.assertEqual(price_lines(line, wholesale_customer=True, promos=[])[0].price, 2500)
        self.assertEqual(
            price_lines(line, wholesale_customer=True, promos=[], allow_wholesale=False)[0].price, 3000
        )

    def test_new_wholesale_customer_needs_pro(self):
        from app.modules.customers.schema import CustomerCreate
        from app.modules.customers.service import CustomerService

        get_settings().plan = "basic"
        data = CustomerCreate.model_validate(
            {"name": "عميل جملة", "phone": None, "address": "", "notes": "", "credit_limit": 0,
             "opening_balance": 0, "is_active": True, "is_wholesale": True}  # fmt: skip
        )
        with database.get_write_sessionmaker()() as s:
            with self.assertRaises(ForbiddenError):
                CustomerService(s, OWNER).create_customer(data)

    def test_basic_user_limit(self):
        from app.modules.users.schema import UserCreate
        from app.modules.users.service import UserService

        get_settings().plan = "basic"
        with database.get_write_sessionmaker()() as s:
            svc = UserService(s, OWNER)
            existing = svc.repo.count_users()
            created = 0
            with self.assertRaises(ForbiddenError):
                for i in range(10):
                    svc.create_user(UserCreate(username=f"cashier{i}", password="Strong-Pass-2026"))
                    created += 1
            self.assertEqual(existing + created, 4)


if __name__ == "__main__":
    unittest.main()
