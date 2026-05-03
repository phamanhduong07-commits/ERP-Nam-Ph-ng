"""phap_nhan phoi_phan_xuong_id

Revision ID: e1a2b3c4d5f6
Revises: d4e5f6a7b8c9
Create Date: 2026-05-03
"""
from alembic import op
import sqlalchemy as sa

revision = 'e1a2b3c4d5f6'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    res = conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='phap_nhan' AND column_name='phoi_phan_xuong_id'"
    ))
    if not res.fetchone():
        op.add_column('phap_nhan', sa.Column(
            'phoi_phan_xuong_id', sa.Integer(),
            sa.ForeignKey('phan_xuong.id'),
            nullable=True,
        ))


def downgrade():
    op.drop_column('phap_nhan', 'phoi_phan_xuong_id')
