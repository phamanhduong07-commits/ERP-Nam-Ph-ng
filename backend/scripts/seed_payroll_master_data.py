"""Seed master data lương sản phẩm theo Quy chế Lương Nam Phương.

Bao gồm:
1. 5 mã hàng đầu (Bảng đơn giá — Điều 6, Table 4 quy chế)
2. 4 dòng quy đổi giờ → công (Bảng quy đổi — Điều 9, Table 5)
3. Mức lương tối thiểu vùng 2024-2026 (NĐ 74/2024/NĐ-CP, hiệu lực 01/07/2024)
4. Config chung (giờ công chuẩn, ngày công chuẩn)

Idempotent: chạy lại không tạo trùng.
"""
from __future__ import annotations

import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models.hr import PayrollConfig


# ─── 1. Bảng đơn giá sản phẩm (Điều 6 + Table 4 quy chế) ───
WORK_UNITS = [
    {"ma_hang": "IN",          "ten_hang": "In",                "phan_tram_luong_sp": 100, "don_gia": 122, "cong_doan": "In"},
    {"ma_hang": "MAYSONG_A",   "ten_hang": "Máy sóng A",        "phan_tram_luong_sp": 110, "don_gia": 60,  "cong_doan": "Máy sóng"},
    {"ma_hang": "CM_A",        "ten_hang": "Cán màng Ca A",     "phan_tram_luong_sp": 100, "don_gia": 100, "cong_doan": "Cán màng"},
    {"ma_hang": "TP_LA",       "ten_hang": "Thành phẩm LA",     "phan_tram_luong_sp": 100, "don_gia": 204, "cong_doan": "Thành phẩm"},
    {"ma_hang": "XA",          "ten_hang": "Xả",                "phan_tram_luong_sp": 100, "don_gia": 68,  "cong_doan": "Xả"},
]

# ─── 2. Bảng công quy đổi (Điều 9 + Table 5 quy chế) ───
# loai='gio_quy_doi', dùng ma_cau_hinh + gia_tri để lưu
HOUR_CONVERSIONS = [
    {"ma_cau_hinh": "QD_4H",   "ten_cau_hinh": "4 giờ làm việc",  "gia_tri": Decimal("0.5")},
    {"ma_cau_hinh": "QD_8H",   "ten_cau_hinh": "8 giờ làm việc",  "gia_tri": Decimal("1.0")},
    {"ma_cau_hinh": "QD_10H",  "ten_cau_hinh": "10 giờ làm việc", "gia_tri": Decimal("1.25")},
    {"ma_cau_hinh": "QD_12H",  "ten_cau_hinh": "12 giờ làm việc", "gia_tri": Decimal("1.5")},
]

# ─── 3. Lương tối thiểu vùng (NĐ 74/2024/NĐ-CP hiệu lực 01/07/2024) ───
# Đơn vị: VNĐ/tháng. Nam Phương ở Hóc Môn (TP.HCM) → Vùng I.
MIN_WAGES = [
    {"ma_cau_hinh": "MIN_WAGE_I",   "ten_cau_hinh": "Lương tối thiểu Vùng I",   "gia_tri": Decimal("4960000")},
    {"ma_cau_hinh": "MIN_WAGE_II",  "ten_cau_hinh": "Lương tối thiểu Vùng II",  "gia_tri": Decimal("4410000")},
    {"ma_cau_hinh": "MIN_WAGE_III", "ten_cau_hinh": "Lương tối thiểu Vùng III", "gia_tri": Decimal("3860000")},
    {"ma_cau_hinh": "MIN_WAGE_IV",  "ten_cau_hinh": "Lương tối thiểu Vùng IV",  "gia_tri": Decimal("3450000")},
]

# ─── 4. Config chung (giờ/ngày chuẩn) ───
GENERAL_CONFIG = [
    {"ma_cau_hinh": "GIO_CHUAN_NGAY", "ten_cau_hinh": "Giờ công chuẩn / ngày",     "gia_tri": Decimal("8")},
    {"ma_cau_hinh": "NGAY_CHUAN_THANG", "ten_cau_hinh": "Ngày công chuẩn / tháng", "gia_tri": Decimal("26")},
    {"ma_cau_hinh": "VUNG_AP_DUNG",   "ten_cau_hinh": "Vùng lương tối thiểu áp dụng (I/II/III/IV)", "gia_tri": Decimal("1")},
    # NV phổ thông trong Quy chế: hệ số tối thiểu sau thử việc
    {"ma_cau_hinh": "HE_SO_THU_VIEC", "ten_cau_hinh": "Hệ số học việc/thử việc",   "gia_tri": Decimal("1.3")},
]


def main() -> None:
    db = SessionLocal()
    try:
        # Track gì đã có
        existing_san_pham = {c.ma_hang for c in db.query(PayrollConfig).filter(PayrollConfig.loai == "san_pham").all() if c.ma_hang}
        existing_cau_hinh = {c.ma_cau_hinh for c in db.query(PayrollConfig).filter(PayrollConfig.loai != "san_pham").all() if c.ma_cau_hinh}

        created_sp = 0
        created_qd = 0
        created_mw = 0
        created_cfg = 0

        # 1. Mã hàng (loai='san_pham')
        for w in WORK_UNITS:
            if w["ma_hang"] in existing_san_pham:
                continue
            db.add(PayrollConfig(
                ma_hang=w["ma_hang"],
                ten_hang=w["ten_hang"],
                cong_doan=w["cong_doan"],
                phan_tram_luong_sp=Decimal(str(w["phan_tram_luong_sp"])),
                don_gia=Decimal(str(w["don_gia"])),
                loai="san_pham",
            ))
            created_sp += 1

        # 2. Bảng quy đổi (loai='gio_quy_doi')
        for c in HOUR_CONVERSIONS:
            if c["ma_cau_hinh"] in existing_cau_hinh:
                continue
            db.add(PayrollConfig(
                ma_cau_hinh=c["ma_cau_hinh"],
                ten_cau_hinh=c["ten_cau_hinh"],
                gia_tri=c["gia_tri"],
                loai="gio_quy_doi",
            ))
            created_qd += 1

        # 3. Lương tối thiểu vùng (loai='min_wage')
        for c in MIN_WAGES:
            if c["ma_cau_hinh"] in existing_cau_hinh:
                continue
            db.add(PayrollConfig(
                ma_cau_hinh=c["ma_cau_hinh"],
                ten_cau_hinh=c["ten_cau_hinh"],
                gia_tri=c["gia_tri"],
                loai="min_wage",
            ))
            created_mw += 1

        # 4. Config chung (loai='config')
        for c in GENERAL_CONFIG:
            if c["ma_cau_hinh"] in existing_cau_hinh:
                continue
            db.add(PayrollConfig(
                ma_cau_hinh=c["ma_cau_hinh"],
                ten_cau_hinh=c["ten_cau_hinh"],
                gia_tri=c["gia_tri"],
                loai="config",
            ))
            created_cfg += 1

        db.commit()
        print(f"📦 Mã hàng (đơn giá SP)    : {created_sp} mới  ·  {len(existing_san_pham)} đã có")
        print(f"⏰ Bảng quy đổi giờ → công : {created_qd} mới")
        print(f"🗺  Lương tối thiểu vùng    : {created_mw} mới (NĐ 74/2024 hiệu lực 01/07/2024)")
        print(f"⚙  Config chung            : {created_cfg} mới (giờ/ngày/vùng/hệ số)")
        print(f"\n✅ Seed master data thành công.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
