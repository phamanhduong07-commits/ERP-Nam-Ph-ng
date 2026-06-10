"""Router: An toàn lao động & BHLĐ (Phase 1.3).

Theo Luật ATVSLĐ 2015, NĐ 44/2016/NĐ-CP, TT 28/2021/TT-BLĐTBXH.

3 mảng chính:
1. BHLĐ — danh mục thiết bị + cấp phát + cảnh báo hết hạn
2. Huấn luyện ATVSLĐ — buổi học + danh sách NV tham gia + chứng chỉ
3. TNLĐ — báo cáo tai nạn lao động + flag báo cáo Sở LĐ
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.hr import (
    Employee, SafetyEquipment, SafetyEquipmentIssue,
    SafetyTraining, SafetyTrainingParticipant, WorkAccident,
)

logger = logging.getLogger("erp")
router = APIRouter(prefix="/api/hr/safety", tags=["hr-safety"])


def _safe_url(v: Optional[str]) -> Optional[str]:
    """Allowlist: chỉ chấp nhận http(s):// hoặc đường dẫn tương đối / để chống XSS."""
    if not v:
        return v
    s = v.strip()
    lower = s.lower()
    # Allow: relative path bắt đầu bằng / hoặc ./ hoặc http(s)://
    if s.startswith("/") or s.startswith("./") or s.startswith("../"):
        return s
    if lower.startswith("http://") or lower.startswith("https://"):
        return s
    raise ValueError(
        "URL chỉ chấp nhận http(s):// hoặc đường dẫn tương đối (/, ./, ../). "
        "Các scheme javascript:/data:/blob:/vbscript:/file:/ftp: bị từ chối."
    )


# ═══════════════════════════════════════════════════════════════
# 1) BHLĐ — Danh mục thiết bị
# ═══════════════════════════════════════════════════════════════
class EquipmentBase(BaseModel):
    ma: str = Field(min_length=1, max_length=50)
    ten: str = Field(min_length=1, max_length=150)
    loai: Optional[str] = Field(default=None, max_length=50)
    don_vi: str = Field(default="cái", max_length=20)
    han_su_dung_thang: Optional[int] = Field(default=None, ge=0)
    don_gia: Decimal = Field(default=Decimal(0), ge=0)
    mo_ta: Optional[str] = None
    trang_thai: bool = True

class EquipmentCreate(EquipmentBase):
    pass

class EquipmentUpdate(BaseModel):
    ten: Optional[str] = Field(default=None, min_length=1, max_length=150)
    loai: Optional[str] = Field(default=None, max_length=50)
    don_vi: Optional[str] = Field(default=None, max_length=20)
    han_su_dung_thang: Optional[int] = Field(default=None, ge=0)
    don_gia: Optional[Decimal] = Field(default=None, ge=0)
    mo_ta: Optional[str] = None
    trang_thai: Optional[bool] = None


