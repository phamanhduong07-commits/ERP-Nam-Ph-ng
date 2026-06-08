"""
Remap other_materials.ma_nhom_id → đúng material_groups.id hiện tại
Nguồn: HTCPH DMNLK.MaNHOM (varchar code) → ERP material_groups.ma_nhom → id

Các nhóm HTCPH không import vào ERP được fallback về nhóm tương đương:
  BANGCAOSU/BANGPOLIME/CSU/KHUONBE/MUCIN → IN_AN
  BORAT/BOT_MI/CCTHAM/XUT/KEO/KEOATM/KEODAN/VLP-KEO → HOA_CHAT
  BK2M/KEO_GIAY/VLP-MANG/DAYCOT/DBUOC → DONG_GOI
  VLP → NVL_KHAC
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))

from dotenv import load_dotenv
load_dotenv(".env")

import pyodbc
from sqlalchemy import create_engine, text
from app.config import settings

SS_CONN = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=203.162.54.176,1441;"
    "DATABASE=HTCPH;"
    "UID=duong;"
    "PWD=Namphuong123@;"
    "TrustServerCertificate=yes;"
    "Connection Timeout=20;"
)

FALLBACK = {
    "BANGCAOSU":  "IN_AN",
    "BANGPOLIME": "IN_AN",
    "CSU":        "IN_AN",
    "KHUONBE":    "IN_AN",
    "MUCIN":      "IN_AN",
    "BORAT":      "HOA_CHAT",
    "BOT_MI":     "HOA_CHAT",
    "CCTHAM":     "HOA_CHAT",
    "XUT":        "HOA_CHAT",
    "KEO":        "HOA_CHAT",
    "KEOATM":     "HOA_CHAT",
    "KEODAN":     "HOA_CHAT",
    "VLP-KEO":    "HOA_CHAT",
    "BK2M":       "DONG_GOI",
    "KEO_GIAY":   "DONG_GOI",
    "VLP-MANG":   "DONG_GOI",
    "DAYCOT":     "DONG_GOI",
    "DBUOC":      "DONG_GOI",
    "VLP":        "NVL_KHAC",
}


def run():
    engine = create_engine(settings.DATABASE_URL)

    # 1. ERP nhom map: ma_nhom → id
    with engine.connect() as pg:
        nhom_map = {
            r[0].strip().upper(): r[1]
            for r in pg.execute(text("SELECT ma_nhom, id FROM material_groups")).fetchall()
        }

    def resolve(ma_nhom_htcph: str) -> int | None:
        code = (ma_nhom_htcph or "").strip().upper()
        if code in nhom_map:
            return nhom_map[code]
        fallback_code = FALLBACK.get(code, "").upper()
        return nhom_map.get(fallback_code)

    # 2. HTCPH: lấy toàn bộ (Ma, MaNHOM) từ DMNLK
    ss = pyodbc.connect(SS_CONN)
    cur = ss.cursor()
    cur.execute("SELECT Ma, MaNHOM FROM DMNLK")
    htcph_map = {
        r[0].strip(): (r[1] or "").strip()
        for r in cur.fetchall()
    }
    ss.close()

    # 3. Update từng other_material
    updated = skipped_no_htcph = skipped_no_nhom = already_ok = 0
    unknown_nhom: set[str] = set()

    with engine.begin() as pg:
        rows = pg.execute(text(
            "SELECT id, ma_chinh, ma_nhom_id FROM other_materials"
        )).fetchall()

        for om_id, ma_chinh, current_nhom_id in rows:
            htcph_nhom_code = htcph_map.get(ma_chinh.strip() if ma_chinh else "")
            if htcph_nhom_code is None:
                skipped_no_htcph += 1
                continue

            new_id = resolve(htcph_nhom_code)
            if new_id is None:
                unknown_nhom.add(htcph_nhom_code)
                skipped_no_nhom += 1
                continue

            if current_nhom_id == new_id:
                already_ok += 1
                continue

            pg.execute(
                text("UPDATE other_materials SET ma_nhom_id = :nid WHERE id = :oid"),
                {"nid": new_id, "oid": om_id},
            )
            updated += 1

    print(f"Updated:              {updated}")
    print(f"Already correct:      {already_ok}")
    print(f"Skip (not in HTCPH):  {skipped_no_htcph}")
    print(f"Skip (nhom unknown):  {skipped_no_nhom}")
    if unknown_nhom:
        print(f"Unknown nhom codes:   {sorted(unknown_nhom)}")


if __name__ == "__main__":
    run()
