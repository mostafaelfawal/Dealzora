from fastapi import APIRouter

from app.core.config import get_settings

from app.modules.audit.routes import router as audit_router
from app.modules.auth.routes import router as auth_router
from app.modules.backup.routes import router as backup_router
from app.modules.catalog.routes import router as catalog_router
from app.modules.customers.routes import router as customers_router
from app.modules.devices.routes import router as devices_router
from app.modules.expenses.routes import router as expenses_router
from app.modules.held.routes import router as held_router
from app.modules.loyalty.routes import router as loyalty_router
from app.modules.plan.routes import router as plan_router
from app.modules.products.routes import router as products_router
from app.modules.purchase_orders.routes import router as purchase_orders_router
from app.modules.purchases.routes import router as purchases_router
from app.modules.promotions.routes import router as promotions_router
from app.modules.realtime.routes import router as realtime_router
from app.modules.reports.routes import router as reports_router
from app.modules.sales.routes import router as sales_router
from app.modules.shifts.routes import router as shifts_router
from app.modules.settings.routes import router as settings_router
from app.modules.shop.routes import router as shop_router
from app.modules.suppliers.routes import router as suppliers_router
from app.modules.treasury.routes import router as treasury_router
from app.modules.users.routes import router as users_router

api_router = APIRouter()
routes = [
    auth_router,
    shop_router,
    plan_router,
    settings_router,
    users_router,
    devices_router,
    products_router,
    catalog_router,
    customers_router,
    suppliers_router,
    expenses_router,
    treasury_router,
    shifts_router,
    sales_router,
    held_router,
    promotions_router,
    loyalty_router,
    purchases_router,
    purchase_orders_router,
    reports_router,
    audit_router,
    backup_router,
    realtime_router,
]

# أدوات التطوير (بيانات تجريبية) لا توجد أصلاً في نسخة الإنتاج.
if get_settings().debug:
    from app.modules.devtools.routes import router as devtools_router

    routes.append(devtools_router)

for router in routes:
    api_router.include_router(router)
