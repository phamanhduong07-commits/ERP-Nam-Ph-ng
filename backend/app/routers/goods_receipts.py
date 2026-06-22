"""Warehouse router — phiếu nhập kho (GoodsReceipt) + giấy cuộn (GiayRoll).

Split out of app/routers/warehouse.py (pure structural extraction).
Shares the /api/warehouse prefix; mounted alongside warehouse.router.
"""
import html as _html_mod
from datetime import date, datetime, timezone
from decimal import Decimal
from app.utils.template import apply_template, standard_vars
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload, selectinload
from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.master import Warehouse, PaperMaterial, PhanXuong, PhapNhan, Supplier
from app.models.purchase import PurchaseOrder, PurchaseOrderItem, PurchaseReturn
from app.models.accounting import PurchaseInvoice, JournalEntry
from app.models.quality import QCGiayCuonPhieu
from app.models.warehouse_doc import (
    GoodsReceipt, GoodsReceiptItem,
    GiayRoll,
)
from app.models.production import ProductionSession, ProductionSessionRoll
from app.services.accounting_service import AccountingService
from app.models.system import PrintTemplate, SystemSetting
from app.utils.log import get_logger

logger = get_logger(__name__)

from app.services.inventory_service import (
    get_or_create_balance as _get_or_create_balance,
    nhap_balance as _nhap_balance,
    xuat_balance as _xuat_balance,
    log_tx as _log_tx,
    get_workshop_warehouse as _get_workshop_warehouse,
)

from app.routers.warehouse import (  # shared schemas + helpers
    GoodsReceiptIn,
    QuickCaptureIn,
    GoodsReceiptCompleteIn,
    _gen_so,
    _resolve_nvl_name,
    _ensure_active_warehouse,
    _recalc_purchase_order_receipt_status,
)

router = APIRouter(prefix="/api/warehouse", tags=["warehouse"])


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
    # Pre-aggregate co_hoa_don and qc_phieu_id per GR — avoid N+1 queries in _gr_to_dict
    gr_ids = [r.id for r in rows]
    co_hoa_don_set: set[int] = set()
    qc_map: dict[int, int] = {}
    barcode_flat: dict[int, str] = {}
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
        qc_rows = (
            db.query(QCGiayCuonPhieu.goods_receipt_id, QCGiayCuonPhieu.id)
            .filter(QCGiayCuonPhieu.goods_receipt_id.in_(gr_ids))
            .all()
        )
        qc_map = {row.goods_receipt_id: row.id for row in qc_rows}
        all_item_ids = [it.id for r in rows for it in r.items]
        barcode_flat: dict[int, str] = {}
        if all_item_ids:
            roll_rows = (
                db.query(GiayRoll.goods_receipt_item_id, GiayRoll.barcode)
                .filter(GiayRoll.goods_receipt_item_id.in_(all_item_ids))
                .all()
            )
            barcode_flat = {rr.goods_receipt_item_id: rr.barcode for rr in roll_rows}
    per_gr_barcode: dict[int, dict] = {
        r.id: {it.id: barcode_flat.get(it.id) for it in r.items}
        for r in rows
    }
    return [_gr_to_dict(r, db, include_image=False, co_hoa_don_override=r.id in co_hoa_don_set, qc_phieu_id=qc_map.get(r.id), barcode_map=per_gr_barcode.get(r.id, {})) for r in rows]


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


