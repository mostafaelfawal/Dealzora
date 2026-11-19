"""المتجر الإلكتروني: تخصيص الواجهة (stores.theme) وصور إضافية للصنف (store_products.gallery)
(أعمدة جديدة اختيارية فقط)

Revision ID: 0012
Revises: 0011
Create Date: 2026-11-19 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSONType = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    with op.batch_alter_table("stores") as batch:
        batch.add_column(sa.Column("theme", JSONType, nullable=True))
    with op.batch_alter_table("store_products") as batch:
        batch.add_column(sa.Column("gallery", JSONType, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("store_products") as batch:
        batch.drop_column("gallery")
    with op.batch_alter_table("stores") as batch:
        batch.drop_column("theme")
