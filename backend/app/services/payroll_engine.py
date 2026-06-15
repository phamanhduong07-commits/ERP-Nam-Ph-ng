"""Engine tính lương sản phẩm — Sprint D.3.

Implement đúng 6 công thức theo Điều 7-13 Quy chế Lương Nam Phương:

1. Quỹ lương SP của 1 mã hàng (Điều 7):
   Quỹ_SP_mã = Σ(Sản lượng hợp lệ × Đơn giá × % lương SP)

2. Công quy đổi của 1 NV (Điều 9):
   Công_quy_đổi = Tổng giờ làm việc thực tế / Giờ công chuẩn (mặc định 8h)

3. Trọng số cá nhân (Điều 10):
   Trọng_số = Hệ số cá nhân × Công quy đổi

4. Lương SP cá nhân (Điều 10):
   Lương_SP = Quỹ_SP_tổ × (Trọng_số_NV / Tổng_trọng_số_tổ)

5. Tổng thu nhập (Điều 12):
   Tổng = Lương_SP + 8 khoản cộng thêm

6. Thực nhận (Điều 12):
   Thực_nhận = Tổng - 7 khoản khấu trừ

+ Bù tối thiểu vùng (Điều 4 đoạn 8):
   Nếu Lương_SP < (Lương_tối_thiểu × Công_quy_đổi / Công_chuẩn_tháng) → bù chênh lệch
"""
from __future__ import annotations

import logging
from calendar import monthrange
from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.models.hr import (
    AttendanceLog, Employee, LaborContract, PayrollAdjustment, PayrollAuditLog,
    PayrollConfig, PayrollRun, ProductionOutput, RewardDiscipline,
)

logger = logging.getLogger("erp")


# ═══════════════════════════════════════════════════════════════
# Sprint D.6 — Phân loại sub_loai cộng thêm theo NĐ 38/2022/NĐ-CP
# ═══════════════════════════════════════════════════════════════
# Lương tối thiểu vùng KHÔNG bao gồm: làm thêm giờ, ban đêm, thưởng,
# tiền ăn giữa ca, hỗ trợ xăng xe, điện thoại, nhà ở, đi lại.
# → Chỉ những khoản TÍNH CHẤT LƯƠNG mới được cộng vào ngưỡng tối thiểu.

SUB_LOAI_TINH_VAO_TOI_THIEU = {
    "cong_nhat",       # Tiền công nhật — tính chất lương
    "pc_cong_doan",    # PC công đoạn — lương theo công đoạn
    "pc_chuc_vu",      # PC chức vụ — lương cố định
    "pc_khac",         # PC khác — đa số mang tính lương
}
# Không tính vào tối thiểu: tang_thuong_sp, boi_duong, pc_het_hang, pc_may_hong


# ═══════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════
def _get_active_contract(db: Session, employee_id: int, on_date: date) -> Optional[LaborContract]:
    """Lấy HĐLĐ hiệu lực của NV vào ngày `on_date` (để biết NV có đang thử việc).

    Ưu tiên HĐ có trang_thai='hieu_luc', ngay_hieu_luc <= on_date,
    (ngay_het_han IS NULL hoặc >= on_date). Nếu nhiều thì lấy mới nhất.
    """
    return (
        db.query(LaborContract)
        .filter(
            LaborContract.employee_id == employee_id,
            LaborContract.trang_thai == "hieu_luc",
            LaborContract.ngay_hieu_luc <= on_date,
        )
        .order_by(LaborContract.ngay_hieu_luc.desc())
        .first()
    )


def _is_thu_viec(contract: Optional[LaborContract]) -> bool:
    """NV đang thử việc → áp hệ số riêng (mặc định 1.3 theo cấu hình HE_SO_THU_VIEC)."""
    return contract is not None and contract.loai_hop_dong == "thu_viec"


