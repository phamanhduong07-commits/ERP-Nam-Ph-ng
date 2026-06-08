"""Kho ảo phôi lỗi (CD1) — proxy qua bảng thống nhất defect_records.

Endpoint giữ nguyên (/api/kho-ao-phoi) và response giữ nguyên shape cũ để
frontend không phải đổi. Dữ liệu đọc/ghi từ defect_records với khau='cd1',
ref_type='phieu_nhap_phoi_song_item', ref_id=phieu_nhap_phoi_song_item_id.
"""
from datetime import date, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import PhanXuong, PhapNhan, Warehouse
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.defect_records import DefectRecord

router = APIRouter(prefix="/api/kho-ao-phoi", tags=["kho-ao-phoi"])

REF_TYPE = "phieu_nhap_phoi_song_item"
KHAU = "cd1"


class NhapKhoAoPhoiIn(BaseModel):
    phieu_nhap_phoi_song_item_id: int


class UpdateTrangThaiIn(BaseModel):
    trang_thai: str          # ban_phe | tan_dung | da_xu_ly | huy
    ghi_chu: Optional[str] = None
    production_order_id_tan_dung: Optional[int] = None


def _to_response(entry: DefectRecord, db: Session) -> dict:
    item = db.get(PhieuNhapPhoiSongItem, entry.ref_id)
    phieu = db.get(PhieuNhapPhoiSong, item.phieu_id) if item else None
    poi = db.get(ProductionOrderItem, item.production_order_item_id) if item else None
    order = db.get(ProductionOrder, phieu.production_order_id) if phieu else None
    px = db.get(PhanXuong, order.phan_xuong_id) if order and order.phan_xuong_id else None

    wh = db.get(Warehouse, phieu.warehouse_id) if phieu and phieu.warehouse_id else None
    pn_id = None
    if wh and wh.phan_xuong_obj:
        pn_id = wh.phan_xuong_obj.phap_nhan_id
    elif order and order.phap_nhan_id:
        pn_id = order.phap_nhan_id
    pn = db.get(PhapNhan, pn_id) if pn_id else None

    lsx_td = db.get(ProductionOrder, entry.production_order_id_tan_dung) if entry.production_order_id_tan_dung else None

    return {
        "id": entry.id,
        "phieu_nhap_phoi_song_item_id": entry.ref_id,
        "so_phieu": phieu.so_phieu if phieu else None,
        "ngay": str(phieu.ngay) if phieu else None,
        "ca": phieu.ca if phieu else None,
        "so_lenh": order.so_lenh if order else None,
        "ten_hang": poi.ten_hang if poi else None,
        "so_luong": float(entry.so_luong),
        "trang_thai": entry.trang_thai,
        "ghi_chu": entry.ghi_chu,
        "ten_phan_xuong": px.ten_xuong if px else None,
        "ten_phap_nhan": pn.ten_viet_tat if pn else None,
        "phan_xuong_id": order.phan_xuong_id if order else None,
        "phap_nhan_id": pn_id,
        "so_lenh_tan_dung": lsx_td.so_lenh if lsx_td else None,
        "production_order_id_tan_dung": entry.production_order_id_tan_dung,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
        "updated_at": entry.updated_at.isoformat() if entry.updated_at else None,
    }


@router.post("/nhap", status_code=201)
def nhap_kho_ao_phoi(
    body: NhapKhoAoPhoiIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.get(PhieuNhapPhoiSongItem, body.phieu_nhap_phoi_song_item_id)
    if not item:
        raise HTTPException(404, "Không tìm thấy dòng phôi")
    if not item.so_luong_loi or item.so_luong_loi <= 0:
        raise HTTPException(400, "Dòng này không có phôi lỗi")
    if item.trang_thai_loi != 'cho_xu_ly':
        raise HTTPException(400, "Phôi lỗi đã được nhập kho ảo hoặc không hợp lệ")

    existing = db.query(DefectRecord).filter(
        DefectRecord.ref_type == REF_TYPE,
        DefectRecord.ref_id == body.phieu_nhap_phoi_song_item_id,
    ).first()
    if existing:
        raise HTTPException(400, "Dòng này đã có trong kho ảo phôi")

    entry = DefectRecord(
        ref_type=REF_TYPE,
        ref_id=body.phieu_nhap_phoi_song_item_id,
        khau=KHAU,
        so_luong=item.so_luong_loi,
        trang_thai='cho_xu_ly',
        created_by=current_user.id,
    )
    db.add(entry)
    item.trang_thai_loi = 'da_nhap_kho_ao'
    db.commit()
    db.refresh(entry)
    return _to_response(entry, db)


@router.get("")
def list_kho_ao_phoi(
    trang_thai: Optional[str] = Query(None),
    phap_nhan_id: Optional[int] = Query(None),
    phan_xuong_id: Optional[int] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(DefectRecord).filter(DefectRecord.khau == KHAU)
    if trang_thai:
        q = q.filter(DefectRecord.trang_thai == trang_thai)
    rows = q.order_by(DefectRecord.created_at.desc()).limit(300).all()

    results = [_to_response(r, db) for r in rows]
    if phan_xuong_id is not None:
        results = [r for r in results if r["phan_xuong_id"] == phan_xuong_id]
    if phap_nhan_id is not None:
        results = [r for r in results if r["phap_nhan_id"] == phap_nhan_id]
    if tu_ngay is not None:
        tu_str = tu_ngay.isoformat()
        results = [r for r in results if r["ngay"] is not None and r["ngay"] >= tu_str]
    if den_ngay is not None:
        den_str = den_ngay.isoformat()
        results = [r for r in results if r["ngay"] is not None and r["ngay"] <= den_str]
    return results


@router.patch("/{entry_id}/trang-thai")
def update_trang_thai(
    entry_id: int,
    body: UpdateTrangThaiIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    allowed = {'ban_phe', 'tan_dung', 'da_xu_ly', 'huy'}
    if body.trang_thai not in allowed:
        raise HTTPException(400, f"Trạng thái không hợp lệ. Cho phép: {', '.join(sorted(allowed))}")
    entry = db.get(DefectRecord, entry_id)
    if not entry or entry.khau != KHAU:
        raise HTTPException(404, "Không tìm thấy bản ghi kho ảo phôi")
    entry.trang_thai = body.trang_thai
    if body.ghi_chu is not None:
        entry.ghi_chu = body.ghi_chu
    if body.trang_thai == 'tan_dung' and body.production_order_id_tan_dung:
        entry.production_order_id_tan_dung = body.production_order_id_tan_dung
    entry.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(entry)
    return _to_response(entry, db)
