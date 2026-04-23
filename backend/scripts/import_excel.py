"""
Script import dữ liệu từ các file Excel vào SQLite.
Chạy từ thư mục backend: python scripts/import_excel.py
"""

import os
import sys
import math
import io

# Fix UTF-8 output trên Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

# Thêm thư mục backend vào path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from passlib.context import CryptContext
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

# ===================== CẤU HÌNH =====================
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Load .env từ thư mục backend
def _load_env():
    env_path = os.path.join(BACKEND_DIR, ".env")
    if os.path.exists(env_path):
        with open(env_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())
_load_env()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{BACKEND_DIR}/erp_nam_phuong.db"
)
EXCEL_DIR = os.getenv(
    "EXCEL_DIR",
    r"C:\Users\USER\Desktop\DỮ LIỆU MPS"
)
# =====================================================

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True, pool_recycle=3600)

if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

# Import models để tạo bảng
from app.database import Base
from app.models import *  # noqa: F401, F403
Base.metadata.create_all(bind=engine)


def read_excel(filename: str) -> pd.DataFrame:
    """
    Đọc file Excel Nam Phương.
    Row 0 = tên công ty, Row 1 = tên báo cáo, Row 2 = tiêu đề cột, Row 3+ = dữ liệu.
    """
    path = os.path.join(EXCEL_DIR, filename)
    df = pd.read_excel(path, header=2)
    # Bỏ cột không tên
    df = df.loc[:, ~df.columns.astype(str).str.startswith("Unnamed")]
    # Bỏ dòng trống hoàn toàn
    df = df.dropna(how="all")
    # Bỏ dòng tóm tắt/filter của phần mềm (dòng đầu thường có "mục" hoặc "Hình thức")
    first_col = df.columns[0]
    df = df[~df[first_col].astype(str).str.contains(
        r"mục|Hình thức|hình thức|filter|Filter", na=False, regex=True
    )]
    df = df.reset_index(drop=True)
    return df


def clean_str(val) -> str | None:
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return None
    s = str(val).strip()
    return s if s else None


def clean_float(val) -> float | None:
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def clean_bool(val) -> bool:
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return False
    return str(val).strip().lower() in ("true", "1", "có", "x", "yes")


def log(msg: str):
    print(f"  {msg}")


# ─────────────────────────────────────────────
# 1. Seed data mặc định (dùng ORM tránh NOT NULL)
# ─────────────────────────────────────────────
def seed_defaults(db: Session):
    from app.models.auth import Role, User
    from app.models.master import Warehouse
    print("\n[1] Tao du lieu mac dinh...")

    role_defs = [
        ("ADMIN",      "Quan tri he thong"),
        ("GIAM_DOC",   "Giam doc"),
        ("KE_TOAN",    "Ke toan"),
        ("KINH_DOANH", "Kinh doanh"),
        ("KHO",        "Thu kho"),
        ("SAN_XUAT",   "Quan ly san xuat"),
        ("MUA_HANG",   "Mua hang"),
        ("CONG_NHAN",  "Cong nhan"),
    ]
    for ma, ten in role_defs:
        if not db.query(Role).filter_by(ma_vai_tro=ma).first():
            db.add(Role(ma_vai_tro=ma, ten_vai_tro=ten, trang_thai=True))
    db.flush()

    admin_role = db.query(Role).filter_by(ma_vai_tro="ADMIN").first()
    if not db.query(User).filter_by(username="admin").first():
        db.add(User(
            username="admin",
            ho_ten="Quan tri vien",
            email="admin@namphuong.vn",
            password_hash=pwd_context.hash("Admin@123"),
            role_id=admin_role.id,
            trang_thai=True,
        ))

    kho_defs = [
        ("KNVL01", "Kho NVL - Long An", "NVL"),
        ("KNVL02", "Kho NVL - Hoc Mon",  "NVL"),
        ("KTP01",  "Kho Thanh Pham",     "TP"),
        ("KVT01",  "Kho Vat Tu",         "VAT_TU"),
    ]
    for ma, ten, loai in kho_defs:
        if not db.query(Warehouse).filter_by(ma_kho=ma).first():
            db.add(Warehouse(ma_kho=ma, ten_kho=ten, loai_kho=loai, trang_thai=True))

    db.commit()
    log("OK: Roles, admin, kho")


