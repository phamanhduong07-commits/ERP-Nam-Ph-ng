import io
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, text as _text
from sqlalchemy.orm import Session, aliased, joinedload, selectinload
from app.database import get_db
from app.deps import get_current_user, require_permissions
from app.models.auth import User
from app.models.inventory import InventoryBalance, InventoryTransaction
from app.models.master import Warehouse, PaperMaterial, OtherMaterial, Product, PhanXuong, PhapNhan, Supplier, Customer, DonGiaVanChuyen
from app.models.purchase import PurchaseOrder, PurchaseOrderItem, PurchaseReturn
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.bom import ProductionBOM, ProductionBOMItem
from app.models.sales import SalesOrder, SalesOrderItem, SalesReturn, SalesReturnItem
from app.models.billing import SalesInvoice, InvoiceAdjustmentLog
from app.models.accounting import PurchaseInvoice, JournalEntry
from app.models.warehouse_doc import (
    GoodsReceipt, GoodsReceiptItem,
    GiayRoll,
    MaterialIssue, MaterialIssueItem,
    ProductionOutput,
    DeliveryOrder, DeliveryOrderItem,
    PhieuChuyenKho, PhieuChuyenKhoItem,
    StockAdjustment, StockAdjustmentItem,
)
from app.models.yeu_cau_giao_hang import YeuCauGiaoHang
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.cd2 import PhieuIn
from app.services.accounting_service import AccountingService
from app.services.carton_metrics import production_item_metrics
from app.services.excel_import_service import (
    ImportField, build_template_response, import_excel, parse_bool, parse_decimal, parse_text,
)
from app.utils.log import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/warehouse", tags=["warehouse"])


def _default_trip_rate(db: Session) -> Decimal:
    cfg = db.query(DonGiaVanChuyen).filter(
        DonGiaVanChuyen.trang_thai == True,
        DonGiaVanChuyen.don_gia_m2 > 0,
    ).order_by(DonGiaVanChuyen.id).first()
    return cfg.don_gia_m2 if cfg else Decimal("0")

PHAN_XUONG_IMPORT_FIELDS = [
    ImportField("ma_xuong", "Ma xuong", required=True, parser=parse_text, help_text="Ma phan xuong, duy nhat"),
    ImportField("ten_xuong", "Ten xuong", required=True, parser=parse_text),
    ImportField("dia_chi", "Dia chi", parser=parse_text),
    ImportField("cong_doan", "Cong doan", parser=parse_text, default="cd2", help_text="cd1_cd2 | cd2"),
    ImportField("trang_thai", "Trang thai", parser=parse_bool, default=True),
]


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
    so_luong: Optional[Decimal] = Decimal("0")
    dvt: str = "Kg"
    don_gia: Decimal = Decimal("0")
    dinh_luong_thuc_te: Optional[Decimal] = None
    do_am: Optional[Decimal] = None
    ket_qua_kiem_tra: str = "DAT"
    kho_mm: Optional[Decimal] = None
    so_cuon: Optional[int] = None
    ky_hieu_cuon: Optional[str] = None
    dai_mm: Optional[Decimal] = None    # chiều dài phôi tấm (mm)
    so_lop: Optional[int] = None        # số lớp: 3 | 5 | 7
    ghi_chu: Optional[str] = None


class GoodsReceiptIn(BaseModel):
    ngay_nhap: date
    po_id: Optional[int] = None
    supplier_id: int
    warehouse_id: Optional[int] = None
    phan_xuong_id: Optional[int] = None  # dùng để tự tìm kho khi warehouse_id không truyền
    loai_kho_auto: str = "GIAY_CUON"     # loai_kho ưu tiên khi auto-resolve
    loai_nhap: str = "MUA_HANG"
    phap_nhan_id: Optional[int] = None
    bo_qua_hach_toan: bool = False
    ghi_chu: Optional[str] = None
    so_xe: Optional[str] = None
    invoice_image: Optional[str] = None
    hd_tong_kg: Optional[Decimal] = None
    items: list[GoodsReceiptItemIn]


class QuickCaptureIn(BaseModel):
    ngay_nhap: date
    supplier_id: Optional[int] = None
    phap_nhan_id: int                  # bảo vệ chọn nhà máy (Hoàng Gia / Nam Thuận / Củ Chi)
    loai_kho_auto: str = "GIAY_CUON"  # GIAY_CUON | NVL_PHU | PHOI
    so_xe: Optional[str] = None
    invoice_image: Optional[str] = None
    hd_tong_kg: Optional[Decimal] = None


class GoodsReceiptCompleteIn(BaseModel):
    warehouse_id: Optional[int] = None   # override nếu cần, mặc định giữ kho đã gán
    ghi_chu: Optional[str] = None
    hd_tong_kg: Optional[Decimal] = None
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
    the_tich: Optional[Decimal] = None
    don_gia: Optional[Decimal] = None
    ghi_chu: Optional[str] = None


class DeliveryOrderIn(BaseModel):
    ngay_xuat: date
    sales_order_id: Optional[int] = None
    customer_id: Optional[int] = None
    yeu_cau_id: Optional[int] = None
    warehouse_id: Optional[int] = None
    phap_nhan_id: Optional[int] = None
    dia_chi_giao: Optional[str] = None
    nguoi_nhan: Optional[str] = None
    xe_van_chuyen: Optional[str] = None
    xe_id: Optional[int] = None
    tai_xe_id: Optional[int] = None
    lo_xe: Optional[str] = None
    lo_xe_id: Optional[int] = None
    lo_xe_id_2: Optional[int] = None
    lo_xe_2: Optional[str] = None
    so_seal: Optional[str] = None
    gui_kem_theo: Optional[str] = None
    don_gia_vc_id: Optional[int] = None
    tien_van_chuyen: Optional[Decimal] = None
    co_hang_ve: bool = False
    ghi_chu: Optional[str] = None
    items: list[DeliveryOrderItemIn]


class PhieuChuyenItemIn(BaseModel):
    paper_material_id: Optional[int] = None
    other_material_id: Optional[int] = None
    production_order_id: Optional[int] = None
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


class StockAdjustmentItemIn(BaseModel):
    inventory_balance_id: int
    so_luong_thuc_te: Decimal
    ghi_chu: Optional[str] = None


class StockAdjustmentIn(BaseModel):
    warehouse_id: int
    ngay: date
    ly_do: Optional[str] = None
    ghi_chu: Optional[str] = None
    items: list[StockAdjustmentItemIn]


class UpdateDeliveryStatusIn(BaseModel):
    trang_thai: str  # nhap | da_xuat | da_giao | huy


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


def _tk_nvl(paper_material_id: Optional[int]) -> str:
    """VAS: giấy cuộn (NVL chính) → TK 1521; NVL khác/CCDC → TK 1522."""
    return "1521" if paper_material_id else "1522"


def _tk_inventory(
    paper_material_id: Optional[int] = None,
    other_material_id: Optional[int] = None,
    product_id: Optional[int] = None,
    loai_kho: Optional[str] = None,
) -> str:
    if product_id or loai_kho in {"THANH_PHAM", "PHOI"}:
        return "155"
    if paper_material_id:
        return "1521"
    if other_material_id:
        return "1522"
    return "152"


def _warehouse_dimensions(db: Session, warehouse_id: Optional[int]) -> tuple[Optional[Warehouse], Optional[int], Optional[int], str]:
    wh = db.get(Warehouse, warehouse_id) if warehouse_id else None
    px = wh.phan_xuong_obj if wh and wh.phan_xuong_obj else None
    pn = px.phap_nhan if px and px.phap_nhan else None
    return wh, (px.id if px else None), (pn.id if pn else None), (pn.ten_viet_tat or pn.ten_phap_nhan if pn else "")


def _ensure_active_warehouse(db: Session, warehouse_id: Optional[int], allowed_types: Optional[set[str]] = None) -> Warehouse:
    wh = db.get(Warehouse, warehouse_id) if warehouse_id else None
    if not wh:
        raise HTTPException(404, "Khong tim thay kho")
    if not wh.trang_thai:
        raise HTTPException(400, "Kho da ngung hoat dong")
    if allowed_types and wh.loai_kho not in allowed_types:
        raise HTTPException(400, f"Kho '{wh.ten_kho}' khong dung loai nghiep vu")
    return wh


def _recalc_purchase_order_receipt_status(db: Session, po_id: Optional[int]) -> None:
    if not po_id:
        return

    po = (
        db.query(PurchaseOrder)
        .options(joinedload(PurchaseOrder.items))
        .filter(PurchaseOrder.id == po_id)
        .first()
    )
    if not po or not po.items or po.trang_thai == "huy":
        return

    any_received = False
    all_received = True
    for item in po.items:
        # Giấy cuộn: theo dõi hoàn thành bằng số cuộn
        if item.so_cuon and item.so_cuon > 0:
            ordered_qty = item.so_cuon
            received_qty = item.so_cuon_da_nhan or 0
        else:
            ordered_qty = item.so_luong or Decimal("0")
            received_qty = item.so_luong_da_nhan or Decimal("0")
        if received_qty > 0:
            any_received = True
        if ordered_qty <= 0 or received_qty < ordered_qty:
            all_received = False

    if all_received:
        po.trang_thai = "hoan_thanh"
    elif any_received:
        po.trang_thai = "dang_giao"
    elif po.trang_thai in ("dang_giao", "hoan_thanh"):
        po.trang_thai = "da_duyet"


def _recalc_sales_order_delivery_status(db: Session, sales_order_id: Optional[int]) -> None:
    if not sales_order_id:
        return

    order = (
        db.query(SalesOrder)
        .options(joinedload(SalesOrder.items))
        .filter(SalesOrder.id == sales_order_id)
        .first()
    )
    if not order or not order.items:
        return

    any_shipped = False
    all_shipped = True
    for item in order.items:
        ordered_qty = item.so_luong or Decimal("0")
        shipped_qty = item.so_luong_da_xuat or Decimal("0")
        if shipped_qty > 0:
            any_shipped = True
        if ordered_qty <= 0 or shipped_qty < ordered_qty:
            all_shipped = False

        if shipped_qty <= 0:
            if item.trang_thai_dong in ("dang_xuat", "da_xuat"):
                item.trang_thai_dong = "dang_sx"
        elif ordered_qty > 0 and shipped_qty >= ordered_qty:
            item.trang_thai_dong = "da_xuat"
        else:
            item.trang_thai_dong = "dang_xuat"

    if order.trang_thai == "huy":
        return
    if all_shipped:
        order.trang_thai = "hoan_thanh"
    elif any_shipped:
        order.trang_thai = "da_xuat"
    elif order.trang_thai in ("da_xuat", "hoan_thanh"):
        order.trang_thai = "dang_sx"


def _px_to_dict(r: PhanXuong) -> dict:
    return {
        "id": r.id, "ma_xuong": r.ma_xuong, "ten_xuong": r.ten_xuong,
        "dia_chi": r.dia_chi, "cong_doan": r.cong_doan,
        "phoi_tu_phan_xuong_id": r.phoi_tu_phan_xuong_id,
        "ten_phoi_tu_phan_xuong": r.phoi_tu_phan_xuong.ten_xuong if r.phoi_tu_phan_xuong else None,
        "phap_nhan_id": r.phap_nhan_id,
        "trang_thai": r.trang_thai,
    }


# ── Phân xưởng ────────────────────────────────────────────────────────────────

@router.get("/phan-xuong/import-template")
def download_phan_xuong_import_template(_: User = Depends(get_current_user)):
    return build_template_response("mau_import_phan_xuong.xlsx", PHAN_XUONG_IMPORT_FIELDS)


@router.post("/phan-xuong/import")
async def import_phan_xuong(
    commit: bool = Query(default=False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("master.import")),
):
    return await import_excel(
        db=db, 
        file=file, 
        model=PhanXuong, 
        fields=PHAN_XUONG_IMPORT_FIELDS, 
        key_field="ma_xuong", 
        commit=commit,
        user=current_user,
        loai_du_lieu="phan_xuong"
    )


