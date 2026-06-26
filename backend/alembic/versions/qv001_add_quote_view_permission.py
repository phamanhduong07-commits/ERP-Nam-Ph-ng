"""Add quote.view permission and assign to SALE_ADMIN

Revision ID: qv001
Revises: zmh042
Create Date: 2026-06-25
"""
from alembic import op


revision = "qv001"
down_revision = "zmh042"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        INSERT INTO permissions (ma_quyen, ten_quyen, mo_ta, nhom, trang_thai, created_at)
        VALUES ('quote.view', 'Xem báo giá', 'Xem danh sách và chi tiết báo giá', 'Bán Hàng', TRUE, NOW())
        ON CONFLICT (ma_quyen) DO NOTHING
    """)

    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r, permissions p
        WHERE r.ma_vai_tro = 'SALE_ADMIN'
          AND p.ma_quyen = 'quote.view'
          AND NOT EXISTS (
            SELECT 1 FROM role_permissions rp
            WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
    """)


def downgrade():
    op.execute("""
        DELETE FROM role_permissions
        WHERE permission_id = (SELECT id FROM permissions WHERE ma_quyen = 'quote.view')
          AND role_id = (SELECT id FROM roles WHERE ma_vai_tro = 'SALE_ADMIN')
    """)
    op.execute("DELETE FROM permissions WHERE ma_quyen = 'quote.view'")
