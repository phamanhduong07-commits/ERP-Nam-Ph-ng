"""Router: Phiếu lương cá nhân (Mobile) — Sprint D.5.

NV xem phiếu lương của mình theo tháng, gồm 8 dòng theo Điều 13.5-13.6:
  1. Lương sản phẩm (Điều 10)
  2. Bù tối thiểu vùng (Điều 4.8)
  3. Cộng thêm (Điều 12 - 8 sub_loai)
  4. Bảo hiểm (BHXH + BHYT + BHTN)
  5. Tạm ứng đã trừ
  6. Khấu trừ khác
  7. Tổng thu nhập (Điều 13.5)
  8. Thực nhận (Điều 13.6)

Bảo mật:
  - NV chỉ thấy phiếu của chính mình (mapping qua Employee.user_id)
  - Phiếu lương chỉ trả khi PayrollRun.trang_thai != "du_thao" (đã chốt)
  - HR/BGĐ vẫn xem được mọi NV qua endpoint khác (hr_payroll_runs.py)
"""
from __future__ import annotations

import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.hr import Employee, PayrollAdjustment, PayrollComplaint, PayrollRun

logger = logging.getLogger("erp")
router = APIRouter(prefix="/api/hr/my-payslip", tags=["hr-my-payslip"])


# ─── Schemas ───
class PayslipLineItem(BaseModel):
    loai: str  # cong_them | khau_tru
    sub_loai: str
    ten_hien_thi: str
    so_tien: Decimal


class MyPayslipResponse(BaseModel):
    employee_id: int
    ho_ten: str
    ma_nv: Optional[str] = None
    bo_phan: Optional[str] = None
    thang: int
    nam: int
    trang_thai: str

    # 8 dòng chi tiết theo Điều 13
    luong_san_pham: Decimal
    bu_toi_thieu_vung: Decimal
    cong_them_chi_tiet: list[PayslipLineItem]
    bao_hiem_chi_tiet: list[PayslipLineItem]
    tam_ung: Decimal
    khau_tru_khac_chi_tiet: list[PayslipLineItem]

    # Tổng kết
    tong_cong_them: Decimal
    tong_khau_tru: Decimal
    tong_thu_nhap: Decimal
    thuc_linh: Decimal

    # Engine snapshot
    cong_quy_doi: Optional[Decimal] = None
    he_so_ca_nhan: Optional[Decimal] = None
    trong_so_ca_nhan: Optional[Decimal] = None
    ghi_chu_calc: Optional[str] = None

    # Khiếu nại
    co_the_khieu_nai: bool  # còn trong hạn 15 ngày
    han_chot_khieu_nai: Optional[date] = None
    so_khieu_nai_da_gui: int


# ─── Helpers ───
def _get_my_employee(db: Session, current_user: User) -> Employee:
    """Map current user → Employee record (NV phải có user_id gán)."""
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(
            status_code=404,
            detail="Tài khoản chưa được liên kết với hồ sơ nhân viên. Liên hệ HR để cấu hình.",
        )
    return emp


def _add_business_days(start: date, days: int) -> date:
    """Cộng N ngày làm việc (loại trừ T7, CN). Đơn giản — chưa trừ lễ Tết."""
    cur = start
    added = 0
    while added < days:
        cur = date.fromordinal(cur.toordinal() + 1)
        if cur.weekday() < 5:  # Mon=0..Fri=4
            added += 1
    return cur


