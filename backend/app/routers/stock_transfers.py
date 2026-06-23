"""Warehouse router — phiếu chuyển kho (PhieuChuyenKho).

Split out of app/routers/warehouse.py (pure structural extraction).
Shares the /api/warehouse prefix; mounted alongside warehouse.router.
"""
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, aliased, joinedload
from app.database import get_db
from app.deps import get_current_user, require_any_permission, require_roles
from app.models.auth import User
from app.models.master import Warehouse, PaperMaterial, OtherMaterial, Product, PhanXuong, PhapNhan
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.sales import SalesOrder, SalesOrderItem, QuoteItem
from app.models.addon_rate import AddonRate
from app.models.accounting import JournalEntry
from app.models.warehouse_doc import (
    PhieuChuyenKho, PhieuChuyenKhoItem, ProductionOutput,
)
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.cd2 import PhieuIn
from app.services.accounting_service import AccountingService
from app.utils.log import get_logger
from app.services.price_calculator import (
    _calc_chong_tham,
    _calc_in_flexo,
    _calc_in_ky_thuat_so,
    _calc_chap_xa,
    _calc_boi,
    _calc_be,
    _calc_dan,
    _calc_ghim,
    _calc_can_mang,
)

logger = get_logger(__name__)

from app.services.inventory_service import (
    get_or_create_balance as _get_or_create_balance,
    nhap_balance as _nhap_balance,
    xuat_balance as _xuat_balance,
    log_tx as _log_tx,
)

from app.routers.warehouse import (  # shared schemas + helpers
    PhieuChuyenIn,
    _gen_so,
    _resolve_nvl_name,
    _ensure_active_warehouse,
)
from app.routers.production_orders import _generate_so_lenh as _gen_so_lenh_po

router = APIRouter(
    prefix="/api/warehouse",
    dependencies=[Depends(require_any_permission("inventory.transfer"))],
    tags=["warehouse"],
)


# ── Helpers BTP ───────────────────────────────────────────────────────────────

def _gen_so_phieu_pi(db: Session) -> str:
    """Tạo số phiếu in mới (PIN-YYYYMM-XXXX)."""
    today = date.today()
    prefix = f"PIN-{today.strftime('%Y%m')}-"
    last = (db.query(PhieuIn)
             .filter(PhieuIn.so_phieu.like(f"{prefix}%"))
             .order_by(PhieuIn.so_phieu.desc())
             .with_for_update()
             .first())
    seq = (int(last.so_phieu[-4:]) + 1) if last else 1
    return f"{prefix}{seq:04d}"


def _auto_create_btp_workflow(
    db: Session,
    parent_lsx_id: int,
    product_id: int,
    so_luong: "Decimal",
    warehouse_nhap_id: int,
    created_by: int,
) -> None:
    """Khi duyệt phiếu chuyển BTP: tự tạo LSX con + PhieuIn tại xưởng đích.

    LSX con liên kết parent_production_order_id → parent_lsx_id.
    PhieuIn có trang_thai='cho_dinh_hinh' → hiện trên SauInKanbanPage xưởng đích.
    """
    parent_lsx = db.get(ProductionOrder, parent_lsx_id)
    if not parent_lsx:
        return

    wh_nhap = db.get(Warehouse, warehouse_nhap_id)
    phan_xuong_nhap_id = wh_nhap.phan_xuong_id if wh_nhap else None

    parent_item = next(
        (i for i in parent_lsx.items if i.product_id == product_id),
        parent_lsx.items[0] if parent_lsx.items else None,
    )

    so_lenh = _gen_so_lenh_po(db)
    child_lsx = ProductionOrder(
        so_lenh=so_lenh,
        ngay_lenh=date.today(),
        phan_xuong_id=phan_xuong_nhap_id,
        parent_production_order_id=parent_lsx_id,
        phap_nhan_id=parent_lsx.phap_nhan_id,
        sales_order_id=parent_lsx.sales_order_id,
        kho_sx_id=warehouse_nhap_id,
        trang_thai="moi",
        created_by=created_by,
        ghi_chu=f"Từ LSX {parent_lsx.so_lenh} (chuyển BTP)",
    )
    db.add(child_lsx)
    db.flush()

    ten_hang = ""
    quy_cach = None
    if parent_item:
        child_item = ProductionOrderItem(
            production_order_id=child_lsx.id,
            product_id=product_id,
            sales_order_item_id=parent_item.sales_order_item_id,
            ten_hang=parent_item.ten_hang,
            so_luong_ke_hoach=so_luong,
            dvt=parent_item.dvt,
            ngay_giao_hang=parent_item.ngay_giao_hang,
            loai_thung=parent_item.loai_thung,
            dai=parent_item.dai, rong=parent_item.rong, cao=parent_item.cao,
            so_lop=parent_item.so_lop,
            to_hop_song=parent_item.to_hop_song,
            mat=parent_item.mat, mat_dl=parent_item.mat_dl,
            song_1=parent_item.song_1, song_1_dl=parent_item.song_1_dl,
            mat_1=parent_item.mat_1, mat_1_dl=parent_item.mat_1_dl,
            song_2=parent_item.song_2, song_2_dl=parent_item.song_2_dl,
            mat_2=parent_item.mat_2, mat_2_dl=parent_item.mat_2_dl,
            song_3=parent_item.song_3, song_3_dl=parent_item.song_3_dl,
            mat_3=parent_item.mat_3, mat_3_dl=parent_item.mat_3_dl,
            kho_tt=parent_item.kho_tt, dai_tt=parent_item.dai_tt,
            so_lan_cat=parent_item.so_lan_cat, be_so_con=parent_item.be_so_con,
            dien_tich=parent_item.dien_tich,
        )
        db.add(child_item)
        db.flush()
        ten_hang = parent_item.ten_hang or ""
        if parent_item.dai and parent_item.rong and parent_item.cao:
            quy_cach = f"{int(parent_item.dai)}×{int(parent_item.rong)}×{int(parent_item.cao)}"

    so_don = parent_lsx.sales_order.so_don if parent_lsx.sales_order else None
    phieu_in = PhieuIn(
        so_phieu=_gen_so_phieu_pi(db),
        production_order_id=child_lsx.id,
        trang_thai="cho_dinh_hinh",
        ten_hang=ten_hang,
        quy_cach=quy_cach,
        so_luong_phoi=so_luong,
        phan_xuong_id=phan_xuong_nhap_id,
        so_don=so_don,
        ngay_lenh=date.today(),
        created_by=created_by,
    )
    db.add(phieu_in)


# ── Phiếu chuyển kho ──────────────────────────────────────────────────────────

