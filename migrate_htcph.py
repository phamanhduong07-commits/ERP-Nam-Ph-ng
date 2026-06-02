"""
migrate_htcph.py — Import dữ liệu từ SQL Server HTCPH vào ERP Nam Phương
Chạy: python migrate_htcph.py
- Khách hàng (DMKH → customers)
- Nhà cung cấp (DMNCC → suppliers)
- Hàng hóa (DMHH → products)
- Bỏ qua nếu đã tồn tại (upsert-skip)
"""
import sys, re, os
from concurrent.futures import ThreadPoolExecutor, as_completed
from decimal import Decimal

sys.stdout.reconfigure(encoding="utf-8")

# ── Kết nối SQL Server HTCPH ─────────────────────────────────────────────────
import pyodbc

SS_CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=203.162.54.176,1441;"
    "DATABASE=HTCPH;"
    "UID=duong;"
    "PWD=Namphuong123@;"
    "TrustServerCertificate=yes;"
    "Connection Timeout=20;"
)


def ss_conn():
    return pyodbc.connect(SS_CONN_STR)


# ── Kết nối ERP (SQLAlchemy) ─────────────────────────────────────────────────
# Chạy từ thư mục gốc project, thêm backend vào path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "backend"))

from app.config import settings
from app.database import SessionLocal, engine
from app import models  # noqa — register all models

Session = SessionLocal


# ── Utility ──────────────────────────────────────────────────────────────────
def parse_dmhh_dims(ma_hh: str):
    """
    Tách D, R, C, so_lop từ MaHH dạng: MaKH_D*R*C_NLop
    VD: 'A&M_32*19*41_3L' → (32, 19, 41, 3)
    Trả về (None,None,None,3) nếu không parse được.
    """
    m = re.search(r"_(\d+\.?\d*)\*(\d+\.?\d*)(?:\*(\d+\.?\d*))?_(\d+)L", ma_hh)
    if m:
        d = Decimal(m.group(1))
        r = Decimal(m.group(2))
        c = Decimal(m.group(3)) if m.group(3) else Decimal("0")
        lop = int(m.group(4))
        return d, r, c, lop
    return None, None, None, 3


def ma_kh_from_ma_hh(ma_hh: str):
    """Lấy mã khách từ MaHH: 'A&M_32*19*41_3L' → 'A&M'"""
    parts = ma_hh.split("_")
    return parts[0] if parts else None


# ── 1. Migrate DMKH → customers ──────────────────────────────────────────────
def migrate_customers():
    con = ss_conn()
    cur = con.cursor()
    cur.execute("""
        SELECT MaKH, TenTat, TenKH, DiaChi, GiaoHang, MST,
               DienThoai, Fax, DaiDien, SDT_LH, NVPT,
               NoTran, soNgayNo, XepLoaiKH, isVIP, GhiChu, isHiden
        FROM DMKH
    """)
    rows = cur.fetchall()
    con.close()

    db = Session()
    try:
        existing = {r[0] for r in db.execute(
            __import__("sqlalchemy").text("SELECT ma_kh FROM customers")
        )}
        new_count = skip_count = 0
        for r in rows:
            ma_kh = (r[0] or "").strip()
            if not ma_kh or ma_kh in existing:
                skip_count += 1
                continue
            obj = models.master.Customer(
                ma_kh=ma_kh,
                ten_viet_tat=(r[1] or ma_kh).strip()[:100],
                ten_don_vi=(r[2] or "").strip() or None,
                dia_chi=(r[3] or "").strip() or None,
                dia_chi_giao_hang=(r[4] or "").strip() or None,
                ma_so_thue=(r[5] or "").strip() or None,
                dien_thoai=(r[6] or "").strip() or None,
                fax=(r[7] or "").strip() or None,
                nguoi_dai_dien=(r[8] or "").strip() or None,
                so_dien_thoai_lh=(r[9] or "").strip() or None,
                no_tran=Decimal(str(r[11])) if r[11] is not None else Decimal("0"),
                so_ngay_no=int(r[12]) if r[12] is not None else 0,
                xep_loai=(r[13] or "").strip() or None,
                la_khach_vip=bool(r[14]),
                ghi_chu=(r[15] or "").strip() or None,
                trang_thai=not bool(r[16]),  # isHiden=True → trang_thai=False
            )
            db.add(obj)
            existing.add(ma_kh)
            new_count += 1
            if new_count % 100 == 0:
                db.flush()
        db.commit()
        return f"Khách hàng: +{new_count} mới, {skip_count} bỏ qua"
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


