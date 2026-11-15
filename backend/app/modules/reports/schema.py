"""Schemas التقارير (قراءة فقط، للمدير). المال بالقروش والكميات × 1000."""

from datetime import date, datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator

MAX_RANGE_DAYS = 366


class ProductRank(StrEnum):
    TOP = "top"  # الأكثر مبيعاً (كمية)
    BOTTOM = "bottom"  # الأقل مبيعاً (يشمل ما لم يُبع)
    PROFIT = "profit"  # الأعلى ربحاً
    REVENUE = "revenue"


class RangeQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date_from: date
    date_to: date

    @model_validator(mode="after")
    def _range(self):
        if self.date_from > self.date_to:
            raise ValueError("تاريخ البداية بعد تاريخ النهاية")
        if (self.date_to - self.date_from).days > MAX_RANGE_DAYS:
            raise ValueError("أقصى فترة للتقرير سنة واحدة")
        return self


class ProductsQuery(RangeQuery):
    rank: ProductRank = ProductRank.TOP
    limit: int = Field(20, ge=1, le=200)
    # قسم واحد فقط. "none" = الأصناف بدون قسم.
    category_id: str | None = Field(None, max_length=36)


class StockQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stagnant_days: int = Field(30, ge=7, le=365)
    limit: int = Field(100, ge=1, le=500)


# ---------- المبيعات ----------
class SalesDayOut(BaseModel):
    day: date
    count: int
    revenue: int  # إجمالي الفواتير
    returns: int
    net: int  # revenue - returns
    cost: int
    profit: int


class SalesReportOut(BaseModel):
    days: list[SalesDayOut]
    count: int
    revenue: int
    returns: int
    net: int
    cost: int
    profit: int
    discounts: int
    # تفصيل الخصومات: العروض التلقائية / خصم الكاشير على السطور / خصم الفاتورة / نقاط الولاء.
    # discounts = الثلاثة الأولى (كما كان)، ونقاط الولاء منفصلة.
    promo_discount: int = 0
    lines_discount: int = 0
    invoice_discount: int = 0
    loyalty_discount: int = 0
    # ضريبة القيمة المضافة: المحصّلة في الفواتير، والمردودة بالمرتجعات، والصافي المستحق.
    # untaxed_count = فواتير قبل إضافة الضريبة في الفترة (غير داخلة في المجموع).
    tax_total: int = 0
    tax_returns: int = 0
    tax_net: int = 0
    untaxed_count: int = 0
    cash: int
    credit: int
    wallet: int  # كل الدفع الإلكتروني
    electronic: list["NamedValueOut"]  # تفصيل الإلكتروني حسب الطريقة (key = معرّفها)
    expenses: int
    net_profit: int  # الربح - المصروفات


# ---------- الأصناف ----------
class ProductRowOut(BaseModel):
    product_id: str
    name: str
    unit: str
    qty: int
    revenue: int
    cost: int
    profit: int
    stock_qty: int


class CategorySalesOut(BaseModel):
    id: str  # "none" = بدون قسم
    name: str
    revenue: int
    profit: int
    qty: int  # وحدات أساسية × 1000
    products: int  # أصناف بيعت منه


class ProductsReportOut(BaseModel):
    items: list[ProductRowOut]
    categories: list[CategorySalesOut]


# ---------- المخزون ----------
class StockRowOut(BaseModel):
    product_id: str
    name: str
    unit: str
    stock_qty: int
    min_stock: int
    cost_price: int
    stock_value: int
    last_sold_at: datetime | None


class StockReportOut(BaseModel):
    stock_value: int
    low: list[StockRowOut]
    out: list[StockRowOut]
    stagnant: list[StockRowOut]
    stagnant_value: int


# ---------- المديونيات ----------
class DebtorOut(BaseModel):
    id: str
    name: str
    phone: str | None
    balance: int
    credit_limit: int
    last_payment_at: datetime | None
    is_overdue: bool


class PayableOut(BaseModel):
    id: str
    name: str
    phone: str | None
    balance: int


class DebtsReportOut(BaseModel):
    customers_total: int
    overdue_total: int
    overdue_count: int
    customers: list[DebtorOut]
    suppliers_total: int
    suppliers: list[PayableOut]


# ---------- الخزنة ----------
class TreasuryKindOut(BaseModel):
    kind: str
    direction: str
    count: int
    total: int


class TreasuryReportOut(BaseModel):
    opening: int
    total_in: int
    total_out: int
    closing: int
    by_kind: list[TreasuryKindOut]


