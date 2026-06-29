import html as _html_mod
import io
from datetime import date, datetime, timezone
from decimal import Decimal
from io import BytesIO
from typing import Literal, Optional
import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import HTMLResponse, StreamingResponse
from openpyxl import Workbook
from pydantic import BaseModel, Field
from sqlalchemy import and_, desc, func, or_, text as _text
from sqlalchemy.orm import Session, aliased, joinedload, selectinload
from app.database import get_db
from app.deps import get_current_user, require_permissions, require_roles
from app.models.auth import User
from app.models.inventory import InventoryBalance, InventoryTransaction
from app.models.master import Warehouse, PaperMaterial, OtherMaterial, Product, PhanXuong, PhapNhan, Supplier, Customer, DonGiaVanChuyen
from app.models.purchase import PurchaseOrder, PurchaseOrderItem, PurchaseReturn
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.bom import ProductionBOM, ProductionBOMItem
from app.models.sales import SalesOrder, SalesOrderItem, SalesReturn, SalesReturnItem
from app.models.billing import SalesInvoice, InvoiceAdjustmentLog
from app.models.accounting import PurchaseInvoice, JournalEntry
from app.models.quality import QCGiayCuonPhieu
from app.models.warehouse_doc import (
    GoodsReceipt, GoodsReceiptItem,
    MaterialIssue, MaterialIssueItem,
    ProductionOutput,
    DeliveryOrder, DeliveryOrderItem,
    PhieuChuyenKho, PhieuChuyenKhoItem,
    StockAdjustment, StockAdjustmentItem,
)
from app.models.inventory import PaperRoll as GiayRoll
from app.models.yeu_cau_giao_hang import YeuCauGiaoHang
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.cd2 import PhieuIn
from app.services.accounting_service import AccountingService
from app.services.carton_metrics import production_item_metrics
from app.services.excel_import_service import (
    ImportField, build_template_response, import_excel, parse_bool, parse_decimal, parse_text,
)
from app.models.system import PrintTemplate, SystemSetting
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
    so_luong: Optional[Decimal] = Field(Decimal("0"), ge=0)
    dvt: str = "Kg"
    don_gia: Decimal = Field(Decimal("0"), ge=0)
    dinh_luong_thuc_te: Optional[Decimal] = None
    do_am: Optional[Decimal] = None
    ket_qua_kiem_tra: str = "DAT"
    kho_mm: Optional[Decimal] = None
    so_cuon: Optional[int] = Field(None, ge=0)
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
    loai_nhap: Literal["MUA_HANG", "PHOI_NGOAI"] = "MUA_HANG"
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
    so_luong_ke_hoach: Decimal = Field(Decimal("0"), ge=0)
    so_luong_thuc_xuat: Decimal = Field(..., gt=0)
    dvt: str = "Kg"
    don_gia: Decimal = Field(Decimal("0"), ge=0)
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
    so_luong_nhap: Decimal = Field(..., gt=0)
    so_luong_loi: Decimal = Field(Decimal("0"), ge=0)
    dvt: str = "Thùng"
    don_gia_xuat_xuong: Decimal = Field(Decimal("0"), ge=0)
    production_session_id: Optional[int] = None  # nếu truyền → auto-fill don_gia_xuat_xuong từ phiên
    ghi_chu: Optional[str] = None


class DeliveryOrderItemIn(BaseModel):
    production_order_id: Optional[int] = None
    sales_order_item_id: Optional[int] = None
    product_id: Optional[int] = None
    ten_hang: str = ""
    so_luong: Decimal = Field(..., gt=0)
    dvt: str = "Thùng"
    dien_tich: Optional[Decimal] = None
    trong_luong: Optional[Decimal] = None
    the_tich: Optional[Decimal] = None
    don_gia: Optional[Decimal] = Field(None, ge=0)
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
    product_id: Optional[int] = None  # BTP/TP transfer giữa xưởng
    ten_hang: str = ""
    don_vi: str = "Kg"
    so_luong: Decimal = Field(..., gt=0)
    don_gia: Decimal = Field(Decimal("0"), ge=0)
    ghi_chu: Optional[str] = None


class PhieuChuyenIn(BaseModel):
    warehouse_xuat_id: int
    warehouse_nhap_id: int
    ngay: date
    ghi_chu: Optional[str] = None
    items: list[PhieuChuyenItemIn]
    auto_approve: bool = False


