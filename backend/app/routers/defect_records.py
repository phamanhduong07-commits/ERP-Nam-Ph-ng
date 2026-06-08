"""Unified defect records — polymorphic kho ảo hàng lỗi.

Gộp hai bảng cũ (hang_loi_kho_ao = TP lỗi, hang_loi_phoi_kho_ao = phôi lỗi CD1)
thành một bảng defect_records, phân biệt nguồn bằng (ref_type, ref_id) và khâu (khau).

Mỗi bản ghi trỏ về 1 nguồn lỗi:
    ref_type='production_output'          → ProductionOutput  (khâu 'tp')
    ref_type='phieu_nhap_phoi_song_item' → PhieuNhapPhoiSongItem (khâu 'cd1')

Response là superset của cả hai phiếu cũ — field nào không áp dụng cho nguồn
hiện tại thì trả None.
"""
from datetime import date, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.defect_records import DefectRecord
from app.models.warehouse_doc import ProductionOutput
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.master import PhanXuong, PhapNhan, Warehouse

router = APIRouter(prefix="/api/defect-records", tags=["defect-records"])

# Nguồn lỗi hợp lệ khi nhập kho ảo qua endpoint thống nhất
REF_TYPE_PRODUCTION_OUTPUT = "production_output"
REF_TYPE_PHOI_ITEM = "phieu_nhap_phoi_song_item"
KHAU_BY_REF_TYPE = {
    REF_TYPE_PRODUCTION_OUTPUT: "tp",
    REF_TYPE_PHOI_ITEM: "cd1",
}

# Trạng thái cho phép chuyển sang qua PATCH /{id}/trang-thai
ALLOWED_TRANG_THAI = {"ban_phe", "tan_dung", "da_xu_ly", "huy"}


class NhapDefectIn(BaseModel):
    ref_type: str
    ref_id: int


class UpdateTrangThaiIn(BaseModel):
    trang_thai: str          # ban_phe | tan_dung | da_xu_ly | huy
    ghi_chu: Optional[str] = None
    production_order_id_tan_dung: Optional[int] = None


def _empty_context() -> dict:
    """Các field ngữ cảnh khi không resolve được nguồn — giữ shape ổn định."""
    return {
        "so_lenh": None,
        "ten_hang": None,
        "ngay": None,
        "ca": None,
        "so_phieu": None,
        "dvt": None,
        "quy_cach": None,
        "loai_thung": None,
        "so_lop": None,
        "ten_phan_xuong": None,
        "ten_phap_nhan": None,
        "phan_xuong_id": None,
        "phap_nhan_id": None,
    }


def _context_production_output(ref_id: int, db: Session) -> dict:
    """Ngữ cảnh cho TP lỗi: ProductionOutput → Order → Item → PhanXuong → PhapNhan."""
    po = db.get(ProductionOutput, ref_id)
    if not po:
        return _empty_context()

    order = db.get(ProductionOrder, po.production_order_id)
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
        "so_lenh": order.so_lenh if order else None,
        "ten_hang": po.ten_hang,
        "ngay": str(po.ngay_nhap) if po.ngay_nhap else None,
        "ca": None,
        "so_phieu": po.so_phieu,
        "dvt": po.dvt,
        "quy_cach": quy_cach,
        "loai_thung": item.loai_thung if item else None,
        "so_lop": item.so_lop if item else None,
        "ten_phan_xuong": px.ten_xuong if px else None,
        "ten_phap_nhan": pn.ten_viet_tat if pn else None,
        "phan_xuong_id": order.phan_xuong_id if order else None,
        "phap_nhan_id": order.phap_nhan_id if order else None,
    }


