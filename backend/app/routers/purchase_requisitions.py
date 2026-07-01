from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from typing import Literal
from app.utils.template import apply_template, standard_vars
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, model_validator
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

import html as _html_mod

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.master import OtherMaterial, PaperMaterial, PhanXuong, PhapNhan, Supplier, Product
from app.models.purchase import PurchaseOrder, PurchaseOrderItem
from app.models.purchase_requisition import PurchaseRequisition, PurchaseRequisitionItem, CongCuSanXuat
from app.models.system import PrintTemplate, SystemSetting

router = APIRouter(prefix="/api/purchase-requisitions", tags=["purchase-requisitions"])


class YMHItemCreate(BaseModel):
    paper_material_id: Optional[int] = None
    other_material_id: Optional[int] = None
    ten_hang: str = ""
    so_luong: Decimal
    dvt: str = "Kg"
    don_gia_du_kien: Decimal = Decimal("0")
    ngay_can: Optional[date] = None
    ghi_chu: Optional[str] = None
    loai_item: Literal["nvl", "ban_in", "khuon_be", "muc_in", "dich_vu"] = "nvl"
    san_pham_id: Optional[int] = None

    @model_validator(mode="after")
    def validate_tooling_san_pham(self) -> "YMHItemCreate":
        if self.loai_item in ("ban_in", "khuon_be", "muc_in") and not self.san_pham_id:
            raise ValueError("Bản in / khuôn bế phải chọn sản phẩm liên quan (san_pham_id)")
        return self


class YMHCreate(BaseModel):
    ngay_yeu_cau: date
    phan_xuong_id: Optional[int] = None
    phap_nhan_id: Optional[int] = None
    ghi_chu: Optional[str] = None
    items: list[YMHItemCreate]


class YMHUpdate(BaseModel):
    ngay_yeu_cau: Optional[date] = None
    phan_xuong_id: Optional[int] = None
    phap_nhan_id: Optional[int] = None
    ghi_chu: Optional[str] = None
    items: Optional[list[YMHItemCreate]] = None


class YMHReject(BaseModel):
    ly_do: str = ""


class ItemPriceOverride(BaseModel):
    ymh_item_id: int
    don_gia: Decimal


class YMHCreatePO(BaseModel):
    supplier_id: int
    ngay_po: date
    ngay_du_kien_nhan: Optional[date] = None
    dieu_khoan_tt: Optional[str] = None
    ghi_chu: Optional[str] = None
    items_override: list[ItemPriceOverride] = []


class NccGroupItem(BaseModel):
    ymh_item_id: int
    don_gia: Decimal


class NccGroup(BaseModel):
    supplier_id: int
    item_ids: list[int]
    don_gia_overrides: list[NccGroupItem] = []


class YMHTaoPOTheoNCC(BaseModel):
    ngay_po: date
    ngay_du_kien_nhan: Optional[date] = None
    dieu_khoan_tt: Optional[str] = None
    ghi_chu: Optional[str] = None
    groups: list[NccGroup]


def _gen_so_ymh(db: Session) -> str:
    ym = datetime.now(timezone.utc).strftime("%Y%m")
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


def _gen_so_po(db: Session) -> str:
    ym = datetime.now(timezone.utc).strftime("%Y%m")
    prefix = f"PO-{ym}-"
    last = db.query(func.max(PurchaseOrder.so_po)).filter(PurchaseOrder.so_po.like(f"{prefix}%")).scalar()
    seq = 1
    if last:
        try:
            seq = int(last.rsplit("-", 1)[-1]) + 1
        except (ValueError, IndexError):
            pass
    return f"{prefix}{seq:04d}"


def _user_name(user: User | None) -> str | None:
    return user.ho_ten if user else None


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


def _resolve_item_name(db: Session, item: YMHItemCreate) -> tuple[str, str, Decimal]:
    if item.paper_material_id and item.other_material_id:
        raise HTTPException(400, "Một dòng chỉ được chọn giấy cuộn hoặc NVL khác")
    if item.so_luong <= 0:
        raise HTTPException(400, "Số lượng yêu cầu phải lớn hơn 0")

    ten_hang = (item.ten_hang or "").strip()
    dvt = item.dvt or "Kg"
    don_gia = item.don_gia_du_kien or Decimal("0")

    if item.paper_material_id:
        pm = db.get(PaperMaterial, item.paper_material_id)
        if not pm:
            raise HTTPException(400, "Nguyên liệu giấy không tồn tại")
        ten_hang = ten_hang or pm.ten or pm.ma_chinh
        dvt = item.dvt or pm.dvt or "Kg"
        if not don_gia:
            don_gia = pm.gia_mua or Decimal("0")
    elif item.other_material_id:
        om = db.get(OtherMaterial, item.other_material_id)
        if not om:
            raise HTTPException(400, "NVL khác không tồn tại")
        ten_hang = ten_hang or om.ten or om.ma_chinh
        dvt = item.dvt or om.dvt or "Kg"
        if not don_gia:
            don_gia = om.gia_mua or Decimal("0")

    if not ten_hang:
        raise HTTPException(400, "Mỗi dòng hàng cần có tên hàng hoặc chọn từ danh mục")
    return ten_hang, dvt, don_gia


def _add_ymh_items(db: Session, ymh_id: int, items: list[YMHItemCreate]) -> None:
    for item in items:
        ten_hang, dvt, don_gia = _resolve_item_name(db, item)
        db.add(
            PurchaseRequisitionItem(
                ymh_id=ymh_id,
                paper_material_id=item.paper_material_id,
                other_material_id=item.other_material_id,
                ten_hang=ten_hang,
                so_luong=item.so_luong,
                dvt=dvt,
                don_gia_du_kien=don_gia,
                ngay_can=item.ngay_can,
                ghi_chu=item.ghi_chu,
                loai_item=item.loai_item,
                san_pham_id=item.san_pham_id,
            )
        )