@router.get("/equipments")
def list_equipments(
    active_only: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(SafetyEquipment)
    if active_only:
        q = q.filter(SafetyEquipment.trang_thai == True)
    items = q.order_by(SafetyEquipment.ten).all()
    return [
        {
            "id": e.id, "ma": e.ma, "ten": e.ten, "loai": e.loai,
            "don_vi": e.don_vi, "han_su_dung_thang": e.han_su_dung_thang,
            "don_gia": float(e.don_gia or 0), "mo_ta": e.mo_ta,
            "trang_thai": e.trang_thai,
        } for e in items
    ]


@router.post("/equipments")
def create_equipment(
    body: EquipmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    if db.query(SafetyEquipment).filter(SafetyEquipment.ma == body.ma).first():
        raise HTTPException(400, f"Mã '{body.ma}' đã tồn tại")
    e = SafetyEquipment(**body.model_dump())
    db.add(e)
    db.commit()
    db.refresh(e)
    logger.info("HR safety_equipment created id=%s by user=%s", e.id, current_user.id)
    return {"id": e.id, "ma": e.ma, "ten": e.ten}


@router.put("/equipments/{id}")
def update_equipment(
    id: int, body: EquipmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    e = db.get(SafetyEquipment, id)
    if not e:
        raise HTTPException(404, "Không tìm thấy")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(e, k, v)
    db.commit()
    logger.info("HR safety_equipment updated id=%s by user=%s", id, current_user.id)
    return {"ok": True}


@router.delete("/equipments/{id}")
def delete_equipment(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    e = db.get(SafetyEquipment, id)
    if not e:
        raise HTTPException(404, "Không tìm thấy")
    # Integrity: không xóa nếu đã có lần cấp phát
    has_issues = db.query(SafetyEquipmentIssue).filter(SafetyEquipmentIssue.equipment_id == id).first()
    if has_issues:
        # Soft delete
        e.trang_thai = False
        db.commit()
        return {"ok": True, "soft_deleted": True}
    db.delete(e)
    db.commit()
    logger.info("HR safety_equipment deleted id=%s by user=%s", id, current_user.id)
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════
# 2) BHLĐ — Cấp phát cho NV
# ═══════════════════════════════════════════════════════════════
class IssueBase(BaseModel):
    employee_id: int
    equipment_id: int
    ngay_cap: date
    so_luong: int = Field(default=1, ge=1)
    han_su_dung_den: Optional[date] = None
    ly_do: Optional[str] = Field(default="cap_moi", max_length=50)  # cap_moi | thay_the | hong | mat
    ghi_chu: Optional[str] = None

class IssueCreate(IssueBase):
    pass


@router.get("/issues")
def list_issues(
    employee_id: Optional[int] = None,
    equipment_id: Optional[int] = None,
    expiring_days: Optional[int] = None,
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List lần cấp phát BHLĐ. NV thường chỉ thấy của mình."""
    from app.routers.hr import _role_code  # reuse helper
    is_hr_admin = _role_code(current_user) in ("ADMIN", "NHAN_SU", "GIAM_DOC", "BGD")
    if not is_hr_admin:
        my_emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not my_emp:
            return []
        employee_id = my_emp.id

    q = db.query(SafetyEquipmentIssue)
    if employee_id:
        q = q.filter(SafetyEquipmentIssue.employee_id == employee_id)
    if equipment_id:
        q = q.filter(SafetyEquipmentIssue.equipment_id == equipment_id)
    if expiring_days is not None:
        limit_date = date.today() + timedelta(days=expiring_days)
        q = q.filter(
            SafetyEquipmentIssue.han_su_dung_den.isnot(None),
            SafetyEquipmentIssue.han_su_dung_den <= limit_date,
        )
    items = q.order_by(SafetyEquipmentIssue.ngay_cap.desc()).limit(limit).all()
    return [
        {
            "id": i.id, "employee_id": i.employee_id,
            "ho_ten": i.employee.ho_ten if i.employee else None,
            "ma_nv": i.employee.ma_nv if i.employee else None,
            "equipment_id": i.equipment_id,
            "ten_equipment": i.equipment.ten if i.equipment else None,
            "ngay_cap": i.ngay_cap.isoformat() if i.ngay_cap else None,
            "so_luong": i.so_luong,
            "han_su_dung_den": i.han_su_dung_den.isoformat() if i.han_su_dung_den else None,
            "ly_do": i.ly_do,
            "ghi_chu": i.ghi_chu,
        } for i in items
    ]


@router.post("/issues")
def create_issue(
    body: IssueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    if not db.get(Employee, body.employee_id):
        raise HTTPException(400, "employee_id không tồn tại")
    eq = db.get(SafetyEquipment, body.equipment_id)
    if not eq:
        raise HTTPException(400, "equipment_id không tồn tại")

    data = body.model_dump()
    # Auto-tính hạn sử dụng nếu thiết bị có định mức
    if not data.get("han_su_dung_den") and eq.han_su_dung_thang:
        from dateutil.relativedelta import relativedelta
        data["han_su_dung_den"] = data["ngay_cap"] + relativedelta(months=eq.han_su_dung_thang)

    issue = SafetyEquipmentIssue(**data, nguoi_cap_id=current_user.id)
    db.add(issue)
    db.commit()
    db.refresh(issue)
    logger.info("HR safety_issue created id=%s emp=%s eq=%s by user=%s",
                issue.id, body.employee_id, body.equipment_id, current_user.id)
    return {"id": issue.id, "ngay_cap": issue.ngay_cap.isoformat()}


@router.delete("/issues/{id}")
def delete_issue(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    i = db.get(SafetyEquipmentIssue, id)
    if not i:
        raise HTTPException(404, "Không tìm thấy")
    db.delete(i)
    db.commit()
    logger.info("HR safety_issue deleted id=%s by user=%s", id, current_user.id)
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════
# 3) Huấn luyện ATVSLĐ
# ═══════════════════════════════════════════════════════════════
class TrainingBase(BaseModel):
    ten_khoa_hoc: str = Field(min_length=1, max_length=255)
    nhom_doi_tuong: str = Field(max_length=20)  # nhom_1..nhom_4
    ngay_bat_dau: date
    ngay_ket_thuc: Optional[date] = None
    don_vi_dao_tao: Optional[str] = Field(default=None, max_length=255)
    giang_vien: Optional[str] = Field(default=None, max_length=150)
    so_gio: Optional[int] = Field(default=None, ge=0)
    chu_de: Optional[str] = None
    chi_phi: Decimal = Field(default=Decimal(0), ge=0)
    trang_thai: str = Field(default="sap_dien_ra", max_length=20)
    file_url: Optional[str] = Field(default=None, max_length=500)
    ghi_chu: Optional[str] = None

    @field_validator("file_url")
    @classmethod
    def _vt_file_url(cls, v):
        return _safe_url(v)

    @field_validator("nhom_doi_tuong")
    @classmethod
    def _vt_nhom(cls, v):
        if v not in ("nhom_1", "nhom_2", "nhom_3", "nhom_4"):
            raise ValueError("nhom_doi_tuong phải là nhom_1..nhom_4")
        return v

class TrainingCreate(TrainingBase):
    pass

class TrainingUpdate(BaseModel):
    ten_khoa_hoc: Optional[str] = Field(default=None, min_length=1, max_length=255)
    nhom_doi_tuong: Optional[str] = Field(default=None, max_length=20)
    ngay_bat_dau: Optional[date] = None
    ngay_ket_thuc: Optional[date] = None
    don_vi_dao_tao: Optional[str] = Field(default=None, max_length=255)
    giang_vien: Optional[str] = Field(default=None, max_length=150)
    so_gio: Optional[int] = Field(default=None, ge=0)
    chu_de: Optional[str] = None
    chi_phi: Optional[Decimal] = Field(default=None, ge=0)
    trang_thai: Optional[str] = Field(default=None, max_length=20)
    file_url: Optional[str] = Field(default=None, max_length=500)
    ghi_chu: Optional[str] = None

    @field_validator("file_url")
    @classmethod
    def _vt_file_url(cls, v):
        return _safe_url(v)


@router.get("/trainings")
def list_trainings(
    nhom: Optional[str] = None,
    trang_thai: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(SafetyTraining)
    if nhom:
        q = q.filter(SafetyTraining.nhom_doi_tuong == nhom)
    if trang_thai:
        q = q.filter(SafetyTraining.trang_thai == trang_thai)
    items = q.order_by(SafetyTraining.ngay_bat_dau.desc()).all()
    # Count participants for each
    counts = dict(
        db.query(SafetyTrainingParticipant.training_id, func.count(SafetyTrainingParticipant.id))
        .group_by(SafetyTrainingParticipant.training_id).all()
    )
    return [
        {
            "id": t.id, "ten_khoa_hoc": t.ten_khoa_hoc, "nhom_doi_tuong": t.nhom_doi_tuong,
            "ngay_bat_dau": t.ngay_bat_dau.isoformat() if t.ngay_bat_dau else None,
            "ngay_ket_thuc": t.ngay_ket_thuc.isoformat() if t.ngay_ket_thuc else None,
            "don_vi_dao_tao": t.don_vi_dao_tao, "giang_vien": t.giang_vien,
            "so_gio": t.so_gio, "chu_de": t.chu_de,
            "chi_phi": float(t.chi_phi or 0), "trang_thai": t.trang_thai,
            "file_url": t.file_url, "ghi_chu": t.ghi_chu,
            "so_tham_gia": counts.get(t.id, 0),
        } for t in items
    ]


@router.post("/trainings")
def create_training(
    body: TrainingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    t = SafetyTraining(**body.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    logger.info("HR safety_training created id=%s by user=%s", t.id, current_user.id)
    return {"id": t.id, "ten_khoa_hoc": t.ten_khoa_hoc}


@router.put("/trainings/{id}")
def update_training(
    id: int, body: TrainingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    t = db.get(SafetyTraining, id)
    if not t:
        raise HTTPException(404, "Không tìm thấy")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(t, k, v)
    db.commit()
    return {"ok": True}


@router.delete("/trainings/{id}")
def delete_training(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    t = db.get(SafetyTraining, id)
    if not t:
        raise HTTPException(404, "Không tìm thấy")
    db.delete(t)  # cascade xóa participants
    db.commit()
    return {"ok": True}


# Participants của 1 buổi huấn luyện
class ParticipantBase(BaseModel):
    employee_id: int
    da_hoan_thanh: bool = False
    diem: Optional[int] = Field(default=None, ge=0, le=100)
    so_chung_chi: Optional[str] = Field(default=None, max_length=100)
    ngay_cap_chung_chi: Optional[date] = None
    han_chung_chi: Optional[date] = None
    ghi_chu: Optional[str] = None


@router.get("/trainings/{training_id}/participants")
def list_participants(
    training_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    items = db.query(SafetyTrainingParticipant).filter(
        SafetyTrainingParticipant.training_id == training_id,
    ).all()
    return [
        {
            "id": p.id, "employee_id": p.employee_id,
            "ho_ten": p.employee.ho_ten if p.employee else None,
            "ma_nv": p.employee.ma_nv if p.employee else None,
            "da_hoan_thanh": p.da_hoan_thanh, "diem": p.diem,
            "so_chung_chi": p.so_chung_chi,
            "ngay_cap_chung_chi": p.ngay_cap_chung_chi.isoformat() if p.ngay_cap_chung_chi else None,
            "han_chung_chi": p.han_chung_chi.isoformat() if p.han_chung_chi else None,
            "ghi_chu": p.ghi_chu,
        } for p in items
    ]


@router.post("/trainings/{training_id}/participants")
def add_participants(
    training_id: int,
    body: list[ParticipantBase],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    # Bulk cap chống DoS — tương tự benefits module
    if len(body) > 500:
        raise HTTPException(400, f"Tối đa 500 NV/lần thêm. Hiện gửi {len(body)}.")
    training = db.get(SafetyTraining, training_id)
    if not training:
        raise HTTPException(404, "Buổi huấn luyện không tồn tại")
    # Auto-tính hạn chứng chỉ = ngay_ket_thuc + 2 năm theo NĐ 44/2016
    from dateutil.relativedelta import relativedelta
    default_han = None
    if training.ngay_ket_thuc:
        default_han = training.ngay_ket_thuc + relativedelta(years=2)

    added = 0
    for p in body:
        # Skip duplicate
        existing = db.query(SafetyTrainingParticipant).filter(
            SafetyTrainingParticipant.training_id == training_id,
            SafetyTrainingParticipant.employee_id == p.employee_id,
        ).first()
        if existing:
            continue
        data = p.model_dump()
        if not data.get("han_chung_chi") and default_han:
            data["han_chung_chi"] = default_han
        db.add(SafetyTrainingParticipant(training_id=training_id, **data))
        added += 1
    db.commit()
    logger.info("HR safety_training %s added %s participants by user=%s",
                training_id, added, current_user.id)
    return {"added": added}


@router.put("/participants/{id}")
def update_participant(
    id: int, body: ParticipantBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    p = db.get(SafetyTrainingParticipant, id)
    if not p:
        raise HTTPException(404, "Không tìm thấy")
    data = body.model_dump(exclude={"employee_id"})  # không cho đổi employee_id
    for k, v in data.items():
        setattr(p, k, v)
    db.commit()
    return {"ok": True}


@router.delete("/participants/{id}")
def delete_participant(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    p = db.get(SafetyTrainingParticipant, id)
    if not p:
        raise HTTPException(404, "Không tìm thấy")
    db.delete(p)
    db.commit()
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════
# 4) Tai nạn lao động
# ═══════════════════════════════════════════════════════════════
class AccidentBase(BaseModel):
    employee_id: int
    ngay_xay_ra: date
    gio_xay_ra: Optional[str] = Field(default=None, max_length=10)
    dia_diem: Optional[str] = Field(default=None, max_length=255)
    mo_ta: str = Field(min_length=5)
    nguyen_nhan: Optional[str] = None
    muc_do: str = Field(max_length=20)  # nhe | nang | tu_vong
    so_ngay_nghi: int = Field(default=0, ge=0)
    chi_phi_y_te: Decimal = Field(default=Decimal(0), ge=0)
    bao_hiem_chi_tra: Decimal = Field(default=Decimal(0), ge=0)
    da_bao_cao_so_lao_dong: bool = False
    ngay_bao_cao: Optional[date] = None
    file_bien_ban: Optional[str] = Field(default=None, max_length=500)
    ghi_chu: Optional[str] = None

    @field_validator("file_bien_ban")
    @classmethod
    def _vt_file(cls, v):
        return _safe_url(v)

    @field_validator("muc_do")
    @classmethod
    def _vt_muc_do(cls, v):
        if v not in ("nhe", "nang", "tu_vong"):
            raise ValueError("muc_do phải là nhe/nang/tu_vong")
        return v

class AccidentCreate(AccidentBase):
    pass

class AccidentUpdate(BaseModel):
    ngay_xay_ra: Optional[date] = None
    gio_xay_ra: Optional[str] = Field(default=None, max_length=10)
    dia_diem: Optional[str] = Field(default=None, max_length=255)
    mo_ta: Optional[str] = Field(default=None, min_length=5)
    nguyen_nhan: Optional[str] = None
    muc_do: Optional[str] = Field(default=None, max_length=20)
    so_ngay_nghi: Optional[int] = Field(default=None, ge=0)
    chi_phi_y_te: Optional[Decimal] = Field(default=None, ge=0)
    bao_hiem_chi_tra: Optional[Decimal] = Field(default=None, ge=0)
    da_bao_cao_so_lao_dong: Optional[bool] = None
    ngay_bao_cao: Optional[date] = None
    file_bien_ban: Optional[str] = Field(default=None, max_length=500)
    ghi_chu: Optional[str] = None

    @field_validator("file_bien_ban")
    @classmethod
    def _vt_file(cls, v):
        return _safe_url(v)


@router.get("/accidents")
def list_accidents(
    muc_do: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "NHAN_SU", "GIAM_DOC", "BGD")),
):
    q = db.query(WorkAccident)
    if muc_do:
        q = q.filter(WorkAccident.muc_do == muc_do)
    if from_date:
        q = q.filter(WorkAccident.ngay_xay_ra >= from_date)
    if to_date:
        q = q.filter(WorkAccident.ngay_xay_ra <= to_date)
    items = q.order_by(WorkAccident.ngay_xay_ra.desc()).all()
    return [
        {
            "id": a.id, "employee_id": a.employee_id,
            "ho_ten": a.employee.ho_ten if a.employee else None,
            "ma_nv": a.employee.ma_nv if a.employee else None,
            "ten_bo_phan": a.employee.bo_phan.ten_bo_phan if a.employee and a.employee.bo_phan else None,
            "ngay_xay_ra": a.ngay_xay_ra.isoformat() if a.ngay_xay_ra else None,
            "gio_xay_ra": a.gio_xay_ra, "dia_diem": a.dia_diem,
            "mo_ta": a.mo_ta, "nguyen_nhan": a.nguyen_nhan, "muc_do": a.muc_do,
            "so_ngay_nghi": a.so_ngay_nghi,
            "chi_phi_y_te": float(a.chi_phi_y_te or 0),
            "bao_hiem_chi_tra": float(a.bao_hiem_chi_tra or 0),
            "da_bao_cao_so_lao_dong": a.da_bao_cao_so_lao_dong,
            "ngay_bao_cao": a.ngay_bao_cao.isoformat() if a.ngay_bao_cao else None,
            "file_bien_ban": a.file_bien_ban, "ghi_chu": a.ghi_chu,
        } for a in items
    ]


@router.post("/accidents")
def create_accident(
    body: AccidentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    if not db.get(Employee, body.employee_id):
        raise HTTPException(400, "employee_id không tồn tại")
    a = WorkAccident(**body.model_dump(), created_by_id=current_user.id)
    db.add(a)
    db.commit()
    db.refresh(a)
    logger.info("HR work_accident created id=%s emp=%s muc_do=%s by user=%s",
                a.id, body.employee_id, body.muc_do, current_user.id)
    return {"id": a.id}


@router.put("/accidents/{id}")
def update_accident(
    id: int, body: AccidentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    a = db.get(WorkAccident, id)
    if not a:
        raise HTTPException(404, "Không tìm thấy")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(a, k, v)
    db.commit()
    logger.info("HR work_accident updated id=%s by user=%s", id, current_user.id)
    return {"ok": True}


@router.delete("/accidents/{id}")
def delete_accident(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    a = db.get(WorkAccident, id)
    if not a:
        raise HTTPException(404, "Không tìm thấy")
    db.delete(a)
    db.commit()
    logger.info("HR work_accident deleted id=%s by user=%s", id, current_user.id)
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════
# 5) Summary cho dashboard module Safety
# ═══════════════════════════════════════════════════════════════
@router.get("/summary")
def safety_summary(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "NHAN_SU", "GIAM_DOC", "BGD")),
):
    today = date.today()
    days_30 = today + timedelta(days=30)
    year_start = date(today.year, 1, 1)

    # BHLĐ
    total_equipments = db.query(func.count(SafetyEquipment.id)).filter(SafetyEquipment.trang_thai == True).scalar() or 0
    issues_30d = db.query(func.count(SafetyEquipmentIssue.id)).filter(
        SafetyEquipmentIssue.ngay_cap >= today - timedelta(days=30),
    ).scalar() or 0
    expiring_equipments = db.query(func.count(SafetyEquipmentIssue.id)).filter(
        SafetyEquipmentIssue.han_su_dung_den.isnot(None),
        SafetyEquipmentIssue.han_su_dung_den >= today,
        SafetyEquipmentIssue.han_su_dung_den <= days_30,
    ).scalar() or 0

    # Huấn luyện
    trainings_ytd = db.query(func.count(SafetyTraining.id)).filter(
        SafetyTraining.ngay_bat_dau >= year_start,
    ).scalar() or 0
    participants_ytd = db.query(func.count(SafetyTrainingParticipant.id)).join(
        SafetyTraining, SafetyTraining.id == SafetyTrainingParticipant.training_id,
    ).filter(SafetyTraining.ngay_bat_dau >= year_start).scalar() or 0
    expiring_certs = db.query(func.count(SafetyTrainingParticipant.id)).filter(
        SafetyTrainingParticipant.han_chung_chi.isnot(None),
        SafetyTrainingParticipant.han_chung_chi >= today,
        SafetyTrainingParticipant.han_chung_chi <= days_30,
    ).scalar() or 0

    # TNLĐ
    accidents_ytd = db.query(func.count(WorkAccident.id)).filter(
        WorkAccident.ngay_xay_ra >= year_start,
    ).scalar() or 0
    accidents_by_muc_do_raw = db.query(WorkAccident.muc_do, func.count(WorkAccident.id)).filter(
        WorkAccident.ngay_xay_ra >= year_start,
    ).group_by(WorkAccident.muc_do).all()
    accidents_by_muc_do = {k: v for k, v in accidents_by_muc_do_raw}
    accidents_unreported = db.query(func.count(WorkAccident.id)).filter(
        WorkAccident.muc_do.in_(["nang", "tu_vong"]),
        WorkAccident.da_bao_cao_so_lao_dong == False,
    ).scalar() or 0

    return {
        "bhld": {
            "total_equipments": total_equipments,
            "issues_30d": issues_30d,
            "expiring_30d": expiring_equipments,
        },
        "training": {
            "trainings_ytd": trainings_ytd,
            "participants_ytd": participants_ytd,
            "expiring_certs_30d": expiring_certs,
        },
        "accidents": {
            "ytd": accidents_ytd,
            "nhe": accidents_by_muc_do.get("nhe", 0),
            "nang": accidents_by_muc_do.get("nang", 0),
            "tu_vong": accidents_by_muc_do.get("tu_vong", 0),
            "unreported_serious": accidents_unreported,
        },
    }
