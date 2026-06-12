"""P0 fix: thêm partial UNIQUE INDEX cho hr_benefit_records.

Chặn race condition giữa birthday cron và scan-birthday endpoint khi tạo
duplicate record cho cùng (employee, loai, thang, nam).

Chỉ áp dụng cho recurring loai: sinh_nhat + tất cả lễ Tết.
Các loại 1-time (hieu/hi/sinh_con/khac) vẫn cho phép trùng.

Idempotent.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from app.database import engine


def main() -> None:
    print("─── CREATE partial UNIQUE INDEX hr_benefit_records ───")
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS
              ux_benefit_records_recurring
            ON hr_benefit_records (employee_id, loai, thang_ap_dung, nam_ap_dung)
            WHERE loai IN (
              'sinh_nhat', 'tet_am', 'le_30_4', 'le_2_9',
              'le_8_3', 'le_20_10', 'trung_thu'
            )
        """))
        print("  ✓ ux_benefit_records_recurring (partial unique)")
    print()
    print("Done.")


if __name__ == "__main__":
    main()
