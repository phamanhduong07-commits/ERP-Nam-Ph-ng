"""
Router: Phiếu khách trả hàng (phôi + thành phẩm)
GET    /api/phieu-tra-hang          — danh sách
POST   /api/phieu-tra-hang          — tạo mới (draft)
GET    /api/phieu-tra-hang/{id}     — chi tiết
PUT    /api/phieu-tra-hang/{id}     — sửa (chỉ khi draft)
DELETE /api/phieu-tra-hang/{id}     — xoá (chỉ khi draft)
POST   /api/phieu-tra-hang/{id}/confirm  — xác nhận → tồn kho + hạch toán
POST   /api/phieu-tra-hang/{id}/huy      — huỷ
"""
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_user, require_any_permission
from app.models.auth import User
from app.models.master import Customer, Warehouse, Product
from app.models.production import ProductionOrder
from app.models.warehouse_doc import DeliveryOrder
from app.models.phieu_tra_hang import PhieuTraHang, PhieuTraHangItem
from app.services.inventory_service import (
    get_or_create_balance, nhap_balance, log_tx,
)
from app.services.accounting_service import AccountingService

import logging
_log = logging.getLogger("erp")

router = APIRouter(
    prefix="/api/phieu-tra-hang",
    dependencies=[Depends(require_any_permission("inventory.view", "inventory.phoi_tp"))],
    tags=["phieu-tra-hang"],
)