class StockAdjustmentItemIn(BaseModel):
    inventory_balance_id: int
    so_luong_thuc_te: Decimal = Field(..., ge=0)
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
    ymd = datetime.today().strftime("%Y%m%d")
    pattern = f"{prefix}-{ymd}-%"
    last_row = (
        db.query(model_cls)
        .filter(model_cls.so_phieu.like(pattern))
        .order_by(desc(model_cls.so_phieu))
        .with_for_update()
        .first()
    )
    seq = 1
    if last_row:
        try:
            seq = int(last_row.so_phieu.rsplit("-", 1)[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    return f"{prefix}-{ymd}-{seq:03d}"


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
    loai_kho: Optional[str] = Query(None),  # filter by Warehouse.loai_kho e.g. "TAN_DUNG"
    search: Optional[str] = Query(None),
    show_zero: bool = Query(False),  # include rows with ton_luong = 0
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = (db.query(InventoryBalance)
         .join(Warehouse, Warehouse.id == InventoryBalance.warehouse_id))
    if not show_zero:
        q = q.filter(InventoryBalance.ton_luong > 0)

    if warehouse_id:
        q = q.filter(InventoryBalance.warehouse_id == warehouse_id)
    if phan_xuong_id:
        q = q.filter(Warehouse.phan_xuong_id == phan_xuong_id)
    if phap_nhan_id:
        q = q.join(PhanXuong, Warehouse.phan_xuong_id == PhanXuong.id).filter(PhanXuong.phap_nhan_id == phap_nhan_id)
    if loai_kho:
        q = q.filter(Warehouse.loai_kho == loai_kho)
    if loai == "tp":
        q = q.filter(InventoryBalance.product_id.isnot(None))
    elif loai in ("nvl", "giay"):
        q = q.filter(InventoryBalance.paper_material_id.isnot(None))
    elif loai == "khac":
        q = q.filter(InventoryBalance.other_material_id.isnot(None))

    rows = q.all()

    # Batch-load NSX, ngay_nhap_gan_nhat, so_cuon — tránh N+1 per paper material
    pm_ids_set = [r.paper_material_id for r in rows if r.paper_material_id]
    ten_nsx_map: dict[int, str | None] = {}
    nhap_date_map: dict[int, str | None] = {}
    so_cuon_map: dict[int, int] = {}
    if pm_ids_set:
        pm_nsx_rows = (
            db.query(PaperMaterial.id, Supplier.ten_viet_tat)
            .outerjoin(Supplier, PaperMaterial.ma_nsx_id == Supplier.id)
            .filter(PaperMaterial.id.in_(pm_ids_set))
            .all()
        )
        ten_nsx_map = {pm_id: ten for pm_id, ten in pm_nsx_rows}

        nhap_q = (
            db.query(
                GoodsReceiptItem.paper_material_id,
                func.max(GoodsReceipt.ngay_nhap).label("max_ngay"),
            )
            .join(GoodsReceipt, GoodsReceiptItem.receipt_id == GoodsReceipt.id)
            .filter(
                GoodsReceiptItem.paper_material_id.in_(pm_ids_set),
                GoodsReceipt.trang_thai == "da_duyet",
            )
            .group_by(GoodsReceiptItem.paper_material_id)
            .all()
        )
        nhap_date_map = {
            r.paper_material_id: r.max_ngay.isoformat() if r.max_ngay else None
            for r in nhap_q
        }

        cuon_rows = (
            db.query(GiayRoll.paper_material_id, func.count(GiayRoll.id).label("n"))
            .filter(
                GiayRoll.paper_material_id.in_(pm_ids_set),
                GiayRoll.trang_thai == "trong_kho",
            )
            .group_by(GiayRoll.paper_material_id)
            .all()
        )
        so_cuon_map = {r.paper_material_id: r.n for r in cuon_rows}

    result = []
    for r in rows:
        ten_hang = r.ten_hang or ""
        don_vi = r.don_vi or ""
        ton_toi_thieu = 0.0
        ma_chinh = None
        ma_ky_hieu = None
        loai_giay = None
        kho_mm = None
        dinh_luong = None

        if r.paper_material_id:
            mat = db.get(PaperMaterial, r.paper_material_id)
            if mat:
                ten_hang = mat.ten
                don_vi = mat.dvt or ""
                ton_toi_thieu = float(mat.ton_toi_thieu or 0)
                ma_chinh = mat.ma_chinh
                ma_ky_hieu = mat.ma_ky_hieu
                loai_giay = mat.loai_giay
                kho_mm = float(mat.kho) if mat.kho else None
                dinh_luong = float(mat.dinh_luong) if mat.dinh_luong else None
        elif r.other_material_id:
            mat = db.get(OtherMaterial, r.other_material_id)
            if mat:
                ten_hang = mat.ten
                don_vi = mat.dvt or ""
                ton_toi_thieu = float(mat.ton_toi_thieu or 0)
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
            # Giấy cuộn specific
            "ma_chinh": ma_chinh,
            "ma_ky_hieu": ma_ky_hieu,
            "loai_giay": loai_giay,
            "kho_mm": kho_mm,
            "dinh_luong": dinh_luong,
            "bien_dong": (float(r.ton_luong) - float(r.ton_luong_truoc)) if r.ton_luong_truoc is not None else None,
            "ten_nsx": ten_nsx_map.get(r.paper_material_id) if r.paper_material_id else None,
            "ngay_nhap_gan_nhat": nhap_date_map.get(r.paper_material_id) if r.paper_material_id else None,
            "so_cuon": so_cuon_map.get(r.paper_material_id) if r.paper_material_id else None,
        })
    return result