# ─────────────────────────────────────────────
# 2. Nhóm nguyên liệu
# ─────────────────────────────────────────────
def import_material_groups(db: Session):
    from app.models.master import MaterialGroup
    print("\n[2] Import nhom nguyen lieu...")
    try:
        df = read_excel("DANH MỤC NHÓM NGUYÊN LIỆU.xls")
        count = 0
        for _, row in df.iterrows():
            ma = clean_str(row.get("*Mã") or row.get("Mã"))
            ten = clean_str(row.get("*Tên") or row.get("Tên"))
            if not ma or not ten:
                continue
            existing = db.query(MaterialGroup).filter_by(ma_nhom=ma).first()
            if existing:
                existing.ten_nhom = ten
            else:
                db.add(MaterialGroup(
                    ma_nhom=ma, ten_nhom=ten,
                    la_nhom_giay=clean_bool(row.get("*Là\nnhóm giấy")),
                    bo_phan=clean_str(row.get("Bộ\nphận")),
                    phan_xuong=clean_str(row.get("*Phân\nXưởng")),
                    trang_thai=True,
                ))
            count += 1
        db.commit()
        log(f"OK: {count} nhom")
    except Exception as e:
        db.rollback()
        log(f"LOI: {e}")


# ─────────────────────────────────────────────
# 3. Nhà cung cấp
# ─────────────────────────────────────────────
def import_suppliers(db: Session):
    from app.models.master import Supplier
    print("\n[3] Import nha cung cap...")
    try:
        df = read_excel("DANH MỤC NHÀ CUNG CẤP.xls")
        count = 0
        for _, row in df.iterrows():
            ma = clean_str(row.get("Mã"))
            ten_vt = clean_str(row.get("Tên viết tắt"))
            if not ma or not ten_vt:
                continue
            existing = db.query(Supplier).filter_by(ma_ncc=ma).first()
            if existing:
                existing.ten_viet_tat = ten_vt
                existing.ten_don_vi = clean_str(row.get("Tên đơn vị"))
                existing.phan_loai = clean_str(row.get("Phân loại"))
            else:
                db.add(Supplier(
                    ma_ncc=ma,
                    ten_viet_tat=ten_vt,
                    ten_don_vi=clean_str(row.get("Tên đơn vị")),
                    dia_chi=clean_str(row.get("Địa chỉ")),
                    dien_thoai=clean_str(row.get("Điện thoại")),
                    fax=clean_str(row.get("Fax")),
                    di_dong=clean_str(row.get("Di động")),
                    ma_so_thue=clean_str(row.get("Mã số thuế")),
                    nguoi_dai_dien=clean_str(row.get("Người đại diện")),
                    phan_loai=clean_str(row.get("Phân loại")),
                    trang_thai=True,
                ))
            count += 1
        db.commit()
        log(f"OK: {count} nha cung cap")
    except Exception as e:
        db.rollback()
        log(f"LOI: {e}")


# ─────────────────────────────────────────────
# 4. Khách hàng
# ─────────────────────────────────────────────
def import_customers(db: Session):
    from app.models.master import Customer
    print("\n[4] Import khach hang...")
    try:
        df = read_excel("DANH MỤC KHÁCH HÀNG.xls")
        count = 0
        seen: set[str] = set()
        for _, row in df.iterrows():
            ten_vt = clean_str(row.get("Tên viết tắt"))
            if not ten_vt:
                continue
            # Dùng ten_viet_tat làm ma_kh (file xuất thiếu cột Mã)
            ma = ten_vt[:20]
            if ma in seen:
                continue
            seen.add(ma)

            so_ngay_no = 0
            try:
                v = row.get("Số ngày nợ (Theo đợt)")
                if v and not (isinstance(v, float) and math.isnan(v)):
                    so_ngay_no = int(float(str(v)))
            except Exception:
                pass

            no_tran = clean_float(row.get("Nợ Trần")) or 0

            existing = db.query(Customer).filter_by(ma_kh=ma).first()
            if existing:
                existing.ten_viet_tat = ten_vt
                existing.ten_don_vi = clean_str(row.get("Tên đơn vị"))
                existing.no_tran = no_tran
                existing.so_ngay_no = so_ngay_no
            else:
                db.add(Customer(
                    ma_kh=ma,
                    ten_viet_tat=ten_vt,
                    ten_don_vi=clean_str(row.get("Tên đơn vị")),
                    dia_chi=clean_str(row.get("Địa chỉ")),
                    dia_chi_giao_hang=clean_str(row.get("Địa Chỉ Giao hàng")),
                    dien_thoai=clean_str(row.get("Điện thoại")),
                    fax=clean_str(row.get("Fax")),
                    ma_so_thue=clean_str(row.get("Mã số thuế")),
                    nguoi_dai_dien=clean_str(row.get("Người đại diện")),
                    nguoi_lien_he=clean_str(row.get("Người liên hệ")),
                    so_dien_thoai_lh=clean_str(row.get("Số Điện Thoại Liên Hệ")),
                    no_tran=no_tran,
                    so_ngay_no=so_ngay_no,
                    xep_loai=clean_str(row.get("Xếp loại")),
                    la_khach_vip=clean_bool(row.get("Là khách vip")),
                    trang_thai=True,
                ))
            count += 1
        db.commit()
        log(f"OK: {count} khach hang")
    except Exception as e:
        db.rollback()
        log(f"LOI: {e}")


