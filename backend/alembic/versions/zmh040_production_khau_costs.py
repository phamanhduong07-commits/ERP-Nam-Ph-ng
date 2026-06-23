"""production_khau_costs: chi phi gia cong khau converting per m2

Revision ID: zmh040
Revises: zmh039
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh040'
down_revision = 'zmh039'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'production_khau_costs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('production_order_item_id', sa.Integer(),
                  sa.ForeignKey('production_order_items.id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('addon_rate_id', sa.Integer(),
                  sa.ForeignKey('addon_rates.id', ondelete='SET NULL'),
                  nullable=True),
        sa.Column('khau', sa.String(50), nullable=False),
        sa.Column('don_gia_m2', sa.Numeric(10, 2), nullable=False),
        sa.Column('dien_tich', sa.Numeric(12, 6), nullable=False),
        sa.Column('thanh_tien', sa.Numeric(18, 2), nullable=False),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        'ix_production_khau_costs_poi',
        'production_khau_costs',
        ['production_order_item_id'],
    )


def downgrade():
    op.drop_index('ix_production_khau_costs_poi', 'production_khau_costs')
    op.drop_table('production_khau_costs')
