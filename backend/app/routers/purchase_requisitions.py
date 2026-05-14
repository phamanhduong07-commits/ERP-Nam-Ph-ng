from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import PaperMaterial, OtherMaterial, PhanXuong
from app.models.purchase_requisition import PurchaseRequisition, PurchaseRequisitionItem
from app.models.purchase import PurchaseOrder, PurchaseOrderItem

router = APIRouter(prefix="/api/purchase-requisitions", tags=["purchase-requisitions"])

# ── Schemas ───────────────────────────────────────────────────────────────────

class YMHItemCreate(BaseModel):
    paper_material_id: Optional[int] = None
    other_material_id: Optional[int] = None
    ten_hang: str = ""
    so_luong: Decimal
    dvt: str = "Kg"
    don_gia_du_kien: Decimal = Decimal("0")
    ngay_can: Optional[date] = None
    ghi_chu: Optional[str] = None


class YMHCreate(BaseModel):
    ngay_yeu_cau: date
    phan_xuong_id: Optional[int] = None
    phap_nhan_id: Optional[int] = None
    ghi_chu: Optional[str] = None
    items: list[YMHItemCreate]


class YMHUpdate(BaseModel):
    ngay_yeu_cau: Optional[date] = None
    phan_xuong_id: Optional[int] = None
    ghi_chu: Optional[str] = None
    items: Optional[list[YMHItemCreate]] = None

# ── Helpers ───────────────────────────────────────────────────────────────────

def _gen_so_ymh(db: Session) -> str:
    ym = datetime.utcnow().strftime("%Y%m")
    prefix = f"YMH-{ym}-"
    last = (
        db.query(PurchaseRequisition)
        .filter(PurchaseRequisition.so_ymh.like(f"{prefix}%"))
        .order_by(PurchaseRequisition.id.desc())
        .first()
    )
    seq = 1
    if last:
        try:
            seq = int(last.so_ymh.rsplit("-", 1)[-1]) + 1
        except ValueError:
            pass
    return f"{prefix}{seq:04d}"


