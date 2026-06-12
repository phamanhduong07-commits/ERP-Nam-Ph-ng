"""Router: Khiếu nại tiền lương — Sprint D.5 (Điều 16 Quy chế Lương).

Quy trình 4 bước Điều 16:
  1. Người lao động phản hồi → tạo complaint (status=moi)
  2. HR / quản lý phối hợp kiểm tra → chuyển dang_xu_ly
  3a. Có sai sót → công ty điều chỉnh vào kỳ lương gần nhất hoặc thanh toán bổ sung (co_sai_sot)
  3b. Không có sai sót → nhân sự giải thích căn cứ tính lương (khong_sai_sot)

Hạn 15 ngày làm việc — auto tính khi tạo. Sau hạn → tự động chuyển het_han.

Bảo mật:
  - NV chỉ xem/sửa được khiếu nại của chính mình
  - HR/quản lý/BGĐ thấy toàn bộ
  - 4-eyes principle: người tạo khiếu nại không được tự xử lý
  - Khi kết luận "có sai sót" → có thể tự sinh PayrollAdjustment khoản điều chỉnh (link adjustment_id)
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.hr import Employee, PayrollAdjustment, PayrollComplaint, PayrollRun

logger = logging.getLogger("erp")
router = APIRouter(prefix="/api/hr/payroll-complaints", tags=["hr-payroll-complaints"])


# ─── Schemas ───
class ComplaintCreate(BaseModel):
    payroll_run_id: Optional[int] = None  # None nếu khiếu nại tổng thể tháng
    thang: int = Field(ge=1, le=12)
    nam: int = Field(ge=2020, le=2100)
    ly_do: str = Field(min_length=10, max_length=2000)
    so_tien_khieu_nai: Optional[Decimal] = Field(default=None, ge=0)
    bang_chung: Optional[str] = Field(default=None, max_length=1000)


class ComplaintResolve(BaseModel):
    """HR / quản lý xử lý khiếu nại — kết luận có hoặc không có sai sót."""
    co_sai_sot: bool
    ket_qua: str = Field(min_length=10, max_length=2000)
    so_tien_dieu_chinh: Optional[Decimal] = Field(default=None, ge=0)
    # Nếu có sai sót → có thể tạo luôn PayrollAdjustment kỳ sau
    tao_dieu_chinh_ky_sau: bool = False
    sub_loai_dieu_chinh: Optional[str] = None  # mặc định "phat" (điều chỉnh khác)


class ComplaintRead(BaseModel):
    id: int
    employee_id: int
    ho_ten: str
    ma_nv: Optional[str] = None
    bo_phan: Optional[str] = None
    payroll_run_id: Optional[int] = None
    thang: int
    nam: int
    ly_do: str
    so_tien_khieu_nai: Optional[Decimal] = None
    bang_chung: Optional[str] = None
    ngay_nhan_phieu: date
    han_chot: date
    so_ngay_con_lai: int  # tính từ today đến han_chot
    trang_thai: str
    nguoi_xu_ly_id: Optional[int] = None
    nguoi_xu_ly_ten: Optional[str] = None
    ngay_xu_ly: Optional[datetime] = None
    ket_qua: Optional[str] = None
    so_tien_dieu_chinh: Optional[Decimal] = None
    adjustment_id: Optional[int] = None
    created_at: datetime
    created_by_id: Optional[int] = None

    class Config:
        from_attributes = True


# ─── Helpers ───
def _add_business_days(start: date, days: int) -> date:
    cur = start
    added = 0
    while added < days:
        cur = date.fromordinal(cur.toordinal() + 1)
        if cur.weekday() < 5:
            added += 1
    return cur


def _get_my_employee(db: Session, user: User) -> Employee:
    emp = db.query(Employee).filter(Employee.user_id == user.id).first()
    if not emp:
        raise HTTPException(404, "Tài khoản chưa được liên kết với hồ sơ nhân viên.")
    return emp


def _to_read(c: PayrollComplaint, db: Session) -> ComplaintRead:
    today = date.today()
    so_ngay = (c.han_chot - today).days
    return ComplaintRead(
        id=c.id,
        employee_id=c.employee_id,
        ho_ten=c.employee.ho_ten if c.employee else "",
        ma_nv=c.employee.ma_nv if c.employee else None,
        bo_phan=c.employee.bo_phan.ten_bo_phan if c.employee and c.employee.bo_phan else None,
        payroll_run_id=c.payroll_run_id,
        thang=c.thang,
        nam=c.nam,
        ly_do=c.ly_do,
        so_tien_khieu_nai=c.so_tien_khieu_nai,
        bang_chung=c.bang_chung,
        ngay_nhan_phieu=c.ngay_nhan_phieu,
        han_chot=c.han_chot,
        so_ngay_con_lai=max(0, so_ngay),
        trang_thai=c.trang_thai,
        nguoi_xu_ly_id=c.nguoi_xu_ly_id,
        nguoi_xu_ly_ten=c.nguoi_xu_ly.ho_ten if c.nguoi_xu_ly else None,
        ngay_xu_ly=c.ngay_xu_ly,
        ket_qua=c.ket_qua,
        so_tien_dieu_chinh=c.so_tien_dieu_chinh,
        adjustment_id=c.adjustment_id,
        created_at=c.created_at,
        created_by_id=c.created_by_id,
    )


# ─── Endpoints ───
@router.post("", response_model=ComplaintRead, status_code=201)
def create_complaint(
    payload: ComplaintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """NV tạo khiếu nại cho phiếu lương tháng/năm.

    Validate:
      - Phải có PayrollRun đã chốt (không phải dự thảo)
      - Còn trong hạn 15 ngày làm việc
      - Không cho khiếu nại lại nếu đã có khiếu nại "co_sai_sot" hoặc "khong_sai_sot" cùng kỳ
    """
    emp = _get_my_employee(db, current_user)

    # Tìm bảng lương kỳ này
    run = db.query(PayrollRun).filter(
        PayrollRun.employee_id == emp.id,
        PayrollRun.thang == payload.thang,
        PayrollRun.nam == payload.nam,
    ).first()
    if not run:
        raise HTTPException(404, f"Chưa có bảng lương tháng {payload.thang}/{payload.nam}.")
    if run.trang_thai == "du_thao":
        raise HTTPException(403, "Bảng lương chưa được chốt — chưa thể khiếu nại.")

    # Hạn 15 ngày làm việc từ NGÀY CHỐT (Điều 16: "kể từ ngày nhận bảng lương")
    ngay_nhan = run.ngay_chot or (run.created_at.date() if run.created_at else date.today())
    han = _add_business_days(ngay_nhan, 15)
    today = date.today()
    if today > han:
        raise HTTPException(
            status_code=400,
            detail=f"Đã quá hạn khiếu nại 15 ngày làm việc (hạn {han.strftime('%d/%m/%Y')}).",
        )

    # Chặn double khiếu nại đã có kết luận
    existing = db.query(PayrollComplaint).filter(
        PayrollComplaint.employee_id == emp.id,
        PayrollComplaint.thang == payload.thang,
        PayrollComplaint.nam == payload.nam,
        PayrollComplaint.trang_thai.in_(["co_sai_sot", "khong_sai_sot"]),
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Khiếu nại tháng {payload.thang}/{payload.nam} đã được xử lý xong. Liên hệ HR nếu cần.",
        )

    c = PayrollComplaint(
        employee_id=emp.id,
        payroll_run_id=payload.payroll_run_id or run.id,
        thang=payload.thang,
        nam=payload.nam,
        ly_do=payload.ly_do.strip(),
        so_tien_khieu_nai=payload.so_tien_khieu_nai,
        bang_chung=payload.bang_chung.strip() if payload.bang_chung else None,
        ngay_nhan_phieu=ngay_nhan,
        han_chot=han,
        trang_thai="moi",
        created_by_id=current_user.id,
    )
    db.add(c)
    db.commit()
    db.refresh(c)

    logger.info(f"PayrollComplaint #{c.id} created by user_id={current_user.id} emp_id={emp.id} thang={payload.thang}/{payload.nam}")
    return _to_read(c, db)


@router.get("", response_model=list[ComplaintRead])
def list_complaints(
    thang: Optional[int] = Query(default=None, ge=1, le=12),
    nam: Optional[int] = Query(default=None, ge=2020, le=2100),
    trang_thai: Optional[str] = None,
    bo_phan_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List complaints.

    - NV thường: chỉ thấy của mình
    - HR/quản lý/BGĐ: thấy tất cả
    """
    from app.routers.hr import _role_code
    role = _role_code(current_user)
    is_hr = role in ("ADMIN", "NHAN_SU", "GIAM_DOC", "BGD", "TRUONG_PHONG")

    q = db.query(PayrollComplaint).options(
        joinedload(PayrollComplaint.employee).joinedload(Employee.bo_phan),
        joinedload(PayrollComplaint.nguoi_xu_ly),
    ).join(Employee, PayrollComplaint.employee_id == Employee.id)
    if not is_hr:
        emp = _get_my_employee(db, current_user)
        q = q.filter(PayrollComplaint.employee_id == emp.id)
    if thang:
        q = q.filter(PayrollComplaint.thang == thang)
    if nam:
        q = q.filter(PayrollComplaint.nam == nam)
    if trang_thai:
        q = q.filter(PayrollComplaint.trang_thai == trang_thai)
    if bo_phan_id and is_hr:
        q = q.filter(Employee.bo_phan_id == bo_phan_id)

    rows = q.order_by(PayrollComplaint.created_at.desc()).limit(500).all()
    return [_to_read(c, db) for c in rows]