# ─────────────────────────────────────────────
# 5. Nguyên liệu giấy
# ─────────────────────────────────────────────
def import_paper_materials(db: Session):
    from app.models.master import MaterialGroup, Supplier, PaperMaterial
    print("\n[5] Import nguyen lieu giay...")
    try:
        df = read_excel("DANH MỤC NGUYÊN LIỆU GIẤY.xls")
        count, skip = 0, 0
        for _, row in df.iterrows():
            ma_chinh = clean_str(row.get("Mã chính"))
            ten = clean_str(row.get("Tên"))
            ma_nhom_code = clean_str(row.get("Mã nhóm"))
            if not ma_chinh or not ten or not ma_nhom_code:
                skip += 1
                continue

            nhom = db.query(MaterialGroup).filter_by(ma_nhom=ma_nhom_code).first()
            if not nhom:
                skip += 1
                continue

            ma_nsx = clean_str(row.get("Mã NSX"))
            nsx_id = None
            if ma_nsx:
                nsx = db.query(Supplier).filter_by(ma_ncc=ma_nsx).first()
                if nsx:
                    nsx_id = nsx.id

            existing = db.query(PaperMaterial).filter_by(ma_chinh=ma_chinh).first()
            if existing:
                existing.ten = ten
                existing.kho = clean_float(row.get("Khổ"))
                existing.dinh_luong = clean_float(row.get("Định lượng") or row.get("Định lượng tiêu chuẩn"))
                existing.gia_mua = clean_float(row.get("Giá mua")) or 0
            else:
                db.add(PaperMaterial(
                    ma_chinh=ma_chinh,
                    ma_amis=clean_str(row.get("Mã AMIS")),
                    ma_nhom_id=nhom.id,
                    ten=ten,
                    dvt=clean_str(row.get("ĐVT")) or "Kg",
                    kho=clean_float(row.get("Khổ")),
                    ma_ky_hieu=clean_str(row.get("Mã ký hiệu")),
                    dinh_luong=clean_float(row.get("Định lượng") or row.get("Định lượng tiêu chuẩn")),
                    ma_nsx_id=nsx_id,
                    tieu_chuan_dinh_luong=clean_float(row.get("Tiêu Chuẩn Định Lượng (%)")),
                    do_buc_tieu_chuan=clean_float(row.get("Độ bục tiêu chuẩn")),
                    do_nen_vong_tc=clean_float(row.get("Độ nén vòng tiêu chuẩn")),
                    do_cobb_tieu_chuan=clean_float(row.get("Độ COBB tiêu chuẩn")),
                    do_day_tieu_chuan=clean_float(row.get("Độ day tiêu chuẩn")),
                    gia_mua=clean_float(row.get("Giá mua")) or 0,
                    gia_ban=clean_float(row.get("Giá bán") or row.get("Giá bán mới")) or 0,
                    ton_toi_thieu=clean_float(row.get("Tồn t.thiểu") or row.get("Tồn tối thiểu")) or 0,
                ))
            count += 1
        db.commit()
        log(f"OK: {count} nguyen lieu giay (bo qua {skip})")
    except Exception as e:
        db.rollback()
        log(f"LOI: {e}")


