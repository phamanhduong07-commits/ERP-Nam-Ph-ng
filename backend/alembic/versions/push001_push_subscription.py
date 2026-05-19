"""push_subscription table

Revision ID: push001
Revises:
Create Date: 2026-05-19
"""
from alembic import op
import sqlalchemy as sa

revision = 'push001'
down_revision = 'sl001_scan_log_times'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'push_subscription',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('endpoint', sa.Text(), nullable=False, unique=True),
        sa.Column('p256dh', sa.Text(), nullable=False),
        sa.Column('auth', sa.String(255), nullable=False),
        sa.Column('may_in_id', sa.Integer(), nullable=True),
        sa.Column('may_sau_in_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table('push_subscription')
