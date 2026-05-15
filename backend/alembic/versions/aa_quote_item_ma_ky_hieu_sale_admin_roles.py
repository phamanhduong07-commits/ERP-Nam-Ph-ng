"""quote item ma ky hieu and sale admin roles

Revision ID: aa_quote_item_ma_ky_hieu_sale_admin_roles
Revises: n1o2p3q4r5s6
Create Date: 2026-05-13
"""
from alembic import op
import sqlalchemy as sa


revision = "aa_quote_item_ma_ky_hieu_sale_admin_roles"
down_revision = "z1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("quote_items", sa.Column("ma_ky_hieu", sa.String(length=100), nullable=True))
    op.execute(
        """
        INSERT INTO roles (ma_vai_tro, ten_vai_tro, mo_ta, trang_thai, created_at)
        VALUES
          ('TRUONG_PHONG_SALE_ADMIN', 'Truong phong Sale Admin', 'Duyet bao gia sale admin', TRUE, NOW())
        ON CONFLICT (ma_vai_tro) DO NOTHING
        """
    )


def downgrade():
    op.drop_column("quote_items", "ma_ky_hieu")
    op.execute("DELETE FROM roles WHERE ma_vai_tro IN ('TRUONG_PHONG_SALE_ADMIN')")