@router.get("/goods-receipts/{gr_id}/print", response_class=HTMLResponse)
def print_goods_receipt(gr_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    gr = db.query(GoodsReceipt).options(selectinload(GoodsReceipt.items)).filter(GoodsReceipt.id == gr_id).first()
    if not gr:
        raise HTTPException(404, "Không tìm thấy phiếu nhập")

    phap_nhan_id = gr.phap_nhan_id
    if not phap_nhan_id and gr.warehouse_id:
        wh = db.get(Warehouse, gr.warehouse_id)
        if wh and wh.phan_xuong_id:
            px = db.get(PhanXuong, wh.phan_xuong_id)
            if px:
                phap_nhan_id = px.phap_nhan_id

    tpl_q = db.query(PrintTemplate).filter(PrintTemplate.ma_mau == "GOODS_RECEIPT")
    tpl = tpl_q.filter(PrintTemplate.phap_nhan_id == phap_nhan_id).first() if phap_nhan_id else None
    if not tpl:
        tpl = tpl_q.filter(PrintTemplate.phap_nhan_id.is_(None)).first() or tpl_q.first()
    if not tpl:
        raise HTTPException(404, "Chưa có mẫu in GOODS_RECEIPT — vui lòng cấu hình trong Hệ thống > Mẫu in")

    settings = {s.key: s.value for s in db.query(SystemSetting).all()}
    pn = db.get(PhapNhan, phap_nhan_id) if phap_nhan_id else None
    logo_src = (
        f"/api/phap-nhan/logo/{pn.ma_phap_nhan}" if pn and pn.ma_phap_nhan
        else settings.get("logo_url") or ""
    )
    sup = db.get(Supplier, gr.supplier_id) if gr.supplier_id else None
    wh_obj = db.get(Warehouse, gr.warehouse_id) if gr.warehouse_id else None

    rows = ""
    tong = Decimal("0")
    for i, it in enumerate(gr.items, 1):
        thanh_tien = Decimal(str(it.thanh_tien or 0))
        tong += thanh_tien
        rows += (
            f"<tr>"
            f"<td style='text-align:center'>{i}</td>"
            f"<td>{_html_mod.escape(it.ten_hang or '')}</td>"
            f"<td style='text-align:center'>{_html_mod.escape(it.dvt or '')}</td>"
            f"<td style='text-align:center'>{it.kho_mm or ''}</td>"
            f"<td style='text-align:center'>{it.so_lop or ''}</td>"
            f"<td style='text-align:center'>{_html_mod.escape(it.ky_hieu_cuon or '')}</td>"
            f"<td style='text-align:center'>{it.so_cuon or ''}</td>"
            f"<td style='text-align:right'>{float(it.so_luong):,.3f}</td>"
            f"<td style='text-align:right'>{int(Decimal(str(it.don_gia or 0))):,}</td>"
            f"<td style='text-align:right'>{int(thanh_tien):,}</td>"
            f"</tr>"
        )
    body_html = (
        "<table style='width:100%;border-collapse:collapse;font-size:10pt'>"
        "<thead><tr style='background:#1B5E20;color:#fff'>"
        "<th style='width:4%;padding:4px;border:1px solid #ccc'>STT</th>"
        "<th style='padding:4px;border:1px solid #ccc'>Tên hàng</th>"
        "<th style='width:7%;padding:4px;border:1px solid #ccc'>ĐVT</th>"
        "<th style='width:7%;padding:4px;border:1px solid #ccc'>Khổ</th>"
        "<th style='width:5%;padding:4px;border:1px solid #ccc'>ĐL</th>"
        "<th style='width:9%;padding:4px;border:1px solid #ccc'>Ký hiệu</th>"
        "<th style='width:7%;padding:4px;border:1px solid #ccc'>Số cuộn</th>"
        "<th style='width:9%;padding:4px;border:1px solid #ccc'>Số lượng</th>"
        "<th style='width:10%;padding:4px;border:1px solid #ccc'>Đơn giá</th>"
        "<th style='width:11%;padding:4px;border:1px solid #ccc'>Thành tiền</th>"
        "</tr></thead><tbody>"
        + rows
        + "</tbody></table>"
    )

    replacements = {
        **standard_vars(subtitle="PHIẾU NHẬP KHO", customer_name=_html_mod.escape(sup.ten_viet_tat if sup else "")),
        "{{document_number}}": _html_mod.escape(gr.so_phieu or ""),
        "{{document_date}}": str(gr.ngay_nhap) if gr.ngay_nhap else "",
        "{{supplier_name}}": _html_mod.escape(sup.ten_viet_tat if sup else ""),
        "{{warehouse_name}}": _html_mod.escape(wh_obj.ten_kho if wh_obj else ""),
        "{{body_html}}": body_html,
        "{{tong_tien}}": f"{int(tong):,}",
        "{{tong_tien_chu}}": f"<b>Tổng cộng: {int(tong):,} đồng</b>",
        "{{company_name}}": _html_mod.escape(settings.get("company_name") or "CÔNG TY TNHH NAM PHƯƠNG BAO BÌ"),
        "{{company_details}}": _html_mod.escape(settings.get("company_details") or ""),
        "{{logo_img}}": f'<img src="{logo_src}" style="max-height:50px;max-width:100%;object-fit:contain"/>' if logo_src else "",
    }
    content = apply_template(tpl.html_content, replacements)
    page = (
        "<!DOCTYPE html><html lang='vi'><head><meta charset='UTF-8'>"
        f"<title>Phiếu nhập kho {_html_mod.escape(gr.so_phieu or '')}</title>"
        "<style>body{margin:0;padding:0}@media print{.no-print{display:none!important}}</style>"
        "</head><body>"
        "<div class='no-print' style='padding:10px;background:#f0f0f0;display:flex;gap:10px'>"
        "<button onclick='window.print()' style='padding:7px 18px;background:#1B5E20;color:#fff;border:none;border-radius:4px;cursor:pointer'>🖨️ In phiếu</button>"
        "<button onclick='window.close()' style='padding:7px 14px;border:1px solid #ccc;border-radius:4px;cursor:pointer'>Đóng</button>"
        "</div>"
        f"{content}</body></html>"
    )
    return HTMLResponse(content=page)


@router.get("/goods-receipts/{gr_id}/export-excel")
def export_goods_receipt_excel(gr_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    from app.services.excel_export_service import build_xlsx
    gr = db.query(GoodsReceipt).options(selectinload(GoodsReceipt.items)).filter(GoodsReceipt.id == gr_id).first()
    if not gr:
        raise HTTPException(404, "Không tìm thấy phiếu nhập")

    phap_nhan_id = gr.phap_nhan_id
    if not phap_nhan_id and gr.warehouse_id:
        wh = db.get(Warehouse, gr.warehouse_id)
        if wh and wh.phan_xuong_id:
            px = db.get(PhanXuong, wh.phan_xuong_id)
            if px:
                phap_nhan_id = px.phap_nhan_id

    from app.models.system import ExcelTemplate
    tpl_q = db.query(ExcelTemplate).filter(ExcelTemplate.ma_mau == "GOODS_RECEIPT")
    tpl = tpl_q.filter(ExcelTemplate.phap_nhan_id == phap_nhan_id).first() if phap_nhan_id else None
    if not tpl:
        tpl = tpl_q.filter(ExcelTemplate.phap_nhan_id.is_(None)).first() or tpl_q.first()
    if not tpl:
        raise HTTPException(404, "Chưa cấu hình mẫu Excel GOODS_RECEIPT")

    sup = db.get(Supplier, gr.supplier_id) if gr.supplier_id else None
    wh_obj = db.get(Warehouse, gr.warehouse_id) if gr.warehouse_id else None
    pn = db.get(PhapNhan, phap_nhan_id) if phap_nhan_id else None

    meta = {
        "document_number": gr.so_phieu or "",
        "document_date": str(gr.ngay_nhap) if gr.ngay_nhap else "",
        "supplier_name": sup.ten_viet_tat if sup else "",
        "warehouse_name": wh_obj.ten_kho if wh_obj else "",
        "loai_nhap": gr.loai_nhap or "",
        "so_xe": gr.so_xe or "",
        "ghi_chu": gr.ghi_chu or "",
    }
    company_info = {
        "ten": (pn.ten_phap_nhan if pn else ""),
        "dia_chi": getattr(pn, "dia_chi", "") or "",
        "dien_thoai": getattr(pn, "so_dien_thoai", "") or "",
        "ma_so_thue": getattr(pn, "ma_so_thue", "") or "",
    }

    items_data = [
        {
            "stt": i,
            "ten_hang": it.ten_hang or "",
            "dvt": it.dvt or "",
            "kho_mm": float(it.kho_mm) if it.kho_mm else "",
            "so_lop": it.so_lop or "",
            "ky_hieu_cuon": it.ky_hieu_cuon or "",
            "so_cuon": it.so_cuon or "",
            "so_luong": float(it.so_luong),
            "don_gia": float(it.don_gia),
            "thanh_tien": float(it.thanh_tien),
            "dinh_luong_thuc_te": float(it.dinh_luong_thuc_te) if it.dinh_luong_thuc_te else "",
            "do_am": float(it.do_am) if it.do_am else "",
            "ghi_chu": it.ghi_chu or "",
        }
        for i, it in enumerate(gr.items, 1)
    ]

    xlsx_bytes = build_xlsx(tpl, items_data, meta, company_info)
    filename = f"PNK_{gr.so_phieu or gr_id}.xlsx"
    return StreamingResponse(
        iter([xlsx_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/goods-receipts/{gr_id}/tao-phieu-qc", status_code=201)
def tao_phieu_qc(
    gr_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Tạo phiếu QC giấy cuộn từ phiếu nhập. 409 nếu đã có QC."""
    gr = db.query(GoodsReceipt).options(selectinload(GoodsReceipt.items)).filter(GoodsReceipt.id == gr_id).first()
    if not gr:
        raise HTTPException(404, "Không tìm thấy phiếu nhập")

    existing = db.query(QCGiayCuonPhieu.id, QCGiayCuonPhieu.so_phieu).filter(
        QCGiayCuonPhieu.goods_receipt_id == gr_id
    ).first()
    if existing:
        raise HTTPException(409, f"Đã tạo phiếu QC: {existing.so_phieu} (id={existing.id})")

    items_with_pm = [it for it in gr.items if it.paper_material_id]
    if not items_with_pm:
        raise HTTPException(400, "Phiếu nhập không có item giấy cuộn (paper_material_id)")

    pm_id = items_with_pm[0].paper_material_id
    pm = db.get(PaperMaterial, pm_id)

    today_str = date.today().strftime("%Y%m%d")
    prefix = f"QCGC-{today_str}-"
    last = (
        db.query(QCGiayCuonPhieu)
        .filter(QCGiayCuonPhieu.so_phieu.like(f"{prefix}%"))
        .order_by(QCGiayCuonPhieu.id.desc())
        .first()
    )
    seq = int(last.so_phieu.split("-")[-1]) + 1 if last else 1
    so_phieu = f"{prefix}{seq:03d}"

    obj = QCGiayCuonPhieu(
        so_phieu=so_phieu,
        paper_material_id=pm_id,
        goods_receipt_id=gr_id,
        goods_receipt_item_id=items_with_pm[0].id,
        ngay_nhap_giay=gr.ngay_nhap,
        ngay_kiem_tra=date.today(),
        created_by=user.id,
        tc_dinh_luong=float(pm.dinh_luong) if pm and pm.dinh_luong is not None else None,
        tc_sai_so_pct=float(pm.sai_so_pct) if pm and pm.sai_so_pct is not None else None,
        tc_do_buc=float(pm.do_buc_tieu_chuan) if pm and pm.do_buc_tieu_chuan is not None else None,
        tc_do_nen_vong=float(pm.do_nen_vong_tc) if pm and pm.do_nen_vong_tc is not None else None,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return {"qc_phieu_id": obj.id, "so_phieu": obj.so_phieu}


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

    try:
        gr = db.get(GoodsReceipt, gr_id)
        if not gr:
            raise HTTPException(404, "Không tìm thấy phiếu")

        upload_base = Path(__file__).parent.parent.parent / "uploads"
        img_path: Path | None = None

        # Ưu tiên erp_media (file vật lý), fallback sang invoice_image (base64 DB)
        media_row = db.execute(
            _sql("SELECT filepath FROM erp_media WHERE module='goods_receipts' AND record_id=:rid ORDER BY id DESC LIMIT 1"),
            {"rid": str(gr_id)},
        ).fetchone()
        if media_row:
            p = upload_base / media_row.filepath
            if p.is_file():
                img_path = p

        if img_path is None and gr.invoice_image:
            import base64, tempfile, mimetypes
            raw = gr.invoice_image
            if "," in raw:
                header, data = raw.split(",", 1)
                ext = ".jpg"
                if "png" in header:
                    ext = ".png"
            else:
                data, ext = raw, ".jpg"
            img_bytes = base64.b64decode(data)
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
            tmp.write(img_bytes)
            tmp.close()
            img_path = Path(tmp.name)

        if img_path is None:
            raise HTTPException(404, "Phiếu này chưa có ảnh — bảo vệ cần upload ảnh trước")

        from app.utils.ocr import extract_delivery_slip, identify_supplier

        # Bước 1: Nhận diện NCC + few-shot (nếu import được)
        few_shot = []
        detected_supplier = None
        try:
            from app.routers.ocr_examples import get_examples_for_supplier
            from app.models.warehouse_doc import OcrSupplierExample
            has_examples = db.query(OcrSupplierExample.id).limit(1).scalar() is not None
            if has_examples:
                detected_supplier = identify_supplier(str(img_path))
                if detected_supplier:
                    few_shot = get_examples_for_supplier(detected_supplier, db, limit=3)
        except ImportError:
            pass  # few-shot chưa sẵn sàng → zero-shot

        # Bước 2: OCR chính
        result = extract_delivery_slip(str(img_path), few_shot_examples=few_shot or None)
        if detected_supplier:
            result["detected_supplier"] = detected_supplier

        gr.ocr_extracted_data = json.dumps(result.get("extracted", {}), ensure_ascii=False)
        db.commit()
        return result

    except HTTPException:
        raise
    except RuntimeError as e:
        msg = str(e)
        if "leaked" in msg.lower() or "PERMISSION_DENIED" in msg:
            raise HTTPException(422, "Gemini API key không hợp lệ hoặc đã bị revoke. Vui lòng cập nhật GEMINI_API_KEY trong cấu hình.")
        if "503" in msg or "UNAVAILABLE" in msg or "high demand" in msg.lower():
            raise HTTPException(503, "Gemini API tạm thời quá tải. Vui lòng thử lại sau vài phút.")
        raise HTTPException(503, msg)
    except Exception as e:
        import traceback
        logger.error("OCR lỗi không mong muốn: %s", e, exc_info=True)
        raise HTTPException(500, f"Lỗi OCR: {type(e).__name__}: {str(e)[:200]}\n{traceback.format_exc()[-300:]}")


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
def approve_goods_receipt(gr_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles("KHO_TO_TRUONG", "BGD_GIAM_DOC", "ADMIN"))):
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


@router.post("/goods-receipts/{gr_id}/cancel")
def cancel_goods_receipt(
    gr_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("KE_TOAN_TRUONG", "BGD_GIAM_DOC", "ADMIN")),
):
    gr = db.get(GoodsReceipt, gr_id)
    if not gr:
        raise HTTPException(404, "Không tìm thấy phiếu nhập")
    if gr.trang_thai != "da_duyet":
        raise HTTPException(400, "Chỉ hủy duyệt được phiếu nhập ở trạng thái Đã duyệt")

    # Check if invoice is linked
    active_invoice = db.query(PurchaseInvoice).filter(
        PurchaseInvoice.gr_id == gr_id,
        PurchaseInvoice.trang_thai != "huy",
    ).first()
    if active_invoice:
        raise HTTPException(400, "Không thể hủy nhập kho đã lập hóa đơn mua hàng")

    # Check if purchase return is linked
    active_return = db.query(PurchaseReturn).filter(
        PurchaseReturn.gr_id == gr_id,
        PurchaseReturn.trang_thai != "huy",
    ).first()
    if active_return:
        raise HTTPException(400, "Không thể hủy nhập kho đã có phiếu trả hàng mua")

    # Check if rolls have been used
    used_rolls = db.query(GiayRoll).filter(
        GiayRoll.goods_receipt_id == gr_id,
        GiayRoll.trang_thai.in_(["dang_dung", "da_dung"]),
    ).first()
    if used_rolls:
        raise HTTPException(400, f"Không thể hủy vì cuộn giấy {used_rolls.barcode} đã/đang được sử dụng")

    # Lock balances and deduct
    for item in gr.items:
        if gr.warehouse_id:
            bal = _get_or_create_balance(
                db, gr.warehouse_id,
                item.paper_material_id, item.other_material_id,
                ten_hang=item.ten_hang, don_vi=item.dvt, lock=True
            )
            if bal.ton_luong < item.so_luong:
                raise HTTPException(
                    400,
                    f"Không đủ tồn kho để hủy nhập cho {item.ten_hang}: cần trừ {float(item.so_luong):g}, hiện còn {float(bal.ton_luong):g}"
                )
            _xuat_balance(bal, item.so_luong, item.ten_hang)
            _log_tx(db, gr.warehouse_id, "HUY_NHAP_MUA",
                    item.so_luong, item.don_gia, bal.ton_luong,
                    "goods_receipts", gr.id, current_user.id,
                    paper_material_id=item.paper_material_id,
                    other_material_id=item.other_material_id,
                    ghi_chu=f"Hủy duyệt nhập kho {gr.so_phieu}")

        if item.po_item_id:
            poi = db.get(PurchaseOrderItem, item.po_item_id)
            if poi:
                poi.so_luong_da_nhan = max(Decimal("0"), (poi.so_luong_da_nhan or Decimal("0")) - item.so_luong)
                if item.so_cuon is not None and poi.so_cuon is not None:
                    poi.so_cuon_da_nhan = max(0, (poi.so_cuon_da_nhan or 0) - item.so_cuon)

    if gr.po_id:
        _recalc_purchase_order_receipt_status(db, gr.po_id)

    # Cancel generated rolls
    db.query(GiayRoll).filter(GiayRoll.goods_receipt_id == gr_id).update({"trang_thai": "da_huy"})

    # Reverse accounting journal entries
    acc_service = AccountingService(db)
    acc_service._reverse_journal_entries("goods_receipts", gr_id)

    gr.trang_thai = "huy"
    db.commit()
    db.refresh(gr)
    logger.info("canceled goods_receipt id=%s so_phieu=%s by user=%s", gr_id, gr.so_phieu, current_user.id)
    return {"ok": True, "trang_thai": "huy"}


@router.post("/goods-receipts/{gr_id}/sync-gia-ban")
def sync_gia_ban(gr_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("BGD_GIAM_DOC", "ADMIN"))):
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


class GoodsReceiptUpdateIn(BaseModel):
    ngay_nhap: Optional[date] = None
    supplier_id: Optional[int] = None
    ghi_chu: Optional[str] = None
    so_xe: Optional[str] = None
    hd_tong_kg: Optional[Decimal] = None


@router.put("/goods-receipts/{gr_id}")
def update_goods_receipt(
    gr_id: int,
    body: GoodsReceiptUpdateIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    gr = db.get(GoodsReceipt, gr_id)
    if not gr:
        raise HTTPException(404, "Không tìm thấy phiếu nhập")
    if gr.trang_thai != "nhap":
        raise HTTPException(400, "Chỉ sửa được phiếu ở trạng thái Nhập")
    if body.ngay_nhap is not None:
        gr.ngay_nhap = body.ngay_nhap
    if body.supplier_id is not None:
        if not db.get(Supplier, body.supplier_id):
            raise HTTPException(404, "Không tìm thấy nhà cung cấp")
        gr.supplier_id = body.supplier_id
    if body.ghi_chu is not None:
        gr.ghi_chu = body.ghi_chu
    if body.so_xe is not None:
        gr.so_xe = body.so_xe
    if body.hd_tong_kg is not None:
        gr.hd_tong_kg = body.hd_tong_kg
    db.commit()
    db.refresh(gr)
    return _gr_to_dict(gr, db)


@router.delete("/goods-receipts/{gr_id}")
def delete_goods_receipt(gr_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("KHO_TO_TRUONG", "ADMIN"))):
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



def _gr_to_dict(gr: GoodsReceipt, db: Session, include_image: bool = True, co_hoa_don_override: bool | None = None, qc_phieu_id: int | None = None, barcode_map: dict | None = None) -> dict:
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
    if qc_phieu_id is None:
        qc_row = db.query(QCGiayCuonPhieu.id).filter(QCGiayCuonPhieu.goods_receipt_id == gr.id).first()
        qc_phieu_id = qc_row[0] if qc_row else None
    if barcode_map is None:
        item_ids = [it.id for it in gr.items]
        if item_ids:
            roll_rows = (
                db.query(GiayRoll.goods_receipt_item_id, GiayRoll.barcode)
                .filter(GiayRoll.goods_receipt_item_id.in_(item_ids))
                .all()
            )
            barcode_map = {r.goods_receipt_item_id: r.barcode for r in roll_rows}
        else:
            barcode_map = {}
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
        "qc_phieu_id": qc_phieu_id,
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
            "barcode": barcode_map.get(it.id),
        } for it in gr.items],
    }


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
    production_order_id: int | None = None
    session_id: int | None = None  # Nếu None, tự động tìm phiên đang chạy


@router.patch("/giay-rolls/{roll_id}/can")
def can_giay_roll(
    roll_id: int,
    body: CanGiayRollIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cập nhật trọng lượng còn lại sau khi cân — điều chỉnh InventoryBalance
    và tự động ghi nhận tiêu hao vào Phiên sản xuất đang hoạt động."""
    roll = db.get(GiayRoll, roll_id)
    if not roll:
        raise HTTPException(404, "Không tìm thấy cuộn giấy")
    if body.kg_con_lai < 0:
        raise HTTPException(400, "Trọng lượng không được âm")

    trong_luong_cu = float(roll.trong_luong_con_lai)
    delta_kg = trong_luong_cu - body.kg_con_lai
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
                production_order_id=body.production_order_id,
                ghi_chu=f"Cân cuộn {roll.barcode}: còn lại {body.kg_con_lai} kg")

    # ── Ghi nhận tiêu hao vào Phiên sản xuất ─────────────────────────────────
    # Tìm phiên: ưu tiên session_id từ request, sau đó auto-detect phiên đang chạy
    session_id = body.session_id
    if not session_id and roll.warehouse_id:
        # Tìm phiên đang chạy của kho (warehouse) tương ứng
        # Lấy phiên mới nhất đang chạy (không bắt buộc cùng phan_xuong)
        active = db.query(ProductionSession).filter(
            ProductionSession.trang_thai == "dang_chay",
        ).order_by(ProductionSession.ngay_tao.desc(), ProductionSession.id.desc()).first()
        if active:
            session_id = active.id

    if session_id and abs(delta_kg) >= 0.01:
        # Tìm bản ghi roll trong phiên
        sr = db.query(ProductionSessionRoll).filter(
            ProductionSessionRoll.session_id == session_id,
            ProductionSessionRoll.giay_roll_id == roll_id,
        ).first()
        if sr:
            # Cập nhật bản ghi hiện có
            sr.trong_luong_cuoi = Decimal(str(body.kg_con_lai))
            sr.trong_luong_tieu_hao = sr.trong_luong_dau - Decimal(str(body.kg_con_lai))
            sr.ngay_can = datetime.now(timezone.utc)
            sr.can_by = current_user.id
        else:
            # Tạo mới bản ghi tiêu hao cuộn
            sr = ProductionSessionRoll(
                session_id=session_id,
                giay_roll_id=roll_id,
                trong_luong_dau=Decimal(str(trong_luong_cu)),
                trong_luong_cuoi=Decimal(str(body.kg_con_lai)),
                trong_luong_tieu_hao=Decimal(str(max(0, delta_kg))),
                ngay_can=datetime.now(timezone.utc),
                can_by=current_user.id,
            )
            db.add(sr)

    db.commit()
    result = _giay_roll_to_dict(roll)
    result["session_id"] = session_id
    return result



def _barcode_img(value: str) -> str:
    """Generate CODE128 barcode as base64 PNG — renders in all browsers."""
    try:
        import barcode as _bc
        import io, base64
        from barcode.writer import ImageWriter
        b = _bc.get("code128", value, writer=ImageWriter())
        buf = io.BytesIO()
        b.write(buf, options={
            "module_width": 0.5,
            "module_height": 18.0,
            "font_size": 12,
            "text_distance": 4.0,
            "quiet_zone": 4.0,
            "write_text": True,
            "dpi": 200,
        })
        b64 = base64.b64encode(buf.getvalue()).decode()
        return (f'<img src="data:image/png;base64,{b64}" '
                f'style="width:100%;height:auto;display:block;" alt="{value}">')
    except Exception:
        return (f'<div style="font-family:monospace;font-size:9pt;text-align:center;'
                f'padding:4px;border:1px solid #999">{value}</div>')


def _build_label_html(roll, ma_ncc: str, ten_ncc: str, so_phieu: str) -> str:
    pm         = roll.paper_material
    ky_hieu    = (pm.ma_ky_hieu or "") if pm else ""
    kho        = f"{float(pm.kho):.0f}" if pm and pm.kho else ""
    ma_chinh   = (pm.ma_chinh or "") if pm else ""
    dinh_luong = f"{int(pm.dinh_luong)}" if pm and pm.dinh_luong else ""
    nvl        = (pm.ten_viet_tat or "") if pm else ""
    so_kg      = f"{float(roll.trong_luong_ban_dau):,.0f}"
    ngay_str   = roll.ngay_nhap.strftime("%d/%m/%Y") if roll.ngay_nhap else ""

    # Mã NCC: ưu tiên từ Supplier, fallback derive từ ma_chinh (NCC.NHOM.CODE.DL.KHO)
    ma_ncc_show = ma_ncc or (ma_chinh.split(".")[0] if ma_chinh and "." in ma_chinh else "")

    # Số phiếu: bỏ giá trị seed ảo
    phieu_show = so_phieu if so_phieu and so_phieu != "SEED-IB" else (roll.so_phieu_nhap or "")
    if phieu_show == "SEED-IB":
        phieu_show = ""

    barcode_img = _barcode_img(roll.barcode)

    def _cell(label: str, value: str) -> str:
        return f'<div><div class="dlbl">{label}</div><div class="dval">{value}</div></div>'

    detail_cells = [
        _cell("ĐL", dinh_luong),
        _cell("Mã NCC", ma_ncc_show),
        _cell("Khổ", kho),
        _cell("Ngày nhập", ngay_str),
        _cell("NVL", nvl),
        _cell("Số phiếu", phieu_show),
    ]

    return (
        f'<div class="label">'
        f'<div class="top"><div class="co">CÔNG TY TNHH SX TM NAM PHƯƠNG</div><div class="hr"></div></div>'
        f'<div class="bigs">'
        f'<div class="brow"><span class="blbl">Ký hiệu</span><span class="bval">{ky_hieu}</span></div>'
        f'<div class="brow"><span class="blbl">Khổ Giấy</span><span class="bval">{kho}</span></div>'
        f'<div class="brow"><span class="blbl">Số KG</span><span class="bval">{so_kg}</span></div>'
        f'</div>'
        f'<div class="meta">'
        f'<div class="mrow"><span class="mlbl">Mã chính</span><span class="mval">{ma_chinh}</span></div>'
        f'<div class="dgrid">{"".join(detail_cells)}</div>'
        f'</div>'
        f'<div class="bc">{barcode_img}</div>'
        f'</div>'
    )


@router.get("/giay-rolls/print-one/{roll_id}", response_class=HTMLResponse)
def print_one_giay_roll_label(
    roll_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    roll = db.get(GiayRoll, roll_id)
    if not roll:
        raise HTTPException(404, "Không tìm thấy cuộn giấy")

    from app.models.system import PrintTemplate
    tpl = (db.query(PrintTemplate).filter(PrintTemplate.ma_mau == "PAPER_ROLL_LABEL",
                                          PrintTemplate.phap_nhan_id.is_(None)).first()
           or db.query(PrintTemplate).filter(PrintTemplate.ma_mau == "PAPER_ROLL_LABEL").first())
    if not tpl:
        raise HTTPException(404, "Chưa có mẫu in PAPER_ROLL_LABEL — vui lòng cấu hình trong Hệ thống > Mẫu in")

    gr = db.get(GoodsReceipt, roll.goods_receipt_id)
    sup = db.get(Supplier, gr.supplier_id) if gr and gr.supplier_id else None
    ten_ncc = sup.ten_viet_tat if sup else ""
    ma_ncc = sup.ma_ncc if sup and hasattr(sup, "ma_ncc") else ""
    so_phieu = gr.so_phieu if gr else ""

    labels_html = _build_label_html(roll, ma_ncc, ten_ncc, so_phieu)
    content = tpl.html_content.replace("{{labels_html}}", labels_html)
    page = (
        f"<!DOCTYPE html><html lang='vi'><head><meta charset='utf-8'>"
        f"<title>In tem - {roll.barcode}</title>"
        "<style>body{margin:0;padding:0}@media print{.no-print{display:none!important}}</style>"
        "</head><body>"
        "<div class='no-print' style='padding:10px;background:#f0f0f0'>"
        f"<button onclick='window.print()' style='padding:7px 18px;font-size:14px;cursor:pointer'>🖨️ In tem - {roll.barcode}</button>"
        "</div>"
        f"{content}</body></html>"
    )
    return HTMLResponse(content=page)


@router.get("/giay-rolls/print-by-material/{material_id}", response_class=HTMLResponse)
def print_giay_roll_labels_by_material(
    material_id: int,
    warehouse_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = (db.query(GiayRoll)
           .filter(GiayRoll.paper_material_id == material_id,
                   GiayRoll.trang_thai == "trong_kho"))
    if warehouse_id:
        q = q.filter(GiayRoll.warehouse_id == warehouse_id)
    rolls = q.order_by(GiayRoll.id).all()
    if not rolls:
        raise HTTPException(404, "Không có cuộn giấy đang tồn kho")

    from app.models.system import PrintTemplate
    tpl = (db.query(PrintTemplate).filter(PrintTemplate.ma_mau == "PAPER_ROLL_LABEL",
                                          PrintTemplate.phap_nhan_id.is_(None)).first()
           or db.query(PrintTemplate).filter(PrintTemplate.ma_mau == "PAPER_ROLL_LABEL").first())
    if not tpl:
        raise HTTPException(404, "Chưa có mẫu in PAPER_ROLL_LABEL — vui lòng cấu hình trong Hệ thống > Mẫu in")

    labels_html = "".join(
        _build_label_html(roll, "", "", roll.so_phieu_nhap or "") for roll in rolls
    )
    content_html = tpl.html_content.replace("{{labels_html}}", labels_html)
    pm = rolls[0].paper_material
    title = pm.ma_chinh if pm else str(material_id)
    page = (
        f"<!DOCTYPE html><html lang='vi'><head><meta charset='utf-8'>"
        f"<title>In tem - {title}</title>"
        "<style>body{margin:0;padding:0}@media print{.no-print{display:none!important}}</style>"
        "</head><body>"
        "<div class='no-print' style='padding:10px;background:#f0f0f0'>"
        f"<button onclick='window.print()' style='padding:7px 18px;font-size:14px;cursor:pointer'>🖨️ In {len(rolls)} tem</button>"
        f" &nbsp;&nbsp;Mã: <strong>{title}</strong> — {len(rolls)} cuộn đang tồn kho"
        "</div>"
        f"{content_html}</body></html>"
    )
    return HTMLResponse(content=page)


@router.get("/giay-rolls/print/{gr_id}", response_class=HTMLResponse)
def print_giay_roll_labels(
    gr_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    gr = db.get(GoodsReceipt, gr_id)
    if not gr:
        raise HTTPException(404, "Không tìm thấy phiếu nhập")

    rolls = (db.query(GiayRoll)
               .filter(GiayRoll.goods_receipt_id == gr_id)
               .order_by(GiayRoll.id)
               .all())
    if not rolls:
        raise HTTPException(404, "Chưa tạo tem — gọi /from-receipt trước")

    from app.models.system import PrintTemplate
    tpl = (db.query(PrintTemplate).filter(PrintTemplate.ma_mau == "PAPER_ROLL_LABEL",
                                          PrintTemplate.phap_nhan_id.is_(None)).first()
           or db.query(PrintTemplate).filter(PrintTemplate.ma_mau == "PAPER_ROLL_LABEL").first())
    if not tpl:
        raise HTTPException(404, "Chưa có mẫu in PAPER_ROLL_LABEL — vui lòng cấu hình trong Hệ thống > Mẫu in")

    sup = db.get(Supplier, gr.supplier_id) if gr.supplier_id else None
    ten_ncc = sup.ten_viet_tat if sup else ""
    ma_ncc = sup.ma_ncc if sup and hasattr(sup, "ma_ncc") else ""

    labels_html = "".join(
        _build_label_html(roll, ma_ncc, ten_ncc, gr.so_phieu) for roll in rolls
    )
    content_html = tpl.html_content.replace("{{labels_html}}", labels_html)
    page = (
        f"<!DOCTYPE html><html lang='vi'><head><meta charset='utf-8'>"
        f"<title>In tem cuon giay - {gr.so_phieu}</title>"
        "<style>body{margin:0;padding:0}@media print{.no-print{display:none!important}}</style>"
        "</head><body>"
        "<div class='no-print' style='padding:10px;background:#f0f0f0'>"
        f"<button onclick='window.print()' style='padding:7px 18px;font-size:14px;cursor:pointer'>🖨️ In {len(rolls)} tem</button>"
        f" &nbsp;&nbsp;Phieu: <strong>{gr.so_phieu}</strong> - {len(rolls)} cuon"
        "</div>"
        f"{content_html}</body></html>"
    )
    return HTMLResponse(content=page)