# ─────────────────────────────────────────────
# 6. Nguyên vật liệu khác
# ─────────────────────────────────────────────
def import_other_materials(db: Session):
    from app.models.master import MaterialGroup, Supplier, OtherMaterial
    print("\n[6] Import nguyen vat lieu khac...")
    try:
        df = read_excel("DANH MỤC NGUYÊN VẬT LIỆU KHÁC.xls")
        count, skip = 0, 0
        for _, row in df.iterrows():
            ma = clean_str(row.get("Mã chính"))
            ten = clean_str(row.get("Tên"))
            ma_nhom_code = clean_str(row.get("Mã\nnhóm") or row.get("Mã nhóm"))
            if not ma or not ten or not ma_nhom_code:
                skip += 1
                continue

            nhom = db.query(MaterialGroup).filter_by(ma_nhom=ma_nhom_code).first()
            if not nhom:
                ten_nhom = clean_str(row.get("Tên mã nhóm")) or ma_nhom_code
                nhom = MaterialGroup(ma_nhom=ma_nhom_code, ten_nhom=ten_nhom, trang_thai=True)
                db.add(nhom)
                db.flush()

            ma_ncc = clean_str(row.get("Mã\nNCC") or row.get("Mã NCC"))
            ncc_id = None
            if ma_ncc:
                ncc = db.query(Supplier).filter_by(ma_ncc=ma_ncc).first()
                if ncc:
                    ncc_id = ncc.id

            existing = db.query(OtherMaterial).filter_by(ma_chinh=ma).first()
            if existing:
                existing.ten = ten
                existing.gia_mua = clean_float(row.get("Giá mua")) or 0
            else:
                db.add(OtherMaterial(
                    ma_chinh=ma,
                    ma_amis=clean_str(row.get("Mã AMIS")),
                    ten=ten,
                    dvt=clean_str(row.get("ĐVT")) or "Cái",
                    ma_nhom_id=nhom.id,
                    gia_mua=clean_float(row.get("Giá mua")) or 0,
                    ton_toi_thieu=clean_float(row.get("Tồn\nt.thiểu") or row.get("Tồn tối thiểu")) or 0,
                    phan_xuong=clean_str(row.get("Phân\nxưởng") or row.get("Phân xưởng")),
                    ma_ncc_id=ncc_id,
                    trang_thai=True,
                ))
            count += 1
        db.commit()
        log(f"OK: {count} nguyen vat lieu khac (bo qua {skip})")
    except Exception as e:
        db.rollback()
        log(f"LOI: {e}")


# ─────────────────────────────────────────────
# 7. Hàng hoá (sản phẩm thùng carton)
# ─────────────────────────────────────────────
def import_products(db: Session):
    from app.models.master import Customer, Product
    print("\n[7] Import danh muc hang hoa...")
    try:
        df = read_excel("DANH MỤC HÀNG HOÁ.xls")
        count, skip = 0, 0

        price_map: dict[str, float] = {}
        try:
            dfp = read_excel("DANH MỤC HÀNG HOÁ CÓ GIÁ.xls")
            for _, pr in dfp.iterrows():
                ma = clean_str(pr.get("Mã hàng"))
                gia = clean_float(pr.get("Giá bán"))
                if ma and gia:
                    price_map[ma] = gia
        except Exception:
            pass

        for _, row in df.iterrows():
            ma_amis = clean_str(row.get("Mã AMIS"))
            ten_hang = clean_str(row.get("Tên hàng"))
            if not ma_amis or not ten_hang:
                skip += 1
                continue

            so_lop = 3
            try:
                v = row.get("Số lớp")
                if v and not (isinstance(v, float) and math.isnan(v)):
                    so_lop = int(float(str(v)))
            except Exception:
                pass

            ma_kh = clean_str(row.get("Mã KH"))
            kh_id = None
            if ma_kh:
                kh = db.query(Customer).filter_by(ma_kh=ma_kh).first()
                if kh:
                    kh_id = kh.id

            gia_ban = price_map.get(ma_amis, 0)

            existing = db.query(Product).filter_by(ma_amis=ma_amis).first()
            if existing:
                existing.ten_hang = ten_hang
                existing.dai = clean_float(row.get("Dài"))
                existing.rong = clean_float(row.get("Rộng"))
                existing.cao = clean_float(row.get("Cao"))
                existing.gia_ban = gia_ban
            else:
                db.add(Product(
                    ma_amis=ma_amis,
                    ten_hang=ten_hang,
                    dai=clean_float(row.get("Dài")),
                    rong=clean_float(row.get("Rộng")),
                    cao=clean_float(row.get("Cao")),
                    so_lop=so_lop,
                    so_mau=int(clean_float(row.get("Số màu")) or 0),
                    ghim=clean_bool(row.get("Ghim")),
                    dan=clean_bool(row.get("Dán")),
                    dvt=clean_str(row.get("Đơn vị tính")) or "Thùng",
                    ma_kh_id=kh_id,
                    gia_ban=gia_ban,
                    trang_thai=True,
                ))
            count += 1
        db.commit()
        log(f"OK: {count} san pham (bo qua {skip})")
    except Exception as e:
        db.rollback()
        log(f"LOI: {e}")


