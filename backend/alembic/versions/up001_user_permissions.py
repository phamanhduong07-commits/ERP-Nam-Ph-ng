"""user_permissions table for per-user permission overrides

Revision ID: up001_user_permissions
Revises: zmh011
Create Date: 2026-06-03
"""
from alembic import op
import sqlalchemy as sa

revision = 'up001_user_permissions'
down_revision = 'zmh011'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'user_permissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('permission_id', sa.Integer(), sa.ForeignKey('permissions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('granted_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'permission_id', name='uq_user_permission'),
    )
    op.create_index('ix_user_permissions_user_id', 'user_permissions', ['user_id'])


def downgrade():
    op.drop_index('ix_user_permissions_user_id', 'user_permissions')
    op.drop_table('user_permissions')
