"""phan_xuong phoi_tu_phan_xuong_id

Revision ID: d4e5f6a7b8c9
Revises: c1d2e3f4a5b6
Create Date: 2026-05-03
"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6a7b8c9'
down_revision = 'c1d2e3f4a5b6'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    res = conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='phan_xuong' AND column_name='phoi_tu_phan_xuong_id'"
    ))
    if not res.fetchone():
        op.add_column('phan_xuong', sa.Column(
            'phoi_tu_phan_xuong_id', sa.Integer(),
            sa.ForeignKey('phan_xuong.id'),
            nullable=True,
        ))


def downgrade():
    op.drop_column('phan_xuong', 'phoi_tu_phan_xuong_id')