LOAI_HANG_VALUES = {"PHOI", "THANH_PHAM"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class ItemIn(BaseModel):
    so_luong: int
    don_vi: Optional[str] = None
    tinh_trang: str = "tot"         # tot | loi
    chieu_kho: Optional[float] = None   # PHOI only
    chieu_cat: Optional[float] = None   # PHOI only
    product_id: Optional[int] = None    # THANH_PHAM only
    don_gia: Optional[float] = None
    ghi_chu: Optional[str] = None


class PhieuIn(BaseModel):
    ngay: date
    loai_hang: str                  # PHOI | THANH_PHAM
    customer_id: int
    production_order_id: Optional[int] = None
    delivery_order_id: Optional[int] = None
    warehouse_id: int
    ly_do_tra: Optional[str] = None
    nguoi_giao: Optional[str] = None
    ghi_chu: Optional[str] = None
    items: List[ItemIn] = []


class PhieuUpdate(BaseModel):
    ngay: Optional[date] = None
    delivery_order_id: Optional[int] = None
    warehouse_id: Optional[int] = None
    ly_do_tra: Optional[str] = None
    nguoi_giao: Optional[str] = None
    ghi_chu: Optional[str] = None
    items: Optional[List[ItemIn]] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_so_phieu(db: Session) -> str:
    today = date.today()
    prefix = f"TRH-{today.strftime('%Y%m%d')}-"
    last = (
        db.query(PhieuTraHang)
        .filter(PhieuTraHang.so_phieu.like(f"{prefix}%"))
        .order_by(PhieuTraHang.so_phieu.desc())
        .with_for_update()
        .first()
    )
    seq = (int(last.so_phieu[-3:]) + 1) if last else 1
    return f"{prefix}{seq:03d}"


def _item_to_dict(it: PhieuTraHangItem) -> dict:
    return {
        "id": it.id,
        "so_luong": it.so_luong,
        "don_vi": it.don_vi,
        "tinh_trang": it.tinh_trang,
        "chieu_kho": float(it.chieu_kho) if it.chieu_kho else None,
        "chieu_cat": float(it.chieu_cat) if it.chieu_cat else None,
        "product_id": it.product_id,
        "ten_san_pham": (it.product.ten_hang if it.product else None),
        "don_gia": float(it.don_gia) if it.don_gia else None,
        "thanh_tien": float(it.don_gia * it.so_luong) if it.don_gia else None,
        "ghi_chu": it.ghi_chu,
    }


def _phieu_to_dict(p: PhieuTraHang) -> dict:
    kh = p.customer
    order = p.production_order
    wh = p.warehouse
    return {
        "id": p.id,
        "so_phieu": p.so_phieu,
        "ngay": p.ngay.isoformat() if p.ngay else None,
        "loai_hang": p.loai_hang,
        "customer_id": p.customer_id,
        "ten_khach_hang": (kh.ten_viet_tat or kh.ten_kh) if kh else None,
        "production_order_id": p.production_order_id,
        "so_lenh": order.so_lenh if order else None,
        "delivery_order_id": p.delivery_order_id,
        "warehouse_id": p.warehouse_id,
        "ten_kho": wh.ten_kho if wh else None,
        "ly_do_tra": p.ly_do_tra,
        "trang_thai": p.trang_thai,
        "nguoi_giao": p.nguoi_giao,
        "ghi_chu": p.ghi_chu,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "confirmed_at": p.confirmed_at.isoformat() if p.confirmed_at else None,
        "tong_so_luong": sum(it.so_luong for it in p.items),
        "tong_tot": sum(it.so_luong for it in p.items if it.tinh_trang == "tot"),
        "tong_loi": sum(it.so_luong for it in p.items if it.tinh_trang == "loi"),
        "items": [_item_to_dict(it) for it in p.items],
    }


def _validate_body(body: PhieuIn) -> None:
    if body.loai_hang not in LOAI_HANG_VALUES:
        raise HTTPException(status_code=400, detail=f"loai_hang không hợp lệ: {body.loai_hang}")
    if body.loai_hang == "PHOI" and not body.production_order_id:
        raise HTTPException(status_code=400, detail="Trả phôi phải chọn LSX (production_order_id)")
    if not body.items:
        raise HTTPException(status_code=400, detail="Phiếu phải có ít nhất 1 dòng hàng")
    for it in body.items:
        if it.tinh_trang not in ("tot", "loi"):
            raise HTTPException(status_code=400, detail=f"tinh_trang không hợp lệ: {it.tinh_trang}")
        if body.loai_hang == "THANH_PHAM" and not it.product_id:
            raise HTTPException(status_code=400, detail="Trả thành phẩm phải chọn sản phẩm (product_id)")


def _make_items(db: Session, phieu_id: int, items_in: List[ItemIn], loai_hang: str) -> None:
    for it in items_in:
        don_vi = it.don_vi
        if not don_vi:
            don_vi = "Tấm" if loai_hang == "PHOI" else "Thùng"
        db.add(PhieuTraHangItem(
            phieu_id=phieu_id,
            so_luong=it.so_luong,
            don_vi=don_vi,
            tinh_trang=it.tinh_trang,
            chieu_kho=Decimal(str(it.chieu_kho)) if it.chieu_kho else None,
            chieu_cat=Decimal(str(it.chieu_cat)) if it.chieu_cat else None,
            product_id=it.product_id if loai_hang == "THANH_PHAM" else None,
            don_gia=Decimal(str(it.don_gia)) if it.don_gia else None,
            ghi_chu=it.ghi_chu,
        ))


def _load_with_relations(db: Session, phieu_id: int) -> PhieuTraHang:
    return (
        db.query(PhieuTraHang)
        .options(
            joinedload(PhieuTraHang.customer),
            joinedload(PhieuTraHang.production_order),
            joinedload(PhieuTraHang.warehouse),
            joinedload(PhieuTraHang.items).joinedload(PhieuTraHangItem.product),
        )
        .filter(PhieuTraHang.id == phieu_id)
        .first()
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("")
def list_phieu(
    loai_hang: Optional[str] = Query(default=None),
    customer_id: Optional[int] = Query(default=None),
    production_order_id: Optional[int] = Query(default=None),
    trang_thai: Optional[str] = Query(default=None),
    tu_ngay: Optional[date] = Query(default=None),
    den_ngay: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(PhieuTraHang).options(
        joinedload(PhieuTraHang.customer),
        joinedload(PhieuTraHang.production_order),
        joinedload(PhieuTraHang.warehouse),
        joinedload(PhieuTraHang.items).joinedload(PhieuTraHangItem.product),
    )
    if loai_hang:
        q = q.filter(PhieuTraHang.loai_hang == loai_hang)
    if customer_id:
        q = q.filter(PhieuTraHang.customer_id == customer_id)
    if production_order_id:
        q = q.filter(PhieuTraHang.production_order_id == production_order_id)
    if trang_thai:
        q = q.filter(PhieuTraHang.trang_thai == trang_thai)
    if tu_ngay:
        q = q.filter(PhieuTraHang.ngay >= tu_ngay)
    if den_ngay:
        q = q.filter(PhieuTraHang.ngay <= den_ngay)
    rows = q.order_by(PhieuTraHang.id.desc()).all()
    return [_phieu_to_dict(p) for p in rows]


@router.post("", status_code=201)
def create_phieu(
    body: PhieuIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _validate_body(body)
    phieu = PhieuTraHang(
        so_phieu=_generate_so_phieu(db),
        ngay=body.ngay,
        loai_hang=body.loai_hang,
        customer_id=body.customer_id,
        production_order_id=body.production_order_id,
        delivery_order_id=body.delivery_order_id,
        warehouse_id=body.warehouse_id,
        ly_do_tra=body.ly_do_tra,
        nguoi_giao=body.nguoi_giao,
        ghi_chu=body.ghi_chu,
        trang_thai="draft",
        created_by=current_user.id,
    )
    db.add(phieu)
    db.flush()
    _make_items(db, phieu.id, body.items, body.loai_hang)
    db.commit()
    p = _load_with_relations(db, phieu.id)
    return _phieu_to_dict(p)


@router.get("/{phieu_id}")
def get_phieu(
    phieu_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = _load_with_relations(db, phieu_id)
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu")
    return _phieu_to_dict(p)


@router.put("/{phieu_id}")
def update_phieu(
    phieu_id: int,
    body: PhieuUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = db.query(PhieuTraHang).filter(PhieuTraHang.id == phieu_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu")
    if p.trang_thai != "draft":
        raise HTTPException(status_code=400, detail="Chỉ sửa được phiếu ở trạng thái draft")

    if body.ngay is not None:
        p.ngay = body.ngay
    if body.warehouse_id is not None:
        p.warehouse_id = body.warehouse_id
    if body.delivery_order_id is not None:
        p.delivery_order_id = body.delivery_order_id
    if body.ly_do_tra is not None:
        p.ly_do_tra = body.ly_do_tra
    if body.nguoi_giao is not None:
        p.nguoi_giao = body.nguoi_giao
    if body.ghi_chu is not None:
        p.ghi_chu = body.ghi_chu

    if body.items is not None:
        for it in p.items:
            db.delete(it)
        db.flush()
        for it in body.items:
            if it.tinh_trang not in ("tot", "loi"):
                raise HTTPException(status_code=400, detail=f"tinh_trang không hợp lệ: {it.tinh_trang}")
        _make_items(db, p.id, body.items, p.loai_hang)

    db.commit()
    p = _load_with_relations(db, phieu_id)
    return _phieu_to_dict(p)


@router.delete("/{phieu_id}", status_code=204)
def delete_phieu(
    phieu_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = db.query(PhieuTraHang).filter(PhieuTraHang.id == phieu_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu")
    if p.trang_thai != "draft":
        raise HTTPException(status_code=400, detail="Chỉ xoá được phiếu ở trạng thái draft")
    db.delete(p)
    db.commit()


@router.post("/{phieu_id}/confirm")
def confirm_phieu(
    phieu_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = (
        db.query(PhieuTraHang)
        .options(
            joinedload(PhieuTraHang.items).joinedload(PhieuTraHangItem.product),
            joinedload(PhieuTraHang.production_order).joinedload(ProductionOrder.items),
            joinedload(PhieuTraHang.warehouse),
        )
        .filter(PhieuTraHang.id == phieu_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu")
    if p.trang_thai != "draft":
        raise HTTPException(status_code=400, detail="Phiếu đã xác nhận hoặc đã huỷ")
    if not p.items:
        raise HTTPException(status_code=400, detail="Phiếu không có dòng hàng nào")

    order = p.production_order
    phap_nhan_id = order.phap_nhan_id if order else None
    phan_xuong_id = order.phan_xuong_id if order else None

    journal_items = []

    for it in p.items:
        if it.tinh_trang != "tot":
            continue

        qty = Decimal(str(it.so_luong))
        don_gia = it.don_gia or Decimal("0")
        don_vi = it.don_vi or ("Tấm" if p.loai_hang == "PHOI" else "Thùng")

        if p.loai_hang == "PHOI":
            # ten_hang từ LSX
            ten_hang = ""
            if order and order.items:
                ten_hang = order.items[0].ten_hang or ""
            balance = get_or_create_balance(
                db, p.warehouse_id, ten_hang=ten_hang, don_vi=don_vi, lock=True
            )
            nhap_balance(balance, qty, don_gia if don_gia > 0 else balance.don_gia_binh_quan)
            log_tx(
                db,
                warehouse_id=p.warehouse_id,
                loai="NHAP_TRA_PHOI_KHACH",
                so_luong=qty,
                don_gia=don_gia,
                ton_sau=balance.ton_luong,
                chung_tu_loai="phieu_tra_hang",
                chung_tu_id=p.id,
                created_by=current_user.id,
                production_order_id=p.production_order_id,
            )
            if don_gia > 0:
                journal_items.append({
                    "ten_hang": ten_hang or f"Phôi LSX {order.so_lenh if order else ''}",
                    "so_luong": float(qty),
                    "don_gia": float(don_gia),
                    "tk_no": "155",
                    "tk_co": "632",
                })

        else:  # THANH_PHAM
            product = it.product
            ten_hang = ""
            if product:
                ten_hang = product.ten_hang or product.ma_hang or ""
            balance = get_or_create_balance(
                db, p.warehouse_id,
                product_id=it.product_id,
                ten_hang=ten_hang,
                don_vi=don_vi,
                lock=True,
            )
            nhap_balance(balance, qty, don_gia if don_gia > 0 else balance.don_gia_binh_quan)
            log_tx(
                db,
                warehouse_id=p.warehouse_id,
                loai="NHAP_TRA_THANH_PHAM_KHACH",
                so_luong=qty,
                don_gia=don_gia,
                ton_sau=balance.ton_luong,
                chung_tu_loai="phieu_tra_hang",
                chung_tu_id=p.id,
                created_by=current_user.id,
                production_order_id=p.production_order_id,
            )
            if don_gia > 0:
                journal_items.append({
                    "ten_hang": ten_hang,
                    "so_luong": float(qty),
                    "don_gia": float(don_gia),
                    "tk_no": "155",
                    "tk_co": "632",
                })

    if journal_items:
        acc_service = AccountingService(db)
        loai_journal = "NHAP_TRA_PHOI_KHACH" if p.loai_hang == "PHOI" else "NHAP_TRA_THANH_PHAM_KHACH"
        acc_service.post_inventory_journal(
            ngay=p.ngay,
            loai=loai_journal,
            chung_tu_loai="phieu_tra_hang",
            chung_tu_id=p.id,
            items=journal_items,
            phap_nhan_id=phap_nhan_id,
            phan_xuong_id=phan_xuong_id,
        )

    p.trang_thai = "confirmed"
    p.confirmed_by = current_user.id
    p.confirmed_at = datetime.now(timezone.utc)
    db.commit()

    p = _load_with_relations(db, phieu_id)
    return _phieu_to_dict(p)


def _render_print_html(p: PhieuTraHang) -> str:
    kh = p.customer
    order = p.production_order
    wh = p.warehouse

    ten_khach = (kh.ten_viet_tat or kh.ten_kh) if kh else ""
    so_lenh = order.so_lenh if order else ""
    ten_kho = wh.ten_kho if wh else ""

    ngay = p.ngay
    ngay_str = f"Ngày {ngay.day} tháng {ngay.month} năm {ngay.year}" if ngay else ""

    is_phoi = p.loai_hang == "PHOI"
    loai_label = "Phôi (giấy tấm)" if is_phoi else "Thành phẩm"

    tong_tien = Decimal("0")
    rows_html = ""
    for i, it in enumerate(p.items, 1):
        if is_phoi:
            kho_s = f"{float(it.chieu_kho):.0f}" if it.chieu_kho else ""
            cat_s = f"{float(it.chieu_cat):.0f}" if it.chieu_cat else ""
            ten_hang = f"{kho_s}×{cat_s}" if kho_s and cat_s else (kho_s or cat_s or "—")
            kich_thuoc_cells = f"<td class='center'>{kho_s}</td><td class='center'>{cat_s}</td>"
        else:
            ten_hang = (it.product.ten_hang if it.product else "") or ""
            kich_thuoc_cells = ""

        don_gia = it.don_gia or Decimal("0")
        thanh_tien = don_gia * it.so_luong
        tong_tien += thanh_tien
        tinh_trang_label = "Tốt" if it.tinh_trang == "tot" else "Lỗi"

        don_gia_str = f"{float(don_gia):,.0f}" if don_gia else "—"
        thanh_tien_str = f"{float(thanh_tien):,.0f}" if thanh_tien else "—"

        rows_html += (
            f"<tr><td class='center'>{i}</td><td>{ten_hang}</td>"
            f"{kich_thuoc_cells}"
            f"<td class='right'>{it.so_luong:,}</td>"
            f"<td class='center'>{it.don_vi or ''}</td>"
            f"<td class='center'>{tinh_trang_label}</td>"
            f"<td class='right'>{don_gia_str}</td>"
            f"<td class='right'>{thanh_tien_str}</td></tr>"
        )

    th_extra = "<th>Khổ (mm)</th><th>Cắt (mm)</th>" if is_phoi else ""
    colspan_total = 8 if is_phoi else 6
    tong_tien_str = f"{float(tong_tien):,.0f}"
    so_lenh_row = (
        f"<div class='row'><span class='label'>Lệnh SX:</span>"
        f"<span class='dots'>&nbsp;{so_lenh}</span></div>"
    ) if so_lenh else ""
    ghi_chu_block = (
        f"<div style='font-size:10pt;margin-bottom:8px'>"
        f"<em>Ghi chú: {p.ghi_chu}</em></div>"
    ) if p.ghi_chu else ""

    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Phiếu trả hàng {p.so_phieu}</title>
<style>
  @page {{ size: A4 portrait; margin: 15mm 12mm; }}
  body {{ font-family: 'Times New Roman', serif; font-size: 11pt; color: #000; margin: 0; }}
  .no-print {{ margin-bottom: 12px; }}
  @media print {{ .no-print {{ display: none; }} }}
  .header {{ display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }}
  .company-name {{ font-weight: bold; font-size: 12pt; color: #E65100; }}
  .company-info {{ font-size: 8.5pt; line-height: 1.5; }}
  .mau {{ font-size: 8pt; text-align: right; color: #555; }}
  hr.divider {{ border: none; border-top: 2px solid #E65100; margin: 6px 0 10px; }}
  .title {{ text-align: center; margin-bottom: 10px; }}
  .title h2 {{ font-size: 16pt; font-weight: bold; letter-spacing: 2px; margin: 0; text-transform: uppercase; }}
  .title .so {{ font-size: 9pt; margin-top: 4px; }}
  .title .date {{ font-size: 9pt; font-style: italic; }}
  .info-block {{ font-size: 10.5pt; line-height: 1.9; margin-bottom: 10px; }}
  .row {{ display: flex; margin: 3px 0; }}
  .row .label {{ min-width: 140px; font-weight: bold; flex-shrink: 0; }}
  .row .dots {{ flex: 1; border-bottom: 1px dotted #888; padding-bottom: 1px; }}
  table {{ width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 10pt; }}
  th {{ background: #E65100; color: #fff; border: 1px solid #ccc; padding: 5px 4px; text-align: center; }}
  td {{ border: 1px solid #ccc; padding: 4px; }}
  .total-row td {{ font-weight: bold; background: #FFF3E0; }}
  .center {{ text-align: center; }}
  .right {{ text-align: right; }}
  .sig-table {{ width: 100%; border-collapse: collapse; margin-top: 30px; }}
  .sig-table td {{ border: none; text-align: center; vertical-align: top; width: 33%; padding: 0; }}
  .sig-label {{ font-weight: bold; }}
  .sig-sub {{ font-style: italic; font-size: 8.5pt; color: #555; }}
  .sig-name {{ margin-top: 40px; font-weight: bold; }}
</style>
</head>
<body>
<div class="no-print">
  <button onclick="window.print()" style="padding:6px 18px;font-size:13px;cursor:pointer;">🖨️ In phiếu</button>
</div>

<div class="header">
  <div>
    <div class="company-name">CÔNG TY TNHH NAM PHƯƠNG BAO BÌ</div>
    <div class="company-info">
      TP. Hồ Chí Minh<br>
      MST: 0301234567
    </div>
  </div>
  <div class="mau">Mẫu nội bộ</div>
</div>
<hr class="divider">

<div class="title">
  <h2>Phiếu khách trả hàng</h2>
  <div class="so">Số: <strong>{p.so_phieu}</strong></div>
  <div class="date">{ngay_str}</div>
</div>

<div class="info-block">
  <div class="row"><span class="label">Khách hàng:</span><span class="dots">&nbsp;{ten_khach}</span></div>
  <div class="row"><span class="label">Loại hàng:</span><span class="dots">&nbsp;{loai_label}</span></div>
  {so_lenh_row}
  <div class="row"><span class="label">Kho nhận:</span><span class="dots">&nbsp;{ten_kho}</span></div>
  <div class="row"><span class="label">Người giao:</span><span class="dots">&nbsp;{p.nguoi_giao or ''}</span></div>
  <div class="row"><span class="label">Lý do trả:</span><span class="dots">&nbsp;{p.ly_do_tra or ''}</span></div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:30px">STT</th>
      <th>Tên hàng / Sản phẩm</th>
      {th_extra}
      <th style="width:65px">Số lượng</th>
      <th style="width:50px">ĐVT</th>
      <th style="width:65px">Tình trạng</th>
      <th style="width:95px">Đơn giá</th>
      <th style="width:100px">Thành tiền</th>
    </tr>
  </thead>
  <tbody>
    {rows_html}
    <tr class="total-row">
      <td colspan="{colspan_total}" class="right">TỔNG CỘNG</td>
      <td class="right">{tong_tien_str}</td>
    </tr>
  </tbody>
</table>

{ghi_chu_block}

<table class="sig-table">
  <tr>
    <td>
      <div class="sig-label">Người giao hàng</div>
      <div class="sig-sub">(Ký, họ tên)</div>
      <div class="sig-name">{p.nguoi_giao or ''}</div>
    </td>
    <td>
      <div class="sig-label">Thủ kho</div>
      <div class="sig-sub">(Ký, họ tên)</div>
      <div class="sig-name"></div>
    </td>
    <td>
      <div class="sig-label">Người lập phiếu</div>
      <div class="sig-sub">(Ký, họ tên)</div>
      <div class="sig-name"></div>
    </td>
  </tr>
</table>
</body>
</html>"""


@router.get("/{phieu_id}/print", response_class=HTMLResponse)
def print_phieu(
    phieu_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = _load_with_relations(db, phieu_id)
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu")
    return _render_print_html(p)


@router.post("/{phieu_id}/huy")
def huy_phieu(
    phieu_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = db.query(PhieuTraHang).filter(PhieuTraHang.id == phieu_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu")
    if p.trang_thai == "confirmed":
        raise HTTPException(
            status_code=400,
            detail="Phiếu đã xác nhận — liên hệ kế toán để xử lý bút toán đảo trước khi huỷ"
        )
    p.trang_thai = "huy"
    db.commit()
    return {"ok": True, "so_phieu": p.so_phieu}
