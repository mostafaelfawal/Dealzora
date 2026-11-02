from fastapi import APIRouter

from app.modules.products.routes import router as products_router
from app.modules.auth.routes import router as auth_router

api_router = APIRouter()
routes = [
    products_router,
    auth_router
]

for router in routes:
    api_router.include_router(router)
