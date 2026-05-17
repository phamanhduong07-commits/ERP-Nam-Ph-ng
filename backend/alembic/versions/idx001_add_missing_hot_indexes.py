"""Add missing indexes on hot-filter columns

Revision ID: idx001_add_missing_hot_indexes
Revises: a0b1c2d3e4f5
Create Date: 2026-05-18
"""
from typing import Sequence, Union
from alembic import op

revision: str = "idx001_add_missing_hot_indexes"
down_revision: Union[str, tuple] = "a0b1c2d3e4f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # purchase_orders
    op.execute("CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders (supplier_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_po_ngay ON purchase_orders (ngay_po)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_po_trang_thai ON purchase_orders (trang_thai)")

    # goods_receipts
    op.execute("CREATE INDEX IF NOT EXISTS idx_gr_po ON goods_receipts (po_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_gr_trang_thai ON goods_receipts (trang_thai)")

    # goods_receipt_items
    op.execute("CREATE INDEX IF NOT EXISTS idx_gr_items_receipt ON goods_receipt_items (receipt_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_gr_items_po_item ON goods_receipt_items (po_item_id)")

    # sales_orders
    op.execute("CREATE INDEX IF NOT EXISTS idx_so_customer ON sales_orders (customer_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_so_trang_thai ON sales_orders (trang_thai)")

    # production_orders
    op.execute("CREATE INDEX IF NOT EXISTS idx_prod_trang_thai ON production_orders (trang_thai)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_prod_phan_xuong ON production_orders (phan_xuong_id)")

    # hr_employees
    op.execute("CREATE INDEX IF NOT EXISTS idx_hr_emp_bo_phan ON hr_employees (bo_phan_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_hr_emp_trang_thai ON hr_employees (trang_thai)")

    # hr_attendance_logs — composite (employee_id, ngay) cho query bảng chấm công
    op.execute("CREATE INDEX IF NOT EXISTS idx_att_emp_ngay ON hr_attendance_logs (employee_id, ngay)")

    # hr_payroll_runs
    op.execute("CREATE INDEX IF NOT EXISTS idx_payroll_emp ON hr_payroll_runs (employee_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_payroll_thang ON hr_payroll_runs (thang)")

    # financial documents
    op.execute("CREATE INDEX IF NOT EXISTS idx_sales_inv_trang_thai ON sales_invoices (trang_thai)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_purchase_inv_trang_thai ON purchase_invoices (trang_thai)")

    # production_plans
    op.execute("CREATE INDEX IF NOT EXISTS idx_prod_plan_trang_thai ON production_plans (trang_thai)")

    # customers & suppliers trang_thai (lọc active records)
    op.execute("CREATE INDEX IF NOT EXISTS idx_customers_trang_thai ON customers (trang_thai)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_suppliers_trang_thai ON suppliers (trang_thai)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_po_supplier")
    op.execute("DROP INDEX IF EXISTS idx_po_ngay")
    op.execute("DROP INDEX IF EXISTS idx_po_trang_thai")
    op.execute("DROP INDEX IF EXISTS idx_gr_po")
    op.execute("DROP INDEX IF EXISTS idx_gr_trang_thai")
    op.execute("DROP INDEX IF EXISTS idx_gr_items_receipt")
    op.execute("DROP INDEX IF EXISTS idx_gr_items_po_item")
    op.execute("DROP INDEX IF EXISTS idx_so_customer")
    op.execute("DROP INDEX IF EXISTS idx_so_trang_thai")
    op.execute("DROP INDEX IF EXISTS idx_prod_trang_thai")
    op.execute("DROP INDEX IF EXISTS idx_prod_phan_xuong")
    op.execute("DROP INDEX IF EXISTS idx_hr_emp_bo_phan")
    op.execute("DROP INDEX IF EXISTS idx_hr_emp_trang_thai")
    op.execute("DROP INDEX IF EXISTS idx_att_emp_ngay")
    op.execute("DROP INDEX IF EXISTS idx_payroll_emp")
    op.execute("DROP INDEX IF EXISTS idx_payroll_thang")
    op.execute("DROP INDEX IF EXISTS idx_sales_inv_trang_thai")
    op.execute("DROP INDEX IF EXISTS idx_purchase_inv_trang_thai")
    op.execute("DROP INDEX IF EXISTS idx_prod_plan_trang_thai")
    op.execute("DROP INDEX IF EXISTS idx_customers_trang_thai")
    op.execute("DROP INDEX IF EXISTS idx_suppliers_trang_thai")