@router.get("/phieu-chuyen")
def list_phieu_chuyen(
    warehouse_xuat_id: Optional[int] = Query(None),
    warehouse_nhap_id: Optional[int] = Query(None),
    phan_xuong_xuat_id: Optional[int] = Query(None),
    phan_xuong_nhap_id: Optional[int] = Query(None),
    phap_nhan_xuat_id: Optional[int] = Query(None),
    phap_nhan_nhap_id: Optional[int] = Query(None),
    phap_nhan_id: Optional[int] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(PhieuChuyenKho)
    WhX = aliased(Warehouse)
    WhN = aliased(Warehouse)
    PxX = aliased(PhanXuong)
    PxN = aliased(PhanXuong)
    if warehouse_xuat_id:
        q = q.filter(PhieuChuyenKho.warehouse_xuat_id == warehouse_xuat_id)
    if warehouse_nhap_id:
        q = q.filter(PhieuChuyenKho.warehouse_nhap_id == warehouse_nhap_id)
    if phan_xuong_xuat_id or phap_nhan_xuat_id or phap_nhan_id:
        q = q.join(WhX, WhX.id == PhieuChuyenKho.warehouse_xuat_id)
    if phan_xuong_xuat_id:
        q = q.filter(WhX.phan_xuong_id == phan_xuong_xuat_id)
    if phap_nhan_xuat_id or phap_nhan_id:
        q = q.join(PxX, WhX.phan_xuong_id == PxX.id)
        q = q.filter(PxX.phap_nhan_id == (phap_nhan_xuat_id or phap_nhan_id))
    if phan_xuong_nhap_id or phap_nhan_nhap_id:
        q = q.join(WhN, WhN.id == PhieuChuyenKho.warehouse_nhap_id)
    if phan_xuong_nhap_id:
        q = q.filter(WhN.phan_xuong_id == phan_xuong_nhap_id)
    if phap_nhan_nhap_id:
        q = q.join(PxN, WhN.phan_xuong_id == PxN.id)
        q = q.filter(PxN.phap_nhan_id == phap_nhan_nhap_id)
    if tu_ngay:
        q = q.filter(PhieuChuyenKho.ngay >= tu_ngay)
    if den_ngay:
        q = q.filter(PhieuChuyenKho.ngay <= den_ngay)
    rows = q.options(joinedload(PhieuChuyenKho.items)).order_by(PhieuChuyenKho.created_at.desc()).all()
    return [_ck_to_dict(r, db) for r in rows]


@router.get("/phieu-chuyen/{phieu_id}")
def get_phieu_chuyen(phieu_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    p = db.query(PhieuChuyenKho).options(joinedload(PhieuChuyenKho.items)).filter(PhieuChuyenKho.id == phieu_id).first()
    if not p:
        raise HTTPException(404, "Không tìm thấy phiếu chuyển")
    return _ck_to_dict(p, db)


@router.post("/phieu-chuyen", status_code=201)
def create_phieu_chuyen(
    body: PhieuChuyenIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.items:
        raise HTTPException(400, "Phiếu chuyển phải có ít nhất 1 dòng hàng")
    if body.warehouse_xuat_id == body.warehouse_nhap_id:
        raise HTTPException(400, "Kho xuất và kho nhận phải khác nhau")

    if not _ensure_active_warehouse(db, body.warehouse_xuat_id) or not _ensure_active_warehouse(db, body.warehouse_nhap_id):
        raise HTTPException(404, "Không tìm thấy kho")

    for it in body.items:
        is_btp = bool(it.product_id) and bool(it.production_order_id) and not it.paper_material_id and not it.other_material_id
        is_phoi = bool(it.production_order_id) and not it.paper_material_id and not it.other_material_id and not it.product_id
        is_product = bool(it.product_id) and not it.production_order_id and not it.paper_material_id and not it.other_material_id
        if is_btp:
            bal = _get_or_create_balance(db, body.warehouse_xuat_id,
                                         product_id=it.product_id,
                                         ten_hang=it.ten_hang or f"BTP #{it.product_id}",
                                         don_vi=it.don_vi or "Cái")
            if bal.ton_luong < it.so_luong:
                prod = db.get(Product, it.product_id)
                ten = prod.ten_san_pham if prod else f"BTP #{it.product_id}"
                raise HTTPException(400, f"Không đủ tồn BTP tại kho xuất: {ten} — "
                                    f"cần {float(it.so_luong):g}, còn {float(bal.ton_luong):g}")
        elif is_phoi:
            tong_nhap = db.query(func.coalesce(func.sum(PhieuNhapPhoiSongItem.so_luong_thuc_te), 0)).join(
                PhieuNhapPhoiSong, PhieuNhapPhoiSongItem.phieu_id == PhieuNhapPhoiSong.id
            ).filter(PhieuNhapPhoiSong.production_order_id == it.production_order_id).scalar() or Decimal("0")
            tong_chuyen = db.query(func.coalesce(func.sum(PhieuChuyenKhoItem.so_luong), 0)).join(
                PhieuChuyenKho, PhieuChuyenKhoItem.phieu_chuyen_kho_id == PhieuChuyenKho.id
            ).filter(
                PhieuChuyenKhoItem.production_order_id == it.production_order_id,
                PhieuChuyenKho.trang_thai == "da_duyet"
            ).scalar() or Decimal("0")
            ton_tai_nguon = max(Decimal("0"), Decimal(str(tong_nhap)) - Decimal(str(tong_chuyen)))
            if ton_tai_nguon < it.so_luong:
                raise HTTPException(400, f"Không đủ phôi tại kho nguồn: LSX #{it.production_order_id} — "
                                    f"cần {float(it.so_luong):g}, còn {float(ton_tai_nguon):g}")
        elif is_product:
            bal = _get_or_create_balance(db, body.warehouse_xuat_id,
                                         product_id=it.product_id,
                                         ten_hang=it.ten_hang or f"SP #{it.product_id}",
                                         don_vi=it.don_vi or "Cái")
            if bal.ton_luong < it.so_luong:
                prod = db.get(Product, it.product_id)
                ten = prod.ten_san_pham if prod else f"SP #{it.product_id}"
                raise HTTPException(400, f"Không đủ tồn BTP/TP tại kho xuất: {ten} — "
                                    f"cần {float(it.so_luong):g}, còn {float(bal.ton_luong):g}")
        else:
            ten_hang, don_vi = _resolve_nvl_name(db, it.paper_material_id, it.other_material_id, it.ten_hang)
            if not ten_hang:
                ten_hang = it.ten_hang
            bal = _get_or_create_balance(db, body.warehouse_xuat_id,
                                         it.paper_material_id, it.other_material_id,
                                         ten_hang=ten_hang, don_vi=it.don_vi or don_vi)
            if bal.ton_luong < it.so_luong:
                raise HTTPException(400, f"Không đủ tồn tại kho xuất: {ten_hang} — "
                                    f"cần {float(it.so_luong):g}, còn {float(bal.ton_luong):g}")

    phieu = PhieuChuyenKho(
        so_phieu=_gen_so(db, "CK", PhieuChuyenKho),
        warehouse_xuat_id=body.warehouse_xuat_id,
        warehouse_nhap_id=body.warehouse_nhap_id,
        ngay=body.ngay,
        ghi_chu=body.ghi_chu,
        trang_thai="nhap",
        created_by=current_user.id,
    )
    db.add(phieu)
    db.flush()

    for it in body.items:
        is_btp = bool(it.product_id) and bool(it.production_order_id) and not it.paper_material_id and not it.other_material_id
        is_phoi = bool(it.production_order_id) and not it.paper_material_id and not it.other_material_id and not it.product_id
        is_product = bool(it.product_id) and not it.production_order_id and not it.paper_material_id and not it.other_material_id
        if is_btp:
            prod = db.get(Product, it.product_id)
            ten_hang = it.ten_hang or (prod.ten_san_pham if prod else f"BTP #{it.product_id}")
            bal_xuat = _get_or_create_balance(db, body.warehouse_xuat_id,
                                              product_id=it.product_id,
                                              ten_hang=ten_hang, don_vi=it.don_vi or "Cái")
            don_gia_btp = it.don_gia if it.don_gia and it.don_gia > 0 else bal_xuat.don_gia_binh_quan
            db.add(PhieuChuyenKhoItem(
                phieu_chuyen_kho_id=phieu.id,
                product_id=it.product_id,
                production_order_id=it.production_order_id,
                paper_material_id=None,
                other_material_id=None,
                ten_hang=ten_hang,
                don_vi=it.don_vi or "Cái",
                so_luong=it.so_luong,
                don_gia=don_gia_btp,
                ghi_chu=it.ghi_chu,
            ))
        elif is_phoi:
            don_gia_phoi = it.don_gia
            if (not don_gia_phoi or don_gia_phoi == Decimal("0")) and it.production_order_id:
                lsx = db.get(ProductionOrder, it.production_order_id)
                if lsx and lsx.don_gia_noi_bo and lsx.don_gia_noi_bo > 0:
                    don_gia_phoi = lsx.don_gia_noi_bo

            db.add(PhieuChuyenKhoItem(
                phieu_chuyen_kho_id=phieu.id,
                production_order_id=it.production_order_id,
                paper_material_id=None,
                other_material_id=None,
                ten_hang=it.ten_hang or f"LSX #{it.production_order_id}",
                don_vi=it.don_vi,
                so_luong=it.so_luong,
                don_gia=don_gia_phoi,
                ghi_chu=it.ghi_chu,
            ))
        elif is_product:
            prod = db.get(Product, it.product_id)
            ten_hang = it.ten_hang or (prod.ten_san_pham if prod else f"SP #{it.product_id}")
            bal_xuat = _get_or_create_balance(db, body.warehouse_xuat_id,
                                              product_id=it.product_id,
                                              ten_hang=ten_hang, don_vi=it.don_vi or "Cái")
            don_gia_xuat = it.don_gia if it.don_gia and it.don_gia > 0 else bal_xuat.don_gia_binh_quan

            db.add(PhieuChuyenKhoItem(
                phieu_chuyen_kho_id=phieu.id,
                product_id=it.product_id,
                production_order_id=None,
                paper_material_id=None,
                other_material_id=None,
                ten_hang=ten_hang,
                don_vi=it.don_vi or "Cái",
                so_luong=it.so_luong,
                don_gia=don_gia_xuat,
                ghi_chu=it.ghi_chu,
            ))
        else:
            ten_hang, don_vi = _resolve_nvl_name(db, it.paper_material_id, it.other_material_id, it.ten_hang)
            if not ten_hang:
                ten_hang = it.ten_hang
            don_vi = it.don_vi or don_vi

            bal_xuat = _get_or_create_balance(db, body.warehouse_xuat_id,
                                              it.paper_material_id, it.other_material_id,
                                              ten_hang=ten_hang, don_vi=don_vi)
            don_gia_xuat = bal_xuat.don_gia_binh_quan

            db.add(PhieuChuyenKhoItem(
                phieu_chuyen_kho_id=phieu.id,
                paper_material_id=it.paper_material_id,
                other_material_id=it.other_material_id,
                production_order_id=it.production_order_id,
                ten_hang=ten_hang,
                don_vi=don_vi,
                so_luong=it.so_luong,
                don_gia=don_gia_xuat,
                ghi_chu=it.ghi_chu,
            ))

    db.commit()
    db.refresh(phieu)
    return _ck_to_dict(phieu, db)


@router.patch("/phieu-chuyen/{phieu_id}/approve")
def approve_phieu_chuyen(
    phieu_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("KHO_TO_TRUONG", "ADMIN")),
):
    phieu = db.get(PhieuChuyenKho, phieu_id)
    if not phieu:
        raise HTTPException(404, "Không tìm thấy phiếu chuyển")
    if phieu.trang_thai == "da_duyet":
        raise HTTPException(400, "Phiếu đã được duyệt chuyển")
    if phieu.trang_thai == "huy":
        raise HTTPException(400, "Không thể duyệt chuyển phiếu đã hủy")

    # Validate balances first
    for it in phieu.items:
        _product_id = getattr(it, "product_id", None)
        is_btp = bool(_product_id) and bool(it.production_order_id) and not it.paper_material_id and not it.other_material_id
        is_phoi = bool(it.production_order_id) and not it.paper_material_id and not it.other_material_id and not _product_id
        is_product = bool(_product_id) and not it.production_order_id and not it.paper_material_id and not it.other_material_id
        if is_btp:
            bal_xuat = _get_or_create_balance(db, phieu.warehouse_xuat_id,
                                              product_id=_product_id,
                                              ten_hang=it.ten_hang, don_vi=it.don_vi)
            if bal_xuat.ton_luong < it.so_luong:
                raise HTTPException(400, f"Không đủ tồn BTP tại kho xuất: {it.ten_hang} — "
                                    f"cần {float(it.so_luong):g}, còn {float(bal_xuat.ton_luong):g}")
        elif is_phoi:
            tong_nhap = db.query(func.coalesce(func.sum(PhieuNhapPhoiSongItem.so_luong_thuc_te), 0)).join(
                PhieuNhapPhoiSong, PhieuNhapPhoiSongItem.phieu_id == PhieuNhapPhoiSong.id
            ).filter(PhieuNhapPhoiSong.production_order_id == it.production_order_id).scalar() or Decimal("0")
            tong_chuyen = db.query(func.coalesce(func.sum(PhieuChuyenKhoItem.so_luong), 0)).join(
                PhieuChuyenKho, PhieuChuyenKhoItem.phieu_chuyen_kho_id == PhieuChuyenKho.id
            ).filter(
                PhieuChuyenKhoItem.production_order_id == it.production_order_id,
                PhieuChuyenKho.trang_thai == "da_duyet"
            ).scalar() or Decimal("0")
            ton_tai_nguon = max(Decimal("0"), Decimal(str(tong_nhap)) - Decimal(str(tong_chuyen)))
            if ton_tai_nguon < it.so_luong:
                raise HTTPException(400, f"Không đủ phôi tại kho nguồn: LSX #{it.production_order_id} — "
                                    f"cần {float(it.so_luong):g}, còn {float(ton_tai_nguon):g}")
        elif is_product:
            bal_xuat = _get_or_create_balance(db, phieu.warehouse_xuat_id,
                                              product_id=_product_id,
                                              ten_hang=it.ten_hang, don_vi=it.don_vi)
            if bal_xuat.ton_luong < it.so_luong:
                raise HTTPException(400, f"Không đủ tồn BTP/TP tại kho xuất: {it.ten_hang} — "
                                    f"cần {float(it.so_luong):g}, còn {float(bal_xuat.ton_luong):g}")
        else:
            bal_xuat = _get_or_create_balance(db, phieu.warehouse_xuat_id,
                                              it.paper_material_id, it.other_material_id,
                                              ten_hang=it.ten_hang, don_vi=it.don_vi)
            if bal_xuat.ton_luong < it.so_luong:
                raise HTTPException(400, f"Không đủ tồn tại kho xuất: {it.ten_hang} — "
                                    f"cần {float(it.so_luong):g}, còn {float(bal_xuat.ton_luong):g}")

    # Process inventory and transaction logging
    for it in phieu.items:
        _product_id = getattr(it, "product_id", None)
        is_btp = bool(_product_id) and bool(it.production_order_id) and not it.paper_material_id and not it.other_material_id
        is_phoi = bool(it.production_order_id) and not it.paper_material_id and not it.other_material_id and not _product_id
        is_product = bool(_product_id) and not it.production_order_id and not it.paper_material_id and not it.other_material_id
        if is_btp:
            # Giữ nguyên don_gia user đã tính (gia_phoi + addon) — KHÔNG override
            don_gia_btp = it.don_gia or Decimal("0")

            bal_xuat = _get_or_create_balance(db, phieu.warehouse_xuat_id,
                                              product_id=_product_id,
                                              ten_hang=it.ten_hang, don_vi=it.don_vi, lock=True)
            _xuat_balance(bal_xuat, it.so_luong, it.ten_hang)
            _log_tx(db, phieu.warehouse_xuat_id, "CHUYEN_KHO_XUAT",
                    it.so_luong, don_gia_btp, bal_xuat.ton_luong,
                    "phieu_chuyen_kho", phieu.id, current_user.id,
                    product_id=_product_id, ghi_chu=it.ghi_chu)

            bal_nhap = _get_or_create_balance(db, phieu.warehouse_nhap_id,
                                              product_id=_product_id,
                                              ten_hang=it.ten_hang, don_vi=it.don_vi)
            _nhap_balance(bal_nhap, it.so_luong, don_gia_btp)
            _log_tx(db, phieu.warehouse_nhap_id, "CHUYEN_KHO_NHAP",
                    it.so_luong, don_gia_btp, bal_nhap.ton_luong,
                    "phieu_chuyen_kho", phieu.id, current_user.id,
                    product_id=_product_id, ghi_chu=it.ghi_chu)

            # Tự tạo LSX con + PhieuIn tại xưởng đích
            _auto_create_btp_workflow(
                db, it.production_order_id, _product_id,
                it.so_luong, phieu.warehouse_nhap_id, current_user.id,
            )
        elif is_phoi:
            if (not it.don_gia or it.don_gia == Decimal("0")) and it.production_order_id:
                lsx = db.get(ProductionOrder, it.production_order_id)
                if lsx and lsx.don_gia_noi_bo and lsx.don_gia_noi_bo > 0:
                    it.don_gia = lsx.don_gia_noi_bo
        elif is_product:
            bal_xuat = _get_or_create_balance(db, phieu.warehouse_xuat_id,
                                              product_id=_product_id,
                                              ten_hang=it.ten_hang, don_vi=it.don_vi, lock=True)
            don_gia_xuat = bal_xuat.don_gia_binh_quan
            it.don_gia = don_gia_xuat

            _xuat_balance(bal_xuat, it.so_luong, it.ten_hang)
            _log_tx(db, phieu.warehouse_xuat_id, "CHUYEN_KHO_XUAT",
                    it.so_luong, don_gia_xuat, bal_xuat.ton_luong,
                    "phieu_chuyen_kho", phieu.id, current_user.id,
                    product_id=_product_id,
                    ghi_chu=it.ghi_chu)

            bal_nhap = _get_or_create_balance(db, phieu.warehouse_nhap_id,
                                              product_id=_product_id,
                                              ten_hang=it.ten_hang, don_vi=it.don_vi)
            _nhap_balance(bal_nhap, it.so_luong, don_gia_xuat)
            _log_tx(db, phieu.warehouse_nhap_id, "CHUYEN_KHO_NHAP",
                    it.so_luong, don_gia_xuat, bal_nhap.ton_luong,
                    "phieu_chuyen_kho", phieu.id, current_user.id,
                    product_id=_product_id,
                    ghi_chu=it.ghi_chu)
        else:
            # Lock source balance to prevent race conditions
            bal_xuat = _get_or_create_balance(db, phieu.warehouse_xuat_id,
                                              it.paper_material_id, it.other_material_id,
                                              ten_hang=it.ten_hang, don_vi=it.don_vi, lock=True)
            don_gia_xuat = bal_xuat.don_gia_binh_quan
            it.don_gia = don_gia_xuat

            _xuat_balance(bal_xuat, it.so_luong, it.ten_hang)
            _log_tx(db, phieu.warehouse_xuat_id, "CHUYEN_KHO_XUAT",
                    it.so_luong, don_gia_xuat, bal_xuat.ton_luong,
                    "phieu_chuyen_kho", phieu.id, current_user.id,
                    paper_material_id=it.paper_material_id,
                    other_material_id=it.other_material_id,
                    ghi_chu=it.ghi_chu)

            # Add to destination warehouse
            bal_nhap = _get_or_create_balance(db, phieu.warehouse_nhap_id,
                                              it.paper_material_id, it.other_material_id,
                                              ten_hang=it.ten_hang, don_vi=it.don_vi)
            _nhap_balance(bal_nhap, it.so_luong, don_gia_xuat)
            _log_tx(db, phieu.warehouse_nhap_id, "CHUYEN_KHO_NHAP",
                    it.so_luong, don_gia_xuat, bal_nhap.ton_luong,
                    "phieu_chuyen_kho", phieu.id, current_user.id,
                    paper_material_id=it.paper_material_id,
                    other_material_id=it.other_material_id,
                    ghi_chu=it.ghi_chu)

    # ── Ghi sổ kế toán tự động ──────────────────────────────────────────────
    acc_service = AccountingService(db)
    wh_xuat = db.get(Warehouse, phieu.warehouse_xuat_id)
    wh_nhap = db.get(Warehouse, phieu.warehouse_nhap_id)

    phap_nhan_id_xuat = wh_xuat.phan_xuong_obj.phap_nhan_id if wh_xuat and wh_xuat.phan_xuong_obj else None
    phap_nhan_id_nhap = wh_nhap.phan_xuong_obj.phap_nhan_id if wh_nhap and wh_nhap.phan_xuong_obj else None

    # Chuẩn bị dữ liệu dòng cho kế toán
    journal_items = []
    for it in phieu.items:
        _product_id = getattr(it, "product_id", None)
        _is_phoi_item = bool(it.production_order_id) and not it.paper_material_id and not it.other_material_id
        tk_kho = "155" if _product_id or it.production_order_id else "152"

        std_price = Decimal("0")
        if it.paper_material_id:
            mat = db.get(PaperMaterial, it.paper_material_id)
            std_price = mat.gia_dinh_muc if mat else Decimal("0")
        elif it.other_material_id:
            mat = db.get(OtherMaterial, it.other_material_id)
            std_price = mat.gia_dinh_muc if mat else Decimal("0")
        elif _is_phoi_item:
            std_price = it.don_gia or Decimal("0")
        elif _product_id:
            prod = db.get(Product, _product_id)
            std_price = prod.gia_dinh_muc if prod else Decimal("0")

        transfer_price = std_price if std_price > 0 else (it.don_gia or Decimal("0"))
        don_gia_bq = transfer_price if _is_phoi_item else (it.don_gia or Decimal("0"))

        journal_items.append({
            "ten_hang": it.ten_hang,
            "so_luong": it.so_luong,
            "don_gia": transfer_price,
            "don_gia_binh_quan": don_gia_bq,
            "tk_kho": tk_kho
        })

    _existing_journal = db.query(JournalEntry).filter(
        JournalEntry.chung_tu_loai == "phieu_chuyen_kho",
        JournalEntry.chung_tu_id == phieu.id,
    ).first()

    if journal_items and not phieu.bo_qua_hach_toan and not _existing_journal:
        # 1. Bút toán xưởng xuất:
        lines_xuat = []
        for i in journal_items:
            val_std = float(i["so_luong"]) * float(i["don_gia"])      # Giá định mức
            val_act = float(i["so_luong"]) * float(i.get("don_gia_binh_quan", i["don_gia"])) # Giá bình quân

            lines_xuat.append({"so_tk": "1368", "dien_giai": f"DTNB: {i['ten_hang']}", "so_tien_no": val_std, "so_tien_co": 0})
            lines_xuat.append({"so_tk": "5112", "dien_giai": f"DTNB: {i['ten_hang']}", "so_tien_no": 0, "so_tien_co": val_std})

            lines_xuat.append({"so_tk": "6322", "dien_giai": f"GVNB: {i['ten_hang']}", "so_tien_no": val_act, "so_tien_co": 0})
            lines_xuat.append({"so_tk": i["tk_kho"], "dien_giai": f"GVNB: {i['ten_hang']}", "so_tien_no": 0, "so_tien_co": val_act})

        acc_service._create_journal_entry(
            ngay=phieu.ngay,
            dien_giai=f"Xuất nội bộ: {phieu.so_phieu}",
            loai_but_toan="chuyen_kho_xuat",
            chung_tu_loai="phieu_chuyen_kho",
            chung_tu_id=phieu.id,
            phap_nhan_id=phap_nhan_id_xuat,
            phan_xuong_id=wh_xuat.phan_xuong_id,
            lines=lines_xuat
        )

        # 2. Bút toán xưởng nhập: Nợ 152-155 / Có 3368
        acc_service.post_inventory_journal(
            ngay=phieu.ngay,
            loai="CHUYEN_KHO_NHAP",
            chung_tu_loai="phieu_chuyen_kho",
            chung_tu_id=phieu.id,
            phap_nhan_id=phap_nhan_id_nhap,
            phan_xuong_id=wh_nhap.phan_xuong_id,
            items=[{
                "ten_hang": i["ten_hang"],
                "so_luong": i["so_luong"],
                "don_gia": i["don_gia"],
                "tk_no": i["tk_kho"],
                "tk_co": "3368"
            } for i in journal_items]
        )

    phieu.trang_thai = "da_duyet"
    db.commit()
    db.refresh(phieu)
    return {"ok": True, "trang_thai": "da_duyet"}


@router.post("/phieu-chuyen/{phieu_id}/cancel")
def cancel_phieu_chuyen(
    phieu_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("KHO_TO_TRUONG", "ADMIN")),
):
    phieu = db.get(PhieuChuyenKho, phieu_id)
    if not phieu:
        raise HTTPException(404, "Không tìm thấy phiếu chuyển")
    if phieu.trang_thai == "nhap":
        raise HTTPException(400, "Không thể hủy phiếu chưa duyệt (hãy xóa phiếu)")
    if phieu.trang_thai == "huy":
        raise HTTPException(400, "Phiếu đã được hủy trước đó")

    # Validate destination balance has enough to deduct
    for it in phieu.items:
        _product_id = getattr(it, "product_id", None)
        is_btp = bool(_product_id) and bool(it.production_order_id) and not it.paper_material_id and not it.other_material_id
        is_phoi = bool(it.production_order_id) and not it.paper_material_id and not it.other_material_id and not _product_id
        is_product = bool(_product_id) and not it.production_order_id and not it.paper_material_id and not it.other_material_id
        if is_btp or is_product:
            bal_nhap = _get_or_create_balance(db, phieu.warehouse_nhap_id,
                                              product_id=_product_id,
                                              ten_hang=it.ten_hang, don_vi=it.don_vi)
            if bal_nhap.ton_luong < it.so_luong:
                raise HTTPException(400, f"Không đủ tồn BTP/TP tại kho nhận để hoàn trả: {it.ten_hang} — "
                                    f"cần {float(it.so_luong):g}, còn {float(bal_nhap.ton_luong):g}")
        elif not is_phoi:
            bal_nhap = _get_or_create_balance(db, phieu.warehouse_nhap_id,
                                              it.paper_material_id, it.other_material_id,
                                              ten_hang=it.ten_hang, don_vi=it.don_vi)
            if bal_nhap.ton_luong < it.so_luong:
                raise HTTPException(400, f"Không đủ tồn tại kho nhận để hoàn trả: {it.ten_hang} — "
                                    f"cần {float(it.so_luong):g}, còn {float(bal_nhap.ton_luong):g}")

    # Reverse inventory
    for it in phieu.items:
        _product_id = getattr(it, "product_id", None)
        is_btp = bool(_product_id) and bool(it.production_order_id) and not it.paper_material_id and not it.other_material_id
        is_phoi = bool(it.production_order_id) and not it.paper_material_id and not it.other_material_id and not _product_id
        is_product = bool(_product_id) and not it.production_order_id and not it.paper_material_id and not it.other_material_id
        if is_btp or is_product:
            bal_xuat = _get_or_create_balance(db, phieu.warehouse_xuat_id,
                                              product_id=_product_id,
                                              ten_hang=it.ten_hang, don_vi=it.don_vi)
            _nhap_balance(bal_xuat, it.so_luong, it.don_gia)
            _log_tx(db, phieu.warehouse_xuat_id, "HUY_CHUYEN_XUAT",
                    it.so_luong, it.don_gia, bal_xuat.ton_luong,
                    "phieu_chuyen_kho", phieu.id, current_user.id,
                    product_id=_product_id,
                    ghi_chu=f"Hủy phiếu {phieu.so_phieu}")

            bal_nhap = _get_or_create_balance(db, phieu.warehouse_nhap_id,
                                              product_id=_product_id,
                                              ten_hang=it.ten_hang, don_vi=it.don_vi, lock=True)
            _xuat_balance(bal_nhap, it.so_luong, it.ten_hang)
            _log_tx(db, phieu.warehouse_nhap_id, "HUY_CHUYEN_NHAP",
                    it.so_luong, it.don_gia, bal_nhap.ton_luong,
                    "phieu_chuyen_kho", phieu.id, current_user.id,
                    product_id=_product_id,
                    ghi_chu=f"Hủy phiếu {phieu.so_phieu}")
        elif not is_phoi:
            # Add back to source warehouse
            bal_xuat = _get_or_create_balance(db, phieu.warehouse_xuat_id,
                                              it.paper_material_id, it.other_material_id,
                                              ten_hang=it.ten_hang, don_vi=it.don_vi)
            _nhap_balance(bal_xuat, it.so_luong, it.don_gia)
            _log_tx(db, phieu.warehouse_xuat_id, "HUY_CHUYEN_XUAT",
                    it.so_luong, it.don_gia, bal_xuat.ton_luong,
                    "phieu_chuyen_kho", phieu.id, current_user.id,
                    paper_material_id=it.paper_material_id,
                    other_material_id=it.other_material_id,
                    ghi_chu=f"Hủy phiếu {phieu.so_phieu}")

            # Deduct from destination warehouse
            bal_nhap = _get_or_create_balance(db, phieu.warehouse_nhap_id,
                                              it.paper_material_id, it.other_material_id,
                                              ten_hang=it.ten_hang, don_vi=it.don_vi, lock=True)
            _xuat_balance(bal_nhap, it.so_luong, it.ten_hang)
            _log_tx(db, phieu.warehouse_nhap_id, "HUY_CHUYEN_NHAP",
                    it.so_luong, it.don_gia, bal_nhap.ton_luong,
                    "phieu_chuyen_kho", phieu.id, current_user.id,
                    paper_material_id=it.paper_material_id,
                    other_material_id=it.other_material_id,
                    ghi_chu=f"Hủy phiếu {phieu.so_phieu}")

    # Reverse accounting
    acc_service = AccountingService(db)
    acc_service._reverse_journal_entries("phieu_chuyen_kho", phieu_id)

    phieu.trang_thai = "huy"
    db.commit()
    db.refresh(phieu)
    return {"ok": True, "trang_thai": "huy"}


@router.delete("/phieu-chuyen/{phieu_id}")
def delete_phieu_chuyen(phieu_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = db.get(PhieuChuyenKho, phieu_id)
    if not p:
        raise HTTPException(404, "Không tìm thấy phiếu chuyển")
    if p.trang_thai != "nhap":
        raise HTTPException(400, "Chỉ được xoá phiếu ở trạng thái Nhập")

    db.delete(p)
    db.commit()
    return {"ok": True}


def _ck_to_dict(p: PhieuChuyenKho, db: Session) -> dict:
    wh_x = db.get(Warehouse, p.warehouse_xuat_id)
    wh_n = db.get(Warehouse, p.warehouse_nhap_id)

    px_x_id = wh_x.phan_xuong_id if wh_x else None
    px_n_id = wh_n.phan_xuong_id if wh_n else None
    px_x = db.get(PhanXuong, px_x_id) if px_x_id else None
    px_n = db.get(PhanXuong, px_n_id) if px_n_id else None
    pn_x = db.get(PhapNhan, px_x.phap_nhan_id) if px_x and px_x.phap_nhan_id else None
    pn_n = db.get(PhapNhan, px_n.phap_nhan_id) if px_n and px_n.phap_nhan_id else None

    # phap_nhan_id dùng để chọn template in — ưu tiên từ ProductionOrder của items phôi
    phap_nhan_id_for_print: Optional[int] = None
    for it in p.items:
        po_id = getattr(it, "production_order_id", None)
        if po_id:
            lsx = db.get(ProductionOrder, po_id)
            if lsx and lsx.phap_nhan_id:
                phap_nhan_id_for_print = lsx.phap_nhan_id
                break
    if not phap_nhan_id_for_print and px_x and px_x.phap_nhan_id:
        phap_nhan_id_for_print = px_x.phap_nhan_id

    return {
        "id": p.id,
        "so_phieu": p.so_phieu,
        "warehouse_xuat_id": p.warehouse_xuat_id,
        "ten_kho_xuat": wh_x.ten_kho if wh_x else "",
        "phan_xuong_xuat_id": px_x.id if px_x else None,
        "ten_phan_xuong_xuat": px_x.ten_xuong if px_x else "",
        "phap_nhan_xuat_id": pn_x.id if pn_x else None,
        "ten_phap_nhan_xuat": pn_x.ten_phap_nhan if pn_x else "",
        "warehouse_nhap_id": p.warehouse_nhap_id,
        "ten_kho_nhap": wh_n.ten_kho if wh_n else "",
        "phan_xuong_nhap_id": px_n.id if px_n else None,
        "ten_phan_xuong_nhap": px_n.ten_xuong if px_n else "",
        "phap_nhan_nhap_id": pn_n.id if pn_n else None,
        "ten_phap_nhan_nhap": pn_n.ten_phap_nhan if pn_n else "",
        "ngay": str(p.ngay),
        "ghi_chu": p.ghi_chu,
        "trang_thai": p.trang_thai,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "phap_nhan_id_for_print": phap_nhan_id_for_print,
        "items": [_ck_item_dict(it, db) for it in p.items],
    }


def _ck_item_dict(it: "PhieuChuyenKhoItem", db: Session) -> dict:
    _product_id = getattr(it, "product_id", None)
    d: dict = {
        "id": it.id,
        "paper_material_id": it.paper_material_id,
        "other_material_id": it.other_material_id,
        "production_order_id": getattr(it, "production_order_id", None),
        "product_id": _product_id,
        "ten_hang": it.ten_hang,
        "don_vi": it.don_vi,
        "so_luong": float(it.so_luong),
        "don_gia": float(it.don_gia),
        "ghi_chu": it.ghi_chu,
    }
    if _product_id and not it.production_order_id:
        prod = db.get(Product, _product_id)
        if prod:
            d["ten_san_pham"] = prod.ten_san_pham
            d["ma_san_pham"] = prod.ma_san_pham if hasattr(prod, "ma_san_pham") else None
    po_id = getattr(it, "production_order_id", None)
    if po_id:
        lsx = db.get(ProductionOrder, po_id)
        if lsx:
            d["so_lsx"] = lsx.so_lenh or ""
            d["don_gia_noi_bo"] = float(lsx.don_gia_noi_bo) if lsx.don_gia_noi_bo else None
            # Quy cách: ưu tiên PhieuIn.quy_cach (đã format sẵn), fallback về dai×rong×cao
            phieu_in = db.query(PhieuIn).filter(PhieuIn.production_order_id == po_id).first()
            if phieu_in and phieu_in.quy_cach:
                d["quy_cach"] = phieu_in.quy_cach
            first = lsx.items[0] if lsx.items else None
            if first:
                d["so_lop"] = first.so_lop
                d["to_hop_song"] = first.to_hop_song or ""
                if "quy_cach" not in d:
                    dai = int(first.dai) if first.dai else 0
                    rong = int(first.rong) if first.rong else 0
                    cao = int(first.cao) if first.cao else 0
                    if dai and rong and cao:
                        d["quy_cach"] = f"{dai}×{rong}×{cao}"
                # Khổ x Cắt: kích thước phôi thực tế từ KHSX (kho_tt × dai_tt)
                kho_tt = int(first.kho_tt) if first.kho_tt else 0
                dai_tt = int(first.dai_tt) if first.dai_tt else 0
                if kho_tt and dai_tt:
                    d["kho_cat"] = f"{kho_tt}×{dai_tt}"
                if first.product_id:
                    prod = db.get(Product, first.product_id)
                    if prod:
                        d["ma_sp"] = prod.ma_amis or prod.ma_hang or ""
    return d


# ── Gợi ý đơn giá BTP ─────────────────────────────────────────────────────────

@router.get("/btp-price")
def get_btp_price(
    production_order_id: int = Query(..., description="ID của LSX xưởng A"),
    chong_tham: int = Query(0, ge=0, le=2, description="Chống thấm: 0=không, 1=1 mặt, 2=2 mặt"),
    in_flexo_mau: int = Query(0, ge=0, description="In Flexo: số màu (0=không in)"),
    in_flexo_phu_nen: bool = Query(False),
    in_ky_thuat_so: bool = Query(False),
    chap_xa: bool = Query(False),
    boi: bool = Query(False),
    be_so_con: int = Query(0, ge=0, description="Bế: số con/khuôn (0=không bế)"),
    dan: bool = Query(False),
    ghim: bool = Query(False),
    can_mang: int = Query(0, ge=0, le=2, description="Cán màng: 0=không, 1=1 mặt, 2=2 mặt"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Tính gợi ý đơn giá BTP = gia_phoi + addon công đoạn xưởng A đã làm.
    Nguồn gia_phoi: QuoteItem.gia_phoi qua chain LSX→SO→SOItem→QuoteItem.
    Addon: AddonRate từ DB × diện_tích.
    """
    lsx = db.get(ProductionOrder, production_order_id)
    if not lsx:
        raise HTTPException(404, "Không tìm thấy lệnh sản xuất")

    # Trace: LSX → SalesOrder → SalesOrderItem → QuoteItem
    gia_phoi: float | None = None
    dien_tich: float | None = None
    ten_hang: str = ""

    if lsx.sales_order_id:
        so_item = (
            db.query(SalesOrderItem)
            .filter(SalesOrderItem.order_id == lsx.sales_order_id)
            .first()
        )
        if so_item:
            ten_hang = so_item.ten_hang or ""
            if so_item.dien_tich:
                dien_tich = float(so_item.dien_tich)
            if so_item.quote_item_id:
                qi = db.get(QuoteItem, so_item.quote_item_id)
                if qi:
                    gia_phoi = float(qi.gia_phoi) if qi.gia_phoi else None
                    if dien_tich is None and qi.dien_tich:
                        dien_tich = float(qi.dien_tich)

    # Fallback: first item của LSX nếu không có SO
    if dien_tich is None:
        first_item = lsx.items[0] if lsx.items else None
        if first_item and first_item.dien_tich:
            dien_tich = float(first_item.dien_tich)
        if not ten_hang and first_item:
            ten_hang = first_item.ten_hang or ""

    # Load addon rates từ DB
    rates_rows = db.query(AddonRate).all()
    rates: dict = {r.ma_chi_phi: float(r.don_gia) for r in rates_rows}

    dt = dien_tich or 0.0
    addon = 0.0
    addon_detail: dict = {}

    if chong_tham:
        v = _calc_chong_tham(chong_tham, dt, rates)
        addon += v
        addon_detail["chong_tham"] = round(v, 2)
    if in_flexo_mau > 0:
        v = _calc_in_flexo(in_flexo_mau, in_flexo_phu_nen, dt, rates)
        addon += v
        addon_detail["in_flexo"] = round(v, 2)
    if in_ky_thuat_so:
        v = _calc_in_ky_thuat_so(in_ky_thuat_so, rates)
        addon += v
        addon_detail["in_ky_thuat_so"] = round(v, 2)
    if chap_xa:
        v = _calc_chap_xa(chap_xa, rates)
        addon += v
        addon_detail["chap_xa"] = round(v, 2)
    if boi:
        v = _calc_boi(boi, dt, rates)
        addon += v
        addon_detail["boi"] = round(v, 2)
    if be_so_con:
        v = _calc_be(be_so_con, rates)
        addon += v
        addon_detail["be"] = round(v, 2)
    if dan:
        v = _calc_dan(dan, rates)
        addon += v
        addon_detail["dan"] = round(v, 2)
    if ghim:
        v = _calc_ghim(ghim, rates)
        addon += v
        addon_detail["ghim"] = round(v, 2)
    if can_mang:
        v = _calc_can_mang(can_mang, dt, rates)
        addon += v
        addon_detail["can_mang"] = round(v, 2)

    don_gia_btp = round((gia_phoi or 0.0) + addon, 2)

    return {
        "production_order_id": production_order_id,
        "ten_hang": ten_hang,
        "gia_phoi": gia_phoi,
        "dien_tich": dien_tich,
        "addon_detail": addon_detail,
        "addon_tong": round(addon, 2),
        "don_gia_btp": don_gia_btp,
        "ghi_chu": "Giá gợi ý — hoạch toán nội bộ" if gia_phoi else "Không tìm thấy gia_phoi từ báo giá — cần nhập tay",
    }


# ── BTP Transfer Kanban — atomic endpoint ────────────────────────────────────

class BtpTransferKanbanIn(BaseModel):
    production_order_id: int          # LSX xưởng A (sẽ là parent của child LSX)
    product_id: int
    warehouse_xuat_id: int            # kho BTP xưởng A
    warehouse_nhap_id: int            # kho BTP xưởng B
    so_luong: Decimal = Field(..., gt=0)
    don_gia: Decimal = Field(Decimal("0"), ge=0)
    ten_hang: str = ""
    ghi_chu: Optional[str] = None
    phieu_in_id: Optional[int] = None  # PhieuIn gốc ở xưởng A → đổi sang 'da_chuyen_btp'


@router.post("/btp-transfer-kanban", status_code=201)
def btp_transfer_kanban(
    body: BtpTransferKanbanIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Chuyển BTP từ kanban xưởng A → kanban xưởng B trong 1 giao dịch.

    3 bước tự động:
    1. Tạo ProductionOutput → ghi BTP vào kho BTP xưởng A (InventoryBalance += so_luong)
    2. Tạo PhieuChuyenKho is_btp
    3. Approve phiếu → trừ kho A, cộng kho B + tạo child LSX + PhieuIn(cho_dinh_hinh) tại xưởng B
    """
    if body.warehouse_xuat_id == body.warehouse_nhap_id:
        raise HTTPException(400, "Kho xuất và kho nhận phải khác nhau")

    # ── Idempotency: nếu PhieuIn gốc đã chuyển rồi thì từ chối ───────────────
    if body.phieu_in_id:
        src_pi = db.get(PhieuIn, body.phieu_in_id)
        if src_pi and src_pi.trang_thai == "da_chuyen_btp":
            raise HTTPException(400, "Phiếu in này đã được chuyển BTP rồi")

    lsx = db.get(ProductionOrder, body.production_order_id)
    if not lsx:
        raise HTTPException(404, "Không tìm thấy lệnh sản xuất")

    wh_xuat = db.get(Warehouse, body.warehouse_xuat_id)
    wh_nhap = db.get(Warehouse, body.warehouse_nhap_id)
    if not wh_xuat or not wh_nhap:
        raise HTTPException(404, "Không tìm thấy kho")

    prod = db.get(Product, body.product_id)
    if not prod:
        raise HTTPException(404, f"Không tìm thấy sản phẩm #{body.product_id}")
    ten_hang = body.ten_hang or prod.ten_san_pham
    don_vi = getattr(prod, "dvt", None) or "Cái"

    try:
        # ── Bước 1: Tạo ProductionOutput → ghi BTP vào kho xuất ──────────────────
        po_out = ProductionOutput(
            so_phieu=_gen_so(db, "TP", ProductionOutput),
            ngay_nhap=date.today(),
            production_order_id=body.production_order_id,
            warehouse_id=body.warehouse_xuat_id,
            product_id=body.product_id,
            ten_hang=ten_hang,
            so_luong_nhap=body.so_luong,
            so_luong_loi=Decimal("0"),
            dvt=don_vi,
            don_gia_xuat_xuong=body.don_gia,
            ghi_chu=f"Tự động từ Chuyển BTP kanban — {body.ghi_chu or ''}".strip(" —"),
            created_by=current_user.id,
        )
        db.add(po_out)
        db.flush()

        bal_src = _get_or_create_balance(db, body.warehouse_xuat_id,
                                         product_id=body.product_id,
                                         ten_hang=ten_hang, don_vi=don_vi)
        _nhap_balance(bal_src, body.so_luong, body.don_gia)
        _log_tx(db, body.warehouse_xuat_id, "NHAP_SX",
                body.so_luong, body.don_gia, bal_src.ton_luong,
                "production_outputs", po_out.id, current_user.id,
                product_id=body.product_id)

        # ── Bước 2: Tạo PhieuChuyenKho (is_btp) ─────────────────────────────────
        phieu = PhieuChuyenKho(
            so_phieu=_gen_so(db, "CK", PhieuChuyenKho),
            warehouse_xuat_id=body.warehouse_xuat_id,
            warehouse_nhap_id=body.warehouse_nhap_id,
            ngay=date.today(),
            ghi_chu=body.ghi_chu,
            trang_thai="nhap",
            created_by=current_user.id,
        )
        db.add(phieu)
        db.flush()

        db.add(PhieuChuyenKhoItem(
            phieu_chuyen_kho_id=phieu.id,
            product_id=body.product_id,
            production_order_id=body.production_order_id,
            paper_material_id=None,
            other_material_id=None,
            ten_hang=ten_hang,
            don_vi=don_vi,
            so_luong=body.so_luong,
            don_gia=body.don_gia,
            ghi_chu=body.ghi_chu,
        ))
        db.flush()

        # ── Bước 3: Approve (xuat kho A, nhap kho B, tạo child LSX + PhieuIn) ────
        bal_xuat = _get_or_create_balance(db, body.warehouse_xuat_id,
                                          product_id=body.product_id,
                                          ten_hang=ten_hang, don_vi=don_vi, lock=True)
        _xuat_balance(bal_xuat, body.so_luong, ten_hang)
        _log_tx(db, body.warehouse_xuat_id, "CHUYEN_KHO_XUAT",
                body.so_luong, body.don_gia, bal_xuat.ton_luong,
                "phieu_chuyen_kho", phieu.id, current_user.id,
                product_id=body.product_id, ghi_chu=body.ghi_chu)

        bal_nhap = _get_or_create_balance(db, body.warehouse_nhap_id,
                                          product_id=body.product_id,
                                          ten_hang=ten_hang, don_vi=don_vi)
        _nhap_balance(bal_nhap, body.so_luong, body.don_gia)
        _log_tx(db, body.warehouse_nhap_id, "CHUYEN_KHO_NHAP",
                body.so_luong, body.don_gia, bal_nhap.ton_luong,
                "phieu_chuyen_kho", phieu.id, current_user.id,
                product_id=body.product_id, ghi_chu=body.ghi_chu)

        _auto_create_btp_workflow(
            db, body.production_order_id, body.product_id,
            body.so_luong, body.warehouse_nhap_id, current_user.id,
        )

        phieu.trang_thai = "da_duyet"

        # ── Ghi sổ kế toán (cùng pattern approve_phieu_chuyen) ─────────────────
        don_gia_vnd = float(body.don_gia)
        so_luong_f  = float(body.so_luong)
        val = don_gia_vnd * so_luong_f
        if val > 0:
            phap_nhan_xuat = (wh_xuat.phan_xuong_obj.phap_nhan_id
                              if wh_xuat and wh_xuat.phan_xuong_obj else None)
            phap_nhan_nhap = (wh_nhap.phan_xuong_obj.phap_nhan_id
                              if wh_nhap and wh_nhap.phan_xuong_obj else None)
            acc = AccountingService(db)
            acc._create_journal_entry(
                ngay=date.today(),
                dien_giai=f"Xuất BTP nội bộ: {phieu.so_phieu}",
                loai_but_toan="chuyen_kho_xuat",
                chung_tu_loai="phieu_chuyen_kho",
                chung_tu_id=phieu.id,
                phap_nhan_id=phap_nhan_xuat,
                phan_xuong_id=wh_xuat.phan_xuong_id,
                lines=[
                    {"so_tk": "1368", "dien_giai": f"DTNB: {ten_hang}", "so_tien_no": val, "so_tien_co": 0},
                    {"so_tk": "5112", "dien_giai": f"DTNB: {ten_hang}", "so_tien_no": 0, "so_tien_co": val},
                    {"so_tk": "6322", "dien_giai": f"GVNB: {ten_hang}", "so_tien_no": val, "so_tien_co": 0},
                    {"so_tk": "155",  "dien_giai": f"GVNB: {ten_hang}", "so_tien_no": 0, "so_tien_co": val},
                ],
            )
            acc.post_inventory_journal(
                ngay=date.today(),
                loai="CHUYEN_KHO_NHAP",
                chung_tu_loai="phieu_chuyen_kho",
                chung_tu_id=phieu.id,
                phap_nhan_id=phap_nhan_nhap,
                phan_xuong_id=wh_nhap.phan_xuong_id,
                items=[{
                    "ten_hang": ten_hang,
                    "so_luong": body.so_luong,
                    "don_gia": body.don_gia,
                    "tk_no": "155",
                    "tk_co": "3368",
                }],
            )

        # Đánh dấu PhieuIn gốc ở xưởng A đã chuyển → ẩn khỏi kanban
        if body.phieu_in_id:
            src_phieu_in = db.get(PhieuIn, body.phieu_in_id)
            if src_phieu_in:
                src_phieu_in.trang_thai = "da_chuyen_btp"

        db.commit()
        db.refresh(phieu)

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(500, f"Lỗi khi chuyển BTP: {exc}") from exc

    return {
        "ok": True,
        "so_phieu_chuyen": phieu.so_phieu,
        "so_phieu_tp": po_out.so_phieu,
    }
