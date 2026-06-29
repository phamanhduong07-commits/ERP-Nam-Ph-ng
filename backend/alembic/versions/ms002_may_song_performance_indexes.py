"""Add performance indexes for MaySong page queries

Revision ID: ms002_may_song_performance_indexes
Revises: 7cdcd6800431
Create Date: 2026-06-29
"""
from typing import Sequence, Union
from alembic import op

revision: str = "ms002_perf_idx"
down_revision: Union[str, tuple] = "7cdcd6800431"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # phieu_nhap_phoi_song — dùng trong listAllPhieu filter và join với production_orders
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_phieu_nhap_phoi_song_production_order_id "
        "ON phieu_nhap_phoi_song (production_order_id)"
    )
    # phieu_nhap_phoi_song — ORDER BY ngay DESC, id DESC trong listAllPhieu
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_phieu_nhap_phoi_song_ngay "
        "ON phieu_nhap_phoi_song (ngay DESC, id DESC)"
    )
    # phieu_nhap_phoi_song_items — join với phieu khi load items
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_phieu_nhap_phoi_song_items_phieu_id "
        "ON phieu_nhap_phoi_song_items (phieu_id)"
    )
    # production_plan_lines — batch query ke_hoach_trang_thai trong get_production_orders_paginated
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_production_plan_lines_po_item_id "
        "ON production_plan_lines (production_order_item_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_phieu_nhap_phoi_song_production_order_id")
    op.execute("DROP INDEX IF EXISTS ix_phieu_nhap_phoi_song_ngay")
    op.execute("DROP INDEX IF EXISTS ix_phieu_nhap_phoi_song_items_phieu_id")
    op.execute("DROP INDEX IF EXISTS ix_production_plan_lines_po_item_id")
