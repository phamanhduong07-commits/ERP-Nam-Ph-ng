"""
migrate_ket_cau.py — Link hàng hóa với kết cấu giấy từ lịch sử báo giá HTCPH

Logic:
  DMHH.MaHH (A&M_32*19*41_3L)
    → MaKH prefix = "A&M"
    → MTBaoGia.MaKH = "A&M" (lấy báo giá gần nhất)
    → DTBaoGia.Dai=32, Rong=19, Cao=41, Lop=3
    → kết cấu giấy + addon

Output:
  1. CauTrucThongDung — populate các kết cấu distinct từ DTBaoGia
  2. Product.so_mau, ghim, dan — update từ DTBaoGia match
"""
import sys, re, os
sys.stdout.reconfigure(encoding="utf-8")

import pyodbc
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "backend"))

from app.database import SessionLocal
from app.models.master import CauTrucThongDung, Product
import sqlalchemy as sa

SS_CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=203.162.54.176,1441;"
    "DATABASE=HTCPH;"
    "UID=duong;"
    "PWD=Namphuong123@;"
    "TrustServerCertificate=yes;"
    "Connection Timeout=20;"
)


def clean(v, maxlen=None):
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    return s[:maxlen] if maxlen else s


def parse_mhh(mhh: str):
    """
    'A&M_32*19*41_3L' → ('A&M', 32.0, 19.0, 41.0, 3)
    'AAP_120*120_3L'  → ('AAP', 120.0, 120.0, 0.0, 3)
    """
    m = re.search(r'^([^_]+)_(\d+\.?\d*)\*(\d+\.?\d*)(?:\*(\d+\.?\d*))?_(\d+)L', mhh)
    if not m:
        return None
    return (
        m.group(1),
        float(m.group(2)),
        float(m.group(3)),
        float(m.group(4) or 0),
        int(m.group(5)),
    )


def to_hop_song_from_ketcau(lop: int, sb: str, sc: str, se: str) -> str | None:
    """Đoán tổ hợp sóng từ các cột sóng."""
    parts = []
    if sb:
        parts.append("B")
    if sc:
        parts.append("C")
    if se:
        parts.append("E")
    return "".join(parts) or None


# ── Fetch từ SQL Server ───────────────────────────────────────────────────────
print("Kết nối SQL Server...")
conn = pyodbc.connect(SS_CONN_STR)
cur = conn.cursor()

# 1. DMHH
cur.execute("SELECT MaHH FROM DMHH WHERE MaHH IS NOT NULL")
all_mahh = [r[0].strip() for r in cur.fetchall() if r[0]]

# 2. DTBaoGia + MTBaoGia — chỉ lấy dòng có kết cấu
cur.execute("""
    SELECT
        mb.MaKH,
        dt.Dai, dt.Rong, dt.Cao, dt.Lop,
        dt.KetCau,
        dt.Mat_Giay,  dt.SB_Giay,  dt.MB_Giay,
        dt.SC_Giay,   dt.MC_Giay,
        dt.SE_Giay,   dt.ME_Giay,
        dt.Mat_DL,    dt.SB_DL,    dt.MB_DL,
        dt.SC_DL,     dt.MC_DL,
        dt.Ghim, dt.Dan, dt.LoaiIn, dt.isBoi, dt.isBe, dt.isCanMan, dt.isChongTham,
        mb.NgayCT
    FROM DTBaoGia dt
    JOIN MTBaoGia mb ON mb.MTBGID = dt.MTBGID
    WHERE dt.Dai IS NOT NULL AND dt.Rong IS NOT NULL
      AND mb.MaKH IS NOT NULL
      AND dt.Mat_Giay IS NOT NULL AND dt.Mat_Giay != ''
    ORDER BY mb.NgayCT ASC
""")
cols = [c[0] for c in cur.description]
bg_rows = [dict(zip(cols, r)) for r in cur.fetchall()]
conn.close()

print(f"DMHH: {len(all_mahh)} | DTBaoGia có kết cấu: {len(bg_rows)}")

