"""تنبيهات الهاتف: push token لكل جلسة، إعدادات التنبيهات لكل حساب، وسجل التنبيهات

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-16 10:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSONType = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    # عمود جديد يقبل NULL: آمن على الجلسات الموجودة.
    with op.batch_alter_table("mobile_sessions", schema=None) as batch_op:
        batch_op.add_column(sa.Column("push_token", sa.String(length=200), nullable=True))

    op.create_table(
        "notification_prefs",
        sa.Column("account_id", sa.String(length=36), nullable=False),
        sa.Column("shop_id", sa.String(length=36), nullable=False),
        sa.Column("data", JSONType, nullable=False),
        sa.Column("utc_offset_minutes", sa.Integer(), server_default="120", nullable=False),
        sa.Column("last_push_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["account_id"], ["catalog_items.id"], name=op.f("fk_notification_prefs_account_id_catalog_items")
        ),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], name=op.f("fk_notification_prefs_shop_id_shops")),
        sa.PrimaryKeyConstraint("account_id", name=op.f("pk_notification_prefs")),
    )
    op.create_index(op.f("ix_notification_prefs_shop_id"), "notification_prefs", ["shop_id"], unique=False)

    op.create_table(
        "notifications",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("shop_id", sa.String(length=36), nullable=False),
        sa.Column("account_id", sa.String(length=36), nullable=False),
        sa.Column("kind", sa.String(length=24), nullable=False),
        sa.Column("dedup_key", sa.String(length=160), nullable=False),
        sa.Column("title", sa.String(length=80), nullable=False),
        sa.Column("body", sa.String(length=200), nullable=False),
        sa.Column("route", sa.String(length=120), nullable=False),
        sa.Column("ref_id", sa.String(length=36), nullable=True),
        sa.Column("status", sa.String(length=12), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["account_id"], ["catalog_items.id"], name=op.f("fk_notifications_account_id_catalog_items")
        ),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], name=op.f("fk_notifications_shop_id_shops")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notifications")),
        sa.UniqueConstraint("account_id", "dedup_key", name="uq_notifications_account_key"),
    )
    op.create_index("ix_notifications_account_created", "notifications", ["account_id", "created_at"], unique=False)
    op.create_index("ix_notifications_status", "notifications", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_notifications_status", table_name="notifications")
    op.drop_index("ix_notifications_account_created", table_name="notifications")
    op.drop_table("notifications")
    op.drop_index(op.f("ix_notification_prefs_shop_id"), table_name="notification_prefs")
    op.drop_table("notification_prefs")
    with op.batch_alter_table("mobile_sessions", schema=None) as batch_op:
        batch_op.drop_column("push_token")
