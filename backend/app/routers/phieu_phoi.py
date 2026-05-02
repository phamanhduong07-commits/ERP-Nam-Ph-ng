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
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, contains_eager
from app.database import get_db
from app.deps import get_current_user
import logging
from app.models.auth import User
from app.models.master import Warehouse
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.phieu_xuat_phoi import PhieuXuatPhoi, PhieuXuatPhoiItem

_log = logging.getLogger("erp")

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
    db.flush()  # lấy phieu.id trước khi commit

    # Cập nhật tồn kho kho PHOI của xưởng (soft fail nếu chưa khởi tạo kho)
    from app.services.inventory_service import (
        get_or_create_balance, xuat_balance, log_tx, get_workshop_warehouse,
    )
    items_data = list(data.items)  # snapshot trước commit
    for it in items_data:
        if not it.production_order_item_id or it.so_luong <= 0:
            continue
        poi = db.get(ProductionOrderItem, it.production_order_item_id)
        if not poi:
            continue
        order = db.get(ProductionOrder, poi.production_order_id)
        if not order or not order.phan_xuong_id:
            continue
        phoi_wh = get_workshop_warehouse(db, order.phan_xuong_id, "PHOI")
        if not phoi_wh:
            _log.warning(
                f"PhieuXuatPhoi: xưởng {order.phan_xuong_id} chưa có kho PHOI — bỏ qua inventory update"
            )
            continue
        balance = get_or_create_balance(db, phoi_wh.id, ten_hang=it.ten_hang, don_vi="Tấm")
        don_gia_xuat = balance.don_gia_binh_quan
        try:
            xuat_balance(balance, Decimal(str(it.so_luong)), it.ten_hang)
        except HTTPException:
            _log.warning(f"PhieuXuatPhoi: không đủ tồn kho {it.ten_hang} tại {phoi_wh.ma_kho}")
            continue
        log_tx(db, phoi_wh.id, "XUAT_PHOI", Decimal(str(it.so_luong)),
               don_gia_xuat, balance.ton_luong,
               "phieu_xuat_phoi", phieu.id, current_user.id)

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


# ── Tồn kho phôi theo LSX ────────────────────────────────────────────────────

@router.get("/ton-kho-lsx")
def ton_kho_lsx(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Tổng hợp tồn kho phôi sóng theo LSX — dùng cho Tab Kho phôi sóng."""
    from app.models.cd2 import PhieuIn

    # 1. Nhập phôi: sum (thực tế - lỗi) per production_order_id
    nhap_rows = (
        db.query(
            PhieuNhapPhoiSong.production_order_id,
            func.coalesce(
                func.sum(
                    func.coalesce(PhieuNhapPhoiSongItem.so_luong_thuc_te, 0)
                    - func.coalesce(PhieuNhapPhoiSongItem.so_luong_loi, 0)
                ),
                0,
            ).label("tong_nhap"),
            func.max(PhieuNhapPhoiSong.warehouse_id).label("warehouse_id"),
        )
        .join(PhieuNhapPhoiSongItem, PhieuNhapPhoiSongItem.phieu_id == PhieuNhapPhoiSong.id)
        .group_by(PhieuNhapPhoiSong.production_order_id)
        .all()
    )

    if not nhap_rows:
        return []

    order_ids = [r.production_order_id for r in nhap_rows]
    nhap_map = {
        r.production_order_id: {
            "tong_nhap": float(r.tong_nhap),
            "warehouse_id": r.warehouse_id,
        }
        for r in nhap_rows
    }

    # 2. Xuất phôi: sum per production_order_id (qua production_order_items)
    xuat_rows = (
        db.query(
            ProductionOrderItem.production_order_id,
            func.coalesce(func.sum(PhieuXuatPhoiItem.so_luong), 0).label("tong_xuat"),
        )
        .join(PhieuXuatPhoiItem, PhieuXuatPhoiItem.production_order_item_id == ProductionOrderItem.id)
        .filter(ProductionOrderItem.production_order_id.in_(order_ids))
        .group_by(ProductionOrderItem.production_order_id)
        .all()
    )
    xuat_map = {r.production_order_id: float(r.tong_xuat) for r in xuat_rows}

    # 3. Active PhieuIn (chưa huỷ / hoàn thành) per LSX
    active_phieus = (
        db.query(PhieuIn)
        .filter(
            PhieuIn.production_order_id.in_(order_ids),
            PhieuIn.trang_thai.notin_(["huy", "hoan_thanh"]),
        )
        .all()
    )
    active_map: dict[int, dict] = {}
    for p in active_phieus:
        if p.production_order_id not in active_map:
            active_map[p.production_order_id] = {
                "so_phieu": p.so_phieu,
                "trang_thai": p.trang_thai,
            }

    # 4. ProductionOrder + items
    orders = (
        db.query(ProductionOrder)
        .options(
            joinedload(ProductionOrder.items),
            joinedload(ProductionOrder.sales_order),
        )
        .filter(ProductionOrder.id.in_(order_ids))
        .all()
    )
    order_map = {o.id: o for o in orders}

    result = []
    for order_id in order_ids:
        nhap = nhap_map[order_id]
        tong_nhap = nhap["tong_nhap"]
        tong_xuat = xuat_map.get(order_id, 0.0)
        ton_kho = round(tong_nhap - tong_xuat, 3)

        order = order_map.get(order_id)
        if not order:
            continue

        first = order.items[0] if order.items else None
        co_in = any(it.loai_in in ("flexo", "ky_thuat_so") for it in order.items)

        ten_khach_hang = None
        if order.sales_order:
            kh = getattr(order.sales_order, "customer", None)
            if kh:
                ten_khach_hang = getattr(kh, "ten_viet_tat", None) or getattr(kh, "ten_kh", None)

        result.append({
            "production_order_id": order_id,
            "so_lenh": order.so_lenh,
            "ten_hang": first.ten_hang if first else "",
            "ten_khach_hang": ten_khach_hang,
            "tong_nhap": tong_nhap,
            "tong_xuat": tong_xuat,
            "ton_kho": ton_kho,
            "co_in": co_in,
            "warehouse_id": nhap["warehouse_id"],
            "phieu_in_hien_tai": active_map.get(order_id),
        })

    result.sort(key=lambda x: (-x["ton_kho"], x["so_lenh"]))
    return result
