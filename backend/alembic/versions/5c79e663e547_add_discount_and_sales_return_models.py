"""add_discount_and_sales_return_models

Revision ID: 5c79e663e547
Revises: j1k2l3m4n5o6
Create Date: 2026-05-06 00:22:16.922663

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5c79e663e547'
down_revision: Union[str, None] = 'j1k2l3m4n5o6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add discount columns to sales_orders
    op.add_column('sales_orders', sa.Column('ty_le_giam_gia', sa.Numeric(5, 2), nullable=False, server_default='0'))
    op.add_column('sales_orders', sa.Column('so_tien_giam_gia', sa.Numeric(18, 2), nullable=False, server_default='0'))
    op.add_column('sales_orders', sa.Column('tong_tien_sau_giam', sa.Numeric(18, 2), nullable=False, server_default='0'))

    # Add discount columns to sales_order_items
    op.add_column('sales_order_items', sa.Column('ty_le_giam_gia', sa.Numeric(5, 2), nullable=False, server_default='0'))
    op.add_column('sales_order_items', sa.Column('so_tien_giam_gia', sa.Numeric(18, 2), nullable=False, server_default='0'))

    # Create sales_returns table
    op.create_table('sales_returns',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('so_phieu_tra', sa.String(30), nullable=False),
        sa.Column('ngay_tra', sa.Date(), nullable=False),
        sa.Column('sales_order_id', sa.Integer(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('ly_do_tra', sa.Text(), nullable=False),
        sa.Column('trang_thai', sa.String(20), nullable=False, server_default='moi'),
        sa.Column('tong_tien_tra', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('approved_by', sa.Integer(), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('so_phieu_tra'),
        sa.ForeignKeyConstraint(['sales_order_id'], ['sales_orders.id']),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id'])
    )

    # Create sales_return_items table
    op.create_table('sales_return_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sales_return_id', sa.Integer(), nullable=False),
        sa.Column('sales_order_item_id', sa.Integer(), nullable=False),
        sa.Column('so_luong_tra', sa.Numeric(12, 3), nullable=False),
        sa.Column('don_gia_tra', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('ly_do_tra', sa.Text(), nullable=True),
        sa.Column('tinh_trang_hang', sa.String(50), nullable=False, server_default='tot'),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['sales_return_id'], ['sales_returns.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sales_order_item_id'], ['sales_order_items.id'])
    )


def downgrade() -> None:
    # Drop sales_return_items table
    op.drop_table('sales_return_items')

    # Drop sales_returns table
    op.drop_table('sales_returns')

    # Remove discount columns from sales_order_items
    op.drop_column('sales_order_items', 'so_tien_giam_gia')
    op.drop_column('sales_order_items', 'ty_le_giam_gia')

    # Remove discount columns from sales_orders
    op.drop_column('sales_orders', 'tong_tien_sau_giam')
    op.drop_column('sales_orders', 'so_tien_giam_gia')
    op.drop_column('sales_orders', 'ty_le_giam_gia')
