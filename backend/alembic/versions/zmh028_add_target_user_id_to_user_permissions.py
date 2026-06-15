"""add target_user_id to user_permissions

Revision ID: zmh028
Revises: zmh027
Create Date: 2026-06-15

"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh028'
down_revision = '4c417f72597c'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'user_permissions',
        sa.Column('target_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
    )


def downgrade():
    op.drop_column('user_permissions', 'target_user_id')
