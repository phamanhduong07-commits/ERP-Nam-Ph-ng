"""add_danhmuc_modules

Revision ID: c3d4be76b4ff
Revises: zmh020
Create Date: 2026-06-09 21:43:40.379885

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c3d4be76b4ff'
down_revision: Union[str, None] = 'zmh020'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Danh mục mới ─────────────────────────────────────────────────────────
    op.create_table('bieu_thue_thu_nhap',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ten_bieu', sa.String(length=150), nullable=False),
        sa.Column('nam_ap_dung', sa.Integer(), nullable=False),
        sa.Column('loai', sa.String(length=30), nullable=False),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('trang_thai', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table('dieu_khoan_thanh_toan',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ma_dktt', sa.String(length=30), nullable=False),
        sa.Column('ten_dktt', sa.String(length=150), nullable=False),
        sa.Column('so_ngay', sa.Integer(), nullable=True),
        sa.Column('mo_ta', sa.Text(), nullable=True),
        sa.Column('trang_thai', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ma_dktt'),
    )
    op.create_table('khoan_muc_chi_phi',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ma_kmcp', sa.String(length=30), nullable=False),
        sa.Column('ten_kmcp', sa.String(length=150), nullable=False),
        sa.Column('loai_chi_phi', sa.String(length=30), nullable=True),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('trang_thai', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ma_kmcp'),
    )
    op.create_table('ky_hieu_cham_cong',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ky_hieu', sa.String(length=10), nullable=False),
        sa.Column('ten_ky_hieu', sa.String(length=100), nullable=False),
        sa.Column('loai', sa.String(length=20), nullable=False),
        sa.Column('he_so_cong', sa.Numeric(precision=4, scale=2), nullable=False),
        sa.Column('tinh_luong', sa.Boolean(), nullable=False),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('trang_thai', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ky_hieu'),
    )
    op.create_table('loai_tai_san_co_dinh',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ma_loai', sa.String(length=30), nullable=False),
        sa.Column('ten_loai', sa.String(length=150), nullable=False),
        sa.Column('ty_le_khau_hao', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('thoi_gian_sd', sa.Integer(), nullable=True),
        sa.Column('tk_nguyen_gia', sa.String(length=20), nullable=True),
        sa.Column('tk_hao_mon', sa.String(length=20), nullable=True),
        sa.Column('tk_khau_hao', sa.String(length=20), nullable=True),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('trang_thai', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ma_loai'),
    )
    op.create_table('muc_thu_chi',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ma_muc', sa.String(length=30), nullable=False),
        sa.Column('ten_muc', sa.String(length=150), nullable=False),
        sa.Column('loai', sa.String(length=20), nullable=False),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('trang_thai', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ma_muc'),
    )
    op.create_table('nhom_doi_tuong',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ma_nhom', sa.String(length=30), nullable=False),
        sa.Column('ten_nhom', sa.String(length=150), nullable=False),
        sa.Column('loai', sa.String(length=20), nullable=False),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('trang_thai', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ma_nhom'),
    )
    op.create_table('tai_khoan_ngam_dinh',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ma_loai', sa.String(length=60), nullable=False),
        sa.Column('ten_loai', sa.String(length=200), nullable=False),
        sa.Column('nhom', sa.String(length=50), nullable=False),
        sa.Column('so_tk', sa.String(length=20), nullable=True),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ma_loai'),
    )
    op.create_table('bieu_thue_thu_nhap_bac',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('bieu_id', sa.Integer(), nullable=False),
        sa.Column('bac', sa.Integer(), nullable=False),
        sa.Column('thu_nhap_tu', sa.Numeric(precision=18, scale=0), nullable=False),
        sa.Column('thu_nhap_den', sa.Numeric(precision=18, scale=0), nullable=True),
        sa.Column('ty_le_thue', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('so_tien_giam_tru', sa.Numeric(precision=18, scale=0), nullable=False),
        sa.ForeignKeyConstraint(['bieu_id'], ['bieu_thue_thu_nhap.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_bieu_thue_thu_nhap_bac_bieu_id'),
        'bieu_thue_thu_nhap_bac', ['bieu_id'], unique=False,
    )
    # ── Module bảo trì máy (maintenance) ─────────────────────────────────────
    op.create_table('machines_maintenance',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ma_may', sa.String(length=50), nullable=False),
        sa.Column('ten_may', sa.String(length=200), nullable=False),
        sa.Column('hang_sx', sa.String(length=100), nullable=True),
        sa.Column('nam_sx', sa.Integer(), nullable=True),
        sa.Column('phan_xuong_id', sa.Integer(), nullable=True),
        sa.Column('trang_thai', sa.String(length=20), nullable=False),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['phan_xuong_id'], ['phan_xuong.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ma_may'),
    )
    op.create_table('maintenance_schedules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('machine_id', sa.Integer(), nullable=False),
        sa.Column('loai_bao_tri', sa.String(length=100), nullable=False),
        sa.Column('chu_ky_ngay', sa.Integer(), nullable=False),
        sa.Column('ngay_bao_tri_gan_nhat', sa.Date(), nullable=True),
        sa.Column('ngay_bao_tri_tiep_theo', sa.Date(), nullable=True),
        sa.Column('trang_thai', sa.String(length=20), nullable=False),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['machine_id'], ['machines_maintenance.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table('maintenance_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('machine_id', sa.Integer(), nullable=False),
        sa.Column('schedule_id', sa.Integer(), nullable=True),
        sa.Column('loai', sa.String(length=20), nullable=False),
        sa.Column('ngay_bat_dau', sa.Date(), nullable=False),
        sa.Column('ngay_ket_thuc', sa.Date(), nullable=True),
        sa.Column('downtime_phut', sa.Integer(), nullable=False),
        sa.Column('mo_ta_su_co', sa.Text(), nullable=True),
        sa.Column('bien_phap_xu_ly', sa.Text(), nullable=True),
        sa.Column('chi_phi_vat_tu', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('chi_phi_nhan_cong', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('tong_chi_phi', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('phieu_chi_id', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['machine_id'], ['machines_maintenance.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['schedule_id'], ['maintenance_schedules.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    # ── Module QC ─────────────────────────────────────────────────────────────
    op.create_table('qc_sheets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('so_phieu', sa.String(length=30), nullable=False),
        sa.Column('loai', sa.String(length=20), nullable=False),
        sa.Column('ref_type', sa.String(length=50), nullable=True),
        sa.Column('ref_id', sa.Integer(), nullable=True),
        sa.Column('ngay', sa.Date(), nullable=False),
        sa.Column('nguoi_kiem_tra', sa.String(length=100), nullable=True),
        sa.Column('ket_qua', sa.String(length=20), nullable=True),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('phap_nhan_id', sa.Integer(), nullable=True),
        sa.Column('phan_xuong_id', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['phan_xuong_id'], ['phan_xuong.id']),
        sa.ForeignKeyConstraint(['phap_nhan_id'], ['phap_nhan.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('so_phieu'),
    )
    op.create_table('qc_defects',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('qc_sheet_id', sa.Integer(), nullable=False),
        sa.Column('loai_loi', sa.String(length=100), nullable=False),
        sa.Column('mo_ta', sa.Text(), nullable=True),
        sa.Column('so_luong_loi', sa.Integer(), nullable=False),
        sa.Column('hinh_anh_path', sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(['qc_sheet_id'], ['qc_sheets.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    # ── Module CRM ───────────────────────────────────────────────────────────
    op.create_table('customer_interactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('loai', sa.String(length=30), nullable=False),
        sa.Column('ngay', sa.Date(), nullable=False),
        sa.Column('noi_dung', sa.Text(), nullable=True),
        sa.Column('ket_qua', sa.String(length=20), nullable=True),
        sa.Column('ngay_nhac_nho', sa.Date(), nullable=True),
        sa.Column('nguoi_phu_trach_id', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['nguoi_phu_trach_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    # ── Module Tài sản cố định ────────────────────────────────────────────────
    op.create_table('depreciation_entries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('asset_id', sa.Integer(), nullable=False),
        sa.Column('ky', sa.String(length=7), nullable=False),
        sa.Column('so_tien_kh', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('gia_tri_da_kh_sau', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('journal_entry_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['asset_id'], ['fixed_assets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['journal_entry_id'], ['journal_entries.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('depreciation_entries')
    op.drop_table('customer_interactions')
    op.drop_table('qc_defects')
    op.drop_table('qc_sheets')
    op.drop_table('maintenance_logs')
    op.drop_table('maintenance_schedules')
    op.drop_table('machines_maintenance')
    op.drop_index(op.f('ix_bieu_thue_thu_nhap_bac_bieu_id'), table_name='bieu_thue_thu_nhap_bac')
    op.drop_table('bieu_thue_thu_nhap_bac')
    op.drop_table('bieu_thue_thu_nhap')
    op.drop_table('tai_khoan_ngam_dinh')
    op.drop_table('nhom_doi_tuong')
    op.drop_table('muc_thu_chi')
    op.drop_table('loai_tai_san_co_dinh')
    op.drop_table('ky_hieu_cham_cong')
    op.drop_table('khoan_muc_chi_phi')
    op.drop_table('dieu_khoan_thanh_toan')
