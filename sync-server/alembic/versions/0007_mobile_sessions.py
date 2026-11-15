"""تطبيق الهاتف: أكواد ربط الهاتف بالمحل وجلسات الهواتف (جداول جديدة فقط، لا تغيير في الموجود)

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-15 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "mobile_codes",
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("shop_id", sa.String(length=36), nullable=False),
        sa.Column("created_by_branch_id", sa.String(length=36), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], name=op.f("fk_mobile_codes_shop_id_shops")),
        sa.ForeignKeyConstraint(
            ["created_by_branch_id"], ["branches.id"], name=op.f("fk_mobile_codes_created_by_branch_id_branches")
        ),
        sa.PrimaryKeyConstraint("code_hash", name=op.f("pk_mobile_codes")),
    )
    op.create_index(op.f("ix_mobile_codes_shop_id"), "mobile_codes", ["shop_id"], unique=False)

    op.create_table(
        "mobile_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("shop_id", sa.String(length=36), nullable=False),
        sa.Column("account_id", sa.String(length=36), nullable=False),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("device_id", sa.String(length=64), nullable=False),
        sa.Column("device_name", sa.String(length=80), nullable=False),
        sa.Column("platform", sa.String(length=16), nullable=False),
        sa.Column("refresh_hash", sa.String(length=64), nullable=False),
        sa.Column("refresh_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cred_fp", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_ip", sa.String(length=64), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoke_reason", sa.String(length=24), nullable=True),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], name=op.f("fk_mobile_sessions_shop_id_shops")),
        sa.ForeignKeyConstraint(
            ["account_id"], ["catalog_items.id"], name=op.f("fk_mobile_sessions_account_id_catalog_items")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_mobile_sessions")),
    )
    op.create_index(op.f("ix_mobile_sessions_shop_id"), "mobile_sessions", ["shop_id"], unique=False)
    op.create_index("ix_mobile_sessions_account", "mobile_sessions", ["account_id", "revoked_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_mobile_sessions_account", table_name="mobile_sessions")
    op.drop_index(op.f("ix_mobile_sessions_shop_id"), table_name="mobile_sessions")
    op.drop_table("mobile_sessions")
    op.drop_index(op.f("ix_mobile_codes_shop_id"), table_name="mobile_codes")
    op.drop_table("mobile_codes")
