from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import Supplier, Warehouse, PaperMaterial, OtherMaterial
from app.models.inventory import InventoryBalance
from app.models.procurement import PurchaseOrder, PurchaseOrderItem, MaterialReceipt, MaterialReceiptItem
from app.schemas.procurement import (
    PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse,
    PurchaseOrderListItem, PurchaseOrderItemResponse, POPagedResponse,
    MaterialReceiptCreate, MaterialReceiptUpdate, MaterialReceiptResponse,
    MaterialReceiptListItem, MaterialReceiptItemResponse, ReceiptPagedResponse,
    MaterialInventoryRow,
)

router = APIRouter(prefix="/api/procurement", tags=["procurement"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _gen_so_don_mua(db: Session, loai_don: str) -> str:
    today = date.today()
    prefix_map = {"giay_cuon": "DMGC", "khac": "DMK"}
    prefix = f"{prefix_map.get(loai_don, 'DM')}{today.strftime('%Y%m%d')}"
    last = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.so_don_mua.like(f"{prefix}%"))
        .order_by(PurchaseOrder.so_don_mua.desc())
        .first()
    )
    seq = int(last.so_don_mua[-3:]) + 1 if last else 1
    return f"{prefix}{seq:03d}"


def _gen_so_phieu_nhap(db: Session) -> str:
    today = date.today()
    prefix = f"PIN{today.strftime('%Y%m%d')}"
    last = (
        db.query(MaterialReceipt)
        .filter(MaterialReceipt.so_phieu.like(f"{prefix}%"))
        .order_by(MaterialReceipt.so_phieu.desc())
        .first()
    )
    seq = int(last.so_phieu[-3:]) + 1 if last else 1
    return f"{prefix}{seq:03d}"


def _item_response(item: PurchaseOrderItem) -> PurchaseOrderItemResponse:
    ten_nl = None
    ma_nl = None
    if item.paper_material:
        ten_nl = item.paper_material.ten  # type: ignore[attr-defined]
        ma_nl = item.paper_material.ma_chinh  # type: ignore[attr-defined]
    elif item.other_material:
        ten_nl = item.other_material.ten  # type: ignore[attr-defined]
        ma_nl = item.other_material.ma_chinh  # type: ignore[attr-defined]
    return PurchaseOrderItemResponse(
        id=item.id,
        order_id=item.order_id,
        paper_material_id=item.paper_material_id,
        other_material_id=item.other_material_id,
        ten_hang=item.ten_hang or ten_nl,
        ten_nguyen_lieu=ten_nl,
        ma_nguyen_lieu=ma_nl,
        so_cuon=item.so_cuon,
        so_luong=item.so_luong,
        dvt=item.dvt,
        don_gia=item.don_gia,
        thanh_tien=item.thanh_tien,
        so_luong_da_nhap=item.so_luong_da_nhap,
        ghi_chu=item.ghi_chu,
    )


def _receipt_item_response(item: MaterialReceiptItem) -> MaterialReceiptItemResponse:
    ten_nl = None
    ma_nl = None
    if item.paper_material:
        ten_nl = item.paper_material.ten  # type: ignore[attr-defined]
        ma_nl = item.paper_material.ma_chinh  # type: ignore[attr-defined]
    elif item.other_material:
        ten_nl = item.other_material.ten  # type: ignore[attr-defined]
        ma_nl = item.other_material.ma_chinh  # type: ignore[attr-defined]
    return MaterialReceiptItemResponse(
        id=item.id,
        receipt_id=item.receipt_id,
        purchase_order_item_id=item.purchase_order_item_id,
        paper_material_id=item.paper_material_id,
        other_material_id=item.other_material_id,
        ten_hang=item.ten_hang or ten_nl,
        ten_nguyen_lieu=ten_nl,
        ma_nguyen_lieu=ma_nl,
        so_luong=item.so_luong,
        dvt=item.dvt,
        don_gia=item.don_gia,
        thanh_tien=item.thanh_tien,
        ghi_chu=item.ghi_chu,
    )


