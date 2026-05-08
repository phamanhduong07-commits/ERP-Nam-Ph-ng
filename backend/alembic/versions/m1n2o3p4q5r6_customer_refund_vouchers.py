"""customer_refund_vouchers

Revision ID: m1n2o3p4q5r6
Revises: l1m2n3o4p5q6
Create Date: 2026-05-08

"""
from alembic import op
import sqlalchemy as sa

revision = 'm1n2o3p4q5r6'
down_revision = 'l1m2n3o4p5q6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'customer_refund_vouchers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('so_phieu', sa.String(30), nullable=False),
        sa.Column('ngay', sa.Date(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('sales_return_id', sa.Integer(), nullable=False),
        sa.Column('sales_invoice_id', sa.Integer(), nullable=True),
        sa.Column('so_tien', sa.Numeric(18, 2), nullable=False),
        sa.Column('hinh_thuc', sa.String(20), nullable=True),
        sa.Column('tk_hoan_tien', sa.String(20), nullable=True),
        sa.Column('dien_giai', sa.Text(), nullable=True),
        sa.Column('trang_thai', sa.String(20), nullable=False, server_default='nhap'),
        sa.Column('nguoi_duyet_id', sa.Integer(), nullable=True),
        sa.Column('ngay_duyet', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id']),
        sa.ForeignKeyConstraint(['sales_return_id'], ['sales_returns.id']),
        sa.ForeignKeyConstraint(['sales_invoice_id'], ['sales_invoices.id']),
        sa.ForeignKeyConstraint(['nguoi_duyet_id'], ['users.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('so_phieu'),
        sa.UniqueConstraint('sales_return_id'),
    )


def downgrade() -> None:
    op.drop_table('customer_refund_vouchers')
