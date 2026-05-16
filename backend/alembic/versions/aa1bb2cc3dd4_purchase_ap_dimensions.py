"""purchase ap dimensions

Revision ID: aa1bb2cc3dd4
Revises: z1a2b3c4d5e6
Create Date: 2026-05-15 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "aa1bb2cc3dd4"
down_revision: Union[str, None] = "z1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(bind)
    return column_name in {col["name"] for col in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()

    if not _column_exists(bind, "purchase_orders", "phap_nhan_id"):
        op.add_column("purchase_orders", sa.Column("phap_nhan_id", sa.Integer(), nullable=True))
        op.create_foreign_key(
            "fk_purchase_orders_phap_nhan_id",
            "purchase_orders",
            "phap_nhan",
            ["phap_nhan_id"],
            ["id"],
        )

    if not _column_exists(bind, "goods_receipts", "phan_xuong_id"):
        op.add_column("goods_receipts", sa.Column("phan_xuong_id", sa.Integer(), nullable=True))
        op.create_foreign_key(
            "fk_goods_receipts_phan_xuong_id",
            "goods_receipts",
            "phan_xuong",
            ["phan_xuong_id"],
            ["id"],
        )
        op.execute(
            """
            UPDATE goods_receipts gr
            SET phan_xuong_id = w.phan_xuong_id
            FROM warehouses w
            WHERE gr.warehouse_id = w.id
              AND gr.phan_xuong_id IS NULL
            """
        )

    if not _column_exists(bind, "purchase_invoices", "phan_xuong_id"):
        op.add_column("purchase_invoices", sa.Column("phan_xuong_id", sa.Integer(), nullable=True))
        op.create_foreign_key(
            "fk_purchase_invoices_phan_xuong_id",
            "purchase_invoices",
            "phan_xuong",
            ["phan_xuong_id"],
            ["id"],
        )

    if not _column_exists(bind, "cash_payments", "phan_xuong_id"):
        op.add_column("cash_payments", sa.Column("phan_xuong_id", sa.Integer(), nullable=True))
        op.create_foreign_key(
            "fk_cash_payments_phan_xuong_id",
            "cash_payments",
            "phan_xuong",
            ["phan_xuong_id"],
            ["id"],
        )


def downgrade() -> None:
    for table_name, fk_name, column_name in (
        ("cash_payments", "fk_cash_payments_phan_xuong_id", "phan_xuong_id"),
        ("purchase_invoices", "fk_purchase_invoices_phan_xuong_id", "phan_xuong_id"),
        ("goods_receipts", "fk_goods_receipts_phan_xuong_id", "phan_xuong_id"),
        ("purchase_orders", "fk_purchase_orders_phap_nhan_id", "phap_nhan_id"),
    ):
        op.drop_constraint(fk_name, table_name, type_="foreignkey")
        op.drop_column(table_name, column_name)
