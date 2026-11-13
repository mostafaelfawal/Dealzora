"""عدد أجهزة الكاشير في ترخيص المحل (يرثه كل فرع عبر الشهادة)

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-14 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("shops", schema=None) as batch_op:
        batch_op.add_column(sa.Column("license_terminals", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("shops", schema=None) as batch_op:
        batch_op.drop_column("license_terminals")
