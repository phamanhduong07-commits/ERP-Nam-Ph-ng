from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.master import Supplier, PaperMaterial, OtherMaterial, PhanXuong, PhapNhan
from app.models.purchase import PurchaseOrder, PurchaseOrderItem
from app.models.warehouse_doc import GoodsReceipt, GoodsReceiptItem
from app.models.inventory import InventoryBalance, InventoryTransaction
from app.models.accounting import PurchaseInvoice
from app.deps import get_current_user, require_permissions
from app.models.auth import User
from fastapi import File, UploadFile
from app.services.purchase_order_import_service import import_purchase_orders_excel
from app.services.excel_import_service import build_template_response, ImportField

PURCHASE_ORDER_IMPORT_FIELDS = [
    ImportField("so_po", "So PO", required=True, help_text="VD: PO-202405-001"),
    ImportField("ngay_po", "Ngay PO", required=True, help_text="DD/MM/YYYY"),
    ImportField("ma_ncc", "Ma NCC", required=True, help_text="Phai ton tai trong danh muc"),
    ImportField("ma_vt", "Ma VT", required=True, help_text="Ma chinh (Giay) hoac Ma VT (Khac)"),
    ImportField("ten_hang", "Ten hang", help_text="De trong neu lay theo ma VT"),
    ImportField("so_luong", "So luong", required=True),
    ImportField("don_gia", "Don gia", required=True),
    ImportField("dvt", "DVT"),
    ImportField("ghi_chu", "Ghi chu"),
]


