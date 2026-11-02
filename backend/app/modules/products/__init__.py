from . import model  # noqa: F401  (يسجّل الجداول في Base.metadata لـ Alembic)
from .routes import router

__all__ = ["router"]
