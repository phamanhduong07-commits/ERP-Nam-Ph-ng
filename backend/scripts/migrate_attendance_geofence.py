"""Sprint B migration: extend hr_attendance_logs + create hr_checkin_locations.

Idempotent (uses IF NOT EXISTS). Bypasses alembic (chain broken).

Usage:
    python scripts/migrate_attendance_geofence.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from app.database import engine, Base
from app.models import hr as hr_models


# Columns to ADD to hr_attendance_logs
NEW_ATTENDANCE_COLUMNS = [
    ("checkin_lat", "DOUBLE PRECISION"),
    ("checkin_lng", "DOUBLE PRECISION"),
    ("checkin_address", "TEXT"),
    ("checkin_selfie_url", "VARCHAR(500)"),
    ("checkin_location_id", "INTEGER"),
    ("checkin_distance_m", "DOUBLE PRECISION"),
    ("checkout_lat", "DOUBLE PRECISION"),
    ("checkout_lng", "DOUBLE PRECISION"),
    ("checkout_address", "TEXT"),
    ("checkout_selfie_url", "VARCHAR(500)"),
    ("checkout_distance_m", "DOUBLE PRECISION"),
]


def main() -> None:
    print("─── CREATE TABLE hr_checkin_locations (if not exists) ───")
    Base.metadata.create_all(
        bind=engine,
        tables=[hr_models.CheckInLocation.__table__],
        checkfirst=True,
    )
    print("  ✓ hr_checkin_locations")

    print()
    print("─── ALTER hr_attendance_logs: add new geo columns ───")
    with engine.begin() as conn:
        for col, coltype in NEW_ATTENDANCE_COLUMNS:
            sql = f"ALTER TABLE hr_attendance_logs ADD COLUMN IF NOT EXISTS {col} {coltype}"
            conn.execute(text(sql))
            print(f"  ✓ {col:<25} {coltype}")

        # Add FK constraint for checkin_location_id (skip if already exists)
        try:
            conn.execute(text("""
                ALTER TABLE hr_attendance_logs
                ADD CONSTRAINT hr_attendance_logs_checkin_location_id_fkey
                FOREIGN KEY (checkin_location_id) REFERENCES hr_checkin_locations(id)
                ON DELETE SET NULL
            """))
            print("  ✓ FK checkin_location_id → hr_checkin_locations.id")
        except Exception as exc:  # noqa: BLE001
            msg = str(exc)
            if "already exists" in msg.lower():
                print("  ✓ FK already exists (skipped)")
            else:
                print(f"  ⚠ FK skipped: {msg[:100]}")

    print()
    print("Done.")


if __name__ == "__main__":
    main()
