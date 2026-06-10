"""Idempotent migration: add new columns to hr_employees + create hr_family_relations.

Bypasses alembic (chain is broken: KeyError 'ocr002'). Uses raw SQL with
IF NOT EXISTS checks for PostgreSQL.

Usage:
    python scripts/migrate_employee_extended.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from app.database import engine, Base
from app.models import hr as hr_models


# Columns to add to hr_employees (column_name, postgres type)
NEW_EMPLOYEE_COLUMNS = [
    ("ho_dem", "VARCHAR(100)"),
    ("ten", "VARCHAR(50)"),
    ("ten_bi_danh", "VARCHAR(100)"),
    ("quoc_tich", "VARCHAR(50) DEFAULT 'Việt Nam'"),
    ("dan_toc", "VARCHAR(50)"),
    ("ton_giao", "VARCHAR(50)"),
    ("noi_sinh_tinh", "VARCHAR(100)"),
    ("noi_sinh_dia_chi", "TEXT"),
    ("tinh_que_quan", "VARCHAR(100)"),
    ("huyen_que_quan", "VARCHAR(100)"),
    ("phuong_que_quan", "VARCHAR(100)"),
    ("dia_chi_que_quan", "TEXT"),
    ("tinh_ho_khau", "VARCHAR(100)"),
    ("huyen_ho_khau", "VARCHAR(100)"),
    ("phuong_ho_khau", "VARCHAR(100)"),
    ("dia_chi_ho_khau", "TEXT"),
    ("dia_chi_hien_tai", "TEXT"),
    ("dien_thoai_ban", "VARCHAR(20)"),
    ("avatar_url", "VARCHAR(500)"),
    # Sơ yếu + Học vấn (giai đoạn 2 — Sprint A part 2)
    ("trinh_do_hoc_van", "VARCHAR(100)"),
    ("chuyen_nganh", "VARCHAR(150)"),
    ("truong_dao_tao", "VARCHAR(255)"),
    ("nam_tot_nghiep", "INTEGER"),
    ("ngoai_ngu", "VARCHAR(150)"),
    ("tin_hoc", "VARCHAR(150)"),
    ("ky_nang_khac", "TEXT"),
    ("so_yeu_tom_tat", "TEXT"),
    # BHXH / BHYT
    ("so_so_bhxh", "VARCHAR(30)"),
    ("ngay_tham_gia_bhxh", "DATE"),
    ("ma_bhyt", "VARCHAR(30)"),
    ("noi_kham_chua_benh", "VARCHAR(255)"),
    ("muc_dong_bhxh", "NUMERIC(18, 2)"),
]


def main() -> None:
    print("─── ALTER hr_employees: add new columns ───")
    with engine.begin() as conn:
        for col, coltype in NEW_EMPLOYEE_COLUMNS:
            # PostgreSQL 9.6+ supports IF NOT EXISTS for ADD COLUMN
            sql = f"ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS {col} {coltype}"
            conn.execute(text(sql))
            print(f"  ✓ {col:<25} {coltype}")

    print()
    print("─── CREATE TABLE hr_family_relations (if not exists) ───")
    Base.metadata.create_all(
        bind=engine,
        tables=[hr_models.FamilyRelation.__table__],
        checkfirst=True,
    )
    print("  ✓ hr_family_relations")

    # Backfill: split existing ho_ten into ho_dem + ten where ho_dem is NULL
    print()
    print("─── Backfill ho_dem + ten from ho_ten ───")
    with engine.begin() as conn:
        result = conn.execute(text("""
            UPDATE hr_employees
            SET
                ho_dem = NULLIF(TRIM(BOTH ' ' FROM SUBSTRING(ho_ten FROM '^(.*)\\s+\\S+$')), ''),
                ten    = NULLIF(SUBSTRING(ho_ten FROM '\\S+$'), '')
            WHERE ho_dem IS NULL AND ten IS NULL AND ho_ten IS NOT NULL
        """))
        print(f"  ✓ Backfilled {result.rowcount} rows")

    print()
    print("Done.")


if __name__ == "__main__":
    main()
