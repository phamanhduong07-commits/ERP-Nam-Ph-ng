"""quote_phap_nhan_sx

Revision ID: n1o2p3q4r5s6
Revises: m1n2o3p4q5r6
Create Date: 2026-05-08

"""
from alembic import op
import sqlalchemy as sa

revision = 'n1o2p3q4r5s6'
down_revision = 'm1n2o3p4q5r6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('quotes', sa.Column('phap_nhan_sx_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_quotes_phap_nhan_sx_id',
        'quotes', 'phap_nhan',
        ['phap_nhan_sx_id'], ['id']
    )


def downgrade():
    op.drop_constraint('fk_quotes_phap_nhan_sx_id', 'quotes', type_='foreignkey')
    op.drop_column('quotes', 'phap_nhan_sx_id')
