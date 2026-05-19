"""add gio_bat_dau gio_ket_thuc to scan_log

Revision ID: sl001_scan_log_times
Revises: ms001_add_loai_to_may_scan
Create Date: 2026-05-19

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'sl001_scan_log_times'
down_revision: Union[str, None] = 'ms001_add_loai_to_may_scan'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('scan_log', sa.Column('gio_bat_dau', sa.DateTime(timezone=True), nullable=True))
    op.add_column('scan_log', sa.Column('gio_ket_thuc', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('scan_log', 'gio_ket_thuc')
    op.drop_column('scan_log', 'gio_bat_dau')
