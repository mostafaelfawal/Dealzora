"""ملخصات جديدة من الفروع: النواقص والصلاحية والورديات والعمليات الحساسة والأكثر مبيعاً + حدود المالك
(جداول جديدة فقط، لا تغيير في الموجود)

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-16 18:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSONType = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    op.create_table(
        "branch_reports",
        sa.Column("branch_id", sa.String(length=36), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("shop_id", sa.String(length=36), nullable=False),
        sa.Column("data", JSONType, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], name=op.f("fk_branch_reports_branch_id_branches")),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], name=op.f("fk_branch_reports_shop_id_shops")),
        sa.PrimaryKeyConstraint("branch_id", "kind", name=op.f("pk_branch_reports")),
    )
    op.create_index(op.f("ix_branch_reports_shop_id"), "branch_reports", ["shop_id"], unique=False)

    op.create_table(
        "branch_records",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("shop_id", sa.String(length=36), nullable=False),
        sa.Column("branch_id", sa.String(length=36), nullable=False),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("kind", sa.String(length=12), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("data", JSONType, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], name=op.f("fk_branch_records_branch_id_branches")),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], name=op.f("fk_branch_records_shop_id_shops")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_branch_records")),
        sa.UniqueConstraint("branch_id", "key", name="uq_branch_records_branch_key"),
    )
    op.create_index("ix_branch_records_shop_kind_day", "branch_records", ["shop_id", "kind", "day"], unique=False)

    op.create_table(
        "shop_report_config",
        sa.Column("shop_id", sa.String(length=36), nullable=False),
        sa.Column("data", JSONType, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], name=op.f("fk_shop_report_config_shop_id_shops")),
        sa.PrimaryKeyConstraint("shop_id", name=op.f("pk_shop_report_config")),
    )


def downgrade() -> None:
    op.drop_table("shop_report_config")
    op.drop_index("ix_branch_records_shop_kind_day", table_name="branch_records")
    op.drop_table("branch_records")
    op.drop_index(op.f("ix_branch_reports_shop_id"), table_name="branch_reports")
    op.drop_table("branch_reports")
