"""add logo_path and mau_sac_chinh to phap_nhan

Revision ID: x1y2z3a4b5c6
Revises: w1x2y3z4a5b6
Create Date: 2026-05-12

"""
from alembic import op
import sqlalchemy as sa

revision = 'x1y2z3a4b5c6'
down_revision = 'w1x2y3z4a5b6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('phap_nhan', sa.Column('logo_path', sa.String(255), nullable=True))
    op.add_column('phap_nhan', sa.Column('mau_sac_chinh', sa.String(7), nullable=True))


def downgrade():
    op.drop_column('phap_nhan', 'mau_sac_chinh')
    op.drop_column('phap_nhan', 'logo_path')
