"""Sprint C migration: extend hr_leave_requests với fields mới cho workflow đơn từ thống nhất.

Idempotent.

Usage:
    python scripts/migrate_workflow_requests.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from app.database import engine


NEW_COLUMNS = [
    ("so_tien", "NUMERIC(18, 2)"),
    ("so_gio_ot", "NUMERIC(5, 2)"),
    ("dia_diem", "VARCHAR(255)"),
    ("file_dinh_kem_url", "VARCHAR(500)"),
    ("da_xu_ly", "BOOLEAN DEFAULT FALSE NOT NULL"),
]


def main() -> None:
    print("─── ALTER hr_leave_requests: add Sprint C columns ───")
    with engine.begin() as conn:
        for col, coltype in NEW_COLUMNS:
            sql = f"ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS {col} {coltype}"
            conn.execute(text(sql))
            print(f"  ✓ {col:<22} {coltype}")
    print("\nDone.")


if __name__ == "__main__":
    main()
