"""yeu_cau_giao_hang tables + extend delivery_orders/items

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-05-02
"""
from alembic import op
import sqlalchemy as sa

revision = 'd3e4f5a6b7c8'
down_revision = 'c2d3e4f5a6b7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── Tạo bảng yeu_cau_giao_hang ──────────────────────────────────────────
    res = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_name='yeu_cau_giao_hang'"
    ))
    if res.fetchone() is None:
        op.create_table(
            'yeu_cau_giao_hang',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('so_yeu_cau', sa.String(30), unique=True, nullable=False),
            sa.Column('ngay_yeu_cau', sa.Date(), nullable=False),
            sa.Column('ngay_giao_yeu_cau', sa.Date(), nullable=True),
            sa.Column('customer_id', sa.Integer(), sa.ForeignKey('customers.id'), nullable=True),
            sa.Column('dia_chi_giao', sa.Text(), nullable=True),
            sa.Column('nguoi_nhan', sa.String(150), nullable=True),
            sa.Column('ghi_chu', sa.Text(), nullable=True),
            sa.Column('trang_thai', sa.String(20), nullable=False, server_default='moi'),
            sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    res = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_name='yeu_cau_giao_hang_items'"
    ))
    if res.fetchone() is None:
        op.create_table(
            'yeu_cau_giao_hang_items',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('yeu_cau_id', sa.Integer(),
                      sa.ForeignKey('yeu_cau_giao_hang.id', ondelete='CASCADE'), nullable=False),
            sa.Column('production_order_id', sa.Integer(),
                      sa.ForeignKey('production_orders.id'), nullable=False),
            sa.Column('warehouse_id', sa.Integer(), sa.ForeignKey('warehouses.id'), nullable=False),
            sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id'), nullable=True),
            sa.Column('sales_order_item_id', sa.Integer(),
                      sa.ForeignKey('sales_order_items.id'), nullable=True),
            sa.Column('ten_hang', sa.String(255), nullable=False, server_default=''),
            sa.Column('so_luong', sa.Numeric(12, 3), nullable=False),
            sa.Column('dvt', sa.String(20), server_default='Thùng'),
            sa.Column('dien_tich', sa.Numeric(12, 4), nullable=True),
            sa.Column('trong_luong', sa.Numeric(10, 3), nullable=True),
            sa.Column('ghi_chu', sa.Text(), nullable=True),
        )

    # ── delivery_orders.sales_order_id → nullable ────────────────────────────
    # Idempotent: DROP NOT NULL không báo lỗi nếu cột đã nullable
    conn.execute(sa.text(
        "ALTER TABLE delivery_orders ALTER COLUMN sales_order_id DROP NOT NULL"
    ))

    # ── Mở rộng delivery_orders ──────────────────────────────────────────────
    delivery_order_cols = [
        ("yeu_cau_id",
         sa.Column('yeu_cau_id', sa.Integer(),
                   sa.ForeignKey('yeu_cau_giao_hang.id'), nullable=True)),
        ("xe_id",
         sa.Column('xe_id', sa.Integer(), sa.ForeignKey('xe.id'), nullable=True)),
        ("tai_xe_id",
         sa.Column('tai_xe_id', sa.Integer(), sa.ForeignKey('tai_xe.id'), nullable=True)),
        ("lo_xe",
         sa.Column('lo_xe', sa.String(150), nullable=True)),
        ("don_gia_vc_id",
         sa.Column('don_gia_vc_id', sa.Integer(),
                   sa.ForeignKey('don_gia_van_chuyen.id'), nullable=True)),
        ("tien_van_chuyen",
         sa.Column('tien_van_chuyen', sa.Numeric(18, 2), nullable=True)),
        ("tong_tien_hang",
         sa.Column('tong_tien_hang', sa.Numeric(18, 2), nullable=True)),
        ("tong_thanh_toan",
         sa.Column('tong_thanh_toan', sa.Numeric(18, 2), nullable=True)),
        ("trang_thai_cong_no",
         sa.Column('trang_thai_cong_no', sa.String(20), nullable=True,
                   server_default='chua_thu')),
    ]
    for col_name, col_obj in delivery_order_cols:
        r = conn.execute(sa.text(
            "SELECT 1 FROM information_schema.columns "
            f"WHERE table_name='delivery_orders' AND column_name='{col_name}'"
        ))
        if r.fetchone() is None:
            op.add_column('delivery_orders', col_obj)

    # ── Mở rộng delivery_order_items ────────────────────────────────────────
    delivery_item_cols = [
        ("production_order_id",
         sa.Column('production_order_id', sa.Integer(),
                   sa.ForeignKey('production_orders.id'), nullable=True)),
        ("dien_tich",
         sa.Column('dien_tich', sa.Numeric(12, 4), nullable=True)),
        ("trong_luong",
         sa.Column('trong_luong', sa.Numeric(10, 3), nullable=True)),
        ("don_gia",
         sa.Column('don_gia', sa.Numeric(18, 2), nullable=True)),
        ("thanh_tien",
         sa.Column('thanh_tien', sa.Numeric(18, 2), nullable=True)),
    ]
    for col_name, col_obj in delivery_item_cols:
        r = conn.execute(sa.text(
            "SELECT 1 FROM information_schema.columns "
            f"WHERE table_name='delivery_order_items' AND column_name='{col_name}'"
        ))
        if r.fetchone() is None:
            op.add_column('delivery_order_items', col_obj)


def downgrade() -> None:
    pass
