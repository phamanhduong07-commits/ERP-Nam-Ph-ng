"""add_delivery_order_id_to_sales_returns

Revision ID: 61a3b1c400c7
Revises: 5c79e663e547
Create Date: 2026-05-06 00:32:44.754276

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '61a3b1c400c7'
down_revision: Union[str, None] = '5c79e663e547'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add delivery_order_id column to sales_returns table
    op.add_column('sales_returns', sa.Column('delivery_order_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_sales_returns_delivery_order_id',
        'sales_returns',
        'delivery_orders',
        ['delivery_order_id'],
        ['id']
    )


def downgrade() -> None:
    # Remove delivery_order_id column from sales_returns table
    op.drop_constraint('fk_sales_returns_delivery_order_id', 'sales_returns', type_='foreignkey')
    op.drop_column('sales_returns', 'delivery_order_id')
