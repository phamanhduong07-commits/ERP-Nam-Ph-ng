"""Add stock adjustment documents

Revision ID: i1j2k3l4m5n6
Revises: b2c3d4e5f6a7
Create Date: 2026-05-04
"""
from alembic import op
import sqlalchemy as sa

revision = "i1j2k3l4m5n6"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "stock_adjustments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("so_phieu", sa.String(length=30), nullable=False, unique=True),
        sa.Column("warehouse_id", sa.Integer(), sa.ForeignKey("warehouses.id"), nullable=False),
        sa.Column("ngay", sa.Date(), nullable=False),
        sa.Column("ly_do", sa.String(length=100), nullable=True),
        sa.Column("ghi_chu", sa.Text(), nullable=True),
        sa.Column("trang_thai", sa.String(length=20), nullable=False, server_default="nhap"),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
    )
    op.create_table(
        "stock_adjustment_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("adjustment_id", sa.Integer(), sa.ForeignKey("stock_adjustments.id"), nullable=False),
        sa.Column("inventory_balance_id", sa.Integer(), sa.ForeignKey("inventory_balances.id"), nullable=True),
        sa.Column("paper_material_id", sa.Integer(), sa.ForeignKey("paper_materials.id"), nullable=True),
        sa.Column("other_material_id", sa.Integer(), sa.ForeignKey("other_materials.id"), nullable=True),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=True),
        sa.Column("ten_hang", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("don_vi", sa.String(length=20), nullable=False, server_default="Kg"),
        sa.Column("so_luong_so_sach", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("so_luong_thuc_te", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("chenhlech", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("don_gia", sa.Numeric(18, 6), nullable=False, server_default="0"),
        sa.Column("ghi_chu", sa.Text(), nullable=True),
    )


def downgrade():
    op.drop_table("stock_adjustment_items")
    op.drop_table("stock_adjustments")
