"""zmh049_delivery_post_tasks_table

Revision ID: ba9dbfeb64fa
Revises: f4bf31dc707c
Create Date: 2026-06-27 12:21:37.922202

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ba9dbfeb64fa'
down_revision: Union[str, None] = 'f4bf31dc707c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'delivery_post_tasks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('delivery_id', sa.Integer(), sa.ForeignKey('delivery_orders.id'), nullable=False),
        sa.Column('item_id', sa.Integer(), sa.ForeignKey('delivery_order_items.id'), nullable=False),
        sa.Column('trang_thai', sa.String(30), server_default='cho_duyet', nullable=False),
        sa.Column('tinh_trang', sa.String(30), nullable=False),
        sa.Column('huong_xu_ly', sa.String(30), nullable=False),
        sa.Column('so_luong_cu', sa.Numeric(18, 3), nullable=False),
        sa.Column('so_luong_moi', sa.Numeric(18, 3), nullable=False),
        sa.Column('so_luong_bu_hao', sa.Numeric(18, 3), server_default='0', nullable=False),
        sa.Column('ghi_chu_sa', sa.Text(), nullable=True),
        sa.Column('ghi_chu_tp', sa.Text(), nullable=True),
        sa.Column('ghi_chu_kho', sa.Text(), nullable=True),
        sa.Column('created_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('approved_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('kho_confirmed_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('phap_nhan_id', sa.Integer(), sa.ForeignKey('phap_nhan.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('kho_confirmed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_dpt_delivery_id', 'delivery_post_tasks', ['delivery_id'])
    op.create_index('ix_dpt_trang_thai', 'delivery_post_tasks', ['trang_thai'])


def downgrade() -> None:
    op.drop_index('ix_dpt_trang_thai', table_name='delivery_post_tasks')
    op.drop_index('ix_dpt_delivery_id', table_name='delivery_post_tasks')
    op.drop_table('delivery_post_tasks')
