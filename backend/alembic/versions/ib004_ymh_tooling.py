"""ymh_tooling: add loai_item + san_pham_id to ymh items, create cong_cu_san_xuat

Revision ID: ib004
Revises: ib003
Create Date: 2026-06-10
"""
from alembic import op
import sqlalchemy as sa

revision = "ib004"
down_revision = "ib003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Thêm loai_item vào purchase_requisition_items
    op.add_column(
        "purchase_requisition_items",
        sa.Column("loai_item", sa.String(20), nullable=False, server_default="nvl"),
    )
    # 2. Thêm san_pham_id vào purchase_requisition_items
    op.add_column(
        "purchase_requisition_items",
        sa.Column("san_pham_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_pri_san_pham",
        "purchase_requisition_items",
        "products",
        ["san_pham_id"],
        ["id"],
        ondelete="SET NULL",
    )
    # 3. Tạo bảng cong_cu_san_xuat
    op.create_table(
        "cong_cu_san_xuat",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("san_pham_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("loai_cong_cu", sa.String(20), nullable=False),
        sa.Column("trang_thai", sa.String(20), nullable=False, server_default="co_san"),
        sa.Column("so_luong", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("ghi_chu", sa.Text(), nullable=True),
        sa.Column("ymh_item_id", sa.Integer(), sa.ForeignKey("purchase_requisition_items.id"), nullable=True),
        sa.Column("po_id", sa.Integer(), sa.ForeignKey("purchase_orders.id"), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )


def downgrade() -> None:
    op.drop_table("cong_cu_san_xuat")
    op.drop_constraint("fk_pri_san_pham", "purchase_requisition_items", type_="foreignkey")
    op.drop_column("purchase_requisition_items", "san_pham_id")
    op.drop_column("purchase_requisition_items", "loai_item")
