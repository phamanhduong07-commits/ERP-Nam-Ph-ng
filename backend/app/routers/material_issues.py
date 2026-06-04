"""Warehouse router — phiếu xuất NVL (MaterialIssue).

Split out of app/routers/warehouse.py (pure structural extraction).
Shares the /api/warehouse prefix; mounted alongside warehouse.router.
"""
import html as _html_mod
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse, StreamingResponse
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

    rows = ""
    for i, it in enumerate(mi.items, 1):
        tien = Decimal(str(it.don_gia or 0)) * Decimal(str(it.so_luong_thuc_xuat or 0))
        rows += (
            f"<tr>"
            f"<td style='text-align:center'>{i}</td>"
            f"<td>{_html_mod.escape(it.ten_hang or '')}</td>"
            f"<td style='text-align:center'>{_html_mod.escape(it.dvt or '')}</td>"
            f"<td style='text-align:right'>{float(it.so_luong_ke_hoach):,.3f}</td>"
            f"<td style='text-align:right'>{float(it.so_luong_thuc_xuat):,.3f}</td>"
            f"<td style='text-align:right'>{int(Decimal(str(it.don_gia or 0))):,}</td>"
            f"<td style='text-align:right'>{int(tien):,}</td>"
            f"</tr>"
        )
    body_html = (
        "<table style='width:100%;border-collapse:collapse;font-size:10pt'>"
        "<thead><tr style='background:#1B5E20;color:#fff'>"
        "<th style='width:4%;padding:4px;border:1px solid #ccc'>STT</th>"
        "<th style='padding:4px;border:1px solid #ccc'>Tên NVL</th>"
        "<th style='width:7%;padding:4px;border:1px solid #ccc'>ĐVT</th>"
        "<th style='width:11%;padding:4px;border:1px solid #ccc'>SL kế hoạch</th>"
        "<th style='width:11%;padding:4px;border:1px solid #ccc'>SL thực xuất</th>"
        "<th style='width:10%;padding:4px;border:1px solid #ccc'>Đơn giá</th>"
        "<th style='width:11%;padding:4px;border:1px solid #ccc'>Thành tiền</th>"
        "</tr></thead><tbody>"
        + rows
        + "</tbody></table>"
    )

    replacements = {
        "{{document_number}}": _html_mod.escape(mi.so_phieu or ""),
        "{{document_date}}": str(mi.ngay_xuat) if mi.ngay_xuat else "",
        "{{warehouse_name}}": _html_mod.escape(wh.ten_kho if wh else ""),
        "{{so_lenh}}": _html_mod.escape(lsx.so_lenh if lsx else ""),
        "{{body_html}}": body_html,
        "{{company_name}}": _html_mod.escape(settings.get("company_name") or "CÔNG TY TNHH NAM PHƯƠNG BAO BÌ"),
        "{{company_details}}": _html_mod.escape(settings.get("company_details") or ""),
        "{{logo_img}}": f'<img src="{settings["logo_url"]}" />' if settings.get("logo_url") else "",
    }
    content = tpl.html_content
    for k, v in replacements.items():
        content = content.replace(k, v)
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
def delete_material_issue(mi_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles("KHO", "KHO_TO_TRUONG", "ADMIN"))):
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
