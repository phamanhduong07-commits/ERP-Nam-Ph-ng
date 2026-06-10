"""HR Approval Workflow (Sprint C — Workflow đơn từ thống nhất).

5 loại đơn dùng chung 1 luồng:
  - nghi_phep        : nghỉ phép có ngày
  - tang_ca          : tăng ca (so_gio_ot)
  - di_muon_ve_som   : đi muộn / về sớm
  - cong_tac         : công tác (dia_diem + so_tien tạm ứng)
  - ung_luong        : ứng lương (so_tien)

Workflow 2 bước: cho_duyet → phong_ban_duyet → bgd_duyet
Hoặc: cho_duyet → tu_choi / huy (huy chỉ bởi chính người tạo, chỉ khi còn cho_duyet)
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.hr import AttendanceLog, Employee, LeaveRequest
from app.utils import hr_roles as hrr

logger = logging.getLogger("erp.hr.workflow")

router = APIRouter(prefix="/api/hr", tags=["HR Approval Workflow"])


# ─── Schemas ───
LoaiDon = Literal["nghi_phep", "tang_ca", "di_muon_ve_som", "cong_tac", "ung_luong"]
TrangThai = Literal["cho_duyet", "phong_ban_duyet", "bgd_duyet", "tu_choi", "huy"]


class LeaveRequestCreate(BaseModel):
    """Submit đơn — employee_id KHÔNG nhận từ client, tự lấy từ current_user."""
    loai_don: LoaiDon
    ngay_bat_dau: datetime
    ngay_ket_thuc: datetime
    tong_ngay: Optional[Decimal] = Field(default=None, ge=0, le=365)
    ly_do: Optional[str] = Field(default=None, max_length=2000)
    so_tien: Optional[Decimal] = Field(default=None, ge=0, le=1_000_000_000)
    so_gio_ot: Optional[Decimal] = Field(default=None, ge=0, le=24)
    dia_diem: Optional[str] = Field(default=None, max_length=255)
    file_dinh_kem_url: Optional[str] = Field(default=None, max_length=500)

    @field_validator("file_dinh_kem_url")
    @classmethod
    def safe_file_url(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return v
        low = v.lower().strip()
        if ".." in v or low.startswith(("file:", "javascript:", "ftp:", "vbscript:")):
            raise ValueError("URL file đính kèm không hợp lệ")
        if low.startswith("data:") and not low.startswith(
            ("data:image/jpeg", "data:image/png", "data:image/webp", "data:application/pdf")
        ):
            raise ValueError("Chỉ chấp nhận data:image/* hoặc data:application/pdf")
        return v.strip()


class ApprovalDecision(BaseModel):
    """Quyết định duyệt — nguoi_duyet lấy từ current_user, KHÔNG nhận từ client."""
    decision: Literal["approve", "reject"]
    y_kien: Optional[str] = Field(default=None, max_length=1000)


# ─── Helpers (thin wrappers — dùng app.utils.hr_roles để tránh drift) ───
def _role_code(user: User) -> str:
    return hrr.role_code(user)


def _is_hr_admin(user: User) -> bool:
    return hrr.is_hr_admin(user)


def _is_dept_manager(user: User) -> bool:
    return hrr.is_dept_manager(user)


def _is_bgd(user: User) -> bool:
    return hrr.is_bgd(user)


def _can_request_overtime(user: User) -> bool:
    return hrr.can_request_overtime(user)


def _serialize(req: LeaveRequest) -> dict:
    """Convert LeaveRequest → dict cho response."""
    return {
        "id": req.id,
        "employee_id": req.employee_id,
        "employee": {
            "ho_ten": req.employee.ho_ten if req.employee else None,
            "ma_nv": req.employee.ma_nv if req.employee else None,
        },
        "loai_don": req.loai_don,
        "ngay_bat_dau": req.ngay_bat_dau.isoformat() if req.ngay_bat_dau else None,
        "ngay_ket_thuc": req.ngay_ket_thuc.isoformat() if req.ngay_ket_thuc else None,
        "tong_ngay": float(req.tong_ngay) if req.tong_ngay else 0,
        "ly_do": req.ly_do,
        "so_tien": float(req.so_tien) if req.so_tien else None,
        "so_gio_ot": float(req.so_gio_ot) if req.so_gio_ot else None,
        "dia_diem": req.dia_diem,
        "file_dinh_kem_url": req.file_dinh_kem_url,
        "trang_thai": req.trang_thai,
        "y_kien_duyet": req.y_kien_duyet,
        "ngay_duyet": req.ngay_duyet.isoformat() if req.ngay_duyet else None,
        "nguoi_duyet_dept_id": req.nguoi_duyet_dept_id,
        "nguoi_duyet_bgd_id": req.nguoi_duyet_bgd_id,
        "da_xu_ly": req.da_xu_ly,
        "created_at": req.created_at.isoformat() if req.created_at else None,
    }


def _apply_to_attendance_on_approve(req: LeaveRequest, db: Session) -> None:
    """Sau khi BGĐ duyệt: tự động cập nhật AttendanceLog.

    - nghi_phep : đánh dấu các ngày nghỉ
    - tang_ca   : cộng so_gio_ot vào ngày bắt đầu
    """
    if req.loai_don == "nghi_phep":
        start = req.ngay_bat_dau.date()
        end = req.ngay_ket_thuc.date()
        ghi_chu = f"Nghỉ phép được duyệt{': ' + req.ly_do if req.ly_do else ''}"
        current = start
        while current <= end:
            log = db.query(AttendanceLog).filter(
                AttendanceLog.employee_id == req.employee_id,
                AttendanceLog.ngay == current,
            ).first()
            if log:
                log.trang_thai = "nghi_phep"
                log.so_cong = Decimal("1.0")
                log.ghi_chu = ghi_chu
            else:
                db.add(AttendanceLog(
                    employee_id=req.employee_id, ngay=current,
                    loai="thu_cong", trang_thai="nghi_phep",
                    so_cong=Decimal("1.0"), ghi_chu=ghi_chu,
                ))
            current += timedelta(days=1)

    elif req.loai_don == "tang_ca" and req.so_gio_ot:
        # Cộng giờ OT vào ngày bắt đầu (thường OT là cùng 1 ngày)
        ngay_ot = req.ngay_bat_dau.date()
        log = db.query(AttendanceLog).filter(
            AttendanceLog.employee_id == req.employee_id,
            AttendanceLog.ngay == ngay_ot,
        ).first()
        if not log:
            log = AttendanceLog(
                employee_id=req.employee_id, ngay=ngay_ot,
                loai="thu_cong", trang_thai="hop_le",
            )
            db.add(log)
        log.so_gio_ot = (log.so_gio_ot or Decimal("0")) + req.so_gio_ot
        log.ghi_chu = (log.ghi_chu or "") + f" [OT duyệt: +{req.so_gio_ot}h]"


# ─── API Endpoints ───

@router.get("/leave-requests")
def list_leave_requests(
    status: Optional[str] = None,
    loai_don: Optional[str] = None,
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List đơn từ.

    - HR/Admin: xem tất cả
    - Trưởng phòng: xem đơn của phòng mình + của chính mình
    - User thường: chỉ xem CỦA CHÍNH MÌNH
    """
    q = db.query(LeaveRequest)

    if not _is_dept_manager(current_user):
        # User thường — chỉ xem của mình
        my_emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not my_emp:
            return []
        q = q.filter(LeaveRequest.employee_id == my_emp.id)
    elif employee_id:
        q = q.filter(LeaveRequest.employee_id == employee_id)

    if status:
        q = q.filter(LeaveRequest.trang_thai == status)
    if loai_don:
        q = q.filter(LeaveRequest.loai_don == loai_don)

    return [_serialize(r) for r in q.order_by(LeaveRequest.created_at.desc()).all()]