def _serialize_ymh(ymh: PurchaseRequisition, db: Session) -> dict:
    px = db.get(PhanXuong, ymh.phan_xuong_id) if ymh.phan_xuong_id else None
    pn = db.get(PhapNhan, ymh.phap_nhan_id) if ymh.phap_nhan_id else None
    items = []

    for it in ymh.items:
        ten_hang = it.ten_hang
        if not ten_hang and it.paper_material_id:
            pm = db.get(PaperMaterial, it.paper_material_id)
            ten_hang = pm.ten if pm else ""
        if not ten_hang and it.other_material_id:
            om = db.get(OtherMaterial, it.other_material_id)
            ten_hang = om.ten if om else ""
        ten_san_pham: str | None = None
        if it.san_pham_id and it.san_pham:
            ten_san_pham = it.san_pham.ten_hang or it.san_pham.ma_hang
        supplier_id_goi_y: int | None = None
        ten_ncc_goi_y: str | None = None
        if it.tai_san_in_id and it.tai_san_in:
            supplier_id_goi_y = it.tai_san_in.supplier_id
            if it.tai_san_in.supplier:
                s = it.tai_san_in.supplier
                ten_ncc_goi_y = s.ten_viet_tat or s.ten_don_vi or s.ma_ncc
        items.append(
            {
                "id": it.id,
                "paper_material_id": it.paper_material_id,
                "other_material_id": it.other_material_id,
                "ten_hang": ten_hang,
                "so_luong": float(it.so_luong),
                "dvt": it.dvt,
                "don_gia_du_kien": float(it.don_gia_du_kien or 0),
                "ngay_can": it.ngay_can.isoformat() if it.ngay_can else None,
                "ghi_chu": it.ghi_chu,
                "loai_item": it.loai_item if it.loai_item else "nvl",
                "san_pham_id": it.san_pham_id,
                "ten_san_pham": ten_san_pham,
                "tai_san_in_id": it.tai_san_in_id,
                "supplier_id_goi_y": supplier_id_goi_y,
                "ten_ncc_goi_y": ten_ncc_goi_y,
            }
        )

    tong_du_kien = sum(float(it.so_luong or 0) * float(it.don_gia_du_kien or 0) for it in ymh.items)
    return {
        "id": ymh.id,
        "so_ymh": ymh.so_ymh,
        "ngay_yeu_cau": ymh.ngay_yeu_cau.isoformat() if ymh.ngay_yeu_cau else None,
        "phan_xuong_id": ymh.phan_xuong_id,
        "ten_phan_xuong": px.ten_xuong if px else None,
        "phap_nhan_id": ymh.phap_nhan_id,
        "ten_phap_nhan": (pn.ten_viet_tat or pn.ten_phap_nhan) if pn else None,
        "trang_thai": ymh.trang_thai,
        "nguoi_yeu_cau_id": ymh.nguoi_yeu_cau_id,
        "ten_nguoi_yeu_cau": _user_name(ymh.nguoi_yeu_cau),
        "nguoi_duyet_pb_id": ymh.nguoi_duyet_pb_id,
        "ten_nguoi_duyet_pb": _user_name(ymh.nguoi_duyet_pb),
        "nguoi_duyet_gd_id": ymh.nguoi_duyet_gd_id,
        "ten_nguoi_duyet_gd": _user_name(ymh.nguoi_duyet_gd),
        "ngay_duyet_pb": ymh.ngay_duyet_pb.isoformat() if ymh.ngay_duyet_pb else None,
        "ngay_duyet_gd": ymh.ngay_duyet_gd.isoformat() if ymh.ngay_duyet_gd else None,
        "po_id": ymh.po_id,
        "so_po_linked": db.get(PurchaseOrder, ymh.po_id).so_po if ymh.po_id else None,
        "pos": [
            {
                "po_id": po.id,
                "so_po": po.so_po,
                "supplier_id": po.supplier_id,
                "ten_ncc": (po.supplier.ten_viet_tat or po.supplier.ten_don_vi or po.supplier.ma_ncc) if po.supplier else None,
                "tong_tien": float(po.tong_tien or 0),
                "trang_thai": po.trang_thai,
            }
            for po in ymh.pos
        ],
        "ghi_chu": ymh.ghi_chu,
        "ly_do_tu_choi": ymh.ly_do_tu_choi,
        "tong_du_kien": tong_du_kien,
        "so_dong": len(items),
        "created_at": ymh.created_at.isoformat() if ymh.created_at else None,
        "items": items,
    }


