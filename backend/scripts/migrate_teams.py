"""Migration: tạo bảng hr_teams + cột hr_employees.to_id.

Alembic của project bị broken (KeyError 'ocr002') → dùng Base.metadata.create_all
cho table mới + raw ALTER cho cột mới trên hr_employees.

Idempotent: chạy lại không lỗi nếu table/column đã tồn tại.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect, text
from app.database import Base, engine
from app.models.hr import Team  # noqa: F401 — đảm bảo Team đã register vào Base.metadata


def main() -> None:
    insp = inspect(engine)

    # 1) Tạo bảng hr_teams nếu chưa có (bằng metadata.create_all chỉ table này)
    if "hr_teams" in insp.get_table_names():
        print("✓ Table hr_teams đã tồn tại")
    else:
        Team.__table__.create(engine)
        print("✓ Đã tạo bảng hr_teams")

    # 2) Thêm cột hr_employees.to_id nếu chưa có
    emp_cols = {c["name"] for c in insp.get_columns("hr_employees")}
    if "to_id" in emp_cols:
        print("✓ Cột hr_employees.to_id đã tồn tại")
    else:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE hr_employees "
                "ADD COLUMN to_id INTEGER REFERENCES hr_teams(id) ON DELETE SET NULL"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_hr_employees_to_id ON hr_employees(to_id)"
            ))
        print("✓ Đã thêm cột hr_employees.to_id + index")

    print("\n✅ Migration teams xong.")


if __name__ == "__main__":
    main()
