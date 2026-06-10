"""Migration: thêm cột audit DB-side cho hr_benefit_records.

P0-2 từ security review: persist audit trail không chỉ log file.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from app.database import engine

NEW_COLS = [
    ("nguoi_chi_id",  "INTEGER REFERENCES users(id)"),
    ("ngay_chi",      "TIMESTAMP WITH TIME ZONE"),
    ("nguoi_huy_id",  "INTEGER REFERENCES users(id)"),
    ("ngay_huy",      "TIMESTAMP WITH TIME ZONE"),
    ("ly_do_huy",     "TEXT"),
]


def main() -> None:
    print("─── ALTER hr_benefit_records: add audit cols ───")
    with engine.begin() as conn:
        for col, coltype in NEW_COLS:
            conn.execute(text(
                f"ALTER TABLE hr_benefit_records ADD COLUMN IF NOT EXISTS {col} {coltype}"
            ))
            print(f"  ✓ {col:<16} {coltype}")
    print("\nDone.")


if __name__ == "__main__":
    main()
