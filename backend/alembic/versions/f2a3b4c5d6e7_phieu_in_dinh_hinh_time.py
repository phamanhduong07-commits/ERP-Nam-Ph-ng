"""phieu_in dinh hinh time tracking

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-05-02
"""
from alembic import op
import sqlalchemy as sa

revision = 'f2a3b4c5d6e7'
down_revision = 'e1f2a3b4c5d6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    for col in ('gio_bat_dau_dinh_hinh', 'gio_hoan_thanh_dinh_hinh'):
        res = conn.execute(sa.text(
            "SELECT COUNT(*) FROM information_schema.columns "
            "WHERE table_name='phieu_in' AND column_name=:col"
        ), {"col": col})
        if res.scalar() == 0:
            op.add_column('phieu_in', sa.Column(col, sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('phieu_in', 'gio_hoan_thanh_dinh_hinh')
    op.drop_column('phieu_in', 'gio_bat_dau_dinh_hinh')
