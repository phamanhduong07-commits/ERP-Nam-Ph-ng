"""add allocation_detail to production_sessions

Revision ID: zmh035
Revises: zmh034
Create Date: 2026-06-22
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh035'
down_revision = ('zmh034', 'c06640407024')
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('production_sessions') as batch_op:
        batch_op.add_column(sa.Column('allocation_detail', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('production_sessions') as batch_op:
        batch_op.drop_column('allocation_detail')