# ── Build lookup (MaKH, Dai, Rong, Cao, Lop) → latest DTBaoGia row ──────────
# ORDER BY NgayCT ASC rồi overwrite → key cuối = mới nhất
lookup: dict[tuple, dict] = {}
for row in bg_rows:
    key = (
        (row["MaKH"] or "").strip(),
        round(row["Dai"] or 0, 1),
        round(row["Rong"] or 0, 1),
        round(row["Cao"] or 0, 1),
        int(row["Lop"] or 3),
    )
    lookup[key] = row

# ── Parse DMHH ───────────────────────────────────────────────────────────────
parsed_products: list[tuple] = []  # (MaHH, MaKH, Dai, Rong, Cao, Lop)
for mhh in all_mahh:
    p = parse_mhh(mhh)
    if p:
        parsed_products.append((mhh,) + p)

print(f"DMHH parse được dims: {len(parsed_products)}/{len(all_mahh)}")

# Match
matches: dict[str, dict] = {}  # MaHH → DTBaoGia row
for mhh, makh, dai, rong, cao, lop in parsed_products:
    key = (makh, round(dai, 1), round(rong, 1), round(cao, 1), lop)
    if key in lookup:
        matches[mhh] = lookup[key]

print(f"Matched: {len(matches)}/{len(parsed_products)} ({len(matches)*100//len(parsed_products) if parsed_products else 0}%)")


# ── Step 1: Populate CauTrucThongDung ────────────────────────────────────────
# Dedup bằng đầy đủ: (so_lop, Mat_Giay, SB_Giay, MB_Giay, SC_Giay, MC_Giay, SE_Giay, ME_Giay)
# Mỗi combo mã giấy cụ thể = 1 cấu trúc riêng
def giay_key(row: dict) -> tuple:
    return (
        int(row.get("Lop") or 3),
        clean(row.get("Mat_Giay"), 30) or "",
        clean(row.get("SB_Giay"),  30) or "",
        clean(row.get("MB_Giay"),  30) or "",
        clean(row.get("SC_Giay"),  30) or "",
        clean(row.get("MC_Giay"),  30) or "",
        clean(row.get("SE_Giay"),  30) or "",
        clean(row.get("ME_Giay"),  30) or "",
    )

unique_cau_truc: dict[tuple, dict] = {}
for mhh, row in matches.items():
    if not row.get("Mat_Giay"):  # bỏ qua record thiếu mã giấy
        continue
    key = giay_key(row)
    if key not in unique_cau_truc:
        unique_cau_truc[key] = row

print(f"\nCấu trúc distinct (có mã giấy): {len(unique_cau_truc)}")

