"""add_is_lo_xe_to_employees

Revision ID: emp001
Revises: qv002
Create Date: 2026-06-26
"""
from alembic import op
import sqlalchemy as sa

revision = 'emp001'
down_revision = 'qv002'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('hr_employees', sa.Column('is_lo_xe', sa.Boolean(), nullable=False, server_default='false'))


def downgrade():
    op.drop_column('hr_employees', 'is_lo_xe')
