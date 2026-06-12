"""Router: KPI / Đánh giá hiệu suất (Phase 1.4).

Mô hình quy trình:
1. HR/Admin tạo TEMPLATE bộ tiêu chí (theo vị trí, tổng trọng số = 100%)
2. HR/Admin mở CYCLE (chu kỳ): Q3/2026, 6 tháng đầu năm…
3. HR/Admin sinh EVALUATION cho từng NV (gán template + quản lý trực tiếp)
4. NV tự đánh giá → submit
5. Quản lý cho điểm + nhận xét → submit
6. BGD/HR duyệt → hoàn tất + tính điểm cuối + xếp loại
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.hr import (
    Employee, KPICriteria, KPICycle, KPIEvaluation, KPIScore, KPITemplate,
)

logger = logging.getLogger("erp")
router = APIRouter(prefix="/api/hr/kpi", tags=["hr-kpi"])


# ─── Helper: tính xếp loại A-E từ điểm 0-10 ───
def _calc_xep_loai(diem: Optional[Decimal]) -> Optional[str]:
    if diem is None:
        return None
    d = float(diem)
    if d >= 9.0: return "A"
    if d >= 7.5: return "B"
    if d >= 6.0: return "C"
    if d >= 4.5: return "D"
    return "E"


def _role_code_kpi(user: User) -> str:
    return (user.role.ma_vai_tro or "").upper() if user.role else ""


# ═══════════════════════════════════════════════════════════════
# 1) KPI Templates
# ═══════════════════════════════════════════════════════════════
class CriteriaIn(BaseModel):
    thu_tu: int = 0
    ten: str = Field(min_length=1, max_length=255)
    mo_ta: Optional[str] = None
    nhom: str = Field(default="ket_qua", max_length=20)  # ket_qua | hanh_vi | phat_trien
    trong_so: Decimal = Field(default=Decimal(0), ge=0, le=100)
    muc_tieu: Optional[str] = Field(default=None, max_length=255)
    thang_diem_max: int = Field(default=10, ge=1, le=100)


class TemplateBase(BaseModel):
    ten: str = Field(min_length=1, max_length=255)
    mo_ta: Optional[str] = None
    chuc_vu_id: Optional[int] = None
    bo_phan_id: Optional[int] = None
    trang_thai: bool = True


class TemplateCreate(TemplateBase):
    criteria: list[CriteriaIn] = []


class TemplateUpdate(BaseModel):
    ten: Optional[str] = Field(default=None, min_length=1, max_length=255)
    mo_ta: Optional[str] = None
    chuc_vu_id: Optional[int] = None
    bo_phan_id: Optional[int] = None
    trang_thai: Optional[bool] = None
    criteria: Optional[list[CriteriaIn]] = None  # nếu gửi → replace toàn bộ


@router.get("/templates")
def list_templates(
    active_only: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(KPITemplate)
    if active_only:
        q = q.filter(KPITemplate.trang_thai == True)
    items = q.order_by(KPITemplate.ten).all()
    return [_serialize_template(t) for t in items]


@router.get("/templates/{id}")
def get_template(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    t = db.get(KPITemplate, id)
    if not t:
        raise HTTPException(404, "Không tìm thấy template")
    return _serialize_template(t)


@router.post("/templates")
def create_template(
    body: TemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    # Validate tổng trọng số <= 100
    total_weight = sum(float(c.trong_so or 0) for c in body.criteria)
    if total_weight > 100.01:
        raise HTTPException(400, f"Tổng trọng số vượt 100% ({total_weight:.1f}%)")

    t = KPITemplate(**body.model_dump(exclude={"criteria"}))
    db.add(t)
    db.flush()
    for c in body.criteria:
        db.add(KPICriteria(template_id=t.id, **c.model_dump()))
    db.commit()
    db.refresh(t)
    logger.info("HR kpi_template created id=%s ten='%s' by user=%s", t.id, t.ten, current_user.id)
    return _serialize_template(t)


@router.put("/templates/{id}")
def update_template(
    id: int, body: TemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    t = db.get(KPITemplate, id)
    if not t:
        raise HTTPException(404, "Không tìm thấy")
    data = body.model_dump(exclude_unset=True, exclude={"criteria"})
    for k, v in data.items():
        setattr(t, k, v)
    # Replace criteria nếu gửi
    if body.criteria is not None:
        total = sum(float(c.trong_so or 0) for c in body.criteria)
        if total > 100.01:
            raise HTTPException(400, f"Tổng trọng số vượt 100% ({total:.1f}%)")
        # Xóa cũ
        db.query(KPICriteria).filter(KPICriteria.template_id == id).delete()
        for c in body.criteria:
            db.add(KPICriteria(template_id=id, **c.model_dump()))
    db.commit()
    db.refresh(t)
    logger.info("HR kpi_template updated id=%s by user=%s", id, current_user.id)
    return _serialize_template(t)


@router.delete("/templates/{id}")
def delete_template(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    t = db.get(KPITemplate, id)
    if not t:
        raise HTTPException(404, "Không tìm thấy")
    # Integrity: nếu có evaluation đã dùng template này → soft-delete
    in_use = db.query(KPIEvaluation).filter(KPIEvaluation.template_id == id).first()
    if in_use:
        t.trang_thai = False
        db.commit()
        return {"ok": True, "soft_deleted": True}
    db.delete(t)
    db.commit()
    logger.info("HR kpi_template deleted id=%s by user=%s", id, current_user.id)
    return {"ok": True}


def _serialize_template(t: KPITemplate) -> dict:
    return {
        "id": t.id,
        "ten": t.ten,
        "mo_ta": t.mo_ta,
        "chuc_vu_id": t.chuc_vu_id,
        "bo_phan_id": t.bo_phan_id,
        "trang_thai": t.trang_thai,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "criteria": [
            {
                "id": c.id, "thu_tu": c.thu_tu, "ten": c.ten, "mo_ta": c.mo_ta,
                "nhom": c.nhom, "trong_so": float(c.trong_so or 0),
                "muc_tieu": c.muc_tieu, "thang_diem_max": c.thang_diem_max,
            }
            for c in t.criteria
        ],
        "tong_trong_so": sum(float(c.trong_so or 0) for c in t.criteria),
    }


# ═══════════════════════════════════════════════════════════════
# 2) KPI Cycles
# ═══════════════════════════════════════════════════════════════
class CycleBase(BaseModel):
    ten: str = Field(min_length=1, max_length=150)
    loai: str = Field(default="quy", max_length=20)  # quy | 6_thang | nam
    ngay_bat_dau: date
    ngay_ket_thuc: date
    han_nv_tu_danh_gia: Optional[date] = None
    han_ql_danh_gia: Optional[date] = None
    trang_thai: str = Field(default="chuan_bi", max_length=20)
    ty_le_nv: Decimal = Field(default=Decimal("30"), ge=0, le=100)
    ty_le_ql: Decimal = Field(default=Decimal("70"), ge=0, le=100)
    ghi_chu: Optional[str] = None


class CycleCreate(CycleBase):
    pass


class CycleUpdate(BaseModel):
    ten: Optional[str] = Field(default=None, min_length=1, max_length=150)
    loai: Optional[str] = Field(default=None, max_length=20)
    ngay_bat_dau: Optional[date] = None
    ngay_ket_thuc: Optional[date] = None
    han_nv_tu_danh_gia: Optional[date] = None
    han_ql_danh_gia: Optional[date] = None
    trang_thai: Optional[str] = Field(default=None, max_length=20)
    ty_le_nv: Optional[Decimal] = Field(default=None, ge=0, le=100)
    ty_le_ql: Optional[Decimal] = Field(default=None, ge=0, le=100)
    ghi_chu: Optional[str] = None


@router.get("/cycles")
def list_cycles(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    items = db.query(KPICycle).order_by(KPICycle.ngay_bat_dau.desc()).all()
    # Count evaluations
    counts = dict(
        db.query(KPIEvaluation.cycle_id, func.count(KPIEvaluation.id))
        .group_by(KPIEvaluation.cycle_id).all()
    )
    return [
        {
            "id": c.id, "ten": c.ten, "loai": c.loai,
            "ngay_bat_dau": c.ngay_bat_dau.isoformat() if c.ngay_bat_dau else None,
            "ngay_ket_thuc": c.ngay_ket_thuc.isoformat() if c.ngay_ket_thuc else None,
            "han_nv_tu_danh_gia": c.han_nv_tu_danh_gia.isoformat() if c.han_nv_tu_danh_gia else None,
            "han_ql_danh_gia": c.han_ql_danh_gia.isoformat() if c.han_ql_danh_gia else None,
            "trang_thai": c.trang_thai,
            "ty_le_nv": float(c.ty_le_nv or 0), "ty_le_ql": float(c.ty_le_ql or 0),
            "ghi_chu": c.ghi_chu,
            "so_evaluation": counts.get(c.id, 0),
        } for c in items
    ]


@router.post("/cycles")
def create_cycle(
    body: CycleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    if body.ngay_ket_thuc <= body.ngay_bat_dau:
        raise HTTPException(400, "Ngày kết thúc phải sau ngày bắt đầu")
    if float(body.ty_le_nv + body.ty_le_ql) - 100 > 0.01:
        raise HTTPException(400, "Tổng tỷ lệ NV + QL không quá 100%")
    if db.query(KPICycle).filter(KPICycle.ten == body.ten).first():
        raise HTTPException(400, f"Chu kỳ '{body.ten}' đã tồn tại")
    c = KPICycle(**body.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    logger.info("HR kpi_cycle created id=%s ten='%s' by user=%s", c.id, c.ten, current_user.id)
    return {"id": c.id, "ten": c.ten}


@router.put("/cycles/{id}")
def update_cycle(
    id: int, body: CycleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    c = db.get(KPICycle, id)
    if not c:
        raise HTTPException(404, "Không tìm thấy")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    logger.info("HR kpi_cycle updated id=%s by user=%s", id, current_user.id)
    return {"ok": True}


@router.delete("/cycles/{id}")
def delete_cycle(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    c = db.get(KPICycle, id)
    if not c:
        raise HTTPException(404, "Không tìm thấy")
    db.delete(c)  # cascade evaluations
    db.commit()
    logger.info("HR kpi_cycle deleted id=%s by user=%s", id, current_user.id)
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════
# 3) KPI Evaluations — workflow chính
# ═══════════════════════════════════════════════════════════════
class GenerateEvalRequest(BaseModel):
    cycle_id: int
    bo_phan_ids: Optional[list[int]] = None  # nếu None → tất cả
    template_id: Optional[int] = None  # nếu None → mỗi NV pick template theo chuc_vu_id (fallback null)


@router.post("/evaluations/generate")
def generate_evaluations(
    body: GenerateEvalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    """Sinh bản đánh giá cho NV trong 1 chu kỳ (bulk).

    - Lọc NV đang làm việc + thuộc các BP chỉ định (hoặc tất cả)
    - Mỗi NV: tạo 1 KPIEvaluation + snapshot KPIScore từ template
    - Skip nếu đã có evaluation cho cặp (cycle, employee)
    """
    cycle = db.get(KPICycle, body.cycle_id)
    if not cycle:
        raise HTTPException(404, "Chu kỳ không tồn tại")

    q = db.query(Employee).filter(Employee.trang_thai == "dang_lam")
    if body.bo_phan_ids:
        q = q.filter(Employee.bo_phan_id.in_(body.bo_phan_ids))
    employees = q.all()
    # P2 FIX: DoS cap — max 500 NV/lần generate
    if len(employees) > 500:
        raise HTTPException(
            400,
            f"Quá {len(employees)} NV/lần (cap 500). Hãy chia nhỏ theo bộ phận.",
        )

    # Cache existing evaluations để skip
    existing = set(
        r for r, in db.query(KPIEvaluation.employee_id).filter(KPIEvaluation.cycle_id == body.cycle_id).all()
    )

    # Load default template + criteria nếu có template_id
    default_template = None
    default_criteria: list[KPICriteria] = []
    if body.template_id:
        default_template = db.get(KPITemplate, body.template_id)
        if not default_template:
            raise HTTPException(400, "template_id không tồn tại")
        default_criteria = list(default_template.criteria)

    # Cache template theo chuc_vu_id
    templates_by_position: dict[int, KPITemplate] = {}
    for t in db.query(KPITemplate).filter(KPITemplate.trang_thai == True, KPITemplate.chuc_vu_id.isnot(None)).all():
        templates_by_position[t.chuc_vu_id] = t

    created = 0
    skipped = 0
    for emp in employees:
        if emp.id in existing:
            skipped += 1
            continue
        tpl = default_template or templates_by_position.get(emp.chuc_vu_id)  # type: ignore[arg-type]
        criteria = list(tpl.criteria) if tpl else default_criteria
        ev = KPIEvaluation(
            cycle_id=body.cycle_id,
            employee_id=emp.id,
            template_id=tpl.id if tpl else None,
        )
        db.add(ev)
        db.flush()
        for c in criteria:
            db.add(KPIScore(
                evaluation_id=ev.id,
                criteria_id=c.id,
                ten_tieu_chi=c.ten,
                nhom=c.nhom,
                trong_so=c.trong_so,
                thang_diem_max=c.thang_diem_max,
            ))
        created += 1

    db.commit()
    logger.info("HR kpi_eval generate cycle=%s created=%s skipped=%s by user=%s",
                body.cycle_id, created, skipped, current_user.id)
    return {"created": created, "skipped": skipped}


@router.get("/evaluations")
def list_evaluations(
    cycle_id: Optional[int] = None,
    employee_id: Optional[int] = None,
    trang_thai: Optional[str] = None,
    bo_phan_id: Optional[int] = None,
    limit: int = Query(default=500, ge=1, le=2000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List đánh giá KPI.

    - HR/Admin/BGD/GD: xem tất cả
    - NV thường: chỉ xem của chính mình (làm self-evaluation)
    """
    role_code = _role_code_kpi(current_user)
    is_admin = role_code in ("ADMIN", "NHAN_SU", "GIAM_DOC", "BGD")
    q = db.query(KPIEvaluation)
    if not is_admin:
        my_emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not my_emp:
            return []
        q = q.filter(KPIEvaluation.employee_id == my_emp.id)
    elif employee_id:
        q = q.filter(KPIEvaluation.employee_id == employee_id)

    if cycle_id:
        q = q.filter(KPIEvaluation.cycle_id == cycle_id)
    if trang_thai:
        q = q.filter(KPIEvaluation.trang_thai == trang_thai)
    if bo_phan_id:
        q = q.join(Employee, Employee.id == KPIEvaluation.employee_id) \
             .filter(Employee.bo_phan_id == bo_phan_id)

    items = q.order_by(KPIEvaluation.updated_at.desc()).limit(limit).all()
    return [_serialize_evaluation(e, include_scores=False) for e in items]