@router.get("/leave-requests/inbox-count")
def get_inbox_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Đếm số đơn cần duyệt cho current user. Trả 0 nếu không có quyền duyệt."""
    if not _is_dept_manager(current_user):
        return {"cho_duyet": 0, "phong_ban_duyet": 0}
    cho_duyet = db.query(LeaveRequest).filter(LeaveRequest.trang_thai == "cho_duyet").count()
    phong_ban_duyet = db.query(LeaveRequest).filter(LeaveRequest.trang_thai == "phong_ban_duyet").count() if _is_bgd(current_user) else 0
    return {
        "cho_duyet": cho_duyet,
        "phong_ban_duyet": phong_ban_duyet,
        "total": cho_duyet + phong_ban_duyet,
    }


@router.post("/leave-requests")
def create_leave_request(
    body: LeaveRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Nhân viên submit đơn. employee_id auto từ current_user (không cho client truyền)."""
    my_emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not my_emp:
        raise HTTPException(403, "Tài khoản của bạn chưa liên kết với hồ sơ nhân viên")

    # Tăng ca: chỉ tổ trưởng / tổ phó / cấp trên hơn được đề xuất
    if body.loai_don == "tang_ca" and not _can_request_overtime(current_user):
        raise HTTPException(
            403,
            "Chỉ tổ trưởng / tổ phó mới được đề xuất tăng ca. "
            "Liên hệ tổ trưởng của bạn để được nộp đơn tăng ca."
        )

    # Validate logic theo loại đơn
    if body.ngay_ket_thuc < body.ngay_bat_dau:
        raise HTTPException(400, "Ngày kết thúc phải sau ngày bắt đầu")
    if body.loai_don in ("ung_luong", "cong_tac") and (body.so_tien is None or body.so_tien <= 0):
        raise HTTPException(400, "Đơn ứng lương / công tác phí phải có số tiền > 0")
    if body.loai_don == "tang_ca" and (body.so_gio_ot is None or body.so_gio_ot <= 0):
        raise HTTPException(400, "Đơn tăng ca phải có số giờ > 0")
    if body.loai_don == "cong_tac" and not body.dia_diem:
        raise HTTPException(400, "Đơn công tác phải có địa điểm")

    # Auto tính tong_ngay — LUÔN recompute server-side cho nghi_phep để chặn bypass
    # (client gửi tong_ngay=0 sẽ vô hiệu hóa logic trừ công ở _apply_to_attendance_on_approve)
    if body.loai_don == "nghi_phep":
        days = (body.ngay_ket_thuc.date() - body.ngay_bat_dau.date()).days + 1
        tong_ngay = Decimal(str(max(0.5, days)))
    else:
        tong_ngay = body.tong_ngay or Decimal("0")

    req = LeaveRequest(
        employee_id=my_emp.id,
        loai_don=body.loai_don,
        ngay_bat_dau=body.ngay_bat_dau,
        ngay_ket_thuc=body.ngay_ket_thuc,
        tong_ngay=tong_ngay or Decimal("0"),
        ly_do=body.ly_do,
        so_tien=body.so_tien,
        so_gio_ot=body.so_gio_ot,
        dia_diem=body.dia_diem,
        file_dinh_kem_url=body.file_dinh_kem_url,
        trang_thai="cho_duyet",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    logger.info("HR request created id=%s loai=%s employee=%s by user=%s",
                req.id, req.loai_don, req.employee_id, current_user.id)
    return {"status": "success", "id": req.id, "data": _serialize(req)}


@router.post("/leave-requests/{id}/approve")
def approve_leave_request(
    id: int,
    body: ApprovalDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Duyệt đơn — auto-detect role + workflow step.

    Quy trình:
      cho_duyet           → trưởng phòng duyệt → phong_ban_duyet
      phong_ban_duyet     → BGĐ duyệt          → bgd_duyet (FINAL)
      bất kỳ → reject     → tu_choi (FINAL)
    """
    # SELECT ... FOR UPDATE để tránh race khi 2 BGĐ duyệt đồng thời
    # (sẽ block lẫn nhau, người sau sẽ thấy trạng thái đã cập nhật và bị 400)
    req = db.query(LeaveRequest).filter(LeaveRequest.id == id).with_for_update().first()
    if not req:
        raise HTTPException(404, "Không tìm thấy đơn")

    if req.trang_thai in ("bgd_duyet", "tu_choi", "huy"):
        raise HTTPException(400, f"Đơn đã ở trạng thái cuối ({req.trang_thai}) — không duyệt được nữa")

    # Reject — bất kỳ ai có quyền duyệt đều reject được
    if body.decision == "reject":
        if not _is_dept_manager(current_user):
            raise HTTPException(403, "Bạn không có quyền duyệt đơn")
        req.trang_thai = "tu_choi"
        req.y_kien_duyet = body.y_kien or "Từ chối"
        req.ngay_duyet = datetime.now(timezone.utc)
        if _is_bgd(current_user):
            req.nguoi_duyet_bgd_id = current_user.id
        else:
            req.nguoi_duyet_dept_id = current_user.id
        db.commit()
        logger.info("HR request %s REJECTED by user=%s", req.id, current_user.id)
        return {"status": "rejected", "data": _serialize(req)}

    # Approve flow
    if req.trang_thai == "cho_duyet":
        # Bước 1: trưởng phòng / HR / Admin duyệt
        if not _is_dept_manager(current_user):
            raise HTTPException(403, "Cần quyền trưởng phòng trở lên để duyệt bước 1")
        # Ngăn tự duyệt đơn của chính mình
        my_emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if my_emp and my_emp.id == req.employee_id and not _is_hr_admin(current_user):
            raise HTTPException(403, "Không thể tự duyệt đơn của chính mình")
        req.trang_thai = "phong_ban_duyet"
        req.nguoi_duyet_dept_id = current_user.id
        # Nếu là BGĐ/Admin duyệt bước 1, tự nhảy thẳng bước 2 (one-click final approval)
        if _is_bgd(current_user):
            req.trang_thai = "bgd_duyet"
            req.nguoi_duyet_bgd_id = current_user.id
    elif req.trang_thai == "phong_ban_duyet":
        # Bước 2: BGĐ duyệt cuối
        if not _is_bgd(current_user):
            raise HTTPException(403, "Cần quyền Ban Giám Đốc để duyệt cuối")
        req.trang_thai = "bgd_duyet"
        req.nguoi_duyet_bgd_id = current_user.id
    else:
        raise HTTPException(400, f"Trạng thái {req.trang_thai} không hợp lệ để duyệt")

    req.y_kien_duyet = body.y_kien
    req.ngay_duyet = datetime.now(timezone.utc)

    # Khi đạt bg_duyet (FINAL) → tự động cập nhật AttendanceLog
    if req.trang_thai == "bgd_duyet":
        _apply_to_attendance_on_approve(req, db)

    db.commit()
    db.refresh(req)
    logger.info("HR request %s → %s by user=%s", req.id, req.trang_thai, current_user.id)
    return {"status": "approved", "trang_thai": req.trang_thai, "data": _serialize(req)}


@router.post("/leave-requests/{id}/cancel")
def cancel_leave_request(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Hủy đơn — chỉ người tạo + chỉ khi còn ở trạng thái cho_duyet."""
    req = db.query(LeaveRequest).filter(LeaveRequest.id == id).with_for_update().first()
    if not req:
        raise HTTPException(404, "Không tìm thấy đơn")
    my_emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    is_self = bool(my_emp and my_emp.id == req.employee_id)
    if not is_self and not _is_hr_admin(current_user):
        raise HTTPException(403, "Chỉ người tạo đơn (hoặc HR) mới có quyền hủy")
    if req.trang_thai != "cho_duyet":
        raise HTTPException(400, f"Chỉ hủy được đơn ở trạng thái cho_duyet (hiện: {req.trang_thai})")
    req.trang_thai = "huy"
    db.commit()
    # Audit log phân biệt self-cancel vs HR override
    action = "self-cancel" if is_self else "HR-override-cancel"
    logger.info("HR request %s CANCELLED (%s) by user=%s employee=%s",
                req.id, action, current_user.id, req.employee_id)
    return {"status": "cancelled"}


@router.post("/leave-requests/{id}/mark-processed")
def mark_processed(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU", "KE_TOAN")),
):
    """HR/Kế toán đánh dấu đã xử lý hậu kỳ (đã chi tiền công tác, đã trừ ứng lương...)."""
    req = db.query(LeaveRequest).filter(LeaveRequest.id == id).with_for_update().first()
    if not req:
        raise HTTPException(404, "Không tìm thấy đơn")
    if req.trang_thai != "bgd_duyet":
        raise HTTPException(400, "Chỉ đánh dấu được đơn đã duyệt cuối")
    req.da_xu_ly = True
    db.commit()
    logger.info("HR request %s MARKED PROCESSED by user=%s", req.id, current_user.id)
    return {"status": "marked"}
