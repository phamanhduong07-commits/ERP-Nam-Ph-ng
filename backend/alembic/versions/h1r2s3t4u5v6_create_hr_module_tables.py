"""create HR module tables

Revision ID: h1r2s3t4u5v6
Revises: s1t2u3v4w5x6
Create Date: 2026-05-14
"""
from alembic import op

revision = "h1r2s3t4u5v6"
down_revision = "ac1_add_purchase_requisitions"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    CREATE TABLE IF NOT EXISTS hr_vehicles (
        id SERIAL PRIMARY KEY,
        bien_so VARCHAR(20) UNIQUE NOT NULL,
        ten_xe VARCHAR(100),
        loai_xe VARCHAR(50),
        dinh_muc_dau NUMERIC(10,2) DEFAULT 0,
        trang_thai BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS hr_departments (
        id SERIAL PRIMARY KEY,
        ma_bo_phan VARCHAR(50) UNIQUE NOT NULL,
        ten_bo_phan VARCHAR(150) NOT NULL,
        mo_ta TEXT,
        parent_id INTEGER REFERENCES hr_departments(id),
        phan_xuong_id INTEGER REFERENCES phan_xuong(id),
        phap_nhan_id INTEGER REFERENCES phap_nhan(id),
        trang_thai BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS hr_positions (
        id SERIAL PRIMARY KEY,
        ma_chuc_vu VARCHAR(50) UNIQUE NOT NULL,
        ten_chuc_vu VARCHAR(150) NOT NULL,
        cap_bac INTEGER,
        mo_ta TEXT,
        trang_thai BOOLEAN DEFAULT TRUE
    )
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS hr_employees (
        id SERIAL PRIMARY KEY,
        ma_nv VARCHAR(20) UNIQUE NOT NULL,
        ho_ten VARCHAR(150) NOT NULL,
        ngay_sinh DATE,
        gioi_tinh VARCHAR(10),
        cccd VARCHAR(20) UNIQUE,
        ngay_cap DATE,
        noi_cap VARCHAR(150),
        dia_chi TEXT,
        que_quan VARCHAR(255),
        so_dien_thoai VARCHAR(20),
        email VARCHAR(100),
        so_tk_ngan_hang VARCHAR(50),
        ten_ngan_hang VARCHAR(150),
        chi_nhanh_ngan_hang VARCHAR(150),
        phap_nhan_id INTEGER REFERENCES phap_nhan(id),
        phan_xuong_id INTEGER REFERENCES phan_xuong(id),
        bo_phan_id INTEGER REFERENCES hr_departments(id),
        chuc_vu_id INTEGER REFERENCES hr_positions(id),
        ma_van_tay VARCHAR(50),
        user_id INTEGER REFERENCES users(id),
        he_so_ca_nhan NUMERIC(4,2) DEFAULT 1.5,
        ngay_vao_lam DATE,
        ngay_nghi_viec DATE,
        is_tai_xe BOOLEAN DEFAULT FALSE,
        hang_bang_lai VARCHAR(20),
        ngay_het_han_bang DATE,
        vehicle_id INTEGER REFERENCES hr_vehicles(id),
        trang_thai VARCHAR(20) DEFAULT 'dang_lam',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS hr_contracts (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES hr_employees(id),
        so_hop_dong VARCHAR(50) UNIQUE NOT NULL,
        loai_hop_dong VARCHAR(50) NOT NULL,
        ngay_ky DATE NOT NULL,
        ngay_hieu_luc DATE NOT NULL,
        ngay_het_han DATE,
        luong_co_ban NUMERIC(18,2) DEFAULT 0,
        phu_cap NUMERIC(18,2) DEFAULT 0,
        ghi_chu TEXT,
        trang_thai VARCHAR(20) DEFAULT 'hieu_luc',
        created_at TIMESTAMPTZ DEFAULT NOW()
    )
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS hr_attendance_logs (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES hr_employees(id),
        ngay DATE NOT NULL,
        gio_vao TIMESTAMPTZ,
        gio_ra TIMESTAMPTZ,
        loai VARCHAR(20) DEFAULT 'van_tay',
        tong_gio_thuc NUMERIC(5,2) DEFAULT 0,
        so_cong NUMERIC(4,2) DEFAULT 0,
        so_gio_ot NUMERIC(4,2) DEFAULT 0,
        trang_thai VARCHAR(20) DEFAULT 'hop_le',
        ghi_chu TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(employee_id, ngay)
    )
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS hr_leave_requests (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES hr_employees(id),
        loai_don VARCHAR(30) NOT NULL,
        ngay_bat_dau TIMESTAMPTZ NOT NULL,
        ngay_ket_thuc TIMESTAMPTZ NOT NULL,
        tong_ngay NUMERIC(4,2),
        ly_do TEXT,
        trang_thai VARCHAR(20) DEFAULT 'cho_duyet',
        nguoi_duyet_dept_id INTEGER REFERENCES users(id),
        nguoi_duyet_bgd_id INTEGER REFERENCES users(id),
        y_kien_duyet TEXT,
        ngay_duyet TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS hr_employee_histories (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES hr_employees(id),
        loai VARCHAR(50),
        gia_tri_cu VARCHAR(255),
        gia_tri_moi VARCHAR(255),
        ly_do TEXT,
        ngay_hieu_luc DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        created_by INTEGER REFERENCES users(id)
    )
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS hr_employee_documents (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES hr_employees(id),
        ten_tai_lieu VARCHAR(255) NOT NULL,
        loai_tai_lieu VARCHAR(50),
        file_path VARCHAR(500),
        ngay_het_han DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS hr_fuel_logs (
        id SERIAL PRIMARY KEY,
        ngay_do DATE DEFAULT CURRENT_DATE,
        vehicle_id INTEGER NOT NULL REFERENCES hr_vehicles(id),
        employee_id INTEGER NOT NULL REFERENCES hr_employees(id),
        so_km_chay NUMERIC(14,2) DEFAULT 0,
        so_lit_dau NUMERIC(14,2) DEFAULT 0,
        don_gia NUMERIC(14,2) DEFAULT 0,
        thanh_tien NUMERIC(14,2) DEFAULT 0,
        so_km_cuoi NUMERIC(14,2) DEFAULT 0,
        so_km_dau NUMERIC(14,2) DEFAULT 0,
        ghi_chu TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS hr_payroll_configs (
        id SERIAL PRIMARY KEY,
        ma_hang VARCHAR(50) UNIQUE NOT NULL,
        ten_hang VARCHAR(150) NOT NULL,
        phan_tram_luong_sp NUMERIC(5,2) DEFAULT 100,
        don_gia NUMERIC(14,2) DEFAULT 0,
        loai VARCHAR(50) DEFAULT 'san_pham' NOT NULL,
        ghi_chu TEXT,
        trang_thai BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS hr_payroll_runs (
        id SERIAL PRIMARY KEY,
        thang INTEGER NOT NULL,
        nam INTEGER NOT NULL,
        employee_id INTEGER NOT NULL REFERENCES hr_employees(id),
        luong_co_ban NUMERIC(18,2) DEFAULT 0,
        luong_san_pham NUMERIC(18,2) DEFAULT 0,
        luong_chuyen NUMERIC(18,2) DEFAULT 0,
        phu_cap NUMERIC(18,2) DEFAULT 0,
        thuong NUMERIC(18,2) DEFAULT 0,
        bao_hiem NUMERIC(18,2) DEFAULT 0,
        thue_tncn NUMERIC(18,2) DEFAULT 0,
        tam_ung NUMERIC(18,2) DEFAULT 0,
        thuc_linh NUMERIC(18,2) DEFAULT 0,
        trang_thai VARCHAR(20) DEFAULT 'du_thao',
        created_at TIMESTAMPTZ DEFAULT NOW()
    )
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS hr_reward_disciplines (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES hr_employees(id),
        ngay_quyet_dinh DATE DEFAULT CURRENT_DATE,
        loai VARCHAR(20) NOT NULL,
        hinh_thuc VARCHAR(50) NOT NULL,
        so_tien NUMERIC(18,2) DEFAULT 0,
        ly_do TEXT NOT NULL,
        thang_ap_dung INTEGER,
        nam_ap_dung INTEGER,
        trang_thai VARCHAR(20) DEFAULT 'moi',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        created_by INTEGER REFERENCES users(id)
    )
    """)


def downgrade():
    for table in [
        "hr_reward_disciplines", "hr_payroll_runs", "hr_payroll_configs",
        "hr_fuel_logs", "hr_employee_documents", "hr_employee_histories",
        "hr_leave_requests", "hr_attendance_logs", "hr_contracts",
        "hr_employees", "hr_positions", "hr_departments", "hr_vehicles",
    ]:
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
