"""
Router: Phiếu nhập / xuất phôi sóng
GET  /api/phieu-phoi/nhap          — danh sách phiếu nhập
GET  /api/phieu-phoi/nhap/{id}     — chi tiết phiếu nhập
GET  /api/phieu-phoi/xuat          — danh sách phiếu xuất
POST /api/phieu-phoi/xuat          — tạo phiếu xuất mới
GET  /api/phieu-phoi/xuat/{id}     — chi tiết phiếu xuất
"""
from datetime import date
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import exists, func, or_
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.deps import get_current_user, get_sale_visible_nv_ids, require_any_permission
import logging
from app.models.auth import User
from app.models.master import Warehouse, PhanXuong, Customer, CustomerNhanVien
from app.models.sales import SalesOrder
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.phieu_xuat_phoi import PhieuXuatPhoi, PhieuXuatPhoiItem
from app.models.phieu_tra_hang import PhieuTraHang, PhieuTraHangItem
from app.models.warehouse_doc import PhieuChuyenKho, PhieuChuyenKhoItem
from app.models.inventory import InventoryTransaction
from app.services.carton_metrics import dec_or_zero, _to_hop_song, song_take_up, standard_thickness_m

_log = logging.getLogger("erp")

_SALE_STAFF_ROLES = {"SALE_ADMIN", "KINH_DOANH_NHAN_VIEN"}

