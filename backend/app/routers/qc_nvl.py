from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.master import OtherMaterial, TieuChuanKyThuat
from app.models.quality import QCNvlPhieu
from app.schemas.quality import (
    QCNvlCreate,
    QCNvlResponse,
    QCNvlStatsResponse,
    QCNvlUpdate,
)

router = APIRouter(prefix="/api/qc-nvl", tags=["QC NVL"])


# ── Helpers ──────────────────────────────────────────────────────────────────

def _next_so_phieu(db: Session) -> str:
    today = date.today().strftime("%Y%m%d")
    prefix = f"QCNVL-{today}-"
    last = (
        db.query(QCNvlPhieu)
        .filter(QCNvlPhieu.so_phieu.like(f"{prefix}%"))
        .order_by(QCNvlPhieu.id.desc())
        .first()
    )
    seq = int(last.so_phieu.split("-")[-1]) + 1 if last else 1
    return f"{prefix}{seq:03d}"


def _calc_nvl_result(items_json: list | None) -> str | None:
    """Tổng hợp ket_qua từ items_json: dat nếu tất cả chỉ tiêu bắt buộc đạt."""
    if not items_json:
        return None
    filled = [item for item in items_json if item.get("ket_qua") is not None]
    if not filled:
        return None
    return "dat" if all(item["ket_qua"] == "dat" for item in filled) else "khong_dat"


def _enrich(phieu: QCNvlPhieu, db: Session) -> QCNvlResponse:
    data = QCNvlResponse.model_validate(phieu)
    om = db.get(OtherMaterial, phieu.other_material_id)
    if om:
        data.other_material_ma = om.ma_chinh
        data.other_material_ten = om.ten
        if om.ncc:
            data.ncc_ten = om.ncc.ten_nha_cung_cap
    if phieu.tieu_chuan_id:
        tc = db.get(TieuChuanKyThuat, phieu.tieu_chuan_id)
        if tc:
            data.tieu_chuan_ten = tc.ten
    return data


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/tieu-chuan/{other_material_id}")
def get_tieu_chuan(
    other_material_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Lấy tiêu chuẩn của một loại NVL để pre-fill form kiểm tra."""
    om = db.get(OtherMaterial, other_material_id)
    if not om:
        raise HTTPException(404, "Không tìm thấy NVL")
    result = {
        "ma_vt": om.ma_chinh,
        "ten_vt": om.ten,
        "tieu_chuan_id": om.tieu_chuan_id,
        "chi_tieu_list": None,
    }
    if om.tieu_chuan_id:
        tc = db.get(TieuChuanKyThuat, om.tieu_chuan_id)
        if tc:
            result["tieu_chuan_ma"] = tc.ma_tc
            result["tieu_chuan_ten"] = tc.ten
            result["chi_tieu_list"] = tc.chi_tieu_list or []
    return result


@router.get("/stats", response_model=QCNvlStatsResponse)
def get_stats(
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    other_material_id: Optional[int] = Query(None),
    goods_receipt_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    q = db.query(QCNvlPhieu)
    if tu_ngay:
        q = q.filter(QCNvlPhieu.ngay_kiem_tra >= tu_ngay)
    if den_ngay:
        q = q.filter(QCNvlPhieu.ngay_kiem_tra <= den_ngay)
    if other_material_id:
        q = q.filter(QCNvlPhieu.other_material_id == other_material_id)
    if goods_receipt_id:
        q = q.filter(QCNvlPhieu.goods_receipt_id == goods_receipt_id)

    rows = q.all()
    tong = len(rows)
    dat = sum(1 for r in rows if r.ket_qua == "dat")
    khong_dat = sum(1 for r in rows if r.ket_qua == "khong_dat")
    chua = tong - dat - khong_dat
    return QCNvlStatsResponse(
        tong=tong,
        dat=dat,
        khong_dat=khong_dat,
        chua_co_ket_qua=chua,
        ty_le_dat_pct=round(dat / tong * 100, 1) if tong else 0.0,
    )


@router.get("", response_model=List[QCNvlResponse])
def list_phieu(
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    other_material_id: Optional[int] = Query(None),
    goods_receipt_id: Optional[int] = Query(None),
    ket_qua: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    q = db.query(QCNvlPhieu).order_by(QCNvlPhieu.id.desc())
    if tu_ngay:
        q = q.filter(QCNvlPhieu.ngay_kiem_tra >= tu_ngay)
    if den_ngay:
        q = q.filter(QCNvlPhieu.ngay_kiem_tra <= den_ngay)
    if other_material_id:
        q = q.filter(QCNvlPhieu.other_material_id == other_material_id)
    if goods_receipt_id:
        q = q.filter(QCNvlPhieu.goods_receipt_id == goods_receipt_id)
    if ket_qua:
        q = q.filter(QCNvlPhieu.ket_qua == ket_qua)
    rows = q.offset(skip).limit(limit).all()
    return [_enrich(r, db) for r in rows]


@router.post("", response_model=QCNvlResponse, status_code=201)
def create_phieu(
    body: QCNvlCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("SAN_XUAT_GIAM_SAT", "BGD_GIAM_DOC", "ADMIN")),
):
    om = db.get(OtherMaterial, body.other_material_id)
    if not om:
        raise HTTPException(404, "Không tìm thấy NVL")

    # Snapshot tiêu chuẩn tại thời điểm kiểm tra
    tc_snapshot = None
    tieu_chuan_id = body.tieu_chuan_id or om.tieu_chuan_id
    if tieu_chuan_id:
        tc = db.get(TieuChuanKyThuat, tieu_chuan_id)
        if tc:
            tc_snapshot = tc.chi_tieu_list

    items = [item.model_dump() for item in body.items_json] if body.items_json else None
    ket_qua = _calc_nvl_result(items)

    obj = QCNvlPhieu(
        so_phieu=_next_so_phieu(db),
        other_material_id=body.other_material_id,
        goods_receipt_id=body.goods_receipt_id,
        ngay_kiem_tra=body.ngay_kiem_tra,
        nguoi_kiem_tra=body.nguoi_kiem_tra,
        tieu_chuan_id=tieu_chuan_id,
        tc_snapshot_json=tc_snapshot,
        items_json=items,
        ket_qua=ket_qua,
        ghi_chu=body.ghi_chu,
        phap_nhan_id=body.phap_nhan_id,
        created_by=user.id,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _enrich(obj, db)


@router.get("/{id}", response_model=QCNvlResponse)
def get_phieu(
    id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    obj = db.get(QCNvlPhieu, id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy phiếu")
    return _enrich(obj, db)


@router.patch("/{id}", response_model=QCNvlResponse)
def update_phieu(
    id: int,
    body: QCNvlUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles("SAN_XUAT_GIAM_SAT", "BGD_GIAM_DOC", "ADMIN", "NHAN_SU_TO_TRUONG")),
):
    obj = db.get(QCNvlPhieu, id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy phiếu")

    update_data = body.model_dump(exclude_unset=True)

    if "items_json" in update_data and update_data["items_json"] is not None:
        update_data["items_json"] = [
            item.model_dump() if hasattr(item, "model_dump") else item
            for item in update_data["items_json"]
        ]
        update_data["ket_qua"] = _calc_nvl_result(update_data["items_json"])

    for k, v in update_data.items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return _enrich(obj, db)


@router.delete("/{id}", status_code=204)
def delete_phieu(
    id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles("SAN_XUAT_GIAM_SAT", "BGD_GIAM_DOC", "ADMIN")),
):
    obj = db.get(QCNvlPhieu, id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy phiếu")
    db.delete(obj)
    db.commit()
