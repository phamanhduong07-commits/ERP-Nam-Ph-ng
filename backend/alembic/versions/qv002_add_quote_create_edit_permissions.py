"""Add quote.create and quote.edit permissions; assign all quote.* to SA roles

Revision ID: qv002
Revises: qv001
Create Date: 2026-06-25
"""
from alembic import op


revision = "qv002"
down_revision = "qv001"
branch_labels = None
depends_on = None


def upgrade():
    # Create missing quote.create and quote.edit permissions
    op.execute("""
        INSERT INTO permissions (ma_quyen, ten_quyen, mo_ta, nhom, trang_thai, created_at)
        VALUES
          ('quote.create', 'Tạo báo giá', 'Tạo báo giá mới', 'Bán Hàng', TRUE, NOW()),
          ('quote.edit',   'Sửa/duyệt báo giá', 'Sửa, gửi duyệt, duyệt hoặc từ chối báo giá', 'Bán Hàng', TRUE, NOW())
        ON CONFLICT (ma_quyen) DO NOTHING
    """)

    # SALE_ADMIN: view + create + edit
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r, permissions p
        WHERE r.ma_vai_tro = 'SALE_ADMIN'
          AND p.ma_quyen IN ('quote.create', 'quote.edit')
          AND NOT EXISTS (
            SELECT 1 FROM role_permissions rp
            WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
    """)

    # TRUONG_PHONG_SALE_ADMIN: view + edit (approve requires quote.edit)
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r, permissions p
        WHERE r.ma_vai_tro = 'TRUONG_PHONG_SALE_ADMIN'
          AND p.ma_quyen IN ('quote.view', 'quote.create', 'quote.edit')
          AND NOT EXISTS (
            SELECT 1 FROM role_permissions rp
            WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
    """)


def downgrade():
    op.execute("""
        DELETE FROM role_permissions
        WHERE permission_id IN (
          SELECT id FROM permissions WHERE ma_quyen IN ('quote.create', 'quote.edit')
        )
    """)
    op.execute("""
        DELETE FROM role_permissions
        WHERE permission_id = (SELECT id FROM permissions WHERE ma_quyen = 'quote.view')
          AND role_id = (SELECT id FROM roles WHERE ma_vai_tro = 'TRUONG_PHONG_SALE_ADMIN')
    """)
    op.execute("DELETE FROM permissions WHERE ma_quyen IN ('quote.create', 'quote.edit')")
