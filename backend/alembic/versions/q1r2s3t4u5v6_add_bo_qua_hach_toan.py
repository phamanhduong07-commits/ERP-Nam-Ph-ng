"""add bo_qua_hach_toan to all transactional documents

Revision ID: q1r2s3t4u5v6
Revises: p1q2r3s4t5u6
Create Date: 2026-05-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'q1r2s3t4u5v6'
down_revision = 'p1q2r3s4t5u6'
branch_labels = None
depends_on = None

_TABLES = [
    'purchase_invoices',
    'sales_invoices',
    'workshop_payroll',
    'fixed_assets',
    'goods_receipts',
    'material_issues',
    'production_outputs',
    'delivery_orders',
    'phieu_chuyen_kho',
    'stock_adjustments',
]


def upgrade():
    conn = op.get_bind()
    insp = inspect(conn)
    existing_tables = set(insp.get_table_names())

    for table in _TABLES:
        if table not in existing_tables:
            continue
        existing_cols = {c['name'] for c in insp.get_columns(table)}
        if 'bo_qua_hach_toan' not in existing_cols:
            op.add_column(
                table,
                sa.Column('bo_qua_hach_toan', sa.Boolean(), nullable=False, server_default=sa.false()),
            )


def downgrade():
    conn = op.get_bind()
    insp = inspect(conn)
    existing_tables = set(insp.get_table_names())

    for table in _TABLES:
        if table not in existing_tables:
            continue
        existing_cols = {c['name'] for c in insp.get_columns(table)}
        if 'bo_qua_hach_toan' in existing_cols:
            op.drop_column(table, 'bo_qua_hach_toan')