# ---------- لوحة التحكم (نظرة شاملة على فترة مقارنةً بالفترة السابقة) ----------
class KpisOut(BaseModel):
    net_sales: int
    gross_profit: int
    expenses: int
    net_profit: int
    invoices: int
    avg_ticket: int
    items_sold: int  # كمية أساسية × 1000
    returns: int
    discounts: int
    cash_sales: int
    credit_sales: int
    wallet_sales: int  # كل الدفع الإلكتروني


class TrendPointOut(BaseModel):
    day: date
    net: int
    profit: int
    invoices: int
    prev_net: int  # نفس ترتيب اليوم في الفترة السابقة
    prev_profit: int


class HeatCellOut(BaseModel):
    weekday: int  # 0 = السبت … 6 = الجمعة
    hour: int  # 0..23 بتوقيت الجهاز
    invoices: int
    net: int


class NamedValueOut(BaseModel):
    key: str
    label: str
    value: int
    extra: int = 0  # قيمة ثانية (ربح/كمية/عدد) حسب السياق


class CashierOut(BaseModel):
    user_id: str
    name: str
    invoices: int
    net: int
    returns: int
    avg_ticket: int
    discounts: int


class CashDayOut(BaseModel):
    day: date
    cash_in: int
    cash_out: int


class HealthOut(BaseModel):
    stock_value: int
    low_stock: int
    out_of_stock: int
    stagnant_count: int
    stagnant_value: int
    customers_debt: int
    overdue_customers: int
    overdue_debt: int
    suppliers_payable: int
    treasury_balance: int


class RecentSaleOut(BaseModel):
    id: str
    number: int
    sold_at: datetime
    customer_name: str | None
    payment_method: str
    payment_label: str
    total: int


class ShiftBriefOut(BaseModel):
    cashier_name: str | None
    opened_at: datetime
    sales_count: int
    expected_cash: int


class PromotionsBriefOut(BaseModel):
    """العروض التلقائية: الحالة الآن، وأثرها في الفترة مقارنة بالسابقة."""

    active: int
    scheduled: int
    discount: int  # مجموع خصم العروض في الفترة
    prev_discount: int
    invoices: int  # فواتير طُبق فيها عرض
    top: list["NamedValueOut"]  # اسم العرض، value = الخصم، extra = عدد السطور


class LoyaltyBriefOut(BaseModel):
    """نقاط الولاء (خطة فيها العملاء). المبالغ بالقروش."""

    enabled: bool
    earned: int  # نقاط اكتسبها العملاء في الفترة (بعد المرتجع)
    redeemed: int  # نقاط استبدلوها في الفترة (بعد المرتجع)
    redeem_value: int  # قيمة خصم الاستبدال في الفترة
    outstanding_points: int  # أرصدة العملاء الآن
    outstanding_value: int  # قيمتها لو استُبدلت (التزام على المحل)
    members: int  # عملاء لديهم رصيد


class CustomersBriefOut(BaseModel):
    new_customers: int
    active_customers: int  # اشتروا في الفترة
    top: list["NamedValueOut"]  # value = صافي المشتريات، extra = عدد الفواتير


class PurchasingBriefOut(BaseModel):
    """المشتريات وطلبات الشراء (خطة فيها الموردين)."""

    purchases_total: int
    prev_purchases_total: int
    purchases_count: int
    draft_orders: int
    sent_orders: int
    open_orders_total: int
    received_month: int


class ExpiryBriefOut(BaseModel):
    """الصلاحية (خطة سلسلة)."""

    tracked_products: int
    expired_batches: int
    expired_value: int
    soon_7: int
    soon_30: int
    soon_30_value: int


class OverviewOut(BaseModel):
    date_from: date
    date_to: date
    prev_from: date
    prev_to: date
    kpis: KpisOut
    prev: KpisOut
    trend: list[TrendPointOut]
    heatmap: list[HeatCellOut]
    payments: list[NamedValueOut]  # cash / credit / ثم كل طريقة إلكترونية (مفعّلة أو مستخدمة)
    top_products: list[NamedValueOut]  # value = ربح، extra = إيراد
    categories: list[NamedValueOut]  # value = إيراد، extra = ربح
    expenses_by_category: list[NamedValueOut]
    cash_flow: list[CashDayOut]
    cashiers: list[CashierOut]
    health: HealthOut
    shift: ShiftBriefOut | None
    recent_sales: list[RecentSaleOut]
    # أسباب المرتجع في الفترة: value = القيمة، extra = العدد.
    return_reasons: list[NamedValueOut]
    promotions: PromotionsBriefOut
    # None = الميزة ليست في خطة المحل (لا تُحسب ولا تُعرض).
    loyalty: LoyaltyBriefOut | None
    customers: CustomersBriefOut | None
    purchasing: PurchasingBriefOut | None
    expiry: ExpiryBriefOut | None


SalesReportOut.model_rebuild()
