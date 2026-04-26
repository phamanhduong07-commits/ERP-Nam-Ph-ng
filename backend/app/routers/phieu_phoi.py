"""
Router: Phiếu nhập / xuất phôi sóng
GET  /api/phieu-phoi/nhap          — danh sách phiếu nhập
GET  /api/phieu-phoi/nhap/{id}     — chi tiết phiếu nhập
GET  /api/phieu-phoi/xuat          — danh sách phiếu xuất
POST /api/phieu-phoi/xuat          — tạo phiếu xuất mới
GET  /api/phieu-phoi/xuat/{id}     — chi tiết phiếu xuất
"""
from datetime import date, datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload, contains_eager
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.phieu_xuat_phoi import PhieuXuatPhoi, PhieuXuatPhoiItem

router = APIRouter(prefix="/api/phieu-phoi", tags=["phieu-phoi"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_so_phieu_xuat(db: Session) -> str:
    today = date.today()
    prefix = f"PXPS-{today.strftime('%Y%m')}-"
    last = (
        db.query(PhieuXuatPhoi)
        .filter(PhieuXuatPhoi.so_phieu.like(f"{prefix}%"))
        .order_by(PhieuXuatPhoi.so_phieu.desc())
        .first()
    )
    seq = (int(last.so_phieu[-4:]) + 1) if last else 1
    return f"{prefix}{seq:04d}"


def _nhap_item_to_dict(it: PhieuNhapPhoiSongItem) -> dict:
    sl_thuc = float(it.so_luong_thuc_te) if it.so_luong_thuc_te is not None else None
    sl_loi = float(it.so_luong_loi) if it.so_luong_loi is not None else None
    sl_nhap = round(sl_thuc - sl_loi, 3) if (sl_thuc is not None and sl_loi is not None) else sl_thuc
    # Sử dụng relationship đã eager-load thay vì query thêm
    poi = getattr(it, "production_order_item", None)
    return {
        "id": it.id,
        "production_order_item_id": it.production_order_item_id,
        "ten_hang": poi.ten_hang if poi else None,
        "so_luong_ke_hoach": float(it.so_luong_ke_hoach),
        "so_luong_thuc_te": sl_thuc,
        "so_luong_loi": sl_loi,
        "so_luong_nhap": sl_nhap,
        "chieu_kho": float(it.chieu_kho) if it.chieu_kho is not None else None,
        "chieu_cat": float(it.chieu_cat) if it.chieu_cat is not None else None,
        "so_tam": it.so_tam,
        "ghi_chu": it.ghi_chu,
    }


def _nhap_phieu_to_dict(p: PhieuNhapPhoiSong, db: Session = None) -> dict:  # type: ignore[assignment]
    # Sử dụng relationship đã eager-load (production_order, items.production_order_item)
    order = getattr(p, "production_order", None)

    tong_thuc_te = sum(
        float(it.so_luong_thuc_te) for it in p.items if it.so_luong_thuc_te is not None
    )
    tong_loi = sum(
        float(it.so_luong_loi) for it in p.items if it.so_luong_loi is not None
    )

    return {
        "id": p.id,
        "so_phieu": p.so_phieu,
        "production_order_id": p.production_order_id,
        "so_lenh": order.so_lenh if order else None,
        "ngay": str(p.ngay),
        "ca": p.ca,
        "ghi_chu": p.ghi_chu,
        "gio_bat_dau": p.gio_bat_dau,
        "gio_ket_thuc": p.gio_ket_thuc,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "tong_thuc_te": tong_thuc_te,
        "tong_loi": tong_loi,
        "tong_nhap": round(tong_thuc_te - tong_loi, 3),
        "items": [_nhap_item_to_dict(it) for it in p.items],
    }


def _xuat_item_to_dict(it: PhieuXuatPhoiItem) -> dict:
    return {
        "id": it.id,
        "production_order_item_id": it.production_order_item_id,
        "ten_hang": it.ten_hang,
        "so_luong": float(it.so_luong),
        "ghi_chu": it.ghi_chu,
    }


def _xuat_phieu_to_dict(p: PhieuXuatPhoi) -> dict:
    return {
        "id": p.id,
        "so_phieu": p.so_phieu,
        "ngay": str(p.ngay),
        "ca": p.ca,
        "ghi_chu": p.ghi_chu,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "tong_so_luong": sum(float(it.so_luong) for it in p.items),
        "items": [_xuat_item_to_dict(it) for it in p.items],
    }


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class XuatItemBody(BaseModel):
    production_order_item_id: int | None = None
    ten_hang: str
    so_luong: Decimal
    ghi_chu: str | None = None


class XuatBody(BaseModel):
    ngay: date
    ca: str | None = None
    ghi_chu: str | None = None
    items: list[XuatItemBody] = []


# ── Endpoints: Phiếu nhập ─────────────────────────────────────────────────────

@router.get("/nhap")
def list_phieu_nhap(
    tu_ngay: date | None = Query(default=None),
    den_ngay: date | None = Query(default=None),
    loai: str | None = Query(default=None),
    search: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=10000),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Danh sách toàn bộ phiếu nhập phôi sóng."""
    q = db.query(PhieuNhapPhoiSong)
    if tu_ngay:
        q = q.filter(PhieuNhapPhoiSong.ngay >= tu_ngay)
    if den_ngay:
        q = q.filter(PhieuNhapPhoiSong.ngay <= den_ngay)
    if loai:
        q = q.filter(PhieuNhapPhoiSong.loai == loai)
    if search:
        like = f"%{search}%"
        q = q.join(ProductionOrder, PhieuNhapPhoiSong.production_order_id == ProductionOrder.id).filter(
            ProductionOrder.so_lenh.ilike(like) | PhieuNhapPhoiSong.so_phieu.ilike(like)
        )

    total = q.count()
    phieus = (
        q.options(
            joinedload(PhieuNhapPhoiSong.production_order),
            joinedload(PhieuNhapPhoiSong.items).joinedload(
                PhieuNhapPhoiSongItem.production_order_item
            ),
        )
        .order_by(PhieuNhapPhoiSong.ngay.desc(), PhieuNhapPhoiSong.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_nhap_phieu_to_dict(p) for p in phieus],
    }


@router.get("/nhap/{phieu_id}")
def get_phieu_nhap(
    phieu_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = (
        db.query(PhieuNhapPhoiSong)
        .options(
            joinedload(PhieuNhapPhoiSong.production_order),
            joinedload(PhieuNhapPhoiSong.items).joinedload(
                PhieuNhapPhoiSongItem.production_order_item
            ),
        )
        .filter(PhieuNhapPhoiSong.id == phieu_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu nhập")
    return _nhap_phieu_to_dict(p)


# ── Endpoints: Phiếu xuất ─────────────────────────────────────────────────────

@router.get("/xuat")
def list_phieu_xuat(
    tu_ngay: date | None = Query(default=None),
    den_ngay: date | None = Query(default=None),
    search: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(PhieuXuatPhoi)
    if tu_ngay:
        q = q.filter(PhieuXuatPhoi.ngay >= tu_ngay)
    if den_ngay:
        q = q.filter(PhieuXuatPhoi.ngay <= den_ngay)
    if search:
        q = q.filter(PhieuXuatPhoi.so_phieu.ilike(f"%{search}%"))

    total = q.count()
    phieus = (
        q.options(joinedload(PhieuXuatPhoi.items))
        .order_by(PhieuXuatPhoi.ngay.desc(), PhieuXuatPhoi.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_xuat_phieu_to_dict(p) for p in phieus],
    }


@router.post("/xuat", status_code=201)
def create_phieu_xuat(
    data: XuatBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    so_phieu = _generate_so_phieu_xuat(db)
    phieu = PhieuXuatPhoi(
        so_phieu=so_phieu,
        ngay=data.ngay,
        ca=data.ca,
        ghi_chu=data.ghi_chu,
        created_by=current_user.id,
    )
    for it in data.items:
        phieu.items.append(PhieuXuatPhoiItem(
            production_order_item_id=it.production_order_item_id,
            ten_hang=it.ten_hang,
            so_luong=it.so_luong,
            ghi_chu=it.ghi_chu,
        ))
    db.add(phieu)
    db.commit()
    db.refresh(phieu)
    return _xuat_phieu_to_dict(phieu)


@router.get("/xuat/{phieu_id}")
def get_phieu_xuat(
    phieu_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = (
        db.query(PhieuXuatPhoi)
        .options(joinedload(PhieuXuatPhoi.items))
        .filter(PhieuXuatPhoi.id == phieu_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu xuất")
    return _xuat_phieu_to_dict(p)
