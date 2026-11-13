"""الجداول الأولى: المحلات، الفروع، سجل الأحداث، التحويلات، الملخصات اليومية

Revision ID: 0001
Revises: 
Create Date: 2026-11-13 02:14:08.391625
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0001'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('shops',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('last_seq', sa.BigInteger(), nullable=False),
    sa.Column('last_transfer_no', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_shops'))
    )
    op.create_table('branches',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('shop_id', sa.String(length=36), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('code', sa.String(length=12), nullable=False),
    sa.Column('secret_hash', sa.String(length=64), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('last_pushed_seq', sa.BigInteger(), nullable=False),
    sa.Column('acked_seq', sa.BigInteger(), nullable=False),
    sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], name=op.f('fk_branches_shop_id_shops')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_branches')),
    sa.UniqueConstraint('shop_id', 'code', name='uq_branches_shop_code')
    )
    op.create_index(op.f('ix_branches_shop_id'), 'branches', ['shop_id'], unique=False)

    op.create_table('daily_stats',
    sa.Column('branch_id', sa.String(length=36), nullable=False),
    sa.Column('day', sa.Date(), nullable=False),
    sa.Column('shop_id', sa.String(length=36), nullable=False),
    sa.Column('data', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], name=op.f('fk_daily_stats_branch_id_branches')),
    sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], name=op.f('fk_daily_stats_shop_id_shops')),
    sa.PrimaryKeyConstraint('branch_id', 'day', name=op.f('pk_daily_stats'))
    )
    op.create_index(op.f('ix_daily_stats_shop_id'), 'daily_stats', ['shop_id'], unique=False)

    op.create_table('events',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('shop_id', sa.String(length=36), nullable=False),
    sa.Column('branch_id', sa.String(length=36), nullable=False),
    sa.Column('seq', sa.BigInteger(), nullable=False),
    sa.Column('entity', sa.String(length=40), nullable=False),
    sa.Column('entity_id', sa.String(length=64), nullable=False),
    sa.Column('op', sa.String(length=16), nullable=False),
    sa.Column('payload', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('base_version', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('received_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], name=op.f('fk_events_branch_id_branches')),
    sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], name=op.f('fk_events_shop_id_shops')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_events')),
    sa.UniqueConstraint('shop_id', 'seq', name='uq_events_shop_seq')
    )
    op.create_index('ix_events_entity', 'events', ['shop_id', 'entity', 'entity_id'], unique=False)

    op.create_table('transfers',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('shop_id', sa.String(length=36), nullable=False),
    sa.Column('number', sa.Integer(), nullable=False),
    sa.Column('from_branch_id', sa.String(length=36), nullable=False),
    sa.Column('to_branch_id', sa.String(length=36), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('note', sa.String(length=300), nullable=True),
    sa.Column('receive_note', sa.String(length=300), nullable=True),
    sa.Column('sent_by', sa.String(length=80), nullable=True),
    sa.Column('received_by', sa.String(length=80), nullable=True),
    sa.Column('sent_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('received_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['from_branch_id'], ['branches.id'], name=op.f('fk_transfers_from_branch_id_branches')),
    sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], name=op.f('fk_transfers_shop_id_shops')),
    sa.ForeignKeyConstraint(['to_branch_id'], ['branches.id'], name=op.f('fk_transfers_to_branch_id_branches')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_transfers')),
    sa.UniqueConstraint('shop_id', 'number', name='uq_transfers_shop_number')
    )
    op.create_index('ix_transfers_from', 'transfers', ['from_branch_id', 'status'], unique=False)
    op.create_index('ix_transfers_to', 'transfers', ['to_branch_id', 'status'], unique=False)

    op.create_table('transfer_lines',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('transfer_id', sa.String(length=36), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('product_id', sa.String(length=36), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('unit', sa.String(length=30), nullable=False),
    sa.Column('qty_sent', sa.BigInteger(), nullable=False),
    sa.Column('qty_received', sa.BigInteger(), nullable=True),
    sa.Column('unit_cost', sa.BigInteger(), nullable=False),
    sa.Column('batch_no', sa.String(length=40), nullable=True),
    sa.Column('expiry_date', sa.Date(), nullable=True),
    sa.ForeignKeyConstraint(['transfer_id'], ['transfers.id'], name=op.f('fk_transfer_lines_transfer_id_transfers')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_transfer_lines'))
    )
    op.create_index(op.f('ix_transfer_lines_transfer_id'), 'transfer_lines', ['transfer_id'], unique=False)



def downgrade() -> None:
    op.drop_index(op.f('ix_transfer_lines_transfer_id'), table_name='transfer_lines')

    op.drop_table('transfer_lines')
    op.drop_index('ix_transfers_to', table_name='transfers')
    op.drop_index('ix_transfers_from', table_name='transfers')

    op.drop_table('transfers')
    op.drop_index('ix_events_entity', table_name='events')

    op.drop_table('events')
    op.drop_index(op.f('ix_daily_stats_shop_id'), table_name='daily_stats')

    op.drop_table('daily_stats')
    op.drop_index(op.f('ix_branches_shop_id'), table_name='branches')

    op.drop_table('branches')
    op.drop_table('shops')
