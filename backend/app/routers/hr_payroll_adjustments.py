"""Router: Phụ cấp + Khấu trừ + Tạm ứng (Sprint D.4 — Điều 12 Quy chế).

CRUD bảng adjustments + Auto-generate BHXH/BHYT/BHTN từ lương BHXH HĐLĐ.
Workflow: du_thao (HR tạo) → da_duyet (HR/BGĐ duyệt) → engine D.3 dùng.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.hr import (
    Employee, LaborContract, PayrollAdjustment,
)

logger = logging.getLogger("erp")
router = APIRouter(prefix="/api/hr/payroll-adjustments", tags=["hr-payroll-adjustments"])


# ─── Enum ───
SUB_LOAI_CONG_THEM = {
    "tang_thuong_sp":  "Tăng/thưởng sản phẩm",
    "boi_duong":       "Bồi dưỡng",
    "cong_nhat":       "Tiền công nhật",
    "pc_het_hang":     "Phụ cấp hết hàng",
    "pc_cong_doan":    "Phụ cấp công đoạn",
    "pc_may_hong":     "Phụ cấp máy hỏng",
    "pc_chuc_vu":      "Phụ cấp chức vụ",
    "pc_khac":         "Phụ cấp khác",
}
SUB_LOAI_KHAU_TRU = {
    "bhxh":            "BHXH (8%)",
    "bhyt":            "BHYT (1.5%)",
    "bhtn":            "BHTN (1%)",
    "tien_com":        "Tiền cơm",
    "tam_ung":         "Tạm ứng lương",
    "cong_doan_phi":   "Công đoàn phí",
    "phat":            "Phạt / Điều chỉnh khác",
}


# ─── Schemas ───
class AdjustmentBase(BaseModel):
    employee_id: int
    thang: int = Field(ge=1, le=12)
    nam: int = Field(ge=2020, le=2100)
    loai: str = Field(max_length=20)  # cong_them | khau_tru
    sub_loai: str = Field(max_length=30)
    so_tien: Decimal = Field(ge=0)
    ngay_phat_sinh: Optional[date] = None
    ghi_chu: Optional[str] = None


class AdjustmentCreate(AdjustmentBase):
    pass


class AdjustmentUpdate(BaseModel):
    so_tien: Optional[Decimal] = Field(default=None, ge=0)
    ngay_phat_sinh: Optional[date] = None
    ghi_chu: Optional[str] = None


class BulkRequest(BaseModel):
    items: list[AdjustmentCreate]


class AutoBHRequest(BaseModel):
    """Auto-tạo BHXH/BHYT/BHTN cho 1 tháng × bộ phận."""
    thang: int = Field(ge=1, le=12)
    nam: int = Field(ge=2020, le=2100)
    bo_phan_id: Optional[int] = None


# ─── Helpers ───
def _validate_loai_sub(loai: str, sub_loai: str) -> None:
    if loai == "cong_them" and sub_loai not in SUB_LOAI_CONG_THEM:
        raise HTTPException(400, f"sub_loai='{sub_loai}' không hợp lệ cho loai 'cong_them'")
    if loai == "khau_tru" and sub_loai not in SUB_LOAI_KHAU_TRU:
        raise HTTPException(400, f"sub_loai='{sub_loai}' không hợp lệ cho loai 'khau_tru'")
    if loai not in ("cong_them", "khau_tru"):
        raise HTTPException(400, "loai phải là cong_them hoặc khau_tru")


def _serialize(a: PayrollAdjustment) -> dict:
    emp = a.employee
    if a.loai == "cong_them":
        sub_label = SUB_LOAI_CONG_THEM.get(a.sub_loai, a.sub_loai)
    else:
        sub_label = SUB_LOAI_KHAU_TRU.get(a.sub_loai, a.sub_loai)
    return {
        "id": a.id,
        "employee_id": a.employee_id,
        "ma_nv": emp.ma_nv if emp else None,
        "ho_ten": emp.ho_ten if emp else None,
        "ten_bo_phan": emp.bo_phan.ten_bo_phan if emp and emp.bo_phan else None,
        "thang": a.thang, "nam": a.nam,
        "loai": a.loai, "sub_loai": a.sub_loai, "sub_loai_label": sub_label,
        "so_tien": float(a.so_tien or 0),
        "ngay_phat_sinh": a.ngay_phat_sinh.isoformat() if a.ngay_phat_sinh else None,
        "ghi_chu": a.ghi_chu,
        "trang_thai": a.trang_thai,
        "nguoi_duyet_id": a.nguoi_duyet_id,
        "ngay_duyet": a.ngay_duyet.isoformat() if a.ngay_duyet else None,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


# ─── Endpoints ───
@router.get("")
def list_adjustments(
    thang: Optional[int] = None,
    nam: Optional[int] = None,
    employee_id: Optional[int] = None,
    loai: Optional[str] = None,
    sub_loai: Optional[str] = None,
    bo_phan_id: Optional[int] = None,
    trang_thai: Optional[str] = None,
    limit: int = Query(default=500, ge=1, le=2000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List adjustments. NV thường chỉ xem được của chính mình."""
    from app.routers.hr import _role_code
    is_admin = _role_code(current_user) in ("ADMIN", "NHAN_SU", "GIAM_DOC", "BGD")
    q = db.query(PayrollAdjustment)
    if not is_admin:
        my_emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not my_emp:
            return []
        q = q.filter(PayrollAdjustment.employee_id == my_emp.id)
    elif employee_id:
        q = q.filter(PayrollAdjustment.employee_id == employee_id)

    if thang: q = q.filter(PayrollAdjustment.thang == thang)
    if nam: q = q.filter(PayrollAdjustment.nam == nam)
    if loai: q = q.filter(PayrollAdjustment.loai == loai)
    if sub_loai: q = q.filter(PayrollAdjustment.sub_loai == sub_loai)
    if trang_thai: q = q.filter(PayrollAdjustment.trang_thai == trang_thai)
    if bo_phan_id:
        q = q.join(Employee, Employee.id == PayrollAdjustment.employee_id) \
             .filter(Employee.bo_phan_id == bo_phan_id)

    items = q.order_by(PayrollAdjustment.created_at.desc()).limit(limit).all()
    return [_serialize(a) for a in items]


