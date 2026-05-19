"""add phieu_in_state_log table

Revision ID: ngung003_phieu_in_state_log
Revises: ngung002_add_phieu_goc_id
Create Date: 2026-05-18 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'ngung003_phieu_in_state_log'
down_revision: Union[str, None] = 'ngung002_add_phieu_goc_id'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'phieu_in_state_log',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('phieu_in_id', sa.Integer(), sa.ForeignKey('phieu_in.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tu_trang_thai', sa.String(30), nullable=True),
        sa.Column('den_trang_thai', sa.String(30), nullable=False),
        sa.Column('hanh_dong', sa.String(50), nullable=False),
        sa.Column('changed_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('changed_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
    )
    op.create_index('ix_phieu_in_state_log_phieu_in_id', 'phieu_in_state_log', ['phieu_in_id'])
    op.create_index('ix_phieu_in_state_log_changed_at', 'phieu_in_state_log', ['changed_at'])


def downgrade() -> None:
    op.drop_index('ix_phieu_in_state_log_changed_at', table_name='phieu_in_state_log')
    op.drop_index('ix_phieu_in_state_log_phieu_in_id', table_name='phieu_in_state_log')
    op.drop_table('phieu_in_state_log')
