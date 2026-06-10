"""Composite indexes for hr_benefit_records — tăng tốc /dashboard query.

Idempotent.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from app.database import engine


def main() -> None:
    print("─── CREATE indexes for hr_benefit_records ───")
    with engine.begin() as conn:
        # Index cho query by period (dashboard + bulk-holiday lookup existing)
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_benefit_records_period
            ON hr_benefit_records (nam_ap_dung, thang_ap_dung, trang_thai)
        """))
        print("  ✓ ix_benefit_records_period (nam, thang, trang_thai)")

        # Index cho calendar query
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_benefit_records_ngay_su_kien
            ON hr_benefit_records (ngay_su_kien)
        """))
        print("  ✓ ix_benefit_records_ngay_su_kien")

    print()
    print("Done.")


if __name__ == "__main__":
    main()
