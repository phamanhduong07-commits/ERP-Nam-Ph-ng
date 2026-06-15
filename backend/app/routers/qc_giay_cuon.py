from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.master import PaperMaterial, TieuChuanKyThuat
from app.models.quality import QCGiayCuonPhieu
from app.services.qc_calc_engine import calc_paper_qc_results
from app.schemas.quality import (
    QCGiayCuonCreate,
    QCGiayCuonResponse,
    QCGiayCuonStatsResponse,
    QCGiayCuonUpdate,
)

router = APIRouter(prefix="/api/qc-giay-cuon", tags=["QC Giấy Cuộn"])


# ── Helpers ──────────────────────────────────────────────────────────────────

def _next_so_phieu(db: Session) -> str:
    today = date.today().strftime("%Y%m%d")
    prefix = f"QCGC-{today}-"
    last = (
        db.query(QCGiayCuonPhieu)
        .filter(QCGiayCuonPhieu.so_phieu.like(f"{prefix}%"))
        .order_by(QCGiayCuonPhieu.id.desc())
        .first()
    )
    seq = int(last.so_phieu.split("-")[-1]) + 1 if last else 1
    return f"{prefix}{seq:03d}"


def _calc_results(obj: QCGiayCuonPhieu) -> None:
    """Tính TB và kết quả pass/fail cho tất cả chỉ tiêu, ghi thẳng vào obj."""
    calc_paper_qc_results(obj)


