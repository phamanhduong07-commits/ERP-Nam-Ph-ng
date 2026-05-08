"""add phan_xuong_id and phap_nhan_id to journal_entry_lines

Revision ID: r1s2t3u4v5w6
Revises: q1r2s3t4u5v6
Create Date: 2026-05-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'r1s2t3u4v5w6'
down_revision = 'q1r2s3t4u5v6'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    insp = inspect(conn)
    existing_cols = {c['name'] for c in insp.get_columns('journal_entry_lines')}

    if 'phap_nhan_id' not in existing_cols:
        op.add_column('journal_entry_lines',
            sa.Column('phap_nhan_id', sa.Integer(), sa.ForeignKey('phap_nhan.id'), nullable=True))

    if 'phan_xuong_id' not in existing_cols:
        op.add_column('journal_entry_lines',
            sa.Column('phan_xuong_id', sa.Integer(), sa.ForeignKey('phan_xuong.id'), nullable=True))


def downgrade():
    conn = op.get_bind()
    insp = inspect(conn)
    existing_cols = {c['name'] for c in insp.get_columns('journal_entry_lines')}
    for col in ('phan_xuong_id', 'phap_nhan_id'):
        if col in existing_cols:
            op.drop_column('journal_entry_lines', col)
