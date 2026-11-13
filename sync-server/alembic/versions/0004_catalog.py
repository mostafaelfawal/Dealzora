"""كتالوج الأصناف والعملاء المشترك بين الفروع

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-13 18:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("shops", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("last_catalog_seq", sa.BigInteger(), server_default="0", nullable=False)
        )

    op.create_table(
        "catalog_items",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("shop_id", sa.String(length=36), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("match_key", sa.String(length=240), nullable=True),
        sa.Column(
            "data",
            sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"),
            nullable=False,
        ),
        sa.Column("deleted", sa.Boolean(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("seq", sa.BigInteger(), nullable=False),
        sa.Column("updated_by_branch_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], name=op.f("fk_catalog_items_shop_id_shops")),
        sa.ForeignKeyConstraint(
            ["updated_by_branch_id"],
            ["branches.id"],
            name=op.f("fk_catalog_items_updated_by_branch_id_branches"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_catalog_items")),
    )
    op.create_index("ix_catalog_items_shop_seq", "catalog_items", ["shop_id", "seq"])
    op.create_index("ix_catalog_items_shop_key", "catalog_items", ["shop_id", "kind", "match_key"])


def downgrade() -> None:
    op.drop_index("ix_catalog_items_shop_key", table_name="catalog_items")
    op.drop_index("ix_catalog_items_shop_seq", table_name="catalog_items")
    op.drop_table("catalog_items")
    with op.batch_alter_table("shops", schema=None) as batch_op:
        batch_op.drop_column("last_catalog_seq")
