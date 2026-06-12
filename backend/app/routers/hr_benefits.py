"""HR Benefits (Phúc lợi) — Sprint phúc lợi.

Quản lý chính sách phúc lợi + bản ghi cấp phúc lợi cho NV.
- Sinh nhật: auto cron sinh BenefitRecord hàng ngày
- Lễ Tết: HR bulk-tạo cho tất cả NV active
- Hiếu/hỉ/sinh con: HR tạo thủ công khi có sự kiện
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.hr import BenefitPolicy, BenefitRecord, Employee, FamilyRelation, LaborContract
from app.utils import hr_roles as hrr

logger = logging.getLogger("erp.hr.benefits")
router = APIRouter(prefix="/api/hr/benefits", tags=["HR Benefits"])


# ─── Schemas ───
BenefitLoai = Literal[
    "sinh_nhat", "hieu", "hi", "sinh_con",
    "tet_am", "le_30_4", "le_2_9", "le_8_3", "le_20_10", "trung_thu",
    "khac",
]
ApDungCho = Literal["all", "female", "male"]
TrangThai = Literal["de_xuat", "da_duyet", "da_chi", "huy"]


class PolicyBase(BaseModel):
    ten: str = Field(min_length=1, max_length=150)
    loai: BenefitLoai
    muc_tien: Decimal = Field(ge=0, le=1_000_000_000)
    ap_dung_cho: ApDungCho = "all"
    mo_ta: Optional[str] = None
    is_active: bool = True


class PolicyCreate(PolicyBase):
    pass


class PolicyUpdate(BaseModel):
    ten: Optional[str] = Field(default=None, min_length=1, max_length=150)
    loai: Optional[BenefitLoai] = None
    muc_tien: Optional[Decimal] = Field(default=None, ge=0, le=1_000_000_000)
    ap_dung_cho: Optional[ApDungCho] = None
    mo_ta: Optional[str] = None
    is_active: Optional[bool] = None


class Policy(PolicyBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class RecordCreate(BaseModel):
    """Tạo bản ghi cấp phúc lợi (HR đề xuất)."""
    employee_id: int
    policy_id: Optional[int] = None
    loai: BenefitLoai
    ngay_su_kien: date
    muc_tien: Decimal = Field(ge=0, le=1_000_000_000)
    ghi_chu: Optional[str] = Field(default=None, max_length=500)
    thang_ap_dung: int = Field(ge=1, le=12)
    nam_ap_dung: int = Field(ge=2020, le=2100)


class BulkHolidayRequest(BaseModel):
    """Bulk-tạo benefit record cho 1 lễ áp dụng nhiều NV cùng lúc.

    Validate: ngay_su_kien phải khớp với thang_ap_dung/nam_ap_dung để tránh
    HR set lệch (vd: chọn ngày 25/12 nhưng kỳ lương ghi tháng 7).
    """
    policy_id: int
    ngay_su_kien: date
    thang_ap_dung: int = Field(ge=1, le=12)
    nam_ap_dung: int = Field(ge=2020, le=2100)
    ghi_chu: Optional[str] = Field(default=None, max_length=500)

    @field_validator("nam_ap_dung")
    @classmethod
    def _validate_nam(cls, v, info):
        ngay = info.data.get("ngay_su_kien")
        if ngay and abs(v - ngay.year) > 1:
            raise ValueError(
                f"nam_ap_dung ({v}) lệch quá 1 năm với ngay_su_kien ({ngay.year})"
            )
        return v


MAX_BULK_EMPLOYEES = 5000  # cap chống flood DB


# ─── POLICY endpoints (HR config) ───

@router.get("/policies", response_model=List[Policy])
def list_policies(
    is_active: Optional[bool] = None,
    loai: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """List chính sách phúc lợi. Mọi user authenticated đọc được (để mobile hiển thị)."""
    q = db.query(BenefitPolicy)
    if is_active is not None:
        q = q.filter(BenefitPolicy.is_active.is_(is_active))
    if loai:
        q = q.filter(BenefitPolicy.loai == loai)
    return q.order_by(BenefitPolicy.loai, BenefitPolicy.ten).all()


@router.post("/policies", response_model=Policy)
def create_policy(
    body: PolicyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    obj = BenefitPolicy(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    logger.info("HR benefit policy created id=%s loai=%s by user=%s", obj.id, obj.loai, current_user.id)
    return obj


@router.put("/policies/{id}", response_model=Policy)
def update_policy(
    id: int,
    body: PolicyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    obj = db.get(BenefitPolicy, id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy chính sách")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    logger.info("HR benefit policy updated id=%s by user=%s", id, current_user.id)
    return obj


@router.delete("/policies/{id}")
def delete_policy(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    obj = db.get(BenefitPolicy, id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy chính sách")
    # Soft-delete: chuyển is_active=False để giữ history (BenefitRecord vẫn ref tới)
    obj.is_active = False
    db.commit()
    logger.info("HR benefit policy soft-deleted id=%s by user=%s", id, current_user.id)
    return {"ok": True, "message": "Đã chuyển sang ngừng sử dụng (soft-delete để giữ lịch sử)"}


# ─── RECORD endpoints ───

@router.get("/records")
def list_records(
    status: Optional[str] = None,
    employee_id: Optional[int] = None,
    thang: Optional[int] = Query(None, ge=1, le=12),
    nam: Optional[int] = Query(None, ge=2020, le=2100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List bản ghi cấp phúc lợi (RBAC chặt).

    PII tài chính → giới hạn:
    - HR/Admin (NHAN_SU/ADMIN): xem toàn công ty
    - Trưởng phòng (TRUONG_PHONG/QUAN_LY/QUAN_DOC): chỉ xem NV trong CÙNG phòng ban
    - User thường: chỉ xem CỦA CHÍNH MÌNH
    """
    q = db.query(BenefitRecord)
    if hrr.is_hr_admin(current_user):
        # HR/Admin xem tất cả
        if employee_id:
            q = q.filter(BenefitRecord.employee_id == employee_id)
    elif hrr.is_dept_manager(current_user):
        # Trưởng phòng: scope theo bo_phan_id của họ
        my_emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not my_emp or not my_emp.bo_phan_id:
            return []
        # Lấy danh sách employee_id cùng bo_phan
        same_dept_ids = [
            e.id for e in db.query(Employee).filter(Employee.bo_phan_id == my_emp.bo_phan_id).all()
        ]
        q = q.filter(BenefitRecord.employee_id.in_(same_dept_ids))
        if employee_id and employee_id in same_dept_ids:
            q = q.filter(BenefitRecord.employee_id == employee_id)
    else:
        # User thường chỉ xem của mình
        my_emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not my_emp:
            return []
        q = q.filter(BenefitRecord.employee_id == my_emp.id)

    if status:
        q = q.filter(BenefitRecord.trang_thai == status)
    if thang:
        q = q.filter(BenefitRecord.thang_ap_dung == thang)
    if nam:
        q = q.filter(BenefitRecord.nam_ap_dung == nam)

    rows = q.order_by(BenefitRecord.ngay_su_kien.desc(), BenefitRecord.id.desc()).all()
    return [
        {
            "id": r.id,
            "employee_id": r.employee_id,
            "employee": {
                "ho_ten": r.employee.ho_ten if r.employee else None,
                "ma_nv": r.employee.ma_nv if r.employee else None,
            },
            "policy_id": r.policy_id,
            "policy_ten": r.policy.ten if r.policy else None,
            "loai": r.loai,
            "ngay_su_kien": r.ngay_su_kien.isoformat() if r.ngay_su_kien else None,
            "muc_tien": float(r.muc_tien) if r.muc_tien else 0,
            "ghi_chu": r.ghi_chu,
            "thang_ap_dung": r.thang_ap_dung,
            "nam_ap_dung": r.nam_ap_dung,
            "trang_thai": r.trang_thai,
            "ngay_duyet": r.ngay_duyet.isoformat() if r.ngay_duyet else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post("/records")
def create_record(
    body: RecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    """HR đề xuất 1 bản ghi phúc lợi cho NV cụ thể (vd: hiếu, hỉ, sinh con).

    Nếu có policy_id → muc_tien BỊ OVERRIDE theo policy.muc_tien (chống fraud:
    HR không thể tạo policy "Hỉ 500k" rồi gán record 50tr cho NV thân).
    Nếu không có policy_id → tự nhập (vd: hiếu/khác có thể không có policy chuẩn).
    """
    emp = db.query(Employee).filter(Employee.id == body.employee_id).first()
    if not emp:
        raise HTTPException(404, "Không tìm thấy nhân viên")

    data = body.model_dump()
    if body.policy_id:
        policy = db.get(BenefitPolicy, body.policy_id)
        if not policy:
            raise HTTPException(404, "Không tìm thấy chính sách")
        if not policy.is_active:
            raise HTTPException(400, "Chính sách đã ngừng áp dụng")
        # Override muc_tien + loai theo policy để tránh client gửi giá trị khác
        if data["muc_tien"] != policy.muc_tien:
            logger.warning("HR benefit muc_tien override: client=%s policy=%s by user=%s",
                          data["muc_tien"], policy.muc_tien, current_user.id)
            data["muc_tien"] = policy.muc_tien
        if data["loai"] != policy.loai:
            data["loai"] = policy.loai

    # Validate ngay_su_kien khớp thang_ap_dung/nam_ap_dung (chỉ warn nếu lệch nhiều)
    if abs(body.ngay_su_kien.month - body.thang_ap_dung) > 1 or body.ngay_su_kien.year != body.nam_ap_dung:
        if body.loai not in ("ung_luong",):  # ung_luong có thể cộng sang kỳ khác
            logger.warning("Benefit ngay_su_kien=%s lệch kỳ lương %s/%s by user=%s",
                          body.ngay_su_kien, body.thang_ap_dung, body.nam_ap_dung, current_user.id)

    rec = BenefitRecord(
        **data,
        trang_thai="de_xuat",
        nguoi_de_xuat_id=current_user.id,
    )
    db.add(rec)
    try:
        db.commit()
    except Exception as exc:  # IntegrityError do UNIQUE constraint
        db.rollback()
        if "ux_benefit_records_recurring" in str(exc):
            raise HTTPException(400, f"Đã có bản ghi {rec.loai} cho NV này trong tháng {rec.thang_ap_dung}/{rec.nam_ap_dung}") from None
        raise HTTPException(500, "Lỗi tạo bản ghi") from exc
    db.refresh(rec)
    logger.info("HR benefit record created id=%s emp=%s loai=%s muc=%s by user=%s",
                rec.id, rec.employee_id, rec.loai, rec.muc_tien, current_user.id)
    return {"ok": True, "id": rec.id}


@router.post("/records/bulk-holiday")
def bulk_create_holiday(
    body: BulkHolidayRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    """Bulk-tạo bản ghi cho 1 dịp lễ áp dụng cho tất cả NV active theo ap_dung_cho của policy.

    Tự skip NV đã có record cùng (loai, thang_ap_dung, nam_ap_dung).
    """
    policy = db.get(BenefitPolicy, body.policy_id)
    if not policy:
        raise HTTPException(404, "Không tìm thấy chính sách")
    if not policy.is_active:
        raise HTTPException(400, "Chính sách đã ngừng áp dụng")

    # Lấy NV active theo ap_dung_cho
    q = db.query(Employee).filter(Employee.trang_thai == "dang_lam")
    if policy.ap_dung_cho == "female":
        q = q.filter(Employee.gioi_tinh == "Nữ")
    elif policy.ap_dung_cho == "male":
        q = q.filter(Employee.gioi_tinh == "Nam")
    employees = q.all()

    # Cap chống flood DB
    if len(employees) > MAX_BULK_EMPLOYEES:
        raise HTTPException(
            400,
            f"Quá nhiều NV ({len(employees)}). Cap tối đa {MAX_BULK_EMPLOYEES}/lần. "
            "Liên hệ admin để xử lý lô lớn."
        )

    # Lấy danh sách đã có record để skip
    existing = {
        r.employee_id for r in db.query(BenefitRecord).filter(
            BenefitRecord.loai == policy.loai,
            BenefitRecord.thang_ap_dung == body.thang_ap_dung,
            BenefitRecord.nam_ap_dung == body.nam_ap_dung,
        ).all()
    }

    # Batch commit mỗi 500 record để tránh giữ transaction quá lâu
    BATCH_SIZE = 500
    created = 0
    batch_count = 0
    for emp in employees:
        if emp.id in existing:
            continue
        db.add(BenefitRecord(
            employee_id=emp.id,
            policy_id=policy.id,
            loai=policy.loai,
            ngay_su_kien=body.ngay_su_kien,
            muc_tien=policy.muc_tien,
            ghi_chu=body.ghi_chu,
            thang_ap_dung=body.thang_ap_dung,
            nam_ap_dung=body.nam_ap_dung,
            trang_thai="de_xuat",
            nguoi_de_xuat_id=current_user.id,
        ))
        created += 1
        batch_count += 1
        if batch_count >= BATCH_SIZE:
            db.commit()
            batch_count = 0
    if batch_count > 0:
        db.commit()
    logger.info("HR benefit bulk-holiday: policy=%s created=%s by user=%s",
                policy.loai, created, current_user.id)
    return {
        "ok": True, "created": created,
        "total_employees": len(employees),
        "skipped_existing": len(employees) - created,
    }


@router.post("/records/{id}/approve")
def approve_record(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU", "GIAM_DOC")),
):
    rec = db.query(BenefitRecord).filter(BenefitRecord.id == id).with_for_update().first()
    if not rec:
        raise HTTPException(404, "Không tìm thấy bản ghi")
    if rec.trang_thai != "de_xuat":
        raise HTTPException(400, f"Chỉ duyệt được bản ghi ở trạng thái de_xuat (hiện: {rec.trang_thai})")
    # 4-eyes principle: HR không tự duyệt đơn do CHÍNH MÌNH đề xuất (trừ ADMIN)
    if rec.nguoi_de_xuat_id == current_user.id and not hrr.role_code(current_user) == "ADMIN":
        raise HTTPException(
            403,
            "Bạn không thể duyệt đơn do chính mình đề xuất (4-eyes principle). "
            "Cần người khác duyệt — nếu không có ai, liên hệ Admin."
        )
    rec.trang_thai = "da_duyet"
    rec.nguoi_duyet_id = current_user.id
    rec.ngay_duyet = datetime.now(timezone.utc)
    db.commit()
    logger.info("HR benefit record %s approved by user=%s", id, current_user.id)
    return {"ok": True}


class MarkPaidRequest(BaseModel):
    ghi_chu: Optional[str] = Field(default=None, max_length=500)


@router.post("/records/{id}/mark-paid")
def mark_paid(
    id: int,
    body: Optional[MarkPaidRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU", "KE_TOAN")),
):
    """Kế toán đánh dấu đã chi (sau khi cộng vào lương hoặc chi trực tiếp).

    Persist audit: nguoi_chi_id + ngay_chi để trace ai chi khi nào.
    """
    rec = db.query(BenefitRecord).filter(BenefitRecord.id == id).with_for_update().first()
    if not rec:
        raise HTTPException(404, "Không tìm thấy bản ghi")
    if rec.trang_thai != "da_duyet":
        raise HTTPException(400, "Chỉ đánh dấu đã chi cho bản ghi đã được duyệt")
    rec.trang_thai = "da_chi"
    rec.nguoi_chi_id = current_user.id
    rec.ngay_chi = datetime.now(timezone.utc)
    if body and body.ghi_chu:
        rec.ghi_chu = (rec.ghi_chu or "") + f" | Đã chi: {body.ghi_chu}"
    db.commit()
    logger.info("HR benefit record %s marked PAID by user=%s", id, current_user.id)
    return {"ok": True}


class CancelRequest(BaseModel):
    ly_do: str = Field(min_length=1, max_length=500, description="Lý do hủy (bắt buộc)")


@router.post("/records/{id}/cancel")
def cancel_record(
    id: int,
    body: CancelRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    """Hủy bản ghi — phải có lý do, persist audit nguoi_huy_id + ngay_huy + ly_do_huy."""
    rec = db.query(BenefitRecord).filter(BenefitRecord.id == id).with_for_update().first()
    if not rec:
        raise HTTPException(404, "Không tìm thấy bản ghi")
    if rec.trang_thai == "da_chi":
        raise HTTPException(400, "Không hủy được bản ghi đã chi")
    rec.trang_thai = "huy"
    rec.nguoi_huy_id = current_user.id
    rec.ngay_huy = datetime.now(timezone.utc)
    rec.ly_do_huy = body.ly_do
    db.commit()
    logger.info("HR benefit record %s cancelled by user=%s ly_do=%s", id, current_user.id, body.ly_do)
    return {"ok": True}


# ─── BIRTHDAY scan endpoint (HR trigger thủ công + cron job gọi) ───

@router.post("/scan-birthday")
def scan_birthday_today(
    target_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    """Quét NV sinh nhật hôm nay (hoặc target_date) → sinh BenefitRecord nếu chưa có.

    Dùng policy active loại sinh_nhat đầu tiên. Skip nếu NV đã có record cùng tháng/năm.
    """
    today = target_date or date.today()
    policy = db.query(BenefitPolicy).filter(
        BenefitPolicy.loai == "sinh_nhat",
        BenefitPolicy.is_active.is_(True),
    ).first()
    if not policy:
        return {"ok": False, "message": "Chưa có chính sách sinh nhật active"}

    from sqlalchemy import extract
    employees = db.query(Employee).filter(
        Employee.trang_thai == "dang_lam",
        Employee.ngay_sinh.isnot(None),
        extract("month", Employee.ngay_sinh) == today.month,
        extract("day", Employee.ngay_sinh) == today.day,
    ).all()

    existing = {
        r.employee_id for r in db.query(BenefitRecord).filter(
            BenefitRecord.loai == "sinh_nhat",
            BenefitRecord.thang_ap_dung == today.month,
            BenefitRecord.nam_ap_dung == today.year,
        ).all()
    }

    created = 0
    for emp in employees:
        if emp.id in existing:
            continue
        if policy.ap_dung_cho == "female" and (emp.gioi_tinh or "").lower() != "nữ":
            continue
        if policy.ap_dung_cho == "male" and (emp.gioi_tinh or "").lower() != "nam":
            continue
        rec = BenefitRecord(
            employee_id=emp.id,
            policy_id=policy.id,
            loai="sinh_nhat",
            ngay_su_kien=today,
            muc_tien=policy.muc_tien,
            ghi_chu=f"Sinh nhật {emp.ho_ten}",
            thang_ap_dung=today.month,
            nam_ap_dung=today.year,
            trang_thai="de_xuat",
            nguoi_de_xuat_id=current_user.id,
        )
        db.add(rec)
        created += 1
    db.commit()
    logger.info("HR birthday scan: date=%s found=%s created=%s by user=%s",
                today, len(employees), created, current_user.id)
    return {
        "ok": True, "date": today.isoformat(),
        "found": len(employees), "created": created,
        "skipped_existing": len(employees) - created,
    }


# ─── Upcoming birthdays (HR dashboard) ───
@router.get("/upcoming-birthdays")
def upcoming_birthdays(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    """List NV sắp sinh nhật trong N ngày tới."""
    today = date.today()
    employees = db.query(Employee).filter(
        Employee.trang_thai == "dang_lam",
        Employee.ngay_sinh.isnot(None),
    ).all()

    upcoming = []
    for emp in employees:
        if not emp.ngay_sinh:
            continue
        # Tính sinh nhật năm nay
        try:
            this_year_bday = date(today.year, emp.ngay_sinh.month, emp.ngay_sinh.day)
        except ValueError:
            # 29/2 — skip if năm không nhuận
            continue
        if this_year_bday < today:
            try:
                this_year_bday = date(today.year + 1, emp.ngay_sinh.month, emp.ngay_sinh.day)
            except ValueError:
                continue
        delta = (this_year_bday - today).days
        if delta <= days:
            upcoming.append({
                "employee_id": emp.id,
                "ma_nv": emp.ma_nv,
                "ho_ten": emp.ho_ten,
                "ngay_sinh": emp.ngay_sinh.isoformat(),
                "sinh_nhat_nam_nay": this_year_bday.isoformat(),
                "con_lai_ngay": delta,
                "tuoi_sap_buoc_sang": this_year_bday.year - emp.ngay_sinh.year,
            })
    upcoming.sort(key=lambda x: x["con_lai_ngay"])
    return upcoming


# ─── Family Events: tích hợp Phúc lợi ↔ Hồ sơ NV ───

def _compute_family_events(
    days: int,
    db: Session,
    con_tuoi_min: int = 0,
    con_tuoi_max: int = 16,
) -> list[dict]:
    """Pure function — tổng hợp sự kiện gia đình sắp tới.

    Tham số tuổi con:
    - con_tuoi_min/max: dải tuổi của con NV được liệt kê trong nhóm 'co_con_nho'.
      VD: tặng quà thiếu nhi 1/6 → (5, 10). Trung thu cho trẻ → (0, 14). Mặc định 0-16.
    """
    today = date.today()
    events: list[dict] = []

    # 1. Sinh nhật NV
    employees = db.query(Employee).filter(
        Employee.trang_thai == "dang_lam",
        Employee.ngay_sinh.isnot(None),
    ).all()
    for emp in employees:
        if not emp.ngay_sinh:
            continue
        try:
            ev = date(today.year, emp.ngay_sinh.month, emp.ngay_sinh.day)
        except ValueError:
            continue
        if ev < today:
            try:
                ev = date(today.year + 1, emp.ngay_sinh.month, emp.ngay_sinh.day)
            except ValueError:
                continue
        delta = (ev - today).days
        if delta <= days:
            events.append({
                "employee_id": emp.id,
                "ma_nv": emp.ma_nv,
                "ho_ten": emp.ho_ten,
                "loai": "sinh_nhat_nv",
                "icon": "🎂",
                "ten_su_kien": f"Sinh nhật {emp.ho_ten}",
                "ngay_sap_toi": ev.isoformat(),
                "con_lai_ngay": delta,
                "mo_ta_them": f"Tròn {ev.year - emp.ngay_sinh.year} tuổi",
            })

    # 2. Sinh nhật con NV
    family_rels = db.query(FamilyRelation, Employee).join(
        Employee, Employee.id == FamilyRelation.employee_id,
    ).filter(
        Employee.trang_thai == "dang_lam",
        FamilyRelation.moi_quan_he.in_(["Con trai", "Con gái", "Con"]),
        FamilyRelation.nam_sinh.isnot(None),
    ).all()
    for rel, emp in family_rels:
        if not rel.nam_sinh:
            continue
        # FamilyRelation chỉ lưu năm sinh, không có tháng/ngày → skip nếu không suy được
        # (ngày sinh đầy đủ chưa có schema, tạm coi 1/1 của năm đó là "sinh nhật")
        # → Thực tế nên thêm cột ngay_sinh full vào FamilyRelation, nhưng để tạm dùng năm
        try:
            # Tạm coi mốc giữa năm (1/7) cho con nếu chỉ có năm sinh
            ev = date(today.year, 7, 1) if False else None
            # Bỏ qua nếu không có ngày sinh chính xác — chỉ tính tuổi để Trung thu/quà
        except ValueError:
            continue
        # Chỉ tính nếu có ngày sinh đầy đủ (cần upgrade schema FamilyRelation)
        # → Tạm thời: liệt kê con để HR biết NV có bao nhiêu con
        tuoi = today.year - rel.nam_sinh
        if con_tuoi_min <= tuoi <= con_tuoi_max:
            events.append({
                "employee_id": emp.id,
                "ma_nv": emp.ma_nv,
                "ho_ten": emp.ho_ten,
                "loai": "co_con_nho",
                "icon": "👶",
                "ten_su_kien": f"{rel.ho_ten} ({rel.moi_quan_he})",
                "ngay_sap_toi": None,
                "con_lai_ngay": None,
                "mo_ta_them": f"{tuoi} tuổi · {emp.ho_ten}",
            })

    # 3. Thâm niên 5/10/15/20 năm
    MOC_THAM_NIEN = [3, 5, 10, 15, 20, 25, 30]
    for emp in db.query(Employee).filter(
        Employee.trang_thai == "dang_lam",
        Employee.ngay_vao_lam.isnot(None),
    ).all():
        if not emp.ngay_vao_lam:
            continue
        # Tính các mốc thâm niên sắp tới
        for moc in MOC_THAM_NIEN:
            try:
                anniv = date(
                    emp.ngay_vao_lam.year + moc,
                    emp.ngay_vao_lam.month,
                    emp.ngay_vao_lam.day,
                )
            except ValueError:
                continue
            delta = (anniv - today).days
            if 0 <= delta <= days:
                events.append({
                    "employee_id": emp.id,
                    "ma_nv": emp.ma_nv,
                    "ho_ten": emp.ho_ten,
                    "loai": "tham_nien",
                    "icon": "🏆",
                    "ten_su_kien": f"Thâm niên {moc} năm",
                    "ngay_sap_toi": anniv.isoformat(),
                    "con_lai_ngay": delta,
                    "mo_ta_them": f"Vào làm {emp.ngay_vao_lam.isoformat()}",
                })
                break  # chỉ lấy mốc gần nhất

    # 4. HĐLĐ sắp hết hạn
    contracts = db.query(LaborContract, Employee).join(
        Employee, Employee.id == LaborContract.employee_id,
    ).filter(
        LaborContract.trang_thai == "hieu_luc",
        LaborContract.ngay_het_han.isnot(None),
        LaborContract.ngay_het_han >= today,
    ).all()
    for ct, emp in contracts:
        if not ct.ngay_het_han:
            continue
        delta = (ct.ngay_het_han - today).days
        if delta <= days:
            events.append({
                "employee_id": emp.id,
                "ma_nv": emp.ma_nv,
                "ho_ten": emp.ho_ten,
                "loai": "hd_het_han",
                "icon": "📅",
                "ten_su_kien": f"HĐLĐ hết hạn ({ct.so_hop_dong})",
                "ngay_sap_toi": ct.ngay_het_han.isoformat(),
                "con_lai_ngay": delta,
                "mo_ta_them": f"Loại: {ct.loai_hop_dong}",
            })

    # Sort theo độ gần (None → cuối)
    events.sort(key=lambda x: (
        x["con_lai_ngay"] is None,  # None xuống cuối
        x["con_lai_ngay"] if x["con_lai_ngay"] is not None else 9999,
    ))
    return events


@router.get("/family-events")
def upcoming_family_events(
    days: int = Query(60, ge=1, le=365),
    loai: Optional[str] = Query(None, description="Filter: sinh_nhat_nv | co_con_nho | tham_nien | hd_het_han"),
    con_tuoi_min: int = Query(0, ge=0, le=30, description="Tuổi con tối thiểu (lọc nhóm co_con_nho)"),
    con_tuoi_max: int = Query(16, ge=0, le=30, description="Tuổi con tối đa (vd: 5-10 cho 1/6 Thiếu nhi)"),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    """Tổng hợp sự kiện gia đình sắp tới của tất cả NV active.

    4 loại:
      - sinh_nhat_nv : sinh nhật chính nhân viên
      - co_con_nho   : NV có con trong dải tuổi (con_tuoi_min..max). Default 0-16.
      - tham_nien    : sắp đến mốc thâm niên 3/5/10/15/20 năm
      - hd_het_han   : HĐLĐ sắp hết hạn

    Ví dụ:
      - Tặng quà 1/6: ?loai=co_con_nho&con_tuoi_min=5&con_tuoi_max=10
      - Trung thu cho trẻ: ?loai=co_con_nho&con_tuoi_min=0&con_tuoi_max=14
    """
    if con_tuoi_min > con_tuoi_max:
        raise HTTPException(400, "con_tuoi_min phải ≤ con_tuoi_max")
    events = _compute_family_events(days, db, con_tuoi_min=con_tuoi_min, con_tuoi_max=con_tuoi_max)
    if loai:
        events = [e for e in events if e["loai"] == loai]
    return events


@router.get("/family-events/summary")
def family_events_summary(
    days: int = Query(60, ge=1, le=365),
    con_tuoi_min: int = Query(0, ge=0, le=30),
    con_tuoi_max: int = Query(16, ge=0, le=30),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    """KPI nhanh cho dashboard: số lượng từng loại sự kiện.
    Tuổi con áp dụng vào nhóm co_con_nho."""
    if con_tuoi_min > con_tuoi_max:
        raise HTTPException(400, "con_tuoi_min phải ≤ con_tuoi_max")
    events = _compute_family_events(days, db, con_tuoi_min=con_tuoi_min, con_tuoi_max=con_tuoi_max)
    summary = {"sinh_nhat_nv": 0, "co_con_nho": 0, "tham_nien": 0, "hd_het_han": 0, "total": 0}
    for e in events:
        summary[e["loai"]] = summary.get(e["loai"], 0) + 1
        summary["total"] += 1
    return summary


# ─── HR Dashboard: tổng quan chi phí phúc lợi ───

@router.get("/dashboard")
def benefit_dashboard(
    thang: int = Query(..., ge=1, le=12, description="Tháng đang xem"),
    nam: int = Query(..., ge=2020, le=2100, description="Năm đang xem"),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "NHAN_SU", "GIAM_DOC")),
):
    """Dashboard tổng hợp cho HR/BGĐ.

    Trả về:
      - KPI: chi_thang, chi_nam, chi_cung_ky_nam_truoc, so_nv_nhan_thang, so_record_thang
      - by_loai: tổng tiền và số lượt theo loại phúc lợi
      - by_phong_ban: top phòng ban tốn kém
      - calendar: list sự kiện trong tháng (BenefitRecord đã duyệt + sinh nhật + lễ)
    """
    from sqlalchemy import func as sa_func

    # 1. KPI tổng
    def sum_in_period(thang_q: int, nam_q: int) -> float:
        v = db.query(sa_func.coalesce(sa_func.sum(BenefitRecord.muc_tien), 0)).filter(
            BenefitRecord.thang_ap_dung == thang_q,
            BenefitRecord.nam_ap_dung == nam_q,
            BenefitRecord.trang_thai.in_(["da_duyet", "da_chi"]),
        ).scalar()
        return float(v or 0)

    chi_thang = sum_in_period(thang, nam)
    chi_cung_ky = sum_in_period(thang, nam - 1)
    chi_nam = float(db.query(sa_func.coalesce(sa_func.sum(BenefitRecord.muc_tien), 0)).filter(
        BenefitRecord.nam_ap_dung == nam,
        BenefitRecord.trang_thai.in_(["da_duyet", "da_chi"]),
    ).scalar() or 0)

    so_nv_nhan = db.query(sa_func.count(sa_func.distinct(BenefitRecord.employee_id))).filter(
        BenefitRecord.thang_ap_dung == thang,
        BenefitRecord.nam_ap_dung == nam,
        BenefitRecord.trang_thai.in_(["da_duyet", "da_chi"]),
    ).scalar() or 0
    so_record_thang = db.query(sa_func.count(BenefitRecord.id)).filter(
        BenefitRecord.thang_ap_dung == thang,
        BenefitRecord.nam_ap_dung == nam,
    ).scalar() or 0

    # % thay đổi so cùng kỳ
    pct_change = None
    if chi_cung_ky > 0:
        pct_change = round((chi_thang - chi_cung_ky) / chi_cung_ky * 100, 1)

    # 2. By loại phúc lợi (tháng này)
    by_loai_rows = db.query(
        BenefitRecord.loai,
        sa_func.sum(BenefitRecord.muc_tien).label("tong_tien"),
        sa_func.count(BenefitRecord.id).label("so_luot"),
    ).filter(
        BenefitRecord.thang_ap_dung == thang,
        BenefitRecord.nam_ap_dung == nam,
        BenefitRecord.trang_thai.in_(["da_duyet", "da_chi"]),
    ).group_by(BenefitRecord.loai).all()
    by_loai = [
        {"loai": r.loai, "tong_tien": float(r.tong_tien or 0), "so_luot": r.so_luot}
        for r in by_loai_rows
    ]

    # 3. By phòng ban (tháng này) — group by ID để tránh gộp nhầm 2 phòng cùng tên
    from app.models.hr import Department
    by_dept_rows = db.query(
        Department.id,
        Department.ten_bo_phan,
        sa_func.sum(BenefitRecord.muc_tien).label("tong_tien"),
        sa_func.count(BenefitRecord.id).label("so_luot"),
    ).join(Employee, Employee.id == BenefitRecord.employee_id).outerjoin(
        Department, Department.id == Employee.bo_phan_id,
    ).filter(
        BenefitRecord.thang_ap_dung == thang,
        BenefitRecord.nam_ap_dung == nam,
        BenefitRecord.trang_thai.in_(["da_duyet", "da_chi"]),
    ).group_by(Department.id, Department.ten_bo_phan).order_by(sa_func.sum(BenefitRecord.muc_tien).desc()).limit(10).all()
    by_dept = [
        {
            "ten_bo_phan": r.ten_bo_phan or "(Chưa phân phòng)",
            "tong_tien": float(r.tong_tien or 0),
            "so_luot": r.so_luot,
        }
        for r in by_dept_rows
    ]

    # 4. Trend 12 tháng (cho line chart)
    trend_rows = db.query(
        BenefitRecord.thang_ap_dung,
        sa_func.sum(BenefitRecord.muc_tien).label("tong_tien"),
    ).filter(
        BenefitRecord.nam_ap_dung == nam,
        BenefitRecord.trang_thai.in_(["da_duyet", "da_chi"]),
    ).group_by(BenefitRecord.thang_ap_dung).order_by(BenefitRecord.thang_ap_dung).all()
    trend_map = {r.thang_ap_dung: float(r.tong_tien or 0) for r in trend_rows}
    trend_12_thang = [
        {"thang": m, "tong_tien": trend_map.get(m, 0)} for m in range(1, 13)
    ]

    # 5. Calendar events trong tháng (gom các sự kiện theo ngày)
    from calendar import monthrange
    last_day = monthrange(nam, thang)[1]
    calendar_events: dict[str, list[dict]] = {}

    # BenefitRecord có ngay_su_kien trong tháng
    records_in_month = db.query(BenefitRecord, Employee).join(
        Employee, Employee.id == BenefitRecord.employee_id,
    ).filter(
        BenefitRecord.ngay_su_kien >= date(nam, thang, 1),
        BenefitRecord.ngay_su_kien <= date(nam, thang, last_day),
    ).all()
    for rec, emp in records_in_month:
        key = rec.ngay_su_kien.isoformat()
        calendar_events.setdefault(key, []).append({
            "loai": rec.loai,
            "ho_ten": emp.ho_ten,
            "muc_tien": float(rec.muc_tien) if rec.muc_tien else 0,
            "trang_thai": rec.trang_thai,
        })

    return {
        "thang": thang, "nam": nam,
        "kpi": {
            "chi_thang": chi_thang,
            "chi_nam": chi_nam,
            "chi_cung_ky_nam_truoc": chi_cung_ky,
            "pct_change_yoy": pct_change,
            "so_nv_nhan_thang": so_nv_nhan,
            "so_record_thang": so_record_thang,
        },
        "by_loai": sorted(by_loai, key=lambda x: x["tong_tien"], reverse=True),
        "by_phong_ban": by_dept,
        "trend_12_thang": trend_12_thang,
        "calendar_events": calendar_events,
    }
