from fastapi import APIRouter

from app.modules.products.routes import router as products_router
from app.modules.users.routes import router as users_router
from app.modules.auth.routes import router as auth_router
from app.modules.shop.routes import router as shop_router

api_router = APIRouter()
routes = [
    products_router,
    users_router,
    auth_router,
    shop_router
]

for router in routes:
    api_router.include_router(router)
