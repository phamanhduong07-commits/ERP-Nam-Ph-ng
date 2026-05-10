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
from app.models.master import Warehouse, PhanXuong
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.phieu_xuat_phoi import PhieuXuatPhoi, PhieuXuatPhoiItem
from app.models.warehouse_doc import PhieuChuyenKho, PhieuChuyenKhoItem
from app.models.inventory import InventoryBalance

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
    from app.services.accounting_service import AccountingService

    items_data = list(data.items)  # snapshot trước commit
    journal_items = []

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
        
        # Chuẩn bị dữ liệu hạch toán
        journal_items.append({
            "ten_hang": it.ten_hang,
            "so_luong": it.so_luong,
            "don_gia": don_gia_xuat,
            "tk_no": "621",  # Chi phí NVL trực tiếp
            "tk_co": "155" if it.production_order_item_id else "152" 
        })

    # Hạch toán kế toán tự động
    if journal_items:
        acc_service = AccountingService(db)
        # Lấy pháp nhân từ xưởng của item đầu tiên
        poi_first = db.get(ProductionOrderItem, items_data[0].production_order_item_id)
        order_first = db.get(ProductionOrder, poi_first.production_order_id) if poi_first else None
        wh_first = get_workshop_warehouse(db, order_first.phan_xuong_id, "PHOI") if order_first else None
        phap_nhan_id = wh_first.phan_xuong_obj.phap_nhan_id if wh_first and wh_first.phan_xuong_obj else None

        acc_service.post_inventory_journal(
            ngay=phieu.ngay,
            loai="XUAT_PHOI",
            chung_tu_loai="phieu_xuat_phoi",
            chung_tu_id=phieu.id,
            items=journal_items,
            phap_nhan_id=phap_nhan_id,
            phan_xuong_id=order_first.phan_xuong_id if order_first else None
        )

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
    """
    Tổng hợp tồn kho phôi sóng theo LSX và Xưởng.
    Tồn = (Nhập SX + Nhập Chuyển) - (Xuất SX + Xuất Chuyển đi)
    """
    from app.models.cd2 import PhieuIn

    # 1. Nhập phôi từ sản xuất (CD1): sum(so_tam) per (production_order_id, warehouse_id)
    nhap_rows = (
        db.query(
            PhieuNhapPhoiSong.production_order_id,
            PhieuNhapPhoiSong.warehouse_id,
            func.coalesce(func.sum(PhieuNhapPhoiSongItem.so_tam), 0).label("tong_nhap_sx"),
            func.max(PhieuNhapPhoiSongItem.chieu_kho).label("chieu_kho"),
            func.max(PhieuNhapPhoiSongItem.chieu_cat).label("chieu_cat"),
        )
        .join(PhieuNhapPhoiSongItem, PhieuNhapPhoiSongItem.phieu_id == PhieuNhapPhoiSong.id)
        .group_by(PhieuNhapPhoiSong.production_order_id, PhieuNhapPhoiSong.warehouse_id)
        .all()
    )

    # 2. Xuất phôi cho sản xuất (CD1/CD2): sum per (production_order_id, warehouse_id)
    # Lưu ý: Cần join qua ProductionOrder để lấy warehouse_id của xưởng sản xuất
    xuat_rows = (
        db.query(
            ProductionOrderItem.production_order_id,
            Warehouse.id.label("warehouse_id"),
            func.coalesce(func.sum(PhieuXuatPhoiItem.so_luong), 0).label("tong_xuat_sx"),
        )
        .join(PhieuXuatPhoiItem, PhieuXuatPhoiItem.production_order_item_id == ProductionOrderItem.id)
        .join(PhieuXuatPhoi, PhieuXuatPhoi.id == PhieuXuatPhoiItem.phieu_id)
        .join(ProductionOrder, ProductionOrder.id == ProductionOrderItem.production_order_id)
        # Tìm kho PHOI của xưởng sản xuất lệnh đó
        .join(Warehouse, (Warehouse.phan_xuong_id == ProductionOrder.phan_xuong_id) & (Warehouse.loai_kho == "PHOI"))
        .group_by(ProductionOrderItem.production_order_id, Warehouse.id)
        .all()
    )

    # 3. Chuyển kho (Đi/Đến)
    chuyen_xuat_rows = (
        db.query(
            PhieuChuyenKhoItem.production_order_id,
            PhieuChuyenKho.warehouse_xuat_id.label("warehouse_id"),
            func.coalesce(func.sum(PhieuChuyenKhoItem.so_luong), 0).label("tong_chuyen_xuat"),
        )
        .join(PhieuChuyenKho, PhieuChuyenKho.id == PhieuChuyenKhoItem.phieu_chuyen_kho_id)
        .group_by(PhieuChuyenKhoItem.production_order_id, PhieuChuyenKho.warehouse_xuat_id)
        .all()
    )

    chuyen_nhap_rows = (
        db.query(
            PhieuChuyenKhoItem.production_order_id,
            PhieuChuyenKho.warehouse_nhap_id.label("warehouse_id"),
            func.coalesce(func.sum(PhieuChuyenKhoItem.so_luong), 0).label("tong_chuyen_nhap"),
        )
        .join(PhieuChuyenKho, PhieuChuyenKho.id == PhieuChuyenKhoItem.phieu_chuyen_kho_id)
        .group_by(PhieuChuyenKhoItem.production_order_id, PhieuChuyenKho.warehouse_nhap_id)
        .all()
    )

    # 4. Gom tất cả tổ hợp (LSX, Kho) có phát sinh
    stats = {} # (order_id, wh_id) -> data

    for r in nhap_rows:
        key = (r.production_order_id, r.warehouse_id)
        stats.setdefault(key, {"nhap": 0.0, "xuat": 0.0, "chuyen_di": 0.0, "chuyen_den": 0.0, "chieu_kho": r.chieu_kho, "chieu_cat": r.chieu_cat})
        stats[key]["nhap"] += float(r.tong_nhap_sx)

    for r in xuat_rows:
        key = (r.production_order_id, r.warehouse_id)
        stats.setdefault(key, {"nhap": 0.0, "xuat": 0.0, "chuyen_di": 0.0, "chuyen_den": 0.0, "chieu_kho": None, "chieu_cat": None})
        stats[key]["xuat"] += float(r.tong_xuat_sx)

    for r in chuyen_xuat_rows:
        key = (r.production_order_id, r.warehouse_id)
        stats.setdefault(key, {"nhap": 0.0, "xuat": 0.0, "chuyen_di": 0.0, "chuyen_den": 0.0, "chieu_kho": None, "chieu_cat": None})
        stats[key]["chuyen_di"] += float(r.tong_chuyen_xuat)

    for r in chuyen_nhap_rows:
        key = (r.production_order_id, r.warehouse_id)
        stats.setdefault(key, {"nhap": 0.0, "xuat": 0.0, "chuyen_di": 0.0, "chuyen_den": 0.0, "chieu_kho": None, "chieu_cat": None})
        stats[key]["chuyen_den"] += float(r.tong_chuyen_nhap)

    if not stats:
        return []

    order_ids = list({k[0] for k in stats.keys()})
    
    from app.models.sales import SalesOrder
    from app.models.master import Customer

    # Lấy thông tin Lệnh SX
    orders = (
        db.query(ProductionOrder)
        .options(
            joinedload(ProductionOrder.items),
            joinedload(ProductionOrder.sales_order).joinedload(SalesOrder.customer),
            joinedload(ProductionOrder.phan_xuong),
            joinedload(ProductionOrder.phap_nhan),
        )
        .filter(ProductionOrder.id.in_(order_ids))
        .all()
    )
    order_map = {o.id: o for o in orders}

    # Lấy thông tin Kho
    wh_ids = list({k[1] for k in stats.keys()})
    warehouses = db.query(Warehouse).options(joinedload(Warehouse.phan_xuong_obj)).filter(Warehouse.id.in_(wh_ids)).all()
    wh_map = {w.id: w for w in warehouses}

    # Lấy tất cả phân xưởng để tra cứu nhanh và chính xác
    all_px = db.query(PhanXuong).all()
    px_map = {px.id: px for px in all_px}

    # Lấy PhieuIn đang active
    active_phieus = (
        db.query(PhieuIn)
        .filter(PhieuIn.production_order_id.in_(order_ids), PhieuIn.trang_thai.notin_(["huy", "hoan_thanh"]))
        .all()
    )
    active_map = {p.production_order_id: {"so_phieu": p.so_phieu, "trang_thai": p.trang_thai} for p in active_phieus}

    result = []
    for (order_id, wh_id), data in stats.items():
        order = order_map.get(order_id)
        wh = wh_map.get(wh_id)
        if not order or not wh:
            continue

        # Tồn = (Nhập SX + Nhập Chuyển) - (Xuất SX + Xuất Chuyển)
        ton_kho = round((data["nhap"] + data["chuyen_den"]) - (data["xuat"] + data["chuyen_di"]), 3)
        
        # Nếu tồn <= 0 và không có nhập thì bỏ qua
        if ton_kho <= 0 and (data["nhap"] + data["chuyen_den"]) == 0:
            continue

        first = order.items[0] if order.items else None
        ten_khach_hang = None
        if order.sales_order and order.sales_order.customer:
            kh = order.sales_order.customer
            ten_khach_hang = kh.ten_viet_tat or kh.ten_kh

        px_wh = px_map.get(wh.phan_xuong_id)
        px_order = px_map.get(order.phan_xuong_id)
        pn = getattr(order, "phap_nhan", None)

        result.append({
            "production_order_id": order_id,
            "so_lenh": order.so_lenh,
            "ten_hang": first.ten_hang if first else "",
            "ten_khach_hang": ten_khach_hang,
            "tong_nhap": data["nhap"] + data["chuyen_den"],
            "tong_xuat": data["xuat"] + data["chuyen_di"],
            "ton_kho": ton_kho,
            "warehouse_id": wh_id,
            "ten_kho": wh.ten_kho,
            "chieu_kho": data["chieu_kho"],
            "chieu_cat": data["chieu_cat"],
            "phieu_in_hien_tai": active_map.get(order_id),
            "phan_xuong_id": wh.phan_xuong_id,
            "ten_phan_xuong": px_wh.ten_xuong.replace("Xưởng ", "Kho phôi ") if px_wh and px_wh.ten_xuong else None,
            "cong_doan": px_wh.cong_doan if px_wh else None,
            "order_ten_phan_xuong": px_order.ten_xuong if px_order else None,
            "phap_nhan_sx_id": order.phap_nhan_id,
            "ten_phap_nhan_sx": pn.ten_viet_tat or pn.ma_phap_nhan if pn else None,
        })

    result.sort(key=lambda x: (-x["ton_kho"], x["so_lenh"]))
    return result
