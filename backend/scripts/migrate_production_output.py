"""Migration: tạo bảng hr_production_outputs (Sprint D.2)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect
from app.database import engine
from app.models.hr import ProductionOutput  # noqa: F401


def main() -> None:
    insp = inspect(engine)
    if "hr_production_outputs" in insp.get_table_names():
        print("✓ Table hr_production_outputs đã tồn tại")
        return
    ProductionOutput.__table__.create(engine)
    print("✅ Đã tạo bảng hr_production_outputs")


if __name__ == "__main__":
    main()