db = SessionLocal()
try:
    # Unique key: (so_lop, mat, song_1, mat_1, song_2, mat_2, song_3, mat_3)
    existing_ct: set[tuple] = set()
    for r in db.execute(sa.text(
        "SELECT so_lop, mat, song_1, mat_1, song_2, mat_2, song_3, mat_3 "
        "FROM cau_truc_thong_dung"
    )):
        existing_ct.add(tuple(r))

    # Alias cho MB_Giay, MC_Giay vào mat_1, mat_2
    ct_new = 0
    for key, row in unique_cau_truc.items():
        lop = key[0]
        mat_g  = clean(row.get("Mat_Giay"), 30)
        sb_g   = clean(row.get("SB_Giay"),  30)
        mb_g   = clean(row.get("MB_Giay"),  30)
        sc_g   = clean(row.get("SC_Giay"),  30)
        mc_g   = clean(row.get("MC_Giay"),  30)
        se_g   = clean(row.get("SE_Giay"),  30)
        me_g   = clean(row.get("ME_Giay"),  30)

        dup_key = (lop, mat_g, sb_g, mb_g, sc_g, mc_g, se_g, me_g)
        if dup_key in existing_ct:
            continue

        # Tên hiển thị: KetCau + mô tả lớp giấy rõ ràng
        ketcau_str = clean(row.get("KetCau")) or ""
        layers = []
        if mat_g:
            dl = int(row["Mat_DL"]) if row.get("Mat_DL") else "?"
            layers.append(f"Mặt:{mat_g}({dl})")
        if sb_g:
            dl = int(row["SB_DL"]) if row.get("SB_DL") else "?"
            layers.append(f"SóngB:{sb_g}({dl})")
        if mb_g:
            dl = int(row["MB_DL"]) if row.get("MB_DL") else "?"
            layers.append(f"MB:{mb_g}({dl})")
        if sc_g:
            dl = int(row["SC_DL"]) if row.get("SC_DL") else "?"
            layers.append(f"SóngC:{sc_g}({dl})")
        if mc_g:
            dl = int(row["MC_DL"]) if row.get("MC_DL") else "?"
            layers.append(f"MC:{mc_g}({dl})")
        ten_ct = f"{ketcau_str} | {' / '.join(layers)}"[:149]

        to_hop = to_hop_song_from_ketcau(lop, sb_g or "", sc_g or "", se_g or "")

        obj = CauTrucThongDung(
            ten_cau_truc=ten_ct,
            so_lop=lop,
            to_hop_song=to_hop,
            mat=mat_g,
            mat_dl=Decimal(str(row["Mat_DL"])) if row.get("Mat_DL") else None,
            song_1=sb_g,
            song_1_dl=Decimal(str(row["SB_DL"])) if row.get("SB_DL") else None,
            mat_1=mb_g,
            mat_1_dl=Decimal(str(row["MB_DL"])) if row.get("MB_DL") else None,
            song_2=sc_g,
            song_2_dl=Decimal(str(row["SC_DL"])) if row.get("SC_DL") else None,
            mat_2=mc_g,
            mat_2_dl=Decimal(str(row["MC_DL"])) if row.get("MC_DL") else None,
            song_3=se_g,
            song_3_dl=Decimal(str(row["SE_DL"])) if row.get("SE_DL") else None,
            mat_3=me_g,
            mat_3_dl=Decimal(str(row["ME_DL"])) if row.get("ME_DL") else None,
            trang_thai=True,
            thu_tu=ct_new,
        )
        db.add(obj)
        existing_ct.add(dup_key)
        ct_new += 1

    db.flush()
    # Reload map: (ten_cau_truc, so_lop) → id
    ct_id_map = {
        (r[0], r[1]): r[2]
        for r in db.execute(
            sa.text("SELECT ten_cau_truc, so_lop, id FROM cau_truc_thong_dung")
        )
    }
    print(f"CauTrucThongDung: +{ct_new} mới")

    # ── Step 2: Update products (so_mau, ghim, dan + ghi_chu KetCau) ─────────
    prod_map = {
        r[0]: r[1]
        for r in db.execute(sa.text("SELECT ma_amis, id FROM products"))
    }

    updated = 0
    for mhh, row in matches.items():
        prod_id = prod_map.get(mhh)
        if not prod_id:
            continue

        loai_in = int(row.get("LoaiIn") or 0)
        ghim = bool(row.get("Ghim"))
        dan = bool(row.get("Dan"))
        ketcau_str = clean(row.get("KetCau"))

        db.execute(
            sa.text("""
                UPDATE products
                SET so_mau = :so_mau,
                    ghim   = :ghim,
                    dan    = :dan,
                    ghi_chu = CASE
                        WHEN ghi_chu IS NULL OR ghi_chu = '' THEN :ketcau
                        ELSE ghi_chu || ' | KetCau: ' || :ketcau
                    END
                WHERE id = :id
            """),
            {
                "so_mau": loai_in,
                "ghim": ghim,
                "dan": dan,
                "ketcau": ketcau_str or "",
                "id": prod_id,
            },
        )
        updated += 1
        if updated % 1000 == 0:
            print(f"  ... {updated} sản phẩm cập nhật")

    db.commit()
    print(f"Products updated: {updated}")
    print("\n=== Hoàn thành ===")

except Exception as e:
    db.rollback()
    raise
finally:
    db.close()
