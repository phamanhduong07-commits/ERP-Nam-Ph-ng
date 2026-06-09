"""create tieu_chuan_ky_thuat catalog and add FK to materials

Revision ID: zmh020
Revises: zmh019
Create Date: 2026-06-09
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh020'
down_revision = 'zmh019'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'tieu_chuan_ky_thuat',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('ma_tc', sa.String(50), nullable=False, unique=True),
        sa.Column('ten', sa.String(255), nullable=False),
        sa.Column('mo_ta', sa.Text(), nullable=True),
        sa.Column('ap_dung_cho', sa.String(20), nullable=False, server_default='tat_ca'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.add_column('paper_materials',
        sa.Column('tieu_chuan_id', sa.Integer(),
                  sa.ForeignKey('tieu_chuan_ky_thuat.id', ondelete='SET NULL'), nullable=True))
    op.add_column('other_materials',
        sa.Column('tieu_chuan_id', sa.Integer(),
                  sa.ForeignKey('tieu_chuan_ky_thuat.id', ondelete='SET NULL'), nullable=True))


def downgrade() -> None:
    op.drop_column('other_materials', 'tieu_chuan_id')
    op.drop_column('paper_materials', 'tieu_chuan_id')
    op.drop_table('tieu_chuan_ky_thuat')