@router.get("/summary")
def summary(
    thang: int, nam: int,
    bo_phan_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "NHAN_SU", "GIAM_DOC", "BGD")),
):
    """Tổng hợp adjustments tháng — cho dashboard payroll."""
    q = db.query(PayrollAdjustment).filter(
        PayrollAdjustment.thang == thang,
        PayrollAdjustment.nam == nam,
        PayrollAdjustment.trang_thai == "da_duyet",
    )
    if bo_phan_id:
        q = q.join(Employee, Employee.id == PayrollAdjustment.employee_id) \
             .filter(Employee.bo_phan_id == bo_phan_id)
    items = q.all()

    by_sub_loai: dict[str, dict] = {}
    total_cong_them = 0.0
    total_khau_tru = 0.0
    for a in items:
        amount = float(a.so_tien or 0)
        if a.loai == "cong_them":
            total_cong_them += amount
            label = SUB_LOAI_CONG_THEM.get(a.sub_loai, a.sub_loai)
        else:
            total_khau_tru += amount
            label = SUB_LOAI_KHAU_TRU.get(a.sub_loai, a.sub_loai)
        if a.sub_loai not in by_sub_loai:
            by_sub_loai[a.sub_loai] = {
                "sub_loai": a.sub_loai, "label": label, "loai": a.loai,
                "tong": 0, "so_record": 0,
            }
        by_sub_loai[a.sub_loai]["tong"] += amount
        by_sub_loai[a.sub_loai]["so_record"] += 1

    pending = db.query(func.count(PayrollAdjustment.id)).filter(
        PayrollAdjustment.thang == thang,
        PayrollAdjustment.nam == nam,
        PayrollAdjustment.trang_thai == "du_thao",
    ).scalar() or 0

    return {
        "ky": f"{thang:02d}/{nam}",
        "total_cong_them": total_cong_them,
        "total_khau_tru": total_khau_tru,
        "rong": total_cong_them - total_khau_tru,
        "so_record_da_duyet": len(items),
        "so_record_cho_duyet": pending,
        "by_sub_loai": sorted(by_sub_loai.values(), key=lambda x: (x["loai"], -x["tong"])),
    }


