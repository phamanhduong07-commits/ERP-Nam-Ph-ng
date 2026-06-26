"""Revoke hr.employees permission from TRUONG_PHONG_SALE_ADMIN

TRUONG_PHONG_SALE_ADMIN is a sales manager role — should not have access
to the HR employee records page. hr.kpi and team.manage_permissions remain
so the HRM flyout group stays visible with only the relevant items.

Revision ID: zmh046
Revises: zmh045
Create Date: 2026-06-26

"""
from alembic import op

revision = 'zmh046'
down_revision = 'zmh045'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        DELETE FROM role_permissions
        WHERE role_id = (SELECT id FROM roles WHERE ma_vai_tro = 'TRUONG_PHONG_SALE_ADMIN')
          AND permission_id = (SELECT id FROM permissions WHERE ma_quyen = 'hr.employees')
    """)


def downgrade():
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id, created_at)
        SELECT r.id, p.id, CURRENT_TIMESTAMP
        FROM roles r, permissions p
        WHERE r.ma_vai_tro = 'TRUONG_PHONG_SALE_ADMIN'
          AND p.ma_quyen = 'hr.employees'
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
    """)
