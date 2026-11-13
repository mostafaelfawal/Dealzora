"""تسجيل ذاتي للمحلات بالترخيص + الفرع الرئيسي (جهاز المالك)

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-13 22:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("shops", schema=None) as batch_op:
        batch_op.add_column(sa.Column("license_id", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("license_plan", sa.String(length=16), nullable=True))
        batch_op.add_column(sa.Column("license_expires_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.create_unique_constraint(batch_op.f("uq_shops_license_id"), ["license_id"])
    with op.batch_alter_table("branches", schema=None) as batch_op:
        batch_op.add_column(sa.Column("is_admin", sa.Boolean(), server_default="0", nullable=False))


def downgrade() -> None:
    with op.batch_alter_table("branches", schema=None) as batch_op:
        batch_op.drop_column("is_admin")
    with op.batch_alter_table("shops", schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f("uq_shops_license_id"), type_="unique")
        batch_op.drop_column("license_expires_at")
        batch_op.drop_column("license_plan")
        batch_op.drop_column("license_id")