def _context_phoi_item(ref_id: int, db: Session) -> dict:
    """Ngữ cảnh cho phôi lỗi CD1: Item → Phieu → Order → POI → PhanXuong → Warehouse → PhapNhan."""
    item = db.get(PhieuNhapPhoiSongItem, ref_id)
    if not item:
        return _empty_context()

    phieu = db.get(PhieuNhapPhoiSong, item.phieu_id) if item.phieu_id else None
    # poi = ProductionOrderItem: nguồn ten_hang cho phôi (PhieuNhapPhoiSongItem không có ten_hang)
    poi = db.get(ProductionOrderItem, item.production_order_item_id) if item.production_order_item_id else None
    order = db.get(ProductionOrder, phieu.production_order_id) if phieu else None
    px = db.get(PhanXuong, order.phan_xuong_id) if order and order.phan_xuong_id else None

    wh = db.get(Warehouse, phieu.warehouse_id) if phieu and phieu.warehouse_id else None
    pn_id = None
    if wh and wh.phan_xuong_obj:
        pn_id = wh.phan_xuong_obj.phap_nhan_id
    elif order and order.phap_nhan_id:
        pn_id = order.phap_nhan_id
    pn = db.get(PhapNhan, pn_id) if pn_id else None

    return {
        "so_lenh": order.so_lenh if order else None,
        "ten_hang": poi.ten_hang if poi else None,
        "ngay": str(phieu.ngay) if phieu and phieu.ngay else None,
        "ca": phieu.ca if phieu else None,
        "so_phieu": phieu.so_phieu if phieu else None,
        "dvt": "Tấm",
        "quy_cach": None,
        "loai_thung": None,
        "so_lop": None,
        "ten_phan_xuong": px.ten_xuong if px else None,
        "ten_phap_nhan": pn.ten_viet_tat if pn else None,
        "phan_xuong_id": order.phan_xuong_id if order else None,
        "phap_nhan_id": pn_id,
    }


def _resolve_context(entry: DefectRecord, db: Session) -> dict:
    """Lấy ngữ cảnh nguồn theo ref_type. ref_type lạ → context rỗng (không vỡ shape)."""
    if entry.ref_type == REF_TYPE_PRODUCTION_OUTPUT:
        return _context_production_output(entry.ref_id, db)
    if entry.ref_type == REF_TYPE_PHOI_ITEM:
        return _context_phoi_item(entry.ref_id, db)
    return _empty_context()


def _to_response(entry: DefectRecord, db: Session) -> dict:
    ctx = _resolve_context(entry, db)
    lsx_td = (
        db.get(ProductionOrder, entry.production_order_id_tan_dung)
        if entry.production_order_id_tan_dung else None
    )

    return {
        "id": entry.id,
        "ref_type": entry.ref_type,
        "ref_id": entry.ref_id,
        "khau": entry.khau,
        "so_luong": float(entry.so_luong),
        "trang_thai": entry.trang_thai,
        "ghi_chu": entry.ghi_chu,
        "so_lenh": ctx["so_lenh"],
        "ten_hang": ctx["ten_hang"],
        "ngay": ctx["ngay"],
        "ca": ctx["ca"],
        "dvt": ctx["dvt"],
        "quy_cach": ctx["quy_cach"],
        "loai_thung": ctx["loai_thung"],
        "so_lop": ctx["so_lop"],
        "ten_phan_xuong": ctx["ten_phan_xuong"],
        "ten_phap_nhan": ctx["ten_phap_nhan"],
        "phan_xuong_id": ctx["phan_xuong_id"],
        "phap_nhan_id": ctx["phap_nhan_id"],
        "production_order_id_tan_dung": entry.production_order_id_tan_dung,
        "so_lenh_tan_dung": lsx_td.so_lenh if lsx_td else None,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
        "updated_at": entry.updated_at.isoformat() if entry.updated_at else None,
    }