@router.post("")
def create_adjustment(
    body: AdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    if not db.get(Employee, body.employee_id):
        raise HTTPException(400, "employee_id không tồn tại")
    _validate_loai_sub(body.loai, body.sub_loai)
    a = PayrollAdjustment(**body.model_dump(), created_by_id=current_user.id)
    db.add(a)
    db.commit()
    db.refresh(a)
    logger.info("Payroll adj created id=%s emp=%s %s/%s by user=%s",  # không log so_tien (PII)
                a.id, body.employee_id, body.loai, body.sub_loai, current_user.id)
    return _serialize(a)


@router.post("/bulk")
def bulk_create(
    body: BulkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    if len(body.items) > 1000:
        raise HTTPException(400, f"Tối đa 1000/lần. Hiện gửi {len(body.items)}.")
    emp_ids = {e.id for e in db.query(Employee.id).all()}
    created = 0
    errors: list[str] = []
    for idx, item in enumerate(body.items):
        try:
            if item.employee_id not in emp_ids:
                errors.append(f"Dòng {idx+1}: employee_id={item.employee_id} không tồn tại")
                continue
            _validate_loai_sub(item.loai, item.sub_loai)
            db.add(PayrollAdjustment(**item.model_dump(), created_by_id=current_user.id))
            created += 1
        except HTTPException as exc:
            errors.append(f"Dòng {idx+1}: {exc.detail}")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"Dòng {idx+1}: {exc}")
    # P2 FIX: atomic — nếu commit fail thì created phải = 0
    try:
        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        logger.error("Payroll adj bulk commit failed: %s", exc)
        return {"created": 0, "errors": [*errors[:50], f"Commit fail: {exc}"]}
    logger.info("Payroll adj bulk created=%s errors=%s by user=%s",
                created, len(errors), current_user.id)
    return {"created": created, "errors": errors[:50]}


@router.put("/{id}")
def update_adjustment(
    id: int, body: AdjustmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    """Lưu ý: không cho phép đổi loai/sub_loai (xóa và tạo lại). Schema chỉ cho sửa so_tien/ngày/ghi_chu.

    P0 FIX: nếu sửa so_tien của record đã duyệt → tự động REVERT về du_thao
    + clear nguoi_duyet để buộc duyệt lại (chống bypass 4-eyes).
    """
    a = db.get(PayrollAdjustment, id)
    if not a:
        raise HTTPException(404, "Không tìm thấy")
    if a.trang_thai == "da_duyet":
        from app.routers.hr import _role_code
        if _role_code(current_user) != "ADMIN":
            raise HTTPException(403, "Đã duyệt, chỉ ADMIN mới sửa được")
    data = body.model_dump(exclude_unset=True)
    # Whitelist explicit (chống mass-assign nếu schema mở rộng sau này)
    ALLOWED = {"so_tien", "ngay_phat_sinh", "ghi_chu"}
    is_money_change = "so_tien" in data and a.trang_thai == "da_duyet" and data["so_tien"] != a.so_tien
    for k, v in data.items():
        if k in ALLOWED:
            setattr(a, k, v)
    # Buộc duyệt lại nếu số tiền đã duyệt bị sửa
    if is_money_change:
        a.trang_thai = "du_thao"
        a.nguoi_duyet_id = None
        a.ngay_duyet = None
        logger.info("Payroll adj %s reverted to du_thao after amount change by user=%s",
                    id, current_user.id)
    db.commit()
    db.refresh(a)
    logger.info("Payroll adj updated id=%s loai=%s by user=%s",
                id, a.loai, current_user.id)  # không log so_tien (PII)
    return _serialize(a)


@router.put("/{id}/approve")
def approve_adjustment(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU", "GIAM_DOC", "BGD")),
):
    """Duyệt 1 adjustment → engine sẽ dùng. Nguyên tắc 4-mắt: người tạo không tự duyệt được."""
    a = db.get(PayrollAdjustment, id)
    if not a:
        raise HTTPException(404, "Không tìm thấy")
    if a.trang_thai == "da_duyet":
        raise HTTPException(400, "Đã duyệt trước đó")
    # 4-eyes principle
    from app.routers.hr import _role_code
    if a.created_by_id == current_user.id and _role_code(current_user) != "ADMIN":
        raise HTTPException(403, "Không thể tự duyệt khoản do chính mình tạo (4-eyes principle)")
    a.trang_thai = "da_duyet"
    a.nguoi_duyet_id = current_user.id
    a.ngay_duyet = datetime.now(timezone.utc)
    db.commit()
    db.refresh(a)
    logger.info("Payroll adj approved id=%s by user=%s", id, current_user.id)
    return _serialize(a)


@router.delete("/{id}")
def delete_adjustment(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    a = db.get(PayrollAdjustment, id)
    if not a:
        raise HTTPException(404, "Không tìm thấy")
    if a.trang_thai == "da_duyet":
        from app.routers.hr import _role_code
        if _role_code(current_user) != "ADMIN":
            raise HTTPException(403, "Đã duyệt, chỉ ADMIN xóa được")
    db.delete(a)
    db.commit()
    return {"ok": True}


@router.post("/auto-generate-bh")
def auto_generate_bhxh(
    body: AutoBHRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    """Tự sinh 3 khoản BHXH/BHYT/BHTN cho mọi NV đang làm việc trong tháng.

    Theo luật:
    - BHXH NV đóng = 8% × Lương BHXH HĐLĐ
    - BHYT NV đóng = 1.5% × Lương BHXH HĐLĐ
    - BHTN NV đóng = 1% × Lương BHXH HĐLĐ
    Lương BHXH lấy từ HĐLĐ còn hiệu lực (LaborContract.luong_co_ban),
    fallback Employee.muc_dong_bhxh nếu HĐ không có.
    """
    emp_q = db.query(Employee).filter(Employee.trang_thai == "dang_lam")
    if body.bo_phan_id:
        emp_q = emp_q.filter(Employee.bo_phan_id == body.bo_phan_id)
    employees = emp_q.all()

    # P1 FIX: cap 500 NV/lần chống DoS
    if len(employees) > 500:
        raise HTTPException(
            400,
            f"Quá nhiều NV ({len(employees)}). Hãy chia nhỏ theo bộ phận (cap 500/lần).",
        )

    # P1 FIX: pre-fetch tất cả existing records 1 query (chống N+1)
    existing_keys: set[tuple[int, str]] = {
        (a.employee_id, a.sub_loai) for a in db.query(
            PayrollAdjustment.employee_id, PayrollAdjustment.sub_loai,
        ).filter(
            PayrollAdjustment.thang == body.thang,
            PayrollAdjustment.nam == body.nam,
            PayrollAdjustment.loai == "khau_tru",
            PayrollAdjustment.sub_loai.in_(["bhxh", "bhyt", "bhtn"]),
        ).all()
    }

    created = 0
    skipped = 0
    no_wage_count = 0
    errors: list[str] = []

    BH_PERCENTAGES = [
        ("bhxh", Decimal("0.08")),
        ("bhyt", Decimal("0.015")),
        ("bhtn", Decimal("0.01")),
    ]

    for emp in employees:
        # Xác định lương BHXH: ưu tiên HĐ còn hiệu lực
        luong_bhxh = None
        active_contracts = [c for c in emp.contracts if c.trang_thai == "hieu_luc"]
        if active_contracts:
            latest = sorted(active_contracts, key=lambda c: c.ngay_hieu_luc or c.ngay_ky, reverse=True)[0]
            if latest.luong_co_ban and latest.luong_co_ban > 0:
                luong_bhxh = latest.luong_co_ban
        if not luong_bhxh and emp.muc_dong_bhxh and emp.muc_dong_bhxh > 0:
            luong_bhxh = emp.muc_dong_bhxh
        if not luong_bhxh:
            no_wage_count += 1
            continue

        for sub_loai, pct in BH_PERCENTAGES:
            if (emp.id, sub_loai) in existing_keys:
                skipped += 1
                continue

            so_tien = (luong_bhxh * pct).quantize(Decimal("0.01"))
            db.add(PayrollAdjustment(
                employee_id=emp.id,
                thang=body.thang, nam=body.nam,
                loai="khau_tru", sub_loai=sub_loai, so_tien=so_tien,
                ghi_chu=f"Auto-tính theo lương BHXH × {pct*100}%",  # không log số tiền lương
                trang_thai="du_thao",  # HR cần duyệt
                created_by_id=current_user.id,
            ))
            existing_keys.add((emp.id, sub_loai))  # tránh duplicate trong cùng batch
            created += 1

    try:
        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        logger.error("Payroll auto-gen BH commit failed: %s", exc)
        raise HTTPException(500, "Lỗi khi lưu — vui lòng thử lại")

    logger.info("Payroll auto-gen BH: created=%s skipped=%s no_wage=%s by user=%s",
                created, skipped, no_wage_count, current_user.id)
    return {
        "created": created,
        "skipped": skipped,
        "no_wage_count": no_wage_count,
        "errors": errors,
        "message": (
            f"Đã tạo {created} khoản BH (đã skip {skipped} đã tồn tại). "
            + (f"⚠ {no_wage_count} NV không có lương BHXH HĐ — bỏ qua." if no_wage_count else "")
        ),
    }


@router.get("/enum")
def list_enum(_: User = Depends(get_current_user)):
    """List enum cho frontend dropdown."""
    return {
        "cong_them": [{"value": k, "label": v} for k, v in SUB_LOAI_CONG_THEM.items()],
        "khau_tru": [{"value": k, "label": v} for k, v in SUB_LOAI_KHAU_TRU.items()],
    }
