"""Router: Bảng lương tháng — HR/BGĐ duyệt (Sprint D.5).

Workflow theo Điều 14 quy trình tính lương + Điều 15.1 + Điều 15.5:
  du_thao (engine vừa tính)
    ↓ HR kiểm tra + chốt
  da_chot (NV xem được trên Mobile, mở khiếu nại 15 ngày)
    ↓ Hết hạn khiếu nại + BGĐ duyệt
  da_thanh_toan (đã chi trả, khóa, không sửa)

Endpoints:
  GET    /api/hr/payroll-runs              — list bảng lương theo tháng × bộ phận
  GET    /api/hr/payroll-runs/summary      — KPI tổng quan
  GET    /api/hr/payroll-runs/{id}         — chi tiết 1 run
  POST   /api/hr/payroll-runs/chot         — HR chốt cả tháng × bộ phận
  POST   /api/hr/payroll-runs/duyet-thanh-toan — BGĐ duyệt chi trả
  POST   /api/hr/payroll-runs/{id}/mo-khoa — Mở khóa run (ADMIN only)
  DELETE /api/hr/payroll-runs/by-month     — Xóa run du_thao để tính lại

Bảo mật:
  - HR/NHAN_SU: chốt
  - BGĐ/GIAM_DOC: duyệt thanh toán (4-eyes vs HR đã chốt)
  - ADMIN: mở khóa khi cần sửa
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
from app.models.hr import Department, Employee, PayrollRun

logger = logging.getLogger("erp")
router = APIRouter(prefix="/api/hr/payroll-runs", tags=["hr-payroll-runs"])


# ─── Schemas ───
class PayrollRunRead(BaseModel):
    id: int
    employee_id: int
    ho_ten: str
    ma_nv: Optional[str] = None
    bo_phan: Optional[str] = None
    thang: int
    nam: int
    trang_thai: str

    luong_san_pham: Decimal
    bu_toi_thieu_vung: Decimal
    phu_cap: Decimal  # = tổng cộng thêm (theo engine D.3+D.4)
    bao_hiem: Decimal
    tam_ung: Decimal
    tong_thu_nhap: Decimal
    thuc_linh: Decimal

    cong_quy_doi: Optional[Decimal] = None
    he_so_ca_nhan_snapshot: Optional[Decimal] = None
    trong_so_ca_nhan: Optional[Decimal] = None

    class Config:
        from_attributes = True


class ChotRequest(BaseModel):
    nam: int = Field(ge=2020, le=2100)
    thang: int = Field(ge=1, le=12)
    bo_phan_id: Optional[int] = None
    ghi_chu: Optional[str] = None
    # Khi không truyền bo_phan_id (chốt toàn công ty) → bắt buộc xác nhận tường minh
    xac_nhan_tat_ca: bool = False


class DuyetThanhToanRequest(BaseModel):
    nam: int = Field(ge=2020, le=2100)
    thang: int = Field(ge=1, le=12)
    bo_phan_id: Optional[int] = None
    xac_nhan_tat_ca: bool = False


class DeleteRunsRequest(BaseModel):
    nam: int = Field(ge=2020, le=2100)
    thang: int = Field(ge=1, le=12)
    bo_phan_id: Optional[int] = None
    xac_nhan_tat_ca: bool = False


class MoKhoaRequest(BaseModel):
    """Mở khóa phải có lý do để audit thanh tra."""
    ly_do: str = Field(min_length=20, max_length=1000)


# ─── Helpers ───
def _to_read(r: PayrollRun) -> PayrollRunRead:
    emp = r.employee
    return PayrollRunRead(
        id=r.id,
        employee_id=r.employee_id,
        ho_ten=emp.ho_ten if emp else "",
        ma_nv=emp.ma_nv if emp else None,
        bo_phan=emp.bo_phan.ten_bo_phan if emp and emp.bo_phan else None,
        thang=r.thang,
        nam=r.nam,
        trang_thai=r.trang_thai,
        luong_san_pham=Decimal(str(r.luong_san_pham or 0)),
        bu_toi_thieu_vung=Decimal(str(r.bu_toi_thieu_vung or 0)),
        phu_cap=Decimal(str(r.phu_cap or 0)),
        bao_hiem=Decimal(str(r.bao_hiem or 0)),
        tam_ung=Decimal(str(r.tam_ung or 0)),
        tong_thu_nhap=Decimal(str(r.tong_thu_nhap or 0)),
        thuc_linh=Decimal(str(r.thuc_linh or 0)),
        cong_quy_doi=Decimal(str(r.cong_quy_doi or 0)) if r.cong_quy_doi else None,
        he_so_ca_nhan_snapshot=Decimal(str(r.he_so_ca_nhan_snapshot or 0)) if r.he_so_ca_nhan_snapshot else None,
        trong_so_ca_nhan=Decimal(str(r.trong_so_ca_nhan or 0)) if r.trong_so_ca_nhan else None,
    )


# ─── List & Read ───
@router.get("", response_model=list[PayrollRunRead])
def list_runs(
    nam: int = Query(ge=2020, le=2100),
    thang: int = Query(ge=1, le=12),
    bo_phan_id: Optional[int] = None,
    trang_thai: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "NHAN_SU", "GIAM_DOC", "BGD")),
):
    """List bảng lương tháng × bộ phận. Chỉ HR/BGĐ."""
    q = db.query(PayrollRun).options(
        joinedload(PayrollRun.employee).joinedload(Employee.bo_phan),
    ).join(Employee, PayrollRun.employee_id == Employee.id).filter(
        PayrollRun.nam == nam,
        PayrollRun.thang == thang,
    )
    if bo_phan_id:
        q = q.filter(Employee.bo_phan_id == bo_phan_id)
    if trang_thai:
        q = q.filter(PayrollRun.trang_thai == trang_thai)

    rows = q.order_by(Employee.bo_phan_id, Employee.ho_ten).limit(2000).all()
    return [_to_read(r) for r in rows]


@router.get("/summary")
def summary(
    nam: int = Query(ge=2020, le=2100),
    thang: int = Query(ge=1, le=12),
    bo_phan_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "NHAN_SU", "GIAM_DOC", "BGD")),
):
    """KPI tổng quan — aggregate DB-side để không load toàn bộ rows vào memory."""
    base_filter = [PayrollRun.nam == nam, PayrollRun.thang == thang]
    join_dept = bool(bo_phan_id)

    def _agg(*selects):
        q = db.query(*selects)
        if join_dept:
            q = q.join(Employee, PayrollRun.employee_id == Employee.id).filter(Employee.bo_phan_id == bo_phan_id)
        return q.filter(*base_filter)

    agg = _agg(
        func.count(PayrollRun.id),
        func.coalesce(func.sum(PayrollRun.luong_san_pham), 0),
        func.coalesce(func.sum(PayrollRun.bu_toi_thieu_vung), 0),
        func.coalesce(func.sum(PayrollRun.phu_cap), 0),
        func.coalesce(func.sum(PayrollRun.bao_hiem), 0) + func.coalesce(func.sum(PayrollRun.tam_ung), 0),
        func.coalesce(func.sum(PayrollRun.thuc_linh), 0),
    ).first()

    by_status_rows = _agg(PayrollRun.trang_thai, func.count(PayrollRun.id)).group_by(PayrollRun.trang_thai).all()

    return {
        "total": int(agg[0] or 0),
        "quy_luong_san_pham": float(agg[1] or 0),
        "quy_bu_toi_thieu_vung": float(agg[2] or 0),
        "quy_cong_them": float(agg[3] or 0),
        "quy_khau_tru": float(agg[4] or 0),
        "quy_thuc_linh": float(agg[5] or 0),
        "by_trang_thai": {s: c for s, c in by_status_rows},
    }


@router.get("/{run_id}", response_model=PayrollRunRead)
def get_run(
    run_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "NHAN_SU", "GIAM_DOC", "BGD")),
):
    r = db.query(PayrollRun).filter(PayrollRun.id == run_id).first()
    if not r:
        raise HTTPException(404, "Không tìm thấy bảng lương.")
    return _to_read(r)


# ─── Workflow: HR chốt ───
@router.post("/chot")
def chot_thang(
    body: ChotRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    """HR chốt bảng lương tháng × bộ phận: du_thao → da_chot.

    Sau khi chốt, NV xem được trên Mobile + bắt đầu đếm 15 ngày khiếu nại.

    Phải truyền `bo_phan_id` HOẶC `xac_nhan_tat_ca=True` (chốt toàn công ty).
    """
    if not body.bo_phan_id and not body.xac_nhan_tat_ca:
        raise HTTPException(
            status_code=400,
            detail="Phải chọn bộ phận hoặc xác nhận tường minh xac_nhan_tat_ca=True để chốt toàn công ty.",
        )

    q = db.query(PayrollRun).join(Employee, PayrollRun.employee_id == Employee.id).filter(
        PayrollRun.nam == body.nam,
        PayrollRun.thang == body.thang,
        PayrollRun.trang_thai == "du_thao",
    )
    if body.bo_phan_id:
        q = q.filter(Employee.bo_phan_id == body.bo_phan_id)

    rows = q.all()
    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"Không có bảng lương dự thảo nào tháng {body.thang}/{body.nam} để chốt.",
        )

    # Guard: không cho chốt nếu còn bảng lương thực lĩnh ÂM (khấu trừ > thu nhập)
    negs = [r for r in rows if Decimal(str(r.thuc_linh or 0)) < 0]
    if negs:
        ten = ", ".join(f"{r.employee.ma_nv or r.employee_id}" for r in negs[:5])
        raise HTTPException(
            status_code=409,
            detail=(
                f"Có {len(negs)} bảng lương thực lĩnh ÂM (khấu trừ lớn hơn thu nhập): {ten}"
                + (" ..." if len(negs) > 5 else "")
                + ". Phải rà soát/sửa (giảm tạm ứng, kiểm tra mức bảo hiểm) trước khi chốt."
            ),
        )

    # Cảnh báo nếu chốt toàn công ty > 50 NV
    if not body.bo_phan_id and len(rows) > 50:
        logger.warning(f"Mass chot {len(rows)} runs (toàn công ty) by user_id={current_user.id} thang={body.thang}/{body.nam}")

    today = date.today()
    ts = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    for r in rows:
        r.trang_thai = "da_chot"
        r.ngay_chot = today  # mốc tính hạn khiếu nại 15 ngày làm việc (Điều 16)
        if body.ghi_chu:
            r.ghi_chu_calc = (r.ghi_chu_calc or "") + f"\n[CHỐT {ts} by user_id={current_user.id}] {body.ghi_chu}"

    db.commit()
    logger.info(f"Payroll chot: {len(rows)} run thang {body.thang}/{body.nam} bo_phan={body.bo_phan_id} by user_id={current_user.id}")
    return {"chot": len(rows), "thang": body.thang, "nam": body.nam}


# ─── Workflow: BGĐ duyệt thanh toán ───
@router.post("/duyet-thanh-toan")
def duyet_thanh_toan(
    body: DuyetThanhToanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "GIAM_DOC", "BGD")),
):
    """BGĐ duyệt chi trả: da_chot → da_thanh_toan.

    Sau bước này bảng lương bị khóa hoàn toàn — không thể sửa.
    Phải truyền `bo_phan_id` HOẶC `xac_nhan_tat_ca=True`.
    """
    if not body.bo_phan_id and not body.xac_nhan_tat_ca:
        raise HTTPException(
            status_code=400,
            detail="Phải chọn bộ phận hoặc xác nhận tường minh xac_nhan_tat_ca=True để duyệt thanh toán toàn công ty.",
        )

    q = db.query(PayrollRun).join(Employee, PayrollRun.employee_id == Employee.id).filter(
        PayrollRun.nam == body.nam,
        PayrollRun.thang == body.thang,
        PayrollRun.trang_thai == "da_chot",
    )
    if body.bo_phan_id:
        q = q.filter(Employee.bo_phan_id == body.bo_phan_id)

    rows = q.all()
    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"Không có bảng lương đã chốt nào tháng {body.thang}/{body.nam} để duyệt chi trả.",
        )

    if not body.bo_phan_id and len(rows) > 50:
        logger.warning(f"Mass duyet-thanh-toan {len(rows)} runs by user_id={current_user.id} thang={body.thang}/{body.nam}")

    for r in rows:
        r.trang_thai = "da_thanh_toan"

    db.commit()
    logger.info(f"Payroll duyet thanh toan: {len(rows)} run thang {body.thang}/{body.nam} by user_id={current_user.id}")
    return {"duyet": len(rows), "thang": body.thang, "nam": body.nam}


# ─── Mở khóa (ADMIN) ───
@router.post("/{run_id}/mo-khoa")
def mo_khoa(
    run_id: int,
    body: MoKhoaRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN")),
):
    """Mở khóa: da_thanh_toan/da_chot → du_thao. Chỉ ADMIN. Phải có lý do >=20 ký tự.

    Chặn mở khóa nếu còn khiếu nại đang xử lý — phải xử lý hết trước.
    """
    from app.models.hr import PayrollComplaint  # local import tránh vòng tròn
    r = db.query(PayrollRun).filter(PayrollRun.id == run_id).first()
    if not r:
        raise HTTPException(404, "Không tìm thấy bảng lương.")
    if r.trang_thai == "du_thao":
        raise HTTPException(400, "Bảng lương đang ở trạng thái dự thảo — không cần mở khóa.")

    # Chặn nếu còn khiếu nại pending (moi/dang_xu_ly)
    pending = db.query(PayrollComplaint).filter(
        PayrollComplaint.payroll_run_id == run_id,
        PayrollComplaint.trang_thai.in_(["moi", "dang_xu_ly"]),
    ).count()
    if pending:
        raise HTTPException(
            status_code=409,
            detail=f"Còn {pending} khiếu nại chưa xử lý cho phiếu này — phải kết luận hết trước khi mở khóa.",
        )

    old = r.trang_thai
    r.trang_thai = "du_thao"
    ts = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    r.ghi_chu_calc = (r.ghi_chu_calc or "") + f"\n[MỞ KHÓA {ts} by user_id={current_user.id}] từ {old} — LÝ DO: {body.ly_do}"
    db.commit()
    logger.warning(f"Payroll #{run_id} unlocked from {old} by user_id={current_user.id} reason={body.ly_do!r}")
    return {"ok": True, "id": run_id, "from": old, "to": "du_thao"}


# ─── Xóa run du_thao (tính lại) ───
@router.post("/delete-drafts")
def delete_drafts(
    body: DeleteRunsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    """Xóa toàn bộ run trạng thái du_thao tháng × bộ phận để chạy engine lại.

    KHÔNG xóa run đã chốt / đã thanh toán.
    Phải truyền `bo_phan_id` HOẶC `xac_nhan_tat_ca=True`.
    """
    if not body.bo_phan_id and not body.xac_nhan_tat_ca:
        raise HTTPException(
            status_code=400,
            detail="Phải chọn bộ phận hoặc xác nhận tường minh xac_nhan_tat_ca=True để xóa toàn công ty.",
        )

    q = db.query(PayrollRun).join(Employee, PayrollRun.employee_id == Employee.id).filter(
        PayrollRun.nam == body.nam,
        PayrollRun.thang == body.thang,
        PayrollRun.trang_thai == "du_thao",
    )
    if body.bo_phan_id:
        q = q.filter(Employee.bo_phan_id == body.bo_phan_id)

    rows = q.all()
    n = len(rows)
    ids = [r.id for r in rows]
    for r in rows:
        db.delete(r)
    db.commit()
    logger.info(f"Deleted {n} draft payroll runs thang {body.thang}/{body.nam} by user_id={current_user.id} ids={ids[:20]}{' ...' if len(ids) > 20 else ''}")
    return {"deleted": n}
