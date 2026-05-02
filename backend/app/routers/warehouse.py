from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import PhanXuong, Warehouse, PaperMaterial, OtherMaterial, Supplier, Product
from app.models.inventory import InventoryBalance, InventoryTransaction
from app.models.purchase import PurchaseOrder, PurchaseOrderItem
from app.models.production import ProductionOrder
from app.models.sales import SalesOrder, SalesOrderItem
from app.models.master import Customer
from app.models.warehouse_doc import (
    GoodsReceipt, GoodsReceiptItem,
    MaterialIssue, MaterialIssueItem,
    ProductionOutput,
    DeliveryOrder, DeliveryOrderItem,
    PhieuChuyenKho, PhieuChuyenKhoItem,
)
from app.models.yeu_cau_giao_hang import YeuCauGiaoHang

router = APIRouter(prefix="/api/warehouse", tags=["warehouse"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class PhanXuongCreate(BaseModel):
    ma_xuong: str
    ten_xuong: str
    dia_chi: Optional[str] = None
    cong_doan: str = "cd2"
    phoi_tu_phan_xuong_id: Optional[int] = None
    trang_thai: bool = True


class GoodsReceiptItemIn(BaseModel):
    po_item_id: Optional[int] = None
    paper_material_id: Optional[int] = None
    other_material_id: Optional[int] = None
    ten_hang: str = ""
    so_luong: Decimal
    dvt: str = "Kg"
    don_gia: Decimal = Decimal("0")
    dinh_luong_thuc_te: Optional[Decimal] = None
    do_am: Optional[Decimal] = None
    ket_qua_kiem_tra: str = "DAT"
    ghi_chu: Optional[str] = None


class GoodsReceiptIn(BaseModel):
    ngay_nhap: date
    po_id: Optional[int] = None
    supplier_id: int
    warehouse_id: int
    loai_nhap: str = "MUA_HANG"
    ghi_chu: Optional[str] = None
    items: list[GoodsReceiptItemIn]


class MaterialIssueItemIn(BaseModel):
    paper_material_id: Optional[int] = None
    other_material_id: Optional[int] = None
    ten_hang: str = ""
    so_luong_ke_hoach: Decimal = Decimal("0")
    so_luong_thuc_xuat: Decimal
    dvt: str = "Kg"
    don_gia: Decimal = Decimal("0")
    ghi_chu: Optional[str] = None


class MaterialIssueIn(BaseModel):
    ngay_xuat: date
    production_order_id: int
    warehouse_id: Optional[int] = None
    ghi_chu: Optional[str] = None
    items: list[MaterialIssueItemIn]


class ProductionOutputIn(BaseModel):
    ngay_nhap: date
    production_order_id: int
    warehouse_id: Optional[int] = None
    product_id: Optional[int] = None
    ten_hang: str = ""
    so_luong_nhap: Decimal
    so_luong_loi: Decimal = Decimal("0")
    dvt: str = "Thùng"
    don_gia_xuat_xuong: Decimal = Decimal("0")
    ghi_chu: Optional[str] = None


class DeliveryOrderItemIn(BaseModel):
    production_order_id: Optional[int] = None
    sales_order_item_id: Optional[int] = None
    product_id: Optional[int] = None
    ten_hang: str = ""
    so_luong: Decimal
    dvt: str = "Thùng"
    dien_tich: Optional[Decimal] = None
    trong_luong: Optional[Decimal] = None
    don_gia: Optional[Decimal] = None
    ghi_chu: Optional[str] = None


class DeliveryOrderIn(BaseModel):
    ngay_xuat: date
    sales_order_id: Optional[int] = None
    customer_id: Optional[int] = None
    yeu_cau_id: Optional[int] = None
    warehouse_id: Optional[int] = None
    dia_chi_giao: Optional[str] = None
    nguoi_nhan: Optional[str] = None
    xe_van_chuyen: Optional[str] = None
    xe_id: Optional[int] = None
    tai_xe_id: Optional[int] = None
    lo_xe: Optional[str] = None
    don_gia_vc_id: Optional[int] = None
    tien_van_chuyen: Optional[Decimal] = None
    ghi_chu: Optional[str] = None
    items: list[DeliveryOrderItemIn]


class PhieuChuyenItemIn(BaseModel):
    paper_material_id: Optional[int] = None
    other_material_id: Optional[int] = None
    ten_hang: str = ""
    don_vi: str = "Kg"
    so_luong: Decimal
    don_gia: Decimal = Decimal("0")
    ghi_chu: Optional[str] = None


class PhieuChuyenIn(BaseModel):
    warehouse_xuat_id: int
    warehouse_nhap_id: int
    ngay: date
    ghi_chu: Optional[str] = None
    items: list[PhieuChuyenItemIn]


# ── Inventory helpers (delegate to service) ───────────────────────────────────

from app.services.inventory_service import (
    get_or_create_balance as _get_or_create_balance,
    nhap_balance as _nhap_balance,
    xuat_balance as _xuat_balance,
    log_tx as _log_tx,
    get_workshop_warehouse as _get_workshop_warehouse,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _gen_so(db: Session, prefix: str, model_cls) -> str:
    ym = datetime.today().strftime("%Y%m")
    pattern = f"{prefix}-{ym}-%"
    last = db.query(func.max(model_cls.so_phieu)).filter(
        model_cls.so_phieu.like(pattern)
    ).scalar()
    seq = 1
    if last:
        try:
            seq = int(last.rsplit("-", 1)[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    return f"{prefix}-{ym}-{seq:04d}"


def _resolve_nvl_name(db: Session, paper_material_id: Optional[int], other_material_id: Optional[int], fallback: str = "") -> tuple[str, str]:
    """Trả về (ten_hang, dvt) từ master hoặc fallback."""
    if paper_material_id:
        m = db.get(PaperMaterial, paper_material_id)
        if m:
            return m.ten, m.dvt
    elif other_material_id:
        m = db.get(OtherMaterial, other_material_id)
        if m:
            return m.ten, m.dvt
    return fallback, "Kg"


def _px_to_dict(r: PhanXuong) -> dict:
    return {
        "id": r.id, "ma_xuong": r.ma_xuong, "ten_xuong": r.ten_xuong,
        "dia_chi": r.dia_chi, "cong_doan": r.cong_doan,
        "phoi_tu_phan_xuong_id": r.phoi_tu_phan_xuong_id,
        "ten_phoi_tu_phan_xuong": r.phoi_tu_phan_xuong.ten_xuong if r.phoi_tu_phan_xuong else None,
        "trang_thai": r.trang_thai,
    }


# ── Phân xưởng ────────────────────────────────────────────────────────────────

@router.get("/phan-xuong")
def list_phan_xuong(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(PhanXuong).order_by(PhanXuong.id).all()
    return [_px_to_dict(r) for r in rows]


@router.post("/phan-xuong", status_code=201)
def create_phan_xuong(body: PhanXuongCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if db.query(PhanXuong).filter(PhanXuong.ma_xuong == body.ma_xuong).first():
        raise HTTPException(400, f"Mã xưởng '{body.ma_xuong}' đã tồn tại")
    obj = PhanXuong(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _px_to_dict(obj)


@router.put("/phan-xuong/{px_id}")
def update_phan_xuong(px_id: int, body: PhanXuongCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    obj = db.get(PhanXuong, px_id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy phân xưởng")
    for k, v in body.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return _px_to_dict(obj)


@router.delete("/phan-xuong/{px_id}")
def delete_phan_xuong(px_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    obj = db.get(PhanXuong, px_id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy phân xưởng")
    if db.query(Warehouse).filter(Warehouse.phan_xuong_id == px_id).first():
        raise HTTPException(400, "Phân xưởng đang được dùng bởi kho, không thể xoá")
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ── Khởi tạo kho chuẩn theo xưởng ────────────────────────────────────────────

_WAREHOUSE_DEFS_BASE = [
    ("NVL_PHU",    "NVL", "Kho NVL phụ"),
    ("PHOI",       "PS",  "Kho phôi sóng"),
    ("THANH_PHAM", "TP",  "Kho thành phẩm"),
]
_WAREHOUSE_DEFS_CD1 = [
    ("GIAY_CUON",  "GC",  "Kho giấy cuộn"),
]
_ALL_LOAI = ["GIAY_CUON", "NVL_PHU", "PHOI", "THANH_PHAM"]


def _wh_to_slot(wh: Warehouse, px_name: str) -> dict:
    return {
        "id": wh.id, "ma_kho": wh.ma_kho, "ten_kho": wh.ten_kho,
        "loai_kho": wh.loai_kho, "trang_thai": wh.trang_thai,
        "dien_tich": wh.dien_tich, "suc_chua": wh.suc_chua,
        "don_vi_suc_chua": wh.don_vi_suc_chua, "ten_xuong": px_name,
        "tong_so_mat_hang": 0, "tong_gia_tri": 0.0, "tong_so_luong": 0.0,
        "phan_tram_lap_day": None,
    }


@router.post("/phan-xuong/{px_id}/init-warehouses", status_code=201)
def init_warehouses_for_phan_xuong(
    px_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    px = db.get(PhanXuong, px_id)
    if not px:
        raise HTTPException(404, "Không tìm thấy phân xưởng")

    defs = (_WAREHOUSE_DEFS_CD1 + _WAREHOUSE_DEFS_BASE) if px.cong_doan == "cd1_cd2" else _WAREHOUSE_DEFS_BASE

    result = []
    for loai_kho, suffix, ten_template in defs:
        existing = db.query(Warehouse).filter(
            Warehouse.phan_xuong_id == px_id,
            Warehouse.loai_kho == loai_kho,
        ).first()
        if existing:
            result.append({**_wh_to_slot(existing, px.ten_xuong), "created": False})
            continue

        ma_kho = f"{px.ma_xuong}-{suffix}"
        if db.query(Warehouse).filter(Warehouse.ma_kho == ma_kho).first():
            ma_kho = f"{px.ma_xuong}-{suffix}{px_id}"

        wh = Warehouse(
            ma_kho=ma_kho,
            ten_kho=f"{ten_template} - {px.ten_xuong}",
            loai_kho=loai_kho,
            phan_xuong_id=px_id,
            trang_thai=True,
        )
        db.add(wh)
        db.flush()
        result.append({**_wh_to_slot(wh, px.ten_xuong), "created": True})

    db.commit()
    return result


@router.get("/theo-phan-xuong")
def list_theo_phan_xuong(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Trả về tất cả xưởng kèm 4 slot kho chuẩn và tổng tồn kho (1 query aggregate)."""
    phan_xuongs = db.query(PhanXuong).order_by(PhanXuong.id).all()

    # Lấy tất cả warehouse theo xưởng (loai_kho in _ALL_LOAI)
    wh_list = db.query(Warehouse).filter(Warehouse.loai_kho.in_(_ALL_LOAI)).all()
    # map: phan_xuong_id → {loai_kho: Warehouse}
    wh_map: dict[int, dict[str, Warehouse]] = {}
    for wh in wh_list:
        if wh.phan_xuong_id:
            wh_map.setdefault(wh.phan_xuong_id, {})[wh.loai_kho] = wh

    # Aggregate InventoryBalance theo warehouse_id — 1 query
    wh_ids = [wh.id for wh in wh_list]
    totals_map: dict[int, dict] = {}
    if wh_ids:
        rows = (
            db.query(
                InventoryBalance.warehouse_id,
                func.count(InventoryBalance.id).label("cnt"),
                func.sum(InventoryBalance.gia_tri_ton).label("gia_tri"),
                func.coalesce(func.sum(InventoryBalance.ton_luong), 0).label("so_luong"),
            )
            .filter(
                InventoryBalance.warehouse_id.in_(wh_ids),
                InventoryBalance.ton_luong > 0,
            )
            .group_by(InventoryBalance.warehouse_id)
            .all()
        )
        for r in rows:
            totals_map[r.warehouse_id] = {
                "tong_so_mat_hang": r.cnt,
                "tong_gia_tri": float(r.gia_tri or 0),
                "tong_so_luong": float(r.so_luong or 0),
            }

    result = []
    for px in phan_xuongs:
        slots: dict[str, dict | None] = {}
        for loai in _ALL_LOAI:
            if loai == "GIAY_CUON" and px.cong_doan != "cd1_cd2":
                slots[loai] = {"not_applicable": True}
                continue
            wh = wh_map.get(px.id, {}).get(loai)
            if wh:
                totals = totals_map.get(wh.id, {"tong_so_mat_hang": 0, "tong_gia_tri": 0.0, "tong_so_luong": 0.0})
                pct = None
                if wh.suc_chua and wh.suc_chua > 0:
                    pct = round(totals["tong_so_luong"] / wh.suc_chua * 100, 1)
                slots[loai] = {
                    "id": wh.id, "ma_kho": wh.ma_kho, "ten_kho": wh.ten_kho,
                    "loai_kho": wh.loai_kho, "trang_thai": wh.trang_thai,
                    "dien_tich": wh.dien_tich, "suc_chua": wh.suc_chua,
                    "don_vi_suc_chua": wh.don_vi_suc_chua,
                    **totals,
                    "phan_tram_lap_day": pct,
                }
            else:
                slots[loai] = None

        result.append({
            "id": px.id, "ma_xuong": px.ma_xuong, "ten_xuong": px.ten_xuong,
            "dia_chi": px.dia_chi, "cong_doan": px.cong_doan, "trang_thai": px.trang_thai,
            "warehouses": slots,
        })

    return result


# ── Tồn kho ───────────────────────────────────────────────────────────────────

@router.get("/ton-kho")
def get_ton_kho(
    warehouse_id: Optional[int] = Query(None),
    phan_xuong_id: Optional[int] = Query(None),
    loai: Optional[str] = Query(None),  # "nvl" | "tp" | "giay" | "khac"
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = (db.query(InventoryBalance)
         .join(Warehouse, Warehouse.id == InventoryBalance.warehouse_id)
         .filter(InventoryBalance.ton_luong > 0))

    if warehouse_id:
        q = q.filter(InventoryBalance.warehouse_id == warehouse_id)
    if phan_xuong_id:
        q = q.filter(Warehouse.phan_xuong_id == phan_xuong_id)
    if loai == "tp":
        q = q.filter(InventoryBalance.product_id.isnot(None))
    elif loai in ("nvl", "giay"):
        q = q.filter(InventoryBalance.paper_material_id.isnot(None))
    elif loai == "khac":
        q = q.filter(InventoryBalance.other_material_id.isnot(None))

    rows = q.all()
    result = []
    for r in rows:
        ten_hang = r.ten_hang or ""
        don_vi = r.don_vi or ""
        ton_toi_thieu = 0

        if r.paper_material_id:
            mat = db.get(PaperMaterial, r.paper_material_id)
            if mat:
                ten_hang = mat.ten
                don_vi = mat.dvt
                ton_toi_thieu = float(mat.ton_toi_thieu)
        elif r.other_material_id:
            mat = db.get(OtherMaterial, r.other_material_id)
            if mat:
                ten_hang = mat.ten
                don_vi = mat.dvt
                ton_toi_thieu = float(mat.ton_toi_thieu)
        elif r.product_id:
            prod = db.get(Product, r.product_id)
            if prod:
                ten_hang = prod.ten_san_pham
                don_vi = getattr(prod, "dvt", "Thùng") or "Thùng"

        if not ten_hang:
            continue

        if search and search.lower() not in ten_hang.lower():
            continue

        wh = db.get(Warehouse, r.warehouse_id)
        result.append({
            "id": r.id,
            "warehouse_id": r.warehouse_id,
            "ten_kho": wh.ten_kho if wh else "",
            "phan_xuong_id": wh.phan_xuong_id if wh else None,
            "paper_material_id": r.paper_material_id,
            "other_material_id": r.other_material_id,
            "product_id": r.product_id,
            "ten_hang": ten_hang,
            "don_vi": don_vi,
            "ton_luong": float(r.ton_luong),
            "don_gia_binh_quan": float(r.don_gia_binh_quan),
            "gia_tri_ton": float(r.gia_tri_ton),
            "ton_toi_thieu": ton_toi_thieu,
            "cap_nhat_luc": r.cap_nhat_luc.isoformat() if r.cap_nhat_luc else None,
        })
    return result


# ── Phiếu nhập kho (GoodsReceipt) ────────────────────────────────────────────

@router.get("/goods-receipts")
def list_goods_receipts(
    warehouse_id: Optional[int] = Query(None),
    supplier_id: Optional[int] = Query(None),
    po_id: Optional[int] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(GoodsReceipt)
    if warehouse_id:
        q = q.filter(GoodsReceipt.warehouse_id == warehouse_id)
    if supplier_id:
        q = q.filter(GoodsReceipt.supplier_id == supplier_id)
    if po_id:
        q = q.filter(GoodsReceipt.po_id == po_id)
    if tu_ngay:
        q = q.filter(GoodsReceipt.ngay_nhap >= tu_ngay)
    if den_ngay:
        q = q.filter(GoodsReceipt.ngay_nhap <= den_ngay)
    rows = q.order_by(GoodsReceipt.created_at.desc()).limit(200).all()
    return [_gr_to_dict(r, db) for r in rows]


@router.get("/goods-receipts/{gr_id}")
def get_goods_receipt(gr_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    r = db.get(GoodsReceipt, gr_id)
    if not r:
        raise HTTPException(404, "Không tìm thấy phiếu nhập")
    return _gr_to_dict(r, db)


@router.post("/goods-receipts", status_code=201)
def create_goods_receipt(
    body: GoodsReceiptIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.items:
        raise HTTPException(400, "Phiếu nhập phải có ít nhất 1 dòng hàng")
    if not db.get(Warehouse, body.warehouse_id):
        raise HTTPException(404, "Không tìm thấy kho")
    if not db.get(Supplier, body.supplier_id):
        raise HTTPException(404, "Không tìm thấy nhà cung cấp")

    gr = GoodsReceipt(
        so_phieu=_gen_so(db, "GR", GoodsReceipt),
        ngay_nhap=body.ngay_nhap,
        po_id=body.po_id,
        supplier_id=body.supplier_id,
        warehouse_id=body.warehouse_id,
        loai_nhap=body.loai_nhap,
        ghi_chu=body.ghi_chu,
        created_by=current_user.id,
    )
    db.add(gr)
    db.flush()

    tong = Decimal("0")
    for it in body.items:
        ten_hang, dvt = _resolve_nvl_name(db, it.paper_material_id, it.other_material_id, it.ten_hang)
        if not ten_hang:
            ten_hang = it.ten_hang
        if it.dvt and it.dvt != "Kg":
            dvt = it.dvt
        thanh_tien = it.so_luong * it.don_gia
        tong += thanh_tien

        db.add(GoodsReceiptItem(
            receipt_id=gr.id,
            po_item_id=it.po_item_id,
            paper_material_id=it.paper_material_id,
            other_material_id=it.other_material_id,
            ten_hang=ten_hang,
            so_luong=it.so_luong,
            dvt=dvt,
            don_gia=it.don_gia,
            thanh_tien=thanh_tien,
            dinh_luong_thuc_te=it.dinh_luong_thuc_te,
            do_am=it.do_am,
            ket_qua_kiem_tra=it.ket_qua_kiem_tra,
            ghi_chu=it.ghi_chu,
        ))

        bal = _get_or_create_balance(db, body.warehouse_id,
                                     it.paper_material_id, it.other_material_id,
                                     ten_hang=ten_hang, don_vi=dvt)
        _nhap_balance(bal, it.so_luong, it.don_gia)
        _log_tx(db, body.warehouse_id, "NHAP_MUA",
                it.so_luong, it.don_gia, bal.ton_luong,
                "goods_receipts", gr.id, current_user.id,
                paper_material_id=it.paper_material_id,
                other_material_id=it.other_material_id,
                ghi_chu=it.ghi_chu)

        if it.po_item_id:
            poi = db.get(PurchaseOrderItem, it.po_item_id)
            if poi:
                poi.so_luong_da_nhan = (poi.so_luong_da_nhan or Decimal("0")) + it.so_luong

    gr.tong_gia_tri = tong
    db.commit()
    db.refresh(gr)
    return _gr_to_dict(gr, db)


@router.delete("/goods-receipts/{gr_id}")
def delete_goods_receipt(gr_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    gr = db.get(GoodsReceipt, gr_id)
    if not gr:
        raise HTTPException(404, "Không tìm thấy phiếu nhập")
    if gr.trang_thai != "nhap":
        raise HTTPException(400, "Chỉ được xoá phiếu ở trạng thái Nhập")

    for it in gr.items:
        bal = _get_or_create_balance(db, gr.warehouse_id,
                                     it.paper_material_id, it.other_material_id,
                                     ten_hang=it.ten_hang, don_vi=it.dvt)
        bal.ton_luong = max(Decimal("0"), bal.ton_luong - it.so_luong)
        bal.gia_tri_ton = bal.ton_luong * bal.don_gia_binh_quan
        bal.cap_nhat_luc = datetime.utcnow()

        if it.po_item_id:
            poi = db.get(PurchaseOrderItem, it.po_item_id)
            if poi:
                poi.so_luong_da_nhan = max(Decimal("0"), (poi.so_luong_da_nhan or Decimal("0")) - it.so_luong)

    db.delete(gr)
    db.commit()
    return {"ok": True}


def _gr_to_dict(gr: GoodsReceipt, db: Session) -> dict:
    wh = db.get(Warehouse, gr.warehouse_id)
    sup = db.get(Supplier, gr.supplier_id)
    return {
        "id": gr.id,
        "so_phieu": gr.so_phieu,
        "ngay_nhap": str(gr.ngay_nhap),
        "po_id": gr.po_id,
        "supplier_id": gr.supplier_id,
        "ten_ncc": sup.ten_viet_tat if sup else "",
        "warehouse_id": gr.warehouse_id,
        "ten_kho": wh.ten_kho if wh else "",
        "loai_nhap": gr.loai_nhap,
        "tong_gia_tri": float(gr.tong_gia_tri),
        "trang_thai": gr.trang_thai,
        "ghi_chu": gr.ghi_chu,
        "created_at": gr.created_at.isoformat() if gr.created_at else None,
        "items": [{
            "id": it.id,
            "po_item_id": it.po_item_id,
            "paper_material_id": it.paper_material_id,
            "other_material_id": it.other_material_id,
            "ten_hang": it.ten_hang,
            "so_luong": float(it.so_luong),
            "dvt": it.dvt,
            "don_gia": float(it.don_gia),
            "thanh_tien": float(it.thanh_tien),
            "dinh_luong_thuc_te": float(it.dinh_luong_thuc_te) if it.dinh_luong_thuc_te else None,
            "do_am": float(it.do_am) if it.do_am else None,
            "ket_qua_kiem_tra": it.ket_qua_kiem_tra,
            "ghi_chu": it.ghi_chu,
        } for it in gr.items],
    }


# ── Phiếu xuất NVL (MaterialIssue) ───────────────────────────────────────────

@router.get("/material-issues")
def list_material_issues(
    warehouse_id: Optional[int] = Query(None),
    production_order_id: Optional[int] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(MaterialIssue)
    if warehouse_id:
        q = q.filter(MaterialIssue.warehouse_id == warehouse_id)
    if production_order_id:
        q = q.filter(MaterialIssue.production_order_id == production_order_id)
    if tu_ngay:
        q = q.filter(MaterialIssue.ngay_xuat >= tu_ngay)
    if den_ngay:
        q = q.filter(MaterialIssue.ngay_xuat <= den_ngay)
    rows = q.order_by(MaterialIssue.created_at.desc()).limit(200).all()
    return [_mi_to_dict(r, db) for r in rows]


@router.get("/material-issues/{mi_id}")
def get_material_issue(mi_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    r = db.get(MaterialIssue, mi_id)
    if not r:
        raise HTTPException(404, "Không tìm thấy phiếu xuất NVL")
    return _mi_to_dict(r, db)


@router.post("/material-issues", status_code=201)
def create_material_issue(
    body: MaterialIssueIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.items:
        raise HTTPException(400, "Phiếu xuất phải có ít nhất 1 dòng hàng")
    order = db.get(ProductionOrder, body.production_order_id)
    if not order:
        raise HTTPException(404, "Không tìm thấy lệnh sản xuất")

    # Auto-fill warehouse từ kho NVL của xưởng nếu chưa truyền
    warehouse_id = body.warehouse_id
    if not warehouse_id and order.phan_xuong_id:
        px = db.get(PhanXuong, order.phan_xuong_id)
        loai = "GIAY_CUON" if px and getattr(px, "cong_doan", None) == "cd1_cd2" else "NVL_PHU"
        wh = _get_workshop_warehouse(db, order.phan_xuong_id, loai)
        warehouse_id = wh.id if wh else None
    if not warehouse_id:
        raise HTTPException(400, "Cần truyền warehouse_id hoặc lệnh SX phải có xưởng có kho NVL")
    if not db.get(Warehouse, warehouse_id):
        raise HTTPException(404, "Không tìm thấy kho")

    # Validate tồn trước
    for it in body.items:
        ten_hang, _ = _resolve_nvl_name(db, it.paper_material_id, it.other_material_id, it.ten_hang)
        bal = _get_or_create_balance(db, warehouse_id,
                                     it.paper_material_id, it.other_material_id,
                                     ten_hang=ten_hang or it.ten_hang)
        if bal.ton_luong < it.so_luong_thuc_xuat:
            raise HTTPException(400, f"Không đủ tồn: {ten_hang or it.ten_hang} — "
                                f"cần {float(it.so_luong_thuc_xuat):g}, còn {float(bal.ton_luong):g}")

    mi = MaterialIssue(
        so_phieu=_gen_so(db, "XI", MaterialIssue),
        ngay_xuat=body.ngay_xuat,
        production_order_id=body.production_order_id,
        warehouse_id=warehouse_id,
        ghi_chu=body.ghi_chu,
        created_by=current_user.id,
    )
    db.add(mi)
    db.flush()

    for it in body.items:
        ten_hang, dvt = _resolve_nvl_name(db, it.paper_material_id, it.other_material_id, it.ten_hang)
        if not ten_hang:
            ten_hang = it.ten_hang
        if it.dvt and it.dvt != "Kg":
            dvt = it.dvt

        db.add(MaterialIssueItem(
            issue_id=mi.id,
            paper_material_id=it.paper_material_id,
            other_material_id=it.other_material_id,
            ten_hang=ten_hang,
            so_luong_ke_hoach=it.so_luong_ke_hoach,
            so_luong_thuc_xuat=it.so_luong_thuc_xuat,
            dvt=dvt,
            don_gia=it.don_gia,
            ghi_chu=it.ghi_chu,
        ))

        bal = _get_or_create_balance(db, warehouse_id,
                                     it.paper_material_id, it.other_material_id,
                                     ten_hang=ten_hang, don_vi=dvt)
        don_gia_xuat = bal.don_gia_binh_quan
        _xuat_balance(bal, it.so_luong_thuc_xuat, ten_hang)
        _log_tx(db, warehouse_id, "XUAT_SX",
                it.so_luong_thuc_xuat, don_gia_xuat, bal.ton_luong,
                "material_issues", mi.id, current_user.id,
                paper_material_id=it.paper_material_id,
                other_material_id=it.other_material_id,
                ghi_chu=it.ghi_chu)

    db.commit()
    db.refresh(mi)
    return _mi_to_dict(mi, db)


@router.delete("/material-issues/{mi_id}")
def delete_material_issue(mi_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    mi = db.get(MaterialIssue, mi_id)
    if not mi:
        raise HTTPException(404, "Không tìm thấy phiếu xuất NVL")
    if mi.trang_thai == "da_xuat":
        raise HTTPException(400, "Không thể xoá phiếu đã xuất")

    for it in mi.items:
        bal = _get_or_create_balance(db, mi.warehouse_id,
                                     it.paper_material_id, it.other_material_id,
                                     ten_hang=it.ten_hang, don_vi=it.dvt)
        bal.ton_luong += it.so_luong_thuc_xuat
        bal.gia_tri_ton = bal.ton_luong * bal.don_gia_binh_quan
        bal.cap_nhat_luc = datetime.utcnow()

    db.delete(mi)
    db.commit()
    return {"ok": True}


def _mi_to_dict(mi: MaterialIssue, db: Session) -> dict:
    wh = db.get(Warehouse, mi.warehouse_id)
    lsx = db.get(ProductionOrder, mi.production_order_id)
    return {
        "id": mi.id,
        "so_phieu": mi.so_phieu,
        "ngay_xuat": str(mi.ngay_xuat),
        "production_order_id": mi.production_order_id,
        "so_lenh": lsx.so_lenh if lsx else "",
        "warehouse_id": mi.warehouse_id,
        "ten_kho": wh.ten_kho if wh else "",
        "trang_thai": mi.trang_thai,
        "ghi_chu": mi.ghi_chu,
        "created_at": mi.created_at.isoformat() if mi.created_at else None,
        "items": [{
            "id": it.id,
            "paper_material_id": it.paper_material_id,
            "other_material_id": it.other_material_id,
            "ten_hang": it.ten_hang,
            "so_luong_ke_hoach": float(it.so_luong_ke_hoach),
            "so_luong_thuc_xuat": float(it.so_luong_thuc_xuat),
            "dvt": it.dvt,
            "don_gia": float(it.don_gia),
            "ghi_chu": it.ghi_chu,
        } for it in mi.items],
    }


# ── Nhập thành phẩm từ sản xuất (ProductionOutput) ───────────────────────────

@router.get("/production-outputs")
def list_production_outputs(
    warehouse_id: Optional[int] = Query(None),
    production_order_id: Optional[int] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(ProductionOutput)
    if warehouse_id:
        q = q.filter(ProductionOutput.warehouse_id == warehouse_id)
    if production_order_id:
        q = q.filter(ProductionOutput.production_order_id == production_order_id)
    if tu_ngay:
        q = q.filter(ProductionOutput.ngay_nhap >= tu_ngay)
    if den_ngay:
        q = q.filter(ProductionOutput.ngay_nhap <= den_ngay)
    rows = q.order_by(ProductionOutput.created_at.desc()).limit(200).all()
    return [_po_out_to_dict(r, db) for r in rows]


@router.get("/production-outputs/{out_id}")
def get_production_output(out_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    r = db.get(ProductionOutput, out_id)
    if not r:
        raise HTTPException(404, "Không tìm thấy phiếu nhập thành phẩm")
    return _po_out_to_dict(r, db)


@router.post("/production-outputs", status_code=201)
def create_production_output(
    body: ProductionOutputIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.get(ProductionOrder, body.production_order_id)
    if not order:
        raise HTTPException(404, "Không tìm thấy lệnh sản xuất")

    # Auto-fill kho THANH_PHAM của xưởng nếu chưa truyền
    warehouse_id = body.warehouse_id
    if not warehouse_id and order.phan_xuong_id:
        wh = _get_workshop_warehouse(db, order.phan_xuong_id, "THANH_PHAM",
                                     raise_if_missing=True)
        warehouse_id = wh.id if wh else None
    if not warehouse_id:
        raise HTTPException(400, "Cần truyền warehouse_id hoặc lệnh SX phải có xưởng có kho THANH_PHAM")
    if not db.get(Warehouse, warehouse_id):
        raise HTTPException(404, "Không tìm thấy kho")

    ten_hang = body.ten_hang
    dvt = body.dvt
    if body.product_id:
        prod = db.get(Product, body.product_id)
        if prod:
            ten_hang = ten_hang or prod.ten_san_pham
            dvt = dvt or getattr(prod, "dvt", "Thùng") or "Thùng"

    out = ProductionOutput(
        so_phieu=_gen_so(db, "TP", ProductionOutput),
        ngay_nhap=body.ngay_nhap,
        production_order_id=body.production_order_id,
        warehouse_id=warehouse_id,
        product_id=body.product_id,
        ten_hang=ten_hang,
        so_luong_nhap=body.so_luong_nhap,
        so_luong_loi=body.so_luong_loi,
        dvt=dvt,
        don_gia_xuat_xuong=body.don_gia_xuat_xuong,
        ghi_chu=body.ghi_chu,
        created_by=current_user.id,
    )
    db.add(out)
    db.flush()

    bal = _get_or_create_balance(db, warehouse_id,
                                 product_id=body.product_id,
                                 ten_hang=ten_hang, don_vi=dvt)
    _nhap_balance(bal, body.so_luong_nhap, body.don_gia_xuat_xuong)
    _log_tx(db, warehouse_id, "NHAP_SX",
            body.so_luong_nhap, body.don_gia_xuat_xuong, bal.ton_luong,
            "production_outputs", out.id, current_user.id,
            product_id=body.product_id,
            ghi_chu=body.ghi_chu)

    db.commit()
    db.refresh(out)
    return _po_out_to_dict(out, db)


@router.delete("/production-outputs/{out_id}")
def delete_production_output(out_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    out = db.get(ProductionOutput, out_id)
    if not out:
        raise HTTPException(404, "Không tìm thấy phiếu nhập thành phẩm")

    bal = _get_or_create_balance(db, out.warehouse_id,
                                 product_id=out.product_id,
                                 ten_hang=out.ten_hang or "", don_vi=out.dvt)
    bal.ton_luong = max(Decimal("0"), bal.ton_luong - out.so_luong_nhap)
    bal.gia_tri_ton = bal.ton_luong * bal.don_gia_binh_quan
    bal.cap_nhat_luc = datetime.utcnow()

    db.delete(out)
    db.commit()
    return {"ok": True}


def _po_out_to_dict(out: ProductionOutput, db: Session) -> dict:
    wh = db.get(Warehouse, out.warehouse_id)
    lsx = db.get(ProductionOrder, out.production_order_id)
    return {
        "id": out.id,
        "so_phieu": out.so_phieu,
        "ngay_nhap": str(out.ngay_nhap),
        "production_order_id": out.production_order_id,
        "so_lenh": lsx.so_lenh if lsx else "",
        "warehouse_id": out.warehouse_id,
        "ten_kho": wh.ten_kho if wh else "",
        "product_id": out.product_id,
        "ten_hang": out.ten_hang,
        "so_luong_nhap": float(out.so_luong_nhap),
        "so_luong_loi": float(out.so_luong_loi),
        "dvt": out.dvt,
        "don_gia_xuat_xuong": float(out.don_gia_xuat_xuong),
        "ghi_chu": out.ghi_chu,
        "created_at": out.created_at.isoformat() if out.created_at else None,
    }


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
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(DeliveryOrder)
    if warehouse_id:
        q = q.filter(DeliveryOrder.warehouse_id == warehouse_id)
    if sales_order_id:
        q = q.filter(DeliveryOrder.sales_order_id == sales_order_id)
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
            db.query(DeliveryOrderItem.delivery_order_id)
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
            joinedload(DeliveryOrder.don_gia_vc),
        )
        .order_by(DeliveryOrder.created_at.desc()).limit(200).all()
    )
    return [_do_to_dict(r, db) for r in rows]


@router.get("/deliveries/{do_id}")
def get_delivery(do_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    r = (
        db.query(DeliveryOrder)
        .options(
            joinedload(DeliveryOrder.items).joinedload(DeliveryOrderItem.production_order),
            joinedload(DeliveryOrder.xe),
            joinedload(DeliveryOrder.tai_xe),
            joinedload(DeliveryOrder.don_gia_vc),
        )
        .filter(DeliveryOrder.id == do_id)
        .first()
    )
    if not r:
        raise HTTPException(404, "Không tìm thấy phiếu giao hàng")
    return _do_to_dict(r, db)


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
    if not db.get(Warehouse, warehouse_id):
        raise HTTPException(404, "Không tìm thấy kho")

    # Validate tồn kho cho từng item (dùng warehouse_id của item hoặc header)
    for it in body.items:
        ten_hang = it.ten_hang
        if it.product_id:
            prod = db.get(Product, it.product_id)
            if prod:
                ten_hang = ten_hang or getattr(prod, "ten_san_pham", None) or ten_hang
        # Validate từ kho header (xuất kho chính)
        bal = _get_or_create_balance(db, warehouse_id,
                                     product_id=it.product_id,
                                     ten_hang=ten_hang, don_vi=it.dvt)
        if bal.ton_luong < it.so_luong:
            raise HTTPException(400, f"Không đủ tồn TP: {ten_hang} — "
                                f"cần {float(it.so_luong):g}, còn {float(bal.ton_luong):g}")

    do = DeliveryOrder(
        so_phieu=_gen_so(db, "DO", DeliveryOrder),
        ngay_xuat=body.ngay_xuat,
        sales_order_id=body.sales_order_id,
        customer_id=customer_id,
        warehouse_id=warehouse_id,
        yeu_cau_id=body.yeu_cau_id,
        dia_chi_giao=body.dia_chi_giao,
        nguoi_nhan=body.nguoi_nhan,
        xe_van_chuyen=body.xe_van_chuyen,
        xe_id=body.xe_id,
        tai_xe_id=body.tai_xe_id,
        lo_xe=body.lo_xe,
        don_gia_vc_id=body.don_gia_vc_id,
        tien_van_chuyen=body.tien_van_chuyen,
        ghi_chu=body.ghi_chu,
        trang_thai_cong_no="chua_thu",
        created_by=current_user.id,
    )
    db.add(do)
    db.flush()

    tong_tien_hang = Decimal("0")

    for it in body.items:
        ten_hang = it.ten_hang
        dvt = it.dvt
        if it.product_id:
            prod = db.get(Product, it.product_id)
            if prod:
                ten_hang = ten_hang or getattr(prod, "ten_san_pham", None) or ten_hang
                dvt = dvt or getattr(prod, "dvt", "Thùng") or "Thùng"

        # Auto dien_tich từ ProductionOrderItem nếu không truyền
        dien_tich = it.dien_tich
        if dien_tich is None and it.production_order_id:
            from app.models.production import ProductionOrderItem as POItem
            po_item = db.query(POItem).filter(
                POItem.production_order_id == it.production_order_id
            ).first()
            if po_item and po_item.dien_tich:
                dien_tich = Decimal(str(po_item.dien_tich)) * it.so_luong

        # Auto don_gia từ SalesOrderItem nếu không truyền
        don_gia = it.don_gia
        if don_gia is None and it.sales_order_item_id:
            soi_ref = db.get(SalesOrderItem, it.sales_order_item_id)
            if soi_ref and hasattr(soi_ref, "gia_ban") and soi_ref.gia_ban:
                don_gia = Decimal(str(soi_ref.gia_ban))

        thanh_tien = (it.so_luong * don_gia) if don_gia else None
        if thanh_tien:
            tong_tien_hang += thanh_tien

        db.add(DeliveryOrderItem(
            delivery_id=do.id,
            production_order_id=it.production_order_id,
            sales_order_item_id=it.sales_order_item_id,
            product_id=it.product_id,
            ten_hang=ten_hang,
            so_luong=it.so_luong,
            dvt=dvt,
            dien_tich=dien_tich,
            trong_luong=it.trong_luong,
            don_gia=don_gia,
            thanh_tien=thanh_tien,
            ghi_chu=it.ghi_chu,
        ))

        bal = _get_or_create_balance(db, warehouse_id,
                                     product_id=it.product_id,
                                     ten_hang=ten_hang, don_vi=dvt)
        don_gia_xuat = bal.don_gia_binh_quan
        _xuat_balance(bal, it.so_luong, ten_hang)
        _log_tx(db, warehouse_id, "XUAT_BAN",
                it.so_luong, don_gia_xuat, bal.ton_luong,
                "delivery_orders", do.id, current_user.id,
                product_id=it.product_id,
                ghi_chu=it.ghi_chu)

        if it.sales_order_item_id:
            soi = db.get(SalesOrderItem, it.sales_order_item_id)
            if soi:
                soi.so_luong_da_xuat = (soi.so_luong_da_xuat or Decimal("0")) + it.so_luong

    # Cập nhật tổng
    do.tong_tien_hang = tong_tien_hang if tong_tien_hang > 0 else None
    tien_vc = body.tien_van_chuyen or Decimal("0")
    do.tong_thanh_toan = (tong_tien_hang + tien_vc) if tong_tien_hang > 0 else (tien_vc if tien_vc > 0 else None)

    # Cập nhật trạng thái yêu cầu giao hàng
    if body.yeu_cau_id:
        yc = db.get(YeuCauGiaoHang, body.yeu_cau_id)
        if yc:
            yc.trang_thai = "da_tao_phieu"

    db.commit()
    db.refresh(do)
    return _do_to_dict(do, db)


@router.delete("/deliveries/{do_id}")
def delete_delivery(do_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    do = db.get(DeliveryOrder, do_id)
    if not do:
        raise HTTPException(404, "Không tìm thấy phiếu giao hàng")
    if do.trang_thai in ("da_giao",):
        raise HTTPException(400, "Không thể xoá phiếu đã giao")

    for it in do.items:
        ten_hang = it.ten_hang
        bal = _get_or_create_balance(db, do.warehouse_id,
                                     product_id=it.product_id,
                                     ten_hang=ten_hang, don_vi=it.dvt)
        bal.ton_luong += it.so_luong
        bal.gia_tri_ton = bal.ton_luong * bal.don_gia_binh_quan
        bal.cap_nhat_luc = datetime.utcnow()

        if it.sales_order_item_id:
            soi = db.get(SalesOrderItem, it.sales_order_item_id)
            if soi:
                soi.so_luong_da_xuat = max(Decimal("0"), (soi.so_luong_da_xuat or Decimal("0")) - it.so_luong)

    db.delete(do)
    db.commit()
    return {"ok": True}


def _do_to_dict(do: DeliveryOrder, db: Session) -> dict:
    wh = db.get(Warehouse, do.warehouse_id)
    cus = db.get(Customer, do.customer_id)
    so = db.get(SalesOrder, do.sales_order_id) if do.sales_order_id else None
    xe = do.xe if hasattr(do, "xe") else None
    tai_xe = do.tai_xe if hasattr(do, "tai_xe") else None
    don_gia_vc = do.don_gia_vc if hasattr(do, "don_gia_vc") else None
    return {
        "id": do.id,
        "so_phieu": do.so_phieu,
        "ngay_xuat": str(do.ngay_xuat),
        "sales_order_id": do.sales_order_id,
        "so_don": so.so_don if so else None,
        "customer_id": do.customer_id,
        "ten_khach": cus.ten_viet_tat if cus else "",
        "warehouse_id": do.warehouse_id,
        "ten_kho": wh.ten_kho if wh else "",
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
        "don_gia_vc_id": do.don_gia_vc_id if hasattr(do, "don_gia_vc_id") else None,
        "ten_tuyen": don_gia_vc.ten_tuyen if don_gia_vc else None,
        "tien_van_chuyen": float(do.tien_van_chuyen) if getattr(do, "tien_van_chuyen", None) else 0.0,
        "tong_tien_hang": float(do.tong_tien_hang) if getattr(do, "tong_tien_hang", None) else 0.0,
        "tong_thanh_toan": float(do.tong_thanh_toan) if getattr(do, "tong_thanh_toan", None) else 0.0,
        "trang_thai_cong_no": getattr(do, "trang_thai_cong_no", "chua_thu"),
        "tong_dien_tich": sum(float(it.dien_tich or 0) for it in do.items),
        "tong_trong_luong": sum(float(it.trong_luong or 0) for it in do.items),
        "trang_thai": do.trang_thai,
        "ghi_chu": do.ghi_chu,
        "created_at": do.created_at.isoformat() if do.created_at else None,
        "items": [{
            "id": it.id,
            "production_order_id": it.production_order_id if hasattr(it, "production_order_id") else None,
            "so_lenh": (it.production_order.so_lenh if it.production_order else None) if hasattr(it, "production_order") else None,
            "sales_order_item_id": it.sales_order_item_id,
            "product_id": it.product_id,
            "ten_hang": it.ten_hang,
            "so_luong": float(it.so_luong),
            "dvt": it.dvt,
            "dien_tich": float(it.dien_tich or 0) if hasattr(it, "dien_tich") else 0.0,
            "trong_luong": float(it.trong_luong or 0) if hasattr(it, "trong_luong") else 0.0,
            "don_gia": float(it.don_gia or 0) if hasattr(it, "don_gia") else 0.0,
            "thanh_tien": float(it.thanh_tien or 0) if hasattr(it, "thanh_tien") else 0.0,
            "ghi_chu": it.ghi_chu,
        } for it in do.items],
    }


# ── Phiếu chuyển kho ──────────────────────────────────────────────────────────

@router.get("/phieu-chuyen")
def list_phieu_chuyen(
    warehouse_xuat_id: Optional[int] = Query(None),
    warehouse_nhap_id: Optional[int] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(PhieuChuyenKho)
    if warehouse_xuat_id:
        q = q.filter(PhieuChuyenKho.warehouse_xuat_id == warehouse_xuat_id)
    if warehouse_nhap_id:
        q = q.filter(PhieuChuyenKho.warehouse_nhap_id == warehouse_nhap_id)
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

    if not db.get(Warehouse, body.warehouse_xuat_id) or not db.get(Warehouse, body.warehouse_nhap_id):
        raise HTTPException(404, "Không tìm thấy kho")

    for it in body.items:
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
        created_by=current_user.id,
    )
    db.add(phieu)
    db.flush()

    for it in body.items:
        ten_hang, don_vi = _resolve_nvl_name(db, it.paper_material_id, it.other_material_id, it.ten_hang)
        if not ten_hang:
            ten_hang = it.ten_hang
        don_vi = it.don_vi or don_vi

        db.add(PhieuChuyenKhoItem(
            phieu_chuyen_kho_id=phieu.id,
            paper_material_id=it.paper_material_id,
            other_material_id=it.other_material_id,
            ten_hang=ten_hang,
            don_vi=don_vi,
            so_luong=it.so_luong,
            don_gia=it.don_gia,
            ghi_chu=it.ghi_chu,
        ))

        bal_xuat = _get_or_create_balance(db, body.warehouse_xuat_id,
                                          it.paper_material_id, it.other_material_id,
                                          ten_hang=ten_hang, don_vi=don_vi)
        don_gia_xuat = bal_xuat.don_gia_binh_quan
        _xuat_balance(bal_xuat, it.so_luong, ten_hang)
        _log_tx(db, body.warehouse_xuat_id, "CHUYEN_KHO_XUAT",
                it.so_luong, don_gia_xuat, bal_xuat.ton_luong,
                "phieu_chuyen_kho", phieu.id, current_user.id,
                paper_material_id=it.paper_material_id,
                other_material_id=it.other_material_id,
                ghi_chu=it.ghi_chu)

        bal_nhap = _get_or_create_balance(db, body.warehouse_nhap_id,
                                          it.paper_material_id, it.other_material_id,
                                          ten_hang=ten_hang, don_vi=don_vi)
        _nhap_balance(bal_nhap, it.so_luong, don_gia_xuat)
        _log_tx(db, body.warehouse_nhap_id, "CHUYEN_KHO_NHAP",
                it.so_luong, don_gia_xuat, bal_nhap.ton_luong,
                "phieu_chuyen_kho", phieu.id, current_user.id,
                paper_material_id=it.paper_material_id,
                other_material_id=it.other_material_id,
                ghi_chu=it.ghi_chu)

    db.commit()
    db.refresh(phieu)
    return _ck_to_dict(phieu, db)


@router.delete("/phieu-chuyen/{phieu_id}")
def delete_phieu_chuyen(phieu_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    p = db.get(PhieuChuyenKho, phieu_id)
    if not p:
        raise HTTPException(404, "Không tìm thấy phiếu chuyển")
    if p.trang_thai != "nhap":
        raise HTTPException(400, "Chỉ được xoá phiếu ở trạng thái Nhập")

    for it in p.items:
        bal_xuat = _get_or_create_balance(db, p.warehouse_xuat_id,
                                          it.paper_material_id, it.other_material_id,
                                          ten_hang=it.ten_hang, don_vi=it.don_vi)
        bal_xuat.ton_luong += it.so_luong
        bal_xuat.gia_tri_ton = bal_xuat.ton_luong * bal_xuat.don_gia_binh_quan
        bal_xuat.cap_nhat_luc = datetime.utcnow()

        bal_nhap = _get_or_create_balance(db, p.warehouse_nhap_id,
                                          it.paper_material_id, it.other_material_id,
                                          ten_hang=it.ten_hang, don_vi=it.don_vi)
        bal_nhap.ton_luong = max(Decimal("0"), bal_nhap.ton_luong - it.so_luong)
        bal_nhap.gia_tri_ton = bal_nhap.ton_luong * bal_nhap.don_gia_binh_quan
        bal_nhap.cap_nhat_luc = datetime.utcnow()

    db.delete(p)
    db.commit()
    return {"ok": True}


def _ck_to_dict(p: PhieuChuyenKho, db: Session) -> dict:
    wh_x = db.get(Warehouse, p.warehouse_xuat_id)
    wh_n = db.get(Warehouse, p.warehouse_nhap_id)
    return {
        "id": p.id,
        "so_phieu": p.so_phieu,
        "warehouse_xuat_id": p.warehouse_xuat_id,
        "ten_kho_xuat": wh_x.ten_kho if wh_x else "",
        "warehouse_nhap_id": p.warehouse_nhap_id,
        "ten_kho_nhap": wh_n.ten_kho if wh_n else "",
        "ngay": str(p.ngay),
        "ghi_chu": p.ghi_chu,
        "trang_thai": p.trang_thai,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "items": [{
            "id": it.id,
            "paper_material_id": it.paper_material_id,
            "other_material_id": it.other_material_id,
            "ten_hang": it.ten_hang,
            "don_vi": it.don_vi,
            "so_luong": float(it.so_luong),
            "don_gia": float(it.don_gia),
            "ghi_chu": it.ghi_chu,
        } for it in p.items],
    }


# ── Lịch sử giao dịch ─────────────────────────────────────────────────────────

@router.get("/giao-dich")
def get_giao_dich(
    warehouse_id: Optional[int] = Query(None),
    paper_material_id: Optional[int] = Query(None),
    other_material_id: Optional[int] = Query(None),
    product_id: Optional[int] = Query(None),
    loai_giao_dich: Optional[str] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(InventoryTransaction)
    if warehouse_id:
        q = q.filter(InventoryTransaction.warehouse_id == warehouse_id)
    if paper_material_id:
        q = q.filter(InventoryTransaction.paper_material_id == paper_material_id)
    if other_material_id:
        q = q.filter(InventoryTransaction.other_material_id == other_material_id)
    if product_id:
        q = q.filter(InventoryTransaction.product_id == product_id)
    if loai_giao_dich:
        q = q.filter(InventoryTransaction.loai_giao_dich == loai_giao_dich)
    if tu_ngay:
        q = q.filter(InventoryTransaction.ngay_giao_dich >= tu_ngay)
    if den_ngay:
        q = q.filter(InventoryTransaction.ngay_giao_dich <= den_ngay)
    rows = q.order_by(InventoryTransaction.ngay_giao_dich.desc()).limit(limit).all()
    return [{
        "id": r.id,
        "ngay_giao_dich": r.ngay_giao_dich.isoformat() if r.ngay_giao_dich else None,
        "warehouse_id": r.warehouse_id,
        "paper_material_id": r.paper_material_id,
        "other_material_id": r.other_material_id,
        "product_id": r.product_id,
        "loai_giao_dich": r.loai_giao_dich,
        "so_luong": float(r.so_luong),
        "don_gia": float(r.don_gia),
        "gia_tri": float(r.gia_tri),
        "ton_sau_giao_dich": float(r.ton_sau_giao_dich),
        "chung_tu_loai": r.chung_tu_loai,
        "chung_tu_id": r.chung_tu_id,
        "ghi_chu": r.ghi_chu,
    } for r in rows]
