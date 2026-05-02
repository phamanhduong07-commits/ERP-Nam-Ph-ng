"""phieu_nhap_phoi_warehouse_id

Revision ID: b1c2d3e4f5a6
Revises: 09797a29e0d7
Create Date: 2026-05-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = '09797a29e0d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='phieu_nhap_phoi_song' AND column_name='warehouse_id'"
    ))
    if result.fetchone() is None:
        op.add_column(
            'phieu_nhap_phoi_song',
            sa.Column('warehouse_id', sa.Integer(),
                      sa.ForeignKey('warehouses.id'), nullable=True)
        )


def downgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='phieu_nhap_phoi_song' AND column_name='warehouse_id'"
    ))
    if result.fetchone() is not None:
        op.drop_column('phieu_nhap_phoi_song', 'warehouse_id')