# ─── Helpers — load config từ DB ───
def _load_master_data(db: Session) -> dict:
    """Tải toàn bộ master data lương 1 lần."""
    cfg = db.query(PayrollConfig).all()
    price_map = {c.ma_hang: c for c in cfg if c.loai == "san_pham" and c.ma_hang}
    config_map = {c.ma_cau_hinh: c.gia_tri for c in cfg if c.loai == "config" and c.ma_cau_hinh}
    min_wages = {
        c.ma_cau_hinh.replace("MIN_WAGE_", ""): c.gia_tri
        for c in cfg if c.loai == "min_wage" and c.ma_cau_hinh
    }
    return {
        "prices": price_map,
        "gio_chuan_ngay": Decimal(str(config_map.get("GIO_CHUAN_NGAY", 8))),
        "ngay_chuan_thang": Decimal(str(config_map.get("NGAY_CHUAN_THANG", 26))),
        "vung_ap_dung": str(int(config_map.get("VUNG_AP_DUNG", 1))),
        "he_so_thu_viec": Decimal(str(config_map.get("HE_SO_THU_VIEC", 1.3))),
        "min_wages": min_wages,
    }


def _get_min_wage(master: dict) -> Decimal:
    """Lương tối thiểu cho vùng đang áp dụng."""
    vung_num = master["vung_ap_dung"]  # "1"/"2"/"3"/"4"
    vung_roman = {"1": "I", "2": "II", "3": "III", "4": "IV"}.get(vung_num, "I")
    return master["min_wages"].get(vung_roman, Decimal("4960000"))


def _compute_employee_hours(db: Session, employee_id: int, start: date, end: date) -> Decimal:
    """Tính tổng giờ làm việc thực tế của NV trong khoảng [start, end].

    Dựa vào AttendanceLog. Mỗi log có gio_lam_viec (Decimal giờ).
    """
    from sqlalchemy import func
    total = (
        db.query(func.coalesce(func.sum(AttendanceLog.tong_gio_thuc), 0))
        .filter(
            AttendanceLog.employee_id == employee_id,
            AttendanceLog.ngay.between(start, end),
            AttendanceLog.trang_thai.in_(["hop_le", "thieu_ca"]),
        ).scalar()
    )
    return Decimal(str(total or 0))


