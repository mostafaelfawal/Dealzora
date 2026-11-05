from fastapi import APIRouter

from app.modules.products.routes import router as products_router
from app.modules.users.routes import router as users_router
from app.modules.customers.routes import router as customers_router
from app.modules.auth.routes import router as auth_router
from app.modules.shop.routes import router as shop_router
from app.modules.expenses.routes import router as expenses_router

api_router = APIRouter()
routes = [
    products_router,
    users_router,
    customers_router,
    auth_router,
    shop_router,
    expenses_router,
]

for router in routes:
    api_router.include_router(router)