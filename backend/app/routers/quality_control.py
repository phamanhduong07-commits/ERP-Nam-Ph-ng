from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.quality import QCSheet, QCDefect
from app.schemas.quality import (
    QCSheetCreate, QCSheetUpdate, QCSheetResponse, QCStatsResponse,
)

router = APIRouter(prefix="/api/qc-sheets", tags=["QC"])


def _gen_so_phieu(db: Session) -> str:
    today = date.today().strftime("%Y%m%d")
    prefix = f"QC-{today}-"
    last = (db.query(QCSheet)
              .filter(QCSheet.so_phieu.like(f"{prefix}%"))
              .order_by(QCSheet.id.desc())
              .first())
    seq = int(last.so_phieu.split("-")[-1]) + 1 if last else 1
    return f"{prefix}{seq:03d}"


def _build_response(sheet: QCSheet) -> QCSheetResponse:
    return QCSheetResponse.model_validate(sheet)


@router.get("", response_model=list[QCSheetResponse])
def list_qc_sheets(
    loai: str | None = Query(None),
    ket_qua: str | None = Query(None),
    ref_type: str | None = Query(None),
    ref_id: int | None = Query(None),
    phap_nhan_id: int | None = Query(None),
    phan_xuong_id: int | None = Query(None),
    tu_ngay: date | None = Query(None),
    den_ngay: date | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(QCSheet).order_by(QCSheet.id.desc())
    if loai:
        q = q.filter(QCSheet.loai == loai)
    if ket_qua:
        q = q.filter(QCSheet.ket_qua == ket_qua)
    if ref_type:
        q = q.filter(QCSheet.ref_type == ref_type)
    if ref_id:
        q = q.filter(QCSheet.ref_id == ref_id)
    if phap_nhan_id:
        q = q.filter(QCSheet.phap_nhan_id == phap_nhan_id)
    if phan_xuong_id:
        q = q.filter(QCSheet.phan_xuong_id == phan_xuong_id)
    if tu_ngay:
        q = q.filter(QCSheet.ngay >= tu_ngay)
    if den_ngay:
        q = q.filter(QCSheet.ngay <= den_ngay)
    return [_build_response(s) for s in q.all()]


@router.post("", response_model=QCSheetResponse, status_code=201)
def create_qc_sheet(
    data: QCSheetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sheet = QCSheet(
        so_phieu=_gen_so_phieu(db),
        loai=data.loai,
        ref_type=data.ref_type,
        ref_id=data.ref_id,
        ngay=data.ngay,
        nguoi_kiem_tra=data.nguoi_kiem_tra,
        ket_qua=data.ket_qua,
        ghi_chu=data.ghi_chu,
        phap_nhan_id=data.phap_nhan_id,
        phan_xuong_id=data.phan_xuong_id,
        created_by=current_user.id,
    )
    for d in data.defects:
        sheet.defects.append(QCDefect(
            loai_loi=d.loai_loi,
            mo_ta=d.mo_ta,
            so_luong_loi=d.so_luong_loi,
            hinh_anh_path=d.hinh_anh_path,
        ))
    db.add(sheet)
    db.commit()
    db.refresh(sheet)
    return _build_response(sheet)


@router.get("/stats", response_model=QCStatsResponse)
def get_qc_stats(
    tu_ngay: date | None = Query(None),
    den_ngay: date | None = Query(None),
    loai: str | None = Query(None),
    phap_nhan_id: int | None = Query(None),
    phan_xuong_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(QCSheet)
    if loai:
        q = q.filter(QCSheet.loai == loai)
    if phap_nhan_id:
        q = q.filter(QCSheet.phap_nhan_id == phap_nhan_id)
    if phan_xuong_id:
        q = q.filter(QCSheet.phan_xuong_id == phan_xuong_id)
    if tu_ngay:
        q = q.filter(QCSheet.ngay >= tu_ngay)
    if den_ngay:
        q = q.filter(QCSheet.ngay <= den_ngay)

    sheets = q.all()
    tong = len(sheets)
    dat = sum(1 for s in sheets if s.ket_qua == "dat")
    khong_dat = sum(1 for s in sheets if s.ket_qua == "khong_dat")
    tam_chap_nhan = sum(1 for s in sheets if s.ket_qua == "tam_chap_nhan")
    chua_co = tong - dat - khong_dat - tam_chap_nhan
    ty_le = round(dat / tong * 100, 1) if tong > 0 else 0.0

    return QCStatsResponse(
        tong=tong,
        dat=dat,
        khong_dat=khong_dat,
        tam_chap_nhan=tam_chap_nhan,
        chua_co_ket_qua=chua_co,
        ty_le_dat_pct=ty_le,
    )


@router.get("/{sheet_id}", response_model=QCSheetResponse)
def get_qc_sheet(
    sheet_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    sheet = db.get(QCSheet, sheet_id)
    if not sheet:
        raise HTTPException(404, "Không tìm thấy phiếu QC")
    return _build_response(sheet)


@router.patch("/{sheet_id}/ket-qua", response_model=QCSheetResponse)
def update_ket_qua(
    sheet_id: int,
    data: QCSheetUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    sheet = db.get(QCSheet, sheet_id)
    if not sheet:
        raise HTTPException(404, "Không tìm thấy phiếu QC")

    if data.ket_qua is not None:
        sheet.ket_qua = data.ket_qua
    if data.nguoi_kiem_tra is not None:
        sheet.nguoi_kiem_tra = data.nguoi_kiem_tra
    if data.ghi_chu is not None:
        sheet.ghi_chu = data.ghi_chu

    if data.defects is not None:
        for d in sheet.defects:
            db.delete(d)
        db.flush()
        for d in data.defects:
            sheet.defects.append(QCDefect(
                loai_loi=d.loai_loi,
                mo_ta=d.mo_ta,
                so_luong_loi=d.so_luong_loi,
                hinh_anh_path=d.hinh_anh_path,
            ))

    sheet.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(sheet)
    return _build_response(sheet)


@router.delete("/{sheet_id}", status_code=204)
def delete_qc_sheet(
    sheet_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("QC", "GIAM_DOC", "ADMIN")),
):
    sheet = db.get(QCSheet, sheet_id)
    if not sheet:
        raise HTTPException(404, "Không tìm thấy phiếu QC")
    db.delete(sheet)
    db.commit()
