"""Add report.export permission to TRUONG_PHONG_SALE_ADMIN

Revision ID: zmh044
Revises: zmh043
Create Date: 2026-06-26

"""
from alembic import op

revision = 'zmh044'
down_revision = 'zmh043'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id, created_at)
        SELECT r.id, p.id, CURRENT_TIMESTAMP
        FROM roles r, permissions p
        WHERE r.ma_vai_tro = 'TRUONG_PHONG_SALE_ADMIN'
          AND p.ma_quyen = 'report.export'
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
    """)


def downgrade():
    op.execute("""
        DELETE FROM role_permissions
        WHERE role_id = (SELECT id FROM roles WHERE ma_vai_tro = 'TRUONG_PHONG_SALE_ADMIN')
          AND permission_id = (SELECT id FROM permissions WHERE ma_quyen = 'report.export')
    """)
