from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.master import Supplier, PaperMaterial, OtherMaterial, PhanXuong
from app.models.purchase import PurchaseOrder, PurchaseOrderItem
from app.deps import get_current_user
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
    loai_po: str = "chung"
    ngay_du_kien_nhan: Optional[date] = None
    dieu_khoan_tt: Optional[str] = None
    ghi_chu: Optional[str] = None
    items: list[POItemCreate]


class POUpdate(BaseModel):
    phan_xuong_id: Optional[int] = None
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
        return None, None, None
    px = db.get(PhanXuong, po.phan_xuong_id)
    if not px:
        return po.phan_xuong_id, None, None
    ten_phap_nhan = px.phap_nhan.ten_phap_nhan if px.phap_nhan else None
    return px.id, px.ten_xuong, ten_phap_nhan


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
    db: Session = Depends(get_db),
):
    q = db.query(PurchaseOrder).order_by(PurchaseOrder.created_at.desc())
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
        sup = db.get(Supplier, po.supplier_id)
        px_id, ten_px, ten_pn = _px_info(po, db)
        tong = sum(float(it.thanh_tien) for it in po.items)
        da_nhan = sum(float(it.so_luong_da_nhan) for it in po.items)
        tong_dat = sum(float(it.so_luong) for it in po.items)
        result.append({
            "id": po.id,
            "so_po": po.so_po,
            "ngay_po": po.ngay_po.isoformat() if po.ngay_po else None,
            "supplier_id": po.supplier_id,
            "ten_ncc": sup.ten_viet_tat if sup else "",
            "trang_thai": po.trang_thai,
            "phan_xuong_id": px_id,
            "ten_phan_xuong": ten_px,
            "ten_phap_nhan": ten_pn,
            "loai_po": po.loai_po or "chung",
            "ngay_du_kien_nhan": po.ngay_du_kien_nhan.isoformat() if po.ngay_du_kien_nhan else None,
            "tong_tien": tong,
            "tien_do_nhan": round(da_nhan / tong_dat * 100, 1) if tong_dat else 0,
            "created_at": po.created_at.isoformat() if po.created_at else None,
        })
    return result


@router.post("")
def create_po(body: POCreate, db: Session = Depends(get_db)):
    if not db.get(Supplier, body.supplier_id):
        raise HTTPException(404, "Nhà cung cấp không tồn tại")
    if not body.items:
        raise HTTPException(400, "Phải có ít nhất 1 dòng hàng")

    so_po = _gen_so_po(db)
    po = PurchaseOrder(
        so_po=so_po,
        ngay_po=body.ngay_po,
        supplier_id=body.supplier_id,
        phan_xuong_id=body.phan_xuong_id,
        loai_po=body.loai_po or "chung",
        ngay_du_kien_nhan=body.ngay_du_kien_nhan,
        dieu_khoan_tt=body.dieu_khoan_tt,
        ghi_chu=body.ghi_chu,
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
def update_po(po_id: int, body: POUpdate, db: Session = Depends(get_db)):
    po = db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(404, "Không tìm thấy PO")
    if po.trang_thai not in ("moi",):
        raise HTTPException(400, "Chỉ sửa được PO ở trạng thái Mới")

    if body.phan_xuong_id is not None:
        po.phan_xuong_id = body.phan_xuong_id
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
            ))
        po.tong_tien = tong

    db.commit()
    db.refresh(po)
    return _po_to_dict(po, db)


@router.post("/{po_id}/duyet")
def duyet_po(po_id: int, db: Session = Depends(get_db)):
    po = db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(404, "Không tìm thấy PO")
    if po.trang_thai != "moi":
        raise HTTPException(400, "Chỉ duyệt PO ở trạng thái Mới")
    po.trang_thai = "da_duyet"
    po.approved_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "trang_thai": po.trang_thai}


@router.delete("/{po_id}")
def delete_po(po_id: int, db: Session = Depends(get_db)):
    po = db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(404, "Không tìm thấy PO")
    if po.trang_thai not in ("moi", "huy"):
        raise HTTPException(400, "Không thể xoá PO đã duyệt")
    db.delete(po)
    db.commit()
    return {"ok": True}


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
    current_user: User = Depends(get_current_user),
):
    """Import đơn mua hàng từ Excel."""
    return await import_purchase_orders_excel(db, file, current_user, commit)