def _serialize_ymh(ymh: PurchaseRequisition, db: Session) -> dict:
    items = []
    for it in ymh.items:
        ten = it.ten_hang
        if not ten and it.paper_material_id:
            pm = db.get(PaperMaterial, it.paper_material_id)
            ten = pm.ma_chinh if pm else ""
        if not ten and it.other_material_id:
            om = db.get(OtherMaterial, it.other_material_id)
            ten = om.ten if om else ""
        items.append({
            "id": it.id,
            "paper_material_id": it.paper_material_id,
            "other_material_id": it.other_material_id,
            "ten_hang": ten,
            "so_luong": float(it.so_luong),
            "dvt": it.dvt,
            "don_gia_du_kien": float(it.don_gia_du_kien),
            "ngay_can": it.ngay_can.isoformat() if it.ngay_can else None,
            "ghi_chu": it.ghi_chu,
        })

    px = db.get(PhanXuong, ymh.phan_xuong_id) if ymh.phan_xuong_id else None
    nguoi_yc = ymh.nguoi_yeu_cau
    nguoi_dpb = ymh.nguoi_duyet_pb
    nguoi_dgd = ymh.nguoi_duyet_gd

    return {
        "id": ymh.id,
        "so_ymh": ymh.so_ymh,
        "ngay_yeu_cau": ymh.ngay_yeu_cau.isoformat() if ymh.ngay_yeu_cau else None,
        "phan_xuong_id": ymh.phan_xuong_id,
        "ten_phan_xuong": px.ten_phan_xuong if px else None,
        "phap_nhan_id": ymh.phap_nhan_id,
        "trang_thai": ymh.trang_thai,
        "nguoi_yeu_cau_id": ymh.nguoi_yeu_cau_id,
        "ten_nguoi_yeu_cau": f"{nguoi_yc.ho} {nguoi_yc.ten}" if nguoi_yc else None,
        "nguoi_duyet_pb_id": ymh.nguoi_duyet_pb_id,
        "ten_nguoi_duyet_pb": f"{nguoi_dpb.ho} {nguoi_dpb.ten}" if nguoi_dpb else None,
        "nguoi_duyet_gd_id": ymh.nguoi_duyet_gd_id,
        "ten_nguoi_duyet_gd": f"{nguoi_dgd.ho} {nguoi_dgd.ten}" if nguoi_dgd else None,
        "ngay_duyet_pb": ymh.ngay_duyet_pb.isoformat() if ymh.ngay_duyet_pb else None,
        "ngay_duyet_gd": ymh.ngay_duyet_gd.isoformat() if ymh.ngay_duyet_gd else None,
        "po_id": ymh.po_id,
        "ghi_chu": ymh.ghi_chu,
        "tong_du_kien": sum(float(it.so_luong) * float(it.don_gia_du_kien) for it in ymh.items),
        "created_at": ymh.created_at.isoformat() if ymh.created_at else None,
        "items": items,
    }

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
def list_ymh(
    trang_thai: Optional[str] = None,
    phan_xuong_id: Optional[int] = None,
    tu_ngay: Optional[date] = None,
    den_ngay: Optional[date] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(PurchaseRequisition).order_by(PurchaseRequisition.created_at.desc())
    if trang_thai:
        q = q.filter(PurchaseRequisition.trang_thai == trang_thai)
    if phan_xuong_id:
        q = q.filter(PurchaseRequisition.phan_xuong_id == phan_xuong_id)
    if tu_ngay:
        q = q.filter(PurchaseRequisition.ngay_yeu_cau >= tu_ngay)
    if den_ngay:
        q = q.filter(PurchaseRequisition.ngay_yeu_cau <= den_ngay)
    ymhs = q.limit(500).all()
    return [_serialize_ymh(y, db) for y in ymhs]


@router.post("", status_code=201)
def create_ymh(
    body: YMHCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.items:
        raise HTTPException(400, "YMH phải có ít nhất 1 dòng hàng")

    ymh = PurchaseRequisition(
        so_ymh=_gen_so_ymh(db),
        ngay_yeu_cau=body.ngay_yeu_cau,
        phan_xuong_id=body.phan_xuong_id,
        phap_nhan_id=body.phap_nhan_id,
        ghi_chu=body.ghi_chu,
        trang_thai="nhap",
        nguoi_yeu_cau_id=current_user.id,
    )
    db.add(ymh)
    db.flush()

    for it in body.items:
        ten = it.ten_hang
        if not ten and it.paper_material_id:
            pm = db.get(PaperMaterial, it.paper_material_id)
            ten = pm.ma_chinh if pm else ""
        if not ten and it.other_material_id:
            om = db.get(OtherMaterial, it.other_material_id)
            ten = om.ten if om else ""
        db.add(PurchaseRequisitionItem(
            ymh_id=ymh.id,
            paper_material_id=it.paper_material_id,
            other_material_id=it.other_material_id,
            ten_hang=ten,
            so_luong=it.so_luong,
            dvt=it.dvt,
            don_gia_du_kien=it.don_gia_du_kien,
            ngay_can=it.ngay_can,
            ghi_chu=it.ghi_chu,
        ))

    db.commit()
    db.refresh(ymh)
    return _serialize_ymh(ymh, db)


@router.get("/{ymh_id}")
def get_ymh(
    ymh_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    ymh = db.get(PurchaseRequisition, ymh_id)
    if not ymh:
        raise HTTPException(404, "Không tìm thấy YMH")
    return _serialize_ymh(ymh, db)


@router.put("/{ymh_id}")
def update_ymh(
    ymh_id: int,
    body: YMHUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    ymh = db.get(PurchaseRequisition, ymh_id)
    if not ymh:
        raise HTTPException(404, "Không tìm thấy YMH")
    if ymh.trang_thai not in ("nhap",):
        raise HTTPException(400, "Chỉ có thể sửa YMH ở trạng thái 'nhap'")

    if body.ngay_yeu_cau is not None:
        ymh.ngay_yeu_cau = body.ngay_yeu_cau
    if body.phan_xuong_id is not None:
        ymh.phan_xuong_id = body.phan_xuong_id
    if body.ghi_chu is not None:
        ymh.ghi_chu = body.ghi_chu

    if body.items is not None:
        for old in ymh.items:
            db.delete(old)
        db.flush()
        for it in body.items:
            ten = it.ten_hang
            if not ten and it.paper_material_id:
                pm = db.get(PaperMaterial, it.paper_material_id)
                ten = pm.ma_chinh if pm else ""
            if not ten and it.other_material_id:
                om = db.get(OtherMaterial, it.other_material_id)
                ten = om.ten if om else ""
            db.add(PurchaseRequisitionItem(
                ymh_id=ymh.id,
                paper_material_id=it.paper_material_id,
                other_material_id=it.other_material_id,
                ten_hang=ten,
                so_luong=it.so_luong,
                dvt=it.dvt,
                don_gia_du_kien=it.don_gia_du_kien,
                ngay_can=it.ngay_can,
                ghi_chu=it.ghi_chu,
            ))

    db.commit()
    db.refresh(ymh)
    return _serialize_ymh(ymh, db)


@router.post("/{ymh_id}/duyet-pb")
def duyet_pb(
    ymh_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Phòng ban duyệt YMH."""
    ymh = db.get(PurchaseRequisition, ymh_id)
    if not ymh:
        raise HTTPException(404, "Không tìm thấy YMH")
    if ymh.trang_thai != "nhap":
        raise HTTPException(400, f"Không thể duyệt PB từ trạng thái '{ymh.trang_thai}'")
    ymh.trang_thai = "duyet_pb"
    ymh.nguoi_duyet_pb_id = current_user.id
    ymh.ngay_duyet_pb = datetime.utcnow()
    db.commit()
    return {"ok": True, "trang_thai": ymh.trang_thai}


@router.post("/{ymh_id}/duyet-gd")
def duyet_gd(
    ymh_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Giám đốc duyệt YMH."""
    ymh = db.get(PurchaseRequisition, ymh_id)
    if not ymh:
        raise HTTPException(404, "Không tìm thấy YMH")
    if ymh.trang_thai != "duyet_pb":
        raise HTTPException(400, f"Cần phê duyệt PB trước khi GĐ duyệt")
    ymh.trang_thai = "duyet_gd"
    ymh.nguoi_duyet_gd_id = current_user.id
    ymh.ngay_duyet_gd = datetime.utcnow()
    db.commit()
    return {"ok": True, "trang_thai": ymh.trang_thai}


@router.post("/{ymh_id}/huy")
def huy_ymh(
    ymh_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    ymh = db.get(PurchaseRequisition, ymh_id)
    if not ymh:
        raise HTTPException(404, "Không tìm thấy YMH")
    if ymh.trang_thai in ("tao_po",):
        raise HTTPException(400, "Không thể huỷ YMH đã tạo PO")
    ymh.trang_thai = "huy"
    db.commit()
    return {"ok": True}


@router.delete("/{ymh_id}")
def delete_ymh(
    ymh_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    ymh = db.get(PurchaseRequisition, ymh_id)
    if not ymh:
        raise HTTPException(404, "Không tìm thấy YMH")
    if ymh.trang_thai not in ("nhap", "huy"):
        raise HTTPException(400, "Chỉ có thể xóa YMH ở trạng thái 'nhap' hoặc 'huỷ'")
    db.delete(ymh)
    db.commit()
    return {"ok": True}
