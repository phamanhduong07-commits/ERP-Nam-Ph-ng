"""Kho ảo hàng lỗi (TP) — proxy qua bảng thống nhất defect_records.

Endpoint giữ nguyên (/api/kho-ao) và response giữ nguyên shape cũ để frontend
không phải đổi. Dữ liệu đọc/ghi từ defect_records với khau='tp',
ref_type='production_output', ref_id=production_output_id.
"""
from datetime import date, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.warehouse_doc import ProductionOutput
from app.models.defect_records import DefectRecord
from app.models.master import PhanXuong, PhapNhan

router = APIRouter(prefix="/api/kho-ao", tags=["kho-ao"])

REF_TYPE = "production_output"
KHAU = "tp"


class NhapKhoAoIn(BaseModel):
    production_output_id: int


class UpdateGhiChuIn(BaseModel):
    ghi_chu: Optional[str] = None


def _to_response(entry: DefectRecord, db: Session) -> dict:
    po = db.get(ProductionOutput, entry.ref_id)
    order = db.get(ProductionOrder, po.production_order_id) if po else None
    item = (
        db.query(ProductionOrderItem)
        .filter(ProductionOrderItem.production_order_id == order.id)
        .first()
    ) if order else None
    px = db.get(PhanXuong, order.phan_xuong_id) if order and order.phan_xuong_id else None
    pn = db.get(PhapNhan, order.phap_nhan_id) if order and order.phap_nhan_id else None

    quy_cach = None
    if item and item.dai and item.rong and item.cao:
        quy_cach = f"{int(item.dai)}×{int(item.rong)}×{int(item.cao)}"

    return {
        "id": entry.id,
        "production_output_id": entry.ref_id,
        "so_phieu": po.so_phieu if po else None,
        "ngay_nhap": str(po.ngay_nhap) if po else None,
        "so_lenh": order.so_lenh if order else None,
        "ten_hang": po.ten_hang if po else None,
        "dvt": po.dvt if po else "Thùng",
        "so_luong": float(entry.so_luong),
        "trang_thai": entry.trang_thai,
        "nguyen_nhan": None,
        "bien_phap_xu_ly": None,
        "han_xu_ly": None,
        "ghi_chu": entry.ghi_chu,
        "ten_phan_xuong": px.ten_xuong if px else None,
        "ten_phap_nhan": pn.ten_viet_tat if pn else None,
        "phan_xuong_id": order.phan_xuong_id if order else None,
        "phap_nhan_id": order.phap_nhan_id if order else None,
        "quy_cach": quy_cach,
        "loai_thung": item.loai_thung if item else None,
        "so_lop": item.so_lop if item else None,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
        "updated_at": entry.updated_at.isoformat() if entry.updated_at else None,
    }


@router.post("/nhap", status_code=201)
def nhap_kho_ao(
    body: NhapKhoAoIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    po = db.get(ProductionOutput, body.production_output_id)
    if not po:
        raise HTTPException(404, "Không tìm thấy phiếu nhập thành phẩm")
    if not po.so_luong_loi or po.so_luong_loi <= 0:
        raise HTTPException(400, "Phiếu này không có hàng lỗi")
    if po.trang_thai_loi != 'cho_xu_ly':
        raise HTTPException(400, "Hàng lỗi đã được nhập kho ảo hoặc không hợp lệ")

    existing = db.query(DefectRecord).filter(
        DefectRecord.ref_type == REF_TYPE,
        DefectRecord.ref_id == body.production_output_id,
    ).first()
    if existing:
        raise HTTPException(400, "Phiếu này đã có trong kho ảo")

    entry = DefectRecord(
        ref_type=REF_TYPE,
        ref_id=body.production_output_id,
        khau=KHAU,
        so_luong=po.so_luong_loi,
        trang_thai='cho_xu_ly',
        created_by=current_user.id,
    )
    db.add(entry)
    po.trang_thai_loi = 'da_nhap_kho_ao'
    db.commit()
    db.refresh(entry)
    return _to_response(entry, db)


@router.get("")
def list_kho_ao(
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
        results = [r for r in results if r["ngay_nhap"] is not None and r["ngay_nhap"] >= tu_str]
    if den_ngay is not None:
        den_str = den_ngay.isoformat()
        results = [r for r in results if r["ngay_nhap"] is not None and r["ngay_nhap"] <= den_str]
    return results


@router.patch("/{entry_id}/ghi-chu")
def update_ghi_chu(
    entry_id: int,
    body: UpdateGhiChuIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    entry = db.get(DefectRecord, entry_id)
    if not entry or entry.khau != KHAU:
        raise HTTPException(404, "Không tìm thấy bản ghi kho ảo")
    entry.ghi_chu = body.ghi_chu
    entry.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(entry)
    return _to_response(entry, db)
