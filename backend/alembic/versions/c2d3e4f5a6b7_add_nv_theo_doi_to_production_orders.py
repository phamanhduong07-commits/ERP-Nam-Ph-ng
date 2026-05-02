"""add_nv_theo_doi_to_production_orders

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-05-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c2d3e4f5a6b7'
down_revision: Union[str, None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='production_orders' AND column_name='nv_theo_doi_id'"
    ))
    if result.fetchone() is None:
        op.add_column(
            'production_orders',
            sa.Column('nv_theo_doi_id', sa.Integer(),
                      sa.ForeignKey('users.id'), nullable=True)
        )


def downgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='production_orders' AND column_name='nv_theo_doi_id'"
    ))
    if result.fetchone() is not None:
        op.drop_column('production_orders', 'nv_theo_doi_id')