# ─────────────────────────────────────────────
# 8. Tồn kho giấy cuộn
# ─────────────────────────────────────────────
def import_paper_rolls(db: Session):
    from app.models.master import PaperMaterial, Warehouse
    from app.models.inventory import PaperRoll
    print("\n[8] Import ton kho giay cuon...")
    try:
        df = read_excel("SỐ TỒN KHO TỨC THÌ.xls")
        count, skip = 0, 0

        default_wh = db.query(Warehouse).filter_by(ma_kho="KNVL01").first()
        default_wh_id = default_wh.id if default_wh else 1

        for _, row in df.iterrows():
            ma_cuon = clean_str(row.get("Mã\ncuộn") or row.get("Mã cuộn"))
            ma_nvl  = clean_str(row.get("Mã NVL") or row.get("Mã\nNVL"))
            ton_kg  = clean_float(row.get("TonKg"))
            ma_kho  = clean_str(row.get("Mã\nkho") or row.get("Mã kho"))

            if not ma_cuon or not ma_nvl or ton_kg is None:
                skip += 1
                continue
            if ton_kg <= 0:
                continue

            mat = db.query(PaperMaterial).filter(
                (PaperMaterial.ma_chinh == ma_nvl) | (PaperMaterial.ma_amis == ma_nvl)
            ).first()
            if not mat:
                skip += 1
                continue

            kho_id = default_wh_id
            if ma_kho:
                wh = db.query(Warehouse).filter_by(ma_kho=ma_kho).first()
                if wh:
                    kho_id = wh.id

            existing = db.query(PaperRoll).filter_by(ma_cuon=ma_cuon).first()
            if existing:
                existing.trong_luong_hien_tai = ton_kg
            else:
                db.add(PaperRoll(
                    ma_cuon=ma_cuon,
                    paper_material_id=mat.id,
                    warehouse_id=kho_id,
                    kho=clean_float(row.get("Khổ")) or 0,
                    dinh_luong=clean_float(row.get("Định\nlượng") or row.get("Định lượng")),
                    trong_luong_ban_dau=ton_kg,
                    trong_luong_hien_tai=ton_kg,
                    trang_thai="kho",
                ))
            count += 1
        db.commit()
        log(f"OK: {count} cuon giay (bo qua {skip})")
    except Exception as e:
        db.rollback()
        log(f"LOI: {e}")


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def main():
    print("=" * 55)
    print("  IMPORT DỮ LIỆU ERP NAM PHƯƠNG")
    print("=" * 55)
    print(f"  Database : {DATABASE_URL}")
    print(f"  Excel dir: {EXCEL_DIR}")

    with Session(engine) as db:
        seed_defaults(db)
        import_material_groups(db)
        import_suppliers(db)
        import_customers(db)
        import_paper_materials(db)
        import_other_materials(db)
        import_products(db)
        import_paper_rolls(db)

    print("\n" + "=" * 55)
    print("  HOÀN THÀNH IMPORT!")
    print("  Tài khoản admin: admin / Admin@123")
    print("  (Đổi mật khẩu ngay sau khi đăng nhập!)")
    print("=" * 55)


if __name__ == "__main__":
    main()
