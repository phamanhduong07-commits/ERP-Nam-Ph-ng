"""add phap_nhan_id and phan_xuong_id to users

Revision ID: usr001
Revises: hdt002
Create Date: 2026-05-25
"""
from alembic import op
import sqlalchemy as sa

revision = 'usr001'
down_revision = 'hdt002'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('phap_nhan_id', sa.Integer(), sa.ForeignKey('phap_nhan.id'), nullable=True))
    op.add_column('users', sa.Column('phan_xuong_id', sa.Integer(), sa.ForeignKey('phan_xuong.id'), nullable=True))


def downgrade():
    op.drop_column('users', 'phan_xuong_id')
    op.drop_column('users', 'phap_nhan_id')
