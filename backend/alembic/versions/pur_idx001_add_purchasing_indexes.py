"""add_purchasing_indexes

Revision ID: pur_idx001
Revises: 51ae592a207f
Create Date: 2026-06-09

Thêm indexes cho các FK và filter columns của module mua hàng.
Không thay đổi schema — chỉ thêm indexes để tối ưu query.

Đã có sẵn trong DB (bỏ qua):
  idx_gr_po, idx_gr_trang_thai (goods_receipts)
  idx_gr_items_receipt, idx_gr_items_po_item (goods_receipt_items)
  idx_po_supplier, idx_po_trang_thai (purchase_orders)
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'pur_idx001'
down_revision: Union[str, None] = '51ae592a207f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # goods_receipts (po_id+trang_thai already indexed as idx_gr_po/idx_gr_trang_thai)
    op.create_index('ix_goods_receipts_supplier_id',   'goods_receipts', ['supplier_id'])
    op.create_index('ix_goods_receipts_warehouse_id',  'goods_receipts', ['warehouse_id'])
    op.create_index('ix_goods_receipts_phap_nhan_id',  'goods_receipts', ['phap_nhan_id'])
    op.create_index('ix_goods_receipts_loai_nhap',     'goods_receipts', ['loai_nhap'])

    # goods_receipt_items (receipt_id+po_item_id already indexed)
    op.create_index('ix_gr_items_paper_material_id',   'goods_receipt_items', ['paper_material_id'])

    # purchase_orders (supplier_id+trang_thai already indexed as idx_po_supplier/idx_po_trang_thai)
    op.create_index('ix_purchase_orders_phan_xuong_id','purchase_orders', ['phan_xuong_id'])
    op.create_index('ix_purchase_orders_phap_nhan_id', 'purchase_orders', ['phap_nhan_id'])

    # purchase_order_items
    op.create_index('ix_po_items_po_id',               'purchase_order_items', ['po_id'])
    op.create_index('ix_po_items_paper_material_id',   'purchase_order_items', ['paper_material_id'])

    # purchase_returns
    op.create_index('ix_purchase_returns_supplier_id', 'purchase_returns', ['supplier_id'])
    op.create_index('ix_purchase_returns_trang_thai',  'purchase_returns', ['trang_thai'])
    op.create_index('ix_purchase_returns_po_id',       'purchase_returns', ['po_id'])
    op.create_index('ix_purchase_returns_gr_id',       'purchase_returns', ['gr_id'])

    # purchase_requisitions
    op.create_index('ix_ymh_phan_xuong_id',            'purchase_requisitions', ['phan_xuong_id'])
    op.create_index('ix_ymh_phap_nhan_id',             'purchase_requisitions', ['phap_nhan_id'])
    op.create_index('ix_ymh_trang_thai',               'purchase_requisitions', ['trang_thai'])

    # purchase_requisition_items
    op.create_index('ix_ymh_items_ymh_id',             'purchase_requisition_items', ['ymh_id'])


def downgrade() -> None:
    op.drop_index('ix_goods_receipts_supplier_id',    table_name='goods_receipts')
    op.drop_index('ix_goods_receipts_warehouse_id',   table_name='goods_receipts')
    op.drop_index('ix_goods_receipts_phap_nhan_id',   table_name='goods_receipts')
    op.drop_index('ix_goods_receipts_loai_nhap',      table_name='goods_receipts')

    op.drop_index('ix_gr_items_paper_material_id',    table_name='goods_receipt_items')

    op.drop_index('ix_purchase_orders_phan_xuong_id', table_name='purchase_orders')
    op.drop_index('ix_purchase_orders_phap_nhan_id',  table_name='purchase_orders')

    op.drop_index('ix_po_items_po_id',                table_name='purchase_order_items')
    op.drop_index('ix_po_items_paper_material_id',    table_name='purchase_order_items')

    op.drop_index('ix_purchase_returns_supplier_id',  table_name='purchase_returns')
    op.drop_index('ix_purchase_returns_trang_thai',   table_name='purchase_returns')
    op.drop_index('ix_purchase_returns_po_id',        table_name='purchase_returns')
    op.drop_index('ix_purchase_returns_gr_id',        table_name='purchase_returns')

    op.drop_index('ix_ymh_phan_xuong_id',             table_name='purchase_requisitions')
    op.drop_index('ix_ymh_phap_nhan_id',              table_name='purchase_requisitions')
    op.drop_index('ix_ymh_trang_thai',                table_name='purchase_requisitions')

    op.drop_index('ix_ymh_items_ymh_id',              table_name='purchase_requisition_items')
