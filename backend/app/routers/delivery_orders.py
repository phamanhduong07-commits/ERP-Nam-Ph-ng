"""Warehouse router — phiếu xuất giao hàng (DeliveryOrder).

Split out of app/routers/warehouse.py (pure structural extraction).
Shares the /api/warehouse prefix; mounted alongside warehouse.router.
"""
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, text as _text
from sqlalchemy.orm import Session, joinedload, selectinload
from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.inventory import InventoryBalance
from app.models.master import Warehouse, Product, PhanXuong, Customer
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.sales import SalesOrder, SalesOrderItem, SalesReturn, SalesReturnItem
from app.models.billing import SalesInvoice, InvoiceAdjustmentLog
from app.models.warehouse_doc import (
    ProductionOutput, DeliveryOrder,
    DeliveryOrderItem,
)
from app.models.yeu_cau_giao_hang import YeuCauGiaoHang
from app.services.accounting_service import AccountingService
from app.services.carton_metrics import production_item_metrics
from app.utils.log import get_logger

logger = get_logger(__name__)

from app.services.inventory_service import (
    get_or_create_balance as _get_or_create_balance,
    nhap_balance as _nhap_balance,
    xuat_balance as _xuat_balance,
    log_tx as _log_tx,
    get_workshop_warehouse as _get_workshop_warehouse,
)

from app.routers.warehouse import (  # shared schemas + helpers
    DeliveryOrderIn,
    UpdateDeliveryStatusIn,
    _gen_so,
    _ensure_active_warehouse,
    _recalc_sales_order_delivery_status,
    _default_trip_rate,
)

router = APIRouter(prefix="/api/warehouse", tags=["warehouse"])


# ── Phiếu xuất giao hàng (DeliveryOrder) ─────────────────────────────────────

