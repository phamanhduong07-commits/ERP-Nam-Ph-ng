"""add phap_nhan_id to opening_balances and customer_refund_vouchers

Revision ID: w1x2y3z4a5b6
Revises: v1w2x3y4z5a6
Create Date: 2026-05-11

"""
from alembic import op
import sqlalchemy as sa

revision = 'w1x2y3z4a5b6'
down_revision = 'v1w2x3y4z5a6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('opening_balances',
        sa.Column('phap_nhan_id', sa.Integer(), nullable=True))
    op.create_index('ix_opening_balances_phap_nhan_id',
        'opening_balances', ['phap_nhan_id'])
    op.create_foreign_key(
        'fk_opening_balances_phap_nhan',
        'opening_balances', 'phap_nhan',
        ['phap_nhan_id'], ['id'])

    op.add_column('customer_refund_vouchers',
        sa.Column('phap_nhan_id', sa.Integer(), nullable=True))
    op.create_index('ix_customer_refund_vouchers_phap_nhan_id',
        'customer_refund_vouchers', ['phap_nhan_id'])
    op.create_foreign_key(
        'fk_customer_refund_vouchers_phap_nhan',
        'customer_refund_vouchers', 'phap_nhan',
        ['phap_nhan_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_customer_refund_vouchers_phap_nhan',
        'customer_refund_vouchers', type_='foreignkey')
    op.drop_index('ix_customer_refund_vouchers_phap_nhan_id',
        table_name='customer_refund_vouchers')
    op.drop_column('customer_refund_vouchers', 'phap_nhan_id')

    op.drop_constraint('fk_opening_balances_phap_nhan',
        'opening_balances', type_='foreignkey')
    op.drop_index('ix_opening_balances_phap_nhan_id',
        table_name='opening_balances')
    op.drop_column('opening_balances', 'phap_nhan_id')
