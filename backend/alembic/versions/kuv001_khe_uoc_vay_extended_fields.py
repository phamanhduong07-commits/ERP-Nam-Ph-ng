"""khe_uoc_vay_extended_fields

Revision ID: kuv001
Revises: 80d95c8e097e
Create Date: 2026-06-15 22:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'kuv001'
down_revision: Union[str, None] = '80d95c8e097e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Thông tin giải ngân
    op.add_column('khe_uoc_vay', sa.Column('hop_dong_tin_dung', sa.String(50), nullable=True))
    op.add_column('khe_uoc_vay', sa.Column('tk_no_goc', sa.String(20), nullable=True))
    op.add_column('khe_uoc_vay', sa.Column('tk_lai_vay', sa.String(20), nullable=True))
    op.add_column('khe_uoc_vay', sa.Column('loai_tien', sa.String(10), nullable=False,
                                            server_default='VND'))
    op.add_column('khe_uoc_vay', sa.Column('phuong_thuc_giai_ngan', sa.String(50), nullable=True))
    op.add_column('khe_uoc_vay', sa.Column('ten_ngan_hang_thu_huong', sa.String(200), nullable=True))
    # Lãi suất
    op.add_column('khe_uoc_vay', sa.Column('loai_lai_suat', sa.String(20), nullable=False,
                                            server_default='du_no_goc'))
    op.add_column('khe_uoc_vay', sa.Column('co_so_tinh_lai', sa.String(5), nullable=False,
                                            server_default='365'))
    op.add_column('khe_uoc_vay', sa.Column('phuong_thuc_dieu_chinh', sa.String(20), nullable=False,
                                            server_default='co_dinh'))
    op.add_column('khe_uoc_vay', sa.Column('lai_suat_qua_han', sa.Numeric(8, 4), nullable=False,
                                            server_default='0'))
    # Hình thức trả nợ
    op.add_column('khe_uoc_vay', sa.Column('ngay_tra_lai_dau_tien', sa.Date(), nullable=True))
    op.add_column('khe_uoc_vay', sa.Column('phuong_thuc_tra_no', sa.String(20), nullable=True))
    op.add_column('khe_uoc_vay', sa.Column('tai_khoan_chuyen_vao', sa.String(20), nullable=True))
    op.add_column('khe_uoc_vay', sa.Column('ten_ngan_hang_tra', sa.String(200), nullable=True))


def downgrade() -> None:
    for col in [
        'ten_ngan_hang_tra', 'tai_khoan_chuyen_vao', 'phuong_thuc_tra_no',
        'ngay_tra_lai_dau_tien', 'lai_suat_qua_han', 'phuong_thuc_dieu_chinh',
        'co_so_tinh_lai', 'loai_lai_suat', 'ten_ngan_hang_thu_huong',
        'phuong_thuc_giai_ngan', 'loai_tien', 'tk_lai_vay', 'tk_no_goc', 'hop_dong_tin_dung',
    ]:
        op.drop_column('khe_uoc_vay', col)