@router.get("/deliveries")
def list_deliveries(
    warehouse_id: Optional[int] = Query(None),
    sales_order_id: Optional[int] = Query(None),
    customer_id: Optional[int] = Query(None),
    ten_khach: Optional[str] = Query(None),
    nv_theo_doi_id: Optional[int] = Query(None),
    so_lenh: Optional[str] = Query(None),
    so_don: Optional[str] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    so_phieu: Optional[str] = Query(None),
    phap_nhan_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(DeliveryOrder)
    if so_phieu:
        q = q.filter(DeliveryOrder.so_phieu.ilike(f"%{so_phieu}%"))
    if phap_nhan_id:
        q = q.filter(DeliveryOrder.phap_nhan_id == phap_nhan_id)
    if warehouse_id:
        q = q.filter(DeliveryOrder.warehouse_id == warehouse_id)
    if sales_order_id:
        delivery_ids_by_lsx = (
            db.query(DeliveryOrderItem.delivery_id)
            .join(ProductionOrder, ProductionOrder.id == DeliveryOrderItem.production_order_id)
            .filter(ProductionOrder.sales_order_id == sales_order_id)
        )
        q = q.filter(
            or_(
                DeliveryOrder.sales_order_id == sales_order_id,
                DeliveryOrder.id.in_(delivery_ids_by_lsx),
            )
        )
    if customer_id:
        q = q.filter(DeliveryOrder.customer_id == customer_id)
    if ten_khach:
        q = q.join(Customer, Customer.id == DeliveryOrder.customer_id).filter(
            Customer.ten_viet_tat.ilike(f"%{ten_khach}%")
        )
    if tu_ngay:
        q = q.filter(DeliveryOrder.ngay_xuat >= tu_ngay)
    if den_ngay:
        q = q.filter(DeliveryOrder.ngay_xuat <= den_ngay)

    if so_lenh or so_don or nv_theo_doi_id:
        sub = (
            db.query(DeliveryOrderItem.delivery_id)
            .join(ProductionOrder, ProductionOrder.id == DeliveryOrderItem.production_order_id)
        )
        if nv_theo_doi_id:
            sub = sub.filter(ProductionOrder.nv_theo_doi_id == nv_theo_doi_id)
        if so_lenh:
            sub = sub.filter(ProductionOrder.so_lenh.ilike(f"%{so_lenh}%"))
        if so_don:
            sub = sub.join(SalesOrder, SalesOrder.id == ProductionOrder.sales_order_id).filter(
                SalesOrder.so_don.ilike(f"%{so_don}%")
            )
        q = q.filter(DeliveryOrder.id.in_(sub))

    rows = (
        q.options(
            joinedload(DeliveryOrder.items).joinedload(DeliveryOrderItem.production_order),
            joinedload(DeliveryOrder.xe),
            joinedload(DeliveryOrder.tai_xe),
            joinedload(DeliveryOrder.lo_xe_rel),
            joinedload(DeliveryOrder.lo_xe_rel_2),
            joinedload(DeliveryOrder.don_gia_vc),
            joinedload(DeliveryOrder.creator),
        )
        .order_by(DeliveryOrder.created_at.desc()).limit(200).all()
    )
    return [_do_to_dict(r, db) for r in rows]


@router.get("/deliveries/mobile-list")
def list_deliveries_mobile(
    xe_van_chuyen: Optional[str] = Query(None),
    ngay: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Danh sách phiếu giao hàng cho tài xế trên mobile — chỉ trả da_xuat."""
    from sqlalchemy.orm import joinedload
    q = db.query(DeliveryOrder).options(joinedload(DeliveryOrder.customer)).filter(DeliveryOrder.trang_thai == "da_xuat")
    if xe_van_chuyen:
        q = q.filter(DeliveryOrder.xe_van_chuyen.ilike(f"%{xe_van_chuyen}%"))
    if ngay:
        q = q.filter(DeliveryOrder.ngay_xuat == ngay)
    rows = q.order_by(DeliveryOrder.ngay_xuat.desc(), DeliveryOrder.id.desc()).limit(50).all()
    result = []
    for do in rows:
        result.append({
            "id": do.id,
            "so_phieu": do.so_phieu,
            "ten_khach": do.customer.ten_viet_tat or do.customer.ten_don_vi if do.customer else "",
            "dia_chi_giao": do.dia_chi_giao,
            "xe_van_chuyen": do.xe_van_chuyen,
            "nguoi_nhan": do.nguoi_nhan,
            "ngay_xuat": str(do.ngay_xuat),
            "tong_thanh_toan": float(do.tong_thanh_toan or 0),
            "trang_thai": do.trang_thai,
        })
    return result


@router.get("/deliveries/{do_id}")
def get_delivery(do_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    r = (
        db.query(DeliveryOrder)
        .options(
            joinedload(DeliveryOrder.items)
                .joinedload(DeliveryOrderItem.production_order)
                .joinedload(ProductionOrder.sales_order),
            joinedload(DeliveryOrder.items)
                .joinedload(DeliveryOrderItem.production_order)
                .selectinload(ProductionOrder.items),
            joinedload(DeliveryOrder.xe),
            joinedload(DeliveryOrder.tai_xe),
            joinedload(DeliveryOrder.lo_xe_rel),
            joinedload(DeliveryOrder.lo_xe_rel_2),
            joinedload(DeliveryOrder.don_gia_vc),
        )
        .filter(DeliveryOrder.id == do_id)
        .first()
    )
    if not r:
        raise HTTPException(404, "Không tìm thấy phiếu giao hàng")
    return _do_to_dict(r, db, include_print_data=True)


@router.post("/deliveries", status_code=201)
def create_delivery(
    body: DeliveryOrderIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.items:
        raise HTTPException(400, "Phiếu giao hàng phải có ít nhất 1 dòng")

    # Xác định customer_id
    customer_id = body.customer_id
    so = None
    if body.sales_order_id:
        so = db.get(SalesOrder, body.sales_order_id)
        if not so:
            raise HTTPException(404, "Không tìm thấy đơn hàng")
        customer_id = customer_id or so.customer_id
    if not customer_id:
        raise HTTPException(400, "Cần truyền customer_id hoặc sales_order_id")

    # Auto-fill kho THANH_PHAM của xưởng từ đơn hàng nếu chưa truyền
    warehouse_id = body.warehouse_id
    if not warehouse_id and so and getattr(so, "phan_xuong_id", None):
        wh = _get_workshop_warehouse(db, so.phan_xuong_id, "THANH_PHAM")
        warehouse_id = wh.id if wh else None
    if not warehouse_id:
        raise HTTPException(400, "Cần truyền warehouse_id hoặc đơn hàng phải có xưởng có kho THANH_PHAM")
    wh_obj = _ensure_active_warehouse(db, warehouse_id, {"THANH_PHAM", "PHOI"})
    if not wh_obj:
        raise HTTPException(404, "Không tìm thấy kho")
    is_phoi_warehouse = getattr(wh_obj, "loai_kho", "") == "PHOI"

    # Validate tồn kho cho từng item (dùng warehouse_id của item hoặc header)
    for it in body.items:
        ten_hang = it.ten_hang
        if it.product_id:
            prod = db.get(Product, it.product_id)
            if prod:
                ten_hang = ten_hang or getattr(prod, "ten_san_pham", None) or ten_hang
        # Kho PHOI không dùng ProductionOutput — tồn được track qua InventoryBalance
        if it.production_order_id and not is_phoi_warehouse:
            tong_nhap_lsx = db.query(
                func.coalesce(func.sum(ProductionOutput.so_luong_nhap), 0)
            ).filter(
                ProductionOutput.production_order_id == it.production_order_id,
                ProductionOutput.warehouse_id == warehouse_id,
            ).scalar() or Decimal("0")
            tong_xuat_lsx = db.query(
                func.coalesce(func.sum(DeliveryOrderItem.so_luong), 0)
            ).join(
                DeliveryOrder, DeliveryOrder.id == DeliveryOrderItem.delivery_id
            ).filter(
                DeliveryOrderItem.production_order_id == it.production_order_id,
                DeliveryOrder.warehouse_id == warehouse_id,
                DeliveryOrder.trang_thai != "huy",
            ).scalar() or Decimal("0")
            tong_tra_lsx = db.query(
                func.coalesce(func.sum(SalesReturnItem.so_luong_tra), 0)
            ).select_from(SalesReturnItem).join(
                SalesReturn, SalesReturn.id == SalesReturnItem.sales_return_id
            ).join(
                DeliveryOrder, DeliveryOrder.id == SalesReturn.delivery_order_id
            ).join(
                DeliveryOrderItem,
                or_(
                    SalesReturnItem.delivery_order_item_id == DeliveryOrderItem.id,
                    and_(
                        SalesReturnItem.delivery_order_item_id.is_(None),
                        DeliveryOrderItem.delivery_id == SalesReturn.delivery_order_id,
                        DeliveryOrderItem.sales_order_item_id == SalesReturnItem.sales_order_item_id,
                    ),
                )
            ).filter(
                DeliveryOrderItem.production_order_id == it.production_order_id,
                DeliveryOrder.warehouse_id == warehouse_id,
                SalesReturn.trang_thai == "da_duyet",
            ).scalar() or Decimal("0")
            ton_lsx = Decimal(str(tong_nhap_lsx)) - Decimal(str(tong_xuat_lsx)) + Decimal(str(tong_tra_lsx))
            if ton_lsx < it.so_luong:
                po_ref = db.get(ProductionOrder, it.production_order_id)
                label = po_ref.so_lenh if po_ref else ten_hang
                raise HTTPException(400, f"Không đủ tồn TP theo LSX: {label} — "
                                    f"cần {float(it.so_luong):g}, còn {float(ton_lsx):g}")
        bal = _get_or_create_balance(db, warehouse_id,
                                     product_id=it.product_id,
                                     ten_hang=ten_hang, don_vi=it.dvt)
        balances = db.query(InventoryBalance).filter(
            InventoryBalance.warehouse_id == warehouse_id,
            InventoryBalance.product_id == it.product_id,
            InventoryBalance.ton_luong > 0,
        ).all() if it.product_id else [bal]
        tong_ton_tp = sum((b.ton_luong or Decimal("0")) for b in balances)
        if tong_ton_tp < it.so_luong:
            raise HTTPException(400, f"Không đủ tồn TP: {ten_hang} — "
                                f"cần {float(it.so_luong):g}, còn {float(bal.ton_luong):g}")

    do = DeliveryOrder(
        so_phieu=_gen_so(db, "DO", DeliveryOrder),
        ngay_xuat=body.ngay_xuat,
        sales_order_id=body.sales_order_id,
        customer_id=customer_id,
        warehouse_id=warehouse_id,
        phap_nhan_id=body.phap_nhan_id,
        yeu_cau_id=body.yeu_cau_id,
        dia_chi_giao=body.dia_chi_giao,
        nguoi_nhan=body.nguoi_nhan,
        xe_van_chuyen=body.xe_van_chuyen,
        xe_id=body.xe_id,
        tai_xe_id=body.tai_xe_id,
        lo_xe=body.lo_xe,
        lo_xe_id=body.lo_xe_id,
        lo_xe_id_2=body.lo_xe_id_2,
        lo_xe_2=body.lo_xe_2,
        so_seal=body.so_seal,
        gui_kem_theo=body.gui_kem_theo,
        don_gia_vc_id=body.don_gia_vc_id,
        tien_van_chuyen=body.tien_van_chuyen,
        co_hang_ve=body.co_hang_ve,
        ghi_chu=body.ghi_chu,
        trang_thai_cong_no="chua_thu",
        created_by=current_user.id,
    )
    db.add(do)
    db.flush()

    tong_tien_hang = Decimal("0")
    tong_m2_giao = Decimal("0")
    journal_lines_delivery: list[dict] = []

    for it in body.items:
        ten_hang = it.ten_hang
        dvt = it.dvt
        if it.product_id:
            prod = db.get(Product, it.product_id)
            if prod:
                ten_hang = ten_hang or getattr(prod, "ten_san_pham", None) or ten_hang
                dvt = dvt or getattr(prod, "dvt", "Thùng") or "Thùng"

        # Auto dien_tich từ ProductionOrderItem nếu không truyền
        po_item = None
        if it.production_order_id:
            po_item = db.query(ProductionOrderItem).filter(
                ProductionOrderItem.production_order_id == it.production_order_id
            ).first()

        dien_tich = it.dien_tich
        trong_luong = it.trong_luong
        the_tich = it.the_tich
        if po_item and (
            dien_tich is None or dien_tich <= 0 or
            trong_luong is None or trong_luong <= 0 or
            the_tich is None or the_tich <= 0
        ):
            metrics = production_item_metrics(po_item, it.so_luong)
            if dien_tich is None or dien_tich <= 0:
                dien_tich = metrics["dien_tich"]
            if trong_luong is None or trong_luong <= 0:
                trong_luong = metrics["trong_luong"]
            if the_tich is None or the_tich <= 0:
                the_tich = metrics["the_tich"]

        # Auto don_gia từ SalesOrderItem nếu không truyền
        don_gia = it.don_gia
        if don_gia is None and it.sales_order_item_id:
            soi_ref = db.get(SalesOrderItem, it.sales_order_item_id)
            if soi_ref and soi_ref.don_gia:
                don_gia = Decimal(str(soi_ref.don_gia))

        thanh_tien = (it.so_luong * don_gia) if don_gia else None
        if thanh_tien:
            tong_tien_hang += thanh_tien
        tong_m2_giao += dien_tich or Decimal("0")

        db.add(DeliveryOrderItem(
            delivery_id=do.id,
            production_order_id=it.production_order_id,
            sales_order_item_id=it.sales_order_item_id,
            product_id=it.product_id,
            ten_hang=ten_hang,
            so_luong=it.so_luong,
            dvt=dvt,
            dien_tich=dien_tich,
            trong_luong=trong_luong,
            the_tich=the_tich,
            don_gia=don_gia,
            thanh_tien=thanh_tien,
            ghi_chu=it.ghi_chu,
        ))

        # Lock rows trước khi trừ tồn — tránh race condition concurrent delivery
        balances = db.query(InventoryBalance).filter(
            InventoryBalance.warehouse_id == warehouse_id,
            InventoryBalance.product_id == it.product_id,
            InventoryBalance.ton_luong > 0,
        ).with_for_update().all() if it.product_id else [
            _get_or_create_balance(db, warehouse_id, product_id=it.product_id, ten_hang=ten_hang, don_vi=dvt, lock=True)
        ]
        balances.sort(key=lambda b: 0)

        remaining_qty = it.so_luong
        for bal in balances:
            if remaining_qty <= 0:
                break
            qty = min(remaining_qty, bal.ton_luong)
            don_gia_xuat = bal.don_gia_binh_quan
            _xuat_balance(bal, qty, ten_hang)
            _log_tx(db, warehouse_id, "XUAT_BAN",
                    qty, don_gia_xuat, bal.ton_luong,
                    "delivery_orders", do.id, current_user.id,
                    product_id=it.product_id,
                    ghi_chu=it.ghi_chu)
            journal_lines_delivery.append({
                "ten_hang": ten_hang,
                "so_luong": qty,
                "don_gia": don_gia_xuat,
                "tk_no": "632",
                "tk_co": "155",
            })
            remaining_qty -= qty

        if it.sales_order_item_id:
            soi = db.get(SalesOrderItem, it.sales_order_item_id)
            if soi:
                soi.so_luong_da_xuat = (soi.so_luong_da_xuat or Decimal("0")) + it.so_luong

    # ── Ghi sổ kế toán tự động (Giá vốn hàng bán) ───────────────────────────
    acc_service = AccountingService(db)
    wh = db.get(Warehouse, warehouse_id)
    phap_nhan_id = wh.phan_xuong_obj.phap_nhan_id if wh and wh.phan_xuong_obj else None
    
    if not do.bo_qua_hach_toan:
        acc_service.post_inventory_journal(
            ngay=do.ngay_xuat,
            loai="XUAT_BAN",
            chung_tu_loai="delivery_orders",
            chung_tu_id=do.id,
            phap_nhan_id=phap_nhan_id,
            phan_xuong_id=wh.phan_xuong_id if wh else None,
            items=journal_lines_delivery,
        )

    # Cập nhật tổng
    _recalc_sales_order_delivery_status(db, body.sales_order_id)

    do.tong_tien_hang = tong_tien_hang if tong_tien_hang > 0 else None
    tien_vc = body.tien_van_chuyen or Decimal("0")
    default_don_gia_m2 = _default_trip_rate(db)
    if default_don_gia_m2 > 0:
        tien_vc = tong_m2_giao * default_don_gia_m2
        do.tien_van_chuyen = tien_vc
    do.tong_thanh_toan = (tong_tien_hang + tien_vc) if tong_tien_hang > 0 else (tien_vc if tien_vc > 0 else None)

    # Cập nhật trạng thái yêu cầu giao hàng
    if body.yeu_cau_id:
        yc = db.get(YeuCauGiaoHang, body.yeu_cau_id)
        if yc:
            yc.trang_thai = "da_tao_phieu"

    db.commit()
    db.refresh(do)
    logger.info("created delivery_order id=%s so_phieu=%s by user=%s", do.id, do.so_phieu, current_user.id)
    return _do_to_dict(do, db)


@router.patch("/deliveries/{do_id}/status")
def update_delivery_status(
    do_id: int,
    body: UpdateDeliveryStatusIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    valid = {"nhap", "da_xuat", "da_giao", "huy"}
    if body.trang_thai not in valid:
        raise HTTPException(400, f"Trạng thái không hợp lệ. Chọn một trong: {', '.join(sorted(valid))}")
    do = db.get(DeliveryOrder, do_id)
    if not do:
        logger.warning("delivery_order id=%s not found", do_id)
        raise HTTPException(404, "Không tìm thấy phiếu giao hàng")
    if do.trang_thai == "huy":
        raise HTTPException(400, "Phiếu đã huỷ, không thể đổi trạng thái")
    if do.trang_thai == "da_giao" and body.trang_thai not in ("da_giao", "huy"):
        raise HTTPException(400, "Phiếu đã giao không thể quay về trạng thái trước")
    # Khoá toàn bộ khi hóa đơn đã phát hành
    issued_inv = db.query(SalesInvoice.so_hoa_don).filter(
        SalesInvoice.delivery_id == do_id,
        SalesInvoice.trang_thai != "huy",
    ).first()
    if issued_inv:
        raise HTTPException(400, f"Hóa đơn {issued_inv.so_hoa_don} đã phát hành. Không thể thay đổi trạng thái phiếu bán hàng.")
    do.trang_thai = body.trang_thai
    db.commit()
    logger.info("updated delivery_order id=%s trang_thai=%s", do_id, body.trang_thai)
    return {"id": do_id, "trang_thai": do.trang_thai}


class XacNhanGiaoIn(BaseModel):
    ngay_giao: date
    ten_nguoi_nhan: str
    ghi_chu: Optional[str] = None
    anh_xac_nhan_giao: Optional[str] = None


@router.post("/deliveries/{do_id}/xac-nhan")
def xac_nhan_giao_hang(
    do_id: int,
    body: XacNhanGiaoIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    do = db.get(DeliveryOrder, do_id)
    if not do:
        raise HTTPException(404, "Không tìm thấy phiếu giao hàng")
    if do.trang_thai != "da_xuat":
        raise HTTPException(400, "Chỉ xác nhận được phiếu đang ở trạng thái Đã xuất")
    do.trang_thai = "da_giao"
    do.da_xac_nhan_giao = True
    do.ngay_giao_thuc_te = body.ngay_giao
    do.ten_nguoi_nhan_thuc_te = body.ten_nguoi_nhan
    if body.ghi_chu:
        do.ghi_chu = body.ghi_chu
    if body.anh_xac_nhan_giao:
        do.anh_xac_nhan_giao = body.anh_xac_nhan_giao
    db.commit()
    db.refresh(do)
    return _do_to_dict(do, db)


@router.post("/deliveries/{do_id}/extract-image")
def extract_delivery_image_ocr(
    do_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """OCR ảnh phiếu giao hàng — đọc từ erp_media (module=delivery_orders) upload bởi tài xế."""
    import json
    from pathlib import Path
    from sqlalchemy import text as _sql

    do = db.get(DeliveryOrder, do_id)
    if not do:
        raise HTTPException(404, "Không tìm thấy phiếu bán hàng")

    media_row = db.execute(
        _sql("SELECT filepath FROM erp_media WHERE module='delivery_orders' AND record_id=:rid ORDER BY id DESC LIMIT 1"),
        {"rid": str(do_id)},
    ).fetchone()
    if not media_row:
        raise HTTPException(404, "Phiếu này chưa có ảnh — tài xế cần chụp và upload ảnh phiếu trước")

    upload_base = Path(__file__).parent.parent.parent / "uploads"
    img_path = upload_base / media_row.filepath
    if not img_path.is_file():
        raise HTTPException(404, f"File ảnh không tìm thấy trên server: {media_row.filepath}")

    try:
        from app.utils.ocr import extract_phieu_giao_hang
        result = extract_phieu_giao_hang(str(img_path))
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        logger.error("OCR delivery lỗi: %s", e, exc_info=True)
        raise HTTPException(500, f"Lỗi OCR: {type(e).__name__}")

    do.ocr_extracted_data = json.dumps(result.get("extracted", {}), ensure_ascii=False)
    db.commit()

    return result


class DeliveryAdjustItemIn(BaseModel):
    item_id: int
    so_luong_moi: Decimal

class DeliveryAdjustIn(BaseModel):
    items: list[DeliveryAdjustItemIn]
    ghi_chu: str = ""


@router.post("/deliveries/{do_id}/adjust-items")
def adjust_delivery_items(
    do_id: int,
    body: DeliveryAdjustIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import json

    do = (
        db.query(DeliveryOrder)
        .options(
            selectinload(DeliveryOrder.items),
            selectinload(DeliveryOrder.invoices),
        )
        .filter(DeliveryOrder.id == do_id)
        .first()
    )
    if not do:
        raise HTTPException(404, "Không tìm thấy phiếu bán hàng")
    if do.trang_thai not in ("da_xuat", "da_giao"):
        raise HTTPException(400, "Chỉ điều chỉnh được phiếu đã xuất hoặc đã giao")

    # Khoá khi hóa đơn đã phát hành
    issued = db.query(SalesInvoice.so_hoa_don).filter(
        SalesInvoice.delivery_id == do_id,
        SalesInvoice.trang_thai != "huy",
    ).first()
    if issued:
        raise HTTPException(400, f"Hóa đơn {issued.so_hoa_don} đã phát hành. Không thể điều chỉnh phiếu bán hàng.")
    # Chỉ cho phép điều chỉnh 1 lần — đọc thẳng từ DB tránh cache ORM
    _flag = db.execute(_text("SELECT da_dieu_chinh FROM delivery_orders WHERE id = :id"), {"id": do_id}).scalar()
    if _flag:
        raise HTTPException(400, "Phiếu bán hàng đã được điều chỉnh 1 lần. Không thể điều chỉnh thêm.")

    item_map = {it.id: it for it in do.items}

    # Snapshot items BEFORE thay đổi
    item_before = [
        {
            "item_id":   it.id,
            "ten_hang":  it.ten_hang or "",
            "dvt":       it.dvt or "",
            "so_luong":  float(it.so_luong or 0),
            "don_gia":   float(it.don_gia or 0),
            "thanh_tien":float(it.thanh_tien or 0),
        }
        for it in do.items
    ]

    for adj in body.items:
        it = item_map.get(adj.item_id)
        if not it:
            raise HTTPException(400, f"Không tìm thấy dòng hàng ID {adj.item_id}")
        if adj.so_luong_moi < 0:
            raise HTTPException(400, "Số lượng không được âm")

        old_so_luong = it.so_luong or Decimal("0")
        delta = Decimal(str(adj.so_luong_moi)) - old_so_luong

        it.so_luong   = adj.so_luong_moi
        it.thanh_tien = adj.so_luong_moi * (it.don_gia or Decimal("0"))

        # Điều chỉnh tồn kho tương ứng với thay đổi số lượng
        if delta != 0 and do.warehouse_id:
            ten_hang = it.ten_hang or ""
            dvt = it.dvt or "Thùng"
            don_gia_item = it.don_gia or Decimal("0")
            if delta < 0:
                # Giảm số lượng → trả lại kho
                bal = _get_or_create_balance(
                    db, do.warehouse_id,
                    product_id=it.product_id,
                    ten_hang=ten_hang, don_vi=dvt,
                )
                _nhap_balance(bal, -delta, don_gia_item)
                _log_tx(db, do.warehouse_id, "DIEU_CHINH_GIAM_XUAT",
                        -delta, bal.don_gia_binh_quan, bal.ton_luong,
                        "delivery_orders", do.id, current_user.id,
                        product_id=it.product_id,
                        ghi_chu=f"Điều chỉnh {do.so_phieu}: giảm {ten_hang}")
            else:
                # Tăng số lượng → kiểm tra tồn rồi trừ thêm
                bal = _get_or_create_balance(
                    db, do.warehouse_id,
                    product_id=it.product_id,
                    ten_hang=ten_hang, don_vi=dvt,
                    lock=True,
                )
                if bal.ton_luong < delta:
                    raise HTTPException(
                        400,
                        f"Không đủ tồn kho để tăng: {ten_hang} — "
                        f"cần thêm {float(delta):g}, còn {float(bal.ton_luong):g}"
                    )
                _xuat_balance(bal, delta, ten_hang)
                _log_tx(db, do.warehouse_id, "DIEU_CHINH_TANG_XUAT",
                        delta, bal.don_gia_binh_quan, bal.ton_luong,
                        "delivery_orders", do.id, current_user.id,
                        product_id=it.product_id,
                        ghi_chu=f"Điều chỉnh {do.so_phieu}: tăng {ten_hang}")

    # Snapshot items AFTER thay đổi
    item_after = [
        {
            "item_id":   it.id,
            "ten_hang":  it.ten_hang or "",
            "dvt":       it.dvt or "",
            "so_luong":  float(it.so_luong or 0),
            "don_gia":   float(it.don_gia or 0),
            "thanh_tien":float(it.thanh_tien or 0),
        }
        for it in do.items
    ]

    new_tong = sum((it.thanh_tien or Decimal("0")) for it in do.items)
    do.tong_tien_hang  = new_tong
    do.tong_thanh_toan = new_tong + (do.tien_van_chuyen or Decimal("0"))

    results = []
    active_inv = next(
        (inv for inv in do.invoices if inv.trang_thai not in ("huy",)), None
    )
    if active_inv:
        new_vat   = round(new_tong * active_inv.ty_le_vat / 100, 0)
        new_total = new_tong + new_vat
        before = json.dumps({
            "tong_tien_hang": str(active_inv.tong_tien_hang),
            "ty_le_vat":      str(active_inv.ty_le_vat),
            "tien_vat":       str(active_inv.tien_vat),
            "tong_cong":      str(active_inv.tong_cong),
            "items":          item_before,
        }, ensure_ascii=False)
        after = json.dumps({
            "tong_tien_hang": str(new_tong),
            "ty_le_vat":      str(active_inv.ty_le_vat),
            "tien_vat":       str(new_vat),
            "tong_cong":      str(new_total),
            "items":          item_after,
        }, ensure_ascii=False)

        if active_inv.trang_thai == "nhap":
            active_inv.tong_tien_hang = new_tong
            active_inv.tien_vat       = new_vat
            active_inv.tong_cong      = new_total
            active_inv.updated_at     = datetime.now(timezone.utc)
            db.add(InvoiceAdjustmentLog(
                invoice_id=active_inv.id,
                adjusted_by_id=current_user.id,
                loai="truoc_ket_chuyen",
                ghi_chu=body.ghi_chu or f"Điều chỉnh theo PBH {do.so_phieu}",
                trang_thai="na",
                du_lieu_truoc=before,
                du_lieu_sau=after,
            ))
            results.append({"invoice_id": active_inv.id, "action": "updated_direct"})
        else:
            # Đã phát hành → tạo yêu cầu điều chỉnh chờ KT Trưởng duyệt
            pending = next(
                (lg for lg in active_inv.adjustment_logs if lg.trang_thai == "pending"), None
            )
            if pending:
                raise HTTPException(
                    400,
                    f"Hóa đơn #{active_inv.so_hoa_don} đang có yêu cầu điều chỉnh chờ duyệt (#{pending.id}). Vui lòng xử lý trước."
                )
            db.add(InvoiceAdjustmentLog(
                invoice_id=active_inv.id,
                adjusted_by_id=current_user.id,
                loai="sau_ket_chuyen",
                ghi_chu=body.ghi_chu or f"Điều chỉnh theo PBH {do.so_phieu}",
                trang_thai="pending",
                du_lieu_truoc=before,
                du_lieu_sau=after,
            ))
            results.append({"invoice_id": active_inv.id, "action": "adjustment_pending"})

    db.execute(_text("UPDATE delivery_orders SET da_dieu_chinh = true WHERE id = :id"), {"id": do_id})
    db.commit()
    return {
        "id": do_id,
        "so_phieu": do.so_phieu,
        "tong_tien_hang": float(do.tong_tien_hang),
        "invoice_results": results,
        "message": "Đã điều chỉnh phiếu bán hàng" + (
            ". Yêu cầu điều chỉnh hóa đơn đã được gửi chờ KT Trưởng duyệt."
            if any(r["action"] == "adjustment_pending" for r in results) else "."
        ),
    }


@router.delete("/deliveries/{do_id}")
def delete_delivery(do_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles("KHO", "KHO_TO_TRUONG", "ADMIN"))):
    do = db.get(DeliveryOrder, do_id)
    if not do:
        raise HTTPException(404, "Không tìm thấy phiếu giao hàng")
    if do.trang_thai in ("da_giao",):
        raise HTTPException(400, "Không thể xoá phiếu đã giao")

    active_invoice = db.query(SalesInvoice).filter(
        SalesInvoice.delivery_id == do_id,
        SalesInvoice.trang_thai != "huy",
    ).first()
    if active_invoice:
        raise HTTPException(400, "Khong the xoa phieu giao hang da lap hoa don")

    active_return = db.query(SalesReturn).filter(
        SalesReturn.delivery_order_id == do_id,
        SalesReturn.trang_thai != "huy",
    ).first()
    if active_return:
        raise HTTPException(400, "Khong the xoa phieu giao hang da co phieu tra hang")

    for it in do.items:
        ten_hang = it.ten_hang
        bal = _get_or_create_balance(db, do.warehouse_id,
                                     product_id=it.product_id,
                                     ten_hang=ten_hang, don_vi=it.dvt)
        bal.ton_luong += it.so_luong
        bal.gia_tri_ton = bal.ton_luong * bal.don_gia_binh_quan
        bal.cap_nhat_luc = datetime.now(timezone.utc)
        _log_tx(db, do.warehouse_id, "XOA_XUAT_BAN",
                it.so_luong, it.don_gia or Decimal("0"), bal.ton_luong,
                "delivery_orders", do.id, current_user.id,
                product_id=it.product_id,
                ghi_chu=f"Xóa {do.so_phieu}")

        if it.sales_order_item_id:
            soi = db.get(SalesOrderItem, it.sales_order_item_id)
            if soi:
                soi.so_luong_da_xuat = max(Decimal("0"), (soi.so_luong_da_xuat or Decimal("0")) - it.so_luong)

    _recalc_sales_order_delivery_status(db, do.sales_order_id)

    acc_service = AccountingService(db)
    acc_service._reverse_journal_entries("delivery_orders", do_id)

    db.delete(do)
    db.commit()
    return {"ok": True}


def _do_to_dict(do: DeliveryOrder, db: Session, include_print_data: bool = False) -> dict:
    wh = db.get(Warehouse, do.warehouse_id)
    cus = db.get(Customer, do.customer_id)
    # Derive effective sales_order_id: direct FK first, then via production orders (LSX flow)
    effective_so_id = do.sales_order_id
    if not effective_so_id and do.items:
        for _item in do.items:
            _po = _item.production_order if hasattr(_item, "production_order") else None
            if _po and _po.sales_order_id:
                effective_so_id = _po.sales_order_id
                break
    so = db.get(SalesOrder, effective_so_id) if effective_so_id else None
    xe = do.xe if hasattr(do, "xe") else None
    tai_xe = do.tai_xe if hasattr(do, "tai_xe") else None
    don_gia_vc = do.don_gia_vc if hasattr(do, "don_gia_vc") else None
    # Phap nhan: ưu tiên explicit trên phiếu, fallback warehouse → phan_xuong
    phap_nhan_id: int | None = getattr(do, "phap_nhan_id", None)
    if not phap_nhan_id and wh and wh.phan_xuong_id:
        px = db.get(PhanXuong, wh.phan_xuong_id)
        if px:
            phap_nhan_id = px.phap_nhan_id

    # Calculate returned quantities for this delivery order
    returned_qty_map: dict[int, float] = {}
    if do.id:
        from app.models.sales import SalesReturn, SalesReturnItem
        rows = (
            db.query(
                DeliveryOrderItem.id,
                func.sum(SalesReturnItem.so_luong_tra)
            )
            .select_from(SalesReturnItem)
            .join(SalesReturn, SalesReturn.id == SalesReturnItem.sales_return_id)
            .join(
                DeliveryOrderItem,
                or_(
                    SalesReturnItem.delivery_order_item_id == DeliveryOrderItem.id,
                    and_(
                        SalesReturnItem.delivery_order_item_id.is_(None),
                        DeliveryOrderItem.delivery_id == SalesReturn.delivery_order_id,
                        DeliveryOrderItem.sales_order_item_id == SalesReturnItem.sales_order_item_id,
                    ),
                ),
            )
            .filter(
                SalesReturn.delivery_order_id == do.id,
                DeliveryOrderItem.delivery_id == do.id,
                SalesReturn.trang_thai != "huy"
            )
            .group_by(DeliveryOrderItem.id)
            .all()
        )
        returned_qty_map = {item_id: float(qty) for item_id, qty in rows}

    def _item_dict(it: DeliveryOrderItem) -> dict:
        so_luong_da_tra = returned_qty_map.get(it.id, 0.0)
        base = {
            "id": it.id,
            "production_order_id": it.production_order_id if hasattr(it, "production_order_id") else None,
            "so_lenh": (it.production_order.so_lenh if it.production_order else None) if hasattr(it, "production_order") else None,
            "sales_order_item_id": it.sales_order_item_id,
            "product_id": it.product_id,
            "ten_hang": it.ten_hang,
            "so_luong": float(it.so_luong),
            "so_luong_da_tra": so_luong_da_tra,
            "so_luong_con_lai": max(0.0, float(it.so_luong) - so_luong_da_tra),
            "dvt": it.dvt,
            "dien_tich": float(it.dien_tich or 0) if hasattr(it, "dien_tich") else 0.0,
            "trong_luong": float(it.trong_luong or 0) if hasattr(it, "trong_luong") else 0.0,
            "the_tich": float(getattr(it, "the_tich", None) or 0),
            "don_gia": float(it.don_gia or 0) if hasattr(it, "don_gia") else 0.0,
            "thanh_tien": float(it.thanh_tien or 0) if hasattr(it, "thanh_tien") else 0.0,
            "ghi_chu": it.ghi_chu,
        }
        if include_print_data and hasattr(it, "production_order") and it.production_order:
            po = it.production_order
            po_so = po.sales_order if hasattr(po, "sales_order") else None
            po_items = po.items if hasattr(po, "items") else []
            pi = po_items[0] if po_items else None
            # Quy cách: DxRxC_số_lớp
            if pi and pi.dai and pi.rong and pi.cao:
                d = float(pi.dai); r = float(pi.rong); c = float(pi.cao)
                sl = pi.so_lop or ""
                quy_cach = f"{d:g}x{r:g}x{c:g}{'_'+str(sl)+'L' if sl else ''}"
            else:
                quy_cach = None
            base.update({
                "so_don_item": po_so.so_don if po_so else None,
                "so_po_kh": po_so.so_po_kh if po_so else None,
                "ngay_po": str(po_so.ngay_dat) if po_so and getattr(po_so, "ngay_dat", None) else None,
                "ket_cau": pi.to_hop_song if pi else None,
                "quy_cach": quy_cach,
                "kho_tt": float(pi.kho_tt) if pi and pi.kho_tt else None,
                "dai_tt": float(pi.dai_tt) if pi and pi.dai_tt else None,
                "dai": float(pi.dai) if pi and pi.dai else None,
                "rong": float(pi.rong) if pi and pi.rong else None,
                "cao": float(pi.cao) if pi and pi.cao else None,
                "so_lop": pi.so_lop if pi else None,
            })
        return base

    return {
        "id": do.id,
        "so_phieu": do.so_phieu,
        "ngay_xuat": str(do.ngay_xuat),
        "sales_order_id": effective_so_id,
        "so_don": so.so_don if so else None,
        "customer_id": do.customer_id,
        "ten_khach": cus.ten_viet_tat if cus else "",
        "warehouse_id": do.warehouse_id,
        "ten_kho": wh.ten_kho if wh else "",
        "loai_kho": wh.loai_kho if wh else None,
        "phap_nhan_id": phap_nhan_id,
        "yeu_cau_id": do.yeu_cau_id if hasattr(do, "yeu_cau_id") else None,
        "dia_chi_giao": do.dia_chi_giao,
        "nguoi_nhan": do.nguoi_nhan,
        "xe_van_chuyen": do.xe_van_chuyen,
        "xe_id": do.xe_id if hasattr(do, "xe_id") else None,
        "bien_so": xe.bien_so if xe else None,
        "loai_xe": xe.loai_xe if xe else None,
        "trong_tai": float(xe.trong_tai) if xe and xe.trong_tai else None,
        "tai_xe_id": do.tai_xe_id if hasattr(do, "tai_xe_id") else None,
        "ten_tai_xe": tai_xe.ho_ten if tai_xe else None,
        "lo_xe": do.lo_xe if hasattr(do, "lo_xe") else None,
        "lo_xe_id": do.lo_xe_id if hasattr(do, "lo_xe_id") else None,
        "ten_lo_xe": (do.lo_xe_rel.ho_ten if do.lo_xe_rel else None) if hasattr(do, "lo_xe_rel") else None,
        "lo_xe_id_2": do.lo_xe_id_2 if hasattr(do, "lo_xe_id_2") else None,
        "ten_lo_xe_2": (do.lo_xe_rel_2.ho_ten if do.lo_xe_rel_2 else None) if hasattr(do, "lo_xe_rel_2") else None,
        "so_seal": do.so_seal if hasattr(do, "so_seal") else None,
        "gui_kem_theo": do.gui_kem_theo if hasattr(do, "gui_kem_theo") else None,
        "don_gia_vc_id": do.don_gia_vc_id if hasattr(do, "don_gia_vc_id") else None,
        "ten_tuyen": don_gia_vc.ten_tuyen if don_gia_vc else None,
        "tien_van_chuyen": float(do.tien_van_chuyen) if getattr(do, "tien_van_chuyen", None) else 0.0,
        "tong_tien_hang": float(do.tong_tien_hang) if getattr(do, "tong_tien_hang", None) else 0.0,
        "tong_thanh_toan": float(do.tong_thanh_toan) if getattr(do, "tong_thanh_toan", None) else 0.0,
        "trang_thai_cong_no": getattr(do, "trang_thai_cong_no", "chua_thu"),
        "tong_dien_tich": sum(float(it.dien_tich or 0) for it in do.items),
        "tong_trong_luong": sum(float(it.trong_luong or 0) for it in do.items),
        "tong_the_tich": sum(float(getattr(it, "the_tich", None) or 0) for it in do.items),
        "trang_thai": do.trang_thai,
        "da_xac_nhan_giao": bool(getattr(do, "da_xac_nhan_giao", False)),
        "co_hang_ve": bool(getattr(do, "co_hang_ve", False)),
        "ngay_giao_thuc_te": str(do.ngay_giao_thuc_te) if getattr(do, "ngay_giao_thuc_te", None) else None,
        "ten_nguoi_nhan_thuc_te": getattr(do, "ten_nguoi_nhan_thuc_te", None),
        "ghi_chu": do.ghi_chu,
        "created_at": do.created_at.isoformat() if do.created_at else None,
        "items": [_item_dict(it) for it in do.items],
        "da_dieu_chinh": bool(db.execute(_text("SELECT da_dieu_chinh FROM delivery_orders WHERE id=:id"), {"id": do.id}).scalar()),
        "has_issued_invoice": db.query(SalesInvoice.id).filter(SalesInvoice.delivery_id == do.id, SalesInvoice.trang_thai != "huy").first() is not None,
        "invoice_id": db.query(SalesInvoice.id).filter(SalesInvoice.delivery_id == do.id, SalesInvoice.trang_thai != "huy").order_by(SalesInvoice.id.desc()).limit(1).scalar(),
        "invoice_status": db.query(SalesInvoice.trang_thai).filter(SalesInvoice.delivery_id == do.id, SalesInvoice.trang_thai != "huy").order_by(SalesInvoice.id.desc()).limit(1).scalar(),
        "created_by_name": (do.creator.ho_ten if do.creator else None) if hasattr(do, "creator") else None,
    }