router = APIRouter(prefix="/api/purchase-orders", tags=["purchase-orders"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class POItemCreate(BaseModel):
    paper_material_id: Optional[int] = None
    other_material_id: Optional[int] = None
    ten_hang: str = ""
    so_luong: Decimal
    dvt: str = "Kg"
    don_gia: Decimal = Decimal("0")
    ghi_chu: Optional[str] = None
    kho_mm: Optional[Decimal] = None
    so_cuon: Optional[int] = None
    ky_hieu_cuon: Optional[str] = None
    # Phôi sóng mua ngoài
    production_plan_line_id: Optional[int] = None
    phoi_spec: Optional[dict] = None


class POCreate(BaseModel):
    supplier_id: int
    ngay_po: date
    phan_xuong_id: Optional[int] = None
    phap_nhan_id: Optional[int] = None
    loai_po: str = "chung"
    ngay_du_kien_nhan: Optional[date] = None
    dieu_khoan_tt: Optional[str] = None
    ghi_chu: Optional[str] = None
    items: list[POItemCreate]


class POUpdate(BaseModel):
    phan_xuong_id: Optional[int] = None
    phap_nhan_id: Optional[int] = None
    loai_po: Optional[str] = None
    ngay_du_kien_nhan: Optional[date] = None
    dieu_khoan_tt: Optional[str] = None
    ghi_chu: Optional[str] = None
    items: Optional[list[POItemCreate]] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _gen_so_po(db: Session) -> str:
    ym = datetime.today().strftime("%Y%m")
    pattern = f"PO-{ym}-%"
    last = db.query(func.max(PurchaseOrder.so_po)).filter(
        PurchaseOrder.so_po.like(pattern)
    ).scalar()
    seq = 1
    if last:
        try:
            seq = int(last.rsplit("-", 1)[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    return f"PO-{ym}-{seq:04d}"


def _resolve_ten_hang(item: POItemCreate, db: Session) -> str:
    if item.ten_hang:
        return item.ten_hang
    if item.paper_material_id:
        pm = db.get(PaperMaterial, item.paper_material_id)
        return pm.ten if pm else ""
    if item.other_material_id:
        om = db.get(OtherMaterial, item.other_material_id)
        return om.ten if om else ""
    return ""


def _px_info(po: PurchaseOrder, db: Session) -> tuple[int | None, str | None, str | None]:
    """Returns (phan_xuong_id, ten_phan_xuong, ten_phap_nhan)."""
    if not po.phan_xuong_id:
        pn = db.get(PhapNhan, po.phap_nhan_id) if getattr(po, "phap_nhan_id", None) else None
        return None, None, pn.ten_phap_nhan if pn else None
    px = db.get(PhanXuong, po.phan_xuong_id)
    if not px:
        return po.phan_xuong_id, None, None
    ten_phap_nhan = px.phap_nhan.ten_phap_nhan if px.phap_nhan else None
    return px.id, px.ten_xuong, ten_phap_nhan


def _resolve_phap_nhan_id(db: Session, phan_xuong_id: int | None, phap_nhan_id: int | None) -> int | None:
    if phap_nhan_id:
        if not db.get(PhapNhan, phap_nhan_id):
            raise HTTPException(400, "Pháp nhân không tồn tại")
        return phap_nhan_id
    if phan_xuong_id:
        px = db.get(PhanXuong, phan_xuong_id)
        if not px:
            raise HTTPException(400, "Xưởng không tồn tại")
        return px.phap_nhan_id
    return None


def _po_to_dict(po: PurchaseOrder, db: Session) -> dict:
    sup = db.get(Supplier, po.supplier_id)
    px_id, ten_px, ten_pn = _px_info(po, db)
    items = []
    for it in po.items:
        ten = it.ten_hang
        if not ten and it.paper_material_id:
            pm = db.get(PaperMaterial, it.paper_material_id)
            ten = pm.ten if pm else ""
        elif not ten and it.other_material_id:
            om = db.get(OtherMaterial, it.other_material_id)
            ten = om.ten if om else ""
        items.append({
            "id": it.id,
            "paper_material_id": it.paper_material_id,
            "other_material_id": it.other_material_id,
            "production_plan_line_id": getattr(it, "production_plan_line_id", None),
            "phoi_spec": getattr(it, "phoi_spec", None),
            "ten_hang": ten,
            "so_luong": float(it.so_luong),
            "dvt": it.dvt,
            "don_gia": float(it.don_gia),
            "thanh_tien": float(it.thanh_tien),
            "so_luong_da_nhan": float(it.so_luong_da_nhan),
            "so_cuon_da_nhan": getattr(it, "so_cuon_da_nhan", 0) or 0,
            "ghi_chu": it.ghi_chu,
            "kho_mm": float(it.kho_mm) if it.kho_mm else None,
            "so_cuon": it.so_cuon,
            "ky_hieu_cuon": it.ky_hieu_cuon,
        })
    return {
        "id": po.id,
        "so_po": po.so_po,
        "ngay_po": po.ngay_po.isoformat() if po.ngay_po else None,
        "supplier_id": po.supplier_id,
        "ten_ncc": sup.ten_viet_tat if sup else "",
        "trang_thai": po.trang_thai,
        "phan_xuong_id": px_id,
        "phap_nhan_id": po.phap_nhan_id,
        "ten_phan_xuong": ten_px,
        "ten_phap_nhan": ten_pn,
        "loai_po": po.loai_po or "chung",
        "ngay_du_kien_nhan": po.ngay_du_kien_nhan.isoformat() if po.ngay_du_kien_nhan else None,
        "dieu_khoan_tt": po.dieu_khoan_tt,
        "tong_tien": float(po.tong_tien),
        "ghi_chu": po.ghi_chu,
        "approved_at": po.approved_at.isoformat() if po.approved_at else None,
        "created_at": po.created_at.isoformat() if po.created_at else None,
        "items": items,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
def list_pos(
    supplier_id: Optional[int] = None,
    trang_thai: Optional[str] = None,
    tu_ngay: Optional[date] = None,
    den_ngay: Optional[date] = None,
    phan_xuong_id: Optional[int] = None,
    loai_po: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    from sqlalchemy import or_
    q = (db.query(PurchaseOrder)
         .options(
             joinedload(PurchaseOrder.items),
             joinedload(PurchaseOrder.supplier),
             joinedload(PurchaseOrder.phan_xuong).joinedload(PhanXuong.phap_nhan),
             joinedload(PurchaseOrder.phap_nhan),
         )
         .order_by(PurchaseOrder.created_at.desc()))
    if search:
        like = f"%{search}%"
        q = (q
             .outerjoin(PurchaseOrder.supplier)
             .filter(or_(
                 PurchaseOrder.so_po.ilike(like),
                 Supplier.ten_viet_tat.ilike(like),
                 Supplier.ten_don_vi.ilike(like),
             ))
             .distinct())
    if supplier_id:
        q = q.filter(PurchaseOrder.supplier_id == supplier_id)
    if trang_thai:
        q = q.filter(PurchaseOrder.trang_thai == trang_thai)
    if tu_ngay:
        q = q.filter(PurchaseOrder.ngay_po >= tu_ngay)
    if den_ngay:
        q = q.filter(PurchaseOrder.ngay_po <= den_ngay)
    if phan_xuong_id:
        q = q.filter(PurchaseOrder.phan_xuong_id == phan_xuong_id)
    if loai_po:
        q = q.filter(PurchaseOrder.loai_po == loai_po)
    pos = q.limit(500).all()
    result = []
    for po in pos:
        row = _po_to_dict(po, db)
        tong_dat = sum(it["so_luong"] for it in row["items"])
        da_nhan = sum(it["so_luong_da_nhan"] for it in row["items"])
        row["tien_do_nhan"] = round(da_nhan / tong_dat * 100, 1) if tong_dat else 0
        result.append(row)
    return result


@router.post("")
def create_po(body: POCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not db.get(Supplier, body.supplier_id):
        raise HTTPException(404, "Nhà cung cấp không tồn tại")
    if not body.items:
        raise HTTPException(400, "Phải có ít nhất 1 dòng hàng")

    so_po = _gen_so_po(db)
    phap_nhan_id = _resolve_phap_nhan_id(db, body.phan_xuong_id, body.phap_nhan_id)
    po = PurchaseOrder(
        so_po=so_po,
        ngay_po=body.ngay_po,
        supplier_id=body.supplier_id,
        phan_xuong_id=body.phan_xuong_id,
        phap_nhan_id=phap_nhan_id,
        loai_po=body.loai_po or "chung",
        ngay_du_kien_nhan=body.ngay_du_kien_nhan,
        dieu_khoan_tt=body.dieu_khoan_tt,
        ghi_chu=body.ghi_chu,
        created_by=current_user.id,
    )
    db.add(po)
    db.flush()

    tong = Decimal("0")
    for it in body.items:
        ten = _resolve_ten_hang(it, db)
        thanh_tien = it.so_luong * it.don_gia
        tong += thanh_tien
        db.add(PurchaseOrderItem(
            po_id=po.id,
            paper_material_id=it.paper_material_id,
            other_material_id=it.other_material_id,
            production_plan_line_id=it.production_plan_line_id,
            phoi_spec=it.phoi_spec,
            ten_hang=ten,
            so_luong=it.so_luong,
            dvt=it.dvt,
            don_gia=it.don_gia,
            thanh_tien=thanh_tien,
            ghi_chu=it.ghi_chu,
            kho_mm=it.kho_mm,
            so_cuon=it.so_cuon,
            ky_hieu_cuon=it.ky_hieu_cuon,
        ))

    po.tong_tien = tong
    db.commit()
    db.refresh(po)
    return _po_to_dict(po, db)


@router.get("/{po_id}")
def get_po(po_id: int, db: Session = Depends(get_db)):
    po = db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(404, "Không tìm thấy PO")
    return _po_to_dict(po, db)


@router.put("/{po_id}")
def update_po(po_id: int, body: POUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    po = db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(404, "Không tìm thấy PO")
    if po.trang_thai not in ("moi",):
        raise HTTPException(400, "Chỉ sửa được PO ở trạng thái Mới")

    if body.phan_xuong_id is not None:
        po.phan_xuong_id = body.phan_xuong_id
    if body.phap_nhan_id is not None or body.phan_xuong_id is not None:
        po.phap_nhan_id = _resolve_phap_nhan_id(db, po.phan_xuong_id, body.phap_nhan_id)
    if body.loai_po is not None:
        po.loai_po = body.loai_po
    if body.ngay_du_kien_nhan is not None:
        po.ngay_du_kien_nhan = body.ngay_du_kien_nhan
    if body.dieu_khoan_tt is not None:
        po.dieu_khoan_tt = body.dieu_khoan_tt
    if body.ghi_chu is not None:
        po.ghi_chu = body.ghi_chu

    if body.items is not None:
        for old in po.items:
            db.delete(old)
        db.flush()
        tong = Decimal("0")
        for it in body.items:
            ten = _resolve_ten_hang(it, db)
            thanh_tien = it.so_luong * it.don_gia
            tong += thanh_tien
            db.add(PurchaseOrderItem(
                po_id=po.id,
                paper_material_id=it.paper_material_id,
                other_material_id=it.other_material_id,
                production_plan_line_id=it.production_plan_line_id,
                phoi_spec=it.phoi_spec,
                ten_hang=ten,
                so_luong=it.so_luong,
                dvt=it.dvt,
                don_gia=it.don_gia,
                thanh_tien=thanh_tien,
                ghi_chu=it.ghi_chu,
                kho_mm=it.kho_mm,
                so_cuon=it.so_cuon,
                ky_hieu_cuon=it.ky_hieu_cuon,
            ))
        po.tong_tien = tong

    db.commit()
    db.refresh(po)
    return _po_to_dict(po, db)


@router.post("/{po_id}/duyet")
def duyet_po(po_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    po = db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(404, "Không tìm thấy PO")
    if po.trang_thai != "moi":
        raise HTTPException(400, "Chỉ duyệt PO ở trạng thái Mới")
    po.trang_thai = "da_duyet"
    po.approved_at = datetime.utcnow()
    po.approved_by = current_user.id
    db.commit()
    return {"ok": True, "trang_thai": po.trang_thai}


@router.post("/{po_id}/gui-ncc")
def gui_ncc_po(po_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    po = db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(404, "Không tìm thấy PO")
    if po.trang_thai != "da_duyet":
        raise HTTPException(400, "Chỉ gửi NCC khi PO đã được duyệt")
    po.trang_thai = "da_gui_ncc"
    db.commit()
    return {"ok": True, "trang_thai": po.trang_thai}


@router.post("/{po_id}/huy")
def huy_po(po_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    po = db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(404, "Không tìm thấy PO")
    if po.trang_thai == "huy":
        return {"ok": True, "trang_thai": po.trang_thai}
    if po.trang_thai == "hoan_thanh":
        raise HTTPException(400, "Không thể hủy PO đã hoàn thành")
    has_gr = db.query(GoodsReceipt).filter(
        GoodsReceipt.po_id == po_id,
        GoodsReceipt.trang_thai == "da_duyet",
    ).first()
    if has_gr:
        raise HTTPException(400, "Không thể hủy PO đã có phiếu nhập được duyệt")
    po.trang_thai = "huy"
    db.commit()
    return {"ok": True, "trang_thai": po.trang_thai}


@router.delete("/{po_id}")
def delete_po(po_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    po = db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(404, "Không tìm thấy PO")
    if po.trang_thai not in ("moi", "huy"):
        raise HTTPException(400, "Không thể xoá PO đã duyệt")
    db.delete(po)
    db.commit()
    return {"ok": True}


@router.get("/doi-soat-kho")
def doi_soat_kho(
    supplier_id: Optional[int] = None,
    tu_ngay: Optional[date] = None,
    den_ngay: Optional[date] = None,
    phan_xuong_id: Optional[int] = None,
    trang_thai: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Đối soát kho: so sánh số lượng đặt trong PO vs số lượng đã nhận theo GR.

    Trả về danh sách từng dòng PO với số lượng đặt, đã nhận, còn thiếu.
    """
    q = db.query(PurchaseOrder).order_by(PurchaseOrder.ngay_po.desc())
    if supplier_id:
        q = q.filter(PurchaseOrder.supplier_id == supplier_id)
    if phan_xuong_id:
        q = q.filter(PurchaseOrder.phan_xuong_id == phan_xuong_id)
    if trang_thai:
        q = q.filter(PurchaseOrder.trang_thai == trang_thai)
    if tu_ngay:
        q = q.filter(PurchaseOrder.ngay_po >= tu_ngay)
    if den_ngay:
        q = q.filter(PurchaseOrder.ngay_po <= den_ngay)

    pos = (q.options(
        joinedload(PurchaseOrder.items),
        joinedload(PurchaseOrder.supplier),
        joinedload(PurchaseOrder.phan_xuong).joinedload(PhanXuong.phap_nhan),
        joinedload(PurchaseOrder.phap_nhan),
    ).limit(500).all())

    # Pre-aggregate GR totals per POItem — tránh N+1 query per dòng
    all_poi_ids = [poi.id for po in pos for poi in po.items]
    gr_totals_map: dict[int, Decimal] = {}
    if all_poi_ids:
        agg = (
            db.query(GoodsReceiptItem.po_item_id, func.sum(GoodsReceiptItem.so_luong))
            .filter(GoodsReceiptItem.po_item_id.in_(all_poi_ids))
            .group_by(GoodsReceiptItem.po_item_id)
            .all()
        )
        gr_totals_map = {row[0]: row[1] or Decimal("0") for row in agg}

    rows = []
    for po in pos:
        sup = po.supplier
        px = po.phan_xuong
        pn = po.phap_nhan
        if px:
            px_id, ten_px = px.id, px.ten_xuong
            ten_pn = px.phap_nhan.ten_phap_nhan if px.phap_nhan else None
        else:
            px_id, ten_px = None, None
            ten_pn = pn.ten_phap_nhan if pn else None
        for poi in po.items:
            gr_total = gr_totals_map.get(poi.id, Decimal("0"))

            so_luong_dat = float(poi.so_luong)
            so_luong_da_nhan = float(gr_total)
            so_luong_con_lai = max(so_luong_dat - so_luong_da_nhan, 0.0)
            ty_le = round(so_luong_da_nhan / so_luong_dat * 100, 1) if so_luong_dat else 0.0

            ten_hang = poi.ten_hang
            if not ten_hang and poi.paper_material_id:
                pm = db.get(PaperMaterial, poi.paper_material_id)
                ten_hang = pm.ma_chinh if pm else ""
            if not ten_hang and poi.other_material_id:
                om = db.get(OtherMaterial, poi.other_material_id)
                ten_hang = om.ten if om else ""

            rows.append({
                "po_id": po.id,
                "so_po": po.so_po,
                "ngay_po": po.ngay_po.isoformat() if po.ngay_po else None,
                "supplier_id": po.supplier_id,
                "ten_ncc": sup.ten_viet_tat if sup else "",
                "phan_xuong_id": px_id,
                "ten_phan_xuong": ten_px,
                "ten_phap_nhan": ten_pn,
                "po_trang_thai": po.trang_thai,
                "poi_id": poi.id,
                "ten_hang": ten_hang,
                "dvt": poi.dvt,
                "don_gia": float(poi.don_gia),
                "so_luong_dat": so_luong_dat,
                "so_luong_da_nhan": so_luong_da_nhan,
                "so_luong_con_lai": so_luong_con_lai,
                "ty_le_nhan": ty_le,
                "thanh_tien_dat": float(poi.thanh_tien),
                "thanh_tien_da_nhan": round(so_luong_da_nhan * float(poi.don_gia), 2),
            })
    return rows


@router.get("/doi-soat-kho/summary")
def doi_soat_kho_summary(
    supplier_id: Optional[int] = None,
    tu_ngay: Optional[date] = None,
    den_ngay: Optional[date] = None,
    phan_xuong_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Tổng hợp đối soát kho theo nhà cung cấp."""
    q = db.query(PurchaseOrder)
    if supplier_id:
        q = q.filter(PurchaseOrder.supplier_id == supplier_id)
    if phan_xuong_id:
        q = q.filter(PurchaseOrder.phan_xuong_id == phan_xuong_id)
    if tu_ngay:
        q = q.filter(PurchaseOrder.ngay_po >= tu_ngay)
    if den_ngay:
        q = q.filter(PurchaseOrder.ngay_po <= den_ngay)

    pos = q.options(
        joinedload(PurchaseOrder.items),
        joinedload(PurchaseOrder.supplier),
    ).all()

    # Pre-aggregate GR totals — tránh N+1 query per dòng PO item
    all_poi_ids = [poi.id for po in pos for poi in po.items]
    gr_totals_map: dict[int, Decimal] = {}
    if all_poi_ids:
        agg = (
            db.query(GoodsReceiptItem.po_item_id, func.sum(GoodsReceiptItem.so_luong))
            .filter(GoodsReceiptItem.po_item_id.in_(all_poi_ids))
            .group_by(GoodsReceiptItem.po_item_id)
            .all()
        )
        gr_totals_map = {row[0]: row[1] or Decimal("0") for row in agg}

    by_supplier: dict[int, dict] = {}
    for po in pos:
        sid = po.supplier_id
        if sid not in by_supplier:
            sup = po.supplier
            by_supplier[sid] = {
                "supplier_id": sid,
                "ten_ncc": sup.ten_viet_tat if sup else "",
                "so_po_count": 0,
                "tong_dat": 0.0,
                "tong_da_nhan": 0.0,
                "tong_tien_dat": 0.0,
                "tong_tien_da_nhan": 0.0,
            }
        by_supplier[sid]["so_po_count"] += 1
        for poi in po.items:
            gr_total = gr_totals_map.get(poi.id, Decimal("0"))
            by_supplier[sid]["tong_dat"] += float(poi.so_luong)
            by_supplier[sid]["tong_da_nhan"] += float(gr_total)
            by_supplier[sid]["tong_tien_dat"] += float(poi.thanh_tien)
            by_supplier[sid]["tong_tien_da_nhan"] += float(gr_total) * float(poi.don_gia)

    result = []
    for v in by_supplier.values():
        tong_dat = v["tong_dat"]
        tong_da_nhan = v["tong_da_nhan"]
        v["tong_con_lai"] = max(tong_dat - tong_da_nhan, 0.0)
        v["ty_le_nhan"] = round(tong_da_nhan / tong_dat * 100, 1) if tong_dat else 0.0
        result.append(v)
    result.sort(key=lambda x: x["tong_tien_dat"], reverse=True)
    return result


@router.get("/du-bao-nhu-cau")
def du_bao_nhu_cau(
    thang_phan_tich: int = Query(default=3, ge=1, le=12, description="Số tháng lấy trung bình tiêu thụ"),
    thang_du_tru: int = Query(default=1, ge=1, le=6, description="Số tháng muốn đảm bảo tồn kho"),
    phan_xuong_id: Optional[int] = None,
    loai_nvl: Optional[str] = Query(default=None, description="giay_cuon | nvl_khac"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Dự báo nhu cầu mua hàng dựa trên:
    - Tồn kho thực tế (InventoryBalance)
    - Lịch sử xuất kho sản xuất (XUAT_SX transactions)
    - Lịch sử mua hàng (NHAP_MUA transactions)

    Gợi ý số lượng cần mua = max(0, TB tiêu thụ/tháng × thang_du_tru − tồn kho hiện tại)
    """
    cutoff = datetime.utcnow() - timedelta(days=30 * thang_phan_tich)

    # Aggregate consumption (XUAT_SX) per material in the analysis period
    xuat_q = (
        db.query(
            InventoryTransaction.paper_material_id,
            InventoryTransaction.other_material_id,
            func.sum(InventoryTransaction.so_luong).label("tong_xuat"),
        )
        .filter(
            InventoryTransaction.loai_giao_dich == "XUAT_SX",
            InventoryTransaction.ngay_giao_dich >= cutoff,
        )
        .group_by(
            InventoryTransaction.paper_material_id,
            InventoryTransaction.other_material_id,
        )
        .all()
    )

    # Aggregate purchases (NHAP_MUA) per material in the same period
    nhap_q = (
        db.query(
            InventoryTransaction.paper_material_id,
            InventoryTransaction.other_material_id,
            func.sum(InventoryTransaction.so_luong).label("tong_nhap"),
        )
        .filter(
            InventoryTransaction.loai_giao_dich == "NHAP_MUA",
            InventoryTransaction.ngay_giao_dich >= cutoff,
        )
        .group_by(
            InventoryTransaction.paper_material_id,
            InventoryTransaction.other_material_id,
        )
        .all()
    )
    nhap_map: dict[tuple, float] = {(r.paper_material_id, r.other_material_id): float(r.tong_nhap or 0) for r in nhap_q}

    # Aggregate current stock per material
    bal_q = (
        db.query(
            InventoryBalance.paper_material_id,
            InventoryBalance.other_material_id,
            func.sum(InventoryBalance.ton_luong).label("ton_luong"),
            func.sum(InventoryBalance.gia_tri_ton).label("gia_tri_ton"),
        )
        .group_by(InventoryBalance.paper_material_id, InventoryBalance.other_material_id)
        .all()
    )
    bal_map: dict[tuple, dict] = {
        (r.paper_material_id, r.other_material_id): {
            "ton_luong": float(r.ton_luong or 0),
            "gia_tri_ton": float(r.gia_tri_ton or 0),
        }
        for r in bal_q
    }

    rows = []
    for xuat in xuat_q:
        key = (xuat.paper_material_id, xuat.other_material_id)
        tong_xuat = float(xuat.tong_xuat or 0)
        if tong_xuat <= 0:
            continue

        avg_monthly = tong_xuat / thang_phan_tich
        bal = bal_map.get(key, {"ton_luong": 0.0, "gia_tri_ton": 0.0})
        ton_hien_tai = bal["ton_luong"]
        du_kien_can = avg_monthly * thang_du_tru
        can_mua = max(0.0, du_kien_can - ton_hien_tai)

        # Resolve material name and info
        ten_hang = ""
        ma_hang = ""
        loai = ""
        don_gia_mua = 0.0
        if xuat.paper_material_id:
            pm = db.get(PaperMaterial, xuat.paper_material_id)
            if pm:
                ten_hang = pm.ten_giay or pm.ma_chinh or ""
                ma_hang = pm.ma_chinh or ""
                loai = "giay_cuon"
        elif xuat.other_material_id:
            om = db.get(OtherMaterial, xuat.other_material_id)
            if om:
                ten_hang = om.ten or ""
                ma_hang = om.ma_vt or ""
                loai = "nvl_khac"

        if loai_nvl and loai != loai_nvl:
            continue

        # Recent average purchase price from NHAP_MUA transactions
        price_rows = (
            db.query(
                func.sum(InventoryTransaction.gia_tri).label("tv"),
                func.sum(InventoryTransaction.so_luong).label("sl"),
            )
            .filter(
                InventoryTransaction.loai_giao_dich == "NHAP_MUA",
                InventoryTransaction.paper_material_id == xuat.paper_material_id if xuat.paper_material_id else InventoryTransaction.paper_material_id.is_(None),
                InventoryTransaction.other_material_id == xuat.other_material_id if xuat.other_material_id else InventoryTransaction.other_material_id.is_(None),
                InventoryTransaction.ngay_giao_dich >= cutoff,
            )
            .first()
        )
        if price_rows and price_rows.sl and float(price_rows.sl) > 0:
            don_gia_mua = float(price_rows.tv or 0) / float(price_rows.sl)

        rows.append({
            "paper_material_id": xuat.paper_material_id,
            "other_material_id": xuat.other_material_id,
            "ma_hang": ma_hang,
            "ten_hang": ten_hang,
            "loai": loai,
            "tong_xuat_ky": tong_xuat,
            "tong_nhap_ky": nhap_map.get(key, 0.0),
            "tb_xuat_thang": round(avg_monthly, 3),
            "ton_hien_tai": ton_hien_tai,
            "gia_tri_ton": bal["gia_tri_ton"],
            "du_kien_can": round(du_kien_can, 3),
            "can_mua": round(can_mua, 3),
            "don_gia_mua_gan_nhat": round(don_gia_mua, 2),
            "uoc_tinh_tien_mua": round(can_mua * don_gia_mua, 2),
            "muc_do_uu_tien": "cao" if ton_hien_tai < avg_monthly * 0.5 else (
                "trung_binh" if ton_hien_tai < avg_monthly else "thap"
            ),
        })

    rows.sort(key=lambda x: (x["muc_do_uu_tien"] == "cao", x["can_mua"]), reverse=True)
    return rows


@router.get("/dashboard")
def purchase_dashboard(
    tu_ngay: Optional[date] = None,
    den_ngay: Optional[date] = None,
    phap_nhan_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Báo cáo quản trị mua hàng: KPI tổng hợp theo pháp nhân và theo NCC."""
    today = date.today()

    # ── Tổng PO ──────────────────────────────────────────────────────
    po_q = db.query(PurchaseOrder)
    if tu_ngay:
        po_q = po_q.filter(PurchaseOrder.ngay_po >= tu_ngay)
    if den_ngay:
        po_q = po_q.filter(PurchaseOrder.ngay_po <= den_ngay)
    if phap_nhan_id:
        po_q = po_q.filter(PurchaseOrder.phap_nhan_id == phap_nhan_id)

    # ── Tổng GR (da_duyet) ────────────────────────────────────────────
    gr_q = db.query(GoodsReceipt).filter(GoodsReceipt.trang_thai == "da_duyet")
    if tu_ngay:
        gr_q = gr_q.filter(GoodsReceipt.ngay_nhap >= tu_ngay)
    if den_ngay:
        gr_q = gr_q.filter(GoodsReceipt.ngay_nhap <= den_ngay)
    if phap_nhan_id:
        gr_q = gr_q.filter(GoodsReceipt.phap_nhan_id == phap_nhan_id)

    # ── HĐ mua hàng ───────────────────────────────────────────────────
    inv_q = db.query(PurchaseInvoice).filter(PurchaseInvoice.trang_thai != "huy")
    if tu_ngay:
        inv_q = inv_q.filter(PurchaseInvoice.ngay_lap >= tu_ngay)
    if den_ngay:
        inv_q = inv_q.filter(PurchaseInvoice.ngay_lap <= den_ngay)
    if phap_nhan_id:
        inv_q = inv_q.filter(PurchaseInvoice.phap_nhan_id == phap_nhan_id)

    all_pos = po_q.all()
    all_grs = gr_q.all()
    all_invs = inv_q.all()

    # ── KPI tổng ─────────────────────────────────────────────────────
    tong_po = len(all_pos)
    tong_gia_tri_po = sum(float(p.tong_tien) for p in all_pos)
    tong_gr = len(all_grs)
    tong_gia_tri_gr = sum(float(g.tong_gia_tri) for g in all_grs)
    tong_hoa_don = len(all_invs)
    tong_gia_tri_hd = sum(float(i.tong_thanh_toan) for i in all_invs)
    tong_da_tt = sum(float(i.da_thanh_toan) for i in all_invs)
    tong_con_no = sum(float(i.con_lai) for i in all_invs)

    # ── Cảnh báo ─────────────────────────────────────────────────────
    # PO quá hạn: đã gửi/đang giao nhưng ngày giao dự kiến đã qua
    po_qua_han = sum(
        1 for p in all_pos
        if p.trang_thai in {"da_gui_ncc", "dang_giao"}
        and p.ngay_du_kien_nhan
        and p.ngay_du_kien_nhan < today
    )
    # GR chờ duyệt (không lọc theo ngày — lấy tất cả)
    gr_cho_duyet_q = db.query(func.count(GoodsReceipt.id)).filter(
        GoodsReceipt.trang_thai.in_(["nhap", "nhap_nhanh"])
    )
    if phap_nhan_id:
        gr_cho_duyet_q = gr_cho_duyet_q.filter(GoodsReceipt.phap_nhan_id == phap_nhan_id)
    gr_cho_nhap = gr_cho_duyet_q.scalar() or 0

    # HĐ quá hạn thanh toán
    hd_qua_han = sum(
        1 for i in all_invs
        if i.trang_thai in {"chua_tt", "da_tt_mot_phan", "qua_han"}
        and getattr(i, "han_tt", None)
        and i.han_tt < today
    )

    # ── KPI theo pháp nhân ────────────────────────────────────────────
    phap_nhan_list = db.query(PhapNhan).all()
    by_phap_nhan = []
    for pn in phap_nhan_list:
        pn_grs = [g for g in all_grs if g.phap_nhan_id == pn.id]
        pn_invs = [i for i in all_invs if i.phap_nhan_id == pn.id]
        by_phap_nhan.append({
            "phap_nhan_id": pn.id,
            "ten_phap_nhan": pn.ten_viet_tat or pn.ten_phap_nhan or "",
            "so_phieu_gr": len(pn_grs),
            "tong_gia_tri_gr": sum(float(g.tong_gia_tri) for g in pn_grs),
            "so_hoa_don": len(pn_invs),
            "tong_gia_tri_hd": sum(float(i.tong_thanh_toan) for i in pn_invs),
            "tong_con_no": sum(float(i.con_lai) for i in pn_invs),
        })
    by_phap_nhan.sort(key=lambda x: x["tong_gia_tri_gr"], reverse=True)

    # ── Top NCC theo giá trị GR ───────────────────────────────────────
    ncc_map: dict[int, dict] = {}
    for g in all_grs:
        sid = g.supplier_id
        if sid not in ncc_map:
            sup = db.get(Supplier, sid)
            ncc_map[sid] = {
                "supplier_id": sid,
                "ten_ncc": sup.ten_viet_tat if sup else "",
                "so_phieu_gr": 0,
                "tong_gia_tri_gr": 0.0,
            }
        ncc_map[sid]["so_phieu_gr"] += 1
        ncc_map[sid]["tong_gia_tri_gr"] += float(g.tong_gia_tri)
    top_ncc = sorted(ncc_map.values(), key=lambda x: x["tong_gia_tri_gr"], reverse=True)[:10]

    # ── PO theo trạng thái ────────────────────────────────────────────
    po_status: dict[str, int] = {}
    for p in all_pos:
        po_status[p.trang_thai] = po_status.get(p.trang_thai, 0) + 1

    return {
        "kpi": {
            "tong_po": tong_po,
            "tong_gia_tri_po": tong_gia_tri_po,
            "tong_gr": tong_gr,
            "tong_gia_tri_gr": tong_gia_tri_gr,
            "tong_hoa_don": tong_hoa_don,
            "tong_gia_tri_hd": tong_gia_tri_hd,
            "tong_da_tt": tong_da_tt,
            "tong_con_no": tong_con_no,
            "po_qua_han": po_qua_han,
            "gr_cho_nhap": gr_cho_nhap,
            "hd_qua_han": hd_qua_han,
        },
        "by_phap_nhan": by_phap_nhan,
        "top_ncc": top_ncc,
        "po_by_status": po_status,
    }


@router.get("/import-template")
def download_purchase_order_template(
    _: User = Depends(get_current_user),
):
    """Tải file mẫu Excel để import đơn mua hàng."""
    return build_template_response("mau_import_don_mua_hang.xlsx", PURCHASE_ORDER_IMPORT_FIELDS)


@router.post("/import")
async def import_purchase_orders(
    commit: bool = Query(default=False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("purchase.import")),
):
    """Import đơn mua hàng từ Excel."""
    return await import_purchase_orders_excel(db, file, current_user, commit)