router = APIRouter(
    prefix="/api/phieu-phoi",
    dependencies=[Depends(require_any_permission("production_order.view", "inventory.view", "inventory.phoi_tp"))],
    tags=["phieu-phoi"],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_so_phieu_xuat(db: Session) -> str:
    today = date.today()
    prefix = f"PXPS-{today.strftime('%Y%m')}-"
    last = (
        db.query(PhieuXuatPhoi)
        .filter(PhieuXuatPhoi.so_phieu.like(f"{prefix}%"))
        .order_by(PhieuXuatPhoi.so_phieu.desc())
        .with_for_update()
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
        "trang_thai_loi": it.trang_thai_loi,
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

class NhapItemUpdate(BaseModel):
    id: int
    so_luong_thuc_te: Decimal | None = None
    so_luong_loi: Decimal | None = None
    chieu_kho: Decimal | None = None
    chieu_cat: Decimal | None = None
    so_tam: int | None = None
    ghi_chu: str | None = None


class NhapUpdate(BaseModel):
    ngay: date | None = None
    ca: str | None = None
    gio_bat_dau: str | None = None
    gio_ket_thuc: str | None = None
    ghi_chu: str | None = None
    items: list[NhapItemUpdate] | None = None


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


@router.patch("/nhap/{phieu_id}")
def update_phieu_nhap(
    phieu_id: int,
    data: NhapUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("production_order.edit", "production_order.complete")),
):
    """Cập nhật phiếu nhập phôi sóng (header + items)."""
    p = (
        db.query(PhieuNhapPhoiSong)
        .options(joinedload(PhieuNhapPhoiSong.items))
        .filter(PhieuNhapPhoiSong.id == phieu_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu nhập")

    if data.ngay is not None:
        p.ngay = data.ngay
    if data.ca is not None:
        p.ca = data.ca
    if data.gio_bat_dau is not None:
        p.gio_bat_dau = data.gio_bat_dau
    if data.gio_ket_thuc is not None:
        p.gio_ket_thuc = data.gio_ket_thuc
    if data.ghi_chu is not None:
        p.ghi_chu = data.ghi_chu

    if data.items:
        item_map = {it.id: it for it in p.items}
        for upd in data.items:
            it = item_map.get(upd.id)
            if not it:
                continue
            if upd.so_luong_thuc_te is not None:
                it.so_luong_thuc_te = upd.so_luong_thuc_te
            if upd.so_luong_loi is not None:
                it.so_luong_loi = upd.so_luong_loi
                it.trang_thai_loi = 'da_nhap_kho_ao' if upd.so_luong_loi > 0 else None
            if upd.chieu_kho is not None:
                it.chieu_kho = upd.chieu_kho
            if upd.chieu_cat is not None:
                it.chieu_cat = upd.chieu_cat
            if upd.so_tam is not None:
                it.so_tam = upd.so_tam
            if upd.ghi_chu is not None:
                it.ghi_chu = upd.ghi_chu

    db.commit()
    db.refresh(p)
    return _nhap_phieu_to_dict(p, db)


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
    nv_theo_doi_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Tổng hợp tồn kho phôi sóng theo LSX và Xưởng.
    Tồn = (Nhập SX + Nhập Chuyển) - (Xuất SX + Xuất Chuyển đi)
    """
    from app.models.cd2 import PhieuIn

    role_code = current_user.role.ma_vai_tro if current_user.role else None

    # Lọc theo NV theo dõi nếu có
    allowed_order_ids: list[int] | None = None
    if nv_theo_doi_id is not None:
        allowed_order_ids = [
            r.id for r in db.query(ProductionOrder.id)
            .filter(ProductionOrder.nv_theo_doi_id == nv_theo_doi_id)
            .all()
        ]
        if not allowed_order_ids:
            return []

    # Scope theo vai trò: SALE_ADMIN/SALE_ADMIN_NHAN_VIEN/KINH_DOANH_NHAN_VIEN chỉ thấy KH được phân công
    _scope_nv_ids = get_sale_visible_nv_ids(current_user)
    if _scope_nv_ids is not None:
        scoped_cids = {row.id for row in db.query(Customer.id).filter(
            or_(
                Customer.nv_phu_trach_id.in_(_scope_nv_ids),
                exists().where(
                    (CustomerNhanVien.customer_id == Customer.id)
                    & (CustomerNhanVien.user_id.in_(_scope_nv_ids))
                ),
            )
        ).all()}
        role_order_ids = [
            r.id for r in db.query(ProductionOrder.id)
            .join(SalesOrder, SalesOrder.id == ProductionOrder.sales_order_id)
            .filter(SalesOrder.customer_id.in_(scoped_cids))
            .all()
        ]
        if allowed_order_ids is not None:
            allowed_order_ids = [oid for oid in allowed_order_ids if oid in set(role_order_ids)]
        else:
            allowed_order_ids = role_order_ids
        if not allowed_order_ids:
            return []

    # 1. Nhập phôi từ sản xuất (CD1): sum(so_tam) per (production_order_id, warehouse_id)
    nhap_q = (
        db.query(
            PhieuNhapPhoiSong.production_order_id,
            PhieuNhapPhoiSong.warehouse_id,
            func.coalesce(func.sum(PhieuNhapPhoiSongItem.so_tam), 0).label("tong_nhap_sx"),
            func.coalesce(func.sum(PhieuNhapPhoiSongItem.so_luong_thuc_te), 0).label("tong_con_thuc_te"),
            func.coalesce(func.sum(PhieuNhapPhoiSongItem.so_luong_loi), 0).label("tong_con_loi"),
            func.max(PhieuNhapPhoiSongItem.chieu_kho).label("chieu_kho"),
            func.max(PhieuNhapPhoiSongItem.chieu_cat).label("chieu_cat"),
            func.min(PhieuNhapPhoiSong.ngay).label("ngay_nhap_kho"),
        )
        .join(PhieuNhapPhoiSongItem, PhieuNhapPhoiSongItem.phieu_id == PhieuNhapPhoiSong.id)
    )
    if allowed_order_ids is not None:
        nhap_q = nhap_q.filter(PhieuNhapPhoiSong.production_order_id.in_(allowed_order_ids))
    nhap_rows = nhap_q.group_by(PhieuNhapPhoiSong.production_order_id, PhieuNhapPhoiSong.warehouse_id).all()

    # 2. Xuất phôi cho sản xuất (CD1/CD2): sum per (production_order_id, warehouse_id)
    xuat_q = (
        db.query(
            ProductionOrderItem.production_order_id,
            Warehouse.id.label("warehouse_id"),
            func.coalesce(func.sum(PhieuXuatPhoiItem.so_luong), 0).label("tong_xuat_sx"),
        )
        .join(PhieuXuatPhoiItem, PhieuXuatPhoiItem.production_order_item_id == ProductionOrderItem.id)
        .join(PhieuXuatPhoi, PhieuXuatPhoi.id == PhieuXuatPhoiItem.phieu_id)
        .join(ProductionOrder, ProductionOrder.id == ProductionOrderItem.production_order_id)
        .join(Warehouse, (Warehouse.phan_xuong_id == ProductionOrder.phan_xuong_id) & (Warehouse.loai_kho == "PHOI"))
    )
    if allowed_order_ids is not None:
        xuat_q = xuat_q.filter(ProductionOrderItem.production_order_id.in_(allowed_order_ids))
    xuat_rows = xuat_q.group_by(ProductionOrderItem.production_order_id, Warehouse.id).all()

    # 3. Chuyển kho (Đi/Đến)
    chuyen_xuat_q = (
        db.query(
            PhieuChuyenKhoItem.production_order_id,
            PhieuChuyenKho.warehouse_xuat_id.label("warehouse_id"),
            func.coalesce(func.sum(PhieuChuyenKhoItem.so_luong), 0).label("tong_chuyen_xuat"),
        )
        .join(PhieuChuyenKho, PhieuChuyenKho.id == PhieuChuyenKhoItem.phieu_chuyen_kho_id)
        .filter(PhieuChuyenKho.trang_thai == "da_duyet")
    )
    if allowed_order_ids is not None:
        chuyen_xuat_q = chuyen_xuat_q.filter(PhieuChuyenKhoItem.production_order_id.in_(allowed_order_ids))
    chuyen_xuat_rows = chuyen_xuat_q.group_by(
        PhieuChuyenKhoItem.production_order_id, PhieuChuyenKho.warehouse_xuat_id
    ).all()

    chuyen_nhap_q = (
        db.query(
            PhieuChuyenKhoItem.production_order_id,
            PhieuChuyenKho.warehouse_nhap_id.label("warehouse_id"),
            func.coalesce(func.sum(PhieuChuyenKhoItem.so_luong), 0).label("tong_chuyen_nhap"),
        )
        .join(PhieuChuyenKho, PhieuChuyenKho.id == PhieuChuyenKhoItem.phieu_chuyen_kho_id)
        .filter(PhieuChuyenKho.trang_thai == "da_duyet")
    )
    if allowed_order_ids is not None:
        chuyen_nhap_q = chuyen_nhap_q.filter(PhieuChuyenKhoItem.production_order_id.in_(allowed_order_ids))
    chuyen_nhap_rows = chuyen_nhap_q.group_by(
        PhieuChuyenKhoItem.production_order_id, PhieuChuyenKho.warehouse_nhap_id
    ).all()

    # 5. Khách trả phôi (tốt) — confirmed only
    tra_khach_q = (
        db.query(
            PhieuTraHang.production_order_id,
            PhieuTraHang.warehouse_id,
            func.coalesce(func.sum(PhieuTraHangItem.so_luong), 0).label("tong_tra"),
        )
        .join(PhieuTraHangItem, PhieuTraHangItem.phieu_id == PhieuTraHang.id)
        .filter(
            PhieuTraHang.loai_hang == "PHOI",
            PhieuTraHang.trang_thai == "confirmed",
            PhieuTraHangItem.tinh_trang == "tot",
        )
    )
    if allowed_order_ids is not None:
        tra_khach_q = tra_khach_q.filter(PhieuTraHang.production_order_id.in_(allowed_order_ids))
    tra_khach_rows = tra_khach_q.group_by(
        PhieuTraHang.production_order_id, PhieuTraHang.warehouse_id
    ).all()

    # 5b. Phôi đã đẩy sang kho tận dụng — query từ InventoryTransaction
    tan_dung_q = (
        db.query(
            PhieuNhapPhoiSong.production_order_id,
            PhieuNhapPhoiSong.warehouse_id,
            func.coalesce(func.sum(InventoryTransaction.so_luong), 0).label("tong_tan_dung"),
        )
        .join(
            InventoryTransaction,
            (InventoryTransaction.chung_tu_loai == "phieu_nhap_phoi_song")
            & (InventoryTransaction.chung_tu_id == PhieuNhapPhoiSong.id)
            & (InventoryTransaction.loai_giao_dich == "NHAP_PHOI_DU"),
        )
    )
    if allowed_order_ids is not None:
        tan_dung_q = tan_dung_q.filter(PhieuNhapPhoiSong.production_order_id.in_(allowed_order_ids))
    tan_dung_rows = tan_dung_q.group_by(
        PhieuNhapPhoiSong.production_order_id, PhieuNhapPhoiSong.warehouse_id
    ).all()

    # 5c. Phôi bán phế — NHAP_PHOI_LOI linked to phieu_nhap_phoi_song
    ban_phe_q = (
        db.query(
            PhieuNhapPhoiSong.production_order_id,
            PhieuNhapPhoiSong.warehouse_id,
            func.coalesce(func.sum(InventoryTransaction.so_luong), 0).label("tong_ban_phe"),
        )
        .join(
            InventoryTransaction,
            (InventoryTransaction.chung_tu_loai == "phieu_nhap_phoi_song")
            & (InventoryTransaction.chung_tu_id == PhieuNhapPhoiSong.id)
            & (InventoryTransaction.loai_giao_dich == "NHAP_PHOI_LOI"),
        )
    )
    if allowed_order_ids is not None:
        ban_phe_q = ban_phe_q.filter(PhieuNhapPhoiSong.production_order_id.in_(allowed_order_ids))
    ban_phe_rows = ban_phe_q.group_by(
        PhieuNhapPhoiSong.production_order_id, PhieuNhapPhoiSong.warehouse_id
    ).all()

    # 4. Gom tất cả tổ hợp (LSX, Kho) có phát sinh
    stats = {}  # (order_id, wh_id) -> data

    for r in nhap_rows:
        key = (r.production_order_id, r.warehouse_id)
        stats.setdefault(key, {"nhap": 0.0, "xuat": 0.0, "chuyen_di": 0.0, "chuyen_den": 0.0,
                         "chieu_kho": r.chieu_kho, "chieu_cat": r.chieu_cat, "ngay_nhap_kho": None, "con": 0.0})
        stats[key]["nhap"] += float(r.tong_nhap_sx)
        stats[key]["con"] = stats[key].get("con", 0.0) + max(0.0, float(r.tong_con_thuc_te) - float(r.tong_con_loi))
        if r.ngay_nhap_kho:
            cur = stats[key].get("ngay_nhap_kho")
            if cur is None or r.ngay_nhap_kho < cur:
                stats[key]["ngay_nhap_kho"] = r.ngay_nhap_kho

    for r in xuat_rows:
        key = (r.production_order_id, r.warehouse_id)
        stats.setdefault(key, {"nhap": 0.0, "xuat": 0.0, "chuyen_di": 0.0,
                         "chuyen_den": 0.0, "chieu_kho": None, "chieu_cat": None})
        stats[key]["xuat"] += float(r.tong_xuat_sx)

    for r in chuyen_xuat_rows:
        key = (r.production_order_id, r.warehouse_id)
        stats.setdefault(key, {"nhap": 0.0, "xuat": 0.0, "chuyen_di": 0.0,
                         "chuyen_den": 0.0, "chieu_kho": None, "chieu_cat": None})
        stats[key]["chuyen_di"] += float(r.tong_chuyen_xuat)

    for r in chuyen_nhap_rows:
        key = (r.production_order_id, r.warehouse_id)
        stats.setdefault(key, {"nhap": 0.0, "xuat": 0.0, "chuyen_di": 0.0,
                         "chuyen_den": 0.0, "chieu_kho": None, "chieu_cat": None})
        stats[key]["chuyen_den"] += float(r.tong_chuyen_nhap)

    for r in tra_khach_rows:
        key = (r.production_order_id, r.warehouse_id)
        stats.setdefault(key, {"nhap": 0.0, "xuat": 0.0, "chuyen_di": 0.0,
                         "chuyen_den": 0.0, "tra_khach": 0.0, "chieu_kho": None, "chieu_cat": None})
        stats[key].setdefault("tra_khach", 0.0)
        stats[key]["tra_khach"] += float(r.tong_tra)

    for r in tan_dung_rows:
        key = (r.production_order_id, r.warehouse_id)
        stats.setdefault(key, {"nhap": 0.0, "xuat": 0.0, "chuyen_di": 0.0,
                         "chuyen_den": 0.0, "tan_dung": 0.0, "chieu_kho": None, "chieu_cat": None})
        stats[key].setdefault("tan_dung", 0.0)
        stats[key]["tan_dung"] += float(r.tong_tan_dung)

    for r in ban_phe_rows:
        key = (r.production_order_id, r.warehouse_id)
        stats.setdefault(key, {"nhap": 0.0, "xuat": 0.0, "chuyen_di": 0.0,
                         "chuyen_den": 0.0, "ban_phe": 0.0, "chieu_kho": None, "chieu_cat": None})
        stats[key].setdefault("ban_phe", 0.0)
        stats[key]["ban_phe"] += float(r.tong_ban_phe)

    if not stats:
        return []

    order_ids = list({k[0] for k in stats.keys()})

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
    warehouses = db.query(Warehouse).options(
        joinedload(
            Warehouse.phan_xuong_obj)).filter(
        Warehouse.id.in_(wh_ids)).all()
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

    # so_dao từ production_plan_lines — để tính con_nho = tong_nhap_tam × so_dao
    from app.models.production_plan import ProductionPlanLine
    poi_ids = [item.id for o in orders for item in o.items]
    plan_lines = db.query(ProductionPlanLine).filter(
        ProductionPlanLine.production_order_item_id.in_(poi_ids)
    ).all() if poi_ids else []
    so_dao_map = {pl.production_order_item_id: pl.so_dao for pl in plan_lines}

    result = []
    for (order_id, wh_id), data in stats.items():
        order = order_map.get(order_id)
        wh = wh_map.get(wh_id)
        if not order or not wh:
            continue

        # Tồn = (Nhập SX + Nhập Chuyển + Trả KH tốt) - (Xuất SX + Xuất Chuyển + Tận dụng + Bán Phế)
        tra_khach = data.get("tra_khach", 0.0)
        tan_dung  = data.get("tan_dung", 0.0)
        ban_phe   = data.get("ban_phe", 0.0)
        ton_kho = round((data["nhap"] + data["chuyen_den"] + tra_khach) - (data["xuat"] + data["chuyen_di"] + tan_dung + ban_phe), 3)

        # Nếu tồn <= 0 và không có nhập thì bỏ qua
        if ton_kho <= 0 and (data["nhap"] + data["chuyen_den"] + tra_khach) == 0:
            continue

        first = order.items[0] if order.items else None
        ten_khach_hang = None
        if order.sales_order and order.sales_order.customer:
            kh = order.sales_order.customer
            ten_khach_hang = kh.ten_viet_tat or kh.ten_kh

        px_wh = px_map.get(wh.phan_xuong_id)
        px_order = px_map.get(order.phan_xuong_id)
        pn = getattr(order, "phap_nhan", None)

        # Tính diện tích / trọng lượng / thể tích theo kích thước tấm phôi thực tế
        kho_mm = Decimal(str(data["chieu_kho"] or 0))
        cat_mm = Decimal(str(data["chieu_cat"] or 0))
        qty = Decimal(str(ton_kho))
        phoi_area = kho_mm * cat_mm * qty / Decimal("1000000")  # m²

        trong_luong = Decimal("0")
        the_tich = Decimal("0")
        if first and phoi_area > 0:
            gsm_total = Decimal("0")
            for _f in ("mat_dl", "mat_1_dl", "mat_2_dl", "mat_3_dl"):
                gsm_total += dec_or_zero(getattr(first, _f, None))
            to_hop = _to_hop_song(first)
            for _idx, _f in enumerate(("song_1_dl", "song_2_dl", "song_3_dl")):
                gsm_total += dec_or_zero(getattr(first, _f, None)) * song_take_up(to_hop, _idx)
            trong_luong = phoi_area * gsm_total / Decimal("1000")
            the_tich = phoi_area * standard_thickness_m(to_hop)

        result.append({
            "production_order_id": order_id,
            "so_lenh": order.so_lenh,
            "ten_hang": first.ten_hang if first else "",
            "ten_khach_hang": ten_khach_hang,
            "tong_nhap": data["nhap"] + data["chuyen_den"],
            "tong_xuat": data["xuat"] + data["chuyen_di"],
            "tong_tra_khach": tra_khach,
            "ton_kho": ton_kho,
            "ton_kho_tai_nguon": max(0.0, round(data["nhap"] + tra_khach - data["chuyen_di"], 3)),
            "ton_kho_tai_cd2": max(0.0, round(data["chuyen_den"] - data["xuat"], 3)),
            "warehouse_id": wh_id,
            "ten_kho": wh.ten_kho,
            "chieu_kho": data["chieu_kho"],
            "chieu_cat": data["chieu_cat"],
            "tong_con": round((data["nhap"] + data["chuyen_den"]) * (so_dao_map.get(first.id) or 0)) if first else 0,
            "dien_tich": float(phoi_area),
            "trong_luong": float(trong_luong),
            "the_tich": float(the_tich),
            "ngay_nhap_kho": data["ngay_nhap_kho"].isoformat() if data.get("ngay_nhap_kho") else None,
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
