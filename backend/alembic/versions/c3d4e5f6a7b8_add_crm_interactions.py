"""add customer_interactions table

Revision ID: c3d4e5f6a7b8
Revises: maint001
Create Date: 2026-05-19
"""
from alembic import op
import sqlalchemy as sa

revision = 'c3d4e5f6a7b8'
down_revision = 'maint001'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'customer_interactions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('customer_id', sa.Integer(), sa.ForeignKey('customers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('loai', sa.String(30), nullable=False),
        sa.Column('ngay', sa.Date(), nullable=False),
        sa.Column('noi_dung', sa.Text(), nullable=True),
        sa.Column('ket_qua', sa.String(20), nullable=True),
        sa.Column('ngay_nhac_nho', sa.Date(), nullable=True),
        sa.Column('nguoi_phu_trach_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_ci_customer_ngay', 'customer_interactions', ['customer_id', 'ngay'])


def downgrade():
    op.drop_index('ix_ci_customer_ngay', 'customer_interactions')
    op.drop_table('customer_interactions')
