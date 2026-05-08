"""add_purchase_returns_tables

Revision ID: k1l2m3n4o5p6
Revises: 5c79e663e547
Create Date: 2026-05-06 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'k1l2m3n4o5p6'
down_revision: Union[str, None] = '61a3b1c400c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Bảng phiếu trả hàng / giảm giá hàng mua
    op.create_table(
        'purchase_returns',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('so_phieu', sa.String(30), nullable=False),
        sa.Column('ngay', sa.Date(), nullable=False),
        sa.Column('supplier_id', sa.Integer(), nullable=False),
        sa.Column('po_id', sa.Integer(), nullable=True),
        sa.Column('gr_id', sa.Integer(), nullable=True),
        sa.Column('invoice_id', sa.Integer(), nullable=True),
        sa.Column('loai', sa.String(20), nullable=False, server_default='tra_hang'),
        sa.Column('ly_do', sa.String(500), nullable=True),
        sa.Column('thue_suat', sa.Numeric(5, 2), nullable=False, server_default='0'),
        sa.Column('tong_tien_hang', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('tien_thue', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('tong_thanh_toan', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('trang_thai', sa.String(20), nullable=False, server_default='nhap'),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('approved_by', sa.Integer(), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('so_phieu'),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id']),
        sa.ForeignKeyConstraint(['po_id'], ['purchase_orders.id']),
        sa.ForeignKeyConstraint(['gr_id'], ['goods_receipts.id']),
        sa.ForeignKeyConstraint(['invoice_id'], ['purchase_invoices.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id']),
    )
    op.create_index('ix_purchase_returns_supplier', 'purchase_returns', ['supplier_id'])
    op.create_index('ix_purchase_returns_ngay', 'purchase_returns', ['ngay'])

    # Bảng chi tiết phiếu trả hàng
    op.create_table(
        'purchase_return_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('return_id', sa.Integer(), nullable=False),
        sa.Column('paper_material_id', sa.Integer(), nullable=True),
        sa.Column('other_material_id', sa.Integer(), nullable=True),
        sa.Column('ten_hang', sa.String(255), nullable=False, server_default=''),
        sa.Column('so_luong', sa.Numeric(12, 3), nullable=False, server_default='0'),
        sa.Column('dvt', sa.String(20), nullable=False, server_default='Kg'),
        sa.Column('don_gia', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('thanh_tien', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['return_id'], ['purchase_returns.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['paper_material_id'], ['paper_materials.id']),
        sa.ForeignKeyConstraint(['other_material_id'], ['other_materials.id']),
    )
    op.create_index('ix_purchase_return_items_return', 'purchase_return_items', ['return_id'])


def downgrade() -> None:
    op.drop_table('purchase_return_items')
    op.drop_table('purchase_returns')
