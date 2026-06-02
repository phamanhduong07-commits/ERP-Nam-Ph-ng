"""add quote_history table

Revision ID: add_quote_history
Revises: ib001_add_ton_luong_truoc
Create Date: 2026-06-02
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_quote_history'
down_revision = 'ib001_add_ton_luong_truoc'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'quote_history',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('quote_id', sa.Integer(), sa.ForeignKey('quotes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('changed_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('changed_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('action', sa.String(30), nullable=False),
        sa.Column('old_status', sa.String(30), nullable=True),
        sa.Column('new_status', sa.String(30), nullable=True),
        sa.Column('old_tong_cong', sa.Numeric(18, 2), nullable=True),
        sa.Column('new_tong_cong', sa.Numeric(18, 2), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
    )
    op.create_index('ix_quote_history_quote_id', 'quote_history', ['quote_id'])
    op.create_index('ix_quote_history_changed_at', 'quote_history', ['changed_at'])


def downgrade() -> None:
    op.drop_index('ix_quote_history_changed_at', table_name='quote_history')
    op.drop_index('ix_quote_history_quote_id', table_name='quote_history')
    op.drop_table('quote_history')
