"""zmh048_add_tinh_trang_to_delivery_items

Revision ID: f4bf31dc707c
Revises: 7e47cb333037
Create Date: 2026-06-27 12:21:08.849403

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f4bf31dc707c'
down_revision: Union[str, None] = '7e47cb333037'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('delivery_order_items', sa.Column('tinh_trang_dieu_chinh', sa.String(50), nullable=True))
    op.add_column('delivery_order_items', sa.Column('huong_xu_ly_dieu_chinh', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('delivery_order_items', 'huong_xu_ly_dieu_chinh')
    op.drop_column('delivery_order_items', 'tinh_trang_dieu_chinh')
