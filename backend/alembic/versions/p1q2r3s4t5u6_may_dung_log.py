"""create may_dung_log table

Revision ID: p1q2r3s4t5u6
Revises: o1p2q3r4s5t6
Create Date: 2026-05-08
"""
from alembic import op
import sqlalchemy as sa

revision = 'p1q2r3s4t5u6'
down_revision = 'o1p2q3r4s5t6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'may_dung_log',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('production_order_id', sa.Integer, sa.ForeignKey('production_orders.id', ondelete='CASCADE'), nullable=False),
        sa.Column('phan_xuong_id', sa.Integer, sa.ForeignKey('phan_xuong.id'), nullable=True),
        sa.Column('ngay', sa.Date, nullable=False),
        sa.Column('gio_bat_dau_dung', sa.Time, nullable=False),
        sa.Column('gio_tiep_tuc', sa.Time, nullable=True),
        sa.Column('thoi_gian_dung', sa.Integer, nullable=True),
        sa.Column('ly_do', sa.String(30), nullable=False, server_default='khac'),
        sa.Column('ghi_chu', sa.Text, nullable=True),
        sa.Column('created_by', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_may_dung_log_production_order_id', 'may_dung_log', ['production_order_id'])
    op.create_index('ix_may_dung_log_ngay', 'may_dung_log', ['ngay'])


def downgrade():
    op.drop_index('ix_may_dung_log_ngay', 'may_dung_log')
    op.drop_index('ix_may_dung_log_production_order_id', 'may_dung_log')
    op.drop_table('may_dung_log')
