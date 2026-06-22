"""add_production_sessions_and_allocation

Revision ID: c06640407024
Revises: 499c0678b168
Create Date: 2026-06-22 12:31:28.192039

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c06640407024'
down_revision: Union[str, None] = '499c0678b168'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Tạo bảng production_sessions
    op.create_table(
        'production_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ten_phien', sa.String(length=100), nullable=False),
        sa.Column('ngay_tao', sa.Date(), nullable=False),
        sa.Column('trang_thai', sa.String(length=20), nullable=False, server_default='dang_chay'),
        sa.Column('so_kg_hao_hut_chung', sa.Numeric(precision=10, scale=3), nullable=False, server_default='0'),
        sa.Column('phan_xuong_id', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('closed_by', sa.Integer(), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['closed_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['phan_xuong_id'], ['phan_xuong.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # 2. Tạo bảng production_session_rolls
    op.create_table(
        'production_session_rolls',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('giay_roll_id', sa.Integer(), nullable=False),
        sa.Column('trong_luong_dau', sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column('trong_luong_cuoi', sa.Numeric(precision=12, scale=3), nullable=True),
        sa.Column('trong_luong_tieu_hao', sa.Numeric(precision=12, scale=3), nullable=True),
        sa.Column('ngay_can', sa.DateTime(timezone=True), nullable=True),
        sa.Column('can_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['can_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['giay_roll_id'], ['giay_rolls.id'], ),
        sa.ForeignKeyConstraint(['session_id'], ['production_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 3. Tạo bảng production_session_materials
    op.create_table(
        'production_session_materials',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('other_material_id', sa.Integer(), nullable=False),
        sa.Column('so_luong', sa.Numeric(precision=12, scale=3), nullable=False, server_default='0'),
        sa.Column('don_gia', sa.Numeric(precision=18, scale=2), nullable=False, server_default='0'),
        sa.Column('thanh_tien', sa.Numeric(precision=18, scale=2), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['other_material_id'], ['other_materials.id'], ),
        sa.ForeignKeyConstraint(['session_id'], ['production_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 4. Tạo bảng production_session_paper_wastes
    op.create_table(
        'production_session_paper_wastes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('flute_type', sa.String(length=10), nullable=False),
        sa.Column('so_kg_hao_hut', sa.Numeric(precision=10, scale=3), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['session_id'], ['production_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 5. Thêm cột session_id vào phieu_nhap_phoi_song
    op.add_column('phieu_nhap_phoi_song', sa.Column('session_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_phieu_nhap_phoi_song_session',
        'phieu_nhap_phoi_song', 'production_sessions',
        ['session_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    # 1. Xóa foreign key và cột session_id trong phieu_nhap_phoi_song
    op.drop_constraint('fk_phieu_nhap_phoi_song_session', 'phieu_nhap_phoi_song', type_='foreignkey')
    op.drop_column('phieu_nhap_phoi_song', 'session_id')

    # 2. Xóa các bảng
    op.drop_table('production_session_paper_wastes')
    op.drop_table('production_session_materials')
    op.drop_table('production_session_rolls')
    op.drop_table('production_sessions')
