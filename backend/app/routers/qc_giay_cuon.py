from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.master import PaperMaterial
from app.models.quality import QCGiayCuonPhieu
from app.schemas.quality import (
    QCGiayCuonCreate,
    QCGiayCuonResponse,
    QCGiayCuonStatsResponse,
    QCGiayCuonUpdate,
)

router = APIRouter(prefix="/qc-giay-cuon", tags=["QC Giấy Cuộn"])


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
    # Định lượng
    vals_dl = [v for v in [obj.dl_l1, obj.dl_l2] if v is not None]
    if vals_dl:
        obj.dl_tb = round(sum(vals_dl) / len(vals_dl), 3)
        if obj.tc_dinh_luong and obj.tc_sai_so_pct is not None:
            tc = float(obj.tc_dinh_luong)
            ss = float(obj.tc_sai_so_pct)
            obj.dl_ket_qua = "dat" if tc * (1 - ss / 100) <= obj.dl_tb <= tc * (1 + ss / 100) else "khong_dat"
        elif obj.tc_dinh_luong:
            obj.dl_ket_qua = None  # TC chưa đủ để đánh giá
    else:
        obj.dl_tb = None
        obj.dl_ket_qua = None

    # Độ bục
    vals_buc = [v for v in [obj.buc_l1, obj.buc_l2, obj.buc_l3, obj.buc_l4] if v is not None]
    if vals_buc:
        obj.buc_tb = round(sum(vals_buc) / len(vals_buc), 4)
        if obj.tc_do_buc:
            obj.buc_ket_qua = "dat" if obj.buc_tb >= float(obj.tc_do_buc) else "khong_dat"
    else:
        obj.buc_tb = None
        obj.buc_ket_qua = None

    # Độ nén vòng
    vals_nen = [v for v in [obj.nen_vong_l1, obj.nen_vong_l2, obj.nen_vong_l3] if v is not None]
    if vals_nen:
        obj.nen_vong_tb = round(sum(vals_nen) / len(vals_nen), 4)
        if obj.tc_do_nen_vong:
            obj.nen_vong_ket_qua = "dat" if obj.nen_vong_tb >= float(obj.tc_do_nen_vong) else "khong_dat"
    else:
        obj.nen_vong_tb = None
        obj.nen_vong_ket_qua = None

    # Khổ giấy
    if obj.kho_thuc_te is not None and obj.kho_tc is not None:
        obj.kho_ket_qua = "dat" if abs(obj.kho_thuc_te - float(obj.kho_tc)) <= 4 else "khong_dat"
    else:
        obj.kho_ket_qua = None

    # Kết quả tổng — chỉ tính chỉ tiêu đã có đủ dữ liệu
    all_kq = [obj.dl_ket_qua, obj.buc_ket_qua, obj.nen_vong_ket_qua, obj.kho_ket_qua]
    filled = [k for k in all_kq if k is not None]
    obj.ket_qua = "dat" if filled and all(k == "dat" for k in filled) else ("khong_dat" if filled else None)


def _enrich(phieu: QCGiayCuonPhieu, db: Session) -> QCGiayCuonResponse:
    """Gắn tên paper_material và NCC vào response."""
    data = QCGiayCuonResponse.model_validate(phieu)
    pm = db.get(PaperMaterial, phieu.paper_material_id)
    if pm:
        data.paper_material_ma = pm.ma_chinh
        data.paper_material_ten = pm.ten
        if pm.nsx:
            data.ncc_ten = pm.nsx.ten
    return data


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/tieu-chuan/{paper_material_id}")
def get_tieu_chuan(
    paper_material_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Lấy tiêu chuẩn của một loại giấy để hiển thị trong form."""
    pm = db.get(PaperMaterial, paper_material_id)
    if not pm:
        raise HTTPException(404, "Không tìm thấy mã nguyên vật liệu")
    return {
        "ma_chinh": pm.ma_chinh,
        "ten": pm.ten,
        "kho": float(pm.kho) if pm.kho is not None else None,
        "dinh_luong": float(pm.dinh_luong) if pm.dinh_luong is not None else None,
        "tieu_chuan_dinh_luong": float(pm.tieu_chuan_dinh_luong) if pm.tieu_chuan_dinh_luong is not None else None,
        "do_buc_tieu_chuan": float(pm.do_buc_tieu_chuan) if pm.do_buc_tieu_chuan is not None else None,
        "do_nen_vong_tc": float(pm.do_nen_vong_tc) if pm.do_nen_vong_tc is not None else None,
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

    obj = QCGiayCuonPhieu(
        **body.model_dump(),
        so_phieu=_next_so_phieu(db),
        created_by=user.id,
        # Snapshot tiêu chuẩn tại thời điểm kiểm tra
        tc_dinh_luong=float(pm.dinh_luong) if pm.dinh_luong is not None else None,
        tc_sai_so_pct=float(pm.sai_so_pct) if pm.sai_so_pct is not None else None,
        tc_do_buc=float(pm.do_buc_tieu_chuan) if pm.do_buc_tieu_chuan is not None else None,
        tc_do_nen_vong=float(pm.do_nen_vong_tc) if pm.do_nen_vong_tc is not None else None,
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
