"""
Seed NVL phụ từ danh sách bảng giá.
Tạo: 4 nhóm vật tư mới + 18 vật tư phụ (dùng NCC đã có trong DB).
Chạy: python seed_nvl_phu.py
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import psycopg2

DB_URL = "postgresql://erp_user:erp_password@localhost:5432/erp_nam_phuong"

# ── 1. Nhóm vật tư phụ (la_nhom_giay=False) ──────────────────────────────────
GROUPS = [
    ("HOA_CHAT", "Hóa chất & Keo sản xuất"),
    ("DONG_GOI", "Vật tư đóng gói"),
    ("IN_AN",    "Mực & Vật tư in"),
    ("PHU_TUNG", "Phụ tùng máy"),
]

# ── 2. Map NCC từ hình → ma_ncc đã có trong DB ────────────────────────────────
# Hà Thiên Phát=HTPHAT | K-Print=K-PRINT | Gia Phú=GPHU | Tín Đạt Phát=TDPHAT
# Thuận Duyên=TDUYEN | Địa Phong=ÐP | Lê Gia Phát=LGP | Tú Phương=TPG
# Hùng Cường=HCUONG | Kim Nhật=KNHAT | Hoa Việt=HVIET | Hoa Cân=HC

# ── 3. Vật tư phụ ─────────────────────────────────────────────────────────────
# (ma_chinh, ten, dvt, gia_mua, ma_nhom_code, ma_ncc_existing, ghi_chu)
MATERIALS = [
    # Hóa chất & Keo
    ("BOT_MI",    "Bột Mì",             "Kg",    15000,  "HOA_CHAT", "HTPHAT",  None),
    ("KEO_BOI",   "Keo Bồi",            "Kg",    14800,  "HOA_CHAT", "GPHU",    None),
    ("CHAT_OD",   "Chất Ổn Định",       "Kg",    33000,  "HOA_CHAT", "TDPHAT",  None),
    ("CHAT_KD",   "Chất Kết Dính",      "Kg",    33000,  "HOA_CHAT", "TDPHAT",  None),
    ("XUT_NAOH",  "Xút (NaOH)",         "Kg",    21296,  "HOA_CHAT", "TDUYEN",  None),
    ("BORAT",     "Borat",              "Kg",    21296,  "HOA_CHAT", "TDUYEN",  None),
    ("CHAT_CT",   "Chất Chống Thấm",    "Kg",    53600,  "HOA_CHAT", "ÐP",      None),
    # Đóng gói
    ("MANG_CO",   "Màng Co",            "Cuộn", 125000,  "DONG_GOI", "LGP",     None),
    ("BKG",       "Băng Keo Giấy",      "Cuộn",  12300,  "DONG_GOI", "LGP",     None),
    ("BKT_L",     "Băng Keo Trong Lớn", "Cuộn",   8300,  "DONG_GOI", "LGP",     None),
    ("BKT_N",     "Băng Keo Nhỏ",       "Cây",   15000,  "DONG_GOI", "LGP",     None),
    ("MANG",      "Màng",               "Kg",    53000,  "DONG_GOI", "TPG",     None),
    ("DAY_BUOC",  "Dây Buộc",           "Kg",    44000,  "DONG_GOI", "HCUONG",  None),
    # Mực in
    ("MUC_KTS",   "Mực Kỹ Thuật Số",   "Thùng", 310000, "IN_AN",    "K-PRINT", None),
    # Phụ tùng máy
    ("KEM_NHO",   "Kẽm Nhỏ",           "Kg",    27000,  "PHU_TUNG", "KNHAT",   None),
    ("KEM_LON",   "Kẽm Lớn",           "Kg",    27000,  "PHU_TUNG", "HVIET",   None),
    ("CAO_SU_4L", "Cao Su 4 Li",        "Cái",  650000,  "PHU_TUNG", "HC",      "thường mua"),
    ("CAO_SU_7L", "Cao Su 7 Li",        "Cái",   95000,  "PHU_TUNG", "HC",      None),
]


def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # 1. Tạo 4 nhóm NVL phụ
    group_id_map: dict[str, int] = {}
    print("=== Nhóm vật tư phụ ===")
    for ma, ten in GROUPS:
        cur.execute("""
            INSERT INTO material_groups (ma_nhom, ten_nhom, la_nhom_giay, trang_thai, created_at)
            VALUES (%s, %s, FALSE, TRUE, NOW())
            ON CONFLICT (ma_nhom) DO UPDATE SET ten_nhom = EXCLUDED.ten_nhom
            RETURNING id
        """, (ma, ten))
        gid = cur.fetchone()[0]
        group_id_map[ma] = gid
        print(f"  [{gid}] {ma} → {ten}")
    conn.commit()

    # 2. Load NCC id theo ma_ncc đã có
    ncc_codes = {row[5] for row in MATERIALS}
    ncc_id_map: dict[str, int] = {}
    for code in ncc_codes:
        cur.execute("SELECT id FROM suppliers WHERE ma_ncc = %s", (code,))
        row = cur.fetchone()
        if not row:
            raise RuntimeError(f"NCC không tìm thấy: '{code}' — kiểm tra lại ma_ncc trong DB")
        ncc_id_map[code] = row[0]
    print(f"\nLoaded {len(ncc_id_map)} NCC từ DB.")

    # 3. Tạo vật tư phụ
    print("\n=== Vật tư phụ ===")
    created = updated = 0
    for ma_chinh, ten, dvt, gia_mua, nhom_code, ncc_code, ghi_chu in MATERIALS:
        nhom_id = group_id_map[nhom_code]
        ncc_id  = ncc_id_map[ncc_code]
        cur.execute("""
            INSERT INTO other_materials
                (ma_chinh, ten, dvt, ma_nhom_id, gia_mua, ma_ncc_id, ghi_chu,
                 trang_thai, ton_toi_thieu, gia_dinh_muc, khong_tinh_nxt, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE, 0, 0, FALSE, NOW(), NOW())
            ON CONFLICT (ma_chinh) DO UPDATE SET
                ten        = EXCLUDED.ten,
                dvt        = EXCLUDED.dvt,
                gia_mua    = EXCLUDED.gia_mua,
                ma_nhom_id = EXCLUDED.ma_nhom_id,
                ma_ncc_id  = EXCLUDED.ma_ncc_id,
                ghi_chu    = EXCLUDED.ghi_chu
            RETURNING (xmax = 0) AS inserted
        """, (ma_chinh, ten, dvt, nhom_id, gia_mua, ncc_id, ghi_chu))
        inserted = cur.fetchone()[0]
        if inserted:
            created += 1
            print(f"  [NEW] {ma_chinh} – {ten} ({dvt}) {gia_mua:,.0f}đ")
        else:
            updated += 1
            print(f"  [UPD] {ma_chinh} – {ten}")
    conn.commit()
    conn.close()

    print(f"\nDone! {created} tạo mới, {updated} cập nhật.")


if __name__ == "__main__":
    main()