# ─── ENGINE chính ───
def calculate_payroll_for_month(
    db: Session,
    nam: int,
    thang: int,
    bo_phan_id: Optional[int] = None,
    dry_run: bool = True,
    user_id: Optional[int] = None,
) -> dict:
    """Tính lương cho 1 tháng × 1 bộ phận (hoặc tất cả bộ phận).

    Returns dict { success: int, errors: list, details: list of payroll calc }.
    dry_run=True → không lưu vào DB, chỉ trả preview.
    """
    master = _load_master_data(db)
    min_wage = _get_min_wage(master)
    gio_chuan = master["gio_chuan_ngay"]
    ngay_chuan = master["ngay_chuan_thang"]

    start = date(nam, thang, 1)
    end = date(nam, thang, monthrange(nam, thang)[1])

    # ─── Bước 1: lấy sản lượng đã xác nhận trong tháng ───
    output_q = db.query(ProductionOutput).filter(
        ProductionOutput.ngay.between(start, end),
        ProductionOutput.trang_thai == "da_xac_nhan",
    )
    if bo_phan_id:
        output_q = output_q.filter(ProductionOutput.bo_phan_id == bo_phan_id)
    outputs = output_q.all()

    if not outputs:
        return {
            "success": 0,
            "errors": [],
            "details": [],
            "warning": f"Không có sản lượng đã xác nhận cho tháng {thang}/{nam}"
                       + (f" tại bộ phận {bo_phan_id}" if bo_phan_id else ""),
        }

    # ─── Bước 2: gom quỹ lương SP theo (bộ_phận hoặc tổ) ───
    # Key = (bo_phan_id, to_id) → tổng quỹ lương SP
    # Sản lượng có thể nhập ở cấp tổ (chia chi tiết) hoặc cấp bộ phận (gom).
    quy_luong_by_group: dict[tuple[int | None, int | None], Decimal] = defaultdict(Decimal)
    # Tổng quỹ ở cấp bộ phận (để fallback khi NV có tổ nhưng SL nhập ở cấp BP)
    quy_luong_by_dept: dict[int | None, Decimal] = defaultdict(Decimal)
    for o in outputs:
        cfg = master["prices"].get(o.ma_hang)
        if not cfg:
            logger.warning("Bỏ qua sản lượng id=%s vì ma_hang=%s không có trong bảng đơn giá",
                           o.id, o.ma_hang)
            continue
        net = Decimal(str(o.san_luong or 0))
        don_gia = Decimal(str(cfg.don_gia or 0))
        pct = Decimal(str(cfg.phan_tram_luong_sp or 100)) / Decimal("100")
        quy = net * don_gia * pct
        key = (o.bo_phan_id, o.to_id) if o.to_id else (o.bo_phan_id, None)
        quy_luong_by_group[key] += quy
        quy_luong_by_dept[o.bo_phan_id] += quy

    # ─── Bước 3: lấy danh sách NV trong scope ───
    # GAP-3 fix: Bao gồm CẢ NV đã nghỉ trong tháng (BLLĐ Điều 48 —
    # phải thanh toán đầy đủ phần đã làm trước khi nghỉ).
    from sqlalchemy import or_, and_
    emp_q = db.query(Employee).filter(
        or_(
            Employee.trang_thai == "dang_lam",
            # NV nghỉ giữa tháng (ngày nghỉ rơi vào trong tháng tính)
            and_(
                Employee.trang_thai == "da_nghi",
                Employee.ngay_nghi_viec >= start,
                Employee.ngay_nghi_viec <= end,
            ),
        )
    )
    if bo_phan_id:
        emp_q = emp_q.filter(Employee.bo_phan_id == bo_phan_id)
    else:
        # Nếu không filter bộ phận → chỉ lấy NV thuộc các bộ phận có quỹ lương SP
        dept_ids = {k[0] for k in quy_luong_by_group.keys() if k[0] is not None}
        if dept_ids:
            emp_q = emp_q.filter(Employee.bo_phan_id.in_(dept_ids))
    employees = emp_q.all()

    # ─── P1 fix D.1: Batch-load contracts (1 query thay vì N) ───
    emp_ids = [e.id for e in employees]
    contracts_map: dict[int, LaborContract] = {}
    if emp_ids:
        for c in (
            db.query(LaborContract)
            .filter(
                LaborContract.employee_id.in_(emp_ids),
                LaborContract.trang_thai == "hieu_luc",
                LaborContract.ngay_hieu_luc <= end,
            )
            .order_by(LaborContract.employee_id, LaborContract.ngay_hieu_luc.desc())
            .all()
        ):
            # Lấy HĐ mới nhất cho mỗi NV (do đã ORDER BY ngay_hieu_luc DESC)
            if c.employee_id not in contracts_map:
                contracts_map[c.employee_id] = c

    # ─── Bước 4: tính công quy đổi + trọng số cho từng NV ───
    emp_calcs: dict[int, dict] = {}
    for emp in employees:
        gio_lam = _compute_employee_hours(db, emp.id, start, end)
        # Công quy đổi = giờ / giờ_chuẩn
        cong_quy_doi = (gio_lam / gio_chuan) if gio_chuan > 0 else Decimal(0)

        # GAP-4 fix: NV thử việc → áp HE_SO_THU_VIEC (mặc định 1.3) thay vì hệ số cá nhân
        contract = contracts_map.get(emp.id)
        is_thu_viec = _is_thu_viec(contract)
        if is_thu_viec:
            he_so = Decimal(str(master["he_so_thu_viec"]))
        else:
            he_so = Decimal(str(emp.he_so_ca_nhan or master["he_so_thu_viec"]))

        trong_so = he_so * cong_quy_doi
        emp_calcs[emp.id] = {
            "emp": emp,
            "gio_lam": gio_lam,
            "cong_quy_doi": cong_quy_doi,
            "he_so": he_so,
            "is_thu_viec": is_thu_viec,
            "contract_loai": contract.loai_hop_dong if contract else None,
            "trong_so": trong_so,
        }

    # ─── Bước 5: tính tổng trọng số ở 2 cấp ───
    # Theo (bo_phan, to) — khi sản lượng nhập chi tiết theo tổ
    tong_trong_so_by_group: dict[tuple[int | None, int | None], Decimal] = defaultdict(Decimal)
    # Theo bộ phận — fallback khi sản lượng nhập gom ở cấp bộ phận
    tong_trong_so_by_dept: dict[int | None, Decimal] = defaultdict(Decimal)
    for emp_id, c in emp_calcs.items():
        emp = c["emp"]
        key = (emp.bo_phan_id, emp.to_id) if emp.to_id else (emp.bo_phan_id, None)
        tong_trong_so_by_group[key] += c["trong_so"]
        tong_trong_so_by_dept[emp.bo_phan_id] += c["trong_so"]

    # ─── Bước 6: phân bổ lương SP cho từng NV + bù tối thiểu vùng ───
    details = []
    errors = []
    skipped = []     # NV không có thu nhập tháng này → bỏ qua (không tạo bảng lương)
    anomalies = []   # NV có thu nhập nhưng thực lĩnh âm (khấu trừ > thu nhập) → HR phải xử lý
    saved_count = 0

    for emp_id, c in emp_calcs.items():
        emp = c["emp"]
        key = (emp.bo_phan_id, emp.to_id) if emp.to_id else (emp.bo_phan_id, None)

        # Logic 2 cấp:
        # 1) Nếu sản lượng nhập theo TỔ và NV thuộc tổ đó → phân bổ trong tổ
        # 2) Ngược lại fallback dùng quỹ tổng cấp BỘ PHẬN (Điều 10 quy chế:
        #    "tổng trọng số của tổ/bộ phận")
        quy_sp_tier1 = quy_luong_by_group.get(key, Decimal(0))
        tong_ts_tier1 = tong_trong_so_by_group.get(key, Decimal(0))

        if quy_sp_tier1 > 0 and tong_ts_tier1 > 0:
            quy_sp = quy_sp_tier1
            tong_trong_so = tong_ts_tier1
        else:
            # Fallback cấp bộ phận
            quy_sp = quy_luong_by_dept.get(emp.bo_phan_id, Decimal(0))
            tong_trong_so = tong_trong_so_by_dept.get(emp.bo_phan_id, Decimal(0))

        # Lương SP cá nhân (CHƯA bù)
        if tong_trong_so > 0:
            luong_sp = quy_sp * (c["trong_so"] / tong_trong_so)
        else:
            luong_sp = Decimal(0)

        # ─── Sprint D.4: Cộng phụ cấp + Trừ khấu trừ (Điều 12) ───
        adjs = db.query(PayrollAdjustment).filter(
            PayrollAdjustment.employee_id == emp.id,
            PayrollAdjustment.thang == thang,
            PayrollAdjustment.nam == nam,
            PayrollAdjustment.trang_thai == "da_duyet",
        ).all()
        tong_cong_them_adj = sum((Decimal(str(a.so_tien or 0)) for a in adjs if a.loai == "cong_them"), Decimal(0))
        tong_khau_tru_adj = sum((Decimal(str(a.so_tien or 0)) for a in adjs if a.loai == "khau_tru"), Decimal(0))

        # GAP-2 fix: Phân loại cộng thêm theo NĐ 38/2022 — chỉ những khoản
        # mang tính chất LƯƠNG mới được tính vào ngưỡng tối thiểu vùng.
        cong_them_tinh_min = sum(
            (Decimal(str(a.so_tien or 0)) for a in adjs
             if a.loai == "cong_them" and a.sub_loai in SUB_LOAI_TINH_VAO_TOI_THIEU),
            Decimal(0),
        )

        # Tách BHXH/BHYT/BHTN riêng để hiển thị
        bao_hiem_total = sum(
            (Decimal(str(a.so_tien or 0)) for a in adjs
             if a.loai == "khau_tru" and a.sub_loai in ("bhxh", "bhyt", "bhtn")),
            Decimal(0),
        )
        tam_ung_total = sum(
            (Decimal(str(a.so_tien or 0)) for a in adjs
             if a.loai == "khau_tru" and a.sub_loai == "tam_ung"),
            Decimal(0),
        )

        # ─── GAP-1 fix: Cộng Khen thưởng / Kỷ luật (RewardDiscipline) ───
        # Bản ghi đã duyệt + áp dụng cho kỳ lương này
        rds = db.query(RewardDiscipline).filter(
            RewardDiscipline.employee_id == emp.id,
            RewardDiscipline.thang_ap_dung == thang,
            RewardDiscipline.nam_ap_dung == nam,
            RewardDiscipline.trang_thai == "da_duyet",
        ).all()
        tong_thuong = sum(
            (Decimal(str(r.so_tien or 0)) for r in rds if r.loai == "khen_thuong"),
            Decimal(0),
        )
        tong_phat = sum(
            (Decimal(str(r.so_tien or 0)) for r in rds if r.loai == "ky_luat"),
            Decimal(0),
        )

        # P1 fix A.2: Cảnh báo cộng đôi thưởng — admin tạo cả PayrollAdjustment
        # sub_loai='tang_thuong_sp' VÀ RewardDiscipline khen_thuong cùng kỳ
        # → có thể là lỗ hổng tài chính (rút tiền 2 lần). Flag vào anomalies.
        if tong_thuong > 0 and any(
            a.loai == "cong_them" and a.sub_loai == "tang_thuong_sp" for a in adjs
        ):
            anomalies.append({
                "employee_id": emp.id,
                "ma_nv": emp.ma_nv,
                "ho_ten": emp.ho_ten,
                "ly_do": (
                    "Có cả PayrollAdjustment 'tang_thuong_sp' và RewardDiscipline 'khen_thuong' "
                    "cùng kỳ — nguy cơ cộng đôi tiền thưởng. HR rà soát: chỉ giữ 1 nguồn."
                ),
                "tong_thuong_adj": float(sum(
                    Decimal(str(a.so_tien or 0)) for a in adjs
                    if a.loai == "cong_them" and a.sub_loai == "tang_thuong_sp"
                )),
                "tong_thuong_rd": float(tong_thuong),
            })

        # Tổng cộng thêm gồm: adjustments + thưởng (KHÔNG cộng thưởng vào ngưỡng tối thiểu)
        tong_cong_them = tong_cong_them_adj + tong_thuong
        # Tổng khấu trừ gồm: adjustments + phạt
        tong_khau_tru = tong_khau_tru_adj + tong_phat

        # ─── GAP-2 fix: Bù tối thiểu vùng đúng NĐ 38/2022 ───
        # Lương tối thiểu của NV theo công thực tế: MIN_WAGE × (cong / ngay_chuan)
        if ngay_chuan > 0 and c["cong_quy_doi"] > 0:
            min_for_nv = min_wage * (c["cong_quy_doi"] / ngay_chuan)
        else:
            min_for_nv = Decimal(0)
        # So sánh (lương SP + cộng thêm mang tính lương) với ngưỡng, KHÔNG tính
        # thưởng, bồi dưỡng, hỗ trợ — đúng quy định NĐ 38/2022
        luong_co_dinh = luong_sp + cong_them_tinh_min
        bu = max(Decimal(0), min_for_nv - luong_co_dinh)
        luong_sp_sau_bu = luong_sp + bu

        tong_thu_nhap = luong_sp_sau_bu + tong_cong_them
        thuc_linh = tong_thu_nhap - tong_khau_tru

        # ─── Guard: NV không có thu nhập tháng này ───
        # (không sản lượng + không chấm công → lương SP=0, bù=0, không cộng thêm)
        # Không thể khấu trừ bảo hiểm từ 0đ → bỏ qua, KHÔNG tạo bảng lương âm.
        if tong_thu_nhap <= 0:
            skipped.append({
                "employee_id": emp.id,
                "ma_nv": emp.ma_nv,
                "ho_ten": emp.ho_ten,
                "ten_bo_phan": emp.bo_phan.ten_bo_phan if emp.bo_phan else None,
                "ly_do": "Không có thu nhập (chưa có sản lượng hoặc chưa chấm công trong tháng)",
                "khau_tru_treo": float(tong_khau_tru),  # khoản BH/khấu trừ chưa áp được
            })
            # Dọn bản ghi du_thao cũ (nếu lần chạy trước đã tạo bản âm)
            if not dry_run:
                stale = db.query(PayrollRun).filter(
                    PayrollRun.employee_id == emp.id,
                    PayrollRun.thang == thang,
                    PayrollRun.nam == nam,
                    PayrollRun.trang_thai == "du_thao",
                ).first()
                if stale:
                    db.delete(stale)
            continue

        # ─── Đánh dấu bất thường: có thu nhập nhưng khấu trừ > thu nhập → âm ───
        if thuc_linh < 0:
            anomalies.append({
                "employee_id": emp.id,
                "ma_nv": emp.ma_nv,
                "ho_ten": emp.ho_ten,
                "ten_bo_phan": emp.bo_phan.ten_bo_phan if emp.bo_phan else None,
                "tong_thu_nhap": float(tong_thu_nhap),
                "tong_khau_tru": float(tong_khau_tru),
                "thuc_linh": float(thuc_linh),
                "ly_do": "Khấu trừ (bảo hiểm/tạm ứng) lớn hơn thu nhập — cần rà soát",
            })

        # Lưu detail
        detail = {
            "employee_id": emp.id,
            "ma_nv": emp.ma_nv,
            "ho_ten": emp.ho_ten,
            "bo_phan_id": emp.bo_phan_id,
            "ten_bo_phan": emp.bo_phan.ten_bo_phan if emp.bo_phan else None,
            "to_id": emp.to_id,
            "ten_to": emp.to_nhom.ten_to if emp.to_nhom else None,
            "gio_lam": float(c["gio_lam"]),
            "cong_quy_doi": float(c["cong_quy_doi"]),
            "he_so_ca_nhan": float(c["he_so"]),
            "is_thu_viec": c.get("is_thu_viec", False),
            "contract_loai": c.get("contract_loai"),
            "da_nghi_giua_thang": emp.trang_thai == "da_nghi",
            "trong_so_ca_nhan": float(c["trong_so"]),
            "quy_luong_sp_to": float(quy_sp),
            "tong_trong_so_to": float(tong_trong_so),
            "luong_san_pham_truoc_bu": float(luong_sp),
            "min_toi_thieu_nv": float(min_for_nv),
            "cong_them_tinh_min": float(cong_them_tinh_min),
            "bu_toi_thieu_vung": float(bu),
            "luong_san_pham": float(luong_sp_sau_bu),
            "tong_cong_them": float(tong_cong_them),
            "thuong": float(tong_thuong),
            "tong_khau_tru": float(tong_khau_tru),
            "phat": float(tong_phat),
            "bao_hiem": float(bao_hiem_total),
            "tam_ung": float(tam_ung_total),
            "tong_thu_nhap": float(tong_thu_nhap),
            "thuc_linh": float(thuc_linh),
        }
        details.append(detail)

        # ─── Lưu vào PayrollRun nếu không phải dry-run ───
        if not dry_run:
            try:
                existing = db.query(PayrollRun).filter(
                    PayrollRun.employee_id == emp.id,
                    PayrollRun.thang == thang,
                    PayrollRun.nam == nam,
                ).first()
                # P1 fix A.5: chặn ghi đè cả "da_chot" (đã chốt nhưng chưa thanh toán)
                # để không reset đồng hồ khiếu nại 15 ngày (Điều 16 Quy chế).
                if existing and existing.trang_thai in ("da_thanh_toan", "da_chot"):
                    errors.append(
                        f"NV {emp.ma_nv}: bảng lương đã ở trạng thái '{existing.trang_thai}', "
                        f"phải mở khóa trước khi tính lại."
                    )
                    continue
                is_new = existing is None
                before_snapshot = None
                if not existing:
                    existing = PayrollRun(
                        employee_id=emp.id, thang=thang, nam=nam,
                    )
                    db.add(existing)
                    db.flush()  # cần ID để audit
                else:
                    # Snapshot trước khi engine ghi đè
                    before_snapshot = {
                        "luong_san_pham": float(existing.luong_san_pham or 0),
                        "bu_toi_thieu_vung": float(existing.bu_toi_thieu_vung or 0),
                        "phu_cap": float(existing.phu_cap or 0),
                        "thuong": float(existing.thuong or 0),
                        "bao_hiem": float(existing.bao_hiem or 0),
                        "tam_ung": float(existing.tam_ung or 0),
                        "tong_thu_nhap": float(existing.tong_thu_nhap or 0),
                        "thuc_linh": float(existing.thuc_linh or 0),
                        "trang_thai": existing.trang_thai,
                    }

                existing.luong_san_pham = luong_sp_sau_bu
                existing.bu_toi_thieu_vung = bu
                existing.gio_cong_thuc_te = c["gio_lam"]
                existing.cong_quy_doi = c["cong_quy_doi"]
                existing.he_so_ca_nhan_snapshot = c["he_so"]
                existing.trong_so_ca_nhan = c["trong_so"]
                existing.bo_phan_id_snapshot = emp.bo_phan_id
                existing.phu_cap = tong_cong_them  # D.4: tổng cộng thêm (adj + thưởng)
                existing.thuong = tong_thuong       # D.6: tách thưởng riêng để hiển thị
                existing.bao_hiem = bao_hiem_total  # D.4: BHXH+BHYT+BHTN
                existing.tam_ung = tam_ung_total    # D.4: tạm ứng đã trừ
                existing.tong_thu_nhap = tong_thu_nhap
                existing.thuc_linh = thuc_linh
                existing.trang_thai = "du_thao"
                # Ghi nhật ký Engine v2 (Sprint D.6) — đầy đủ 4 P0/P1 fix
                notes = [
                    f"Engine v2 ({nam}-{thang:02d}):",
                    f"Quỹ SP tổ={float(quy_sp):,.0f}",
                    f"Tổng trọng số={float(tong_trong_so):.2f}",
                    f"Hệ số CN={float(c['he_so']):.2f}{' (thử việc)' if c.get('is_thu_viec') else ''}",
                    f"Công quy đổi={float(c['cong_quy_doi']):.2f}",
                    f"Lương SP trước bù={float(luong_sp):,.0f}",
                ]
                if bu > 0:
                    notes.append(
                        f"Bù tối thiểu vùng={float(bu):,.0f} "
                        f"(ngưỡng {float(min_for_nv):,.0f}đ, đã trừ phụ cấp tính min "
                        f"{float(cong_them_tinh_min):,.0f}đ)"
                    )
                if tong_thuong > 0:
                    notes.append(f"+ Thưởng={float(tong_thuong):,.0f}")
                if tong_phat > 0:
                    notes.append(f"− Phạt={float(tong_phat):,.0f}")
                if emp.trang_thai == "da_nghi":
                    notes.append(f"⚠️ NV nghỉ {emp.ngay_nghi_viec} — lương phần đã làm (BLLĐ Điều 48)")
                if thuc_linh < 0:
                    notes.append("⚠️ THỰC LĨNH ÂM — khấu trừ > thu nhập")
                existing.ghi_chu_calc = " · ".join(notes)

                # GAP-7: Ghi audit engine_calc
                after_snapshot = {
                    "luong_san_pham": float(luong_sp_sau_bu),
                    "bu_toi_thieu_vung": float(bu),
                    "phu_cap": float(tong_cong_them),
                    "thuong": float(tong_thuong),
                    "bao_hiem": float(bao_hiem_total),
                    "tam_ung": float(tam_ung_total),
                    "tong_thu_nhap": float(tong_thu_nhap),
                    "thuc_linh": float(thuc_linh),
                    "trang_thai": "du_thao",
                }
                db.add(PayrollAuditLog(
                    payroll_run_id=existing.id,
                    thang=thang, nam=nam,
                    employee_id=emp.id,
                    action="engine_calc",
                    user_id=user_id,
                    ly_do="new" if is_new else "recalc",
                    before_data=before_snapshot,
                    after_data=after_snapshot,
                ))
                saved_count += 1
            except Exception as exc:  # noqa: BLE001
                errors.append(f"NV {emp.ma_nv}: {exc}")
                db.rollback()

    if not dry_run:
        db.commit()
        logger.info(
            "Payroll engine calculated: thang=%s/%s bo_phan=%s saved=%s errors=%s",
            thang, nam, bo_phan_id, saved_count, len(errors),
        )

    # Sort details theo lương desc
    details.sort(key=lambda d: -d["thuc_linh"])

    if (skipped or anomalies):
        logger.info(
            "Payroll engine thang=%s/%s: bỏ qua %s NV không thu nhập, %s NV thực lĩnh âm",
            thang, nam, len(skipped), len(anomalies),
        )

    return {
        "success": saved_count if not dry_run else len(details),
        "errors": errors,
        "skipped": skipped,
        "anomalies": anomalies,
        "details": details,
        "summary": {
            "ky": f"{thang:02d}/{nam}",
            "tu_ngay": start.isoformat(),
            "den_ngay": end.isoformat(),
            "bo_phan_id": bo_phan_id,
            "min_wage_vung": float(min_wage),
            "gio_chuan_ngay": float(gio_chuan),
            "ngay_chuan_thang": float(ngay_chuan),
            "tong_san_luong_records": len(outputs),
            "so_nv_tinh": len(details),  # số NV thực sự có bảng lương (đã loại NV bỏ qua)
            "so_nv_bo_qua": len(skipped),
            "so_nv_thuc_linh_am": len(anomalies),
            "tong_quy_luong_sp": float(sum(quy_luong_by_group.values())),
            "tong_thuc_linh": sum(d["thuc_linh"] for d in details),
            "tong_bu_toi_thieu": sum(d["bu_toi_thieu_vung"] for d in details),
        },
    }
