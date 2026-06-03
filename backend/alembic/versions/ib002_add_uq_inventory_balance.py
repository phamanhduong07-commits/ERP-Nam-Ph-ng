"""add unique constraint inventory balance

Revision ID: ib002
Revises: acclock001
Create Date: 2026-06-03
"""

from alembic import op
import sqlalchemy as sa


revision = "ib002"
down_revision = "acclock001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Xoá duplicate rows trước — giữ lại id lớn nhất cho mỗi tổ hợp khoá
    op.execute("""
        DELETE FROM inventory_balances
        WHERE id NOT IN (
            SELECT MAX(id) FROM inventory_balances
            GROUP BY warehouse_id,
                     COALESCE(paper_material_id, -1),
                     COALESCE(other_material_id, -1),
                     COALESCE(product_id, -1)
        )
    """)
    op.create_unique_constraint(
        'uq_inv_balance_item',
        'inventory_balances',
        ['warehouse_id', 'paper_material_id', 'other_material_id', 'product_id']
    )


def downgrade() -> None:
    op.drop_constraint('uq_inv_balance_item', 'inventory_balances', type_='unique')