def _enrich(phieu: QCGiayCuonPhieu, db: Session) -> QCGiayCuonResponse:
    """Gắn tên paper_material và NCC vào response."""
    data = QCGiayCuonResponse.model_validate(phieu)
    pm = db.get(PaperMaterial, phieu.paper_material_id)
    if pm:
        data.paper_material_ma = pm.ma_chinh
        data.paper_material_ten = pm.ten
        if pm.nsx:
            data.ncc_ten = pm.nsx.ten_nha_cung_cap
    return data


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/tieu-chuan/{paper_material_id}")
def get_tieu_chuan(
    paper_material_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Lấy tiêu chuẩn của một loại giấy để hiển thị trong form QC.
    Ưu tiên đọc từ TieuChuanKyThuat (nguồn chính), fallback về paper direct fields.
    """
    pm = db.get(PaperMaterial, paper_material_id)
    if not pm:
        raise HTTPException(404, "Không tìm thấy mã nguyên vật liệu")

    # Nguồn 1: TieuChuanKyThuat (ưu tiên — single source of truth)
    tc = db.get(TieuChuanKyThuat, pm.tieu_chuan_id) if pm.tieu_chuan_id else None

    dinh_luong_tc = (float(tc.tc_dinh_luong) if tc and tc.tc_dinh_luong is not None
                     else (float(pm.tieu_chuan_dinh_luong) if pm.tieu_chuan_dinh_luong is not None
                           else (float(pm.dinh_luong) if pm.dinh_luong is not None else None)))
    sai_so_pct = (float(tc.tc_sai_so_pct) if tc and tc.tc_sai_so_pct is not None
                  else (float(pm.sai_so_pct) if pm.sai_so_pct is not None else None))
    do_buc = (float(tc.tc_do_buc) if tc and tc.tc_do_buc is not None
              else (float(pm.do_buc_tieu_chuan) if pm.do_buc_tieu_chuan is not None else None))
    do_nen_vong = (float(tc.tc_do_nen_vong) if tc and tc.tc_do_nen_vong is not None
                   else (float(pm.do_nen_vong_tc) if pm.do_nen_vong_tc is not None else None))

    return {
        "ma_chinh": pm.ma_chinh,
        "ten": pm.ten,
        "kho": float(pm.kho) if pm.kho is not None else None,
        "dinh_luong": float(pm.dinh_luong) if pm.dinh_luong is not None else None,
        "tieu_chuan_id": pm.tieu_chuan_id,
        "ten_tieu_chuan": tc.ten if tc else None,
        "chi_tieu_list": tc.chi_tieu_list if tc else None,
        "sai_so_pct": sai_so_pct,
        "do_buc_tieu_chuan": do_buc,
        "do_nen_vong_tc": do_nen_vong,
        "tc_dinh_luong": dinh_luong_tc,
    }


@router.get("/stats", response_model=QCGiayCuonStatsResponse)
def get_stats(
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    paper_material_id: Optional[int] = Query(None),
    goods_receipt_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    q = db.query(QCGiayCuonPhieu)
    if tu_ngay:
        q = q.filter(QCGiayCuonPhieu.ngay_kiem_tra >= tu_ngay)
    if den_ngay:
        q = q.filter(QCGiayCuonPhieu.ngay_kiem_tra <= den_ngay)
    if paper_material_id:
        q = q.filter(QCGiayCuonPhieu.paper_material_id == paper_material_id)
    if goods_receipt_id:
        q = q.filter(QCGiayCuonPhieu.goods_receipt_id == goods_receipt_id)

    rows = q.all()
    tong = len(rows)
    dat = sum(1 for r in rows if r.ket_qua == "dat")
    khong_dat = sum(1 for r in rows if r.ket_qua == "khong_dat")
    chua = tong - dat - khong_dat
    return QCGiayCuonStatsResponse(
        tong=tong,
        dat=dat,
        khong_dat=khong_dat,
        chua_co_ket_qua=chua,
        ty_le_dat_pct=round(dat / tong * 100, 1) if tong else 0.0,
    )


@router.get("", response_model=List[QCGiayCuonResponse])
def list_phieu(
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    paper_material_id: Optional[int] = Query(None),
    goods_receipt_id: Optional[int] = Query(None),
    ket_qua: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    q = db.query(QCGiayCuonPhieu).order_by(QCGiayCuonPhieu.id.desc())
    if tu_ngay:
        q = q.filter(QCGiayCuonPhieu.ngay_kiem_tra >= tu_ngay)
    if den_ngay:
        q = q.filter(QCGiayCuonPhieu.ngay_kiem_tra <= den_ngay)
    if paper_material_id:
        q = q.filter(QCGiayCuonPhieu.paper_material_id == paper_material_id)
    if goods_receipt_id:
        q = q.filter(QCGiayCuonPhieu.goods_receipt_id == goods_receipt_id)
    if ket_qua:
        q = q.filter(QCGiayCuonPhieu.ket_qua == ket_qua)
    rows = q.offset(skip).limit(limit).all()
    return [_enrich(r, db) for r in rows]


@router.post("", response_model=QCGiayCuonResponse, status_code=201)
def create_phieu(
    body: QCGiayCuonCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("SAN_XUAT_GIAM_SAT", "BGD_GIAM_DOC", "ADMIN")),
):
    pm = db.get(PaperMaterial, body.paper_material_id)
    if not pm:
        raise HTTPException(404, "Không tìm thấy mã nguyên vật liệu")

    # Snapshot TC tại thời điểm kiểm tra — ưu tiên TieuChuanKyThuat, fallback paper fields
    tc = db.get(TieuChuanKyThuat, pm.tieu_chuan_id) if pm.tieu_chuan_id else None
    snap_dinh_luong = (float(tc.tc_dinh_luong) if tc and tc.tc_dinh_luong is not None
                       else (float(pm.tieu_chuan_dinh_luong) if pm.tieu_chuan_dinh_luong is not None
                             else (float(pm.dinh_luong) if pm.dinh_luong is not None else None)))
    snap_sai_so = (float(tc.tc_sai_so_pct) if tc and tc.tc_sai_so_pct is not None
                   else (float(pm.sai_so_pct) if pm.sai_so_pct is not None else None))
    snap_do_buc = (float(tc.tc_do_buc) if tc and tc.tc_do_buc is not None
                   else (float(pm.do_buc_tieu_chuan) if pm.do_buc_tieu_chuan is not None else None))
    snap_do_nen = (float(tc.tc_do_nen_vong) if tc and tc.tc_do_nen_vong is not None
                   else (float(pm.do_nen_vong_tc) if pm.do_nen_vong_tc is not None else None))

    obj = QCGiayCuonPhieu(
        **body.model_dump(),
        so_phieu=_next_so_phieu(db),
        created_by=user.id,
        tc_dinh_luong=snap_dinh_luong,
        tc_sai_so_pct=snap_sai_so,
        tc_do_buc=snap_do_buc,
        tc_do_nen_vong=snap_do_nen,
    )
    _calc_results(obj)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _enrich(obj, db)


@router.get("/{id}", response_model=QCGiayCuonResponse)
def get_phieu(
    id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    obj = db.get(QCGiayCuonPhieu, id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy phiếu")
    return _enrich(obj, db)


@router.patch("/{id}", response_model=QCGiayCuonResponse)
def update_phieu(
    id: int,
    body: QCGiayCuonUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles("SAN_XUAT_GIAM_SAT", "BGD_GIAM_DOC", "ADMIN", "NHAN_SU_TO_TRUONG")),
):
    obj = db.get(QCGiayCuonPhieu, id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy phiếu")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    _calc_results(obj)
    db.commit()
    db.refresh(obj)
    return _enrich(obj, db)


@router.delete("/{id}", status_code=204)
def delete_phieu(
    id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles("SAN_XUAT_GIAM_SAT", "BGD_GIAM_DOC", "ADMIN")),
):
    obj = db.get(QCGiayCuonPhieu, id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy phiếu")
    db.delete(obj)
    db.commit()
