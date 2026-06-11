"""Router: Sản lượng tháng (Sprint D.2).

CRUD bảng sản lượng theo mã hàng × tổ × ca × ngày.
Đầu vào cho engine tính lương sản phẩm (Sprint D.3).

Workflow:
  cho_xac_nhan (HR nhập) → da_xac_nhan (Quản lý duyệt) → engine tính lương dùng
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.hr import (
    Department, Employee, PayrollConfig, ProductionOutput, Team,
)

logger = logging.getLogger("erp")
router = APIRouter(prefix="/api/hr/production-outputs", tags=["hr-production"])


# ─── Schemas ───
class ProductionOutputBase(BaseModel):
    ngay: date
    ma_hang: str = Field(min_length=1, max_length=50)
    bo_phan_id: Optional[int] = None
    to_id: Optional[int] = None
    ca: str = Field(default="all", max_length=20)  # sang | chieu | dem | all
    san_luong: Decimal = Field(ge=0)
    san_luong_loi: Decimal = Field(default=Decimal(0), ge=0)
    ghi_chu: Optional[str] = None

    @model_validator(mode="after")
    def _check_loi_lte_sl(self):
        """Business rule: sản lượng lỗi không thể lớn hơn sản lượng hợp lệ."""
        if self.san_luong_loi > self.san_luong:
            raise ValueError(f"Sản lượng lỗi ({self.san_luong_loi}) không thể > sản lượng hợp lệ ({self.san_luong})")
        return self


class ProductionOutputCreate(ProductionOutputBase):
    pass


class ProductionOutputUpdate(BaseModel):
    ngay: Optional[date] = None
    ma_hang: Optional[str] = Field(default=None, min_length=1, max_length=50)
    bo_phan_id: Optional[int] = None
    to_id: Optional[int] = None
    ca: Optional[str] = Field(default=None, max_length=20)
    san_luong: Optional[Decimal] = Field(default=None, ge=0)
    san_luong_loi: Optional[Decimal] = Field(default=None, ge=0)
    ghi_chu: Optional[str] = None


class BulkCreateRequest(BaseModel):
    items: list[ProductionOutputCreate]


# ─── Helpers ───
def _serialize(o: ProductionOutput, price_cache: dict, show_price: bool = True) -> dict:
    """Trả dict. Khi `show_price=False` (user thường) ẩn đơn giá + quỹ lương ước tính (lương SP nhạy cảm)."""
    cfg = price_cache.get(o.ma_hang)
    quy_luong_uoc_tinh = 0.0
    if cfg and show_price:
        net = float(o.san_luong or 0)
        don_gia = float(cfg.don_gia or 0)
        pct = float(cfg.phan_tram_luong_sp or 100) / 100
        quy_luong_uoc_tinh = net * don_gia * pct
    base = {
        "id": o.id,
        "ngay": o.ngay.isoformat() if o.ngay else None,
        "ma_hang": o.ma_hang,
        "ten_hang": cfg.ten_hang if cfg else None,
        "bo_phan_id": o.bo_phan_id,
        "ten_bo_phan": o.bo_phan.ten_bo_phan if o.bo_phan else None,
        "to_id": o.to_id,
        "ten_to": o.to_nhom.ten_to if o.to_nhom else None,
        "ca": o.ca,
        "san_luong": float(o.san_luong or 0),
        "san_luong_loi": float(o.san_luong_loi or 0),
        "trang_thai": o.trang_thai,
        "nguoi_xac_nhan_id": o.nguoi_xac_nhan_id,
        "ngay_xac_nhan": o.ngay_xac_nhan.isoformat() if o.ngay_xac_nhan else None,
        "ghi_chu": o.ghi_chu,
        "created_at": o.created_at.isoformat() if o.created_at else None,
    }
    if show_price:
        base["don_gia"] = float(cfg.don_gia or 0) if cfg else 0
        base["pct_luong_sp"] = float(cfg.phan_tram_luong_sp or 100) if cfg else 100
        base["quy_luong_uoc_tinh"] = quy_luong_uoc_tinh
    return base


def _is_hr_admin(user: User) -> bool:
    from app.routers.hr import _role_code
    return _role_code(user) in ("ADMIN", "NHAN_SU", "GIAM_DOC", "BGD")


def _price_cache(db: Session) -> dict:
    """Cache đơn giá theo mã hàng."""
    return {
        c.ma_hang: c for c in
        db.query(PayrollConfig).filter(PayrollConfig.loai == "san_pham").all()
        if c.ma_hang
    }


# ─── Endpoints ───
@router.get("")
def list_outputs(
    nam: Optional[int] = None,
    thang: Optional[int] = None,
    ma_hang: Optional[str] = None,
    bo_phan_id: Optional[int] = None,
    to_id: Optional[int] = None,
    trang_thai: Optional[str] = None,
    limit: int = Query(default=500, ge=1, le=2000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(ProductionOutput)
    if nam and thang:
        from calendar import monthrange
        start = date(nam, thang, 1)
        end = date(nam, thang, monthrange(nam, thang)[1])
        q = q.filter(ProductionOutput.ngay.between(start, end))
    elif nam:
        q = q.filter(ProductionOutput.ngay.between(date(nam, 1, 1), date(nam, 12, 31)))
    if ma_hang:
        q = q.filter(ProductionOutput.ma_hang == ma_hang)
    if bo_phan_id:
        q = q.filter(ProductionOutput.bo_phan_id == bo_phan_id)
    if to_id:
        q = q.filter(ProductionOutput.to_id == to_id)
    if trang_thai:
        q = q.filter(ProductionOutput.trang_thai == trang_thai)
    items = q.order_by(ProductionOutput.ngay.desc(), ProductionOutput.id.desc()).limit(limit).all()
    cache = _price_cache(db)
    show_price = _is_hr_admin(current_user)
    return [_serialize(o, cache, show_price=show_price) for o in items]


@router.get("/summary")
def summary(
    nam: int,
    thang: int,
    bo_phan_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "NHAN_SU", "GIAM_DOC", "BGD")),
):
    """Tổng hợp sản lượng + quỹ lương SP tháng (dùng cho engine D.3)."""
    from calendar import monthrange
    start = date(nam, thang, 1)
    end = date(nam, thang, monthrange(nam, thang)[1])

    q = db.query(ProductionOutput).filter(
        ProductionOutput.ngay.between(start, end),
        ProductionOutput.trang_thai == "da_xac_nhan",
    )
    if bo_phan_id:
        q = q.filter(ProductionOutput.bo_phan_id == bo_phan_id)
    items = q.all()

    cache = _price_cache(db)
    total_sl = 0.0
    total_sl_loi = 0.0
    total_quy_luong = 0.0
    so_ngay = set()
    by_ma_hang: dict[str, dict] = {}
    by_bo_phan: dict[str, dict] = {}
    pending_count = db.query(func.count(ProductionOutput.id)).filter(
        ProductionOutput.ngay.between(start, end),
        ProductionOutput.trang_thai == "cho_xac_nhan",
    ).scalar() or 0

    for o in items:
        sl = float(o.san_luong or 0)
        sl_loi = float(o.san_luong_loi or 0)
        cfg = cache.get(o.ma_hang)
        quy_luong = 0.0
        if cfg:
            quy_luong = sl * float(cfg.don_gia or 0) * float(cfg.phan_tram_luong_sp or 100) / 100

        total_sl += sl
        total_sl_loi += sl_loi
        total_quy_luong += quy_luong
        so_ngay.add(o.ngay)

        # By ma_hang
        if o.ma_hang not in by_ma_hang:
            by_ma_hang[o.ma_hang] = {
                "ma_hang": o.ma_hang,
                "ten_hang": cfg.ten_hang if cfg else None,
                "san_luong": 0, "san_luong_loi": 0, "quy_luong": 0,
            }
        by_ma_hang[o.ma_hang]["san_luong"] += sl
        by_ma_hang[o.ma_hang]["san_luong_loi"] += sl_loi
        by_ma_hang[o.ma_hang]["quy_luong"] += quy_luong

        # By bộ phận
        bp_key = o.bo_phan.ten_bo_phan if o.bo_phan else "(Không gán BP)"
        if bp_key not in by_bo_phan:
            by_bo_phan[bp_key] = {"ten_bo_phan": bp_key, "san_luong": 0, "quy_luong": 0}
        by_bo_phan[bp_key]["san_luong"] += sl
        by_bo_phan[bp_key]["quy_luong"] += quy_luong

    return {
        "ky": f"{thang:02d}/{nam}",
        "tu_ngay": start.isoformat(),
        "den_ngay": end.isoformat(),
        "tong_san_luong": total_sl,
        "tong_san_luong_loi": total_sl_loi,
        "tong_quy_luong_sp": total_quy_luong,
        "so_ngay_co_sl": len(so_ngay),
        "so_record_da_xac_nhan": len(items),
        "so_record_cho_xac_nhan": pending_count,
        "by_ma_hang": sorted(by_ma_hang.values(), key=lambda x: -x["quy_luong"]),
        "by_bo_phan": sorted(by_bo_phan.values(), key=lambda x: -x["quy_luong"]),
    }


@router.post("")
def create_output(
    body: ProductionOutputCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    # Validate mã hàng tồn tại
    cfg = db.query(PayrollConfig).filter(
        PayrollConfig.loai == "san_pham", PayrollConfig.ma_hang == body.ma_hang,
    ).first()
    if not cfg:
        raise HTTPException(400, f"Mã hàng '{body.ma_hang}' không tồn tại trong bảng đơn giá")
    if body.bo_phan_id and not db.get(Department, body.bo_phan_id):
        raise HTTPException(400, "bo_phan_id không tồn tại")
    if body.to_id and not db.get(Team, body.to_id):
        raise HTTPException(400, "to_id không tồn tại")
    if body.ca not in ("sang", "chieu", "dem", "all"):
        raise HTTPException(400, "ca phải là sang/chieu/dem/all")

    o = ProductionOutput(**body.model_dump(), created_by_id=current_user.id)
    db.add(o)
    db.commit()
    db.refresh(o)
    logger.info("HR production_output created id=%s ngay=%s ma_hang=%s by user=%s",
                o.id, body.ngay, body.ma_hang, current_user.id)
    return _serialize(o, _price_cache(db))


@router.post("/bulk")
def bulk_create(
    body: BulkCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    """Import nhiều record cùng lúc — cap 1000/lần."""
    if len(body.items) > 1000:
        raise HTTPException(400, f"Tối đa 1000/lần. Hiện gửi {len(body.items)}.")
    cfg_codes = {
        c.ma_hang for c in
        db.query(PayrollConfig.ma_hang).filter(PayrollConfig.loai == "san_pham").all()
        if c.ma_hang
    }
    # P1 FIX: validate FK trước khi bulk insert để tránh orphan
    dept_ids = {d.id for d in db.query(Department.id).all()}
    team_ids = {t.id for t in db.query(Team.id).all()}

    created = 0
    errors: list[str] = []
    for idx, item in enumerate(body.items):
        if item.ma_hang not in cfg_codes:
            errors.append(f"Dòng {idx+1}: mã hàng '{item.ma_hang}' không tồn tại")
            continue
        if item.ca not in ("sang", "chieu", "dem", "all"):
            errors.append(f"Dòng {idx+1}: ca '{item.ca}' không hợp lệ")
            continue
        if item.bo_phan_id is not None and item.bo_phan_id not in dept_ids:
            errors.append(f"Dòng {idx+1}: bo_phan_id={item.bo_phan_id} không tồn tại")
            continue
        if item.to_id is not None and item.to_id not in team_ids:
            errors.append(f"Dòng {idx+1}: to_id={item.to_id} không tồn tại")
            continue
        db.add(ProductionOutput(**item.model_dump(), created_by_id=current_user.id))
        created += 1
    db.commit()
    logger.info("HR production_output bulk created=%s errors=%s by user=%s",
                created, len(errors), current_user.id)
    return {"created": created, "errors": errors[:50]}


@router.put("/{id}")
def update_output(
    id: int, body: ProductionOutputUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    o = db.get(ProductionOutput, id)
    if not o:
        raise HTTPException(404, "Không tìm thấy")
    if o.trang_thai == "da_xac_nhan":
        # Chỉ ADMIN mới sửa được sau khi đã xác nhận
        from app.routers.hr import _role_code
        if _role_code(current_user) != "ADMIN":
            raise HTTPException(403, "Sản lượng đã xác nhận, chỉ ADMIN mới sửa được")
    data = body.model_dump(exclude_unset=True)
    if "ma_hang" in data:
        cfg = db.query(PayrollConfig).filter(
            PayrollConfig.loai == "san_pham", PayrollConfig.ma_hang == data["ma_hang"],
        ).first()
        if not cfg:
            raise HTTPException(400, f"Mã hàng '{data['ma_hang']}' không tồn tại")
    for k, v in data.items():
        setattr(o, k, v)
    db.commit()
    db.refresh(o)
    logger.info("HR production_output updated id=%s by user=%s", id, current_user.id)
    return _serialize(o, _price_cache(db))


@router.put("/{id}/confirm")
def confirm_output(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    """Quản lý xác nhận sản lượng → sẵn sàng tính lương."""
    o = db.get(ProductionOutput, id)
    if not o:
        raise HTTPException(404, "Không tìm thấy")
    if o.trang_thai == "da_xac_nhan":
        raise HTTPException(400, "Đã xác nhận trước đó")
    # P0 FIX: nguyên tắc 4-mắt — người tạo không tự xác nhận được (trừ ADMIN)
    from app.routers.hr import _role_code
    if o.created_by_id == current_user.id and _role_code(current_user) != "ADMIN":
        raise HTTPException(403, "Bạn không thể tự xác nhận sản lượng do chính mình tạo (4-eyes principle)")
    o.trang_thai = "da_xac_nhan"
    o.nguoi_xac_nhan_id = current_user.id
    o.ngay_xac_nhan = datetime.now(timezone.utc)
    db.commit()
    db.refresh(o)
    logger.info("HR production_output confirmed id=%s by user=%s", id, current_user.id)
    return _serialize(o, _price_cache(db))


@router.delete("/{id}")
def delete_output(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    o = db.get(ProductionOutput, id)
    if not o:
        raise HTTPException(404, "Không tìm thấy")
    if o.trang_thai == "da_xac_nhan":
        from app.routers.hr import _role_code
        if _role_code(current_user) != "ADMIN":
            raise HTTPException(403, "Đã xác nhận, chỉ ADMIN xóa được")
    db.delete(o)
    db.commit()
    logger.info("HR production_output deleted id=%s by user=%s", id, current_user.id)
    return {"ok": True}