@router.get("")
def list_defect_records(
    khau: Optional[str] = Query(None),
    trang_thai: Optional[str] = Query(None),
    phap_nhan_id: Optional[int] = Query(None),
    phan_xuong_id: Optional[int] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Liệt kê bản ghi lỗi.

    khau/trang_thai lọc thẳng trên defect_records (có index).
    phan_xuong_id/phap_nhan_id/tu_ngay/den_ngay lọc ở Python sau khi resolve
    ngữ cảnh — vì nguồn polymorphic nên join SQL không thống nhất được.
    """
    q = db.query(DefectRecord)
    if khau:
        q = q.filter(DefectRecord.khau == khau)
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


@router.post("/nhap", status_code=201)
def nhap_defect_record(
    body: NhapDefectIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Nhập một nguồn lỗi vào kho ảo thống nhất.

    Validate nguồn tồn tại, có so_luong_loi > 0 và trang_thai_loi == 'cho_xu_ly',
    chưa có DefectRecord cho cùng (ref_type, ref_id). Sau đó tạo bản ghi và đặt
    trang_thai_loi của nguồn = 'da_nhap_kho_ao'.
    """
    if body.ref_type not in KHAU_BY_REF_TYPE:
        raise HTTPException(
            400,
            f"ref_type không hợp lệ. Cho phép: {', '.join(sorted(KHAU_BY_REF_TYPE))}",
        )

    existing = db.query(DefectRecord).filter(
        DefectRecord.ref_type == body.ref_type,
        DefectRecord.ref_id == body.ref_id,
    ).first()
    if existing:
        raise HTTPException(400, "Nguồn này đã có trong kho ảo")

    khau = KHAU_BY_REF_TYPE[body.ref_type]

    if body.ref_type == REF_TYPE_PRODUCTION_OUTPUT:
        po = db.get(ProductionOutput, body.ref_id)
        if not po:
            raise HTTPException(404, "Không tìm thấy phiếu nhập thành phẩm")
        if not po.so_luong_loi or po.so_luong_loi <= 0:
            raise HTTPException(400, "Phiếu này không có hàng lỗi")
        if po.trang_thai_loi != "cho_xu_ly":
            raise HTTPException(400, "Hàng lỗi đã được nhập kho ảo hoặc không hợp lệ")
        so_luong_loi = po.so_luong_loi
        source = po
    else:  # REF_TYPE_PHOI_ITEM
        item = db.get(PhieuNhapPhoiSongItem, body.ref_id)
        if not item:
            raise HTTPException(404, "Không tìm thấy dòng phôi")
        if not item.so_luong_loi or item.so_luong_loi <= 0:
            raise HTTPException(400, "Dòng này không có phôi lỗi")
        if item.trang_thai_loi != "cho_xu_ly":
            raise HTTPException(400, "Phôi lỗi đã được nhập kho ảo hoặc không hợp lệ")
        so_luong_loi = item.so_luong_loi
        source = item

    entry = DefectRecord(
        ref_type=body.ref_type,
        ref_id=body.ref_id,
        khau=khau,
        so_luong=so_luong_loi,
        trang_thai="cho_xu_ly",
        created_by=current_user.id,
    )
    db.add(entry)
    source.trang_thai_loi = "da_nhap_kho_ao"
    db.commit()
    db.refresh(entry)
    return _to_response(entry, db)


@router.patch("/{entry_id}/trang-thai")
def update_trang_thai(
    entry_id: int,
    body: UpdateTrangThaiIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Chuyển trạng thái xử lý: ban_phe | tan_dung | da_xu_ly | huy."""
    if body.trang_thai not in ALLOWED_TRANG_THAI:
        raise HTTPException(
            400,
            f"Trạng thái không hợp lệ. Cho phép: {', '.join(sorted(ALLOWED_TRANG_THAI))}",
        )
    entry = db.get(DefectRecord, entry_id)
    if not entry:
        raise HTTPException(404, "Không tìm thấy bản ghi lỗi")

    entry.trang_thai = body.trang_thai
    if body.ghi_chu is not None:
        entry.ghi_chu = body.ghi_chu
    if body.trang_thai == "tan_dung" and body.production_order_id_tan_dung:
        entry.production_order_id_tan_dung = body.production_order_id_tan_dung
    entry.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(entry)
    return _to_response(entry, db)
