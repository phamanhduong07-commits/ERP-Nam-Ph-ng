"""phap_nhan phoi_phan_xuong_id data — NP, NP LA, Visunpack

Revision ID: f2b3c4d5e6a7
Revises: e1a2b3c4d5f6
Create Date: 2026-05-03
"""
from alembic import op
import sqlalchemy as sa

revision = 'f2b3c4d5e6a7'
down_revision = 'e1a2b3c4d5f6'
branch_labels = None
depends_on = None


def _find_px(conn, name_pattern: str):
    row = conn.execute(sa.text(
        "SELECT id FROM phan_xuong WHERE ten_xuong ILIKE :pat LIMIT 1"
    ), {"pat": f"%{name_pattern}%"}).fetchone()
    return row[0] if row else None


def upgrade():
    conn = op.get_bind()

    hoang_gia_id = _find_px(conn, "hoang gia") or _find_px(conn, "hoàng gia")
    nam_thuan_id = _find_px(conn, "nam thuan") or _find_px(conn, "nam thuận")

    rules = [
        # (name_fragment, phoi_phan_xuong_id)
        # NP → Hoàng Gia
        ("NP",          hoang_gia_id, "ten_viet_tat = 'NP'"),
        # NP LA → Nam Thuận
        ("NP LA",       nam_thuan_id, "ten_viet_tat = 'NP LA'"),
        # Visunpack → Hoàng Gia (match by name)
        ("visunpack",   hoang_gia_id, "lower(ten_phap_nhan) LIKE '%visunpack%' OR lower(ten_viet_tat) LIKE '%visunpack%'"),
    ]

    for _label, px_id, where_clause in rules:
        if px_id is None:
            continue
        conn.execute(sa.text(
            f"UPDATE phap_nhan SET phoi_phan_xuong_id = :px_id WHERE {where_clause}"
        ), {"px_id": px_id})


def downgrade():
    pass
