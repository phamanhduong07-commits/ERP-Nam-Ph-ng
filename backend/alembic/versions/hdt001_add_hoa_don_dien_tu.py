"""add hoa_don_dien_tu table

Revision ID: hdt001
Revises: so001
Create Date: 2026-05-24 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'hdt001'
down_revision: Union[str, None] = 'so001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'hoa_don_dien_tu',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('so_hoa_don', sa.String(50), nullable=True),
        sa.Column('ky_hieu', sa.String(20), nullable=True),
        sa.Column('mau_so', sa.String(20), nullable=True),
        sa.Column('ngay_lap', sa.Date(), nullable=False),
        sa.Column('loai_hd', sa.String(5), server_default='1'),
        sa.Column('sales_order_id', sa.Integer(), sa.ForeignKey('sales_orders.id'), nullable=True),
        sa.Column('customer_id', sa.Integer(), sa.ForeignKey('customers.id'), nullable=True),
        sa.Column('ten_khach_hang', sa.String(255), nullable=False),
        sa.Column('ma_so_thue_kh', sa.String(20), nullable=True),
        sa.Column('dia_chi_kh', sa.Text(), nullable=True),
        sa.Column('tong_tien_hang', sa.Numeric(18, 2), nullable=False),
        sa.Column('tien_thue_gtgt', sa.Numeric(18, 2), server_default='0'),
        sa.Column('tong_cong', sa.Numeric(18, 2), nullable=False),
        sa.Column('trang_thai', sa.String(30), server_default='nhap'),
        sa.Column('misa_id', sa.String(100), nullable=True),
        sa.Column('ma_cqt', sa.String(100), nullable=True),
        sa.Column('xml_url', sa.Text(), nullable=True),
        sa.Column('pdf_url', sa.Text(), nullable=True),
        sa.Column('ly_do_huy', sa.Text(), nullable=True),
        sa.Column('items', sa.JSON(), nullable=True),
        sa.Column('phap_nhan_id', sa.Integer(), sa.ForeignKey('phap_nhan.id'), nullable=True),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_hoa_don_dien_tu_trang_thai', 'hoa_don_dien_tu', ['trang_thai'])
    op.create_index('ix_hoa_don_dien_tu_ngay_lap', 'hoa_don_dien_tu', ['ngay_lap'])


def downgrade() -> None:
    op.drop_index('ix_hoa_don_dien_tu_ngay_lap', 'hoa_don_dien_tu')
    op.drop_index('ix_hoa_don_dien_tu_trang_thai', 'hoa_don_dien_tu')
    op.drop_table('hoa_don_dien_tu')
