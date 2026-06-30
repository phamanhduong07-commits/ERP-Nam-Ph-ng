"""add tai_san_in and tai_san_in_san_pham tables

Revision ID: zmh052
Revises: zmh051
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh052'
down_revision = 'zmh051'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'tai_san_in',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('ma_tai_san', sa.String(30), unique=True, nullable=False),
        sa.Column('loai', sa.String(20), nullable=False),
        sa.Column('mo_ta', sa.String(300), nullable=True),
        sa.Column('customer_id', sa.Integer(), sa.ForeignKey('customers.id'), nullable=False),
        sa.Column('nguoi_chi_tra', sa.String(20), nullable=False, server_default='khach_hang'),
        sa.Column('gia_tri', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('purchase_order_id', sa.Integer(), sa.ForeignKey('purchase_orders.id'), nullable=True),
        sa.Column('sales_order_thu_id', sa.Integer(), sa.ForeignKey('sales_orders.id'), nullable=True),
        sa.Column('da_thu_tien', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('san_luong_dinh_muc_hoan', sa.Numeric(14, 0), nullable=True),
        sa.Column('da_hoan_tien', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('cash_payment_hoan_id', sa.Integer(), sa.ForeignKey('cash_payments.id'), nullable=True),
        sa.Column('ngay_tao', sa.Date(), nullable=False),
        sa.Column('trang_thai', sa.String(20), nullable=False, server_default='cho_mua'),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('ix_tai_san_in_customer_id', 'tai_san_in', ['customer_id'])
    op.create_index('ix_tai_san_in_purchase_order_id', 'tai_san_in', ['purchase_order_id'])
    op.create_index('ix_tai_san_in_sales_order_thu_id', 'tai_san_in', ['sales_order_thu_id'])

    op.create_table(
        'tai_san_in_san_pham',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tai_san_id', sa.Integer(), sa.ForeignKey('tai_san_in.id', ondelete='CASCADE'), nullable=False),
        sa.Column('san_pham_id', sa.Integer(), sa.ForeignKey('products.id'), nullable=False),
        sa.Column('ghi_chu', sa.String(300), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.UniqueConstraint('tai_san_id', 'san_pham_id', name='uq_tai_san_san_pham'),
    )
    op.create_index('ix_tai_san_in_sp_tai_san_id', 'tai_san_in_san_pham', ['tai_san_id'])
    op.create_index('ix_tai_san_in_sp_san_pham_id', 'tai_san_in_san_pham', ['san_pham_id'])


def downgrade():
    op.drop_table('tai_san_in_san_pham')
    op.drop_table('tai_san_in')