# ── 2. Migrate DMNCC → suppliers ─────────────────────────────────────────────
def migrate_suppliers():
    con = ss_conn()
    cur = con.cursor()
    cur.execute("""
        SELECT MaNCC, TenTat, TenNCC, DiaChi, MST,
               DienThoai, Fax, DaiDien, DiDong, PhanLoai, MaNCCAmis
        FROM DMNCC
    """)
    rows = cur.fetchall()
    con.close()

    db = Session()
    try:
        existing = {r[0] for r in db.execute(
            __import__("sqlalchemy").text("SELECT ma_ncc FROM suppliers")
        )}
        new_count = skip_count = 0
        for r in rows:
            ma_ncc = (r[0] or "").strip()
            if not ma_ncc or ma_ncc in existing:
                skip_count += 1
                continue
            obj = models.master.Supplier(
                ma_ncc=ma_ncc,
                ten_viet_tat=(r[1] or ma_ncc).strip()[:100],
                ten_don_vi=(r[2] or "").strip() or None,
                dia_chi=(r[3] or "").strip() or None,
                ma_so_thue=(r[4] or "").strip() or None,
                dien_thoai=(r[5] or "").strip() or None,
                fax=(r[6] or "").strip() or None,
                nguoi_dai_dien=(r[7] or "").strip() or None,
                di_dong=(r[8] or "").strip() or None,
                phan_loai=(r[9] or "").strip() or None,
                ma_ncc_amis=(r[10] or "").strip() or None,
            )
            db.add(obj)
            existing.add(ma_ncc)
            new_count += 1
        db.commit()
        return f"Nhà cung cấp: +{new_count} mới, {skip_count} bỏ qua"
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


# ── 3. Migrate DMHH → products ───────────────────────────────────────────────
def migrate_products():
    con = ss_conn()
    cur = con.cursor()
    cur.execute("""
        SELECT MaHH, TenHH, DVT, GiaBan, GiaMua, GhiChu, KhongNXT, QuyCach
        FROM DMHH
    """)
    rows = cur.fetchall()
    con.close()

    db = Session()
    try:
        existing = {r[0] for r in db.execute(
            __import__("sqlalchemy").text("SELECT ma_amis FROM products")
        )}
        # Build customer map for FK
        kh_map = {r[0]: r[1] for r in db.execute(
            __import__("sqlalchemy").text("SELECT ma_kh, id FROM customers")
        )}

        new_count = skip_count = 0
        batch = []
        for r in rows:
            ma_hh = (r[0] or "").strip()
            if not ma_hh or ma_hh in existing:
                skip_count += 1
                continue

            ten_hang = (r[1] or ma_hh).strip()[:255] or ma_hh
            dvt = (r[2] or "Thùng").strip()[:20] or "Thùng"
            gia_ban = Decimal(str(r[3])) if r[3] is not None else Decimal("0")
            gia_mua = Decimal(str(r[4])) if r[4] is not None else Decimal("0")
            ghi_chu_parts = []
            if r[5]:
                ghi_chu_parts.append(r[5].strip())
            if r[7]:
                ghi_chu_parts.append(r[7].strip())
            ghi_chu = " | ".join(ghi_chu_parts) or None
            khong_tinh_nxt = bool(r[6])

            d, rong, c, so_lop = parse_dmhh_dims(ma_hh)

            # Customer FK từ prefix mã hàng
            ma_kh_prefix = ma_kh_from_ma_hh(ma_hh)
            ma_kh_id = kh_map.get(ma_kh_prefix)

            obj = models.master.Product(
                ma_amis=ma_hh,
                ma_hang=ma_hh,
                ten_hang=ten_hang,
                dai=d,
                rong=rong,
                cao=c,
                so_lop=so_lop,
                dvt=dvt,
                gia_ban=gia_ban,
                gia_mua=gia_mua,
                ghi_chu=ghi_chu,
                khong_tinh_nxt=khong_tinh_nxt,
                ma_kh_id=ma_kh_id,
            )
            batch.append(obj)
            existing.add(ma_hh)
            new_count += 1
            if len(batch) >= 500:
                db.add_all(batch)
                db.flush()
                batch.clear()
                print(f"  ... {new_count} hàng hóa đã xử lý", flush=True)

        if batch:
            db.add_all(batch)
        db.commit()
        return f"Hàng hóa: +{new_count} mới, {skip_count} bỏ qua"
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


# ── Main: chạy 3 jobs song song ───────────────────────────────────────────────
if __name__ == "__main__":
    print("=== Migrate HTCPH → ERP Nam Phương ===\n")

    jobs = {
        "customers": migrate_customers,
        "suppliers": migrate_suppliers,
        "products": migrate_products,
    }

    # customers và suppliers trước (products cần customer FK)
    with ThreadPoolExecutor(max_workers=2) as exe:
        futures = {
            exe.submit(migrate_customers): "customers",
            exe.submit(migrate_suppliers): "suppliers",
        }
        for f in as_completed(futures):
            name = futures[f]
            try:
                print(f"✓ {f.result()}")
            except Exception as e:
                print(f"✗ {name}: {e}")

    # products sau (cần customer FK map)
    print("\nĐang migrate hàng hóa...")
    try:
        result = migrate_products()
        print(f"✓ {result}")
    except Exception as e:
        print(f"✗ products: {e}")

    print("\n=== Hoàn thành ===")
