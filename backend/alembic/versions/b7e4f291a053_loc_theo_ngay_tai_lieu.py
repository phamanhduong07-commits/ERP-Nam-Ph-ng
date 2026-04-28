"""loc_theo_ngay_tai_lieu

Revision ID: b7e4f291a053
Revises: 5cab83b99737
Create Date: 2026-04-28 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7e4f291a053'
down_revision: Union[str, None] = '5cab83b99737'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index('ix_quotes_ngay_bao_gia', 'quotes', ['ngay_bao_gia'])
    op.create_index('ix_sales_orders_ngay_don', 'sales_orders', ['ngay_don'])
    op.create_index('ix_production_orders_ngay_lenh', 'production_orders', ['ngay_lenh'])


def downgrade() -> None:
    op.drop_index('ix_production_orders_ngay_lenh', table_name='production_orders')
    op.drop_index('ix_sales_orders_ngay_don', table_name='sales_orders')
    op.drop_index('ix_quotes_ngay_bao_gia', table_name='quotes')
