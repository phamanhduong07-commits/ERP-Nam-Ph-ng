"""add_tai_xe_role

Revision ID: role001
Revises: del003
Create Date: 2026-05-26
"""
from alembic import op
from sqlalchemy.sql import text

revision = 'role001'
down_revision = 'del003'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    # Chèn role TAI_XE nếu chưa có
    conn.execute(text("""
        INSERT INTO roles (ma_vai_tro, ten_vai_tro, mo_ta, trang_thai, created_at)
        VALUES ('TAI_XE', 'Tài xế', 'Tài xế giao hàng — chỉ dùng app mobile xác nhận giao', true, now())
        ON CONFLICT (ma_vai_tro) DO NOTHING
    """))


def downgrade():
    conn = op.get_bind()
    conn.execute(text("DELETE FROM roles WHERE ma_vai_tro = 'TAI_XE'"))
