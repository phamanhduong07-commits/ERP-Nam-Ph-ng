"""Warehouse router — phiếu xuất NVL (MaterialIssue).

Split out of app/routers/warehouse.py (pure structural extraction).
Shares the /api/warehouse prefix; mounted alongside warehouse.router.
"""
import html as _html_mod
from datetime import date, datetime, timezone
from app.utils.template import apply_template, standard_vars
from app.utils.print_utils import get_selected_columns, build_html_table
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session, selectinload
from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.master import Warehouse, PhanXuong, PhapNhan
from app.models.production import ProductionOrder
from app.models.warehouse_doc import (
    MaterialIssue, MaterialIssueItem,
)
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
    MaterialIssueIn,
    _gen_so,
    _resolve_nvl_name,
    _tk_nvl,
    _ensure_active_warehouse,
)

router = APIRouter(prefix="/api/warehouse", tags=["warehouse"])


# ── Phiếu xuất NVL (MaterialIssue) ───────────────────────────────────────────

@router.get("/material-issues")
def list_material_issues(
    warehouse_id: Optional[int] = Query(None),
    production_order_id: Optional[int] = Query(None),
    production_session_id: Optional[int] = Query(None),
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
    if production_session_id:
        q = q.filter(MaterialIssue.production_session_id == production_session_id)
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


@router.get("/material-issues/{mi_id}/print", response_class=HTMLResponse)
def print_material_issue(mi_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    mi = db.query(MaterialIssue).options(selectinload(MaterialIssue.items)).filter(MaterialIssue.id == mi_id).first()
    if not mi:
        raise HTTPException(404, "Không tìm thấy phiếu xuất NVL")

    wh = db.get(Warehouse, mi.warehouse_id) if mi.warehouse_id else None
    lsx = db.get(ProductionOrder, mi.production_order_id) if mi.production_order_id else None
    phap_nhan_id = (lsx.phap_nhan_id if lsx and lsx.phap_nhan_id else None)
    if not phap_nhan_id and wh and wh.phan_xuong_id:
        px = db.get(PhanXuong, wh.phan_xuong_id)
        if px:
            phap_nhan_id = px.phap_nhan_id

    tpl_q = db.query(PrintTemplate).filter(PrintTemplate.ma_mau == "MATERIAL_ISSUE")
    tpl = tpl_q.filter(PrintTemplate.phap_nhan_id == phap_nhan_id).first() if phap_nhan_id else None
    if not tpl:
        tpl = tpl_q.filter(PrintTemplate.phap_nhan_id.is_(None)).first() or tpl_q.first()
    if not tpl:
        raise HTTPException(404, "Chưa có mẫu in MATERIAL_ISSUE — vui lòng cấu hình trong Hệ thống > Mẫu in")

    settings = {s.key: s.value for s in db.query(SystemSetting).all()}
    pn = db.get(PhapNhan, phap_nhan_id) if phap_nhan_id else None
    logo_src = (
        f"/api/phap-nhan/logo/{pn.ma_phap_nhan}" if pn and pn.ma_phap_nhan
        else settings.get("logo_url") or ""
    )

    _default_mi_cols = [
        {"key": "stt", "label": "STT"},
        {"key": "ten_hang", "label": "Tên nguyên vật liệu"},
        {"key": "dvt", "label": "ĐVT"},
        {"key": "so_luong", "label": "Số lượng"},
        {"key": "don_gia", "label": "Đơn giá (đ)"},
        {"key": "thanh_tien", "label": "Thành tiền (đ)"},
        {"key": "ghi_chu", "label": "Ghi chú"},
    ]
    selected_cols = get_selected_columns(tpl.variables_meta, _default_mi_cols)

    items_data = []
    for i, it in enumerate(mi.items, 1):
        don_gia = Decimal(str(it.don_gia or 0))
        thuc_xuat = Decimal(str(it.so_luong_thuc_xuat or 0))
        tien = don_gia * thuc_xuat
        items_data.append({
            "stt": str(i),
            "ten_hang": it.ten_hang or "",
            "dvt": it.dvt or "",
            "so_luong_ke_hoach": f"{float(it.so_luong_ke_hoach):,.3f}",
            "so_luong_thuc_xuat": f"{float(it.so_luong_thuc_xuat):,.3f}",
            "so_luong": f"{float(thuc_xuat):,.3f}",
            "don_gia": f"{int(don_gia):,}",
            "gia_ban": f"{int(don_gia):,}",
            "thanh_tien": f"{int(tien):,}",
            "ghi_chu": getattr(it, "ghi_chu", "") or "",
        })
    body_html = build_html_table(selected_cols, items_data, th_style="background:#1B5E20;color:#fff;padding:4px 6px;border:1px solid #ccc;")

    replacements = {
        **standard_vars(subtitle="PHIẾU XUẤT NGUYÊN VẬT LIỆU"),
        "{{document_number}}": _html_mod.escape(mi.so_phieu or ""),
        "{{document_date}}": str(mi.ngay_xuat) if mi.ngay_xuat else "",
        "{{warehouse_name}}": _html_mod.escape(wh.ten_kho if wh else ""),
        "{{so_lenh}}": _html_mod.escape(lsx.so_lenh if lsx else ""),
        "{{body_html}}": body_html,
        "{{company_name}}": _html_mod.escape(settings.get("company_name") or "CÔNG TY TNHH NAM PHƯƠNG BAO BÌ"),
        "{{company_details}}": _html_mod.escape(settings.get("company_details") or ""),
        "{{logo_img}}": f'<img src="{logo_src}" style="max-height:50px;max-width:100%;object-fit:contain"/>' if logo_src else "",
    }
    content = apply_template(tpl.html_content, replacements)
    page = (
        "<!DOCTYPE html><html lang='vi'><head><meta charset='UTF-8'>"
        f"<title>Phiếu xuất NVL {_html_mod.escape(mi.so_phieu or '')}</title>"
        "<style>body{margin:0;padding:0}@media print{.no-print{display:none!important}}</style>"
        "</head><body>"
        "<div class='no-print' style='padding:10px;background:#f0f0f0;display:flex;gap:10px'>"
        "<button onclick='window.print()' style='padding:7px 18px;background:#1B5E20;color:#fff;border:none;border-radius:4px;cursor:pointer'>🖨️ In phiếu</button>"
        "<button onclick='window.close()' style='padding:7px 14px;border:1px solid #ccc;border-radius:4px;cursor:pointer'>Đóng</button>"
        "</div>"
        f"{content}</body></html>"
    )
    return HTMLResponse(content=page)


@router.get("/material-issues/{mi_id}/export-excel")
def export_material_issue_excel(mi_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    from app.services.excel_export_service import build_xlsx
    mi = db.query(MaterialIssue).options(selectinload(MaterialIssue.items)).filter(MaterialIssue.id == mi_id).first()
    if not mi:
        raise HTTPException(404, "Không tìm thấy phiếu xuất NVL")

    wh = db.get(Warehouse, mi.warehouse_id) if mi.warehouse_id else None
    lsx = db.get(ProductionOrder, mi.production_order_id) if mi.production_order_id else None
    phap_nhan_id = (lsx.phap_nhan_id if lsx and lsx.phap_nhan_id else None)
    if not phap_nhan_id and wh and wh.phan_xuong_id:
        px = db.get(PhanXuong, wh.phan_xuong_id)
        if px:
            phap_nhan_id = px.phap_nhan_id

    from app.models.system import ExcelTemplate
    tpl_q = db.query(ExcelTemplate).filter(ExcelTemplate.ma_mau == "MATERIAL_ISSUE")
    tpl = tpl_q.filter(ExcelTemplate.phap_nhan_id == phap_nhan_id).first() if phap_nhan_id else None
    if not tpl:
        tpl = tpl_q.filter(ExcelTemplate.phap_nhan_id.is_(None)).first() or tpl_q.first()
    if not tpl:
        raise HTTPException(404, "Chưa cấu hình mẫu Excel MATERIAL_ISSUE")

    pn = db.get(PhapNhan, phap_nhan_id) if phap_nhan_id else None
    meta = {
        "document_number": mi.so_phieu or "",
        "document_date": str(mi.ngay_xuat) if mi.ngay_xuat else "",
        "warehouse_name": wh.ten_kho if wh else "",
        "so_lenh": lsx.so_lenh if lsx else "",
        "ghi_chu": mi.ghi_chu or "",
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
            "so_luong_ke_hoach": float(it.so_luong_ke_hoach),
            "so_luong_thuc_xuat": float(it.so_luong_thuc_xuat),
            "don_gia": float(it.don_gia),
            "thanh_tien": float(Decimal(str(it.don_gia or 0)) * Decimal(str(it.so_luong_thuc_xuat or 0))),
            "ghi_chu": it.ghi_chu or "",
        }
        for i, it in enumerate(mi.items, 1)
    ]

    xlsx_bytes = build_xlsx(tpl, items_data, meta, company_info)
    filename = f"XNVL_{mi.so_phieu or mi_id}.xlsx"
    return StreamingResponse(
        iter([xlsx_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/material-issues", status_code=201)
def create_material_issue(
    body: MaterialIssueIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("KHO_NHAN_VIEN", "KHO_TO_TRUONG", "ADMIN")),
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

    mi = MaterialIssue(
        so_phieu=_gen_so(db, "XI", MaterialIssue),
        ngay_xuat=body.ngay_xuat,
        production_order_id=body.production_order_id,
        warehouse_id=warehouse_id,
        ghi_chu=body.ghi_chu,
        trang_thai="nhap",
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
            don_gia=it.don_gia or Decimal("0"),
            ghi_chu=it.ghi_chu,
        ))

    db.commit()
    db.refresh(mi)
    logger.info("created draft material_issue id=%s so_phieu=%s by user=%s", mi.id, mi.so_phieu, current_user.id)
    return _mi_to_dict(mi, db)


@router.patch("/material-issues/{mi_id}/approve")
def approve_material_issue(
    mi_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("KHO_TO_TRUONG", "ADMIN")),
):
    mi = db.get(MaterialIssue, mi_id)
    if not mi:
        logger.warning("material_issue id=%s not found", mi_id)
        raise HTTPException(404, "Không tìm thấy phiếu xuất NVL")
    if mi.trang_thai == "da_xuat":
        raise HTTPException(400, "Phiếu đã được duyệt xuất")
    if mi.trang_thai == "huy":
        raise HTTPException(400, "Không thể duyệt xuất phiếu đã hủy")

    # Validate tồn trước
    for it in mi.items:
        bal = _get_or_create_balance(db, mi.warehouse_id,
                                     it.paper_material_id, it.other_material_id,
                                     ten_hang=it.ten_hang, don_vi=it.dvt)
        if bal.ton_luong < it.so_luong_thuc_xuat:
            raise HTTPException(400, f"Không đủ tồn kho: {it.ten_hang} — "
                                f"cần {float(it.so_luong_thuc_xuat):g}, còn {float(bal.ton_luong):g}")

    journal_lines_mi: list[dict] = []
    for it in mi.items:
        # Lock row trước khi trừ tồn — tránh race condition concurrent exports
        bal = _get_or_create_balance(db, mi.warehouse_id,
                                     it.paper_material_id, it.other_material_id,
                                     ten_hang=it.ten_hang, don_vi=it.dvt, lock=True)
        don_gia_xuat = bal.don_gia_binh_quan
        it.don_gia = don_gia_xuat

        _xuat_balance(bal, it.so_luong_thuc_xuat, it.ten_hang)
        _log_tx(db, mi.warehouse_id, "XUAT_SX",
                it.so_luong_thuc_xuat, don_gia_xuat, bal.ton_luong,
                "material_issues", mi.id, current_user.id,
                paper_material_id=it.paper_material_id,
                other_material_id=it.other_material_id,
                ghi_chu=it.ghi_chu)
        journal_lines_mi.append({
            "ten_hang": it.ten_hang,
            "so_luong": it.so_luong_thuc_xuat,
            "don_gia": float(don_gia_xuat),
            "tk_no": "154",
            "tk_co": _tk_nvl(it.paper_material_id),
        })

    # ── Ghi sổ kế toán tự động ──────────────────────────────────────────────
    wh = db.get(Warehouse, mi.warehouse_id)
    phap_nhan_id = wh.phan_xuong_obj.phap_nhan_id if wh and wh.phan_xuong_obj else None

    if not mi.bo_qua_hach_toan and journal_lines_mi:
        acc_service = AccountingService(db)
        acc_service.post_inventory_journal(
            ngay=mi.ngay_xuat,
            loai="XUAT_SX",
            chung_tu_loai="material_issues",
            chung_tu_id=mi.id,
            phap_nhan_id=phap_nhan_id,
            phan_xuong_id=wh.phan_xuong_id if wh else None,
            items=journal_lines_mi,
        )

    mi.trang_thai = "da_xuat"
    db.commit()
    db.refresh(mi)
    logger.info("approved material_issue id=%s so_phieu=%s by user=%s", mi.id, mi.so_phieu, current_user.id)
    return {"ok": True, "trang_thai": "da_xuat"}


@router.post("/material-issues/{mi_id}/cancel")
def cancel_material_issue(
    mi_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("KHO_TO_TRUONG", "ADMIN")),
):
    mi = db.get(MaterialIssue, mi_id)
    if not mi:
        raise HTTPException(404, "Không tìm thấy phiếu xuất NVL")
    if mi.trang_thai == "nhap":
        raise HTTPException(400, "Không thể hủy phiếu chưa duyệt xuất (hãy xóa phiếu)")
    if mi.trang_thai == "huy":
        raise HTTPException(400, "Phiếu đã được hủy trước đó")

    # Hoàn trả lại tồn kho
    for it in mi.items:
        bal = _get_or_create_balance(db, mi.warehouse_id,
                                     it.paper_material_id, it.other_material_id,
                                     ten_hang=it.ten_hang, don_vi=it.dvt)
        _nhap_balance(bal, it.so_luong_thuc_xuat, it.don_gia)
        _log_tx(db, mi.warehouse_id, "HUY_XUAT_SX",
                it.so_luong_thuc_xuat, it.don_gia, bal.ton_luong,
                "material_issues", mi.id, current_user.id,
                paper_material_id=it.paper_material_id,
                other_material_id=it.other_material_id,
                ghi_chu=f"Hủy phiếu {mi.so_phieu}")

    # Đảo ngược bút toán kế toán
    acc_service = AccountingService(db)
    acc_service._reverse_journal_entries("material_issues", mi_id)

    mi.trang_thai = "huy"
    db.commit()
    db.refresh(mi)
    logger.info("canceled material_issue id=%s so_phieu=%s by user=%s", mi.id, mi.so_phieu, current_user.id)
    return {"ok": True, "trang_thai": "huy"}


@router.delete("/material-issues/{mi_id}")
def delete_material_issue(mi_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles("KHO_TO_TRUONG", "ADMIN"))):
    mi = db.get(MaterialIssue, mi_id)
    if not mi:
        raise HTTPException(404, "Không tìm thấy phiếu xuất NVL")
    if mi.trang_thai != "nhap":
        raise HTTPException(400, "Chỉ được xóa phiếu ở trạng thái Nhập")

    db.delete(mi)
    db.commit()
    return {"ok": True}


@router.post("/material-issues/{mi_id}/allocate")
def allocate_material_issue(
    mi_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("KHO_TO_TRUONG", "ADMIN", "BGD_GIAM_DOC")),
):
    """Phân bổ kg giấy thực xuất về từng LSX theo trọng số m² × hệ số lớp.

    Kết quả ghi vào MaterialIssueItem.allocation_detail (JSON).
    Có thể gọi lại để tính lại bất cứ lúc nào.
    """
    import json
    from app.models.production import ProductionOrderItem
    from app.models.bom import ProductionBOM, ProductionBOMItem
    from app.models.master import PaperMaterial
    from app.models.layer_allocation_coefficient import LayerAllocationCoefficient

    mi = (
        db.query(MaterialIssue)
        .options(selectinload(MaterialIssue.items))
        .filter(MaterialIssue.id == mi_id)
        .first()
    )
    if not mi:
        raise HTTPException(404, "Không tìm thấy phiếu xuất NVL")

    lsx_list = (
        db.query(ProductionOrderItem)
        .filter(ProductionOrderItem.production_order_id == mi.production_order_id)
        .all()
    )
    if not lsx_list:
        raise HTTPException(400, "KHSX chưa có LSX nào — không thể phân bổ")

    # Build: lsx_id → (lsx, bom_items)
    lsx_bom_map: dict[int, tuple] = {}
    for lsx in lsx_list:
        bom = (
            db.query(ProductionBOM)
            .filter(
                ProductionBOM.production_order_item_id == lsx.id,
                ProductionBOM.trang_thai == "confirmed",
            )
            .order_by(ProductionBOM.id.desc())
            .first()
        )
        if bom:
            bom_items = (
                db.query(ProductionBOMItem)
                .filter(ProductionBOMItem.bom_id == bom.id)
                .all()
            )
            lsx_bom_map[lsx.id] = (lsx, bom_items)

    # Hệ số lookup: (loai_lop, flute_type) → he_so
    coeffs = db.query(LayerAllocationCoefficient).all()
    coeff_map: dict[tuple, Decimal] = {
        (c.loai_lop, c.flute_type): c.he_so for c in coeffs
    }

    def _he_so(loai_lop: str, flute_type: str | None) -> Decimal:
        return coeff_map.get((loai_lop, flute_type), Decimal("1.0"))

    summary_items = []

    for mi_item in mi.items:
        if not mi_item.paper_material_id:
            mi_item.allocation_detail = json.dumps([], ensure_ascii=False)
            continue

        pm = db.get(PaperMaterial, mi_item.paper_material_id)
        if not pm or not pm.ma_ky_hieu:
            mi_item.allocation_detail = json.dumps([], ensure_ascii=False)
            continue

        ma_ky_hieu = pm.ma_ky_hieu.strip().upper()

        # Tìm tất cả BOM items khớp mã ký hiệu giấy này, trong tất cả LSX
        candidates = []
        for lsx_id, (lsx, bom_items) in lsx_bom_map.items():
            for bi in bom_items:
                if bi.ma_ky_hieu and bi.ma_ky_hieu.strip().upper() == ma_ky_hieu:
                    if bi.dien_tich_1con and bi.dien_tich_1con > 0 and bi.so_luong_sx > 0:
                        he_so = _he_so(bi.loai_lop, bi.flute_type)
                        w = Decimal(str(bi.dien_tich_1con)) * Decimal(str(bi.so_luong_sx)) * he_so
                        candidates.append({
                            "lsx_id": lsx_id,
                            "lsx_ten_hang": lsx.ten_hang,
                            "bom_item_id": bi.id,
                            "loai_lop": bi.loai_lop,
                            "flute_type": bi.flute_type,
                            "dien_tich_1con": float(bi.dien_tich_1con),
                            "so_luong_sx": float(bi.so_luong_sx),
                            "he_so": float(he_so),
                            "w": w,
                        })

        total_w = sum(c["w"] for c in candidates)
        kg_thuc = Decimal(str(mi_item.so_luong_thuc_xuat))
        don_gia = Decimal(str(mi_item.don_gia))

        detail_rows = []
        for c in candidates:
            if total_w > 0:
                share = c["w"] / total_w
                kg_phan_bo = (kg_thuc * share).quantize(Decimal("0.001"))
            else:
                share = Decimal("0")
                kg_phan_bo = Decimal("0")
            thanh_tien = (kg_phan_bo * don_gia).quantize(Decimal("0.01"))
            detail_rows.append({
                "lsx_id": c["lsx_id"],
                "lsx_ten_hang": c["lsx_ten_hang"],
                "bom_item_id": c["bom_item_id"],
                "loai_lop": c["loai_lop"],
                "flute_type": c["flute_type"],
                "dien_tich_1con": c["dien_tich_1con"],
                "so_luong_sx": c["so_luong_sx"],
                "he_so": c["he_so"],
                "w_m2": float(c["w"]),
                "share_pct": float(share),
                "kg_phan_bo": float(kg_phan_bo),
                "thanh_tien": float(thanh_tien),
            })

        mi_item.allocation_detail = json.dumps(detail_rows, ensure_ascii=False)
        summary_items.append({
            "mi_item_id": mi_item.id,
            "ten_hang": mi_item.ten_hang,
            "kg_thuc": float(kg_thuc),
            "lsx_count": len(detail_rows),
            "total_kg_phan_bo": sum(r["kg_phan_bo"] for r in detail_rows),
        })

    db.commit()
    logger.info("Allocated MI %s: %d items, %d LSX matched", mi.so_phieu, len(summary_items), len(lsx_bom_map))
    return {
        "ok": True,
        "mi_id": mi.id,
        "so_phieu": mi.so_phieu,
        "allocated_items": len(summary_items),
        "lsx_with_bom": len(lsx_bom_map),
        "lsx_total": len(lsx_list),
        "items": summary_items,
    }


def _mi_to_dict(mi: MaterialIssue, db: Session) -> dict:
    wh = db.get(Warehouse, mi.warehouse_id)
    lsx = db.get(ProductionOrder, mi.production_order_id)
    phap_nhan_id = lsx.phap_nhan_id if lsx and lsx.phap_nhan_id else (wh.phan_xuong_obj.phap_nhan_id if wh and wh.phan_xuong_obj else None)
    return {
        "id": mi.id,
        "so_phieu": mi.so_phieu,
        "ngay_xuat": str(mi.ngay_xuat),
        "ca": mi.ca,
        "production_order_id": mi.production_order_id,
        "production_session_id": mi.production_session_id,
        "so_lenh": lsx.so_lenh if lsx else "",
        "warehouse_id": mi.warehouse_id,
        "ten_kho": wh.ten_kho if wh else "",
        "ten_xuong": wh.phan_xuong_obj.ten_xuong if wh and wh.phan_xuong_obj else "",
        "phap_nhan_id": phap_nhan_id,
        "trang_thai": mi.trang_thai,
        "bo_qua_hach_toan": mi.bo_qua_hach_toan,
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
            "allocation_detail": it.allocation_detail,
            "ghi_chu": it.ghi_chu,
        } for it in mi.items],
    }
