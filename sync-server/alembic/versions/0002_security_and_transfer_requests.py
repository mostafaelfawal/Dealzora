"""أمان (إلغاء التوكنات فوراً، أكواد ربط، سجل أمني)، أحداث موجّهة، وطلبات التحويل

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-13 02:52:07.892782
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0002'
down_revision: str | None = '0001'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('audit_log',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('actor', sa.String(length=16), nullable=False),
    sa.Column('action', sa.String(length=40), nullable=False),
    sa.Column('shop_id', sa.String(length=36), nullable=True),
    sa.Column('branch_id', sa.String(length=36), nullable=True),
    sa.Column('ip', sa.String(length=64), nullable=True),
    sa.Column('details', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_audit_log'))
    )
    with op.batch_alter_table('audit_log', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_audit_log_at'), ['at'], unique=False)
        batch_op.create_index(batch_op.f('ix_audit_log_shop_id'), ['shop_id'], unique=False)

    op.create_table('pairing_codes',
    sa.Column('code_hash', sa.String(length=64), nullable=False),
    sa.Column('branch_id', sa.String(length=36), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], name=op.f('fk_pairing_codes_branch_id_branches')),
    sa.PrimaryKeyConstraint('code_hash', name=op.f('pk_pairing_codes'))
    )
    with op.batch_alter_table('pairing_codes', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_pairing_codes_branch_id'), ['branch_id'], unique=False)

    with op.batch_alter_table('branches', schema=None) as batch_op:
        # الفروع الموجودة تبدأ من 1 (توكناتها الحالية بلا ver تنتهي خلال دقائق وتُجدَّد).
        batch_op.add_column(sa.Column('token_version', sa.Integer(), nullable=False, server_default='1'))

    with op.batch_alter_table('events', schema=None) as batch_op:
        batch_op.add_column(sa.Column('target_branch_id', sa.String(length=36), nullable=True))
        batch_op.create_foreign_key(batch_op.f('fk_events_target_branch_id_branches'), 'branches', ['target_branch_id'], ['id'])

    with op.batch_alter_table('transfer_lines', schema=None) as batch_op:
        batch_op.add_column(sa.Column('qty_requested', sa.BigInteger(), nullable=True))

    with op.batch_alter_table('transfers', schema=None) as batch_op:
        batch_op.add_column(sa.Column('requested_by', sa.String(length=80), nullable=True))
        batch_op.add_column(sa.Column('requested_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('rejected_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('reject_reason', sa.String(length=300), nullable=True))
        batch_op.alter_column('sent_at',
               existing_type=sa.DateTime(timezone=True),
               nullable=True)



def downgrade() -> None:
    with op.batch_alter_table('transfers', schema=None) as batch_op:
        batch_op.alter_column('sent_at',
               existing_type=sa.DateTime(timezone=True),
               nullable=False)
        batch_op.drop_column('reject_reason')
        batch_op.drop_column('rejected_at')
        batch_op.drop_column('requested_at')
        batch_op.drop_column('requested_by')

    with op.batch_alter_table('transfer_lines', schema=None) as batch_op:
        batch_op.drop_column('qty_requested')

    with op.batch_alter_table('events', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('fk_events_target_branch_id_branches'), type_='foreignkey')
        batch_op.drop_column('target_branch_id')

    with op.batch_alter_table('branches', schema=None) as batch_op:
        batch_op.drop_column('token_version')

    with op.batch_alter_table('pairing_codes', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_pairing_codes_branch_id'))

    op.drop_table('pairing_codes')
    with op.batch_alter_table('audit_log', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_audit_log_shop_id'))
        batch_op.drop_index(batch_op.f('ix_audit_log_at'))

    op.drop_table('audit_log')
