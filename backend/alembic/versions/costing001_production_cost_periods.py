"""add production cost period tables

Revision ID: costing001
Revises: 398c7975ebbf
Create Date: 2026-05-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "costing001"
down_revision: Union[str, None] = "398c7975ebbf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "production_cost_periods",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ma_ky", sa.String(30), nullable=False, unique=True),
        sa.Column("ten_ky", sa.String(255), nullable=False),
        sa.Column("tu_ngay", sa.Date(), nullable=False),
        sa.Column("den_ngay", sa.Date(), nullable=False),
        sa.Column("phap_nhan_id", sa.Integer(), sa.ForeignKey("phap_nhan.id"), nullable=True),
        sa.Column("phan_xuong_id", sa.Integer(), sa.ForeignKey("phan_xuong.id"), nullable=True),
        sa.Column("tieu_thuc_pb", sa.String(30), nullable=True),
        sa.Column("trang_thai", sa.String(20), nullable=True),
        sa.Column("tong_nvl", sa.Numeric(18, 2), nullable=True),
        sa.Column("tong_nhan_cong", sa.Numeric(18, 2), nullable=True),
        sa.Column("tong_sxc", sa.Numeric(18, 2), nullable=True),
        sa.Column("tong_chi_phi", sa.Numeric(18, 2), nullable=True),
        sa.Column("tong_san_luong", sa.Numeric(18, 3), nullable=True),
        sa.Column("ghi_chu", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("closed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_production_cost_periods_scope", "production_cost_periods", ["phap_nhan_id", "phan_xuong_id", "tu_ngay", "den_ngay"])

    op.create_table(
        "production_cost_inputs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("period_id", sa.Integer(), sa.ForeignKey("production_cost_periods.id"), nullable=False),
        sa.Column("source_type", sa.String(30), nullable=False),
        sa.Column("source_table", sa.String(50), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=True),
        sa.Column("production_order_id", sa.Integer(), sa.ForeignKey("production_orders.id"), nullable=True),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=True),
        sa.Column("phap_nhan_id", sa.Integer(), sa.ForeignKey("phap_nhan.id"), nullable=True),
        sa.Column("phan_xuong_id", sa.Integer(), sa.ForeignKey("phan_xuong.id"), nullable=True),
        sa.Column("so_tien", sa.Numeric(18, 2), nullable=True),
        sa.Column("so_luong", sa.Numeric(18, 3), nullable=True),
        sa.Column("dien_giai", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_production_cost_inputs_period", "production_cost_inputs", ["period_id"])

    op.create_table(
        "production_cost_allocations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("period_id", sa.Integer(), sa.ForeignKey("production_cost_periods.id"), nullable=False),
        sa.Column("production_order_id", sa.Integer(), sa.ForeignKey("production_orders.id"), nullable=False),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=True),
        sa.Column("phap_nhan_id", sa.Integer(), sa.ForeignKey("phap_nhan.id"), nullable=True),
        sa.Column("phan_xuong_id", sa.Integer(), sa.ForeignKey("phan_xuong.id"), nullable=True),
        sa.Column("tieu_thuc", sa.String(30), nullable=True),
        sa.Column("ty_le", sa.Numeric(18, 8), nullable=True),
        sa.Column("san_luong", sa.Numeric(18, 3), nullable=True),
        sa.Column("chi_phi_nvl", sa.Numeric(18, 2), nullable=True),
        sa.Column("chi_phi_nhan_cong", sa.Numeric(18, 2), nullable=True),
        sa.Column("chi_phi_sxc", sa.Numeric(18, 2), nullable=True),
        sa.Column("tong_chi_phi", sa.Numeric(18, 2), nullable=True),
        sa.Column("gia_thanh_don_vi", sa.Numeric(18, 4), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_production_cost_allocations_period", "production_cost_allocations", ["period_id"])

    op.create_table(
        "product_costs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("period_id", sa.Integer(), sa.ForeignKey("production_cost_periods.id"), nullable=False),
        sa.Column("production_order_id", sa.Integer(), sa.ForeignKey("production_orders.id"), nullable=False),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=True),
        sa.Column("ten_hang", sa.String(255), nullable=True),
        sa.Column("phap_nhan_id", sa.Integer(), sa.ForeignKey("phap_nhan.id"), nullable=True),
        sa.Column("phan_xuong_id", sa.Integer(), sa.ForeignKey("phan_xuong.id"), nullable=True),
        sa.Column("san_luong", sa.Numeric(18, 3), nullable=True),
        sa.Column("tong_chi_phi", sa.Numeric(18, 2), nullable=True),
        sa.Column("gia_thanh_don_vi", sa.Numeric(18, 4), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_product_costs_period", "product_costs", ["period_id"])


def downgrade() -> None:
    op.drop_index("ix_product_costs_period", table_name="product_costs")
    op.drop_table("product_costs")
    op.drop_index("ix_production_cost_allocations_period", table_name="production_cost_allocations")
    op.drop_table("production_cost_allocations")
    op.drop_index("ix_production_cost_inputs_period", table_name="production_cost_inputs")
    op.drop_table("production_cost_inputs")
    op.drop_index("ix_production_cost_periods_scope", table_name="production_cost_periods")
    op.drop_table("production_cost_periods")