def _po_response(po: PurchaseOrder) -> PurchaseOrderResponse:
    return PurchaseOrderResponse(
        id=po.id,
        so_don_mua=po.so_don_mua,
        loai_don=po.loai_don,
        ngay_dat=po.ngay_dat,
        supplier_id=po.supplier_id,
        ten_nha_cung_cap=po.supplier.ten_viet_tat if po.supplier else None,
        nv_thu_mua_id=po.nv_thu_mua_id,
        ten_nv_thu_mua=po.nv_thu_mua.ho_ten if po.nv_thu_mua else None,  # type: ignore[attr-defined]
        nguoi_duyet_id=po.nguoi_duyet_id,
        ten_nguoi_duyet=po.nguoi_duyet.ho_ten if po.nguoi_duyet else None,  # type: ignore[attr-defined]
        ngay_duyet=po.ngay_duyet,
        ten_nhom_hang=po.ten_nhom_hang,
        tong_tien=po.tong_tien,
        trang_thai=po.trang_thai,
        noi_dung=po.noi_dung,
        ghi_chu=po.ghi_chu,
        items=[_item_response(i) for i in po.items],
        created_at=po.created_at,
        updated_at=po.updated_at,
    )


def _receipt_response(r: MaterialReceipt) -> MaterialReceiptResponse:
    return MaterialReceiptResponse(
        id=r.id,
        so_phieu=r.so_phieu,
        ngay_nhap=r.ngay_nhap,
        phan_xuong=r.phan_xuong,
        warehouse_id=r.warehouse_id,
        ten_kho=r.warehouse.ten_kho if r.warehouse else None,
        supplier_id=r.supplier_id,
        ten_nha_cung_cap=r.supplier.ten_viet_tat if r.supplier else None,
        purchase_order_id=r.purchase_order_id,
        so_don_mua=r.purchase_order.so_don_mua if r.purchase_order else None,
        so_phieu_can=r.so_phieu_can,
        bien_so_xe=r.bien_so_xe,
        trong_luong_xe=r.trong_luong_xe,
        trong_luong_hang=r.trong_luong_hang,
        tong_tien=r.tong_tien,
        ghi_chu=r.ghi_chu,
        trang_thai=r.trang_thai,
        items=[_receipt_item_response(i) for i in r.items],
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


def _calc_tong(items: list) -> float:
    return sum(float(i.thanh_tien) for i in items)


# ─── Purchase Orders ──────────────────────────────────────────────────────────

@router.get("/purchase-orders", response_model=POPagedResponse)
def list_purchase_orders(
    search: str = Query(default=""),
    loai_don: str | None = Query(default=None),
    trang_thai: str | None = Query(default=None),
    supplier_id: int | None = Query(default=None),
    tu_ngay: date | None = Query(default=None),
    den_ngay: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(PurchaseOrder).options(joinedload(PurchaseOrder.supplier))

    if search:
        like = f"%{search}%"
        q = q.join(Supplier, PurchaseOrder.supplier_id == Supplier.id).filter(
            PurchaseOrder.so_don_mua.ilike(like) | Supplier.ten_viet_tat.ilike(like)
        )
    if loai_don:
        q = q.filter(PurchaseOrder.loai_don == loai_don)
    if trang_thai:
        q = q.filter(PurchaseOrder.trang_thai == trang_thai)
    if supplier_id:
        q = q.filter(PurchaseOrder.supplier_id == supplier_id)
    if tu_ngay:
        q = q.filter(PurchaseOrder.ngay_dat >= tu_ngay)
    if den_ngay:
        q = q.filter(PurchaseOrder.ngay_dat <= den_ngay)

    total = q.count()
    pos = q.order_by(PurchaseOrder.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for po in pos:
        item_count = db.query(PurchaseOrderItem).filter(PurchaseOrderItem.order_id == po.id).count()
        items.append(PurchaseOrderListItem(
            id=po.id,
            so_don_mua=po.so_don_mua,
            loai_don=po.loai_don,
            ngay_dat=po.ngay_dat,
            supplier_id=po.supplier_id,
            ten_nha_cung_cap=po.supplier.ten_viet_tat if po.supplier else None,
            tong_tien=po.tong_tien,
            trang_thai=po.trang_thai,
            so_dong=item_count,
            created_at=po.created_at,
        ))

    return POPagedResponse(
        items=items, total=total, page=page,
        page_size=page_size, total_pages=(total + page_size - 1) // page_size
    )


@router.get("/purchase-orders/{po_id}", response_model=PurchaseOrderResponse)
def get_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    po = (
        db.query(PurchaseOrder)
        .options(
            joinedload(PurchaseOrder.supplier),
            joinedload(PurchaseOrder.nv_thu_mua),
            joinedload(PurchaseOrder.nguoi_duyet),
            joinedload(PurchaseOrder.items).joinedload(PurchaseOrderItem.paper_material),
            joinedload(PurchaseOrder.items).joinedload(PurchaseOrderItem.other_material),
        )
        .filter(PurchaseOrder.id == po_id)
        .first()
    )
    if not po:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn mua")
    return _po_response(po)


@router.post("/purchase-orders", response_model=PurchaseOrderResponse, status_code=201)
def create_purchase_order(
    body: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    po = PurchaseOrder(
        so_don_mua=_gen_so_don_mua(db, body.loai_don),
        loai_don=body.loai_don,
        ngay_dat=body.ngay_dat,
        supplier_id=body.supplier_id,
        nv_thu_mua_id=body.nv_thu_mua_id,
        ten_nhom_hang=body.ten_nhom_hang,
        noi_dung=body.noi_dung,
        ghi_chu=body.ghi_chu,
        created_by=current_user.id,
    )
    db.add(po)
    db.flush()

    tong = 0
    for idx, item_data in enumerate(body.items, 1):
        tt = float(item_data.so_luong) * float(item_data.don_gia)
        item = PurchaseOrderItem(
            order_id=po.id,
            paper_material_id=item_data.paper_material_id,
            other_material_id=item_data.other_material_id,
            ten_hang=item_data.ten_hang,
            so_cuon=item_data.so_cuon,
            so_luong=item_data.so_luong,
            dvt=item_data.dvt,
            don_gia=item_data.don_gia,
            thanh_tien=tt,
            ghi_chu=item_data.ghi_chu,
        )
        db.add(item)
        tong += tt

    po.tong_tien = tong  # type: ignore[assignment]
    db.commit()
    db.refresh(po)

    po_loaded = (
        db.query(PurchaseOrder)
        .options(
            joinedload(PurchaseOrder.supplier),
            joinedload(PurchaseOrder.nv_thu_mua),
            joinedload(PurchaseOrder.nguoi_duyet),
            joinedload(PurchaseOrder.items).joinedload(PurchaseOrderItem.paper_material),
            joinedload(PurchaseOrder.items).joinedload(PurchaseOrderItem.other_material),
        )
        .filter(PurchaseOrder.id == po.id)
        .one()
    )
    return _po_response(po_loaded)


@router.put("/purchase-orders/{po_id}", response_model=PurchaseOrderResponse)
def update_purchase_order(
    po_id: int,
    body: PurchaseOrderUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn mua")
    if po.trang_thai not in ("cho_duyet",):
        raise HTTPException(status_code=400, detail="Chỉ sửa được đơn ở trạng thái chờ duyệt")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(po, field, value)
    db.commit()
    db.refresh(po)

    po_loaded = (
        db.query(PurchaseOrder)
        .options(
            joinedload(PurchaseOrder.supplier),
            joinedload(PurchaseOrder.nv_thu_mua),
            joinedload(PurchaseOrder.nguoi_duyet),
            joinedload(PurchaseOrder.items).joinedload(PurchaseOrderItem.paper_material),
            joinedload(PurchaseOrder.items).joinedload(PurchaseOrderItem.other_material),
        )
        .filter(PurchaseOrder.id == po.id)
        .one()
    )
    return _po_response(po_loaded)


@router.patch("/purchase-orders/{po_id}/approve", response_model=PurchaseOrderResponse)
def approve_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn mua")
    if po.trang_thai != "cho_duyet":
        raise HTTPException(status_code=400, detail="Đơn không ở trạng thái chờ duyệt")
    po.trang_thai = "da_duyet"
    po.nguoi_duyet_id = current_user.id
    po.ngay_duyet = datetime.utcnow()
    db.commit()
    db.refresh(po)

    po_loaded = (
        db.query(PurchaseOrder)
        .options(
            joinedload(PurchaseOrder.supplier),
            joinedload(PurchaseOrder.nv_thu_mua),
            joinedload(PurchaseOrder.nguoi_duyet),
            joinedload(PurchaseOrder.items).joinedload(PurchaseOrderItem.paper_material),
            joinedload(PurchaseOrder.items).joinedload(PurchaseOrderItem.other_material),
        )
        .filter(PurchaseOrder.id == po.id)
        .one()
    )
    return _po_response(po_loaded)


@router.patch("/purchase-orders/{po_id}/cancel")
def cancel_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn mua")
    if po.trang_thai == "hoan_thanh":
        raise HTTPException(status_code=400, detail="Không thể hủy đơn đã hoàn thành")
    po.trang_thai = "huy"
    db.commit()
    return {"ok": True}


# ─── Material Receipts ────────────────────────────────────────────────────────

@router.get("/material-receipts", response_model=ReceiptPagedResponse)
def list_material_receipts(
    search: str = Query(default=""),
    trang_thai: str | None = Query(default=None),
    supplier_id: int | None = Query(default=None),
    warehouse_id: int | None = Query(default=None),
    tu_ngay: date | None = Query(default=None),
    den_ngay: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(MaterialReceipt).options(
        joinedload(MaterialReceipt.supplier),
        joinedload(MaterialReceipt.warehouse),
        joinedload(MaterialReceipt.purchase_order),
    )

    if search:
        like = f"%{search}%"
        q = q.filter(MaterialReceipt.so_phieu.ilike(like))
    if trang_thai:
        q = q.filter(MaterialReceipt.trang_thai == trang_thai)
    if supplier_id:
        q = q.filter(MaterialReceipt.supplier_id == supplier_id)
    if warehouse_id:
        q = q.filter(MaterialReceipt.warehouse_id == warehouse_id)
    if tu_ngay:
        q = q.filter(MaterialReceipt.ngay_nhap >= tu_ngay)
    if den_ngay:
        q = q.filter(MaterialReceipt.ngay_nhap <= den_ngay)

    total = q.count()
    receipts = q.order_by(MaterialReceipt.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for r in receipts:
        item_count = db.query(MaterialReceiptItem).filter(MaterialReceiptItem.receipt_id == r.id).count()
        items.append(MaterialReceiptListItem(
            id=r.id,
            so_phieu=r.so_phieu,
            ngay_nhap=r.ngay_nhap,
            supplier_id=r.supplier_id,
            ten_nha_cung_cap=r.supplier.ten_viet_tat if r.supplier else None,
            ten_kho=r.warehouse.ten_kho if r.warehouse else None,
            purchase_order_id=r.purchase_order_id,
            so_don_mua=r.purchase_order.so_don_mua if r.purchase_order else None,
            tong_tien=r.tong_tien,
            trang_thai=r.trang_thai,
            so_dong=item_count,
            created_at=r.created_at,
        ))

    return ReceiptPagedResponse(
        items=items, total=total, page=page,
        page_size=page_size, total_pages=(total + page_size - 1) // page_size
    )


@router.get("/material-receipts/{receipt_id}", response_model=MaterialReceiptResponse)
def get_material_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    r = (
        db.query(MaterialReceipt)
        .options(
            joinedload(MaterialReceipt.supplier),
            joinedload(MaterialReceipt.warehouse),
            joinedload(MaterialReceipt.purchase_order),
            joinedload(MaterialReceipt.items).joinedload(MaterialReceiptItem.paper_material),
            joinedload(MaterialReceipt.items).joinedload(MaterialReceiptItem.other_material),
        )
        .filter(MaterialReceipt.id == receipt_id)
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu nhập")
    return _receipt_response(r)


@router.post("/material-receipts", response_model=MaterialReceiptResponse, status_code=201)
def create_material_receipt(
    body: MaterialReceiptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = MaterialReceipt(
        so_phieu=_gen_so_phieu_nhap(db),
        ngay_nhap=body.ngay_nhap,
        phan_xuong=body.phan_xuong,
        warehouse_id=body.warehouse_id,
        supplier_id=body.supplier_id,
        purchase_order_id=body.purchase_order_id,
        so_phieu_can=body.so_phieu_can,
        bien_so_xe=body.bien_so_xe,
        trong_luong_xe=body.trong_luong_xe,
        trong_luong_hang=body.trong_luong_hang,
        ghi_chu=body.ghi_chu,
        created_by=current_user.id,
    )
    db.add(r)
    db.flush()

    tong = 0
    for item_data in body.items:
        tt = float(item_data.so_luong) * float(item_data.don_gia)
        item = MaterialReceiptItem(
            receipt_id=r.id,
            purchase_order_item_id=item_data.purchase_order_item_id,
            paper_material_id=item_data.paper_material_id,
            other_material_id=item_data.other_material_id,
            ten_hang=item_data.ten_hang,
            so_luong=item_data.so_luong,
            dvt=item_data.dvt,
            don_gia=item_data.don_gia,
            thanh_tien=tt,
            ghi_chu=item_data.ghi_chu,
        )
        db.add(item)
        tong += tt

    r.tong_tien = tong  # type: ignore[assignment]
    db.commit()
    db.refresh(r)

    r_loaded = (
        db.query(MaterialReceipt)
        .options(
            joinedload(MaterialReceipt.supplier),
            joinedload(MaterialReceipt.warehouse),
            joinedload(MaterialReceipt.purchase_order),
            joinedload(MaterialReceipt.items).joinedload(MaterialReceiptItem.paper_material),
            joinedload(MaterialReceipt.items).joinedload(MaterialReceiptItem.other_material),
        )
        .filter(MaterialReceipt.id == r.id)
        .one()
    )
    return _receipt_response(r_loaded)


@router.patch("/material-receipts/{receipt_id}/confirm", response_model=MaterialReceiptResponse)
def confirm_material_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xác nhận nhập kho — cập nhật tồn kho nguyên liệu."""
    r = (
        db.query(MaterialReceipt)
        .options(
            joinedload(MaterialReceipt.supplier),
            joinedload(MaterialReceipt.warehouse),
            joinedload(MaterialReceipt.purchase_order),
            joinedload(MaterialReceipt.items).joinedload(MaterialReceiptItem.paper_material),
            joinedload(MaterialReceipt.items).joinedload(MaterialReceiptItem.other_material),
        )
        .filter(MaterialReceipt.id == receipt_id)
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu nhập")
    if r.trang_thai == "xac_nhan":
        raise HTTPException(status_code=400, detail="Phiếu đã được xác nhận")

    for item in r.items:
        bal = (
            db.query(InventoryBalance)
            .filter(
                InventoryBalance.warehouse_id == r.warehouse_id,
                InventoryBalance.paper_material_id == item.paper_material_id,
                InventoryBalance.other_material_id == item.other_material_id,
            )
            .first()
        )
        sl = float(item.so_luong)
        dp = float(item.don_gia)
        if not bal:
            bal = InventoryBalance(
                warehouse_id=r.warehouse_id,
                paper_material_id=item.paper_material_id,
                other_material_id=item.other_material_id,
                ton_luong=sl,
                gia_tri_ton=sl * dp,
                don_gia_binh_quan=dp,
            )
            db.add(bal)
        else:
            ton_cu = float(bal.ton_luong)
            gt_cu = float(bal.gia_tri_ton)
            ton_moi = ton_cu + sl
            gt_moi = gt_cu + sl * dp
            bal.ton_luong = ton_moi  # type: ignore[assignment]
            bal.gia_tri_ton = gt_moi  # type: ignore[assignment]
            bal.don_gia_binh_quan = gt_moi / ton_moi if ton_moi else 0  # type: ignore[assignment]

        # Cập nhật số lượng đã nhập trên dòng đơn hàng
        if item.purchase_order_item_id:
            po_item = db.query(PurchaseOrderItem).filter(
                PurchaseOrderItem.id == item.purchase_order_item_id
            ).first()
            if po_item:
                po_item.so_luong_da_nhap = float(po_item.so_luong_da_nhap) + sl  # type: ignore[assignment]

    r.trang_thai = "xac_nhan"
    db.commit()

    r2 = (
        db.query(MaterialReceipt)
        .options(
            joinedload(MaterialReceipt.supplier),
            joinedload(MaterialReceipt.warehouse),
            joinedload(MaterialReceipt.purchase_order),
            joinedload(MaterialReceipt.items).joinedload(MaterialReceiptItem.paper_material),
            joinedload(MaterialReceipt.items).joinedload(MaterialReceiptItem.other_material),
        )
        .filter(MaterialReceipt.id == r.id)
        .one()
    )
    return _receipt_response(r2)


# ─── Kho nguyên liệu ─────────────────────────────────────────────────────────

@router.get("/inventory/material", response_model=list[MaterialInventoryRow])
def get_material_inventory(
    warehouse_id: int | None = Query(default=None),
    loai: str | None = Query(default=None),  # giay_cuon | khac
    search: str = Query(default=""),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(InventoryBalance).filter(
        (InventoryBalance.paper_material_id.isnot(None)) |
        (InventoryBalance.other_material_id.isnot(None))
    )
    if warehouse_id:
        q = q.filter(InventoryBalance.warehouse_id == warehouse_id)

    rows = []
    for bal in q.all():
        if bal.paper_material_id:
            pm = db.query(PaperMaterial).filter(PaperMaterial.id == bal.paper_material_id).first()
            if not pm:
                continue
            if loai and loai != "giay_cuon":
                continue
            if search and search.lower() not in (pm.ten or "").lower() and search.lower() not in (pm.ma_chinh or "").lower():
                continue
            rows.append(MaterialInventoryRow(
                ma_nguyen_lieu=pm.ma_chinh,
                ten_nguyen_lieu=pm.ten,
                loai="giay_cuon",
                dvt="kg",
                ton_luong=bal.ton_luong,
                gia_tri_ton=bal.gia_tri_ton,
                don_gia_binh_quan=bal.don_gia_binh_quan,
            ))
        elif bal.other_material_id:
            om = db.query(OtherMaterial).filter(OtherMaterial.id == bal.other_material_id).first()
            if not om:
                continue
            if loai and loai != "khac":
                continue
            if search and search.lower() not in (om.ten or "").lower() and search.lower() not in (om.ma_chinh or "").lower():
                continue
            rows.append(MaterialInventoryRow(
                ma_nguyen_lieu=om.ma_chinh,
                ten_nguyen_lieu=om.ten,
                loai="khac",
                dvt=om.dvt if hasattr(om, 'dvt') else None,
                ton_luong=bal.ton_luong,
                gia_tri_ton=bal.gia_tri_ton,
                don_gia_binh_quan=bal.don_gia_binh_quan,
            ))

    return rows