@router.get("/summary")
def summary(
    thang: Optional[int] = Query(default=None, ge=1, le=12),
    nam: Optional[int] = Query(default=None, ge=2020, le=2100),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "NHAN_SU", "GIAM_DOC", "BGD", "TRUONG_PHONG")),
):
    """Tổng quan khiếu nại theo tháng — HR/BGĐ chỉ."""
    q = db.query(PayrollComplaint)
    if thang:
        q = q.filter(PayrollComplaint.thang == thang)
    if nam:
        q = q.filter(PayrollComplaint.nam == nam)

    by_status = (
        q.with_entities(PayrollComplaint.trang_thai, func.count(PayrollComplaint.id))
        .group_by(PayrollComplaint.trang_thai)
        .all()
    )
    return {
        "tong": sum(c for _, c in by_status),
        "by_trang_thai": {s: c for s, c in by_status},
    }


@router.put("/{cid}", response_model=ComplaintRead)
def update_complaint(
    cid: int,
    payload: ComplaintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """NV chỉnh sửa khiếu nại của mình khi còn ở trạng thái 'moi'."""
    c = db.query(PayrollComplaint).filter(PayrollComplaint.id == cid).first()
    if not c:
        raise HTTPException(404, "Không tìm thấy khiếu nại.")

    emp = _get_my_employee(db, current_user)
    if c.employee_id != emp.id:
        raise HTTPException(403, "Bạn không có quyền sửa khiếu nại này.")
    if c.trang_thai != "moi":
        raise HTTPException(400, "Khiếu nại đã được HR tiếp nhận — không thể sửa.")

    c.ly_do = payload.ly_do.strip()
    c.so_tien_khieu_nai = payload.so_tien_khieu_nai
    c.bang_chung = payload.bang_chung.strip() if payload.bang_chung else None
    db.commit()
    db.refresh(c)
    return _to_read(c, db)


@router.post("/{cid}/take", response_model=ComplaintRead)
def take_complaint(
    cid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU", "GIAM_DOC", "BGD", "TRUONG_PHONG")),
):
    """HR / quản lý nhận tiếp khiếu nại → chuyển sang dang_xu_ly."""
    c = db.query(PayrollComplaint).filter(PayrollComplaint.id == cid).first()
    if not c:
        raise HTTPException(404, "Không tìm thấy khiếu nại.")
    if c.trang_thai not in ("moi", "dang_xu_ly"):
        raise HTTPException(400, f"Khiếu nại đang ở trạng thái '{c.trang_thai}' — không thể nhận.")

    from app.routers.hr import _role_code
    role = _role_code(current_user)

    # 4-eyes #1: không tự xử lý khiếu nại do mình tạo
    if c.created_by_id == current_user.id and role != "ADMIN":
        raise HTTPException(403, "Bạn không được tự xử lý khiếu nại do mình tạo (nguyên tắc 4-eyes).")

    # 4-eyes #2: không tự xử lý khiếu nại lương của CHÍNH MÌNH (employee chính là user hiện tại)
    target_emp = db.query(Employee).filter(Employee.id == c.employee_id).first()
    if target_emp and target_emp.user_id == current_user.id and role != "ADMIN":
        raise HTTPException(403, "Bạn không được tự xử lý khiếu nại lương của chính mình.")

    # Chặn override người đang xử lý (chỉ ADMIN/GIAM_DOC/BGD được giành tiếp)
    if c.trang_thai == "dang_xu_ly" and c.nguoi_xu_ly_id and c.nguoi_xu_ly_id != current_user.id:
        if role not in ("ADMIN", "GIAM_DOC", "BGD"):
            raise HTTPException(
                status_code=409,
                detail=f"Khiếu nại đang được user_id={c.nguoi_xu_ly_id} xử lý. Liên hệ BGĐ nếu cần giành tiếp.",
            )
        logger.warning(f"Complaint #{cid} taken over: prev_handler={c.nguoi_xu_ly_id} → new={current_user.id} (role={role})")

    c.trang_thai = "dang_xu_ly"
    c.nguoi_xu_ly_id = current_user.id
    db.commit()
    db.refresh(c)
    return _to_read(c, db)


@router.post("/{cid}/resolve", response_model=ComplaintRead)
def resolve_complaint(
    cid: int,
    payload: ComplaintResolve,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU", "GIAM_DOC", "BGD", "TRUONG_PHONG")),
):
    """Kết luận xử lý khiếu nại (Điều 16):
      - co_sai_sot=True → có thể tự tạo PayrollAdjustment cho kỳ lương gần nhất
      - co_sai_sot=False → cập nhật giải thích, không tạo adjustment
    """
    c = db.query(PayrollComplaint).filter(PayrollComplaint.id == cid).first()
    if not c:
        raise HTTPException(404, "Không tìm thấy khiếu nại.")
    if c.trang_thai in ("co_sai_sot", "khong_sai_sot", "het_han"):
        raise HTTPException(400, f"Khiếu nại đã ở trạng thái cuối '{c.trang_thai}'.")

    from app.routers.hr import _role_code
    role = _role_code(current_user)

    # 4-eyes #1: không tự kết luận khiếu nại do mình tạo
    if c.created_by_id == current_user.id and role != "ADMIN":
        raise HTTPException(403, "Bạn không được tự kết luận khiếu nại do mình tạo (nguyên tắc 4-eyes).")

    # 4-eyes #2: không tự kết luận khiếu nại lương CỦA CHÍNH MÌNH
    target_emp = db.query(Employee).filter(Employee.id == c.employee_id).first()
    if target_emp and target_emp.user_id == current_user.id and role != "ADMIN":
        raise HTTPException(403, "Bạn không được tự kết luận khiếu nại lương của chính mình.")

    # Validate dữ liệu khi co_sai_sot
    if payload.co_sai_sot:
        if not payload.so_tien_dieu_chinh or payload.so_tien_dieu_chinh <= 0:
            raise HTTPException(400, "Kết luận 'có sai sót' yêu cầu nhập số tiền điều chỉnh > 0.")
        # Whitelist sub_loai_dieu_chinh
        from app.routers.hr_payroll_adjustments import SUB_LOAI_CONG_THEM
        sub = payload.sub_loai_dieu_chinh or "pc_khac"
        if sub not in SUB_LOAI_CONG_THEM:
            raise HTTPException(400, f"sub_loai_dieu_chinh không hợp lệ: {sub}. Cho phép: {list(SUB_LOAI_CONG_THEM)}")

    c.trang_thai = "co_sai_sot" if payload.co_sai_sot else "khong_sai_sot"
    c.ket_qua = payload.ket_qua.strip()
    c.so_tien_dieu_chinh = payload.so_tien_dieu_chinh if payload.co_sai_sot else None
    c.nguoi_xu_ly_id = current_user.id
    c.ngay_xu_ly = datetime.now(timezone.utc)

    # Nếu có sai sót và HR yêu cầu tự tạo adjustment kỳ sau (Điều 16 — "điều chỉnh vào kỳ lương gần nhất")
    if payload.co_sai_sot and payload.tao_dieu_chinh_ky_sau:
        # Kỳ điều chỉnh = tháng sau (sang năm nếu là tháng 12)
        next_thang = c.thang + 1 if c.thang < 12 else 1
        next_nam = c.nam if c.thang < 12 else c.nam + 1
        adj = PayrollAdjustment(
            employee_id=c.employee_id,
            thang=next_thang,
            nam=next_nam,
            loai="cong_them",
            sub_loai=payload.sub_loai_dieu_chinh or "pc_khac",
            so_tien=payload.so_tien_dieu_chinh,
            ngay_phat_sinh=date.today(),
            ghi_chu=f"Điều chỉnh từ khiếu nại #{c.id} kỳ {c.thang}/{c.nam}: {payload.ket_qua[:200]}",
            trang_thai="du_thao",
            created_by_id=current_user.id,
        )
        db.add(adj)
        db.flush()
        c.adjustment_id = adj.id

    db.commit()
    db.refresh(c)

    logger.info(f"PayrollComplaint #{c.id} resolved by user_id={current_user.id} → {c.trang_thai}")
    return _to_read(c, db)


@router.delete("/{cid}")
def delete_complaint(
    cid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """NV rút khiếu nại khi còn 'moi'. HR/ADMIN có thể xóa bất kỳ trạng thái."""
    c = db.query(PayrollComplaint).filter(PayrollComplaint.id == cid).first()
    if not c:
        raise HTTPException(404, "Không tìm thấy khiếu nại.")

    from app.routers.hr import _role_code
    role = _role_code(current_user)
    is_admin = role in ("ADMIN", "NHAN_SU")

    if not is_admin:
        emp = _get_my_employee(db, current_user)
        if c.employee_id != emp.id:
            raise HTTPException(403, "Bạn không có quyền xóa khiếu nại này.")
        if c.trang_thai != "moi":
            raise HTTPException(400, "Khiếu nại đã được tiếp nhận — không thể rút.")

    db.delete(c)
    db.commit()
    return {"ok": True, "id": cid}


@router.post("/_auto_expire")
def auto_expire(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    """Tự cập nhật trạng thái het_han cho khiếu nại quá hạn 15 ngày.

    Có thể gọi định kỳ qua cron. Trả về số record đã update.
    """
    today = date.today()
    rows = db.query(PayrollComplaint).filter(
        PayrollComplaint.trang_thai.in_(["moi", "dang_xu_ly"]),
        PayrollComplaint.han_chot < today,
    ).all()
    ids = [r.id for r in rows]
    for r in rows:
        r.trang_thai = "het_han"
    db.commit()
    if ids:
        logger.warning(f"Auto-expire {len(ids)} complaints by user_id={current_user.id}: ids={ids}")
    return {"updated": len(rows)}