# ─── Endpoints ───
# IMPORTANT: route specific (/list/available) phải khai báo TRƯỚC route param
# /{nam}/{thang} để FastAPI không parse "list" thành int.
@router.get("/list/available")
def list_my_available_months_first(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List các tháng đã chốt của NV (Mobile vẽ dropdown). Phải đặt trước /{nam}/{thang}."""
    emp = _get_my_employee(db, current_user)
    runs = (
        db.query(PayrollRun.nam, PayrollRun.thang, PayrollRun.trang_thai, PayrollRun.thuc_linh)
        .filter(
            PayrollRun.employee_id == emp.id,
            PayrollRun.trang_thai.in_(["da_chot", "da_thanh_toan"]),
        )
        .order_by(PayrollRun.nam.desc(), PayrollRun.thang.desc())
        .all()
    )
    return [
        {
            "nam": r.nam,
            "thang": r.thang,
            "trang_thai": r.trang_thai,
            "thuc_linh": float(r.thuc_linh or 0),
        }
        for r in runs
    ]


@router.get("/{nam}/{thang}", response_model=MyPayslipResponse)
def get_my_payslip(
    nam: int,
    thang: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Phiếu lương cá nhân tháng/năm.

    Chỉ trả khi PayrollRun.trang_thai != "du_thao" (HR đã chốt).
    NV chỉ xem được phiếu của chính mình.
    """
    if thang < 1 or thang > 12:
        raise HTTPException(400, "Tháng không hợp lệ (1-12).")
    if nam < 2020 or nam > 2100:
        raise HTTPException(400, "Năm không hợp lệ.")

    emp = _get_my_employee(db, current_user)

    run = db.query(PayrollRun).filter(
        PayrollRun.employee_id == emp.id,
        PayrollRun.thang == thang,
        PayrollRun.nam == nam,
    ).first()
    if not run:
        raise HTTPException(404, f"Chưa có bảng lương tháng {thang}/{nam}.")
    if run.trang_thai == "du_thao":
        raise HTTPException(
            status_code=403,
            detail="Bảng lương đang ở trạng thái dự thảo, chưa được chốt. Vui lòng chờ HR công bố.",
        )

    # Load adjustments đã duyệt
    adjs = db.query(PayrollAdjustment).filter(
        PayrollAdjustment.employee_id == emp.id,
        PayrollAdjustment.thang == thang,
        PayrollAdjustment.nam == nam,
        PayrollAdjustment.trang_thai == "da_duyet",
    ).all()

    # Bản đồ tên hiển thị
    from app.routers.hr_payroll_adjustments import SUB_LOAI_CONG_THEM, SUB_LOAI_KHAU_TRU

    cong_them_items: list[PayslipLineItem] = []
    bao_hiem_items: list[PayslipLineItem] = []
    khau_tru_khac_items: list[PayslipLineItem] = []
    tam_ung_total = Decimal(0)
    bao_hiem_total = Decimal(0)
    khau_tru_khac_total = Decimal(0)

    for a in adjs:
        so_tien = Decimal(str(a.so_tien or 0))
        if a.loai == "cong_them":
            cong_them_items.append(PayslipLineItem(
                loai="cong_them",
                sub_loai=a.sub_loai,
                ten_hien_thi=SUB_LOAI_CONG_THEM.get(a.sub_loai, a.sub_loai),
                so_tien=so_tien,
            ))
        elif a.loai == "khau_tru":
            if a.sub_loai in ("bhxh", "bhyt", "bhtn"):
                bao_hiem_items.append(PayslipLineItem(
                    loai="khau_tru",
                    sub_loai=a.sub_loai,
                    ten_hien_thi=SUB_LOAI_KHAU_TRU.get(a.sub_loai, a.sub_loai),
                    so_tien=so_tien,
                ))
                bao_hiem_total += so_tien
            elif a.sub_loai == "tam_ung":
                tam_ung_total += so_tien
            else:
                khau_tru_khac_items.append(PayslipLineItem(
                    loai="khau_tru",
                    sub_loai=a.sub_loai,
                    ten_hien_thi=SUB_LOAI_KHAU_TRU.get(a.sub_loai, a.sub_loai),
                    so_tien=so_tien,
                ))
                khau_tru_khac_total += so_tien

    tong_cong_them = sum((i.so_tien for i in cong_them_items), Decimal(0))
    tong_khau_tru = bao_hiem_total + tam_ung_total + khau_tru_khac_total

    # Tính hạn khiếu nại — 15 ngày làm việc từ NGÀY CHỐT (Điều 16: "kể từ ngày nhận bảng lương")
    ngay_nhan = run.ngay_chot or (run.created_at.date() if run.created_at else date.today())
    han_chot = _add_business_days(ngay_nhan, 15)
    today = date.today()
    co_the_khieu_nai = (run.trang_thai != "da_thanh_toan") and (today <= han_chot)

    so_khieu_nai_da_gui = db.query(PayrollComplaint).filter(
        PayrollComplaint.employee_id == emp.id,
        PayrollComplaint.thang == thang,
        PayrollComplaint.nam == nam,
    ).count()

    return MyPayslipResponse(
        employee_id=emp.id,
        ho_ten=emp.ho_ten,
        ma_nv=emp.ma_nv,
        bo_phan=emp.bo_phan.ten_bo_phan if emp.bo_phan else None,
        thang=thang,
        nam=nam,
        trang_thai=run.trang_thai,
        luong_san_pham=Decimal(str(run.luong_san_pham or 0)),
        bu_toi_thieu_vung=Decimal(str(run.bu_toi_thieu_vung or 0)),
        cong_them_chi_tiet=cong_them_items,
        bao_hiem_chi_tiet=bao_hiem_items,
        tam_ung=tam_ung_total,
        khau_tru_khac_chi_tiet=khau_tru_khac_items,
        tong_cong_them=tong_cong_them,
        tong_khau_tru=tong_khau_tru,
        tong_thu_nhap=Decimal(str(run.tong_thu_nhap or 0)),
        thuc_linh=Decimal(str(run.thuc_linh or 0)),
        cong_quy_doi=Decimal(str(run.cong_quy_doi or 0)) if run.cong_quy_doi else None,
        he_so_ca_nhan=Decimal(str(run.he_so_ca_nhan_snapshot or 0)) if run.he_so_ca_nhan_snapshot else None,
        trong_so_ca_nhan=Decimal(str(run.trong_so_ca_nhan or 0)) if run.trong_so_ca_nhan else None,
        ghi_chu_calc=run.ghi_chu_calc,
        co_the_khieu_nai=co_the_khieu_nai,
        han_chot_khieu_nai=han_chot,
        so_khieu_nai_da_gui=so_khieu_nai_da_gui,
    )


