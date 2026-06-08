"""
Seed material_groups từ HTCPH DMNhomGiay → ERP
Chỉ import nhóm không có tương đương trong ERP.

Mapping phân tích:
  SKIP → IN_AN:    BANGCAOSU, BANGPOLIME, CSU, KHUONBE, MUCIN
  SKIP → HOA_CHAT: BORAT, BOT_MI, CCTHAM, XUT, KEO, KEOATM, KEODAN, VLP-KEO
  SKIP → DONG_GOI: BK2M, KEO_GIAY, VLP-MANG, DAYCOT, DBUOC
  SKIP (duplicate): VLP (= NVL_KHAC)

  IMPORT (không có tương đương):
    CUI         - Củi (nguyên liệu đốt)
    D-KEM       - Dây kẽm
    GCX1        - Gia công xưởng 1
    GCX2        - Gia công xưởng 2
    GIAYTAM     - Giấy tấm (giấy phẳng, khác giấy cuộn)
    KEM_COT_BANH- Kẽm cột bành
    NVL_KHAC    - NVL khác (catch-all, ERP chưa có)
    THANH V     - Thanh V (thanh góc bảo vệ)
    VPP         - Văn phòng phẩm
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "backend"))

from dotenv import load_dotenv
load_dotenv(".env")

from datetime import datetime, timezone
from sqlalchemy import create_engine, text
from app.config import settings

NOW = datetime.now(timezone.utc)

IMPORT_LIST = [
    ("CUI",          "Củi",               False, "Đóng dán"),
    ("D-KEM",        "Dây kẽm",           False, None),
    ("GCX1",         "Gia công xưởng 1",  False, None),
    ("GCX2",         "Gia công xưởng 2",  False, None),
    ("GIAYTAM",      "Giấy tấm",          False, None),
    ("KEM_COT_BANH", "Kẽm cột bành",      False, "Máy sóng"),
    ("NVL_KHAC",     "NVL khác",          False, None),
    ("THANH V",      "Thanh V",           False, None),
    ("VPP",          "Văn phòng phẩm",    False, None),
]


def run():
    engine = create_engine(settings.DATABASE_URL)
    with engine.begin() as pg:
        existing = {
            r[0].strip().upper()
            for r in pg.execute(text("SELECT ma_nhom FROM material_groups")).fetchall()
        }

        inserted = 0
        for ma, ten, la_giay, bo_phan in IMPORT_LIST:
            if ma.upper() in existing:
                print(f"  [SKIP] {ma:20s} — đã tồn tại")
                continue
            pg.execute(
                text("""
                    INSERT INTO material_groups
                        (ma_nhom, ten_nhom, la_nhom_giay, bo_phan, trang_thai, created_at)
                    VALUES
                        (:ma, :ten, :la_giay, :bo_phan, true, :now)
                """),
                {"ma": ma, "ten": ten, "la_giay": la_giay, "bo_phan": bo_phan, "now": NOW},
            )
            print(f"  [OK]   {ma:20s} — {ten}")
            inserted += 1

    print(f"\nKết quả: +{inserted} nhóm mới / {len(IMPORT_LIST)} cần import")


if __name__ == "__main__":
    run()
