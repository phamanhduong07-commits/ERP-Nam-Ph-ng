"""Migration: thêm cột ngay_chot vào hr_payroll_runs (Sprint D.5 hardening).

Dùng cho tính hạn khiếu nại 15 ngày làm việc theo Điều 16 — mốc từ ngày HR chốt.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect, text
from app.database import engine


def main() -> None:
    insp = inspect(engine)
    cols = {c["name"] for c in insp.get_columns("hr_payroll_runs")}
    if "ngay_chot" in cols:
        print("✓ Cột ngay_chot đã tồn tại")
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE hr_payroll_runs ADD COLUMN ngay_chot DATE"))
    print("✅ Đã thêm cột ngay_chot vào hr_payroll_runs")


if __name__ == "__main__":
    main()
