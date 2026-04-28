"""cd2 update phieu_in fields

Revision ID: d5f2c19a8b34
Revises: c3a1d84e9f20
Create Date: 2026-04-28

"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd5f2c19a8b34'
down_revision: Union[str, None] = 'c3a1d84e9f20'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Thêm các trường kỹ thuật từ CD2
    op.add_column('phieu_in', sa.Column('ths', sa.String(20), nullable=True))          # loại sóng: B, C, C-B
    op.add_column('phieu_in', sa.Column('pp_ghep', sa.String(50), nullable=True))      # Dán, Đóng Ghim
    op.add_column('phieu_in', sa.Column('ghi_chu_printer', sa.Text(), nullable=True))
    op.add_column('phieu_in', sa.Column('ghi_chu_prepare', sa.Text(), nullable=True))
    op.add_column('phieu_in', sa.Column('loai', sa.String(50), nullable=True))         # Thùng, Hộp...

    # Kết quả in chi tiết hơn
    op.add_column('phieu_in', sa.Column('so_luong_setup', sa.Numeric(12, 3), nullable=True))
    op.add_column('phieu_in', sa.Column('so_lan_setup', sa.Integer(), nullable=True))

    # Kết quả sau in
    op.add_column('phieu_in', sa.Column('so_luong_sau_in_ok', sa.Numeric(12, 3), nullable=True))
    op.add_column('phieu_in', sa.Column('so_luong_sau_in_loi', sa.Numeric(12, 3), nullable=True))
    op.add_column('phieu_in', sa.Column('ca_sau_in', sa.String(20), nullable=True))
    op.add_column('phieu_in', sa.Column('ghi_chu_sau_in', sa.Text(), nullable=True))
    op.add_column('phieu_in', sa.Column('ngay_sau_in', sa.Date(), nullable=True))


def downgrade() -> None:
    for col in [
        'ths', 'pp_ghep', 'ghi_chu_printer', 'ghi_chu_prepare', 'loai',
        'so_luong_setup', 'so_lan_setup',
        'so_luong_sau_in_ok', 'so_luong_sau_in_loi', 'ca_sau_in',
        'ghi_chu_sau_in', 'ngay_sau_in',
    ]:
        op.drop_column('phieu_in', col)
