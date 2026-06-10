"""Migration: tạo bảng hr_health_checks.

Idempotent: chạy lại không lỗi nếu table đã tồn tại.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect
from app.database import engine
from app.models.hr import HealthCheck  # noqa: F401 — register vào Base.metadata


def main() -> None:
    insp = inspect(engine)
    if "hr_health_checks" in insp.get_table_names():
        print("✓ Table hr_health_checks đã tồn tại")
        return
    HealthCheck.__table__.create(engine)
    print("✅ Đã tạo bảng hr_health_checks")


if __name__ == "__main__":
    main()
