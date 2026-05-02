"""phieu_in time tracking: gio_bat_dau_in, gio_hoan_thanh

Revision ID: e1f2a3b4c5d6
Revises: 8b5a8d8f675a
Create Date: 2026-05-02
"""
from alembic import op
import sqlalchemy as sa

revision = 'e1f2a3b4c5d6'
down_revision = '8b5a8d8f675a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    for col in ('gio_bat_dau_in', 'gio_hoan_thanh'):
        res = conn.execute(sa.text(
            "SELECT COUNT(*) FROM information_schema.columns "
            "WHERE table_name='phieu_in' AND column_name=:col"
        ), {"col": col})
        if res.scalar() == 0:
            op.add_column('phieu_in', sa.Column(col, sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('phieu_in', 'gio_hoan_thanh')
    op.drop_column('phieu_in', 'gio_bat_dau_in')
