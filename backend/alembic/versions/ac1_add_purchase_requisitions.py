"""add_purchase_requisitions

Revision ID: ac1_add_purchase_requisitions
Revises: ab1_add_da_dieu_chinh
Create Date: 2026-05-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'ac1_add_purchase_requisitions'
down_revision: Union[str, None] = 'ab1_add_da_dieu_chinh'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'purchase_requisitions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('so_ymh', sa.String(30), nullable=False, unique=True),
        sa.Column('ngay_yeu_cau', sa.Date(), nullable=False),
        sa.Column('phan_xuong_id', sa.Integer(), sa.ForeignKey('phan_xuong.id'), nullable=True),
        sa.Column('phap_nhan_id', sa.Integer(), sa.ForeignKey('phap_nhan.id'), nullable=True),
        sa.Column('trang_thai', sa.String(30), nullable=False, server_default='nhap'),
        sa.Column('nguoi_yeu_cau_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('nguoi_duyet_pb_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('nguoi_duyet_gd_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('ngay_duyet_pb', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ngay_duyet_gd', sa.DateTime(timezone=True), nullable=True),
        sa.Column('po_id', sa.Integer(), sa.ForeignKey('purchase_orders.id'), nullable=True),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    op.create_table(
        'purchase_requisition_items',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('ymh_id', sa.Integer(), sa.ForeignKey('purchase_requisitions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('paper_material_id', sa.Integer(), sa.ForeignKey('paper_materials.id'), nullable=True),
        sa.Column('other_material_id', sa.Integer(), sa.ForeignKey('other_materials.id'), nullable=True),
        sa.Column('ten_hang', sa.String(255), nullable=False, server_default=''),
        sa.Column('so_luong', sa.Numeric(12, 3), nullable=False),
        sa.Column('dvt', sa.String(20), nullable=False, server_default='Kg'),
        sa.Column('don_gia_du_kien', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('ngay_can', sa.Date(), nullable=True),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('purchase_requisition_items')
    op.drop_table('purchase_requisitions')