@router.get("/ton-kho-tan-dung")
def get_ton_kho_tan_dung(
    phan_xuong_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Tồn kho phôi tận dụng — có thêm thông tin sóng giấy và định lượng từ LSX gốc."""
    q = (
        db.query(InventoryBalance, Warehouse, PhanXuong)
        .join(Warehouse, Warehouse.id == InventoryBalance.warehouse_id)
        .outerjoin(PhanXuong, PhanXuong.id == Warehouse.phan_xuong_id)
        .filter(Warehouse.loai_kho == "TAN_DUNG", InventoryBalance.ton_luong > 0)
    )
    if phan_xuong_id:
        q = q.filter(Warehouse.phan_xuong_id == phan_xuong_id)
    rows = q.all()

    if not rows:
        return []

    wh_ids = list({wh.id for _, wh, _ in rows})

    # Lấy ProductionOrderItem từ phiếu nhập phôi dư gần nhất per kho
    recent_tx_sub = (
        db.query(
            InventoryTransaction.warehouse_id,
            func.max(InventoryTransaction.id).label("max_id"),
        )
        .filter(
            InventoryTransaction.loai_giao_dich == "NHAP_PHOI_DU",
            InventoryTransaction.chung_tu_loai == "phieu_nhap_phoi_song",
            InventoryTransaction.warehouse_id.in_(wh_ids),
        )
        .group_by(InventoryTransaction.warehouse_id)
        .subquery()
    )

    song_rows = (
        db.query(
            InventoryTransaction.warehouse_id,
            ProductionOrderItem.so_lop,
            ProductionOrderItem.to_hop_song,
            ProductionOrderItem.mat_dl,
            ProductionOrderItem.song_1_dl,
            ProductionOrderItem.mat_1_dl,
            ProductionOrderItem.song_2_dl,
            ProductionOrderItem.mat_2_dl,
            ProductionOrderItem.song_3_dl,
            ProductionOrderItem.mat_3_dl,
        )
        .join(recent_tx_sub, and_(
            InventoryTransaction.warehouse_id == recent_tx_sub.c.warehouse_id,
            InventoryTransaction.id == recent_tx_sub.c.max_id,
        ))
        .join(PhieuNhapPhoiSong, and_(
            InventoryTransaction.chung_tu_loai == "phieu_nhap_phoi_song",
            InventoryTransaction.chung_tu_id == PhieuNhapPhoiSong.id,
        ))
        .join(PhieuNhapPhoiSongItem, PhieuNhapPhoiSongItem.phieu_id == PhieuNhapPhoiSong.id)
        .join(ProductionOrderItem, ProductionOrderItem.id == PhieuNhapPhoiSongItem.production_order_item_id)
        .all()
    )

    # Khi có nhiều items/phiếu → lấy dòng đầu tiên per warehouse
    song_map: dict[int, dict] = {}
    for s in song_rows:
        if s.warehouse_id not in song_map:
            song_map[s.warehouse_id] = {
                "so_lop": s.so_lop,
                "to_hop_song": s.to_hop_song,
                "mat_dl": float(s.mat_dl) if s.mat_dl else None,
                "song_1_dl": float(s.song_1_dl) if s.song_1_dl else None,
                "mat_1_dl": float(s.mat_1_dl) if s.mat_1_dl else None,
                "song_2_dl": float(s.song_2_dl) if s.song_2_dl else None,
                "mat_2_dl": float(s.mat_2_dl) if s.mat_2_dl else None,
                "song_3_dl": float(s.song_3_dl) if s.song_3_dl else None,
                "mat_3_dl": float(s.mat_3_dl) if s.mat_3_dl else None,
            }

    result = []
    for bal, wh, px in rows:
        song = song_map.get(wh.id, {})
        result.append({
            "id": bal.id,
            "warehouse_id": wh.id,
            "ten_kho": wh.ten_kho,
            "phan_xuong_id": wh.phan_xuong_id,
            "ten_phan_xuong": px.ten_xuong if px else None,
            "ten_hang": bal.ten_hang,
            "don_vi": bal.don_vi or "Tấm",
            "ton_luong": float(bal.ton_luong),
            "cap_nhat_luc": bal.cap_nhat_luc.isoformat() if bal.cap_nhat_luc else None,
            **song,
        })
    return result


@router.get("/ton-kho/summary")
def get_ton_kho_summary(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Dashboard summary: breakdown by loai_kho + warehouse, low-stock count."""
    from decimal import Decimal

    rows = (db.query(InventoryBalance, Warehouse)
            .join(Warehouse, Warehouse.id == InventoryBalance.warehouse_id)
            .filter(InventoryBalance.ton_luong > 0)
            .all())

    # Batch-load materials to avoid N+1
    pm_ids = {r.InventoryBalance.paper_material_id for r in rows if r.InventoryBalance.paper_material_id}
    om_ids = {r.InventoryBalance.other_material_id for r in rows if r.InventoryBalance.other_material_id}
    pm_map = {m.id: m for m in db.query(PaperMaterial).filter(PaperMaterial.id.in_(pm_ids))} if pm_ids else {}
    om_map = {m.id: m for m in db.query(OtherMaterial).filter(OtherMaterial.id.in_(om_ids))} if om_ids else {}

    by_loai: dict[str, dict] = {}
    by_warehouse: list[dict] = []
    warehouse_map: dict[int, dict] = {}
    low_stock: list[dict] = []

    for row_pair in rows:
        r, wh = row_pair.InventoryBalance, row_pair.Warehouse
        loai_kho = wh.loai_kho or "KHAC"
        ton = float(r.ton_luong)
        gia_tri = float(r.gia_tri_ton)

        if loai_kho not in by_loai:
            by_loai[loai_kho] = {"loai_kho": loai_kho, "gia_tri": 0.0, "so_mat_hang": 0}
        by_loai[loai_kho]["gia_tri"] += gia_tri
        by_loai[loai_kho]["so_mat_hang"] += 1

        wid = r.warehouse_id
        if wid not in warehouse_map:
            warehouse_map[wid] = {"warehouse_id": wid, "ten_kho": wh.ten_kho, "gia_tri": 0.0, "so_mat_hang": 0}
        warehouse_map[wid]["gia_tri"] += gia_tri
        warehouse_map[wid]["so_mat_hang"] += 1

        ton_toi_thieu = 0.0
        ten_hang = r.ten_hang or ""
        if r.paper_material_id and r.paper_material_id in pm_map:
            mat = pm_map[r.paper_material_id]
            ten_hang = mat.ten
            ton_toi_thieu = float(mat.ton_toi_thieu or 0)
        elif r.other_material_id and r.other_material_id in om_map:
            mat = om_map[r.other_material_id]
            ten_hang = mat.ten
            ton_toi_thieu = float(mat.ton_toi_thieu or 0)

        if ton_toi_thieu > 0 and ton < ton_toi_thieu:
            low_stock.append({
                "id": r.id,
                "ten_hang": ten_hang,
                "ten_kho": wh.ten_kho,
                "ton_luong": ton,
                "ton_toi_thieu": ton_toi_thieu,
                "don_vi": r.don_vi or "",
                "pct": round(ton / ton_toi_thieu * 100, 1),
            })

    by_warehouse_list = sorted(warehouse_map.values(), key=lambda x: -x["gia_tri"])[:12]
    low_stock.sort(key=lambda x: x["pct"])

    total_gia_tri = sum(v["gia_tri"] for v in by_loai.values())
    total_mat_hang = sum(v["so_mat_hang"] for v in by_loai.values())

    return {
        "total_gia_tri": total_gia_tri,
        "total_mat_hang": total_mat_hang,
        "low_stock_count": len(low_stock),
        "by_loai": list(by_loai.values()),
        "by_warehouse": by_warehouse_list,
        "low_stock": low_stock[:20],
    }


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
                # Lưu giá trị cũ trước khi overwrite (dùng để tính biến động)
                existing.ton_luong_truoc = existing.ton_luong
                for k, v in vals.items():
                    setattr(existing, k, v)
            else:
                db.add(InventoryBalance(**vals))
        db.commit()

    updated = sum(1 for s in rows if s["status"] == "update")
    created = sum(1 for s in rows if s["status"] == "create")
    return {"commit": commit, "total": len(rows), "created": created, "updated": updated, "skipped": 0, "errors": errors_count, "rows": rows[:200]}


@router.post("/ton-kho/snapshot")
def chup_snapshot_ton_kho(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Chụp snapshot tồn kho hiện tại — dùng làm điểm so sánh biến động."""
    balances = db.query(InventoryBalance).all()
    for bal in balances:
        bal.ton_luong_truoc = bal.ton_luong
    db.commit()
    return {"snapped": len(balances)}


_LOAI_KHO_TO_HANG: dict[str, str] = {
    "GIAY_CUON": "giay",
    "NVL_PHU": "nvl",
    "THANH_PHAM": "tp",
    "PHOI": "tp",
}


@router.get("/inventory/import-template")
def download_inventory_import_template(
    warehouse_id: int = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    wh = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not wh:
        raise HTTPException(404, "Kho khong ton tai")

    loai_hang_hint = _LOAI_KHO_TO_HANG.get(wh.loai_kho, "giay | nvl | tp")
    fixed_loai = loai_hang_hint if loai_hang_hint in ("giay", "nvl", "tp") else None

    fields: list[ImportField] = []
    if not fixed_loai:
        fields.append(ImportField("loai_hang", "Loai hang", required=True, parser=parse_text,
                                  help_text="giay | nvl | tp"))
    fields += [
        ImportField("ma_hang",  "Ma hang",  required=True,  parser=parse_text,    help_text="Ma chinh vat tu giay/NVL hoac Ma AMIS san pham"),
        ImportField("so_luong", "So luong", required=True,  parser=parse_decimal, help_text="Ton luong dau ky"),
        ImportField("don_gia",  "Don gia",  parser=parse_decimal, default=0,       help_text="Don gia binh quan (de trong neu chua co)"),
        ImportField("don_vi",   "Don vi",   parser=parse_text,                     help_text="Don vi tinh (de trong se lay tu danh muc)"),
    ]

    wb = Workbook()
    ws = wb.active
    ws.title = "Du lieu import"
    headers = [f.label for f in fields]
    if fixed_loai:
        headers.insert(0, "Kho")
        ws.append(headers)
        ws.append([wh.ma_kho] + ["" for _ in fields])
    else:
        ws.append(headers)
        ws.append(["" for _ in fields])

    guide = wb.create_sheet("Huong dan")
    guide.append(["Kho", wh.ma_kho, wh.ten_kho if hasattr(wh, "ten_kho") else ""])
    if fixed_loai:
        guide.append(["Loai hang (tu dong)", fixed_loai, f"Toan bo du lieu trong kho nay la loai '{fixed_loai}'"])
    guide.append(["", "", ""])
    guide.append(["Cot", "Bat buoc", "Ghi chu"])
    for f in fields:
        guide.append([f.label, "Co" if f.required else "Khong", f.help_text])

    for sheet in wb.worksheets:
        for col in sheet.columns:
            width = max(len(str(cell.value or "")) for cell in col) + 2
            sheet.column_dimensions[col[0].column_letter].width = min(max(width, 12), 42)

    stream = BytesIO()
    wb.save(stream)
    stream.seek(0)
    fname = f"mau_import_ton_kho_{wh.ma_kho}.xlsx"
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@router.post("/inventory/import")
async def import_inventory_by_warehouse(
    warehouse_id: int = Query(...),
    commit: bool = Query(default=False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("inventory.import")),
):
    wh = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not wh:
        raise HTTPException(404, "Kho khong ton tai")

    fixed_loai = _LOAI_KHO_TO_HANG.get(wh.loai_kho)

    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Chi chap nhan file Excel .xlsx/.xls")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "File rong")
    df = pd.read_excel(io.BytesIO(raw), dtype=object)

    rows: list[dict] = []
    errors_count = 0
    objects_to_save: list[tuple] = []

    for idx, src in df.iterrows():
        row_no = int(idx) + 2
        errs: list[str] = []

        loai_hang = fixed_loai or str(src.get("Loai hang", "") or "").strip().lower()
        ma_hang   = str(src.get("Ma hang",   "") or "").strip()
        so_luong_raw = src.get("So luong")
        don_gia_raw  = src.get("Don gia")
        don_vi_raw   = str(src.get("Don vi",   "") or "").strip() or None

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

        paper_material_id = other_material_id = product_id = None
        resolved_don_vi = don_vi_raw

        if not errs and ma_hang:
            if loai_hang == "giay":
                mat = db.query(PaperMaterial).filter(PaperMaterial.ma_chinh == ma_hang).first()
                if not mat:
                    errs.append(f"Ma hang: khong tim thay vat tu giay '{ma_hang}'")
                else:
                    paper_material_id = mat.id
                    resolved_don_vi = resolved_don_vi or mat.dvt
            elif loai_hang == "nvl":
                mat = db.query(OtherMaterial).filter(OtherMaterial.ma_chinh == ma_hang).first()
                if not mat:
                    errs.append(f"Ma hang: khong tim thay NVL '{ma_hang}'")
                else:
                    other_material_id = mat.id
                    resolved_don_vi = resolved_don_vi or mat.dvt
            elif loai_hang == "tp":
                prod = db.query(Product).filter(
                    (Product.ma_amis == ma_hang) | (Product.ma_hang == ma_hang)
                ).first()
                if not prod:
                    errs.append(f"Ma hang: khong tim thay san pham '{ma_hang}'")
                else:
                    product_id = prod.id
                    resolved_don_vi = resolved_don_vi or getattr(prod, "dvt", "Thung") or "Thung"

        if errs:
            errors_count += 1
            rows.append({"row": row_no, "status": "error", "errors": errs, "data": {}})
            continue

        gia_tri = (so_luong or Decimal("0")) * (don_gia or Decimal("0"))
        bal_q = db.query(InventoryBalance).filter(InventoryBalance.warehouse_id == wh.id)
        if loai_hang == "giay":
            bal_q = bal_q.filter(InventoryBalance.paper_material_id == paper_material_id)
        elif loai_hang == "nvl":
            bal_q = bal_q.filter(InventoryBalance.other_material_id == other_material_id)
        else:
            bal_q = bal_q.filter(InventoryBalance.product_id == product_id)
        existing = bal_q.first()

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
        rows.append({"row": row_no, "status": status, "errors": [], "data": {"ma_hang": ma_hang, "so_luong": str(so_luong)}})

    if commit and errors_count == 0:
        from app.models.import_log import ImportLog
        for existing, vals in objects_to_save:
            if existing:
                for k, v in vals.items():
                    setattr(existing, k, v)
            else:
                db.add(InventoryBalance(**vals))
        log = ImportLog(
            user_id=current_user.id,
            ten_nguoi_import=current_user.full_name or current_user.username,
            loai_du_lieu="inventory",
            ten_file=file.filename,
            so_dong_thanh_cong=len(objects_to_save),
            so_dong_loi=0,
            trang_thai="success",
        )
        db.add(log)
        db.commit()

    updated = sum(1 for s in rows if s["status"] == "update")
    created = sum(1 for s in rows if s["status"] == "create")
    return {"commit": commit, "total": len(rows), "created": created, "updated": updated, "skipped": 0, "errors": errors_count, "rows": rows[:200]}
