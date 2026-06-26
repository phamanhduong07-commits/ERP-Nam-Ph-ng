"""Seed permissions for SALE_ADMIN_NHAN_VIEN, TRUONG_PHONG_SALE_ADMIN, SALE_ADMIN

Revision ID: zmh043
Revises: zmh042
Create Date: 2026-06-26

"""
from alembic import op

revision = 'zmh043'
down_revision = 'zmh042'
branch_labels = None
depends_on = None


def upgrade():
    # Ensure required permissions exist
    op.execute("""
        INSERT INTO permissions (ma_quyen, ten_quyen, nhom, trang_thai, created_at)
        VALUES
            ('sales.view_all_customers', 'Xem tat ca khach hang Sale', 'Ban Hang', TRUE, CURRENT_TIMESTAMP),
            ('sales.import', 'Import danh sach khach hang', 'Ban Hang', TRUE, CURRENT_TIMESTAMP),
            ('report.view', 'Xem bao cao', 'Bao Cao', TRUE, CURRENT_TIMESTAMP),
            ('report.export', 'Xuat bao cao', 'Bao Cao', TRUE, CURRENT_TIMESTAMP)
        ON CONFLICT (ma_quyen) DO NOTHING
    """)

    # SALE_ADMIN_NHAN_VIEN: quote.view + quote.create + report.view
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id, created_at)
        SELECT r.id, p.id, CURRENT_TIMESTAMP
        FROM roles r, permissions p
        WHERE r.ma_vai_tro = 'SALE_ADMIN_NHAN_VIEN'
          AND p.ma_quyen IN ('quote.view', 'quote.create', 'report.view')
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
    """)

    # TRUONG_PHONG_SALE_ADMIN: sales.view_all_customers + report.view
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id, created_at)
        SELECT r.id, p.id, CURRENT_TIMESTAMP
        FROM roles r, permissions p
        WHERE r.ma_vai_tro = 'TRUONG_PHONG_SALE_ADMIN'
          AND p.ma_quyen IN ('sales.view_all_customers', 'report.view')
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
    """)

    # SALE_ADMIN: sales.view_all_customers + sales.import + report.view + report.export
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id, created_at)
        SELECT r.id, p.id, CURRENT_TIMESTAMP
        FROM roles r, permissions p
        WHERE r.ma_vai_tro = 'SALE_ADMIN'
          AND p.ma_quyen IN ('sales.view_all_customers', 'sales.import', 'report.view', 'report.export')
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
    """)


def downgrade():
    pass