@router.get("")
def list_ymh(
    trang_thai: Optional[str] = None,
    phan_xuong_id: Optional[int] = None,
    phap_nhan_id: Optional[int] = None,
    nguoi_yeu_cau_id: Optional[int] = None,
    tu_ngay: Optional[date] = None,
    den_ngay: Optional[date] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from sqlalchemy import or_
    q = db.query(PurchaseRequisition).order_by(PurchaseRequisition.created_at.desc())
    if search:
        like = f"%{search}%"
        q = (q
             .outerjoin(PurchaseRequisition.items)
             .filter(or_(
                 PurchaseRequisition.so_ymh.ilike(like),
                 PurchaseRequisitionItem.ten_hang.ilike(like),
             ))
             .distinct())
    if trang_thai:
        q = q.filter(PurchaseRequisition.trang_thai == trang_thai)
    if phan_xuong_id:
        q = q.filter(PurchaseRequisition.phan_xuong_id == phan_xuong_id)
    if phap_nhan_id:
        q = q.filter(PurchaseRequisition.phap_nhan_id == phap_nhan_id)
    if nguoi_yeu_cau_id:
        q = q.filter(PurchaseRequisition.nguoi_yeu_cau_id == nguoi_yeu_cau_id)
    if tu_ngay:
        q = q.filter(PurchaseRequisition.ngay_yeu_cau >= tu_ngay)
    if den_ngay:
        q = q.filter(PurchaseRequisition.ngay_yeu_cau <= den_ngay)
    return [_serialize_ymh(ymh, db) for ymh in q.limit(500).all()]


@router.post("", status_code=201)
def create_ymh(
    body: YMHCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.items:
        raise HTTPException(400, "YMH phải có ít nhất 1 dòng hàng")

    phap_nhan_id = _resolve_phap_nhan_id(db, body.phan_xuong_id, body.phap_nhan_id)
    ymh = PurchaseRequisition(
        so_ymh=_gen_so_ymh(db),
        ngay_yeu_cau=body.ngay_yeu_cau,
        phan_xuong_id=body.phan_xuong_id,
        phap_nhan_id=phap_nhan_id,
        ghi_chu=body.ghi_chu,
        trang_thai="nhap",
        nguoi_yeu_cau_id=current_user.id,
    )
    db.add(ymh)
    db.flush()
    _add_ymh_items(db, ymh.id, body.items)
    db.commit()
    db.refresh(ymh)
    return _serialize_ymh(ymh, db)


# ─── Tooling registry endpoints (must come BEFORE /{ymh_id} to avoid routing conflict) ──


class CongCuCreate(BaseModel):
    san_pham_id: int
    loai_cong_cu: Literal["ban_in", "khuon_be", "muc_in"]
    trang_thai: Literal["co_san", "dat_mua", "hong"] = "co_san"
    so_luong: int = 1
    ghi_chu: Optional[str] = None
    ymh_item_id: Optional[int] = None
    po_id: Optional[int] = None


@router.get("/tooling-check")
def tooling_check(
    san_pham_id: int,
    loai: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(CongCuSanXuat).filter(CongCuSanXuat.san_pham_id == san_pham_id)
    if loai:
        q = q.filter(CongCuSanXuat.loai_cong_cu == loai)
    records = q.all()
    return [
        {
            "id": r.id,
            "san_pham_id": r.san_pham_id,
            "loai_cong_cu": r.loai_cong_cu,
            "trang_thai": r.trang_thai,
            "so_luong": r.so_luong,
            "ghi_chu": r.ghi_chu,
            "ymh_item_id": r.ymh_item_id,
            "po_id": r.po_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]


@router.get("/cong-cu")
def list_cong_cu(
    san_pham_id: Optional[int] = None,
    loai_cong_cu: Optional[str] = None,
    trang_thai: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(CongCuSanXuat)
    if san_pham_id:
        q = q.filter(CongCuSanXuat.san_pham_id == san_pham_id)
    if loai_cong_cu:
        q = q.filter(CongCuSanXuat.loai_cong_cu == loai_cong_cu)
    if trang_thai:
        q = q.filter(CongCuSanXuat.trang_thai == trang_thai)
    records = q.order_by(CongCuSanXuat.id.desc()).all()
    return [
        {
            "id": r.id,
            "san_pham_id": r.san_pham_id,
            "ten_san_pham": r.san_pham.ten_hang if r.san_pham else None,
            "loai_cong_cu": r.loai_cong_cu,
            "trang_thai": r.trang_thai,
            "so_luong": r.so_luong,
            "ghi_chu": r.ghi_chu,
            "ymh_item_id": r.ymh_item_id,
            "po_id": r.po_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]


@router.post("/cong-cu", status_code=201)
def create_cong_cu(
    body: CongCuCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "MANAGER")),
):
    sp = db.get(Product, body.san_pham_id)
    if not sp:
        raise HTTPException(404, "Không tìm thấy sản phẩm")
    record = CongCuSanXuat(
        san_pham_id=body.san_pham_id,
        loai_cong_cu=body.loai_cong_cu,
        trang_thai=body.trang_thai,
        so_luong=body.so_luong,
        ghi_chu=body.ghi_chu,
        ymh_item_id=body.ymh_item_id,
        po_id=body.po_id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {
        "id": record.id,
        "san_pham_id": record.san_pham_id,
        "ten_san_pham": sp.ten_hang,
        "loai_cong_cu": record.loai_cong_cu,
        "trang_thai": record.trang_thai,
        "so_luong": record.so_luong,
        "ghi_chu": record.ghi_chu,
        "ymh_item_id": record.ymh_item_id,
        "po_id": record.po_id,
        "created_at": record.created_at.isoformat() if record.created_at else None,
    }


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
    if ymh.trang_thai != "nhap":
        raise HTTPException(400, "Chỉ có thể sửa YMH ở trạng thái nháp")

    if body.ngay_yeu_cau is not None:
        ymh.ngay_yeu_cau = body.ngay_yeu_cau
    if body.phan_xuong_id is not None:
        ymh.phan_xuong_id = body.phan_xuong_id
    if body.phap_nhan_id is not None or body.phan_xuong_id is not None:
        ymh.phap_nhan_id = _resolve_phap_nhan_id(db, ymh.phan_xuong_id, body.phap_nhan_id)
    if body.ghi_chu is not None:
        ymh.ghi_chu = body.ghi_chu

    if body.items is not None:
        if not body.items:
            raise HTTPException(400, "YMH phải có ít nhất 1 dòng hàng")
        for old in list(ymh.items):
            db.delete(old)
        db.flush()
        _add_ymh_items(db, ymh.id, body.items)

    db.commit()
    db.refresh(ymh)
    return _serialize_ymh(ymh, db)


@router.post("/{ymh_id}/submit")
def submit_ymh(
    ymh_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Gửi YMH đi duyệt: nhap → cho_duyet"""
    ymh = db.get(PurchaseRequisition, ymh_id)
    if not ymh:
        raise HTTPException(404, "Không tìm thấy YMH")
    if ymh.trang_thai != "nhap":
        raise HTTPException(400, f"Chỉ có thể gửi duyệt YMH ở trạng thái nháp (hiện tại: {ymh.trang_thai})")
    if not ymh.items:
        raise HTTPException(400, "YMH chưa có dòng hàng")
    ymh.trang_thai = "cho_duyet"
    db.commit()
    return {"ok": True, "trang_thai": ymh.trang_thai}


@router.post("/{ymh_id}/approve")
def approve_ymh(
    ymh_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "MANAGER")),
):
    """Duyệt YMH (manager/admin): cho_duyet → duyet_gd (bỏ qua bước PB)"""
    ymh = db.get(PurchaseRequisition, ymh_id)
    if not ymh:
        raise HTTPException(404, "Không tìm thấy YMH")
    if ymh.trang_thai not in ("cho_duyet", "nhap", "duyet_pb"):
        raise HTTPException(400, f"Không thể duyệt YMH ở trạng thái {ymh.trang_thai}")
    ymh.trang_thai = "duyet_gd"
    ymh.nguoi_duyet_gd_id = current_user.id
    ymh.ngay_duyet_gd = datetime.now(timezone.utc)
    ymh.ly_do_tu_choi = None  # xoá lý do từ chối cũ nếu có
    db.commit()
    return {"ok": True, "trang_thai": ymh.trang_thai}


@router.post("/{ymh_id}/reject")
def reject_ymh(
    ymh_id: int,
    body: YMHReject,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "MANAGER")),
):
    """Từ chối YMH (manager/admin): cho_duyet / duyet_pb → tu_choi"""
    ymh = db.get(PurchaseRequisition, ymh_id)
    if not ymh:
        raise HTTPException(404, "Không tìm thấy YMH")
    if ymh.trang_thai not in ("cho_duyet", "nhap", "duyet_pb"):
        raise HTTPException(400, f"Không thể từ chối YMH ở trạng thái {ymh.trang_thai}")
    ymh.trang_thai = "tu_choi"
    ymh.ly_do_tu_choi = body.ly_do or None
    db.commit()
    return {"ok": True, "trang_thai": ymh.trang_thai}


@router.post("/{ymh_id}/duyet-pb")
def duyet_pb(
    ymh_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "MUA_HANG_TRUONG_PHONG", "BGD_GIAM_DOC")),
):
    ymh = db.get(PurchaseRequisition, ymh_id)
    if not ymh:
        raise HTTPException(404, "Không tìm thấy YMH")
    if ymh.trang_thai not in ("nhap", "cho_duyet"):
        raise HTTPException(400, f"Không thể duyệt PB từ trạng thái {ymh.trang_thai}")
    ymh.trang_thai = "duyet_pb"
    ymh.nguoi_duyet_pb_id = current_user.id
    ymh.ngay_duyet_pb = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True, "trang_thai": ymh.trang_thai}


@router.post("/{ymh_id}/duyet-gd")
def duyet_gd(
    ymh_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "BGD_GIAM_DOC")),
):
    ymh = db.get(PurchaseRequisition, ymh_id)
    if not ymh:
        raise HTTPException(404, "Không tìm thấy YMH")
    if ymh.trang_thai != "duyet_pb":
        raise HTTPException(400, "Cần phê duyệt PB trước khi GĐ duyệt")
    ymh.trang_thai = "duyet_gd"
    ymh.nguoi_duyet_gd_id = current_user.id
    ymh.ngay_duyet_gd = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True, "trang_thai": ymh.trang_thai}


@router.post("/{ymh_id}/tao-po")
def tao_po_tu_ymh(
    ymh_id: int,
    body: YMHCreatePO,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "MUA_HANG_TRUONG_PHONG", "BGD_GIAM_DOC")),
):
    ymh = db.get(PurchaseRequisition, ymh_id)
    if not ymh:
        raise HTTPException(404, "Không tìm thấy YMH")
    if ymh.trang_thai != "duyet_gd":
        raise HTTPException(400, "Chỉ tạo PO từ YMH đã được GĐ duyệt")
    if not ymh.items:
        raise HTTPException(400, "YMH chưa có dòng hàng")
    if not db.get(Supplier, body.supplier_id):
        raise HTTPException(404, "Nhà cung cấp không tồn tại")

    has_paper = any(item.paper_material_id for item in ymh.items)
    has_other = any(item.other_material_id for item in ymh.items)
    has_free = any(not item.paper_material_id and not item.other_material_id for item in ymh.items)
    loai_po = "chung"
    if has_paper and not has_other and not has_free:
        loai_po = "giay_cuon"
    elif has_other and not has_paper and not has_free:
        loai_po = "nvl_khac"

    po = PurchaseOrder(
        so_po=_gen_so_po(db),
        ngay_po=body.ngay_po,
        supplier_id=body.supplier_id,
        phan_xuong_id=ymh.phan_xuong_id,
        phap_nhan_id=ymh.phap_nhan_id,
        loai_po=loai_po,
        ngay_du_kien_nhan=body.ngay_du_kien_nhan,
        dieu_khoan_tt=body.dieu_khoan_tt,
        ghi_chu=body.ghi_chu or f"Tạo từ YMH {ymh.so_ymh}",
        created_by=current_user.id,
        ymh_id=ymh.id,
    )
    db.add(po)
    db.flush()

    override_map = {x.ymh_item_id: x.don_gia for x in body.items_override}
    tong_tien = Decimal("0")
    for item in ymh.items:
        don_gia = override_map.get(item.id, item.don_gia_du_kien or Decimal("0"))
        thanh_tien = item.so_luong * don_gia
        tong_tien += thanh_tien
        db.add(
            PurchaseOrderItem(
                po_id=po.id,
                paper_material_id=item.paper_material_id,
                other_material_id=item.other_material_id,
                ten_hang=item.ten_hang,
                so_luong=item.so_luong,
                dvt=item.dvt,
                don_gia=don_gia,
                thanh_tien=thanh_tien,
                ghi_chu=item.ghi_chu,
            )
        )

    po.tong_tien = tong_tien
    ymh.po_id = po.id
    ymh.trang_thai = "tao_po"

    # Cập nhật purchase_order_id cho TaiSanIn liên kết qua ymh item
    from app.models.tai_san_in import TaiSanIn as TaiSanInModel
    for item in ymh.items:
        if item.tai_san_in_id:
            ts = db.get(TaiSanInModel, item.tai_san_in_id)
            if ts:
                ts.purchase_order_id = po.id

    db.commit()
    db.refresh(po)
    return {"ok": True, "po_id": po.id, "so_po": po.so_po, "trang_thai": ymh.trang_thai}


@router.post("/{ymh_id}/tao-po-theo-ncc")
def tao_po_theo_ncc(
    ymh_id: int,
    body: YMHTaoPOTheoNCC,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "MUA_HANG_TRUONG_PHONG", "BGD_GIAM_DOC")),
):
    from app.models.tai_san_in import TaiSanIn as TaiSanInModel
    ymh = db.get(PurchaseRequisition, ymh_id)
    if not ymh:
        raise HTTPException(404, "Không tìm thấy YMH")
    if ymh.trang_thai != "duyet_gd":
        raise HTTPException(400, "Chỉ tạo PO từ YMH đã được GĐ duyệt")
    if not body.groups:
        raise HTTPException(400, "Cần ít nhất 1 nhóm NCC")

    item_map = {it.id: it for it in ymh.items}
    seen_ids: set[int] = set()
    for grp in body.groups:
        if not db.get(Supplier, grp.supplier_id):
            raise HTTPException(404, f"Nhà cung cấp {grp.supplier_id} không tồn tại")
        for iid in grp.item_ids:
            if iid not in item_map:
                raise HTTPException(400, f"Item {iid} không thuộc YMH này")
            if iid in seen_ids:
                raise HTTPException(400, f"Item {iid} xuất hiện trong nhiều nhóm NCC")
            seen_ids.add(iid)

    created_pos = []
    for grp in body.groups:
        items_in_grp = [item_map[iid] for iid in grp.item_ids]
        override_map = {x.ymh_item_id: x.don_gia for x in grp.don_gia_overrides}

        loai_po = "ban_in_khuon_be"
        has_paper = any(it.paper_material_id for it in items_in_grp)
        has_other = any(it.other_material_id for it in items_in_grp)
        has_free = any(not it.paper_material_id and not it.other_material_id for it in items_in_grp)
        if has_paper and not has_other and not has_free:
            loai_po = "giay_cuon"
        elif has_other and not has_paper and not has_free:
            loai_po = "nvl_khac"

        po = PurchaseOrder(
            so_po=_gen_so_po(db),
            ngay_po=body.ngay_po,
            supplier_id=grp.supplier_id,
            phan_xuong_id=ymh.phan_xuong_id,
            phap_nhan_id=ymh.phap_nhan_id,
            loai_po=loai_po,
            ngay_du_kien_nhan=body.ngay_du_kien_nhan,
            dieu_khoan_tt=body.dieu_khoan_tt,
            ghi_chu=body.ghi_chu or f"Tạo từ YMH {ymh.so_ymh}",
            created_by=current_user.id,
            ymh_id=ymh.id,
        )
        db.add(po)
        db.flush()

        tong_tien = Decimal("0")
        for item in items_in_grp:
            don_gia = override_map.get(item.id, item.don_gia_du_kien or Decimal("0"))
            thanh_tien = item.so_luong * don_gia
            tong_tien += thanh_tien
            db.add(PurchaseOrderItem(
                po_id=po.id,
                paper_material_id=item.paper_material_id,
                other_material_id=item.other_material_id,
                ten_hang=item.ten_hang,
                so_luong=item.so_luong,
                dvt=item.dvt,
                don_gia=don_gia,
                thanh_tien=thanh_tien,
                ghi_chu=item.ghi_chu,
            ))
            if item.tai_san_in_id:
                ts = db.get(TaiSanInModel, item.tai_san_in_id)
                if ts:
                    ts.purchase_order_id = po.id

        po.tong_tien = tong_tien
        db.flush()
        created_pos.append({
            "po_id": po.id,
            "so_po": po.so_po,
            "supplier_id": grp.supplier_id,
            "item_count": len(items_in_grp),
        })

    if seen_ids >= set(item_map.keys()):
        ymh.trang_thai = "tao_po"
        if not ymh.po_id and created_pos:
            ymh.po_id = created_pos[0]["po_id"]

    db.commit()
    return {"ok": True, "pos": created_pos}


@router.post("/{ymh_id}/huy")
def huy_ymh(
    ymh_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "MUA_HANG_TRUONG_PHONG", "BGD_GIAM_DOC")),
):
    ymh = db.get(PurchaseRequisition, ymh_id)
    if not ymh:
        raise HTTPException(404, "Không tìm thấy YMH")
    if ymh.trang_thai in ("tao_po",):
        raise HTTPException(400, "Không thể huỷ YMH đã tạo PO")
    ymh.trang_thai = "huy"
    db.commit()
    return {"ok": True}


# ─── Print helpers ────────────────────────────────────────────────────────────

_TD  = "style='padding:4px;border:1px solid #ccc'"
_TDC = "style='padding:4px;border:1px solid #ccc;text-align:center'"
_TDR = "style='padding:4px;border:1px solid #ccc;text-align:right'"
_TH_STYLE = "style='padding:4px;border:1px solid #ccc;text-align:center'"


def _th(label: str, width: str = "", align: str = "center") -> str:
    w = f"width:{width};" if width else ""
    return f"<th style='{w}padding:4px;border:1px solid #ccc;text-align:{align}'>{label}</th>"


def _ymh_section_label(title: str, color: str) -> str:
    return (
        f"<div style='margin-top:18px;margin-bottom:4px;font-weight:bold;"
        f"color:{color};font-size:10.5pt;border-left:4px solid {color};padding-left:8px'>"
        f"{title}</div>"
    )


def _build_ymh_giay(items: list, color: str) -> tuple[str, Decimal]:
    """Bảng giấy cuộn — hiện Mã giấy, Khổ (mm), Định lượng (g/m²), Ký hiệu."""
    accent = f"background:{color};color:#fff"
    header = (
        f"<thead><tr style='{accent}'>"
        + _th("STT", "4%") + _th("Tên hàng", "20%", "left")
        + _th("Mã giấy", "8%") + _th("Khổ (mm)", "7%")
        + _th("ĐL (g/m²)", "7%") + _th("Ký hiệu", "8%")
        + _th("ĐVT", "5%") + _th("Số lượng", "9%")
        + _th("Đơn giá DK", "10%") + _th("Thành tiền", "10%")
        + _th("Ngày cần", "8%") + _th("Ghi chú", "", "left")
        + "</tr></thead>"
    )
    rows = ""
    tong = Decimal("0")
    for i, it in enumerate(items, 1):
        pm = it.paper_material
        ten = it.ten_hang or (pm.ten if pm else "")
        ma_giay = (pm.ma_chinh or "") if pm else ""
        kho = f"{float(pm.kho):,.0f}" if pm and pm.kho else ""
        dl = f"{float(pm.dinh_luong):,.0f}" if pm and pm.dinh_luong else ""
        ky_hieu = (pm.ma_ky_hieu or "") if pm else ""
        don_gia = it.don_gia_du_kien or Decimal("0")
        thanh_tien = it.so_luong * don_gia
        tong += thanh_tien
        ngay = it.ngay_can.strftime("%d/%m/%Y") if it.ngay_can else ""
        rows += (
            f"<tr>"
            f"<td {_TDC}>{i}</td><td {_TD}>{_html_mod.escape(ten)}</td>"
            f"<td {_TDC}>{_html_mod.escape(ma_giay)}</td><td {_TDC}>{kho}</td>"
            f"<td {_TDC}>{dl}</td><td {_TDC}>{_html_mod.escape(ky_hieu)}</td>"
            f"<td {_TDC}>{_html_mod.escape(it.dvt or 'Kg')}</td>"
            f"<td {_TDR}>{float(it.so_luong):,.3f}</td>"
            f"<td {_TDR}>{int(don_gia):,}</td><td {_TDR}>{int(thanh_tien):,}</td>"
            f"<td {_TDC}>{ngay}</td><td {_TD}>{_html_mod.escape(it.ghi_chu or '')}</td>"
            f"</tr>"
        )
    rows += (
        f"<tr style='font-weight:bold;background:#f5f5f5'>"
        f"<td colspan='9' {_TDR}>Tổng cộng:</td>"
        f"<td {_TDR}>{int(tong):,}</td>"
        f"<td colspan='2' {_TD}></td></tr>"
    )
    html = f"<table style='width:100%;border-collapse:collapse;font-size:9.5pt'>{header}<tbody>{rows}</tbody></table>"
    return html, tong


def _build_ymh_nvl(items: list, color: str) -> tuple[str, Decimal]:
    """Bảng NVL khác — cột đơn giản."""
    accent = f"background:{color};color:#fff"
    header = (
        f"<thead><tr style='{accent}'>"
        + _th("STT", "4%") + _th("Tên hàng", "", "left")
        + _th("ĐVT", "7%") + _th("Số lượng", "10%")
        + _th("Đơn giá DK", "12%") + _th("Thành tiền", "12%")
        + _th("Ngày cần", "10%") + _th("Ghi chú", "15%", "left")
        + "</tr></thead>"
    )
    rows = ""
    tong = Decimal("0")
    for i, it in enumerate(items, 1):
        om = it.other_material
        ten = it.ten_hang or (om.ten if om else "")
        don_gia = it.don_gia_du_kien or Decimal("0")
        thanh_tien = it.so_luong * don_gia
        tong += thanh_tien
        ngay = it.ngay_can.strftime("%d/%m/%Y") if it.ngay_can else ""
        rows += (
            f"<tr>"
            f"<td {_TDC}>{i}</td><td {_TD}>{_html_mod.escape(ten)}</td>"
            f"<td {_TDC}>{_html_mod.escape(it.dvt or '')}</td>"
            f"<td {_TDR}>{float(it.so_luong):,.3f}</td>"
            f"<td {_TDR}>{int(don_gia):,}</td><td {_TDR}>{int(thanh_tien):,}</td>"
            f"<td {_TDC}>{ngay}</td><td {_TD}>{_html_mod.escape(it.ghi_chu or '')}</td>"
            f"</tr>"
        )
    rows += (
        f"<tr style='font-weight:bold;background:#f5f5f5'>"
        f"<td colspan='5' {_TDR}>Tổng cộng:</td>"
        f"<td {_TDR}>{int(tong):,}</td>"
        f"<td colspan='2' {_TD}></td></tr>"
    )
    html = f"<table style='width:100%;border-collapse:collapse;font-size:10pt'>{header}<tbody>{rows}</tbody></table>"
    return html, tong


def _build_ymh_dich_vu(items: list, color: str) -> tuple[str, Decimal]:
    """Bảng dịch vụ — bảo hiểm, khám sức khỏe, v.v."""
    accent = f"background:{color};color:#fff"
    header = (
        f"<thead><tr style='{accent}'>"
        + _th("STT", "4%") + _th("Tên dịch vụ", "", "left")
        + _th("ĐVT", "8%") + _th("Số lượng", "10%")
        + _th("Đơn giá DK", "13%") + _th("Thành tiền", "13%")
        + _th("Ngày cần", "10%") + _th("Ghi chú", "15%", "left")
        + "</tr></thead>"
    )
    rows = ""
    tong = Decimal("0")
    for i, it in enumerate(items, 1):
        don_gia = it.don_gia_du_kien or Decimal("0")
        thanh_tien = it.so_luong * don_gia
        tong += thanh_tien
        ngay = it.ngay_can.strftime("%d/%m/%Y") if it.ngay_can else ""
        rows += (
            f"<tr>"
            f"<td {_TDC}>{i}</td><td {_TD}>{_html_mod.escape(it.ten_hang or '')}</td>"
            f"<td {_TDC}>{_html_mod.escape(it.dvt or '')}</td>"
            f"<td {_TDR}>{float(it.so_luong):,.2f}</td>"
            f"<td {_TDR}>{int(don_gia):,}</td><td {_TDR}>{int(thanh_tien):,}</td>"
            f"<td {_TDC}>{ngay}</td><td {_TD}>{_html_mod.escape(it.ghi_chu or '')}</td>"
            f"</tr>"
        )
    rows += (
        f"<tr style='font-weight:bold;background:#f5f5f5'>"
        f"<td colspan='5' {_TDR}>Tổng cộng:</td>"
        f"<td {_TDR}>{int(tong):,}</td>"
        f"<td colspan='2' {_TD}></td></tr>"
    )
    html = f"<table style='width:100%;border-collapse:collapse;font-size:10pt'>{header}<tbody>{rows}</tbody></table>"
    return html, tong


def _build_ymh_cong_cu(items: list, color: str) -> tuple[str, Decimal]:
    """Bảng bản in / khuôn bế — hiện mã sản phẩm, loại công cụ."""
    accent = f"background:{color};color:#fff"
    header = (
        f"<thead><tr style='{accent}'>"
        + _th("STT", "4%") + _th("Tên hàng / Mã SP", "", "left")
        + _th("Loại", "9%") + _th("ĐVT", "6%")
        + _th("Số lượng", "9%") + _th("Đơn giá DK", "12%")
        + _th("Thành tiền", "12%") + _th("Ngày cần", "10%")
        + _th("Ghi chú", "15%", "left")
        + "</tr></thead>"
    )
    _LOAI = {"ban_in": "Bản in", "khuon_be": "Khuôn bế", "muc_in": "Mực in"}
    rows = ""
    tong = Decimal("0")
    for i, it in enumerate(items, 1):
        sp = it.san_pham
        ten = it.ten_hang or (
            f"{sp.ten_san_pham} ({sp.ma_san_pham})" if sp else ""
        )
        don_gia = it.don_gia_du_kien or Decimal("0")
        thanh_tien = it.so_luong * don_gia
        tong += thanh_tien
        ngay = it.ngay_can.strftime("%d/%m/%Y") if it.ngay_can else ""
        loai_label = _LOAI.get(it.loai_item or "", it.loai_item or "")
        rows += (
            f"<tr>"
            f"<td {_TDC}>{i}</td><td {_TD}>{_html_mod.escape(ten)}</td>"
            f"<td {_TDC}>{_html_mod.escape(loai_label)}</td>"
            f"<td {_TDC}>{_html_mod.escape(it.dvt or 'Cái')}</td>"
            f"<td {_TDR}>{float(it.so_luong):,.0f}</td>"
            f"<td {_TDR}>{int(don_gia):,}</td><td {_TDR}>{int(thanh_tien):,}</td>"
            f"<td {_TDC}>{ngay}</td><td {_TD}>{_html_mod.escape(it.ghi_chu or '')}</td>"
            f"</tr>"
        )
    rows += (
        f"<tr style='font-weight:bold;background:#f5f5f5'>"
        f"<td colspan='6' {_TDR}>Tổng cộng:</td>"
        f"<td {_TDR}>{int(tong):,}</td>"
        f"<td colspan='2' {_TD}></td></tr>"
    )
    html = f"<table style='width:100%;border-collapse:collapse;font-size:10pt'>{header}<tbody>{rows}</tbody></table>"
    return html, tong


@router.get("/{ymh_id}/print", response_class=HTMLResponse)
def print_ymh(
    ymh_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    ymh = (
        db.query(PurchaseRequisition)
        .options(
            selectinload(PurchaseRequisition.items).selectinload(PurchaseRequisitionItem.paper_material),
            selectinload(PurchaseRequisition.items).selectinload(PurchaseRequisitionItem.other_material),
            selectinload(PurchaseRequisition.items).selectinload(PurchaseRequisitionItem.san_pham),
        )
        .filter(PurchaseRequisition.id == ymh_id)
        .first()
    )
    if not ymh:
        raise HTTPException(404, "Không tìm thấy YMH")

    phap_nhan_id = ymh.phap_nhan_id
    if not phap_nhan_id and ymh.phan_xuong_id:
        px_tmp = db.get(PhanXuong, ymh.phan_xuong_id)
        if px_tmp:
            phap_nhan_id = px_tmp.phap_nhan_id

    tpl_q = db.query(PrintTemplate).filter(func.upper(PrintTemplate.ma_mau) == "PURCHASE_REQUISITION")
    tpl = tpl_q.filter(PrintTemplate.phap_nhan_id == phap_nhan_id).first() if phap_nhan_id else None
    if not tpl:
        tpl = tpl_q.filter(PrintTemplate.phap_nhan_id.is_(None)).first() or tpl_q.first()
    if not tpl:
        raise HTTPException(
            404,
            "Chưa có mẫu in PURCHASE_REQUISITION — vui lòng cấu hình trong Hệ thống > Mẫu in",
        )

    px = db.get(PhanXuong, ymh.phan_xuong_id) if ymh.phan_xuong_id else None
    pn = db.get(PhapNhan, phap_nhan_id) if phap_nhan_id else None
    settings = {s.key: s.value for s in db.query(SystemSetting).all()}

    pn_name = _html_mod.escape(
        (pn.ten_phap_nhan or pn.ten_viet_tat)
        if pn
        else (settings.get("company_name") or "CÔNG TY TNHH NAM PHƯƠNG BAO BÌ")
    )
    pn_details = _html_mod.escape(
        (pn.dia_chi or "") if pn else (settings.get("company_details") or "")
    )
    if pn and pn.ma_phap_nhan:
        logo_src = f"/api/phap-nhan/logo/{pn.ma_phap_nhan}"
    elif pn and pn.logo_path:
        logo_src = f"/{pn.logo_path}"
    else:
        logo_src = ""
    logo_img = (
        f'<img src="{logo_src}" style="max-width:100%;max-height:80px;object-fit:contain"/>'
        if logo_src
        else ""
    )

    # Read accent color from template easy_config
    try:
        import json as _json
        _ec = _json.loads(tpl.variables_meta.get("easy_config", "{}") if tpl.variables_meta else "{}")
        _color = _ec.get("headerColor") or "#4A148C"
    except Exception:
        _color = "#4A148C"

    # Group items by type
    items_giay = [it for it in ymh.items if it.paper_material_id]
    items_nvl = [it for it in ymh.items if not it.paper_material_id and it.loai_item == "nvl"]
    items_cong_cu = [it for it in ymh.items if it.loai_item in ("ban_in", "khuon_be", "muc_in")]
    items_dich_vu = [it for it in ymh.items if it.loai_item == "dich_vu"]

    # Build multi-section body_html
    body_parts = []
    tong = Decimal("0")

    if items_giay:
        tbl, t = _build_ymh_giay(items_giay, _color)
        tong += t
        body_parts.append(_ymh_section_label("Giấy cuộn", _color) + tbl)

    if items_nvl:
        tbl, t = _build_ymh_nvl(items_nvl, _color)
        tong += t
        body_parts.append(_ymh_section_label("Nguyên vật liệu khác", _color) + tbl)

    if items_cong_cu:
        tbl, t = _build_ymh_cong_cu(items_cong_cu, _color)
        tong += t
        body_parts.append(_ymh_section_label("Công cụ sản xuất (Bản in / Khuôn bế)", _color) + tbl)

    if items_dich_vu:
        tbl, t = _build_ymh_dich_vu(items_dich_vu, _color)
        tong += t
        body_parts.append(_ymh_section_label("Dịch vụ", _color) + tbl)

    # Grand total row when multiple sections
    if len(body_parts) > 1:
        body_parts.append(
            f"<div style='margin-top:10px;text-align:right;font-weight:bold;font-size:11pt'>"
            f"Tổng cộng tất cả: <span style='color:{_color}'>{int(tong):,} đồng</span></div>"
        )

    body_html = "".join(body_parts) if body_parts else (
        "<p style='color:#999;font-style:italic'>Không có mục nào trong phiếu.</p>"
    )

    ngay_str = ""
    if ymh.ngay_yeu_cau:
        d = ymh.ngay_yeu_cau
        ngay_str = f"{d.day:02d} tháng {d.month:02d} năm {d.year}"

    don_vi = _html_mod.escape(px.ten_xuong if px else "")
    replacements = {
        "{{document_number}}": _html_mod.escape(ymh.so_ymh or ""),
        "{{document_date}}": ngay_str,
        "{{company_name}}": pn_name,
        "{{company_details}}": pn_details,
        "{{logo_img}}": logo_img,
        "{{logo_src}}": logo_src,
        "{{don_vi_yeu_cau}}": don_vi,
        "{{nguoi_yeu_cau}}": _html_mod.escape(_user_name(ymh.nguoi_yeu_cau) or ""),
        "{{ghi_chu}}": _html_mod.escape(ymh.ghi_chu or ""),
        "{{body_html}}": body_html,
        "{{tong_du_kien}}": f"{int(tong):,} đồng",
        "{{sig_nguoi_yeu_cau}}": _html_mod.escape(_user_name(ymh.nguoi_yeu_cau) or ""),
        "{{sig_duyet_pb}}": _html_mod.escape(_user_name(ymh.nguoi_duyet_pb) or ""),
        "{{sig_duyet_gd}}": _html_mod.escape(_user_name(ymh.nguoi_duyet_gd) or ""),
        # Biến generic từ template designer — map sang trường tương ứng của YMH
        "{{subtitle}}": "PHIẾU YÊU CẦU MUA HÀNG",
        "{{SUBTITLE}}": "PHIẾU YÊU CẦU MUA HÀNG",
        "{{customer_name}}": don_vi,
        "{{delivery_address}}": "",
        "{{footer_html}}": "",
    }
    content = apply_template(tpl.html_content, replacements)

    page = (
        "<!DOCTYPE html><html lang='vi'><head><meta charset='UTF-8'>"
        f"<title>Phiếu YCMH {_html_mod.escape(ymh.so_ymh or '')}</title>"
        "<style>body{margin:0;padding:0}@media print{.no-print{display:none!important}}</style>"
        "</head><body>"
        "<div class='no-print' style='padding:10px;background:#f0f0f0;display:flex;gap:10px'>"
        "<button onclick='window.print()' style='padding:7px 18px;background:#4A148C;color:#fff;border:none;border-radius:4px;cursor:pointer'>🖨️ In phiếu YCMH</button>"
        "<button onclick='window.close()' style='padding:7px 14px;border:1px solid #ccc;border-radius:4px;cursor:pointer'>Đóng</button>"
        "</div>"
        f"{content}</body></html>"
    )
    return HTMLResponse(content=page)


@router.delete("/{ymh_id}")
def delete_ymh(
    ymh_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    ymh = db.get(PurchaseRequisition, ymh_id)
    if not ymh:
        raise HTTPException(404, "Không tìm thấy YMH")
    if ymh.trang_thai not in ("nhap", "huy", "tu_choi"):
        raise HTTPException(400, "Chỉ có thể xóa YMH ở trạng thái nháp, hủy hoặc từ chối")
    db.delete(ymh)
    db.commit()
    return {"ok": True}
