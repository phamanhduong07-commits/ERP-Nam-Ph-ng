from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.master import OtherMaterial, PaperMaterial, PhanXuong, PhapNhan, Supplier
from app.models.purchase import PurchaseOrder, PurchaseOrderItem
from app.models.purchase_requisition import PurchaseRequisition, PurchaseRequisitionItem

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
    current_user: User = Depends(require_roles("ADMIN", "MANAGER", "GIAM_DOC")),
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
    current_user: User = Depends(require_roles("ADMIN", "GIAM_DOC")),
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
    current_user: User = Depends(require_roles("ADMIN", "MANAGER", "GIAM_DOC")),
):
    ymh = db.get(PurchaseRequisition, ymh_id)
    if not ymh:
        raise HTTPException(404, "Không tìm thấy YMH")
    if ymh.trang_thai != "duyet_gd":
        raise HTTPException(400, "Chỉ tạo PO từ YMH đã được GĐ duyệt")
    if ymh.po_id:
        raise HTTPException(400, "YMH này đã tạo PO")
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
    db.commit()
    db.refresh(po)
    return {"ok": True, "po_id": po.id, "so_po": po.so_po, "trang_thai": ymh.trang_thai}


@router.post("/{ymh_id}/huy")
def huy_ymh(
    ymh_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "MANAGER", "GIAM_DOC")),
):
    ymh = db.get(PurchaseRequisition, ymh_id)
    if not ymh:
        raise HTTPException(404, "Không tìm thấy YMH")
    if ymh.trang_thai in ("tao_po",):
        raise HTTPException(400, "Không thể huỷ YMH đã tạo PO")
    ymh.trang_thai = "huy"
    db.commit()
    return {"ok": True}


