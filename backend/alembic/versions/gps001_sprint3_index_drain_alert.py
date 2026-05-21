"""GPS Sprint 3: compound index gps_snapshots + drain_alert_logs table

Revision ID: gps001_sprint3
Revises: gr001
Create Date: 2026-05-21
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "gps001_sprint3"
down_revision: Union[str, tuple] = "gr001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Compound index: tăng tốc query get_daily_detail (filter bien_so + ngay + sort created_at)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_gps_snap_bien_so_ngay_cat "
        "ON gps_snapshots (bien_so, ngay, created_at)"
    )

    # Bảng lưu lịch sử cảnh báo rút dầu real-time từ poller
    op.create_table(
        "drain_alert_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("bien_so", sa.String(30), nullable=False, index=True),
        sa.Column("xe_id", sa.Integer, sa.ForeignKey("xe.id"), nullable=True),
        sa.Column("ngay", sa.Date, nullable=False, index=True),
        sa.Column("gio", sa.DateTime(timezone=True), nullable=False),
        sa.Column("so_lit", sa.Float, nullable=False),
        sa.Column("drain_rate_L_per_h", sa.Float, nullable=False),
        sa.Column("dia_diem", sa.String(500), nullable=True),
        sa.Column("phan_loai", sa.String(30), server_default="rut_khi_dung"),
        sa.Column("muc_canh_bao", sa.String(20), server_default="cao"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("drain_alert_logs")
    op.execute("DROP INDEX IF EXISTS ix_gps_snap_bien_so_ngay_cat")
