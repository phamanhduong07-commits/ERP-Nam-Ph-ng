"""add detailed HR payroll fields

Revision ID: t1u2v3w4x5y7
Revises: z1a2b3c4d5e6
Create Date: 2026-05-16
"""
from alembic import op


revision = "t1u2v3w4x5y7"
down_revision = "z1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for column in [
        "phu_cap_chuyen_can NUMERIC(18,2) DEFAULT 0",
        "phu_cap_trach_nhiem NUMERIC(18,2) DEFAULT 0",
        "phu_cap_nha_o_com NUMERIC(18,2) DEFAULT 0",
        "phu_cap_dien_thoai NUMERIC(18,2) DEFAULT 0",
        "phu_cap_khac NUMERIC(18,2) DEFAULT 0",
    ]:
        op.execute(f"ALTER TABLE hr_contracts ADD COLUMN IF NOT EXISTS {column}")

    for column in [
        "luong_co_ban_phu_cap NUMERIC(18,2) DEFAULT 0",
        "ngay_cong_nguyen_luong NUMERIC(8,2) DEFAULT 0",
        "gio_cong_thuc_te NUMERIC(8,2) DEFAULT 0",
        "luong_theo_ngay_cong NUMERIC(18,2) DEFAULT 0",
        "ot_gio_ngay_thuong NUMERIC(8,2) DEFAULT 0",
        "ot_gio_chu_nhat NUMERIC(8,2) DEFAULT 0",
        "ot_gio_chu_nhat_tang_ca NUMERIC(8,2) DEFAULT 0",
        "ot_gio_ngay_le NUMERIC(8,2) DEFAULT 0",
        "ot_tien_ngay_thuong NUMERIC(18,2) DEFAULT 0",
        "ot_tien_chu_nhat NUMERIC(18,2) DEFAULT 0",
        "ot_tien_chu_nhat_tang_ca NUMERIC(18,2) DEFAULT 0",
        "ot_tien_ngay_le NUMERIC(18,2) DEFAULT 0",
        "phu_cap_chuyen_can NUMERIC(18,2) DEFAULT 0",
        "phu_cap_trach_nhiem NUMERIC(18,2) DEFAULT 0",
        "phu_cap_nha_o_com NUMERIC(18,2) DEFAULT 0",
        "phu_cap_dien_thoai NUMERIC(18,2) DEFAULT 0",
        "phu_cap_khac NUMERIC(18,2) DEFAULT 0",
        "tien_chuyen_hqcv_thanh_tich NUMERIC(18,2) DEFAULT 0",
        "tong_thu_nhap NUMERIC(18,2) DEFAULT 0",
    ]:
        op.execute(f"ALTER TABLE hr_payroll_runs ADD COLUMN IF NOT EXISTS {column}")

    op.execute("""
    CREATE TABLE IF NOT EXISTS hr_payroll_holidays (
        id SERIAL PRIMARY KEY,
        ngay DATE UNIQUE NOT NULL,
        ten_ngay_le VARCHAR(150) NOT NULL,
        trang_thai BOOLEAN DEFAULT TRUE,
        ghi_chu TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS hr_payroll_holidays")
    for column in [
        "tong_thu_nhap",
        "tien_chuyen_hqcv_thanh_tich",
        "phu_cap_khac",
        "phu_cap_dien_thoai",
        "phu_cap_nha_o_com",
        "phu_cap_trach_nhiem",
        "phu_cap_chuyen_can",
        "ot_tien_ngay_le",
        "ot_tien_chu_nhat_tang_ca",
        "ot_tien_chu_nhat",
        "ot_tien_ngay_thuong",
        "ot_gio_ngay_le",
        "ot_gio_chu_nhat_tang_ca",
        "ot_gio_chu_nhat",
        "ot_gio_ngay_thuong",
        "luong_theo_ngay_cong",
        "gio_cong_thuc_te",
        "ngay_cong_nguyen_luong",
        "luong_co_ban_phu_cap",
    ]:
        op.execute(f"ALTER TABLE hr_payroll_runs DROP COLUMN IF EXISTS {column}")
    for column in [
        "phu_cap_khac",
        "phu_cap_dien_thoai",
        "phu_cap_nha_o_com",
        "phu_cap_trach_nhiem",
        "phu_cap_chuyen_can",
    ]:
        op.execute(f"ALTER TABLE hr_contracts DROP COLUMN IF EXISTS {column}")
