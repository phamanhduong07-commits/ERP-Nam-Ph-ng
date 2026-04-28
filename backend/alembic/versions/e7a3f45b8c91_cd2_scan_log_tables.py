"""cd2 scan log tables

Revision ID: e7a3f45b8c91
Revises: d5f2c19a8b34
Create Date: 2026-04-28

"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e7a3f45b8c91'
down_revision: Union[str, None] = 'd5f2c19a8b34'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'may_scan',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ten_may', sa.String(50), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('don_gia', sa.Numeric(12, 2), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'scan_log',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('may_scan_id', sa.Integer(), nullable=False),
        sa.Column('so_lsx', sa.String(50), nullable=False),
        sa.Column('ten_hang', sa.String(255), nullable=True),
        sa.Column('dai', sa.Numeric(10, 2), nullable=True),
        sa.Column('rong', sa.Numeric(10, 2), nullable=True),
        sa.Column('cao', sa.Numeric(10, 2), nullable=True),
        sa.Column('kho_tt', sa.Numeric(10, 2), nullable=True),
        sa.Column('dien_tich', sa.Numeric(14, 4), nullable=True),
        sa.Column('so_luong_tp', sa.Numeric(12, 3), nullable=False),
        sa.Column('don_gia', sa.Numeric(12, 2), nullable=True),
        sa.Column('tien_luong', sa.Numeric(14, 2), nullable=True),
        sa.Column('nguoi_sx', sa.String(100), nullable=True),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['may_scan_id'], ['may_scan.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_scan_log_may_scan_id', 'scan_log', ['may_scan_id'])
    op.create_index('ix_scan_log_so_lsx', 'scan_log', ['so_lsx'])
    op.create_index('ix_scan_log_created_at', 'scan_log', ['created_at'])


def downgrade() -> None:
    op.drop_table('scan_log')
    op.drop_table('may_scan')