@router.get("/phan-xuong")
def list_phan_xuong(
    co_kho: bool = Query(False),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(PhanXuong).filter(PhanXuong.trang_thai.is_(True))
    if co_kho:
        q = q.join(Warehouse, Warehouse.phan_xuong_id == PhanXuong.id).distinct()
    return [_px_to_dict(r) for r in q.order_by(PhanXuong.id).all()]


@router.post("/phan-xuong", status_code=201)
def create_phan_xuong(body: PhanXuongCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if db.query(PhanXuong).filter(PhanXuong.ma_xuong == body.ma_xuong).first():
        raise HTTPException(400, f"Mã xưởng '{body.ma_xuong}' đã tồn tại")
    obj = PhanXuong(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    logger.info("created phan_xuong id=%s ma_xuong=%s", obj.id, obj.ma_xuong)
    return _px_to_dict(obj)


@router.put("/phan-xuong/{px_id}")
def update_phan_xuong(px_id: int, body: PhanXuongCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    obj = db.get(PhanXuong, px_id)
    if not obj:
        logger.warning("phan_xuong id=%s not found", px_id)
        raise HTTPException(404, "Không tìm thấy phân xưởng")
    for k, v in body.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    logger.info("updated phan_xuong id=%s", px_id)
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
            "phap_nhan_id": px.phap_nhan_id,
            "warehouses": slots,
        })

    return result


# ── Tồn kho ───────────────────────────────────────────────────────────────────

@router.get("/ton-kho")
def get_ton_kho(
    warehouse_id: Optional[int] = Query(None),
    phan_xuong_id: Optional[int] = Query(None),
    phap_nhan_id: Optional[int] = Query(None),
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
    if phap_nhan_id:
        q = q.join(PhanXuong, Warehouse.phan_xuong_id == PhanXuong.id).filter(PhanXuong.phap_nhan_id == phap_nhan_id)
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

        wh, wh_px_id, wh_pn_id, ten_phap_nhan = _warehouse_dimensions(db, r.warehouse_id)
        result.append({
            "id": r.id,
            "warehouse_id": r.warehouse_id,
            "ten_kho": wh.ten_kho if wh else "",
            "loai_kho": wh.loai_kho if wh else None,
            "phan_xuong_id": wh_px_id,
            "ten_phan_xuong": wh.phan_xuong_obj.ten_xuong if wh and wh.phan_xuong_obj else None,
            "phap_nhan_id": wh_pn_id,
            "ten_phap_nhan": ten_phap_nhan or None,
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


_TON_KHO_FIELDS = [
    ImportField("ma_kho",    "Ma kho",    required=True,  parser=parse_text,    help_text="Ma kho phai ton tai trong he thong"),
    ImportField("loai_hang", "Loai hang", required=True,  parser=parse_text,    help_text="giay | nvl | tp"),
    ImportField("ma_hang",   "Ma hang",   required=True,  parser=parse_text,    help_text="Ma chinh vat tu giay/NVL hoac Ma AMIS san pham"),
    ImportField("so_luong",  "So luong",  required=True,  parser=parse_decimal, help_text="Ton luong dau ky"),
    ImportField("don_gia",   "Don gia",   parser=parse_decimal, default=0,       help_text="Don gia binh quan (de trong neu chua co)"),
    ImportField("don_vi",    "Don vi",    parser=parse_text,                     help_text="Don vi tinh (de trong se lay tu danh muc)"),
]


@router.get("/ton-kho/import-template")
def download_ton_kho_import_template(_: User = Depends(get_current_user)):
    return build_template_response("mau_import_ton_kho_dau_ky.xlsx", _TON_KHO_FIELDS)


@router.post("/ton-kho/import")
async def import_ton_kho_dau_ky(
    commit: bool = Query(default=False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("inventory.import")),
):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Chi chap nhan file Excel .xlsx/.xls")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "File rong")
    df = pd.read_excel(io.BytesIO(raw), dtype=object)
    rows, errors_count = [], 0
    objects_to_save = []

    for idx, src in df.iterrows():
        row_no = int(idx) + 2
        errs = []
        ma_kho    = str(src.get("Ma kho",    "") or "").strip()
        loai_hang = str(src.get("Loai hang", "") or "").strip().lower()
        ma_hang   = str(src.get("Ma hang",   "") or "").strip()
        so_luong_raw = src.get("So luong")
        don_gia_raw  = src.get("Don gia")
        don_vi_raw   = str(src.get("Don vi",   "") or "").strip() or None

        if not ma_kho:
            errs.append("Ma kho: bat buoc")
        if loai_hang not in ("giay", "nvl", "tp"):
            errs.append("Loai hang: phai la 'giay', 'nvl', hoac 'tp'")
        if not ma_hang:
            errs.append("Ma hang: bat buoc")

        try:
            so_luong = Decimal(str(so_luong_raw).replace(",", "")) if so_luong_raw is not None else None
        except Exception:
            so_luong = None
        if so_luong is None:
            errs.append("So luong: bat buoc va phai la so")

        try:
            don_gia = Decimal(str(don_gia_raw).replace(",", "")) if don_gia_raw not in (None, "", "nan") else Decimal("0")
        except Exception:
            don_gia = Decimal("0")

        wh = db.query(Warehouse).filter(Warehouse.ma_kho == ma_kho).first() if ma_kho else None
        if ma_kho and not wh:
            errs.append(f"Ma kho: khong ton tai '{ma_kho}'")

        paper_material_id = other_material_id = product_id = None
        resolved_don_vi = don_vi_raw

        if not errs and wh and ma_hang:
            if loai_hang == "giay":
                mat = db.query(PaperMaterial).filter(PaperMaterial.ma_chinh == ma_hang).first()
                if not mat:
                    errs.append(f"Ma hang: khong tim thay vat tu giay '{ma_hang}'")
                else:
                    paper_material_id = mat.id
                    if not resolved_don_vi:
                        resolved_don_vi = mat.dvt
            elif loai_hang == "nvl":
                mat = db.query(OtherMaterial).filter(OtherMaterial.ma_chinh == ma_hang).first()
                if not mat:
                    errs.append(f"Ma hang: khong tim thay NVL '{ma_hang}'")
                else:
                    other_material_id = mat.id
                    if not resolved_don_vi:
                        resolved_don_vi = mat.dvt
            elif loai_hang == "tp":
                prod = db.query(Product).filter(
                    (Product.ma_amis == ma_hang) | (Product.ma_hang == ma_hang)
                ).first()
                if not prod:
                    errs.append(f"Ma hang: khong tim thay san pham '{ma_hang}'")
                else:
                    product_id = prod.id
                    if not resolved_don_vi:
                        resolved_don_vi = getattr(prod, "dvt", "Thung") or "Thung"

        if errs:
            errors_count += 1
            rows.append({"row": row_no, "status": "error", "errors": errs, "data": {}})
            continue

        gia_tri = (so_luong or Decimal("0")) * (don_gia or Decimal("0"))
        bal_filter = db.query(InventoryBalance).filter(InventoryBalance.warehouse_id == wh.id)
        if loai_hang == "giay":
            bal_filter = bal_filter.filter(InventoryBalance.paper_material_id == paper_material_id)
        elif loai_hang == "nvl":
            bal_filter = bal_filter.filter(InventoryBalance.other_material_id == other_material_id)
        else:
            bal_filter = bal_filter.filter(InventoryBalance.product_id == product_id)
        existing = bal_filter.first()

        status = "update" if existing else "create"
        vals = {
            "warehouse_id": wh.id,
            "paper_material_id": paper_material_id,
            "other_material_id": other_material_id,
            "product_id": product_id,
            "ton_luong": so_luong,
            "don_gia_binh_quan": don_gia,
            "gia_tri_ton": gia_tri,
            "don_vi": resolved_don_vi,
            "cap_nhat_luc": datetime.now(timezone.utc),
        }
        objects_to_save.append((existing, vals))
        rows.append({"row": row_no, "status": status, "errors": [], "data": {"ma_kho": ma_kho, "ma_hang": ma_hang, "so_luong": str(so_luong)}})

    if commit and errors_count == 0:
        # Ghi log
        from app.models.import_log import ImportLog
        log = ImportLog(
            user_id=current_user.id,
            ten_nguoi_import=current_user.full_name or current_user.username,
            loai_du_lieu="inventory",
            ten_file=file.filename,
            so_dong_thanh_cong=len(objects_to_save),
            so_dong_loi=errors_count,
            trang_thai='success' if errors_count == 0 else 'partial',
        )
        db.add(log)
        
        for existing, vals in objects_to_save:
            if existing:
                for k, v in vals.items():
                    setattr(existing, k, v)
            else:
                db.add(InventoryBalance(**vals))
        db.commit()

    updated = sum(1 for s in rows if s["status"] == "update")
    created = sum(1 for s in rows if s["status"] == "create")
    return {"commit": commit, "total": len(rows), "created": created, "updated": updated, "skipped": 0, "errors": errors_count, "rows": rows[:200]}


# ── Phiếu nhập kho (GoodsReceipt) ────────────────────────────────────────────

@router.get("/goods-receipts")
def list_goods_receipts(
    warehouse_id: Optional[int] = Query(None),
    supplier_id: Optional[int] = Query(None),
    po_id: Optional[int] = Query(None),
    trang_thai: Optional[str] = Query(None),
    phan_xuong_id: Optional[int] = Query(None),
    phap_nhan_id: Optional[int] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    loai_hang: Optional[str] = Query(None),  # 'giay' | 'nvl'
    search: Optional[str] = Query(None),
    limit: int = Query(500, ge=1, le=2000),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(GoodsReceipt)
    if search:
        like = f"%{search}%"
        q = (q
             .outerjoin(GoodsReceipt.supplier)
             .filter(or_(
                 GoodsReceipt.so_phieu.ilike(like),
                 Supplier.ten_viet_tat.ilike(like),
                 Supplier.ten_don_vi.ilike(like),
             ))
             .distinct())
    if warehouse_id:
        q = q.filter(GoodsReceipt.warehouse_id == warehouse_id)
    if supplier_id:
        q = q.filter(GoodsReceipt.supplier_id == supplier_id)
    if po_id:
        q = q.filter(GoodsReceipt.po_id == po_id)
    if trang_thai:
        q = q.filter(GoodsReceipt.trang_thai == trang_thai)
    if phan_xuong_id or phap_nhan_id:
        q = q.outerjoin(Warehouse, GoodsReceipt.warehouse_id == Warehouse.id)
    if phan_xuong_id:
        q = q.filter(Warehouse.phan_xuong_id == phan_xuong_id)
    if phap_nhan_id:
        q = q.outerjoin(PhanXuong, Warehouse.phan_xuong_id == PhanXuong.id)
        q = q.filter(or_(GoodsReceipt.phap_nhan_id == phap_nhan_id, PhanXuong.phap_nhan_id == phap_nhan_id))
    if tu_ngay:
        q = q.filter(GoodsReceipt.ngay_nhap >= tu_ngay)
    if den_ngay:
        q = q.filter(GoodsReceipt.ngay_nhap <= den_ngay)
    if loai_hang == 'giay':
        giay_cuon_wh_ids = db.query(Warehouse.id).filter(Warehouse.loai_kho == 'GIAY_CUON').subquery()
        q = q.filter(
            or_(
                GoodsReceipt.items.any(GoodsReceiptItem.paper_material_id.isnot(None)),
                and_(
                    GoodsReceipt.trang_thai == 'nhap_nhanh',
                    GoodsReceipt.warehouse_id.in_(giay_cuon_wh_ids),
                ),
            )
        )
    elif loai_hang == 'nvl':
        giay_cuon_wh_ids = db.query(Warehouse.id).filter(Warehouse.loai_kho == 'GIAY_CUON').subquery()
        q = q.filter(GoodsReceipt.loai_nhap != 'PHOI_NGOAI')
        q = q.filter(~GoodsReceipt.items.any(GoodsReceiptItem.paper_material_id.isnot(None)))
        # Exclude nhap_nhanh GIAY_CUON GRs — they belong in NhapGiayPage, not ReceiptsPage
        q = q.filter(
            ~and_(
                GoodsReceipt.trang_thai == 'nhap_nhanh',
                GoodsReceipt.warehouse_id.in_(giay_cuon_wh_ids),
            )
        )
    elif loai_hang == 'phoi':
        q = q.filter(GoodsReceipt.loai_nhap == 'PHOI_NGOAI')
    rows = (
        q.options(
            joinedload(GoodsReceipt.supplier),
            joinedload(GoodsReceipt.warehouse),
            joinedload(GoodsReceipt.phan_xuong),
            joinedload(GoodsReceipt.phap_nhan),
            selectinload(GoodsReceipt.items),
        )
        .order_by(GoodsReceipt.created_at.desc())
        .limit(limit)
        .all()
    )
    # Pre-aggregate co_hoa_don per GR — avoid N+1 query in _gr_to_dict
    gr_ids = [r.id for r in rows]
    co_hoa_don_set: set[int] = set()
    if gr_ids:
        hd_rows = (
            db.query(PurchaseInvoice.gr_id)
            .filter(
                PurchaseInvoice.gr_id.in_(gr_ids),
                PurchaseInvoice.trang_thai != "huy",
            )
            .distinct()
            .all()
        )
        co_hoa_don_set = {row[0] for row in hd_rows}
    return [_gr_to_dict(r, db, include_image=False, co_hoa_don_override=r.id in co_hoa_don_set) for r in rows]


@router.get("/goods-receipts/pending-count")
def pending_nhap_nhanh_count(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Đếm phiếu nhap_nhanh chờ hoàn thiện — gọi từ sidebar badge."""
    rows = (
        db.query(GoodsReceipt.loai_nhap, Warehouse.loai_kho, func.count().label("n"))
        .outerjoin(Warehouse, GoodsReceipt.warehouse_id == Warehouse.id)
        .filter(GoodsReceipt.trang_thai == "nhap_nhanh")
        .group_by(GoodsReceipt.loai_nhap, Warehouse.loai_kho)
        .all()
    )
    giay = sum(r.n for r in rows if r.loai_kho == "GIAY_CUON")
    nvl  = sum(r.n for r in rows if r.loai_kho == "NVL_PHU")
    phoi = sum(r.n for r in rows if r.loai_nhap == "PHOI_NGOAI")
    return {"giay": giay, "nvl": nvl, "phoi": phoi, "total": giay + nvl + phoi}


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

    # Validate: giấy cuộn cần so_cuon > 0; NVL cần so_luong > 0
    for it in body.items:
        it.so_luong = it.so_luong or Decimal("0")
        is_paper_roll = bool(it.paper_material_id and it.so_cuon and it.so_cuon > 0)
        if is_paper_roll:
            if it.so_cuon <= 0:
                raise HTTPException(400, "Giấy cuộn phải nhập số cuộn > 0")
        else:
            if it.so_luong <= 0:
                raise HTTPException(400, "Số lượng nhập phải > 0")

    # Resolve warehouse: ưu tiên warehouse_id tường minh, fallback auto-find từ xưởng
    wh_id = body.warehouse_id
    if not wh_id and body.phan_xuong_id:
        wh = _get_workshop_warehouse(db, body.phan_xuong_id, body.loai_kho_auto)
        if wh is None:
            wh = _get_workshop_warehouse(db, body.phan_xuong_id, "NVL_PHU")
        if wh:
            wh_id = wh.id
    if not wh_id:
        raise HTTPException(400, "Chọn kho nhập hoặc cung cấp phan_xuong_id để tự tìm kho")
    wh_obj = _ensure_active_warehouse(
        db,
        wh_id,
        {"PHOI"} if body.loai_nhap == "PHOI_NGOAI" else None,
    )
    if not wh_obj:
        raise HTTPException(404, "Không tìm thấy kho")
    if not db.get(Supplier, body.supplier_id):
        raise HTTPException(404, "Không tìm thấy nhà cung cấp")

    # Derive phap_nhan_id from warehouse → phan_xuong if not explicitly provided
    _phap_nhan_id = getattr(body, 'phap_nhan_id', None)
    if not _phap_nhan_id and wh_obj and wh_obj.phan_xuong_obj:
        _phap_nhan_id = wh_obj.phan_xuong_obj.phap_nhan_id
    _phan_xuong_id = body.phan_xuong_id or wh_obj.phan_xuong_id

    for it in body.items:
        if not it.po_item_id:
            continue
        poi = db.get(PurchaseOrderItem, it.po_item_id)
        if not poi:
            raise HTTPException(404, "Khong tim thay dong PO")
        if body.po_id and poi.po_id != body.po_id:
            raise HTTPException(400, "Dong PO khong thuoc PO cua phieu nhap")
        po_ref = db.get(PurchaseOrder, poi.po_id)
        if po_ref and po_ref.supplier_id != body.supplier_id:
            raise HTTPException(400, "Nha cung cap phieu nhap khong khop PO")
        # Giấy cuộn: validate theo số cuộn (kg thực không biết trước)
        # NVL khác: validate theo kg như cũ
        if poi.so_cuon and poi.so_cuon > 0:
            item_so_cuon = it.so_cuon or 0
            remaining_cuon = (poi.so_cuon or 0) - (poi.so_cuon_da_nhan or 0)
            if remaining_cuon <= 0:
                raise HTTPException(400, "Da nhan du so cuon theo PO")
            if item_so_cuon > remaining_cuon:
                raise HTTPException(
                    400,
                    f"So cuon nhap vuot PO: can nhap {item_so_cuon} cuon, con {remaining_cuon} cuon",
                )
        else:
            remaining_qty = (poi.so_luong or Decimal("0")) - (poi.so_luong_da_nhan or Decimal("0"))
            if it.so_luong > remaining_qty:
                raise HTTPException(
                    400,
                    f"So luong nhap vuot PO: can nhap {float(it.so_luong):g}, con {float(remaining_qty):g}",
                )

    gr = GoodsReceipt(
        so_phieu=_gen_so(db, "GR", GoodsReceipt),
        ngay_nhap=body.ngay_nhap,
        po_id=body.po_id,
        supplier_id=body.supplier_id,
        warehouse_id=wh_id,
        phan_xuong_id=_phan_xuong_id,
        loai_nhap=body.loai_nhap,
        phap_nhan_id=_phap_nhan_id,
        bo_qua_hach_toan=body.bo_qua_hach_toan,
        so_xe=getattr(body, 'so_xe', None),
        invoice_image=getattr(body, 'invoice_image', None),
        hd_tong_kg=getattr(body, 'hd_tong_kg', None),
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
            kho_mm=it.kho_mm,
            so_cuon=it.so_cuon,
            ky_hieu_cuon=it.ky_hieu_cuon,
            dai_mm=it.dai_mm,
            so_lop=it.so_lop,
            ghi_chu=it.ghi_chu,
        ))

    gr.tong_gia_tri = tong

    # Tồn kho và PO tracking chỉ cập nhật khi duyệt (approve), không tại bước tạo draft
    db.commit()
    db.refresh(gr)
    logger.info("created goods_receipt id=%s so_phieu=%s by user=%s", gr.id, gr.so_phieu, current_user.id)
    return _gr_to_dict(gr, db)


@router.post("/goods-receipts/quick", status_code=201)
def quick_capture_goods_receipt(
    body: QuickCaptureIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bước 1: gate guard chụp ảnh phiếu NCC → tạo draft nhap_nhanh. supplier_id optional."""
    if body.supplier_id and not db.get(Supplier, body.supplier_id):
        raise HTTPException(404, "Không tìm thấy nhà cung cấp")
    loai_kho = body.loai_kho_auto  # GIAY_CUON | NVL_PHU | PHOI
    # Tìm kho theo pháp nhân (nhà máy) + loại kho
    wh = (
        db.query(Warehouse)
        .join(PhanXuong, Warehouse.phan_xuong_id == PhanXuong.id)
        .filter(
            PhanXuong.phap_nhan_id == body.phap_nhan_id,
            Warehouse.loai_kho == loai_kho,
            Warehouse.trang_thai == True,
        )
        .first()
    )
    if not wh:
        raise HTTPException(400, f"Nhà máy này chưa có kho {loai_kho} — liên hệ admin")
    loai_nhap = "PHOI_NGOAI" if loai_kho == "PHOI" else "MUA_HANG"
    gr = GoodsReceipt(
        so_phieu=_gen_so(db, "GR", GoodsReceipt),
        ngay_nhap=body.ngay_nhap,
        supplier_id=body.supplier_id,
        warehouse_id=wh.id,
        phan_xuong_id=wh.phan_xuong_id,
        loai_nhap=loai_nhap,
        phap_nhan_id=body.phap_nhan_id,
        trang_thai="nhap_nhanh",
        so_xe=body.so_xe,
        invoice_image=body.invoice_image,
        hd_tong_kg=body.hd_tong_kg,
        tong_gia_tri=Decimal("0"),
        created_by=current_user.id,
    )
    db.add(gr)
    db.commit()
    db.refresh(gr)
    return _gr_to_dict(gr, db)


@router.post("/goods-receipts/{gr_id}/extract-image")
def extract_image_ocr(
    gr_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Đọc ảnh phiếu xuất NCC bằng Gemini Vision (few-shot nếu có ảnh mẫu NCC)."""
    import json
    from pathlib import Path
    from sqlalchemy import text as _sql
    from app.utils.ocr import extract_delivery_slip, identify_supplier
    from app.routers.ocr_examples import get_examples_for_supplier

    gr = db.get(GoodsReceipt, gr_id)
    if not gr:
        raise HTTPException(404, "Không tìm thấy phiếu")

    media_row = db.execute(
        _sql("SELECT filepath FROM erp_media WHERE module='goods_receipts' AND record_id=:rid ORDER BY id DESC LIMIT 1"),
        {"rid": str(gr_id)},
    ).fetchone()
    if not media_row:
        raise HTTPException(404, "Phiếu này chưa có ảnh — bảo vệ cần upload ảnh trước")

    upload_base = Path(__file__).parent.parent.parent / "uploads"
    img_path = upload_base / media_row.filepath
    if not img_path.is_file():
        raise HTTPException(404, f"File ảnh không tìm thấy trên server: {media_row.filepath}")

    try:
        # Bước 1: Nhận diện NCC (nhanh) — chỉ chạy nếu DB có ảnh mẫu
        from app.models.warehouse_doc import OcrSupplierExample
        has_examples = db.query(OcrSupplierExample.id).limit(1).scalar() is not None
        few_shot = []
        detected_supplier = None
        if has_examples:
            detected_supplier = identify_supplier(str(img_path))
            if detected_supplier:
                few_shot = get_examples_for_supplier(detected_supplier, db, limit=3)

        # Bước 2: OCR chính — few-shot nếu có mẫu, zero-shot nếu chưa
        result = extract_delivery_slip(str(img_path), few_shot_examples=few_shot or None)
        if detected_supplier:
            result["detected_supplier"] = detected_supplier

    except RuntimeError as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        logger.error("OCR lỗi không mong muốn: %s", e, exc_info=True)
        raise HTTPException(500, f"Lỗi OCR: {type(e).__name__}")

    gr.ocr_extracted_data = json.dumps(result.get("extracted", {}), ensure_ascii=False)
    db.commit()

    return result


@router.post("/goods-receipts/{gr_id}/complete")
def complete_goods_receipt(
    gr_id: int,
    body: GoodsReceiptCompleteIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Bước 2: data entry hoàn thiện phiếu nháp — thêm hàng hoá, cập nhật tồn kho."""
    gr = db.get(GoodsReceipt, gr_id)
    if not gr:
        raise HTTPException(404, "Không tìm thấy phiếu")
    if gr.trang_thai != "nhap_nhanh":
        raise HTTPException(400, "Chỉ hoàn thiện được phiếu ở trạng thái 'Chờ nhập'")
    if not body.items:
        raise HTTPException(400, "Phải có ít nhất 1 dòng hàng")

    wh_id = body.warehouse_id or gr.warehouse_id
    wh = db.get(Warehouse, wh_id)
    if not wh:
        raise HTTPException(404, "Không tìm thấy kho")

    if body.ghi_chu is not None:
        gr.ghi_chu = body.ghi_chu
    if body.hd_tong_kg is not None:
        gr.hd_tong_kg = body.hd_tong_kg
    gr.warehouse_id = wh_id
    gr.phan_xuong_id = wh.phan_xuong_id
    if not gr.phap_nhan_id and wh.phan_xuong_obj:
        gr.phap_nhan_id = wh.phan_xuong_obj.phap_nhan_id

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
            ket_qua_kiem_tra=it.ket_qua_kiem_tra,
            kho_mm=it.kho_mm,
            so_cuon=it.so_cuon,
            ky_hieu_cuon=it.ky_hieu_cuon,
            dai_mm=it.dai_mm,
            so_lop=it.so_lop,
            ghi_chu=it.ghi_chu,
        ))

    gr.tong_gia_tri = tong
    gr.trang_thai = "nhap"

    db.commit()
    db.refresh(gr)
    return _gr_to_dict(gr, db)


@router.get("/goods-receipts/{gr_id}/matching-status")
def gr_matching_status(
    gr_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """3-way matching: so sánh PO ↔ GR ↔ Hóa đơn mua.
    Trả về danh sách dòng hàng kèm trạng thái khớp giá/số lượng."""
    gr = db.get(GoodsReceipt, gr_id)
    if not gr:
        raise HTTPException(404, "Không tìm thấy phiếu nhập")

    po = db.get(PurchaseOrder, gr.po_id) if gr.po_id else None
    invoice = db.query(PurchaseInvoice).filter(
        PurchaseInvoice.gr_id == gr_id,
        PurchaseInvoice.trang_thai != "huy",
    ).first()

    # Thống kê nhanh
    gia_tri_gr = float(gr.tong_gia_tri or 0)
    gia_tri_po = float(po.tong_tien or 0) if po else None
    gia_tri_hd = float(invoice.tong_tien_hang or 0) if invoice else None

    lenh_gia = None
    if gia_tri_po and gia_tri_gr:
        lenh_gia = round(abs(gia_tri_gr - gia_tri_po) / max(gia_tri_po, 0.01) * 100, 2)
    lenh_hd = None
    if gia_tri_hd and gia_tri_gr:
        lenh_hd = round(abs(gia_tri_gr - gia_tri_hd) / max(gia_tri_gr, 0.01) * 100, 2)

    # So sánh từng dòng GR vs PO
    po_items_map: dict[int, object] = {}
    if po:
        for pi in (po.items or []):
            po_items_map[pi.id] = pi

    lines = []
    for it in (gr.items or []):
        po_item = po_items_map.get(it.po_item_id) if it.po_item_id else None
        line: dict = {
            "ten_hang": it.ten_hang,
            "gr_so_luong": float(it.so_luong or 0),
            "gr_don_gia": float(it.don_gia or 0),
            "gr_thanh_tien": float(it.thanh_tien or 0),
            "po_so_luong": float(po_item.so_luong) if po_item else None,
            "po_don_gia": float(po_item.don_gia) if po_item else None,
        }
        # Cờ khớp
        if po_item:
            lenh_don_gia = abs(line["gr_don_gia"] - line["po_don_gia"]) / max(line["po_don_gia"], 0.01) * 100
            line["don_gia_ok"] = lenh_don_gia <= 1.0   # sai biệt ≤ 1%
            line["so_luong_ok"] = line["gr_so_luong"] <= float(po_item.so_luong)
        else:
            line["don_gia_ok"] = None
            line["so_luong_ok"] = None
        lines.append(line)

    return {
        "gr_id": gr_id,
        "so_phieu_gr": gr.so_phieu,
        "so_po": po.so_po if po else None,
        "so_hoa_don": invoice.so_hoa_don if invoice else None,
        "gia_tri_gr": gia_tri_gr,
        "gia_tri_po": gia_tri_po,
        "gia_tri_hd": gia_tri_hd,
        "lenh_gia_po_pct": lenh_gia,
        "lenh_hd_pct": lenh_hd,
        "co_invoice": invoice is not None,
        "lines": lines,
    }


def _gen_so_bt_gr(db: Session) -> str:
    prefix = f"BT{datetime.today().strftime('%Y%m')}"
    last = db.query(func.max(JournalEntry.so_but_toan)).filter(
        JournalEntry.so_but_toan.like(f"{prefix}%")
    ).scalar()
    seq = int(last[-4:]) + 1 if last else 1
    return f"{prefix}-{seq:04d}"


@router.patch("/goods-receipts/{gr_id}/approve")
def approve_goods_receipt(gr_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    gr = db.get(GoodsReceipt, gr_id)
    if not gr:
        logger.warning("goods_receipt id=%s not found", gr_id)
        raise HTTPException(404, "Không tìm thấy phiếu nhập")
    if gr.trang_thai == "da_duyet":
        raise HTTPException(400, "Phiếu đã được duyệt")
    if gr.trang_thai != "nhap":
        raise HTTPException(400, "Chỉ duyệt phiếu nhập đã hoàn thiện")
    gr.trang_thai = "da_duyet"

    # Cập nhật tồn kho + theo dõi PO khi duyệt (không tại bước tạo draft)
    for item in gr.items:
        if gr.warehouse_id:
            bal = _get_or_create_balance(
                db, gr.warehouse_id,
                item.paper_material_id, item.other_material_id,
                ten_hang=item.ten_hang, don_vi=item.dvt,
            )
            _nhap_balance(bal, item.so_luong, item.don_gia)
            _log_tx(db, gr.warehouse_id, "NHAP_MUA",
                    item.so_luong, item.don_gia, bal.ton_luong,
                    "goods_receipts", gr.id, current_user.id,
                    paper_material_id=item.paper_material_id,
                    other_material_id=item.other_material_id,
                    ghi_chu=item.ghi_chu)
        if item.po_item_id:
            poi = db.get(PurchaseOrderItem, item.po_item_id)
            if poi:
                poi.so_luong_da_nhan = (poi.so_luong_da_nhan or Decimal("0")) + item.so_luong
                if item.so_cuon is not None and poi.so_cuon is not None:
                    poi.so_cuon_da_nhan = (poi.so_cuon_da_nhan or 0) + item.so_cuon
    _recalc_purchase_order_receipt_status(db, gr.po_id)

    # Auto-sync gia_mua từ don_gia trên PNK khi duyệt
    for item in gr.items:
        if item.paper_material_id and item.don_gia and item.don_gia > 0:
            pm = (
                db.query(PaperMaterial)
                .filter(PaperMaterial.id == item.paper_material_id)
                .with_for_update()
                .first()
            )
            if pm:
                pm.gia_mua = item.don_gia

    # Ghi sổ kế toán — chỉ cho phiếu mua hàng thực tế
    if not gr.bo_qua_hach_toan and gr.loai_nhap == "MUA_HANG" and gr.tong_gia_tri > 0:
        wh = db.get(Warehouse, gr.warehouse_id)
        phan_xuong_id = wh.phan_xuong_id if wh else None
        if not gr.phan_xuong_id and phan_xuong_id:
            gr.phan_xuong_id = phan_xuong_id
        phap_nhan_id = gr.phap_nhan_id
        if not phap_nhan_id and phan_xuong_id:
            px = db.get(PhanXuong, phan_xuong_id)
            phap_nhan_id = px.phap_nhan_id if px else None

        acc_service = AccountingService(db)
        acc_service.post_goods_receipt_journal(gr, phap_nhan_id, phan_xuong_id)
    # Auto-tạo GiayRoll cho phiếu nhập giấy cuộn (idempotent)
    if gr.warehouse_id:
        for item in gr.items:
            if not item.paper_material_id:
                continue
            exists = db.query(GiayRoll).filter(GiayRoll.goods_receipt_item_id == item.id).first()
            if exists:
                continue
            barcode = _next_giay_roll_barcode(db)
            db.add(GiayRoll(
                barcode=barcode,
                goods_receipt_id=gr.id,
                goods_receipt_item_id=item.id,
                paper_material_id=item.paper_material_id,
                warehouse_id=gr.warehouse_id,
                so_phieu_nhap=gr.so_phieu,
                ngay_nhap=gr.ngay_nhap,
                trong_luong_ban_dau=item.so_luong,
                trong_luong_con_lai=item.so_luong,
                trang_thai="trong_kho",
            ))
            db.flush()

    db.commit()
    db.refresh(gr)
    logger.info("approved goods_receipt id=%s so_phieu=%s by user=%s", gr_id, gr.so_phieu, current_user.id)
    return {"ok": True, "trang_thai": "da_duyet"}


@router.post("/goods-receipts/{gr_id}/sync-gia-ban")
def sync_gia_ban(gr_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Bấm nút thủ công: gia_ban = gia_mua × 1.05 cho tất cả vật tư giấy trong PNK này."""
    gr = db.get(GoodsReceipt, gr_id)
    if not gr:
        raise HTTPException(404, "Không tìm thấy phiếu nhập")
    if gr.trang_thai != "da_duyet":
        raise HTTPException(400, "Phiếu chưa được duyệt")
    updated = []
    for item in gr.items:
        if item.paper_material_id:
            pm = db.get(PaperMaterial, item.paper_material_id)
            if pm and pm.gia_mua:
                pm.gia_ban = pm.gia_mua * Decimal("1.05")
                updated.append({
                    "ma_chinh": pm.ma_chinh,
                    "ten": pm.ten,
                    "gia_mua": float(pm.gia_mua),
                    "gia_ban": float(pm.gia_ban),
                })
    db.commit()
    return {"ok": True, "updated": updated}


@router.delete("/goods-receipts/{gr_id}")
def delete_goods_receipt(gr_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    gr = db.get(GoodsReceipt, gr_id)
    if not gr:
        raise HTTPException(404, "Không tìm thấy phiếu nhập")
    if gr.trang_thai != "nhap":
        raise HTTPException(400, "Chỉ được xoá phiếu ở trạng thái Nhập")

    active_invoice = db.query(PurchaseInvoice).filter(
        PurchaseInvoice.gr_id == gr_id,
        PurchaseInvoice.trang_thai != "huy",
    ).first()
    if active_invoice:
        raise HTTPException(400, "Khong the xoa phieu nhap da lap hoa don mua")

    active_return = db.query(PurchaseReturn).filter(
        PurchaseReturn.gr_id == gr_id,
        PurchaseReturn.trang_thai != "huy",
    ).first()
    if active_return:
        raise HTTPException(400, "Khong the xoa phieu nhap da co phieu tra hang mua")

    # GR bị xóa ở trạng thái nhap (draft) — tồn kho và PO tracking
    # chưa được cập nhật (chỉ cập nhật khi approve) nên không cần đảo ngược

    db.delete(gr)
    db.commit()
    return {"ok": True}


def _gr_to_dict(gr: GoodsReceipt, db: Session, include_image: bool = True, co_hoa_don_override: bool | None = None) -> dict:
    # Prefer pre-loaded relationships; fall back to db.get for single-record calls (detail endpoint)
    wh = gr.warehouse if gr.warehouse_id else None
    if wh is None and gr.warehouse_id:
        wh = db.get(Warehouse, gr.warehouse_id)
    sup = gr.supplier if gr.supplier_id else None
    if sup is None and gr.supplier_id:
        sup = db.get(Supplier, gr.supplier_id)
    px_id = gr.phan_xuong_id or (wh.phan_xuong_id if wh else None)
    px = gr.phan_xuong if gr.phan_xuong_id else None
    if px is None and px_id and px_id != gr.phan_xuong_id:
        px = db.get(PhanXuong, px_id)
    pn = gr.phap_nhan if gr.phap_nhan_id else (px.phap_nhan if px and px.phap_nhan else None)
    if pn is None and gr.phap_nhan_id:
        pn = db.get(PhapNhan, gr.phap_nhan_id)
    if co_hoa_don_override is None:
        co_hoa_don_override = db.query(PurchaseInvoice.id).filter(
            PurchaseInvoice.gr_id == gr.id,
            PurchaseInvoice.trang_thai != "huy",
        ).first() is not None
    return {
        "id": gr.id,
        "so_phieu": gr.so_phieu,
        "ngay_nhap": str(gr.ngay_nhap),
        "po_id": gr.po_id,
        "supplier_id": gr.supplier_id,
        "ten_ncc": sup.ten_viet_tat if sup else "",
        "warehouse_id": gr.warehouse_id,
        "ten_kho": wh.ten_kho if wh else "",
        "loai_kho": wh.loai_kho if wh else None,
        "phan_xuong_id": px_id,
        "ten_phan_xuong": px.ten_xuong if px else None,
        "loai_nhap": gr.loai_nhap,
        "tong_gia_tri": float(gr.tong_gia_tri),
        "trang_thai": gr.trang_thai,
        "ghi_chu": gr.ghi_chu,
        "so_xe": gr.so_xe,
        "invoice_image": gr.invoice_image if include_image else None,
        "has_invoice_image": bool(gr.invoice_image),
        "ocr_extracted_data": gr.ocr_extracted_data,
        "hd_tong_kg": float(gr.hd_tong_kg) if gr.hd_tong_kg else None,
        "phap_nhan_id": gr.phap_nhan_id,
        "ten_phap_nhan": (pn.ten_viet_tat or pn.ten_phap_nhan) if pn else None,
        "phap_nhan_id_for_print": gr.phap_nhan_id or (px.phap_nhan_id if px else None),
        "co_hoa_don": co_hoa_don_override,
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
            "kho_mm": float(it.kho_mm) if it.kho_mm else None,
            "so_cuon": it.so_cuon,
            "ky_hieu_cuon": it.ky_hieu_cuon,
            "dai_mm": float(it.dai_mm) if it.dai_mm else None,
            "so_lop": it.so_lop,
            "ghi_chu": it.ghi_chu,
        } for it in gr.items],
    }


# ── Phiếu xuất NVL (MaterialIssue) ───────────────────────────────────────────

@router.get("/material-issues")
def list_material_issues(
    warehouse_id: Optional[int] = Query(None),
    production_order_id: Optional[int] = Query(None),
    phan_xuong_id: Optional[int] = Query(None),
    phap_nhan_id: Optional[int] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(MaterialIssue)
    if phan_xuong_id or phap_nhan_id:
        q = q.join(Warehouse, Warehouse.id == MaterialIssue.warehouse_id)
    if warehouse_id:
        q = q.filter(MaterialIssue.warehouse_id == warehouse_id)
    if production_order_id:
        q = q.filter(MaterialIssue.production_order_id == production_order_id)
    if phan_xuong_id:
        q = q.filter(Warehouse.phan_xuong_id == phan_xuong_id)
    if phap_nhan_id:
        q = q.join(PhanXuong, Warehouse.phan_xuong_id == PhanXuong.id).filter(PhanXuong.phap_nhan_id == phap_nhan_id)
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
    if not _ensure_active_warehouse(db, warehouse_id, {"GIAY_CUON", "NVL_PHU"}):
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

    journal_lines_mi: list[dict] = []
    for it in body.items:
        ten_hang, dvt = _resolve_nvl_name(db, it.paper_material_id, it.other_material_id, it.ten_hang)
        if not ten_hang:
            ten_hang = it.ten_hang
        if it.dvt and it.dvt != "Kg":
            dvt = it.dvt

        # Lock row trước khi trừ tồn — tránh race condition concurrent exports
        bal = _get_or_create_balance(db, warehouse_id,
                                     it.paper_material_id, it.other_material_id,
                                     ten_hang=ten_hang, don_vi=dvt, lock=True)
        don_gia_xuat = bal.don_gia_binh_quan

        db.add(MaterialIssueItem(
            issue_id=mi.id,
            paper_material_id=it.paper_material_id,
            other_material_id=it.other_material_id,
            ten_hang=ten_hang,
            so_luong_ke_hoach=it.so_luong_ke_hoach,
            so_luong_thuc_xuat=it.so_luong_thuc_xuat,
            dvt=dvt,
            don_gia=don_gia_xuat,
            ghi_chu=it.ghi_chu,
        ))

        _xuat_balance(bal, it.so_luong_thuc_xuat, ten_hang)
        _log_tx(db, warehouse_id, "XUAT_SX",
                it.so_luong_thuc_xuat, don_gia_xuat, bal.ton_luong,
                "material_issues", mi.id, current_user.id,
                paper_material_id=it.paper_material_id,
                other_material_id=it.other_material_id,
                ghi_chu=it.ghi_chu)
        journal_lines_mi.append({
            "ten_hang": ten_hang,
            "so_luong": it.so_luong_thuc_xuat,
            "don_gia": float(don_gia_xuat),
            "tk_no": "154",
            "tk_co": _tk_nvl(it.paper_material_id),
        })

    # ── Ghi sổ kế toán tự động ──────────────────────────────────────────────
    acc_service = AccountingService(db)
    wh = db.get(Warehouse, warehouse_id)
    phap_nhan_id = wh.phan_xuong_obj.phap_nhan_id if wh and wh.phan_xuong_obj else None

    if not mi.bo_qua_hach_toan:
        acc_service.post_inventory_journal(
            ngay=mi.ngay_xuat,
            loai="XUAT_SX",
            chung_tu_loai="material_issues",
            chung_tu_id=mi.id,
            phap_nhan_id=phap_nhan_id,
            phan_xuong_id=wh.phan_xuong_id if wh else None,
            items=journal_lines_mi,
        )

    db.commit()
    db.refresh(mi)
    return _mi_to_dict(mi, db)


@router.delete("/material-issues/{mi_id}")
def delete_material_issue(mi_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
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
        bal.cap_nhat_luc = datetime.now(timezone.utc)
        _log_tx(db, mi.warehouse_id, "XOA_XUAT_SX",
                it.so_luong_thuc_xuat, it.don_gia, bal.ton_luong,
                "material_issues", mi.id, current_user.id,
                paper_material_id=it.paper_material_id,
                other_material_id=it.other_material_id,
                ghi_chu=f"Xóa {mi.so_phieu}")

    # Đảo ngược bút toán kế toán
    acc_service = AccountingService(db)
    acc_service._reverse_journal_entries("material_issues", mi_id)

    db.delete(mi)
    db.commit()
    return {"ok": True}


def _mi_to_dict(mi: MaterialIssue, db: Session) -> dict:
    wh = db.get(Warehouse, mi.warehouse_id)
    lsx = db.get(ProductionOrder, mi.production_order_id)
    phap_nhan_id = lsx.phap_nhan_id if lsx and lsx.phap_nhan_id else (wh.phan_xuong_obj.phap_nhan_id if wh and wh.phan_xuong_obj else None)
    return {
        "id": mi.id,
        "so_phieu": mi.so_phieu,
        "ngay_xuat": str(mi.ngay_xuat),
        "production_order_id": mi.production_order_id,
        "so_lenh": lsx.so_lenh if lsx else "",
        "warehouse_id": mi.warehouse_id,
        "ten_kho": wh.ten_kho if wh else "",
        "phap_nhan_id": phap_nhan_id,
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
    phan_xuong_id: Optional[int] = Query(None),
    phap_nhan_id: Optional[int] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(ProductionOutput)
    if phan_xuong_id or phap_nhan_id:
        q = q.join(Warehouse, Warehouse.id == ProductionOutput.warehouse_id)
    if warehouse_id:
        q = q.filter(ProductionOutput.warehouse_id == warehouse_id)
    if production_order_id:
        q = q.filter(ProductionOutput.production_order_id == production_order_id)
    if phan_xuong_id:
        q = q.filter(Warehouse.phan_xuong_id == phan_xuong_id)
    if phap_nhan_id:
        q = q.join(PhanXuong, Warehouse.phan_xuong_id == PhanXuong.id).filter(PhanXuong.phap_nhan_id == phap_nhan_id)
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
    if not _ensure_active_warehouse(db, warehouse_id, {"THANH_PHAM"}):
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

    # ── Ghi sổ kế toán tự động ──────────────────────────────────────────────
    acc_service = AccountingService(db)
    
    # Lấy thông tin pháp nhân và xưởng
    wh = db.get(Warehouse, warehouse_id)
    phap_nhan_id = wh.phan_xuong_obj.phap_nhan_id if wh and wh.phan_xuong_obj else None
    
    # Nhập kho thành phẩm: Nợ 155 (tại kho) / Có 154 (tại xưởng SX)
    if not out.bo_qua_hach_toan:
        # Lấy thông tin xưởng sản xuất từ Lệnh sản xuất
        producing_px_id = out.production_order.phan_xuong_id if out.production_order else None
        producing_pn_id = out.production_order.phap_nhan_id if out.production_order else None

        acc_service.post_inventory_journal(
            ngay=out.ngay_nhap,
            loai="NHAP_TP",
            chung_tu_loai="phieu_nhap_tp",
            chung_tu_id=out.id,
            phap_nhan_id=phap_nhan_id, # Default PN (from warehouse)
            phan_xuong_id=wh.phan_xuong_id if wh else None, # Default PX (storing)
            items=[{
                "ten_hang": out.production_order.items[0].ten_hang if out.production_order and out.production_order.items else "Thành phẩm",
                "so_luong": out.so_luong_nhap,
                "don_gia": out.don_gia_xuat_xuong or 0,
                "tk_no": "155",
                "tk_co": "154",
                "phan_xuong_id_no": wh.phan_xuong_id if wh else None, # Tăng tài sản tại Kho
                "phan_xuong_id_co": producing_px_id,                   # Giảm chi phí tại Xưởng SX
                "phap_nhan_id_no": phap_nhan_id,
                "phap_nhan_id_co": producing_pn_id
            }]
        )

    db.commit()
    db.refresh(out)
    return _po_out_to_dict(out, db)


@router.delete("/production-outputs/{out_id}")
def delete_production_output(out_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    out = db.get(ProductionOutput, out_id)
    if not out:
        raise HTTPException(404, "Không tìm thấy phiếu nhập thành phẩm")

    tong_nhap_lsx = db.query(
        func.coalesce(func.sum(ProductionOutput.so_luong_nhap), 0)
    ).filter(
        ProductionOutput.production_order_id == out.production_order_id,
        ProductionOutput.warehouse_id == out.warehouse_id,
    ).scalar() or Decimal("0")
    tong_xuat_lsx = db.query(
        func.coalesce(func.sum(DeliveryOrderItem.so_luong), 0)
    ).join(
        DeliveryOrder, DeliveryOrder.id == DeliveryOrderItem.delivery_id
    ).filter(
        DeliveryOrderItem.production_order_id == out.production_order_id,
        DeliveryOrder.warehouse_id == out.warehouse_id,
    ).scalar() or Decimal("0")
    if Decimal(str(tong_nhap_lsx)) - out.so_luong_nhap < Decimal(str(tong_xuat_lsx)):
        raise HTTPException(400, "Khong the xoa phieu nhap TP vi hang cua LSX da duoc xuat giao")

    bal = _get_or_create_balance(db, out.warehouse_id,
                                 product_id=out.product_id,
                                 ten_hang=out.ten_hang or "", don_vi=out.dvt)
    _xuat_balance(bal, out.so_luong_nhap, out.ten_hang or "")
    _log_tx(db, out.warehouse_id, "XOA_NHAP_SX",
            out.so_luong_nhap, out.don_gia_xuat_xuong or Decimal("0"), bal.ton_luong,
            "production_outputs", out.id, None,
            product_id=out.product_id,
            ghi_chu="Xoa phieu nhap thanh pham")

    acc_service = AccountingService(db)
    acc_service._reverse_journal_entries("phieu_nhap_tp", out.id)

    db.delete(out)
    db.commit()
    return {"ok": True}


def _po_out_to_dict(out: ProductionOutput, db: Session) -> dict:
    wh = db.get(Warehouse, out.warehouse_id)
    lsx = db.get(ProductionOrder, out.production_order_id)
    phap_nhan_id = lsx.phap_nhan_id if lsx and lsx.phap_nhan_id else (wh.phan_xuong_obj.phap_nhan_id if wh and wh.phan_xuong_obj else None)
    return {
        "id": out.id,
        "so_phieu": out.so_phieu,
        "ngay_nhap": str(out.ngay_nhap),
        "production_order_id": out.production_order_id,
        "so_lenh": lsx.so_lenh if lsx else "",
        "warehouse_id": out.warehouse_id,
        "ten_kho": wh.ten_kho if wh else "",
        "phap_nhan_id": phap_nhan_id,
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

        balances = db.query(InventoryBalance).filter(
            InventoryBalance.warehouse_id == warehouse_id,
            InventoryBalance.product_id == it.product_id,
            InventoryBalance.ton_luong > 0,
        ).all() if it.product_id else [
            _get_or_create_balance(db, warehouse_id, product_id=it.product_id, ten_hang=ten_hang, don_vi=dvt)
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
    from app.utils.ocr import extract_phieu_giao_hang

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
        it.so_luong   = adj.so_luong_moi
        it.thanh_tien = adj.so_luong_moi * (it.don_gia or Decimal("0"))

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
def delete_delivery(do_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
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
    so = db.get(SalesOrder, do.sales_order_id) if do.sales_order_id else None
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
        "sales_order_id": do.sales_order_id,
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
        is_phoi = bool(it.production_order_id) and not it.paper_material_id and not it.other_material_id
        if is_phoi:
            tong_nhap = db.query(func.coalesce(func.sum(PhieuNhapPhoiSongItem.so_luong_thuc_te), 0)).join(
                PhieuNhapPhoiSong, PhieuNhapPhoiSongItem.phieu_id == PhieuNhapPhoiSong.id
            ).filter(PhieuNhapPhoiSong.production_order_id == it.production_order_id).scalar() or Decimal("0")
            tong_chuyen = db.query(func.coalesce(func.sum(PhieuChuyenKhoItem.so_luong), 0)).filter(
                PhieuChuyenKhoItem.production_order_id == it.production_order_id
            ).scalar() or Decimal("0")
            ton_tai_nguon = max(Decimal("0"), Decimal(str(tong_nhap)) - Decimal(str(tong_chuyen)))
            if ton_tai_nguon < it.so_luong:
                raise HTTPException(400, f"Không đủ phôi tại kho nguồn: LSX #{it.production_order_id} — "
                                    f"cần {float(it.so_luong):g}, còn {float(ton_tai_nguon):g}")
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

    try:
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
            is_phoi = bool(it.production_order_id) and not it.paper_material_id and not it.other_material_id
            if is_phoi:
                # Phôi sóng: chỉ tạo PhieuChuyenKhoItem, KHÔNG dùng InventoryBalance
                # get_ton_kho_lsx đọc tong_chuyen từ bảng này để tính tồn kho phôi

                # Tự động lấy don_gia_noi_bo từ LSX nếu client không truyền (hoặc truyền 0)
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
            else:
                ten_hang, don_vi = _resolve_nvl_name(db, it.paper_material_id, it.other_material_id, it.ten_hang)
                if not ten_hang:
                    ten_hang = it.ten_hang
                don_vi = it.don_vi or don_vi

                # Lấy giá bình quân TRƯỚC khi tạo item để lưu đúng vào PhieuChuyenKhoItem.don_gia
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

        # ── Ghi sổ kế toán tự động ──────────────────────────────────────────────
        acc_service = AccountingService(db)

        # Lấy thông tin pháp nhân và xưởng — mỗi chiều dùng phap_nhan riêng
        wh_xuat = db.get(Warehouse, body.warehouse_xuat_id)
        wh_nhap = db.get(Warehouse, body.warehouse_nhap_id)

        phap_nhan_id_xuat = wh_xuat.phan_xuong_obj.phap_nhan_id if wh_xuat and wh_xuat.phan_xuong_obj else None
        phap_nhan_id_nhap = wh_nhap.phan_xuong_obj.phap_nhan_id if wh_nhap and wh_nhap.phan_xuong_obj else None
        phap_nhan_id = phap_nhan_id_xuat  # giữ alias cho bút toán xuất

        # Chuẩn bị dữ liệu dòng cho kế toán
        journal_items = []
        for it in phieu.items:
            # Xác định tài khoản 152 (NVL) hay 155 (Thành phẩm / Phôi sóng)
            _product_id = getattr(it, "product_id", None)
            _is_phoi_item = bool(it.production_order_id) and not it.paper_material_id and not it.other_material_id
            tk_kho = "155" if _product_id or it.production_order_id else "152"

            # --- LẤY GIÁ CHUYỂN ---
            std_price = Decimal("0")
            if it.paper_material_id:
                mat = db.get(PaperMaterial, it.paper_material_id)
                std_price = mat.gia_dinh_muc if mat else Decimal("0")
            elif it.other_material_id:
                mat = db.get(OtherMaterial, it.other_material_id)
                std_price = mat.gia_dinh_muc if mat else Decimal("0")
            elif _is_phoi_item:
                # Phôi sóng: dùng giá đã lưu trên item (= don_gia_noi_bo tại thời điểm tạo phiếu)
                std_price = it.don_gia or Decimal("0")
            elif _product_id:
                prod = db.get(Product, _product_id)
                std_price = prod.gia_dinh_muc if prod else Decimal("0")

            # Nếu không có giá, dùng giá bình quân lưu trong item
            transfer_price = std_price if std_price > 0 else (it.don_gia or Decimal("0"))

            # Phôi không có don_gia_binh_quan từ InventoryBalance → dùng transfer_price cho cả 2 vế
            don_gia_bq = transfer_price if _is_phoi_item else (it.don_gia or Decimal("0"))

            journal_items.append({
                "ten_hang": it.ten_hang,
                "so_luong": it.so_luong,
                "don_gia": transfer_price,
                "don_gia_binh_quan": don_gia_bq,
                "tk_kho": tk_kho
            })

        # Guard idempotency: không tạo bút toán trùng nếu phiếu đã có journal
        _existing_journal = db.query(JournalEntry).filter(
            JournalEntry.chung_tu_loai == "phieu_chuyen_kho",
            JournalEntry.chung_tu_id == phieu.id,
        ).first()

        if journal_items and not phieu.bo_qua_hach_toan and not _existing_journal:
            # 1. Bút toán xưởng xuất:
            # - Nợ 1368 / Có 5112 (Doanh thu nội bộ theo Giá định mức)
            # - Nợ 6322 / Có 152-155 (Giá vốn nội bộ theo Giá bình quân)
            lines_xuat = []
            for i in journal_items:
                val_std = float(i["so_luong"]) * float(i["don_gia"])      # Giá định mức
                val_act = float(i["so_luong"]) * float(i.get("don_gia_binh_quan", i["don_gia"])) # Giá bình quân

                # Cặp Doanh thu nội bộ
                lines_xuat.append({"so_tk": "1368", "dien_giai": f"DTNB: {i['ten_hang']}", "so_tien_no": val_std, "so_tien_co": 0})
                lines_xuat.append({"so_tk": "5112", "dien_giai": f"DTNB: {i['ten_hang']}", "so_tien_no": 0, "so_tien_co": val_std})

                # Cặp Giá vốn nội bộ
                lines_xuat.append({"so_tk": "6322", "dien_giai": f"GVNB: {i['ten_hang']}", "so_tien_no": val_act, "so_tien_co": 0})
                lines_xuat.append({"so_tk": i["tk_kho"], "dien_giai": f"GVNB: {i['ten_hang']}", "so_tien_no": 0, "so_tien_co": val_act})

            acc_service._create_journal_entry(
                ngay=phieu.ngay,
                dien_giai=f"Xuất nội bộ: {phieu.so_phieu}",
                loai_but_toan="chuyen_kho_xuat",
                chung_tu_loai="phieu_chuyen_kho",
                chung_tu_id=phieu.id,
                phap_nhan_id=phap_nhan_id,
                phan_xuong_id=wh_xuat.phan_xuong_id,
                lines=lines_xuat
            )

            # 2. Bút toán xưởng nhập: Nợ 152-155 / Có 3368 (Theo Giá định mức)
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

        db.commit()
        db.refresh(phieu)
        return _ck_to_dict(phieu, db)
    except Exception:
        db.rollback()
        raise


@router.delete("/phieu-chuyen/{phieu_id}")
def delete_phieu_chuyen(phieu_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = db.get(PhieuChuyenKho, phieu_id)
    if not p:
        raise HTTPException(404, "Không tìm thấy phiếu chuyển")
    if p.trang_thai != "nhap":
        raise HTTPException(400, "Chỉ được xoá phiếu ở trạng thái Nhập")

    for it in p.items:
        _is_phoi = bool(it.production_order_id) and not it.paper_material_id and not it.other_material_id
        if _is_phoi:
            # Phôi sóng không dùng InventoryBalance — tồn kho tự đảo ngược khi xóa PhieuChuyenKhoItem
            continue

        bal_xuat = _get_or_create_balance(db, p.warehouse_xuat_id,
                                          it.paper_material_id, it.other_material_id,
                                          ten_hang=it.ten_hang, don_vi=it.don_vi)
        bal_xuat.ton_luong += it.so_luong
        bal_xuat.gia_tri_ton = bal_xuat.ton_luong * bal_xuat.don_gia_binh_quan
        bal_xuat.cap_nhat_luc = datetime.now(timezone.utc)
        _log_tx(db, p.warehouse_xuat_id, "XOA_CHUYEN_XUAT",
                it.so_luong, it.don_gia, bal_xuat.ton_luong,
                "phieu_chuyen_kho", p.id, current_user.id,
                paper_material_id=it.paper_material_id,
                other_material_id=it.other_material_id,
                ghi_chu=f"Xóa {p.so_phieu}")

        bal_nhap = _get_or_create_balance(db, p.warehouse_nhap_id,
                                          it.paper_material_id, it.other_material_id,
                                          ten_hang=it.ten_hang, don_vi=it.don_vi)
        bal_nhap.ton_luong = max(Decimal("0"), bal_nhap.ton_luong - it.so_luong)
        bal_nhap.gia_tri_ton = bal_nhap.ton_luong * bal_nhap.don_gia_binh_quan
        bal_nhap.cap_nhat_luc = datetime.now(timezone.utc)
        _log_tx(db, p.warehouse_nhap_id, "XOA_CHUYEN_NHAP",
                it.so_luong, it.don_gia, bal_nhap.ton_luong,
                "phieu_chuyen_kho", p.id, current_user.id,
                paper_material_id=it.paper_material_id,
                other_material_id=it.other_material_id,
                ghi_chu=f"Xóa {p.so_phieu}")

    # Đảo ngược bút toán kế toán
    acc_service = AccountingService(db)
    acc_service._reverse_journal_entries("phieu_chuyen_kho", phieu_id)

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
    d: dict = {
        "id": it.id,
        "paper_material_id": it.paper_material_id,
        "other_material_id": it.other_material_id,
        "production_order_id": getattr(it, "production_order_id", None),
        "ten_hang": it.ten_hang,
        "don_vi": it.don_vi,
        "so_luong": float(it.so_luong),
        "don_gia": float(it.don_gia),
        "ghi_chu": it.ghi_chu,
    }
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


# ── Lịch sử giao dịch ─────────────────────────────────────────────────────────

# --- Kiem ke / dieu chinh ton kho -------------------------------------------------

@router.get("/stock-adjustments")
def list_stock_adjustments(
    warehouse_id: Optional[int] = Query(None),
    phan_xuong_id: Optional[int] = Query(None),
    phap_nhan_id: Optional[int] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(StockAdjustment)
    if phan_xuong_id or phap_nhan_id:
        q = q.join(Warehouse, Warehouse.id == StockAdjustment.warehouse_id)
    if warehouse_id:
        q = q.filter(StockAdjustment.warehouse_id == warehouse_id)
    if phan_xuong_id:
        q = q.filter(Warehouse.phan_xuong_id == phan_xuong_id)
    if phap_nhan_id:
        q = q.join(PhanXuong, Warehouse.phan_xuong_id == PhanXuong.id).filter(PhanXuong.phap_nhan_id == phap_nhan_id)
    if tu_ngay:
        q = q.filter(StockAdjustment.ngay >= tu_ngay)
    if den_ngay:
        q = q.filter(StockAdjustment.ngay <= den_ngay)
    rows = q.options(joinedload(StockAdjustment.items)).order_by(StockAdjustment.created_at.desc()).all()
    return [_adj_to_dict(r, db) for r in rows]


@router.get("/stock-adjustments/{adj_id}")
def get_stock_adjustment(adj_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    adj = db.query(StockAdjustment).options(joinedload(StockAdjustment.items)).filter(StockAdjustment.id == adj_id).first()
    if not adj:
        raise HTTPException(404, "Khong tim thay phieu kiem ke")
    return _adj_to_dict(adj, db)


@router.post("/stock-adjustments", status_code=201)
def create_stock_adjustment(
    body: StockAdjustmentIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.items:
        raise HTTPException(400, "Phieu kiem ke phai co it nhat 1 dong hang")
    if not db.get(Warehouse, body.warehouse_id):
        raise HTTPException(404, "Khong tim thay kho")

    balances: list[tuple[StockAdjustmentItemIn, InventoryBalance, Decimal]] = []
    seen_balance_ids: set[int] = set()
    for it in body.items:
        if it.inventory_balance_id in seen_balance_ids:
            raise HTTPException(400, "Mot mat hang chi duoc dieu chinh mot lan trong phieu")
        seen_balance_ids.add(it.inventory_balance_id)

        bal = db.get(InventoryBalance, it.inventory_balance_id)
        if not bal or bal.warehouse_id != body.warehouse_id:
            raise HTTPException(400, "Mat hang kiem ke khong thuoc kho da chon")
        if it.so_luong_thuc_te < 0:
            raise HTTPException(400, "So luong thuc te khong duoc am")

        diff = it.so_luong_thuc_te - bal.ton_luong
        balances.append((it, bal, diff))

    if all(diff == 0 for _, _, diff in balances):
        raise HTTPException(400, "Khong co chenh lech ton kho de dieu chinh")

    try:
        adj = StockAdjustment(
            so_phieu=_gen_so(db, "KK", StockAdjustment),
            warehouse_id=body.warehouse_id,
            ngay=body.ngay,
            ly_do=body.ly_do,
            ghi_chu=body.ghi_chu,
            created_by=current_user.id,
        )
        db.add(adj)
        db.flush()

        wh = _ensure_active_warehouse(db, body.warehouse_id)
        journal_items_adj = []
        for it, bal, diff in balances:
            ten_hang = _balance_item_name(db, bal)
            don_vi = bal.don_vi or _balance_item_unit(db, bal)
            don_gia = bal.don_gia_binh_quan or Decimal("0")

            db.add(StockAdjustmentItem(
                adjustment_id=adj.id,
                inventory_balance_id=bal.id,
                paper_material_id=bal.paper_material_id,
                other_material_id=bal.other_material_id,
                product_id=bal.product_id,
                ten_hang=ten_hang,
                don_vi=don_vi,
                so_luong_so_sach=bal.ton_luong,
                so_luong_thuc_te=it.so_luong_thuc_te,
                chenhlech=diff,
                don_gia=don_gia,
                ghi_chu=it.ghi_chu,
            ))

            if diff > 0:
                _nhap_balance(bal, diff, don_gia)
                loai = "DIEU_CHINH_TANG"
                so_luong_tx = diff
            else:
                _xuat_balance(bal, -diff, ten_hang)
                loai = "DIEU_CHINH_GIAM"
                so_luong_tx = -diff

            _log_tx(db, body.warehouse_id, loai,
                    so_luong_tx, don_gia, bal.ton_luong,
                    "stock_adjustment", adj.id, current_user.id,
                    paper_material_id=bal.paper_material_id,
                    other_material_id=bal.other_material_id,
                    product_id=bal.product_id,
                    ghi_chu=it.ghi_chu or body.ly_do)
            journal_items_adj.append({
                "ten_hang": ten_hang,
                "so_luong": abs(diff),
                "don_gia": don_gia,
                "tk_no": _tk_inventory(bal.paper_material_id, bal.other_material_id, bal.product_id, wh.loai_kho) if diff > 0 else "811",
                "tk_co": _tk_inventory(bal.paper_material_id, bal.other_material_id, bal.product_id, wh.loai_kho) if diff < 0 else "711",
            })

        # ── Ghi sổ kế toán tự động ──────────────────────────────────────────────
        acc_service = AccountingService(db)
        phap_nhan_id = wh.phan_xuong_obj.phap_nhan_id if wh and wh.phan_xuong_obj else None

        if not adj.bo_qua_hach_toan:
            acc_service.post_inventory_journal(
                ngay=adj.ngay,
                loai="DIEU_CHINH",
                chung_tu_loai="stock_adjustment",
                chung_tu_id=adj.id,
                phap_nhan_id=phap_nhan_id,
                phan_xuong_id=wh.phan_xuong_id if wh else None,
                items=journal_items_adj,
            )

        db.commit()
        db.refresh(adj)
        return _adj_to_dict(adj, db)
    except Exception:
        db.rollback()
        raise


@router.delete("/stock-adjustments/{adj_id}")
def delete_stock_adjustment(adj_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    adj = db.get(StockAdjustment, adj_id)
    if not adj:
        raise HTTPException(404, "Khong tim thay phieu kiem ke")
    if adj.trang_thai != "nhap":
        raise HTTPException(400, "Chi duoc xoa phieu o trang thai Nhap")

    for it in adj.items:
        bal = _get_or_create_balance(
            db, adj.warehouse_id,
            it.paper_material_id, it.other_material_id, it.product_id,
            ten_hang=it.ten_hang, don_vi=it.don_vi,
        )
        if it.chenhlech > 0:
            _xuat_balance(bal, it.chenhlech, it.ten_hang)
            _log_tx(db, adj.warehouse_id, "XOA_DIEU_CHINH_TANG",
                    it.chenhlech, it.don_gia, bal.ton_luong,
                    "stock_adjustment", adj.id, current_user.id,
                    paper_material_id=it.paper_material_id,
                    other_material_id=it.other_material_id,
                    product_id=it.product_id,
                    ghi_chu=f"Xóa {adj.so_phieu}")
        elif it.chenhlech < 0:
            _nhap_balance(bal, -it.chenhlech, it.don_gia)
            _log_tx(db, adj.warehouse_id, "XOA_DIEU_CHINH_GIAM",
                    -it.chenhlech, it.don_gia, bal.ton_luong,
                    "stock_adjustment", adj.id, current_user.id,
                    paper_material_id=it.paper_material_id,
                    other_material_id=it.other_material_id,
                    product_id=it.product_id,
                    ghi_chu=f"Xóa {adj.so_phieu}")

    acc_service = AccountingService(db)
    acc_service._reverse_journal_entries("stock_adjustment", adj_id)

    db.delete(adj)
    db.commit()
    return {"ok": True}


def _balance_item_name(db: Session, bal: InventoryBalance) -> str:
    if bal.paper_material_id:
        mat = db.get(PaperMaterial, bal.paper_material_id)
        if mat:
            return mat.ten
    if bal.other_material_id:
        mat = db.get(OtherMaterial, bal.other_material_id)
        if mat:
            return mat.ten
    if bal.product_id:
        prod = db.get(Product, bal.product_id)
        if prod:
            return prod.ten_san_pham
    return bal.ten_hang or ""


def _balance_item_unit(db: Session, bal: InventoryBalance) -> str:
    if bal.paper_material_id:
        mat = db.get(PaperMaterial, bal.paper_material_id)
        if mat:
            return mat.dvt
    if bal.other_material_id:
        mat = db.get(OtherMaterial, bal.other_material_id)
        if mat:
            return mat.dvt
    if bal.product_id:
        prod = db.get(Product, bal.product_id)
        if prod:
            return getattr(prod, "dvt", "Thung") or "Thung"
    return bal.don_vi or "Kg"


def _adj_to_dict(adj: StockAdjustment, db: Session) -> dict:
    wh = db.get(Warehouse, adj.warehouse_id)
    phap_nhan_id = wh.phan_xuong_obj.phap_nhan_id if wh and wh.phan_xuong_obj else None
    return {
        "id": adj.id,
        "so_phieu": adj.so_phieu,
        "warehouse_id": adj.warehouse_id,
        "ten_kho": wh.ten_kho if wh else "",
        "phap_nhan_id": phap_nhan_id,
        "ngay": str(adj.ngay),
        "ly_do": adj.ly_do,
        "ghi_chu": adj.ghi_chu,
        "trang_thai": adj.trang_thai,
        "created_at": adj.created_at.isoformat() if adj.created_at else None,
        "items": [{
            "id": it.id,
            "inventory_balance_id": it.inventory_balance_id,
            "paper_material_id": it.paper_material_id,
            "other_material_id": it.other_material_id,
            "product_id": it.product_id,
            "ten_hang": it.ten_hang,
            "don_vi": it.don_vi,
            "so_luong_so_sach": float(it.so_luong_so_sach),
            "so_luong_thuc_te": float(it.so_luong_thuc_te),
            "chenhlech": float(it.chenhlech),
            "don_gia": float(it.don_gia),
            "ghi_chu": it.ghi_chu,
        } for it in adj.items],
    }


@router.get("/giao-dich")
def get_giao_dich(
    warehouse_id: Optional[int] = Query(None),
    phan_xuong_id: Optional[int] = Query(None),
    phap_nhan_id: Optional[int] = Query(None),
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
    if phan_xuong_id or phap_nhan_id:
        q = q.join(Warehouse, Warehouse.id == InventoryTransaction.warehouse_id)
    if warehouse_id:
        q = q.filter(InventoryTransaction.warehouse_id == warehouse_id)
    if phan_xuong_id:
        q = q.filter(Warehouse.phan_xuong_id == phan_xuong_id)
    if phap_nhan_id:
        q = q.join(PhanXuong, Warehouse.phan_xuong_id == PhanXuong.id).filter(PhanXuong.phap_nhan_id == phap_nhan_id)
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
    rows = q.order_by(InventoryTransaction.ngay_giao_dich.asc(), InventoryTransaction.id.asc()).limit(limit).all()
    # Batch-load names
    wh_ids = {r.warehouse_id for r in rows}
    pm_ids = {r.paper_material_id for r in rows if r.paper_material_id}
    om_ids = {r.other_material_id for r in rows if r.other_material_id}
    pd_ids = {r.product_id for r in rows if r.product_id}
    wh_rows = (
        db.query(Warehouse)
        .options(joinedload(Warehouse.phan_xuong_obj).joinedload(PhanXuong.phap_nhan))
        .filter(Warehouse.id.in_(wh_ids))
        .all()
    ) if wh_ids else []
    wh_map = {w.id: w for w in wh_rows}
    pm_map = {p.id: (p.ma_chinh, p.ten) for p in db.query(PaperMaterial).filter(PaperMaterial.id.in_(pm_ids)).all()} if pm_ids else {}
    om_map = {p.id: (p.ma_chinh, p.ten) for p in db.query(OtherMaterial).filter(OtherMaterial.id.in_(om_ids)).all()} if om_ids else {}
    pd_map = {p.id: (p.ma_hang or p.ma_amis, p.ten_hang) for p in db.query(Product).filter(Product.id.in_(pd_ids)).all()} if pd_ids else {}

    def _name(r) -> tuple[str, str]:
        if r.paper_material_id and r.paper_material_id in pm_map:
            return pm_map[r.paper_material_id]
        if r.other_material_id and r.other_material_id in om_map:
            return om_map[r.other_material_id]
        if r.product_id and r.product_id in pd_map:
            return pd_map[r.product_id]
        return ("", "")

    return [{
        "id": r.id,
        "ngay_giao_dich": r.ngay_giao_dich.isoformat() if r.ngay_giao_dich else None,
        "warehouse_id": r.warehouse_id,
        "ten_kho": wh_map.get(r.warehouse_id).ten_kho if wh_map.get(r.warehouse_id) else "",
        "loai_kho": wh_map.get(r.warehouse_id).loai_kho if wh_map.get(r.warehouse_id) else None,
        "phan_xuong_id": wh_map.get(r.warehouse_id).phan_xuong_id if wh_map.get(r.warehouse_id) else None,
        "ten_phan_xuong": wh_map.get(r.warehouse_id).phan_xuong_obj.ten_xuong if wh_map.get(r.warehouse_id) and wh_map.get(r.warehouse_id).phan_xuong_obj else None,
        "phap_nhan_id": wh_map.get(r.warehouse_id).phan_xuong_obj.phap_nhan_id if wh_map.get(r.warehouse_id) and wh_map.get(r.warehouse_id).phan_xuong_obj else None,
        "ten_phap_nhan": (
            wh_map.get(r.warehouse_id).phan_xuong_obj.phap_nhan.ten_viet_tat
            or wh_map.get(r.warehouse_id).phan_xuong_obj.phap_nhan.ten_phap_nhan
        ) if wh_map.get(r.warehouse_id) and wh_map.get(r.warehouse_id).phan_xuong_obj and wh_map.get(r.warehouse_id).phan_xuong_obj.phap_nhan else None,
        "paper_material_id": r.paper_material_id,
        "other_material_id": r.other_material_id,
        "product_id": r.product_id,
        "ma_hang": _name(r)[0],
        "ten_hang": _name(r)[1],
        "loai_giao_dich": r.loai_giao_dich,
        "so_luong": float(r.so_luong),
        "don_gia": float(r.don_gia),
        "gia_tri": float(r.gia_tri),
        "ton_sau_giao_dich": float(r.ton_sau_giao_dich),
        "chung_tu_loai": r.chung_tu_loai,
        "chung_tu_id": r.chung_tu_id,
        "ghi_chu": r.ghi_chu,
    } for r in rows]


@router.get("/ton-kho-tp-lsx")
def ton_kho_tp_lsx(
    ten_khach: Optional[str] = Query(default=None),
    so_lenh: Optional[str] = Query(default=None),
    nv_theo_doi_id: Optional[int] = Query(default=None),
    tu_ngay: Optional[str] = Query(default=None),
    den_ngay: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Tổng hợp tồn kho thành phẩm theo từng LSX."""
    # 1. Nhập TP: sum(so_luong_nhap) per production_order_id
    # Không dùng MAX(warehouse_id) vì 1 LSX có thể nằm ở 2+ kho sau khi chuyển kho
    nhap_rows = (
        db.query(
            ProductionOutput.production_order_id,
            func.coalesce(func.sum(ProductionOutput.so_luong_nhap), 0).label("tong_nhap"),
            func.max(ProductionOutput.dvt).label("dvt"),
        )
        .group_by(ProductionOutput.production_order_id)
        .all()
    )
    if not nhap_rows:
        return []

    order_ids = [r.production_order_id for r in nhap_rows]
    nhap_map = {
        r.production_order_id: {
            "tong_nhap": float(r.tong_nhap),
            "dvt": r.dvt or "Thùng",
        }
        for r in nhap_rows
    }

    # 2. Xuất TP: sum(so_luong) per production_order_id từ DeliveryOrderItem
    xuat_rows = (
        db.query(
            DeliveryOrderItem.production_order_id,
            func.coalesce(func.sum(DeliveryOrderItem.so_luong), 0).label("tong_xuat"),
        )
        .join(DeliveryOrder, DeliveryOrder.id == DeliveryOrderItem.delivery_id)
        .filter(DeliveryOrderItem.production_order_id.in_(order_ids))
        .filter(DeliveryOrder.trang_thai != "huy")
        .group_by(DeliveryOrderItem.production_order_id)
        .all()
    )
    xuat_map = {r.production_order_id: float(r.tong_xuat) for r in xuat_rows}

    tra_rows_all = (
        db.query(
            DeliveryOrderItem.production_order_id,
            DeliveryOrder.warehouse_id,
            func.coalesce(func.sum(SalesReturnItem.so_luong_tra), 0).label("tong_tra"),
        )
        .select_from(SalesReturnItem)
        .join(SalesReturn, SalesReturn.id == SalesReturnItem.sales_return_id)
        .join(DeliveryOrder, DeliveryOrder.id == SalesReturn.delivery_order_id)
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
            DeliveryOrderItem.production_order_id.in_(order_ids),
            SalesReturn.trang_thai != "huy",
        )
        .group_by(DeliveryOrderItem.production_order_id, DeliveryOrder.warehouse_id)
        .all()
    )
    tra_map: dict[int, dict[int | None, float]] = {}
    for r in tra_rows_all:
        by_wh = tra_map.setdefault(r.production_order_id, {})
        by_wh[r.warehouse_id] = by_wh.get(r.warehouse_id, 0.0) + float(r.tong_tra)

    tra_rows_approved = (
        db.query(
            DeliveryOrderItem.production_order_id,
            DeliveryOrder.warehouse_id,
            func.coalesce(func.sum(SalesReturnItem.so_luong_tra), 0).label("tong_tra"),
        )
        .select_from(SalesReturnItem)
        .join(SalesReturn, SalesReturn.id == SalesReturnItem.sales_return_id)
        .join(DeliveryOrder, DeliveryOrder.id == SalesReturn.delivery_order_id)
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
            DeliveryOrderItem.production_order_id.in_(order_ids),
            SalesReturn.trang_thai == "da_duyet",
        )
        .group_by(DeliveryOrderItem.production_order_id, DeliveryOrder.warehouse_id)
        .all()
    )
    tra_approved_map: dict[int, dict[int | None, float]] = {}
    for r in tra_rows_approved:
        by_wh = tra_approved_map.setdefault(r.production_order_id, {})
        by_wh[r.warehouse_id] = by_wh.get(r.warehouse_id, 0.0) + float(r.tong_tra)

    # 3. Phiếu xuất gần nhất per LSX
    phieu_xuat_rows = (
        db.query(
            DeliveryOrderItem.production_order_id,
            func.max(DeliveryOrder.id).label("delivery_id"),
        )
        .join(DeliveryOrder, DeliveryOrder.id == DeliveryOrderItem.delivery_id)
        .filter(DeliveryOrderItem.production_order_id.in_(order_ids))
        .filter(DeliveryOrder.trang_thai != "huy")
        .group_by(DeliveryOrderItem.production_order_id)
        .all()
    )
    delivery_ids = [r.delivery_id for r in phieu_xuat_rows]
    deliveries_map = {}
    if delivery_ids:
        for d in db.query(DeliveryOrder).filter(DeliveryOrder.id.in_(delivery_ids)).all():
            deliveries_map[d.id] = d
    phieu_xuat_map: dict[int, dict] = {}
    for r in phieu_xuat_rows:
        d = deliveries_map.get(r.delivery_id)
        if d:
            phieu_xuat_map[r.production_order_id] = {
                "so_phieu": d.so_phieu,
                "ngay_xuat": d.ngay_xuat.isoformat() if d.ngay_xuat else None,
            }

    # 4. Item info per LSX (ten_hang + sl_ke_hoach)
    item_rows = (
        db.query(ProductionOrderItem)
        .options(
            joinedload(ProductionOrderItem.sales_order_item),
            joinedload(ProductionOrderItem.product),
        )
        .filter(ProductionOrderItem.production_order_id.in_(order_ids))
        .order_by(ProductionOrderItem.production_order_id, ProductionOrderItem.id)
        .all()
    )
    item_map: dict[int, ProductionOrderItem] = {}
    sl_ke_hoach_map: dict[int, float] = {}
    for item in item_rows:
        oid = item.production_order_id
        if oid not in item_map:
            item_map[oid] = item
        sl_ke_hoach_map[oid] = sl_ke_hoach_map.get(oid, 0.0) + float(item.so_luong_ke_hoach)

    # 5. ProductionOrder với các join
    orders = (
        db.query(ProductionOrder)
        .options(
            joinedload(ProductionOrder.sales_order).joinedload(SalesOrder.customer),
            joinedload(ProductionOrder.phap_nhan),
            joinedload(ProductionOrder.phan_xuong),
            joinedload(ProductionOrder.nv_theo_doi),
        )
        .filter(ProductionOrder.id.in_(order_ids))
        .all()
    )

    # 6. Metadata bổ sung (Pháp nhân + Kho hiện tại)
    pn_map = {p.id: p.ten_viet_tat for p in db.query(PhapNhan).all()}

    # Kho hiện tại: lấy distinct warehouse_id từ ProductionOutput per LSX
    kho_output_rows = (
        db.query(
            ProductionOutput.production_order_id,
            ProductionOutput.warehouse_id,
        )
        .filter(
            ProductionOutput.production_order_id.in_(order_ids),
            ProductionOutput.warehouse_id.isnot(None),
        )
        .distinct()
        .all()
    )
    kho_wh_ids = {r.warehouse_id for r in kho_output_rows if r.warehouse_id}
    kho_wh_map = {}
    if kho_wh_ids:
        for wh in db.query(Warehouse).filter(Warehouse.id.in_(kho_wh_ids)).all():
            kho_wh_map[wh.id] = wh.ten_kho
    # Group: production_order_id → list of warehouse names + first warehouse_id
    kho_by_order: dict[int, list[str]] = {}
    kho_id_by_order: dict[int, int] = {}
    for r in kho_output_rows:
        if r.warehouse_id and r.warehouse_id in kho_wh_map:
            kho_by_order.setdefault(r.production_order_id, [])
            name = kho_wh_map[r.warehouse_id]
            if name not in kho_by_order[r.production_order_id]:
                kho_by_order[r.production_order_id].append(name)
            if r.production_order_id not in kho_id_by_order:
                kho_id_by_order[r.production_order_id] = r.warehouse_id

    result = []
    for o in orders:
        nh = nhap_map.get(o.id, {})
        tong_nhap = nh.get("tong_nhap", 0.0)
        tong_xuat = xuat_map.get(o.id, 0.0)
        # Tổng trả = cộng tất cả kho (vì 1 LSX có thể trả từ nhiều kho)
        tong_tra = sum(tra_map.get(o.id, {}).values())
        tong_tra_da_duyet = sum(tra_approved_map.get(o.id, {}).values())
        kh = o.sales_order.customer if o.sales_order else None
        first_item = item_map.get(o.id)
        ten_khach_hang = kh.ten_viet_tat if kh else None
        ngay_lenh_str = o.ngay_lenh.isoformat() if o.ngay_lenh else None
        sales_item = first_item.sales_order_item if first_item and first_item.sales_order_item else None

        if ten_khach and (not ten_khach_hang or ten_khach.lower() not in ten_khach_hang.lower()):
            continue
        if so_lenh and so_lenh.lower() not in o.so_lenh.lower():
            continue
        if nv_theo_doi_id and o.nv_theo_doi_id != nv_theo_doi_id:
            continue
        if tu_ngay and (not ngay_lenh_str or ngay_lenh_str < tu_ngay):
            continue
        if den_ngay and (not ngay_lenh_str or ngay_lenh_str > den_ngay):
            continue

        ton_kho = tong_nhap - tong_xuat + tong_tra_da_duyet
        metrics = production_item_metrics(first_item, Decimal(str(ton_kho)))

        result.append({
            "production_order_id": o.id,
            "so_lenh": o.so_lenh,
            "ngay_lenh": ngay_lenh_str,
            "sales_order_id": o.sales_order_id,
            "so_don": o.sales_order.so_don if o.sales_order else None,
            "customer_id": kh.id if kh else None,
            "ten_hang": first_item.ten_hang if first_item else None,
            "product_id": first_item.product_id if first_item else None,
            "sales_order_item_id": first_item.sales_order_item_id if first_item else None,
            "don_gia": float(sales_item.don_gia) if sales_item and sales_item.don_gia else (
                float(first_item.gia_ban_muc_tieu) if first_item and first_item.gia_ban_muc_tieu else 0.0
            ),
            "dia_chi_giao": o.sales_order.dia_chi_giao if o.sales_order else None,
            "ten_khach_hang": ten_khach_hang,
            "nv_theo_doi_id": o.nv_theo_doi_id,
            "ten_nv_theo_doi": o.nv_theo_doi.ho_ten if o.nv_theo_doi else None,
            "sl_ke_hoach": sl_ke_hoach_map.get(o.id, 0.0),
            "tong_nhap": tong_nhap,
            "tong_xuat": tong_xuat,
            "tong_tra": tong_tra,
            "tong_tra_da_duyet": tong_tra_da_duyet,
            "tinh_trang_hang": "hang_tra_ve" if tong_tra > 0 else "binh_thuong",
            "ton_kho": ton_kho,
            "dien_tich": float(metrics["dien_tich"]),
            "trong_luong": float(metrics["trong_luong"]),
            "the_tich": float(metrics["the_tich"]),
            "dvt": nh.get("dvt", "Thùng"),
            "warehouse_id": kho_id_by_order.get(o.id),
            "ten_phan_xuong": None,
            "phan_xuong_id": o.phan_xuong_id,
            "order_ten_phan_xuong": o.phan_xuong.ten_xuong if o.phan_xuong else None,
            "phap_nhan_id": o.phap_nhan_id,
            "ten_phap_nhan_sx": pn_map.get(o.phap_nhan_id) or (o.phap_nhan.ten_viet_tat if o.phap_nhan else None),
            "ten_kho_hien_tai": ", ".join(kho_by_order.get(o.id, [])) or None,
            "phieu_xuat_gan_nhat": phieu_xuat_map.get(o.id),
            "loai_thung": first_item.loai_thung if first_item else None,
            "kho_tt": float(first_item.kho_tt) if first_item and first_item.kho_tt else None,
            "dai_tt": float(first_item.dai_tt) if first_item and first_item.dai_tt else None,
            "so_lop": first_item.so_lop if first_item else None,
        })

    result.sort(key=lambda x: x["so_lenh"])
    return result


# ── Giấy cuộn — per-roll tracking ────────────────────────────────────────────

def _next_giay_roll_barcode(db: Session) -> str:
    """Sinh barcode dạng YYGnnnnn — tăng dần, không trùng."""
    import datetime as _dt
    yy = _dt.date.today().strftime("%y")
    prefix = f"{yy}G"
    last = (db.query(GiayRoll)
              .filter(GiayRoll.barcode.like(f"{prefix}%"))
              .order_by(GiayRoll.id.desc())
              .first())
    seq = int(last.barcode[3:]) + 1 if last and last.barcode[3:].isdigit() else 1
    return f"{prefix}{seq:05d}"


def _giay_roll_to_dict(roll: GiayRoll) -> dict:
    pm = roll.paper_material
    wh = roll.warehouse
    return {
        "id": roll.id,
        "barcode": roll.barcode,
        "goods_receipt_id": roll.goods_receipt_id,
        "goods_receipt_item_id": roll.goods_receipt_item_id,
        "paper_material_id": roll.paper_material_id,
        "ma_chinh": pm.ma_chinh if pm else None,
        "ten": pm.ten if pm else None,
        "ky_hieu": pm.ma_ky_hieu if pm else None,
        "kho": float(pm.kho) if pm and pm.kho else None,
        "dinh_luong": int(pm.dinh_luong) if pm and pm.dinh_luong else None,
        "ma_nsx": (pm.nsx.ten_viet_tat if pm.nsx else None) if pm else None,
        "warehouse_id": roll.warehouse_id,
        "ten_kho": wh.ten_kho if wh else None,
        "so_phieu_nhap": roll.so_phieu_nhap,
        "ngay_nhap": roll.ngay_nhap.isoformat() if roll.ngay_nhap else None,
        "trong_luong_ban_dau": float(roll.trong_luong_ban_dau),
        "trong_luong_con_lai": float(roll.trong_luong_con_lai),
        "trang_thai": roll.trang_thai,
        "created_at": roll.created_at.isoformat() if roll.created_at else None,
    }


@router.post("/giay-rolls/from-receipt/{gr_id}")
def create_giay_rolls_from_receipt(
    gr_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Tạo GiayRoll cho mỗi dòng giấy cuộn trong phiếu nhập (idempotent)."""
    gr = db.get(GoodsReceipt, gr_id)
    if not gr:
        raise HTTPException(404, "Không tìm thấy phiếu nhập")
    if gr.trang_thai != "da_duyet":
        raise HTTPException(400, "Chỉ tạo tem cho phiếu đã duyệt")

    created, existed = [], []
    for item in gr.items:
        if not item.paper_material_id:
            continue
        existing = db.query(GiayRoll).filter(GiayRoll.goods_receipt_item_id == item.id).first()
        if existing:
            existed.append(existing.barcode)
            continue
        barcode = _next_giay_roll_barcode(db)
        roll = GiayRoll(
            barcode=barcode,
            goods_receipt_id=gr.id,
            goods_receipt_item_id=item.id,
            paper_material_id=item.paper_material_id,
            warehouse_id=gr.warehouse_id,
            so_phieu_nhap=gr.so_phieu,
            ngay_nhap=gr.ngay_nhap,
            trong_luong_ban_dau=item.so_luong,
            trong_luong_con_lai=item.so_luong,
            trang_thai="trong_kho",
        )
        db.add(roll)
        db.flush()
        created.append(barcode)

    db.commit()
    return {"created": created, "existed": existed, "total": len(created) + len(existed)}


@router.get("/giay-rolls")
def list_giay_rolls(
    warehouse_id: Optional[int] = None,
    paper_material_id: Optional[int] = None,
    trang_thai: Optional[str] = None,
    barcode: Optional[str] = None,
    so_phieu: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(GiayRoll)
    if warehouse_id:
        q = q.filter(GiayRoll.warehouse_id == warehouse_id)
    if paper_material_id:
        q = q.filter(GiayRoll.paper_material_id == paper_material_id)
    if trang_thai:
        q = q.filter(GiayRoll.trang_thai == trang_thai)
    if barcode:
        q = q.filter(GiayRoll.barcode.ilike(f"%{barcode}%"))
    if so_phieu:
        q = q.filter(GiayRoll.so_phieu_nhap.ilike(f"%{so_phieu}%"))
    rolls = q.order_by(GiayRoll.id.asc()).limit(500).all()
    return [_giay_roll_to_dict(r) for r in rolls]


@router.get("/giay-rolls/by-barcode/{barcode}")
def get_giay_roll_by_barcode(
    barcode: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    roll = db.query(GiayRoll).filter(GiayRoll.barcode == barcode).first()
    if not roll:
        raise HTTPException(404, "Không tìm thấy cuộn giấy")
    return _giay_roll_to_dict(roll)


class CanGiayRollIn(BaseModel):
    kg_con_lai: float


@router.patch("/giay-rolls/{roll_id}/can")
def can_giay_roll(
    roll_id: int,
    body: CanGiayRollIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cập nhật trọng lượng còn lại sau khi cân — điều chỉnh InventoryBalance."""
    roll = db.get(GiayRoll, roll_id)
    if not roll:
        raise HTTPException(404, "Không tìm thấy cuộn giấy")
    if body.kg_con_lai < 0:
        raise HTTPException(400, "Trọng lượng không được âm")

    delta_kg = float(roll.trong_luong_con_lai) - body.kg_con_lai
    roll.trong_luong_con_lai = Decimal(str(body.kg_con_lai))

    if body.kg_con_lai == 0:
        roll.trang_thai = "da_dung"
    elif body.kg_con_lai < float(roll.trong_luong_ban_dau):
        roll.trang_thai = "dang_dung"
    else:
        roll.trang_thai = "trong_kho"

    # Điều chỉnh InventoryBalance nếu có delta đáng kể
    if roll.warehouse_id and roll.paper_material_id and abs(delta_kg) >= 0.01:
        bal = _get_or_create_balance(
            db, roll.warehouse_id,
            roll.paper_material_id, None,
        )
        if delta_kg > 0:
            # Giảm tồn
            bal.ton_luong = max(Decimal("0"), bal.ton_luong - Decimal(str(delta_kg)))
            if bal.gia_tri_ton and bal.ton_luong > 0:
                bal.gia_tri_ton = bal.ton_luong * (bal.don_gia_binh_quan or Decimal("0"))
            elif bal.ton_luong == 0:
                bal.gia_tri_ton = Decimal("0")
        else:
            # Tăng tồn (cân lại, sửa sai)
            bal.ton_luong = bal.ton_luong + Decimal(str(abs(delta_kg)))
            if bal.don_gia_binh_quan:
                bal.gia_tri_ton = bal.ton_luong * bal.don_gia_binh_quan

        _log_tx(db, roll.warehouse_id, "DIEU_CHINH_CAN",
                Decimal(str(abs(delta_kg))), bal.don_gia_binh_quan or Decimal("0"),
                bal.ton_luong,
                "giay_rolls", roll.id, current_user.id,
                paper_material_id=roll.paper_material_id,
                ghi_chu=f"Cân cuộn {roll.barcode}: còn lại {body.kg_con_lai} kg")

    db.commit()
    return _giay_roll_to_dict(roll)


@router.get("/giay-rolls/print-one/{roll_id}", response_class=HTMLResponse)
def print_one_giay_roll_label(
    roll_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Trả về trang HTML in tem cho 1 cuộn giấy cụ thể."""
    roll = db.get(GiayRoll, roll_id)
    if not roll:
        raise HTTPException(404, "Không tìm thấy cuộn giấy")

    gr = db.get(GoodsReceipt, roll.goods_receipt_id)
    sup = db.get(Supplier, gr.supplier_id) if gr and gr.supplier_id else None
    ten_ncc = sup.ten_viet_tat if sup else ""
    ma_ncc = sup.ma_ncc if sup and hasattr(sup, "ma_ncc") else ""

    pm = roll.paper_material
    ky_hieu = pm.ma_ky_hieu if pm else ""
    kho = f"{float(pm.kho):.0f}" if pm and pm.kho else ""
    ma_chinh = pm.ma_chinh if pm else ""
    dinh_luong = f"{int(pm.dinh_luong)}" if pm and pm.dinh_luong else ""
    nvl = (pm.ten_viet_tat or "") if pm else ""
    so_kg = f"{float(roll.trong_luong_ban_dau):,.0f}"
    ngay_str = roll.ngay_nhap.strftime("%d/%m/%Y") if roll.ngay_nhap else ""
    so_phieu = gr.so_phieu if gr else ""
    barcode_val = roll.barcode

    label_html = f"""
    <div class="label">
      <div class="company">CÔNG TY TNHH SX TM NAM PHƯƠNG</div>
      <div class="row-2col">
        <div class="field"><div class="lbl">Ký hiệu</div><div class="val big">{ky_hieu}</div></div>
        <div class="field"><div class="lbl">Khổ Giấy</div><div class="val big">{kho}</div></div>
      </div>
      <div class="field"><div class="lbl">Số KG</div><div class="val big">{so_kg}</div></div>
      <div class="field small"><span class="lbl">Mã chính</span> <span class="val">{ma_chinh}</span></div>
      <div class="row-2col small">
        <div><span class="lbl">ĐL</span> <span class="val">{dinh_luong}</span></div>
        <div><span class="lbl">Mã NCC</span> <span class="val">{ma_ncc or ten_ncc}</span></div>
      </div>
      <div class="row-2col small">
        <div><span class="lbl">Khổ</span> <span class="val">{kho}</span></div>
        <div><span class="lbl">NVL</span> <span class="val">{nvl}</span></div>
      </div>
      <div class="row-2col small">
        <div><span class="lbl">Ngày nhập</span> <span class="val">{ngay_str}</span></div>
        <div><span class="lbl">Số phiếu</span> <span class="val">{so_phieu}</span></div>
      </div>
      <div class="barcode-wrap">
        <svg class="barcode" jsbarcode-value="{barcode_val}" jsbarcode-format="CODE128"
             jsbarcode-width="2" jsbarcode-height="40" jsbarcode-fontsize="12"
             jsbarcode-displayvalue="true"></svg>
      </div>
    </div>"""

    html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>In tem — {barcode_val}</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
<style>
  @media print {{ @page {{ size: 80mm 100mm; margin: 0; }} .no-print {{ display:none; }} }}
  body {{ font-family: Arial, sans-serif; margin: 0; padding: 8px; background: #f5f5f5; }}
  .label {{
    width: 76mm; min-height: 94mm; border: 1px solid #333;
    padding: 4mm 3mm; margin: 4mm auto; background: #fff;
    box-sizing: border-box;
  }}
  .company {{ font-size: 9pt; font-weight: bold; text-align: center; margin-bottom: 3mm; }}
  .field {{ margin: 1mm 0; }}
  .row-2col {{ display: flex; gap: 4mm; }}
  .row-2col > * {{ flex: 1; }}
  .lbl {{ font-size: 8pt; color: #555; }}
  .val {{ font-size: 10pt; font-weight: bold; }}
  .big {{ font-size: 22pt; font-weight: 900; line-height: 1.1; }}
  .small .lbl {{ font-size: 7.5pt; }}
  .small .val {{ font-size: 8.5pt; }}
  .barcode-wrap {{ text-align: center; margin-top: 3mm; }}
  .barcode-wrap svg {{ max-width: 100%; }}
  .no-print {{ text-align:center; margin: 12px; }}
  .no-print button {{ padding: 8px 24px; font-size: 14px; cursor: pointer; }}
</style>
</head>
<body>
<div class="no-print">
  <button onclick="window.print()">🖨️ In tem — {barcode_val}</button>
</div>
{label_html}
<script>JsBarcode(".barcode").init();</script>
</body>
</html>"""
    return html


@router.get("/giay-rolls/print/{gr_id}", response_class=HTMLResponse)
def print_giay_roll_labels(
    gr_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Trả về trang HTML in tem cho tất cả cuộn của phiếu nhập."""
    gr = db.get(GoodsReceipt, gr_id)
    if not gr:
        raise HTTPException(404, "Không tìm thấy phiếu nhập")

    rolls = (db.query(GiayRoll)
               .filter(GiayRoll.goods_receipt_id == gr_id)
               .order_by(GiayRoll.id)
               .all())
    if not rolls:
        raise HTTPException(404, "Chưa tạo tem — gọi /from-receipt trước")

    sup = db.get(Supplier, gr.supplier_id) if gr.supplier_id else None
    ten_ncc = sup.ten_viet_tat if sup else ""
    ma_ncc = sup.ma_ncc if sup and hasattr(sup, "ma_ncc") else ""

    labels_html = ""
    for roll in rolls:
        pm = roll.paper_material
        ky_hieu = pm.ma_ky_hieu if pm else ""
        kho = f"{float(pm.kho):.0f}" if pm and pm.kho else ""
        ma_chinh = pm.ma_chinh if pm else ""
        dinh_luong = f"{int(pm.dinh_luong)}" if pm and pm.dinh_luong else ""
        nvl = (pm.ten_viet_tat or "") if pm else ""
        so_kg = f"{float(roll.trong_luong_ban_dau):,.0f}"
        ngay_str = roll.ngay_nhap.strftime("%d/%m/%Y") if roll.ngay_nhap else ""
        barcode_val = roll.barcode

        # Barcode SVG via JS (sẽ render phía client)
        labels_html += f"""
        <div class="label">
          <div class="company">CÔNG TY TNHH SX TM NAM PHƯƠNG</div>
          <div class="row-2col">
            <div class="field"><div class="lbl">Ký hiệu</div><div class="val big">{ky_hieu}</div></div>
            <div class="field"><div class="lbl">Khổ Giấy</div><div class="val big">{kho}</div></div>
          </div>
          <div class="field"><div class="lbl">Số KG</div><div class="val big">{so_kg}</div></div>
          <div class="field small"><span class="lbl">Mã chính</span> <span class="val">{ma_chinh}</span></div>
          <div class="row-2col small">
            <div><span class="lbl">ĐL</span> <span class="val">{dinh_luong}</span></div>
            <div><span class="lbl">Mã NCC</span> <span class="val">{ma_ncc or ten_ncc}</span></div>
          </div>
          <div class="row-2col small">
            <div><span class="lbl">Khổ</span> <span class="val">{kho}</span></div>
            <div><span class="lbl">NVL</span> <span class="val">{nvl}</span></div>
          </div>
          <div class="row-2col small">
            <div><span class="lbl">Ngày nhập</span> <span class="val">{ngay_str}</span></div>
            <div><span class="lbl">Số phiếu</span> <span class="val">{gr.so_phieu}</span></div>
          </div>
          <div class="barcode-wrap">
            <svg class="barcode" jsbarcode-value="{barcode_val}" jsbarcode-format="CODE128"
                 jsbarcode-width="2" jsbarcode-height="40" jsbarcode-fontsize="12"
                 jsbarcode-displayvalue="true"></svg>
          </div>
        </div>"""

    html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>In tem cuộn giấy — {gr.so_phieu}</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
<style>
  @media print {{ @page {{ size: 80mm 100mm; margin: 0; }} .no-print {{ display:none; }} }}
  body {{ font-family: Arial, sans-serif; margin: 0; padding: 8px; background: #f5f5f5; }}
  .label {{
    width: 76mm; min-height: 94mm; border: 1px solid #333;
    padding: 4mm 3mm; margin: 4mm auto; background: #fff;
    page-break-after: always; box-sizing: border-box;
  }}
  .company {{ font-size: 9pt; font-weight: bold; text-align: center; margin-bottom: 3mm; }}
  .field {{ margin: 1mm 0; }}
  .row-2col {{ display: flex; gap: 4mm; }}
  .row-2col > * {{ flex: 1; }}
  .lbl {{ font-size: 8pt; color: #555; }}
  .val {{ font-size: 10pt; font-weight: bold; }}
  .big {{ font-size: 22pt; font-weight: 900; line-height: 1.1; }}
  .small .lbl {{ font-size: 7.5pt; }}
  .small .val {{ font-size: 8.5pt; }}
  .barcode-wrap {{ text-align: center; margin-top: 3mm; }}
  .barcode-wrap svg {{ max-width: 100%; }}
  .no-print {{ text-align:center; margin: 12px; }}
  .no-print button {{ padding: 8px 24px; font-size: 14px; cursor: pointer; }}
</style>
</head>
<body>
<div class="no-print">
  <button onclick="window.print()">🖨️ In {len(rolls)} tem</button>
  &nbsp;&nbsp;Phiếu: <strong>{gr.so_phieu}</strong> — {len(rolls)} cuộn
</div>
{labels_html}
<script>JsBarcode(".barcode").init();</script>
</body>
</html>"""
    return html


# ── Tồn kho giấy cuộn ────────────────────────────────────────────────────────

@router.get("/ton-kho-giay")
def ton_kho_giay(
    phan_xuong_id: Optional[int] = None,
    phap_nhan_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Tồn kho giấy cuộn — tính trực tiếp từ GiayRoll.trong_luong_con_lai để luôn chính xác."""
    from sqlalchemy import func as sql_func

    # Tính tổng KG + số cuộn còn lại, group by warehouse + paper_material
    agg = (
        db.query(
            GiayRoll.warehouse_id,
            GiayRoll.paper_material_id,
            sql_func.sum(GiayRoll.trong_luong_con_lai).label("ton_luong"),
            sql_func.count(GiayRoll.id).label("so_cuon"),
        )
        .filter(
            GiayRoll.warehouse_id.isnot(None),
            GiayRoll.paper_material_id.isnot(None),
            GiayRoll.trang_thai.in_(["trong_kho", "dang_dung"]),
        )
        .group_by(GiayRoll.warehouse_id, GiayRoll.paper_material_id)
        .all()
    )

    if not agg:
        return []

    wh_ids = {r.warehouse_id for r in agg}
    pm_ids = {r.paper_material_id for r in agg}

    wh_map: dict[int, Warehouse] = {
        wh.id: wh for wh in db.query(Warehouse).filter(Warehouse.id.in_(wh_ids)).all()
    }
    pm_map: dict[int, PaperMaterial] = {
        pm.id: pm for pm in db.query(PaperMaterial).filter(PaperMaterial.id.in_(pm_ids)).all()
    }

    px_ids = {wh.phan_xuong_id for wh in wh_map.values() if wh.phan_xuong_id}
    px_map: dict[int, PhanXuong] = {
        px.id: px for px in db.query(PhanXuong).filter(PhanXuong.id.in_(px_ids)).all()
    } if px_ids else {}

    # Lấy giá nhập gần nhất cho mỗi paper_material để ước tính giá trị tồn
    don_gia_map: dict[int, float] = {}
    for pm_id in pm_ids:
        last_item = (
            db.query(GoodsReceiptItem)
            .filter(GoodsReceiptItem.paper_material_id == pm_id)
            .order_by(GoodsReceiptItem.id.desc())
            .first()
        )
        if last_item and last_item.don_gia:
            don_gia_map[pm_id] = float(last_item.don_gia)

    result = []
    for row in agg:
        wh = wh_map.get(row.warehouse_id)
        if not wh:
            continue
        px = px_map.get(wh.phan_xuong_id) if wh.phan_xuong_id else None
        if phan_xuong_id and wh.phan_xuong_id != phan_xuong_id:
            continue
        if phap_nhan_id and (not px or px.phap_nhan_id != phap_nhan_id):
            continue
        pm = pm_map.get(row.paper_material_id)
        ton_luong = float(row.ton_luong or 0)
        don_gia = don_gia_map.get(row.paper_material_id, 0)
        result.append({
            "paper_material_id": row.paper_material_id,
            "ma_chinh": pm.ma_chinh if pm else None,
            "ma_ky_hieu": pm.ma_ky_hieu if pm else None,
            "ten": pm.ten if pm else None,
            "kho": float(pm.kho) if pm and pm.kho else None,
            "dinh_luong": int(pm.dinh_luong) if pm and pm.dinh_luong else None,
            "ton_toi_thieu": float(pm.ton_toi_thieu) if pm and pm.ton_toi_thieu else 0,
            "warehouse_id": row.warehouse_id,
            "ten_kho": wh.ten_kho,
            "phan_xuong_id": wh.phan_xuong_id,
            "ten_phan_xuong": px.ten_xuong if px else None,
            "phap_nhan_id": px.phap_nhan_id if px else None,
            "ton_luong": ton_luong,
            "so_cuon": int(row.so_cuon or 0),
            "gia_tri_ton": ton_luong * don_gia,
            "don_gia_binh_quan": don_gia,
        })

    result.sort(key=lambda x: (x["ma_chinh"] or "", x["ten_kho"] or ""))
    return result


# ── Dự trù nhu cầu giấy theo tuần ───────────────────────────────────────────

@router.get("/du-tru-giay")
def du_tru_giay(
    weeks: int = Query(4, ge=1, le=8),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Dự trù nhu cầu giấy cuộn theo rolling n tuần.
    So sánh với cùng kỳ năm trước (LSX đã hoàn thành).
    """
    from datetime import timedelta

    today = date.today()
    week_start = today - timedelta(days=today.weekday())  # Monday của tuần hiện tại
    week_periods = []
    for i in range(weeks):
        ws = week_start + timedelta(weeks=i)
        we = ws + timedelta(days=6)
        week_periods.append((ws, we))

    last_year_periods = [
        (ws - timedelta(weeks=52), we - timedelta(weeks=52))
        for ws, we in week_periods
    ]

    def _fetch_demand(trang_thai_list: list[str], date_ranges: list[tuple]) -> dict:
        """Returns {paper_material_id: [kg_w0, kg_w1, ...]} for given statuses and week ranges."""
        all_ws = date_ranges[0][0]
        all_we = date_ranges[-1][1]

        rows = (
            db.query(
                ProductionBOMItem.paper_material_id,
                func.coalesce(
                    ProductionOrderItem.ngay_giao_hang,
                    ProductionOrder.ngay_hoan_thanh_ke_hoach,
                ).label("ref_date"),
                func.sum(ProductionBOMItem.trong_luong_can_tong).label("can_kg"),
            )
            .join(ProductionBOM, ProductionBOM.id == ProductionBOMItem.bom_id)
            .join(ProductionOrderItem,
                  ProductionOrderItem.id == ProductionBOM.production_order_item_id)
            .join(ProductionOrder,
                  ProductionOrder.id == ProductionOrderItem.production_order_id)
            .filter(
                ProductionOrder.trang_thai.in_(trang_thai_list),
                ProductionBOMItem.paper_material_id.isnot(None),
                ProductionBOMItem.trong_luong_can_tong.isnot(None),
                func.coalesce(
                    ProductionOrderItem.ngay_giao_hang,
                    ProductionOrder.ngay_hoan_thanh_ke_hoach,
                ).between(all_ws, all_we),
            )
            .group_by(
                ProductionBOMItem.paper_material_id,
                func.coalesce(
                    ProductionOrderItem.ngay_giao_hang,
                    ProductionOrder.ngay_hoan_thanh_ke_hoach,
                ),
            )
            .all()
        )

        result: dict[int, list[float]] = {}
        for r in rows:
            if r.ref_date is None:
                continue
            ref = r.ref_date if isinstance(r.ref_date, date) else r.ref_date.date()
            for i, (ws, we) in enumerate(date_ranges):
                if ws <= ref <= we:
                    if r.paper_material_id not in result:
                        result[r.paper_material_id] = [0.0] * len(date_ranges)
                    result[r.paper_material_id][i] += float(r.can_kg or 0)
                    break
        return result

    # Nhu cầu từ LSX đang chạy (tuần hiện tại trở đi)
    demand_map = _fetch_demand(["moi", "da_duyet", "dang_sx"], week_periods)

    # Cùng kỳ năm trước (LSX đã hoàn thành)
    last_year_map = _fetch_demand(["hoan_thanh"], last_year_periods)

    # Tồn kho hiện tại tổng hợp theo paper_material_id
    stock_rows = (
        db.query(
            InventoryBalance.paper_material_id,
            func.sum(InventoryBalance.ton_luong).label("ton_luong"),
            func.sum(InventoryBalance.don_gia_binh_quan * InventoryBalance.ton_luong).label("weighted"),
        )
        .filter(InventoryBalance.paper_material_id.isnot(None))
        .group_by(InventoryBalance.paper_material_id)
        .all()
    )
    stock_map = {r.paper_material_id: float(r.ton_luong) for r in stock_rows}
    dpbq_map = {
        r.paper_material_id: (float(r.weighted) / float(r.ton_luong) if float(r.ton_luong) > 0 else 0)
        for r in stock_rows
    }

    all_pm_ids = set(demand_map) | set(stock_map)
    if not all_pm_ids:
        return []

    pm_map2: dict[int, PaperMaterial] = {
        pm.id: pm
        for pm in db.query(PaperMaterial).filter(PaperMaterial.id.in_(all_pm_ids)).all()
    }

    result2 = []
    for pm_id in sorted(all_pm_ids):
        pm = pm_map2.get(pm_id)
        ton_hien_tai = stock_map.get(pm_id, 0.0)
        dpbq = dpbq_map.get(pm_id, 0.0)
        ton_toi_thieu = float(pm.ton_toi_thieu) if pm and pm.ton_toi_thieu else 0.0
        week_demand = demand_map.get(pm_id, [0.0] * weeks)
        week_ly = last_year_map.get(pm_id, [0.0] * weeks)

        periods = []
        running = ton_hien_tai
        for i, (ws, we) in enumerate(week_periods):
            can_kg = week_demand[i] if i < len(week_demand) else 0.0
            ly_kg = week_ly[i] if i < len(week_ly) else 0.0
            running -= can_kg
            tang_giam_pct = (
                round((can_kg - ly_kg) / ly_kg * 100, 1) if ly_kg > 0 else None
            )
            periods.append({
                "label": f"Tuần {i + 1} ({ws.strftime('%d/%m')}–{we.strftime('%d/%m/%Y')})",
                "date_from": ws.isoformat(),
                "date_to": we.isoformat(),
                "can_kg": round(can_kg, 2),
                "ton_sau_ky": round(running, 2),
                "am": running < ton_toi_thieu,
                "cung_ky_nam_truoc_kg": round(ly_kg, 2),
                "tang_giam_pct": tang_giam_pct,
            })

        tong_can = sum(p["can_kg"] for p in periods)
        # Lượng cần mua = deficit tích lũy lớn nhất (đủ cho toàn kỳ kể cả buffer)
        min_running = min((p["ton_sau_ky"] for p in periods), default=ton_hien_tai)
        can_mua_ngay = max(0.0, round(ton_toi_thieu - min_running, 2))

        result2.append({
            "paper_material_id": pm_id,
            "ma_chinh": pm.ma_chinh if pm else None,
            "ten": pm.ten if pm else None,
            "kho": float(pm.kho) if pm and pm.kho else None,
            "dinh_luong": int(pm.dinh_luong) if pm and pm.dinh_luong else None,
            "ton_toi_thieu": ton_toi_thieu,
            "ton_hien_tai": round(ton_hien_tai, 2),
            "don_gia_binh_quan": round(dpbq, 0),
            "periods": periods,
            "tong_can_kg": round(tong_can, 2),
            "can_mua_ngay": can_mua_ngay,
            "gia_tri_can_mua": round(can_mua_ngay * dpbq, 0),
        })

    result2.sort(key=lambda x: x["ma_chinh"] or "")
    return result2


# ─────────────────────────────────────────────────────────────────────────────
# Phôi sóng mua ngoài: KHSX line đánh dấu mua_phoi_ngoai
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/khsx-can-phoi-ngoai")
def khsx_can_phoi_ngoai(
    trang_thai: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Trả về danh sách KHSX line có mua_phoi_ngoai=True (mua phôi sóng từ NCC ngoài).
    Join ProductionOrderItem để lấy đầy đủ cấu trúc giấy + kích thước thùng + QCCL.
    Default chỉ lấy line chưa hoàn thành (cho, dang_chay).
    """
    from app.models.production_plan import ProductionPlan, ProductionPlanLine

    trang_thai_list = (trang_thai or "cho,dang_chay").split(",")

    rows = (
        db.query(
            ProductionPlanLine.id.label("ppl_id"),
            ProductionPlan.so_ke_hoach,
            ProductionPlan.ngay_ke_hoach,
            ProductionPlanLine.ngay_chay,
            ProductionPlanLine.so_luong_ke_hoach,
            ProductionPlanLine.kho1,
            ProductionPlanLine.kho_giay,
            ProductionPlanLine.so_dao,
            ProductionPlanLine.kho_tt,
            ProductionOrder.so_lenh,
            ProductionOrderItem.id.label("poi_id"),
            ProductionOrderItem.ten_hang,
            # Cấu trúc giấy:
            ProductionOrderItem.so_lop, ProductionOrderItem.to_hop_song,
            ProductionOrderItem.mat, ProductionOrderItem.mat_dl,
            ProductionOrderItem.song_1, ProductionOrderItem.song_1_dl,
            ProductionOrderItem.mat_1, ProductionOrderItem.mat_1_dl,
            ProductionOrderItem.song_2, ProductionOrderItem.song_2_dl,
            ProductionOrderItem.mat_2, ProductionOrderItem.mat_2_dl,
            ProductionOrderItem.song_3, ProductionOrderItem.song_3_dl,
            ProductionOrderItem.mat_3, ProductionOrderItem.mat_3_dl,
            # Kích thước thùng:
            ProductionOrderItem.loai_thung,
            ProductionOrderItem.dai, ProductionOrderItem.rong, ProductionOrderItem.cao,
            ProductionOrderItem.dai_tt,
            # QCCL:
            ProductionOrderItem.c_tham, ProductionOrderItem.can_man,
            ProductionOrderItem.loai_lan, ProductionOrderItem.qccl,
        )
        .join(ProductionPlan, ProductionPlan.id == ProductionPlanLine.plan_id)
        .join(ProductionOrderItem,
              ProductionOrderItem.id == ProductionPlanLine.production_order_item_id)
        .join(ProductionOrder,
              ProductionOrder.id == ProductionOrderItem.production_order_id)
        .filter(
            ProductionPlanLine.mua_phoi_ngoai == True,  # noqa: E712
            ProductionPlanLine.trang_thai.in_(trang_thai_list),
        )
        .order_by(ProductionPlanLine.ngay_chay)
        .all()
    )

    # Số tấm đã đặt — từ PurchaseOrderItem có production_plan_line_id
    ordered_map: dict[int, float] = {}
    if rows:
        ppl_ids = [r.ppl_id for r in rows]
        ordered = (
            db.query(
                PurchaseOrderItem.production_plan_line_id,
                func.sum(PurchaseOrderItem.so_luong).label("da_dat"),
            )
            .join(PurchaseOrder, PurchaseOrder.id == PurchaseOrderItem.po_id)
            .filter(
                PurchaseOrderItem.production_plan_line_id.in_(ppl_ids),
                PurchaseOrder.trang_thai.in_([
                    "da_duyet", "da_gui_ncc", "dang_giao", "hoan_thanh"
                ]),
            )
            .group_by(PurchaseOrderItem.production_plan_line_id)
            .all()
        )
        ordered_map = {r.production_plan_line_id: float(r.da_dat or 0) for r in ordered}

    def _f(v):
        return float(v) if v is not None else None

    result = [
        {
            "ppl_id": r.ppl_id,
            "so_ke_hoach": r.so_ke_hoach,
            "ngay_ke_hoach": str(r.ngay_ke_hoach) if r.ngay_ke_hoach else None,
            "ngay_chay": str(r.ngay_chay) if r.ngay_chay else None,
            "so_lsx": r.so_lenh,
            "poi_id": r.poi_id,
            "ten_san_pham": r.ten_hang or "",
            "so_luong_thung": float(r.so_luong_ke_hoach or 0),
            # KHSX paper sizing:
            "kho1": _f(r.kho1),
            "kho_giay": _f(r.kho_giay),
            "so_dao": r.so_dao,
            "kho_tt": _f(r.kho_tt),
            "dai_tt": _f(r.dai_tt),
            # Cấu trúc giấy:
            "so_lop": r.so_lop, "to_hop_song": r.to_hop_song,
            "mat": r.mat, "mat_dl": _f(r.mat_dl),
            "song_1": r.song_1, "song_1_dl": _f(r.song_1_dl),
            "mat_1": r.mat_1, "mat_1_dl": _f(r.mat_1_dl),
            "song_2": r.song_2, "song_2_dl": _f(r.song_2_dl),
            "mat_2": r.mat_2, "mat_2_dl": _f(r.mat_2_dl),
            "song_3": r.song_3, "song_3_dl": _f(r.song_3_dl),
            "mat_3": r.mat_3, "mat_3_dl": _f(r.mat_3_dl),
            # Kích thước thùng:
            "loai_thung": r.loai_thung,
            "dai": _f(r.dai), "rong": _f(r.rong), "cao": _f(r.cao),
            # QCCL:
            "c_tham": r.c_tham, "can_man": r.can_man,
            "loai_lan": r.loai_lan, "qccl": r.qccl,
            # Số tấm đã đặt:
            "da_dat_so_tam": ordered_map.get(r.ppl_id, 0.0),
            "nguon": "khsx",
        }
        for r in rows
    ]

    # Thêm: lệnh SX có mua_phoi_ngoai=True trên ProductionOrderItem nhưng chưa có plan line
    from app.models.production import ProductionOrder as _PO, ProductionOrderItem as _POI
    from sqlalchemy import exists, select as _select
    poi_rows = (
        db.query(_POI, _PO.so_lenh)
        .join(_PO, _PO.id == _POI.production_order_id)
        .filter(
            _POI.mua_phoi_ngoai == True,  # noqa: E712
            _PO.trang_thai == "mua_ngoai",
            ~exists(_select(ProductionPlanLine.id).where(
                ProductionPlanLine.production_order_item_id == _POI.id
            )),
        )
        .all()
    )
    for poi, so_lenh in poi_rows:
        result.append({
            "ppl_id": None,
            "so_ke_hoach": None,
            "ngay_ke_hoach": None,
            "ngay_chay": None,
            "so_lsx": so_lenh,
            "poi_id": poi.id,
            "ten_san_pham": poi.ten_hang or "",
            "so_luong_thung": float(poi.so_luong_ke_hoach or 0),
            "kho1": None,
            "kho_giay": None,
            "so_dao": None,
            "kho_tt": _f(poi.kho_tt),
            "dai_tt": _f(poi.dai_tt),
            "so_lop": poi.so_lop, "to_hop_song": poi.to_hop_song,
            "mat": poi.mat, "mat_dl": _f(poi.mat_dl),
            "song_1": poi.song_1, "song_1_dl": _f(poi.song_1_dl),
            "mat_1": poi.mat_1, "mat_1_dl": _f(poi.mat_1_dl),
            "song_2": poi.song_2, "song_2_dl": _f(poi.song_2_dl),
            "mat_2": poi.mat_2, "mat_2_dl": _f(poi.mat_2_dl),
            "song_3": poi.song_3, "song_3_dl": _f(poi.song_3_dl),
            "mat_3": poi.mat_3, "mat_3_dl": _f(poi.mat_3_dl),
            "loai_thung": poi.loai_thung,
            "dai": _f(poi.dai), "rong": _f(poi.rong), "cao": _f(poi.cao),
            "c_tham": poi.c_tham, "can_man": poi.can_man,
            "loai_lan": poi.loai_lan, "qccl": poi.qccl,
            "da_dat_so_tam": 0.0,
            "nguon": "lenh_sx",
        })

    return result