@router.get("/{ymh_id}/print")
def print_ymh(
    ymh_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from fastapi.responses import HTMLResponse
    from app.models.master import Supplier
    ymh = db.get(PurchaseRequisition, ymh_id)
    if not ymh:
        raise HTTPException(404, "Không tìm thấy YMH")

    px = db.get(PhanXuong, ymh.phan_xuong_id) if ymh.phan_xuong_id else None
    pn = db.get(PhapNhan, ymh.phap_nhan_id) if ymh.phap_nhan_id else None
    ten_phap_nhan = (pn.ten_viet_tat or pn.ten_phap_nhan) if pn else "CÔNG TY TNHH NAM PHƯƠNG BAO BÌ"

    rows_html = ""
    tong = Decimal("0")
    for i, it in enumerate(ymh.items, 1):
        ten = it.ten_hang or ""
        if not ten and it.paper_material_id:
            pm = db.get(PaperMaterial, it.paper_material_id)
            ten = pm.ten if pm else ""
        if not ten and it.other_material_id:
            om = db.get(OtherMaterial, it.other_material_id)
            ten = om.ten if om else ""
        don_gia = it.don_gia_du_kien or Decimal("0")
        thanh_tien = it.so_luong * don_gia
        tong += thanh_tien
        ngay_can_str = it.ngay_can.strftime("%d/%m/%Y") if it.ngay_can else ""
        rows_html += f"""
        <tr>
          <td class="center">{i}</td>
          <td>{ten}</td>
          <td class="center">{it.dvt}</td>
          <td class="right">{float(it.so_luong):,.3f}</td>
          <td class="right">{int(don_gia):,}</td>
          <td class="right">{int(thanh_tien):,}</td>
          <td class="center">{ngay_can_str}</td>
          <td>{it.ghi_chu or ''}</td>
        </tr>"""

    ngay_str = ""
    if ymh.ngay_yeu_cau:
        d = ymh.ngay_yeu_cau
        ngay_str = f"Ngày {d.day:02d} tháng {d.month:02d} năm {d.year}"

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page {{ size: A4 portrait; margin: 15mm 12mm; }}
  * {{ box-sizing: border-box; }}
  body {{ font-family: 'Times New Roman', serif; font-size: 11pt; margin: 0; }}
  button {{ display: none; }}
  @media print {{ button {{ display: none; }} }}
  .header {{ display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }}
  .company-name {{ font-weight: bold; font-size: 13pt; color: #4A148C; }}
  .company-info {{ font-size: 8.5pt; line-height: 1.5; }}
  .mau {{ font-size: 8pt; text-align: right; color: #555; }}
  .divider {{ border: none; border-top: 2px solid #4A148C; margin: 6px 0 10px; }}
  .title {{ text-align: center; margin-bottom: 10px; }}
  .title h2 {{ margin: 0; font-size: 16pt; letter-spacing: 2px; text-transform: uppercase; }}
  .title .so {{ font-size: 9pt; margin-top: 2px; }}
  .title .date {{ font-size: 9pt; font-style: italic; }}
  .info-block {{ font-size: 10.5pt; line-height: 1.9; margin-bottom: 10px; }}
  .row {{ display: flex; margin: 3px 0; }}
  .row .label {{ min-width: 140px; font-weight: bold; flex-shrink: 0; }}
  .row .dots {{ flex: 1; border-bottom: 1px dotted #888; padding-bottom: 1px; }}
  table {{ width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 10pt; }}
  th {{ background: #4A148C; color: #fff; border: 1px solid #ccc; padding: 5px 4px; text-align: center; }}
  td {{ border: 1px solid #ccc; padding: 4px; }}
  .center {{ text-align: center; }}
  .right {{ text-align: right; }}
  .total-row td {{ font-weight: bold; background: #F3E5F5; }}
  .chu {{ font-size: 9.5pt; margin-bottom: 4px; }}
  .sig-table {{ width: 100%; border: none; margin-top: 20px; }}
  .sig-table td {{ border: none; text-align: center; vertical-align: top; width: 25%; }}
  .sig-label {{ font-weight: bold; }}
  .sig-sub {{ font-style: italic; font-size: 8.5pt; color: #555; }}
  .sig-name {{ margin-top: 40px; font-weight: bold; }}
</style>
</head>
<body>
<button onclick="window.print()" style="display:block;margin-bottom:10px;padding:6px 16px;background:#4A148C;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11pt;">In phiếu</button>

<div class="header">
  <div>
    <div class="company-name">{ten_phap_nhan}</div>
    <div class="company-info">Địa chỉ: TP. Hồ Chí Minh<br>ĐT: (028) xxxx xxxx</div>
  </div>
  <div class="mau">Biểu mẫu nội bộ</div>
</div>
<hr class="divider">

<div class="title">
  <h2>Phiếu yêu cầu mua hàng</h2>
  <div class="so">Số: <strong>{ymh.so_ymh}</strong></div>
  <div class="date">{ngay_str}</div>
</div>

<div class="info-block">
  <div class="row"><span class="label">Đơn vị yêu cầu</span><span class="dots">&nbsp;{px.ten_xuong if px else ''}</span></div>
  <div class="row"><span class="label">Người yêu cầu</span><span class="dots">&nbsp;{_user_name(ymh.nguoi_yeu_cau) or ''}</span></div>
  <div class="row"><span class="label">Ghi chú</span><span class="dots">&nbsp;{ymh.ghi_chu or ''}</span></div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:35px">STT</th>
      <th>Tên hàng</th>
      <th style="width:55px">ĐVT</th>
      <th style="width:80px">Số lượng</th>
      <th style="width:100px">Đơn giá DK</th>
      <th style="width:110px">Thành tiền</th>
      <th style="width:90px">Ngày cần</th>
      <th style="width:120px">Ghi chú</th>
    </tr>
  </thead>
  <tbody>
    {rows_html}
  </tbody>
  <tfoot>
    <tr class="total-row">
      <td colspan="5" class="right">TỔNG CỘNG</td>
      <td class="right">{int(tong):,}</td>
      <td colspan="2"></td>
    </tr>
  </tfoot>
</table>

<div class="chu">Tổng tiền dự kiến: <strong>{int(tong):,} đồng</strong></div>

<table class="sig-table">
  <tr>
    <td><div class="sig-label">Người yêu cầu</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name">{_user_name(ymh.nguoi_yeu_cau) or ''}</div></td>
    <td><div class="sig-label">Phụ trách phòng ban</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name">{_user_name(ymh.nguoi_duyet_pb) or ''}</div></td>
    <td><div class="sig-label">Phòng mua hàng</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name"></div></td>
    <td><div class="sig-label">Giám đốc</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name">{_user_name(ymh.nguoi_duyet_gd) or ''}</div></td>
  </tr>
</table>
</body></html>"""
    return HTMLResponse(content=html)


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
