"""add hr_leave_requests.so_tien

Revision ID: 23d284918194
Revises: 62a3aa0e609e
Create Date: 2026-06-12
"""
from alembic import op
import sqlalchemy as sa

revision = '23d284918194'
down_revision = '62a3aa0e609e'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('hr_leave_requests', sa.Column('so_tien', sa.Numeric(precision=18, scale=2), nullable=True))

def downgrade():
    op.drop_column('hr_leave_requests', 'so_tien')
