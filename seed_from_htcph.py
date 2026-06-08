"""
Seed don_vi_tinh, xe, tai_xe từ SQL Server HTCPH → ERP PostgreSQL
Idempotent: bỏ qua record đã tồn tại (theo ten/bien_so/ho_ten).
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "backend"))

from dotenv import load_dotenv
load_dotenv(".env")

import pyodbc
from datetime import datetime, timezone
from sqlalchemy import create_engine, text
from app.config import settings

NOW = datetime.now(timezone.utc)

SS_CONN = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=203.162.54.176,1441;"
    "DATABASE=HTCPH;"
    "UID=duong;"
    "PWD=Namphuong123@;"
    "TrustServerCertificate=yes;"
    "Connection Timeout=20;"
)

engine = create_engine(settings.DATABASE_URL)


def seed_don_vi_tinh(ss, pg):
    ss.execute("SELECT ID, DVT FROM DMDVT ORDER BY ID")
    rows = ss.fetchall()

    existing = {r[0].strip().lower() for r in pg.execute(text("SELECT ten FROM don_vi_tinh")).fetchall()}
    inserted = 0
    for r in rows:
        ten = (r[1] or "").strip()
        if not ten or ten.lower() in existing:
            continue
        pg.execute(
            text("INSERT INTO don_vi_tinh (ten, trang_thai, created_at) VALUES (:ten, true, :now)"),
            {"ten": ten, "now": NOW},
        )
        existing.add(ten.lower())
        inserted += 1
    print(f"  don_vi_tinh: +{inserted} / {len(rows)} rows")


def seed_xe(ss, pg):
    ss.execute("SELECT SoXe, Loai, TaiTrong FROM DMXe ORDER BY ID")
    rows = ss.fetchall()

    existing = {r[0].strip().upper() for r in pg.execute(text("SELECT bien_so FROM xe")).fetchall()}
    inserted = 0
    for r in rows:
        bien_so = (r[0] or "").strip()
        if not bien_so or bien_so.upper() in existing:
            continue
        loai = (r[1] or "").strip() or None
        trong_tai = float(r[2]) if r[2] else None
        pg.execute(
            text("""
                INSERT INTO xe (bien_so, loai_xe, trong_tai, trang_thai, created_at)
                VALUES (:bien_so, :loai_xe, :trong_tai, true, :now)
            """),
            {"bien_so": bien_so, "loai_xe": loai, "trong_tai": trong_tai, "now": NOW},
        )
        existing.add(bien_so.upper())
        inserted += 1
    print(f"  xe:          +{inserted} / {len(rows)} rows")


def seed_tai_xe(ss, pg):
    ss.execute("SELECT TenLX, SoDT FROM DMLX ORDER BY ID")
    rows = ss.fetchall()

    existing = {r[0].strip().lower() for r in pg.execute(text("SELECT ho_ten FROM tai_xe")).fetchall()}
    inserted = 0
    for r in rows:
        ho_ten = (r[0] or "").strip()
        if not ho_ten or ho_ten.lower() in existing:
            continue
        sdt = (r[1] or "").strip() or None
        pg.execute(
            text("""
                INSERT INTO tai_xe (ho_ten, so_dien_thoai, trang_thai, created_at)
                VALUES (:ho_ten, :sdt, true, :now)
            """),
            {"ho_ten": ho_ten, "sdt": sdt, "now": NOW},
        )
        existing.add(ho_ten.lower())
        inserted += 1
    print(f"  tai_xe:      +{inserted} / {len(rows)} rows")


def run():
    ss_conn = pyodbc.connect(SS_CONN)
    ss = ss_conn.cursor()

    with engine.begin() as pg:
        seed_don_vi_tinh(ss, pg)
        seed_xe(ss, pg)
        seed_tai_xe(ss, pg)

    ss_conn.close()
    print("Done.")


if __name__ == "__main__":
    run()
