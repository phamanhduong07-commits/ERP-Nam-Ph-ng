"""Migration: thêm 6 cột vào hr_payroll_runs cho engine Sprint D.3."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect, text
from app.database import engine


COLUMNS = [
    ("cong_quy_doi",           "NUMERIC(8, 4) DEFAULT 0"),
    ("he_so_ca_nhan_snapshot", "NUMERIC(5, 2) DEFAULT 0"),
    ("trong_so_ca_nhan",       "NUMERIC(10, 4) DEFAULT 0"),
    ("bu_toi_thieu_vung",      "NUMERIC(18, 2) DEFAULT 0"),
    ("bo_phan_id_snapshot",    "INTEGER"),
    ("ghi_chu_calc",           "TEXT"),
]


def main() -> None:
    insp = inspect(engine)
    existing = {c["name"] for c in insp.get_columns("hr_payroll_runs")}
    added = 0
    with engine.begin() as conn:
        for col, ddl in COLUMNS:
            if col in existing:
                print(f"✓ {col} đã tồn tại")
                continue
            conn.execute(text(f"ALTER TABLE hr_payroll_runs ADD COLUMN {col} {ddl}"))
            print(f"✅ Đã thêm cột {col}")
            added += 1
    print(f"\n✅ Migration xong. Thêm {added} cột.")


if __name__ == "__main__":
    main()
