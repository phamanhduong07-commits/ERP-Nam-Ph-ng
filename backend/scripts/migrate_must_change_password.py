"""Migration: thêm must_change_password vào users.

Idempotent.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from app.database import engine


def main() -> None:
    print("─── ALTER users: add must_change_password ───")
    with engine.begin() as conn:
        conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
            "must_change_password BOOLEAN DEFAULT FALSE NOT NULL"
        ))
        print("  ✓ must_change_password BOOLEAN DEFAULT FALSE")
    print("\nDone.")


if __name__ == "__main__":
    main()
