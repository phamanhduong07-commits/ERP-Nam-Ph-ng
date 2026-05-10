"""
Seed material_groups từ GIAYCUON.csv và cập nhật ma_nhom_id trong paper_materials.
"""
import csv
import io
import psycopg2

CSV_PATH = r"GIAYCUON.csv"  # đặt CSV cùng thư mục hoặc sửa path

TEN_NHOM_MAP = {
    "N":   "Nâu thường",
    "NB":  "Nâu B (đáy)",
    "NE":  "Nâu E (Cheng Loong E)",
    "NH":  "Nâu H (High)",
    "NL":  "Nâu L (Chinh Long)",
    "NP":  "Nâu P",
    "NS":  "Nâu S",
    "T":   "Trắng thường",
    "TI":  "Trắng I",
    "TW":  "Trắng W (White top)",
    "V":   "Vàng thường",
    "VA":  "Vàng sầu riêng",
    "VL":  "Vàng L",
    "VLA": "Vàng LA",
    "X":   "Xeo không gia keo",
    "XK":  "Xeo gia keo",
}

def main():
    # 1. Đọc CSV → map ma_chinh → ma_nhom
    ma_to_nhom = {}   # { ma_chinh: ma_nhom_code }
    unique_nhom = {}  # { ma_nhom_code: ten_nhom }

    try:
        with open(CSV_PATH, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ma = (row.get("Ma") or "").strip()
                nhom = (row.get("MaNHOM") or "").strip()
                if ma and nhom:
                    ma_to_nhom[ma] = nhom
                    if nhom not in unique_nhom:
                        unique_nhom[nhom] = TEN_NHOM_MAP.get(nhom, f"Nhóm {nhom}")
    except FileNotFoundError:
        print(f"Không tìm thấy file: {CSV_PATH}")
        print("Hãy copy GIAYCUON.csv vào thư mục backend/ rồi chạy lại.")
        return

    print(f"Tìm thấy {len(unique_nhom)} nhóm: {sorted(unique_nhom.keys())}")
    print(f"Tổng số paper mapping: {len(ma_to_nhom)}")

    conn = psycopg2.connect("postgresql://erp_user:erp_password@localhost:5432/erp_nam_phuong")
    cur = conn.cursor()

    # 2. Tạo groups (INSERT OR IGNORE nếu đã có)
    nhom_id_map = {}  # { ma_nhom_code: id }
    for code, ten in sorted(unique_nhom.items()):
        cur.execute("""
            INSERT INTO material_groups (ma_nhom, ten_nhom, la_nhom_giay, trang_thai)
            VALUES (%s, %s, TRUE, TRUE)
            ON CONFLICT (ma_nhom) DO UPDATE SET ten_nhom = EXCLUDED.ten_nhom
            RETURNING id
        """, (code, ten))
        gid = cur.fetchone()[0]
        nhom_id_map[code] = gid
        print(f"  Group [{gid}] {code} → {ten}")

    conn.commit()

    # 3. Cập nhật ma_nhom_id trong paper_materials theo ma_chinh
    updated = 0
    skipped = 0
    for ma_chinh, nhom_code in ma_to_nhom.items():
        gid = nhom_id_map.get(nhom_code)
        if not gid:
            skipped += 1
            continue
        cur.execute("""
            UPDATE paper_materials SET ma_nhom_id = %s
            WHERE ma_chinh = %s AND (ma_nhom_id IS DISTINCT FROM %s)
        """, (gid, ma_chinh, gid))
        updated += cur.rowcount

    conn.commit()
    conn.close()

    print(f"\nDone! Updated {updated} paper_materials records, skipped {skipped}.")

if __name__ == "__main__":
    main()
