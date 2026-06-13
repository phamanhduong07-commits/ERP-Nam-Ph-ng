"""add sales_targets table

Revision ID: zmh024
Revises: zmh023
Create Date: 2026-06-13
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh024'
down_revision = 'a7f3e1b2c891'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'sales_targets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('phan_xuong_id', sa.Integer(), sa.ForeignKey('phan_xuong.id'), nullable=True),
        sa.Column('thang', sa.Date(), nullable=False),
        sa.Column('muc_tieu', sa.Numeric(18, 2), nullable=False),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'phan_xuong_id', 'thang', name='uq_sales_target_user_xuong_thang'),
    )
    op.create_index('ix_sales_targets_thang', 'sales_targets', ['thang'])
    op.create_index('ix_sales_targets_user_id', 'sales_targets', ['user_id'])


def downgrade():
    op.drop_index('ix_sales_targets_user_id', table_name='sales_targets')
    op.drop_index('ix_sales_targets_thang', table_name='sales_targets')
    op.drop_table('sales_targets')