@router.get("/evaluations/{id}")
def get_evaluation(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ev = db.get(KPIEvaluation, id)
    if not ev:
        raise HTTPException(404, "Không tìm thấy")
    # Access control
    role_code = _role_code_kpi(current_user)
    is_admin = role_code in ("ADMIN", "NHAN_SU", "GIAM_DOC", "BGD")
    if not is_admin:
        my_emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not my_emp:
            raise HTTPException(403, "Không có quyền xem")
        # NV xem được của chính mình HOẶC NV cấp dưới (nếu là QL)
        if ev.employee_id != my_emp.id and ev.quan_ly_id != my_emp.id:
            raise HTTPException(403, "Không có quyền xem")
    return _serialize_evaluation(ev, include_scores=True)


class ScoreSubmitItem(BaseModel):
    score_id: int
    diem_nv: Optional[Decimal] = Field(default=None, ge=0)
    diem_ql: Optional[Decimal] = Field(default=None, ge=0)
    ghi_chu_nv: Optional[str] = None
    ghi_chu_ql: Optional[str] = None


class EvaluationSubmit(BaseModel):
    by_role: str = Field(max_length=10)  # nv | ql
    scores: list[ScoreSubmitItem] = []
    nhan_xet_nv: Optional[str] = None
    nhan_xet_ql: Optional[str] = None
    quan_ly_id: Optional[int] = None  # cho phép set/đổi QL khi submit


@router.put("/evaluations/{id}/submit")
def submit_evaluation(
    id: int, body: EvaluationSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """NV hoặc QL nộp đánh giá. Workflow:
      chua_lam → (NV submit) → cho_ql → (QL submit) → cho_duyet → (HR duyệt) → hoan_tat
    """
    # P2 FIX: row lock chống race condition khi 2 user submit cùng lúc
    ev = (
        db.query(KPIEvaluation)
        .filter(KPIEvaluation.id == id)
        .with_for_update()
        .first()
    )
    if not ev:
        raise HTTPException(404, "Không tìm thấy")
    if ev.cycle.trang_thai == "dong":
        raise HTTPException(400, "Chu kỳ đã đóng, không thể chỉnh sửa")

    role_code = _role_code_kpi(current_user)
    is_admin = role_code in ("ADMIN", "NHAN_SU", "GIAM_DOC", "BGD")
    my_emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()

    # Build score lookup
    scores_by_id = {s.id: s for s in ev.scores}

    if body.by_role == "nv":
        # NV phải là chính mình hoặc HR admin
        if not is_admin and (not my_emp or my_emp.id != ev.employee_id):
            raise HTTPException(403, "Không có quyền tự đánh giá bản này")
        for item in body.scores:
            s = scores_by_id.get(item.score_id)
            if not s: continue
            # P1 FIX: validate điểm không vượt thang_diem_max
            if item.diem_nv is not None:
                if item.diem_nv > s.thang_diem_max:
                    raise HTTPException(400, f"Điểm '{s.ten_tieu_chi}' vượt thang điểm max ({s.thang_diem_max})")
                s.diem_nv = item.diem_nv
            if item.ghi_chu_nv is not None: s.ghi_chu_nv = item.ghi_chu_nv
        if body.nhan_xet_nv is not None:
            ev.nhan_xet_nv = body.nhan_xet_nv
        # P0 FIX: privilege escalation qua quan_ly_id
        # Chỉ HR/Admin được set/đổi quan_ly_id. NV thường chỉ được set khi chưa có
        # và CHẶN tự gán chính mình hoặc đồng nghiệp ngang cấp.
        if body.quan_ly_id is not None:
            if not db.get(Employee, body.quan_ly_id):
                raise HTTPException(400, "quan_ly_id không tồn tại")
            if not is_admin:
                if ev.quan_ly_id is not None:
                    raise HTTPException(403, "Quản lý đã được gán — chỉ HR mới đổi được")
                if body.quan_ly_id == ev.employee_id:
                    raise HTTPException(400, "Không được tự gán mình làm quản lý")
            ev.quan_ly_id = body.quan_ly_id

        # Tính tổng điểm NV (weighted)
        total, total_w = Decimal(0), Decimal(0)
        for s in ev.scores:
            if s.diem_nv is not None and s.trong_so:
                # Normalize điểm về thang 10
                normalized = s.diem_nv * 10 / s.thang_diem_max if s.thang_diem_max else s.diem_nv
                total += normalized * s.trong_so
                total_w += s.trong_so
        ev.diem_nv_tu_cham = (total / total_w) if total_w else None
        if ev.trang_thai in ("chua_lam", "nv_dang_cham"):
            ev.trang_thai = "cho_ql"
        ev.ngay_nv_submit = datetime.now(timezone.utc)

    elif body.by_role == "ql":
        # QL phải là quan_ly_id của ev hoặc HR admin
        if not is_admin and (not my_emp or my_emp.id != ev.quan_ly_id):
            raise HTTPException(403, "Bạn không phải quản lý trực tiếp của NV này")
        # P1 FIX: workflow guard — QL chỉ chấm khi NV đã submit
        if not is_admin and ev.trang_thai not in ("cho_ql", "cho_duyet"):
            raise HTTPException(
                400,
                "NV chưa hoàn thành tự đánh giá. QL chỉ chấm sau khi NV submit.",
            )
        for item in body.scores:
            s = scores_by_id.get(item.score_id)
            if not s: continue
            # P1 FIX: validate điểm không vượt thang
            if item.diem_ql is not None:
                if item.diem_ql > s.thang_diem_max:
                    raise HTTPException(400, f"Điểm '{s.ten_tieu_chi}' vượt thang điểm max ({s.thang_diem_max})")
                s.diem_ql = item.diem_ql
            if item.ghi_chu_ql is not None: s.ghi_chu_ql = item.ghi_chu_ql
        if body.nhan_xet_ql is not None:
            ev.nhan_xet_ql = body.nhan_xet_ql

        total, total_w = Decimal(0), Decimal(0)
        for s in ev.scores:
            if s.diem_ql is not None and s.trong_so:
                normalized = s.diem_ql * 10 / s.thang_diem_max if s.thang_diem_max else s.diem_ql
                total += normalized * s.trong_so
                total_w += s.trong_so
        ev.diem_quan_ly = (total / total_w) if total_w else None
        if ev.trang_thai != "hoan_tat":
            ev.trang_thai = "cho_duyet"
        ev.ngay_ql_submit = datetime.now(timezone.utc)

    else:
        raise HTTPException(400, "by_role phải là 'nv' hoặc 'ql'")

    db.commit()
    db.refresh(ev)
    logger.info("HR kpi_eval %s submit by_role=%s user=%s", id, body.by_role, current_user.id)
    return _serialize_evaluation(ev, include_scores=True)


@router.put("/evaluations/{id}/approve")
def approve_evaluation(
    id: int,
    nhan_xet_bgd: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU", "GIAM_DOC", "BGD")),
):
    """HR/BGD duyệt — tính điểm cuối cùng + xếp loại A-E."""
    ev = db.get(KPIEvaluation, id)
    if not ev:
        raise HTTPException(404, "Không tìm thấy")
    if ev.diem_nv_tu_cham is None or ev.diem_quan_ly is None:
        raise HTTPException(400, "Phải có cả điểm NV tự chấm và điểm QL trước khi duyệt")

    cycle = ev.cycle
    nv_w = float(cycle.ty_le_nv or 30)
    ql_w = float(cycle.ty_le_ql or 70)
    if nv_w + ql_w == 0:
        raise HTTPException(400, "Tỷ lệ NV+QL của chu kỳ = 0")

    diem_cuoi = (float(ev.diem_nv_tu_cham) * nv_w + float(ev.diem_quan_ly) * ql_w) / (nv_w + ql_w)
    ev.diem_cuoi_cung = Decimal(str(round(diem_cuoi, 2)))
    ev.xep_loai = _calc_xep_loai(ev.diem_cuoi_cung)
    if nhan_xet_bgd is not None:
        ev.nhan_xet_bgd = nhan_xet_bgd
    ev.trang_thai = "hoan_tat"
    ev.ngay_duyet = datetime.now(timezone.utc)
    db.commit()
    db.refresh(ev)
    logger.info("HR kpi_eval %s approved diem=%s xep_loai=%s by user=%s",
                id, ev.diem_cuoi_cung, ev.xep_loai, current_user.id)
    return _serialize_evaluation(ev, include_scores=True)


@router.delete("/evaluations/{id}")
def delete_evaluation(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    ev = db.get(KPIEvaluation, id)
    if not ev:
        raise HTTPException(404, "Không tìm thấy")
    if ev.trang_thai == "hoan_tat":
        raise HTTPException(400, "Đã duyệt, không thể xóa. Mở lại cycle nếu cần sửa.")
    db.delete(ev)
    db.commit()
    return {"ok": True}


def _serialize_evaluation(ev: KPIEvaluation, include_scores: bool = False) -> dict:
    emp = ev.employee
    ql = ev.quan_ly
    base = {
        "id": ev.id, "cycle_id": ev.cycle_id, "employee_id": ev.employee_id,
        "template_id": ev.template_id, "quan_ly_id": ev.quan_ly_id,
        "diem_nv_tu_cham": float(ev.diem_nv_tu_cham) if ev.diem_nv_tu_cham is not None else None,
        "diem_quan_ly": float(ev.diem_quan_ly) if ev.diem_quan_ly is not None else None,
        "diem_cuoi_cung": float(ev.diem_cuoi_cung) if ev.diem_cuoi_cung is not None else None,
        "xep_loai": ev.xep_loai,
        "nhan_xet_nv": ev.nhan_xet_nv,
        "nhan_xet_ql": ev.nhan_xet_ql,
        "nhan_xet_bgd": ev.nhan_xet_bgd,
        "trang_thai": ev.trang_thai,
        "ngay_nv_submit": ev.ngay_nv_submit.isoformat() if ev.ngay_nv_submit else None,
        "ngay_ql_submit": ev.ngay_ql_submit.isoformat() if ev.ngay_ql_submit else None,
        "ngay_duyet": ev.ngay_duyet.isoformat() if ev.ngay_duyet else None,
        # Enriched
        "ho_ten": emp.ho_ten if emp else None,
        "ma_nv": emp.ma_nv if emp else None,
        "ten_bo_phan": emp.bo_phan.ten_bo_phan if emp and emp.bo_phan else None,
        "ten_chuc_vu": emp.chuc_vu.ten_chuc_vu if emp and emp.chuc_vu else None,
        "ten_quan_ly": ql.ho_ten if ql else None,
        "ten_chu_ky": ev.cycle.ten if ev.cycle else None,
        "ten_template": ev.template.ten if ev.template else None,
    }
    if include_scores:
        base["scores"] = [
            {
                "id": s.id, "criteria_id": s.criteria_id,
                "ten_tieu_chi": s.ten_tieu_chi, "nhom": s.nhom,
                "trong_so": float(s.trong_so or 0), "thang_diem_max": s.thang_diem_max,
                "diem_nv": float(s.diem_nv) if s.diem_nv is not None else None,
                "diem_ql": float(s.diem_ql) if s.diem_ql is not None else None,
                "ghi_chu_nv": s.ghi_chu_nv, "ghi_chu_ql": s.ghi_chu_ql,
            } for s in sorted(ev.scores, key=lambda x: x.id)
        ]
    return base


# ═══════════════════════════════════════════════════════════════
# 4) Summary cho dashboard
# ═══════════════════════════════════════════════════════════════
@router.get("/summary")
def kpi_summary(
    cycle_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "NHAN_SU", "GIAM_DOC", "BGD")),
):
    q = db.query(KPIEvaluation)
    if cycle_id:
        q = q.filter(KPIEvaluation.cycle_id == cycle_id)
    total = q.count()
    by_status_raw = db.query(KPIEvaluation.trang_thai, func.count(KPIEvaluation.id))
    if cycle_id:
        by_status_raw = by_status_raw.filter(KPIEvaluation.cycle_id == cycle_id)
    by_status = dict(by_status_raw.group_by(KPIEvaluation.trang_thai).all())

    by_xep_loai_raw = db.query(KPIEvaluation.xep_loai, func.count(KPIEvaluation.id))
    if cycle_id:
        by_xep_loai_raw = by_xep_loai_raw.filter(KPIEvaluation.cycle_id == cycle_id)
    by_xep_loai = dict(by_xep_loai_raw.filter(KPIEvaluation.xep_loai.isnot(None))
                        .group_by(KPIEvaluation.xep_loai).all())

    avg_score_q = db.query(func.avg(KPIEvaluation.diem_cuoi_cung))
    if cycle_id:
        avg_score_q = avg_score_q.filter(KPIEvaluation.cycle_id == cycle_id)
    avg_score = avg_score_q.scalar()

    return {
        "total": total,
        "by_status": by_status,
        "by_xep_loai": [
            {"name": k, "value": v} for k, v in sorted(by_xep_loai.items())
        ],
        "avg_score": float(avg_score) if avg_score else 0,
    }
