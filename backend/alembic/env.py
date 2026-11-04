from alembic import context

import app.core.audit  # noqa: F401
import app.core.outbox  # noqa: F401
import app.modules.users.model  # noqa: F401
import app.modules.auth.model  # noqa: F401
import app.modules.products.model  # noqa: F401
from app.core.base import Base
from app.core.database import get_engine

target_metadata = Base.metadata


def run_migrations_online() -> None:
    engine = get_engine()
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # ضروري لـ SQLite: ALTER TABLE محدود
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()