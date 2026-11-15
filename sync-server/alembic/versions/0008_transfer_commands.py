"""موافقة التحويلات من الهاتف: أوامر ينفّذها جهاز الفرع (جدول جديد فقط، لا تغيير في الموجود)

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-15 22:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSONType = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    op.create_table(
        "transfer_commands",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("shop_id", sa.String(length=36), nullable=False),
        sa.Column("transfer_id", sa.String(length=36), nullable=False),
        sa.Column("branch_id", sa.String(length=36), nullable=False),
        sa.Column("action", sa.String(length=16), nullable=False),
        sa.Column("body", JSONType, nullable=False),
        sa.Column("transfer_version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("requested_by", sa.String(length=50), nullable=False),
        sa.Column("account_id", sa.String(length=36), nullable=False),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("device_name", sa.String(length=80), nullable=False),
        sa.Column("error_code", sa.String(length=40), nullable=True),
        sa.Column("error_message", sa.String(length=300), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], name=op.f("fk_transfer_commands_shop_id_shops")),
        sa.ForeignKeyConstraint(
            ["transfer_id"], ["transfers.id"], name=op.f("fk_transfer_commands_transfer_id_transfers")
        ),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], name=op.f("fk_transfer_commands_branch_id_branches")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_transfer_commands")),
    )
    op.create_index(op.f("ix_transfer_commands_transfer_id"), "transfer_commands", ["transfer_id"], unique=False)
    op.create_index("ix_transfer_commands_branch", "transfer_commands", ["branch_id", "status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_transfer_commands_branch", table_name="transfer_commands")
    op.drop_index(op.f("ix_transfer_commands_transfer_id"), table_name="transfer_commands")
    op.drop_table("transfer_commands")
