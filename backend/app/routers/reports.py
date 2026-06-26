import io
from datetime import date
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import exists, func, case, or_
from sqlalchemy.orm import Session, selectinload, joinedload
from openpyxl import Workbook

from app.database import get_db
from app.deps import get_current_user, get_sale_visible_nv_ids, require_any_permission
from app.models.auth import User
from app.models.billing import SalesInvoice
from app.models.accounting import PurchaseInvoice, ProductionCostAllocation, DebtLedgerEntry
from app.models.sales import SalesOrder, SalesOrderItem, SalesTarget, Quote
from app.models.master import Customer, CustomerNhanVien, Warehouse, PhanXuong, Supplier
from app.models.auth import User as UserModel
from app.models.inventory import InventoryTransaction, InventoryBalance
from app.models.master import PaperMaterial, OtherMaterial, Product
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.warehouse_doc import DeliveryOrder

router = APIRouter(
    prefix="/api/reports",
    dependencies=[Depends(require_any_permission(
        "report.view", "report.export",
        "report.cong_no", "report.inventory", "report.phoi_thanh_pham",
    ))],
    tags=["reports"],
)

# ── Hằng số ──────────────────────────────────────────────────────────────────

_SALE_REPORT_ROLES = frozenset({
    "ADMIN", "BGD_GIAM_DOC", "BGD_TO_TRUONG", "BGD_NHAN_VIEN",
    "SALE_ADMIN", "TRUONG_PHONG_SALE_ADMIN",
    "KINH_DOANH_TO_TRUONG", "KINH_DOANH_NHAN_VIEN",
})

_NHAP_LOAI = {
    "NHAP_MUA",            # nhập từ mua hàng (GoodsReceipt approve)
    "NHAP_SX",             # nhập thành phẩm từ sản xuất
    "NHAP_TP",             # nhập TP (phieu_nhap_tp)
    "CHUYEN_KHO_NHAP",     # nhận hàng từ chuyển kho
    "DIEU_CHINH_TANG",     # điều chỉnh tăng (StockAdjustment)
    "XOA_XUAT_SX",         # hoàn tồn khi xóa phiếu xuất SX
    "XOA_XUAT_BAN",        # hoàn tồn khi xóa phiếu giao hàng
    "XOA_CHUYEN_XUAT",     # hoàn tồn khi xóa chuyển kho (phía xuất)
    "XOA_DIEU_CHINH_GIAM", # hoàn tồn khi xóa điều chỉnh giảm
    "DIEU_CHINH_GIAM_XUAT",# giảm số lượng giao hàng → trả lại kho
}
_XUAT_LOAI = {
    "XUAT_SX",             # xuất NVL cho sản xuất
    "XUAT_BAN",            # xuất bán / giao hàng cho khách
    "CHUYEN_KHO_XUAT",     # chuyển kho (phía xuất)
    "DIEU_CHINH_GIAM",     # điều chỉnh giảm (StockAdjustment)
    "XOA_NHAP_SX",         # hoàn tồn khi xóa nhập TP từ SX
    "XOA_CHUYEN_NHAP",     # hoàn tồn khi xóa chuyển kho (phía nhận)
    "XOA_DIEU_CHINH_TANG", # hoàn tồn khi xóa điều chỉnh tăng
    "DIEU_CHINH_TANG_XUAT",# tăng số lượng giao hàng → trừ thêm kho
}


# ── 1. Báo cáo công nợ tổng hợp ──────────────────────────────────────────────

@router.get("/debt-summary")
def get_debt_summary(
    as_of_date: Optional[str] = Query(None, description="Ngày tính (YYYY-MM-DD), mặc định hôm nay"),
    phap_nhan_id: Optional[int] = Query(None, description="Lọc theo pháp nhân"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.fromisoformat(as_of_date) if as_of_date else date.today()

    # ── Scope theo nhân viên phụ trách ───────────────────────────────────────
    _scope_nv_ids = get_sale_visible_nv_ids(current_user)
    scoped_customer_ids = None
    if _scope_nv_ids is not None:
        scoped_customer_ids = (
            db.query(Customer.id)
            .filter(
                or_(
                    Customer.nv_phu_trach_id.in_(_scope_nv_ids),
                    exists().where(
                        (CustomerNhanVien.customer_id == Customer.id)
                        & (CustomerNhanVien.user_id.in_(_scope_nv_ids))
                    ),
                )
            )
            .scalar_subquery()
        )

    # ── AR (phải thu) ─────────────────────────────────────────────────────────
    ar_q = db.query(
        SalesInvoice.customer_id,
        SalesInvoice.ten_don_vi,
        func.count(SalesInvoice.id).label("so_hoa_don"),
        func.coalesce(func.sum(SalesInvoice.tong_cong), 0).label("tong_phat_sinh"),
        func.coalesce(func.sum(SalesInvoice.da_thanh_toan), 0).label("da_thu"),
        func.coalesce(func.sum(SalesInvoice.con_lai), 0).label("con_lai"),
        func.coalesce(func.sum(
            case((SalesInvoice.han_tt < today, SalesInvoice.con_lai), else_=0)
        ), 0).label("qua_han"),
    ).filter(SalesInvoice.trang_thai.notin_(["huy"]), SalesInvoice.con_lai > 0)
    if phap_nhan_id is not None:
        ar_q = ar_q.filter(SalesInvoice.phap_nhan_id == phap_nhan_id)
    if scoped_customer_ids is not None:
        ar_q = ar_q.filter(SalesInvoice.customer_id.in_(scoped_customer_ids))
    ar_rows = (
        ar_q
        .group_by(SalesInvoice.customer_id, SalesInvoice.ten_don_vi)
        .order_by(func.sum(SalesInvoice.con_lai).desc())
        .all()
    )

    ar_list = [
        {
            "customer_id": r.customer_id,
            "ten_doi_tuong": r.ten_don_vi or f"KH#{r.customer_id}",
            "so_hoa_don": r.so_hoa_don,
            "tong_phat_sinh": float(r.tong_phat_sinh),
            "da_thanh_toan": float(r.da_thu),
            "con_lai": float(r.con_lai),
            "qua_han": float(r.qua_han),
            "trong_han": float(r.con_lai) - float(r.qua_han),
        }
        for r in ar_rows
    ]

    ar_summary = {
        "tong_phat_sinh": sum(r["tong_phat_sinh"] for r in ar_list),
        "da_thanh_toan": sum(r["da_thanh_toan"] for r in ar_list),
        "con_lai": sum(r["con_lai"] for r in ar_list),
        "qua_han": sum(r["qua_han"] for r in ar_list),
        "trong_han": sum(r["trong_han"] for r in ar_list),
        "so_doi_tuong": len(ar_list),
    }

    # ── AP (phải trả) ─────────────────────────────────────────────────────────
    ap_rows = (
        db.query(
            PurchaseInvoice.supplier_id,
            PurchaseInvoice.ten_don_vi,
            func.count(PurchaseInvoice.id).label("so_hoa_don"),
            func.coalesce(func.sum(PurchaseInvoice.tong_thanh_toan), 0).label("tong_phat_sinh"),
            func.coalesce(func.sum(PurchaseInvoice.da_thanh_toan), 0).label("da_tra"),
            func.coalesce(func.sum(PurchaseInvoice.con_lai), 0).label("con_lai"),
            func.coalesce(func.sum(
                case((PurchaseInvoice.han_tt < today, PurchaseInvoice.con_lai), else_=0)
            ), 0).label("qua_han"),
        )
        .filter(PurchaseInvoice.trang_thai.notin_(["huy"]), PurchaseInvoice.con_lai > 0)
        .filter(*([PurchaseInvoice.phap_nhan_id == phap_nhan_id] if phap_nhan_id is not None else []))
        .group_by(PurchaseInvoice.supplier_id, PurchaseInvoice.ten_don_vi)
        .order_by(func.sum(PurchaseInvoice.con_lai).desc())
        .all()
    )

    ap_list = [
        {
            "supplier_id": r.supplier_id,
            "ten_doi_tuong": r.ten_don_vi or f"NCC#{r.supplier_id}",
            "so_hoa_don": r.so_hoa_don,
            "tong_phat_sinh": float(r.tong_phat_sinh),
            "da_thanh_toan": float(r.da_tra),
            "con_lai": float(r.con_lai),
            "qua_han": float(r.qua_han),
            "trong_han": float(r.con_lai) - float(r.qua_han),
        }
        for r in ap_rows
    ]

    ap_summary = {
        "tong_phat_sinh": sum(r["tong_phat_sinh"] for r in ap_list),
        "da_thanh_toan": sum(r["da_thanh_toan"] for r in ap_list),
        "con_lai": sum(r["con_lai"] for r in ap_list),
        "qua_han": sum(r["qua_han"] for r in ap_list),
        "trong_han": sum(r["trong_han"] for r in ap_list),
        "so_doi_tuong": len(ap_list),
    }

    return {
        "as_of_date": today.isoformat(),
        "ar": {"summary": ar_summary, "rows": ar_list},
        "ap": {"summary": ap_summary, "rows": ap_list},
    }


# ── 1b. Tổng hợp công nợ phải trả NCC (sổ cái TK 331) ───────────────────────

@router.get("/ap-ledger-summary")
def get_ap_ledger_summary(
    tu_ngay: str = Query(..., description="Từ ngày (YYYY-MM-DD)"),
    den_ngay: str = Query(..., description="Đến ngày (YYYY-MM-DD)"),
    phap_nhan_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Tổng hợp công nợ phải trả NCC theo kỳ: dư đầu kỳ / phát sinh / dư cuối kỳ (Nợ/Có)."""
    d_from = date.fromisoformat(tu_ngay)
    d_to = date.fromisoformat(den_ngay)

    def _agg(date_cond, loai: str) -> dict[int, float]:
        q = (
            db.query(
                DebtLedgerEntry.supplier_id,
                func.coalesce(func.sum(DebtLedgerEntry.so_tien), 0).label("total"),
            )
            .filter(
                DebtLedgerEntry.doi_tuong == "nha_cung_cap",
                DebtLedgerEntry.loai == loai,
                DebtLedgerEntry.supplier_id.isnot(None),
                date_cond,
            )
        )
        if phap_nhan_id is not None:
            q = q.filter(DebtLedgerEntry.phap_nhan_id == phap_nhan_id)
        return {r.supplier_id: float(r.total) for r in q.group_by(DebtLedgerEntry.supplier_id).all()}

    tang_before = _agg(DebtLedgerEntry.ngay < d_from, "tang_no")
    giam_before = _agg(DebtLedgerEntry.ngay < d_from, "giam_no")
    tang_in = _agg((DebtLedgerEntry.ngay >= d_from) & (DebtLedgerEntry.ngay <= d_to), "tang_no")
    giam_in = _agg((DebtLedgerEntry.ngay >= d_from) & (DebtLedgerEntry.ngay <= d_to), "giam_no")

    all_ids = set(tang_before) | set(giam_before) | set(tang_in) | set(giam_in)
    _empty_totals = {
        "so_du_dau_ky_no": 0, "so_du_dau_ky_co": 0,
        "phat_sinh_no": 0, "phat_sinh_co": 0,
        "so_du_cuoi_ky_no": 0, "so_du_cuoi_ky_co": 0,
    }
    if not all_ids:
        return {"rows": [], "tu_ngay": tu_ngay, "den_ngay": den_ngay, "totals": _empty_totals}

    suppliers = {s.id: s for s in db.query(Supplier).filter(Supplier.id.in_(all_ids)).all()}

    rows = []
    for sid in all_ids:
        net_open = tang_before.get(sid, 0) - giam_before.get(sid, 0)
        ps_co = tang_in.get(sid, 0)
        ps_no = giam_in.get(sid, 0)
        net_close = net_open + ps_co - ps_no
        if net_open == 0 and ps_co == 0 and ps_no == 0:
            continue
        sup = suppliers.get(sid)
        rows.append({
            "supplier_id": sid,
            "ma_ncc": sup.ma_ncc if sup else f"NCC#{sid}",
            "ten_ncc": (sup.ten_viet_tat if sup else f"NCC#{sid}"),
            "tk_cong_no": "331",
            "so_du_dau_ky_no": max(0.0, -net_open),
            "so_du_dau_ky_co": max(0.0, net_open),
            "phat_sinh_no": ps_no,
            "phat_sinh_co": ps_co,
            "so_du_cuoi_ky_no": max(0.0, -net_close),
            "so_du_cuoi_ky_co": max(0.0, net_close),
        })

    rows.sort(key=lambda r: r["ten_ncc"])

    def _s(k): return sum(r[k] for r in rows)
    totals = {
        "so_du_dau_ky_no": _s("so_du_dau_ky_no"),
        "so_du_dau_ky_co": _s("so_du_dau_ky_co"),
        "phat_sinh_no": _s("phat_sinh_no"),
        "phat_sinh_co": _s("phat_sinh_co"),
        "so_du_cuoi_ky_no": _s("so_du_cuoi_ky_no"),
        "so_du_cuoi_ky_co": _s("so_du_cuoi_ky_co"),
    }
    return {"rows": rows, "tu_ngay": tu_ngay, "den_ngay": den_ngay, "totals": totals}


# ── 2. Báo cáo doanh thu ─────────────────────────────────────────────────────

@router.get("/revenue")
def get_revenue_report(
    tu_ngay: str = Query(...),
    den_ngay: str = Query(...),
    nhom: str = Query("month", description="day | month | quarter"),
    phap_nhan_id: Optional[int] = Query(None, description="Lọc theo pháp nhân"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    d_from = date.fromisoformat(tu_ngay)
    d_to = date.fromisoformat(den_ngay)

    # ── Doanh thu theo kỳ ─────────────────────────────────────────────────────
    revenue_q = (
        db.query(SalesOrder, Customer.ten_don_vi)
        .join(Customer, Customer.id == SalesOrder.customer_id)
        .filter(
            SalesOrder.ngay_don >= d_from,
            SalesOrder.ngay_don <= d_to,
            SalesOrder.trang_thai.notin_(["huy"]),
        )
    )
    if phap_nhan_id is not None:
        revenue_q = revenue_q.filter(SalesOrder.phap_nhan_id == phap_nhan_id)
    base_rows = revenue_q.all()

    period_map: dict[str, float] = {}
    for row, _ in base_rows:
        d = row.ngay_don
        if nhom == "day":
            key = d.strftime("%Y-%m-%d")
        elif nhom == "quarter":
            q = (d.month - 1) // 3 + 1
            key = f"{d.year}-Q{q}"
        else:  # month
            key = d.strftime("%Y-%m")
        period_map[key] = period_map.get(key, 0.0) + float(row.tong_tien or 0)

    theo_ky = [{"ky": k, "doanh_thu": v} for k, v in sorted(period_map.items())]
    tong_doanh_thu = sum(v for v in period_map.values())
    so_don_hang = len(base_rows)

    # ── Top 10 khách hàng ─────────────────────────────────────────────────────
    customer_map: dict[int, dict] = {}
    for row, ten_don_vi in base_rows:
        cid = row.customer_id or 0
        if cid not in customer_map:
            customer_map[cid] = {
                "customer_id": cid,
                "ten_khach_hang": ten_don_vi or f"KH#{cid}",
                "doanh_thu": 0.0,
                "so_don": 0,
            }
        customer_map[cid]["doanh_thu"] += float(row.tong_tien or 0)
        customer_map[cid]["so_don"] += 1

    top_customers = sorted(customer_map.values(), key=lambda x: x["doanh_thu"], reverse=True)[:10]

    return {
        "tu_ngay": tu_ngay,
        "den_ngay": den_ngay,
        "nhom": nhom,
        "tong_doanh_thu": tong_doanh_thu,
        "so_don_hang": so_don_hang,
        "theo_ky": theo_ky,
        "top_khach_hang": top_customers,
    }


# ── 3. Báo cáo Xuất-Nhập-Tồn kho ─────────────────────────────────────────────

@router.get("/inventory-movement")
def get_inventory_movement(
    tu_ngay: str = Query(...),
    den_ngay: str = Query(...),
    warehouse_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # SALE_ADMIN: chỉ thấy thành phẩm của KH mình theo dõi (lọc bỏ giấy + NVL)
    scoped_product_ids = None
    _scope_nv_ids = get_sale_visible_nv_ids(current_user)
    if _scope_nv_ids is not None:
        scoped_cids = db.query(Customer.id).filter(
            or_(
                Customer.nv_phu_trach_id.in_(_scope_nv_ids),
                exists().where(
                    (CustomerNhanVien.customer_id == Customer.id)
                    & (CustomerNhanVien.user_id.in_(_scope_nv_ids))
                ),
            )
        )
        scoped_product_ids = (
            db.query(SalesOrderItem.product_id)
            .join(SalesOrder, SalesOrder.id == SalesOrderItem.order_id)
            .filter(
                SalesOrder.customer_id.in_(scoped_cids),
                SalesOrderItem.product_id.isnot(None),
            )
            .distinct()
        )

    d_from = date.fromisoformat(tu_ngay)
    d_to = date.fromisoformat(den_ngay)

    # Lấy tất cả InventoryBalance (tồn hiện tại)
    bal_q = db.query(InventoryBalance)
    if warehouse_id:
        bal_q = bal_q.filter(InventoryBalance.warehouse_id == warehouse_id)
    if scoped_product_ids is not None:
        bal_q = bal_q.filter(
            InventoryBalance.product_id.isnot(None),
            InventoryBalance.product_id.in_(scoped_product_ids),
        )
    balances = bal_q.all()

    # Lấy transactions trong kỳ
    tx_q = (
        db.query(InventoryTransaction)
        .filter(
            func.date(InventoryTransaction.ngay_giao_dich) >= d_from,
            func.date(InventoryTransaction.ngay_giao_dich) <= d_to,
        )
    )
    if warehouse_id:
        tx_q = tx_q.filter(InventoryTransaction.warehouse_id == warehouse_id)
    if scoped_product_ids is not None:
        tx_q = tx_q.filter(
            InventoryTransaction.product_id.isnot(None),
            InventoryTransaction.product_id.in_(scoped_product_ids),
        )
    transactions = tx_q.all()

    # Tính tồn đầu kỳ: tổng NHAP - tổng XUAT trước date_from
    pre_q = (
        db.query(
            InventoryTransaction.warehouse_id,
            InventoryTransaction.paper_material_id,
            InventoryTransaction.other_material_id,
            InventoryTransaction.product_id,
            func.sum(
                case(
                    (InventoryTransaction.loai_giao_dich.in_(_NHAP_LOAI), InventoryTransaction.so_luong),
                    else_=0,
                )
            ).label("nhap_truoc"),
            func.sum(
                case(
                    (InventoryTransaction.loai_giao_dich.in_(_XUAT_LOAI), InventoryTransaction.so_luong),
                    else_=0,
                )
            ).label("xuat_truoc"),
        )
        .filter(func.date(InventoryTransaction.ngay_giao_dich) < d_from)
    )
    if warehouse_id:
        pre_q = pre_q.filter(InventoryTransaction.warehouse_id == warehouse_id)
    if scoped_product_ids is not None:
        pre_q = pre_q.filter(
            InventoryTransaction.product_id.isnot(None),
            InventoryTransaction.product_id.in_(scoped_product_ids),
        )
    pre_q = pre_q.group_by(
        InventoryTransaction.warehouse_id,
        InventoryTransaction.paper_material_id,
        InventoryTransaction.other_material_id,
        InventoryTransaction.product_id,
    )
    pre_rows = pre_q.all()

    key_ton_dau: dict[tuple, float] = {}
    for row in pre_rows:
        key = (row.warehouse_id, row.paper_material_id, row.other_material_id, row.product_id)
        key_ton_dau[key] = float(row.nhap_truoc or 0) - float(row.xuat_truoc or 0)

    # Lấy tên hàng từ master
    paper_map = {p.id: p for p in db.query(PaperMaterial).all()}
    other_map = {o.id: o for o in db.query(OtherMaterial).all()}
    product_map = {p.id: p for p in db.query(Product).all()}
    wh_map = {w.id: w.ten_kho for w in db.query(Warehouse).all()}

    def _ten_hang(b: InventoryBalance):
        if b.paper_material_id and b.paper_material_id in paper_map:
            return paper_map[b.paper_material_id].ten
        if b.other_material_id and b.other_material_id in other_map:
            return other_map[b.other_material_id].ten
        if b.product_id and b.product_id in product_map:
            return product_map[b.product_id].ten_hang
        return b.ten_hang or f"#{b.id}"

    def _don_vi(b: InventoryBalance):
        if b.paper_material_id and b.paper_material_id in paper_map:
            return paper_map[b.paper_material_id].dvt
        if b.other_material_id and b.other_material_id in other_map:
            return other_map[b.other_material_id].dvt
        if b.product_id and b.product_id in product_map:
            return product_map[b.product_id].dvt or "Thùng"
        return b.don_vi or ""

    # Tính nhập/xuất trong kỳ cho từng balance
    key_nhap: dict[tuple, float] = {}
    key_xuat: dict[tuple, float] = {}

    for tx in transactions:
        key = (tx.warehouse_id, tx.paper_material_id, tx.other_material_id, tx.product_id)
        if tx.loai_giao_dich in _NHAP_LOAI:
            key_nhap[key] = key_nhap.get(key, 0.0) + float(tx.so_luong)
        elif tx.loai_giao_dich in _XUAT_LOAI:
            key_xuat[key] = key_xuat.get(key, 0.0) + float(tx.so_luong)

    rows = []
    for b in balances:
        key = (b.warehouse_id, b.paper_material_id, b.other_material_id, b.product_id)
        nhap = key_nhap.get(key, 0.0)
        xuat = key_xuat.get(key, 0.0)
        # Tồn đầu kỳ = tổng nhập - tổng xuất TRƯỚC date_from
        ton_dau = key_ton_dau.get(key, 0.0)
        # Tồn cuối kỳ = tồn đầu + nhập trong kỳ - xuất trong kỳ
        ton_cuoi = ton_dau + nhap - xuat

        rows.append({
            "warehouse_id": b.warehouse_id,
            "ten_kho": wh_map.get(b.warehouse_id, ""),
            "ten_hang": _ten_hang(b),
            "don_vi": _don_vi(b),
            "ton_dau_ky": max(ton_dau, 0.0),
            "nhap_trong_ky": nhap,
            "xuat_trong_ky": xuat,
            "ton_cuoi_ky": max(ton_cuoi, 0.0),
            "gia_tri_ton": float(b.gia_tri_ton),
        })

    rows.sort(key=lambda r: (r["ten_kho"], r["ten_hang"]))

    return {
        "tu_ngay": tu_ngay,
        "den_ngay": den_ngay,
        "warehouse_id": warehouse_id,
        "rows": rows,
        "summary": {
            "tong_nhap": sum(r["nhap_trong_ky"] for r in rows),
            "tong_xuat": sum(r["xuat_trong_ky"] for r in rows),
            "tong_gia_tri_ton": sum(r["gia_tri_ton"] for r in rows),
        },
    }


# ── 4. Báo cáo năng suất sản xuất ────────────────────────────────────────────

@router.get("/production-performance")
def get_production_performance(
    tu_ngay: str = Query(...),
    den_ngay: str = Query(...),
    phan_xuong_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Báo cáo năng suất sản xuất theo lệnh: KH vs thực tế, tỉ lệ hoàn thành."""
    d_from = date.fromisoformat(tu_ngay)
    d_to = date.fromisoformat(den_ngay)

    q = (
        db.query(ProductionOrder)
        .filter(
            ProductionOrder.ngay_lenh >= d_from,
            ProductionOrder.ngay_lenh <= d_to,
            ProductionOrder.trang_thai.notin_(["huy"]),
        )
    )
    if phan_xuong_id:
        q = q.filter(ProductionOrder.phan_xuong_id == phan_xuong_id)

    orders = q.order_by(ProductionOrder.ngay_lenh).all()

    rows = []
    for o in orders:
        # Tính tổng kế hoạch và hoàn thành từ items
        tong_ke_hoach = sum(float(it.so_luong_ke_hoach or 0) for it in o.items)
        tong_hoan_thanh = sum(float(it.so_luong_hoan_thanh or 0) for it in o.items)
        ty_le = round(tong_hoan_thanh / tong_ke_hoach * 100, 1) if tong_ke_hoach > 0 else 0

        # Thông tin đơn hàng liên quan
        ten_khach = None
        if o.sales_order:
            customer = db.query(Customer).filter(Customer.id == o.sales_order.customer_id).first()
            ten_khach = customer.ten_viet_tat if customer else None

        rows.append({
            "production_order_id": o.id,
            "so_lenh": o.so_lenh,
            "ngay_lenh": o.ngay_lenh.isoformat() if o.ngay_lenh else None,
            "trang_thai": o.trang_thai,
            "ten_khach_hang": ten_khach,
            "phan_xuong_id": o.phan_xuong_id,
            "ten_phan_xuong": o.phan_xuong.ten_xuong if o.phan_xuong else None,
            "ngay_ke_hoach_xong": o.ngay_hoan_thanh_ke_hoach.isoformat() if o.ngay_hoan_thanh_ke_hoach else None,
            "ngay_thuc_te_xong": o.ngay_hoan_thanh_thuc_te.isoformat() if o.ngay_hoan_thanh_thuc_te else None,
            "tong_ke_hoach": tong_ke_hoach,
            "tong_hoan_thanh": tong_hoan_thanh,
            "ty_le_hoan_thanh": ty_le,
            "tre_han": (
                (o.ngay_hoan_thanh_thuc_te - o.ngay_hoan_thanh_ke_hoach).days
                if o.ngay_hoan_thanh_thuc_te and o.ngay_hoan_thanh_ke_hoach
                else None
            ),
        })

    return {
        "tu_ngay": tu_ngay,
        "den_ngay": den_ngay,
        "rows": rows,
        "summary": {
            "so_lenh": len(rows),
            "hoan_thanh": sum(1 for r in rows if r["trang_thai"] == "hoan_thanh"),
            "dang_chay": sum(1 for r in rows if r["trang_thai"] == "dang_chay"),
            "trung_binh_ty_le": round(
                sum(r["ty_le_hoan_thanh"] for r in rows) / len(rows), 1
            ) if rows else 0,
        },
    }


# ── 5. Báo cáo tiến độ đơn hàng ──────────────────────────────────────────────

@router.get("/order-progress")
def get_order_progress(
    tu_ngay: str = Query(...),
    den_ngay: str = Query(...),
    trang_thai: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Báo cáo tiến độ đơn hàng: SL đặt, đã sản xuất, đã giao, còn lại."""
    d_from = date.fromisoformat(tu_ngay)
    d_to = date.fromisoformat(den_ngay)

    q = (
        db.query(SalesOrder)
        .filter(
            SalesOrder.ngay_don >= d_from,
            SalesOrder.ngay_don <= d_to,
        )
    )
    if trang_thai:
        q = q.filter(SalesOrder.trang_thai == trang_thai)
    if customer_id:
        q = q.filter(SalesOrder.customer_id == customer_id)

    orders = q.order_by(SalesOrder.ngay_don.desc()).all()

    # Lấy map khách hàng
    customer_ids = list({o.customer_id for o in orders})
    customers_map = {
        c.id: c for c in db.query(Customer).filter(Customer.id.in_(customer_ids)).all()
    } if customer_ids else {}

    rows = []
    for o in orders:
        so_luong_dat = sum(float(it.so_luong or 0) for it in o.items)
        so_luong_da_xuat = sum(float(it.so_luong_da_xuat or 0) for it in o.items)
        con_lai = max(so_luong_dat - so_luong_da_xuat, 0)
        ty_le_giao = round(so_luong_da_xuat / so_luong_dat * 100, 1) if so_luong_dat > 0 else 0

        kh = customers_map.get(o.customer_id)
        rows.append({
            "sales_order_id": o.id,
            "so_don": o.so_don,
            "ngay_don": o.ngay_don.isoformat() if o.ngay_don else None,
            "ngay_giao_du_kien": o.ngay_giao.isoformat() if o.ngay_giao else None,
            "trang_thai": o.trang_thai,
            "customer_id": o.customer_id,
            "ten_khach_hang": kh.ten_viet_tat if kh else o.ten_khach_hang,
            "so_luong_dat": so_luong_dat,
            "so_luong_da_giao": so_luong_da_xuat,
            "so_luong_con_lai": con_lai,
            "ty_le_giao": ty_le_giao,
            "tong_tien": float(o.tong_tien or 0),
        })

    return {
        "tu_ngay": tu_ngay,
        "den_ngay": den_ngay,
        "rows": rows,
        "summary": {
            "so_don": len(rows),
            "tong_tien": sum(r["tong_tien"] for r in rows),
            "da_giao_xong": sum(1 for r in rows if r["ty_le_giao"] >= 100),
            "chua_giao": sum(1 for r in rows if r["so_luong_da_giao"] == 0),
        },
    }


# ── 6. Báo cáo vận chuyển theo xe / tài xế / tuyến ──────────────────────────

@router.get("/delivery-report")
def get_delivery_report(
    tu_ngay: str = Query(...),
    den_ngay: str = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Báo cáo vận chuyển: tổng chuyến, tổng SL theo xe/tài xế/khách hàng."""
    d_from = date.fromisoformat(tu_ngay)
    d_to = date.fromisoformat(den_ngay)

    deliveries = (
        db.query(DeliveryOrder)
        .filter(
            DeliveryOrder.ngay_xuat >= d_from,
            DeliveryOrder.ngay_xuat <= d_to,
            DeliveryOrder.trang_thai.notin_(["huy"]),
        )
        .order_by(DeliveryOrder.ngay_xuat)
        .all()
    )

    rows = []
    for d in deliveries:
        tong_sl = sum(float(it.so_luong or 0) for it in d.items)
        rows.append({
            "delivery_id": d.id,
            "so_phieu": d.so_phieu,
            "ngay_xuat": d.ngay_xuat.isoformat() if d.ngay_xuat else None,
            "so_don": d.so_don,
            "ten_khach": d.ten_khach,
            "ten_kho": d.ten_kho,
            "xe_van_chuyen": d.xe_van_chuyen,
            "nguoi_nhan": d.nguoi_nhan,
            "dia_chi_giao": d.dia_chi_giao,
            "tong_so_luong": tong_sl,
            "trang_thai": d.trang_thai,
        })

    # Tổng hợp theo xe
    by_xe: dict = {}
    for r in rows:
        xe = r["xe_van_chuyen"] or "Không rõ"
        if xe not in by_xe:
            by_xe[xe] = {"xe": xe, "so_chuyen": 0, "tong_so_luong": 0}
        by_xe[xe]["so_chuyen"] += 1
        by_xe[xe]["tong_so_luong"] += r["tong_so_luong"]

    return {
        "tu_ngay": tu_ngay,
        "den_ngay": den_ngay,
        "rows": rows,
        "by_xe": sorted(by_xe.values(), key=lambda x: x["so_chuyen"], reverse=True),
        "summary": {
            "tong_chuyen": len(rows),
            "tong_sl": sum(r["tong_so_luong"] for r in rows),
            "da_giao": sum(1 for r in rows if r["trang_thai"] == "da_giao"),
        },
    }


# ── Helpers xuất Excel ────────────────────────────────────────────────────────



# ── 7. Export: Báo cáo doanh thu ─────────────────────────────────────────────

@router.get("/revenue/export")
def export_revenue_excel(
    tu_ngay: str = Query(...),
    den_ngay: str = Query(...),
    nhom: str = Query("month", description="day | month | quarter"),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("report.export")),
):
    """Xuất báo cáo doanh thu ra file Excel (multi-sheet)."""
    from app.services.excel_export_service import build_xlsx_sheet
    from app.models.system import ExcelTemplate

    tpl1 = db.query(ExcelTemplate).filter(ExcelTemplate.ma_mau == "REVENUE_BY_PERIOD").first()
    tpl2 = db.query(ExcelTemplate).filter(ExcelTemplate.ma_mau == "REVENUE_TOP_CUSTOMERS").first()
    if not tpl1:
        raise HTTPException(404, "Chưa cấu hình mẫu Excel REVENUE_BY_PERIOD")
    if not tpl2:
        raise HTTPException(404, "Chưa cấu hình mẫu Excel REVENUE_TOP_CUSTOMERS")

    result = get_revenue_report(tu_ngay=tu_ngay, den_ngay=den_ngay, nhom=nhom, phap_nhan_id=None, db=db, _=_)
    meta = {"document_number": f"Doanh thu {tu_ngay} – {den_ngay}"}

    period_items = [{"ky": r["ky"], "doanh_thu": r["doanh_thu"]} for r in result["theo_ky"]]
    top_items = [
        {"stt": i, "ten_khach_hang": r["ten_khach_hang"], "so_don": r["so_don"], "doanh_thu": r["doanh_thu"]}
        for i, r in enumerate(result["top_khach_hang"], 1)
    ]

    wb = Workbook()
    build_xlsx_sheet(wb, tpl1, period_items, meta, {}, sheet_name="Theo kỳ")
    build_xlsx_sheet(wb, tpl2, top_items, meta, {}, sheet_name="Top khách hàng")

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    filename = f"doanh_thu_{tu_ngay}_{den_ngay}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── 8. Export: Báo cáo xuất-nhập-tồn kho ─────────────────────────────────────

@router.get("/inventory-movement/export")
def export_inventory_movement_excel(
    tu_ngay: str = Query(...),
    den_ngay: str = Query(...),
    warehouse_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("report.export")),
):
    """Xuất báo cáo xuất-nhập-tồn kho ra file Excel."""
    from app.services.excel_export_service import build_xlsx
    from app.models.system import ExcelTemplate

    tpl = db.query(ExcelTemplate).filter(ExcelTemplate.ma_mau == "INVENTORY_MOVEMENT").first()
    if not tpl:
        raise HTTPException(404, "Chưa cấu hình mẫu Excel INVENTORY_MOVEMENT")

    result = get_inventory_movement(
        tu_ngay=tu_ngay, den_ngay=den_ngay,
        warehouse_id=warehouse_id, db=db, current_user=_,
    )
    items_data = [
        {
            "ten_kho": r["ten_kho"],
            "ten_hang": r["ten_hang"],
            "don_vi": r["don_vi"],
            "ton_dau_ky": r["ton_dau_ky"],
            "nhap_trong_ky": r["nhap_trong_ky"],
            "xuat_trong_ky": r["xuat_trong_ky"],
            "ton_cuoi_ky": r["ton_cuoi_ky"],
            "gia_tri_ton": r["gia_tri_ton"],
        }
        for r in result["rows"]
    ]
    meta = {"document_number": f"Xuất nhập tồn {tu_ngay} – {den_ngay}"}
    xlsx_bytes = build_xlsx(tpl, items_data, meta, {})
    filename = f"xuat_nhap_ton_{tu_ngay}_{den_ngay}.xlsx"
    return StreamingResponse(
        iter([xlsx_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── 9. Export: Báo cáo công nợ tổng hợp ─────────────────────────────────────

@router.get("/debt-summary/export")
def export_debt_summary_excel(
    as_of_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("report.export")),
):
    """Xuất báo cáo công nợ tổng hợp (AR + AP) ra file Excel (multi-sheet)."""
    from app.services.excel_export_service import build_xlsx_sheet
    from app.models.system import ExcelTemplate

    tpl_ar = db.query(ExcelTemplate).filter(ExcelTemplate.ma_mau == "DEBT_SUMMARY_AR").first()
    tpl_ap = db.query(ExcelTemplate).filter(ExcelTemplate.ma_mau == "DEBT_SUMMARY_AP").first()
    if not tpl_ar:
        raise HTTPException(404, "Chưa cấu hình mẫu Excel DEBT_SUMMARY_AR")
    if not tpl_ap:
        raise HTTPException(404, "Chưa cấu hình mẫu Excel DEBT_SUMMARY_AP")

    result = get_debt_summary(as_of_date=as_of_date, phap_nhan_id=None, db=db, current_user=_)
    meta = {"document_number": f"Công nợ tổng hợp"}

    def _debt_items(rows: list[dict]) -> list[dict]:
        return [
            {
                "ten_doi_tuong": r["ten_doi_tuong"],
                "so_hoa_don": r["so_hoa_don"],
                "tong_phat_sinh": r["tong_phat_sinh"],
                "da_thanh_toan": r["da_thanh_toan"],
                "con_lai": r["con_lai"],
                "trong_han": r["trong_han"],
                "qua_han": r["qua_han"],
            }
            for r in rows
        ]

    wb = Workbook()
    build_xlsx_sheet(wb, tpl_ar, _debt_items(result["ar"]["rows"]), meta, {}, sheet_name="Phải thu (AR)")
    build_xlsx_sheet(wb, tpl_ap, _debt_items(result["ap"]["rows"]), meta, {}, sheet_name="Phải trả (AP)")

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    today_str = result["as_of_date"].replace("-", "")
    filename = f"cong_no_{today_str}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── 10. Export: Báo cáo năng suất sản xuất ───────────────────────────────────

@router.get("/production-performance/export")
def export_production_performance_excel(
    tu_ngay: str = Query(...),
    den_ngay: str = Query(...),
    phan_xuong_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("report.export")),
):
    """Xuất báo cáo năng suất sản xuất ra file Excel."""
    from app.services.excel_export_service import build_xlsx
    from app.models.system import ExcelTemplate

    tpl = db.query(ExcelTemplate).filter(ExcelTemplate.ma_mau == "PRODUCTION_PERFORMANCE").first()
    if not tpl:
        raise HTTPException(404, "Chưa cấu hình mẫu Excel PRODUCTION_PERFORMANCE")

    result = get_production_performance(
        tu_ngay=tu_ngay, den_ngay=den_ngay,
        phan_xuong_id=phan_xuong_id, db=db, _=_,
    )
    items_data = [
        {
            "so_lenh": r["so_lenh"],
            "ngay_lenh": r["ngay_lenh"] or "",
            "trang_thai": r["trang_thai"],
            "ten_khach_hang": r["ten_khach_hang"] or "",
            "ten_phan_xuong": r["ten_phan_xuong"] or "",
            "tong_ke_hoach": r["tong_ke_hoach"],
            "tong_hoan_thanh": r["tong_hoan_thanh"],
            "ty_le_hoan_thanh": r["ty_le_hoan_thanh"],
            "ngay_ke_hoach_xong": r["ngay_ke_hoach_xong"] or "",
            "ngay_thuc_te_xong": r["ngay_thuc_te_xong"] or "",
            "tre_han": r["tre_han"] if r["tre_han"] is not None else "",
        }
        for r in result["rows"]
    ]
    meta = {"document_number": f"Năng suất SX {tu_ngay} – {den_ngay}"}
    xlsx_bytes = build_xlsx(tpl, items_data, meta, {})
    filename = f"nang_suat_sx_{tu_ngay}_{den_ngay}.xlsx"
    return StreamingResponse(
        iter([xlsx_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── 11. Export: Báo cáo tiến độ đơn hàng ─────────────────────────────────────

@router.get("/order-progress/export")
def export_order_progress_excel(
    tu_ngay: str = Query(...),
    den_ngay: str = Query(...),
    trang_thai: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("report.export")),
):
    """Xuất báo cáo tiến độ đơn hàng ra file Excel."""
    from app.services.excel_export_service import build_xlsx
    from app.models.system import ExcelTemplate

    tpl = db.query(ExcelTemplate).filter(ExcelTemplate.ma_mau == "ORDER_PROGRESS").first()
    if not tpl:
        raise HTTPException(404, "Chưa cấu hình mẫu Excel ORDER_PROGRESS")

    result = get_order_progress(
        tu_ngay=tu_ngay, den_ngay=den_ngay,
        trang_thai=trang_thai, customer_id=customer_id, db=db, _=_,
    )
    items_data = [
        {
            "so_don": r["so_don"],
            "ngay_don": r["ngay_don"] or "",
            "ngay_giao_du_kien": r["ngay_giao_du_kien"] or "",
            "trang_thai": r["trang_thai"],
            "ten_khach_hang": r["ten_khach_hang"] or "",
            "so_luong_dat": r["so_luong_dat"],
            "so_luong_da_giao": r["so_luong_da_giao"],
            "so_luong_con_lai": r["so_luong_con_lai"],
            "ty_le_giao": r["ty_le_giao"],
            "tong_tien": r["tong_tien"],
        }
        for r in result["rows"]
    ]
    meta = {"document_number": f"Tiến độ đơn hàng {tu_ngay} – {den_ngay}"}
    xlsx_bytes = build_xlsx(tpl, items_data, meta, {})
    filename = f"tien_do_don_hang_{tu_ngay}_{den_ngay}.xlsx"
    return StreamingResponse(
        iter([xlsx_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── 12. Báo cáo chi phí / lợi nhuận theo LSX ─────────────────────────────────

def _build_production_cost_rows(
    db: Session,
    tu_ngay: Optional[str],
    den_ngay: Optional[str],
    phap_nhan_id: Optional[int],
    phan_xuong_id: Optional[int],
    trang_thai: Optional[str],
):
    q = db.query(ProductionOrder).options(
        selectinload(ProductionOrder.items).selectinload(ProductionOrderItem.sales_order_item),
        joinedload(ProductionOrder.sales_order).joinedload(SalesOrder.customer),
        joinedload(ProductionOrder.phap_nhan),
        joinedload(ProductionOrder.phan_xuong),
    )
    if tu_ngay:
        q = q.filter(ProductionOrder.ngay_lenh >= date.fromisoformat(tu_ngay))
    if den_ngay:
        q = q.filter(ProductionOrder.ngay_lenh <= date.fromisoformat(den_ngay))
    if phap_nhan_id:
        q = q.filter(ProductionOrder.phap_nhan_id == phap_nhan_id)
    if phan_xuong_id:
        q = q.filter(ProductionOrder.phan_xuong_id == phan_xuong_id)
    if trang_thai:
        q = q.filter(ProductionOrder.trang_thai == trang_thai)

    orders = q.order_by(ProductionOrder.ngay_lenh.desc(), ProductionOrder.so_lenh.desc()).all()
    if not orders:
        return [], {}

    # Lấy chi phí phân bổ theo LSX (sum nếu nhiều kỳ)
    order_ids = [o.id for o in orders]
    alloc_rows = (
        db.query(
            ProductionCostAllocation.production_order_id,
            func.coalesce(func.sum(ProductionCostAllocation.chi_phi_nvl), 0).label("chi_phi_nvl"),
            func.coalesce(func.sum(ProductionCostAllocation.chi_phi_nhan_cong), 0).label("chi_phi_nhan_cong"),
            func.coalesce(func.sum(ProductionCostAllocation.chi_phi_sxc), 0).label("chi_phi_sxc"),
            func.coalesce(func.sum(ProductionCostAllocation.tong_chi_phi), 0).label("tong_chi_phi"),
        )
        .filter(ProductionCostAllocation.production_order_id.in_(order_ids))
        .group_by(ProductionCostAllocation.production_order_id)
        .all()
    )
    cost_map = {
        r.production_order_id: {
            "chi_phi_nvl": float(r.chi_phi_nvl),
            "chi_phi_nhan_cong": float(r.chi_phi_nhan_cong),
            "chi_phi_sxc": float(r.chi_phi_sxc),
            "tong_chi_phi": float(r.tong_chi_phi),
        }
        for r in alloc_rows
    }

    rows = []
    for o in orders:
        # Doanh thu: số lượng LSX × đơn giá SO item
        doanh_thu = Decimal("0")
        for item in o.items:
            soi: SalesOrderItem | None = item.sales_order_item
            if soi and soi.don_gia:
                qty = item.so_luong_ke_hoach or Decimal("0")
                unit_price = soi.don_gia
                if soi.ty_le_giam_gia and soi.ty_le_giam_gia > 0:
                    unit_price = unit_price * (1 - soi.ty_le_giam_gia / Decimal("100"))
                doanh_thu += qty * unit_price

        costs = cost_map.get(o.id, {
            "chi_phi_nvl": 0, "chi_phi_nhan_cong": 0, "chi_phi_sxc": 0, "tong_chi_phi": 0
        })
        doanh_thu_f = float(doanh_thu)
        tong_cp = costs["tong_chi_phi"]
        loi_nhuan = doanh_thu_f - tong_cp
        ty_le_ln = round(loi_nhuan / doanh_thu_f * 100, 1) if doanh_thu_f > 0 else None

        first_item = o.items[0] if o.items else None
        so_luong_kh = sum(float(i.so_luong_ke_hoach or 0) for i in o.items)
        so_luong_ht = sum(float(i.so_luong_hoan_thanh or 0) for i in o.items)
        dien_tich = sum(
            float(i.dien_tich or 0) * float(i.so_luong_ke_hoach or 0)
            for i in o.items
        )

        so_don = o.sales_order.so_don if o.sales_order else None
        ten_khach = None
        if o.sales_order and o.sales_order.customer:
            c = o.sales_order.customer
            ten_khach = c.ten_viet_tat or c.ten_don_vi

        rows.append({
            "lsx_id": o.id,
            "so_lenh": o.so_lenh,
            "ngay_lenh": o.ngay_lenh.isoformat() if o.ngay_lenh else None,
            "trang_thai": o.trang_thai,
            "ten_hang": first_item.ten_hang if first_item else None,
            "so_luong_ke_hoach": round(so_luong_kh, 0),
            "so_luong_hoan_thanh": round(so_luong_ht, 0),
            "dien_tich": round(dien_tich, 2),
            "so_don": so_don,
            "ten_khach": ten_khach,
            "ten_phap_nhan": o.phap_nhan.ten_phap_nhan if o.phap_nhan else None,
            "ten_xuong": o.phan_xuong.ten_xuong if o.phan_xuong else None,
            "doanh_thu": round(doanh_thu_f, 0),
            "chi_phi_nvl": round(costs["chi_phi_nvl"], 0),
            "chi_phi_nhan_cong": round(costs["chi_phi_nhan_cong"], 0),
            "chi_phi_sxc": round(costs["chi_phi_sxc"], 0),
            "tong_chi_phi": round(tong_cp, 0),
            "da_phan_bo": o.id in cost_map,
            "loi_nhuan": round(loi_nhuan, 0),
            "ty_le_loi_nhuan": ty_le_ln,
        })

    tong_dt = sum(r["doanh_thu"] for r in rows)
    tong_cp = sum(r["tong_chi_phi"] for r in rows)
    tong_ln = sum(r["loi_nhuan"] for r in rows)
    totals = {
        "tong_doanh_thu": round(tong_dt, 0),
        "tong_chi_phi_nvl": round(sum(r["chi_phi_nvl"] for r in rows), 0),
        "tong_chi_phi_nhan_cong": round(sum(r["chi_phi_nhan_cong"] for r in rows), 0),
        "tong_chi_phi_sxc": round(sum(r["chi_phi_sxc"] for r in rows), 0),
        "tong_chi_phi": round(tong_cp, 0),
        "tong_loi_nhuan": round(tong_ln, 0),
        "ty_le_loi_nhuan": round(tong_ln / tong_dt * 100, 1) if tong_dt > 0 else None,
    }
    return rows, totals


@router.get("/production-cost")
def get_production_cost_report(
    tu_ngay: Optional[str] = Query(None, description="YYYY-MM-DD"),
    den_ngay: Optional[str] = Query(None, description="YYYY-MM-DD"),
    phap_nhan_id: Optional[int] = Query(None),
    phan_xuong_id: Optional[int] = Query(None),
    trang_thai: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Báo cáo chi phí và lợi nhuận theo lệnh sản xuất."""
    rows, totals = _build_production_cost_rows(
        db, tu_ngay, den_ngay, phap_nhan_id, phan_xuong_id, trang_thai
    )
    return {"rows": rows, "totals": totals, "total": len(rows)}


@router.get("/production-cost/export")
def export_production_cost_excel(
    tu_ngay: Optional[str] = Query(None),
    den_ngay: Optional[str] = Query(None),
    phap_nhan_id: Optional[int] = Query(None),
    phan_xuong_id: Optional[int] = Query(None),
    trang_thai: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("report.export")),
):
    """Xuất Excel báo cáo chi phí / lợi nhuận theo LSX."""
    from app.services.excel_export_service import build_xlsx
    from app.models.system import ExcelTemplate

    tpl = db.query(ExcelTemplate).filter(ExcelTemplate.ma_mau == "PRODUCTION_COST").first()
    if not tpl:
        raise HTTPException(404, "Chưa cấu hình mẫu Excel PRODUCTION_COST")

    rows, totals = _build_production_cost_rows(
        db, tu_ngay, den_ngay, phap_nhan_id, phan_xuong_id, trang_thai
    )

    items_data = [
        {
            "so_lenh": r["so_lenh"],
            "ngay_lenh": r["ngay_lenh"] or "",
            "trang_thai": r["trang_thai"],
            "ten_hang": r["ten_hang"] or "",
            "ten_khach": r["ten_khach"] or "",
            "so_don": r["so_don"] or "",
            "ten_phap_nhan": r["ten_phap_nhan"] or "",
            "ten_xuong": r["ten_xuong"] or "",
            "so_luong_ke_hoach": r["so_luong_ke_hoach"],
            "so_luong_hoan_thanh": r["so_luong_hoan_thanh"],
            "dien_tich": r["dien_tich"],
            "doanh_thu": r["doanh_thu"],
            "chi_phi_nvl": r["chi_phi_nvl"],
            "chi_phi_nhan_cong": r["chi_phi_nhan_cong"],
            "chi_phi_sxc": r["chi_phi_sxc"],
            "tong_chi_phi": r["tong_chi_phi"],
            "da_phan_bo": "Có" if r["da_phan_bo"] else "Chưa",
            "loi_nhuan": r["loi_nhuan"],
            "ty_le_loi_nhuan": r["ty_le_loi_nhuan"] if r["ty_le_loi_nhuan"] is not None else "",
        }
        for r in rows
    ]

    suffix = f"_{tu_ngay}_{den_ngay}" if tu_ngay else ""
    meta = {"document_number": f"Chi phí & Lợi nhuận LSX{suffix.replace('_', ' ')}"}
    xlsx_bytes = build_xlsx(tpl, items_data, meta, {})
    filename = f"chi_phi_loi_nhuan_lsx{suffix}.xlsx"
    return StreamingResponse(
        iter([xlsx_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── BÁO CÁO DOANH SỐ THEO XƯỞNG (GROUP) ─────────────────────────────────────

@router.get("/sales-by-workshop")
def get_sales_by_workshop(
    tu_ngay: date = Query(...),
    den_ngay: date = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Doanh số Group theo xưởng — per-workshop so với mục tiêu tháng"""
    from datetime import date as _date
    thang_dau = _date(tu_ngay.year, tu_ngay.month, 1)

    xuong_list = db.query(PhanXuong).order_by(PhanXuong.id).all()

    # Mục tiêu tháng per xưởng (tổng tất cả NV của xưởng đó)
    targets_q = db.query(
        SalesTarget.phan_xuong_id,
        func.sum(SalesTarget.muc_tieu).label("muc_tieu"),
    ).filter(SalesTarget.thang == thang_dau).group_by(SalesTarget.phan_xuong_id).all()
    target_map = {row.phan_xuong_id: float(row.muc_tieu) for row in targets_q}
    # Mục tiêu không phân xưởng = tổng toàn group
    target_total = sum(target_map.values())

    # Doanh số per xưởng
    ds_q = db.query(
        SalesOrder.phan_xuong_id,
        func.sum(SalesOrder.tong_tien).label("thuc_hien"),
    ).filter(
        SalesOrder.ngay_don.between(tu_ngay, den_ngay),
        SalesOrder.trang_thai.notin_(["huy"]),
    ).group_by(SalesOrder.phan_xuong_id).all()
    ds_map = {row.phan_xuong_id: float(row.thuc_hien or 0) for row in ds_q}

    # Doanh số theo ngày × xưởng
    ds_ngay_q = db.query(
        SalesOrder.ngay_don,
        SalesOrder.phan_xuong_id,
        func.sum(SalesOrder.tong_tien).label("tien"),
    ).filter(
        SalesOrder.ngay_don.between(tu_ngay, den_ngay),
        SalesOrder.trang_thai.notin_(["huy"]),
    ).group_by(SalesOrder.ngay_don, SalesOrder.phan_xuong_id).all()

    ngay_map: dict = {}
    for row in ds_ngay_q:
        key = str(row.ngay_don)
        if key not in ngay_map:
            ngay_map[key] = {}
        ngay_map[key][row.phan_xuong_id] = float(row.tien or 0)

    xuong_result = []
    ds_total = 0.0
    for px in xuong_list:
        thuc_hien = ds_map.get(px.id, 0.0)
        muc_tieu = target_map.get(px.id, 0.0)
        ds_total += thuc_hien
        xuong_result.append({
            "phan_xuong_id": px.id,
            "ten": px.ten_xuong,
            "muc_tieu_thang": muc_tieu,
            "thuc_hien": thuc_hien,
            "ty_le": round(thuc_hien / muc_tieu, 4) if muc_tieu else None,
        })
    xuong_result.append({
        "phan_xuong_id": None, "ten": "Tổng Group",
        "muc_tieu_thang": target_total,
        "thuc_hien": ds_total,
        "ty_le": round(ds_total / target_total, 4) if target_total else None,
    })

    theo_ngay = [
        {"ngay": ngay, "values": {str(k): v for k, v in vals.items()},
         "total": sum(vals.values())}
        for ngay, vals in sorted(ngay_map.items())
    ]

    return {"tu_ngay": str(tu_ngay), "den_ngay": str(den_ngay),
            "xuong": xuong_result, "theo_ngay": theo_ngay}


# ── BÁO CÁO DOANH SỐ THEO NV KD ─────────────────────────────────────────────

@router.get("/sales-by-nvkd")
def get_sales_by_nvkd(
    tu_ngay: date = Query(...),
    den_ngay: date = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Doanh số theo NV KD + mục tiêu tháng"""
    from datetime import date as _date
    thang_dau = _date(tu_ngay.year, tu_ngay.month, 1)

    # Mục tiêu per user
    targets_q = db.query(
        SalesTarget.user_id,
        func.sum(SalesTarget.muc_tieu).label("muc_tieu"),
    ).filter(SalesTarget.thang == thang_dau, SalesTarget.phan_xuong_id == None
             ).group_by(SalesTarget.user_id).all()
    target_map = {row.user_id: float(row.muc_tieu) for row in targets_q}

    # Doanh số per NV KD
    ds_q = db.query(
        SalesOrder.nv_kinh_doanh_id,
        func.sum(SalesOrder.tong_tien).label("thuc_hien"),
    ).filter(
        SalesOrder.ngay_don.between(tu_ngay, den_ngay),
        SalesOrder.trang_thai.notin_(["huy"]),
        SalesOrder.nv_kinh_doanh_id != None,
    ).group_by(SalesOrder.nv_kinh_doanh_id).all()

    nv_ids = list({row.nv_kinh_doanh_id for row in ds_q} | set(target_map.keys()))
    users = {u.id: u for u in db.query(UserModel).filter(UserModel.id.in_(nv_ids)).all()}

    # Doanh số theo ngày per NV
    ds_ngay_q = db.query(
        SalesOrder.ngay_don,
        SalesOrder.nv_kinh_doanh_id,
        func.sum(SalesOrder.tong_tien).label("tien"),
    ).filter(
        SalesOrder.ngay_don.between(tu_ngay, den_ngay),
        SalesOrder.trang_thai.notin_(["huy"]),
        SalesOrder.nv_kinh_doanh_id.in_(nv_ids),
    ).group_by(SalesOrder.ngay_don, SalesOrder.nv_kinh_doanh_id).all()

    theo_ngay_map: dict = {}
    for row in ds_ngay_q:
        key = str(row.ngay_don)
        if key not in theo_ngay_map:
            theo_ngay_map[key] = {}
        theo_ngay_map[key][row.nv_kinh_doanh_id] = float(row.tien or 0)

    ds_map = {row.nv_kinh_doanh_id: float(row.thuc_hien or 0) for row in ds_q}
    result = []
    for uid in sorted(nv_ids):
        u = users.get(uid)
        thuc_hien = ds_map.get(uid, 0.0)
        muc_tieu = target_map.get(uid, 0.0)
        result.append({
            "user_id": uid,
            "ten": u.ho_ten if u else f"User {uid}",
            "username": u.username if u else None,
            "muc_tieu_thang": muc_tieu,
            "thuc_hien": thuc_hien,
            "ty_le": round(thuc_hien / muc_tieu, 4) if muc_tieu else None,
            "theo_ngay": {str(k): v for k, v in theo_ngay_map.items()
                          if uid in {r: val for r, val in v.items()}},
        })

    theo_ngay = [
        {"ngay": ngay, "values": {str(k): v for k, v in vals.items()},
         "total": sum(vals.values())}
        for ngay, vals in sorted(theo_ngay_map.items())
    ]

    return {"tu_ngay": str(tu_ngay), "den_ngay": str(den_ngay),
            "nvkd": result, "theo_ngay": theo_ngay}


# ── CRUD SALES TARGETS ────────────────────────────────────────────────────────

@router.get("/sales-targets")
def list_sales_targets(
    thang: date | None = Query(None),
    user_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(SalesTarget)
    if thang:
        q = q.filter(SalesTarget.thang == thang)
    if user_id:
        q = q.filter(SalesTarget.user_id == user_id)
    rows = q.order_by(SalesTarget.thang.desc(), SalesTarget.user_id).all()
    return [{"id": r.id, "user_id": r.user_id, "phan_xuong_id": r.phan_xuong_id,
             "thang": str(r.thang), "muc_tieu": float(r.muc_tieu), "ghi_chu": r.ghi_chu} for r in rows]


@router.post("/sales-targets", status_code=201)
def create_sales_target(
    body: dict,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("report.export")),
):
    from datetime import date as _date
    thang_str = body.get("thang", "")
    thang = _date.fromisoformat(thang_str[:7] + "-01") if thang_str else None
    if not thang:
        raise HTTPException(400, "thang là bắt buộc (YYYY-MM)")
    t = SalesTarget(
        user_id=body["user_id"],
        phan_xuong_id=body.get("phan_xuong_id"),
        thang=thang,
        muc_tieu=Decimal(str(body["muc_tieu"])),
        ghi_chu=body.get("ghi_chu"),
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"id": t.id, "user_id": t.user_id, "thang": str(t.thang), "muc_tieu": float(t.muc_tieu)}


@router.put("/sales-targets/{target_id}")
def update_sales_target(
    target_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("report.export")),
):
    t = db.get(SalesTarget, target_id)
    if not t:
        raise HTTPException(404, "Không tìm thấy mục tiêu")
    if "muc_tieu" in body:
        t.muc_tieu = Decimal(str(body["muc_tieu"]))
    if "ghi_chu" in body:
        t.ghi_chu = body["ghi_chu"]
    db.commit()
    return {"id": t.id, "muc_tieu": float(t.muc_tieu)}


@router.delete("/sales-targets/{target_id}", status_code=204)
def delete_sales_target(
    target_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("report.export")),
):
    t = db.get(SalesTarget, target_id)
    if not t:
        raise HTTPException(404, "Không tìm thấy mục tiêu")
    db.delete(t)
    db.commit()


# ─── Sale Dashboard ────────────────────────────────────────────────────────────

@router.get("/sale-dashboard")
def get_sale_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dashboard KPI cho sale admin: pending quotes, revenue, customers assigned."""
    from datetime import timedelta
    from sqlalchemy import and_

    role_code = current_user.role.ma_vai_tro if current_user.role else None
    if role_code not in _SALE_REPORT_ROLES:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập dashboard Sale")
    scope_nv_ids = get_sale_visible_nv_ids(current_user)

    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    # Base quote query scoped to user's visibility
    q_base = db.query(Quote)
    if scope_nv_ids is not None:
        q_base = q_base.filter(
            or_(
                Quote.nv_phu_trach_id.in_(scope_nv_ids),
                Quote.created_by.in_(scope_nv_ids),
            )
        )

    pending_quotes = q_base.filter(Quote.trang_thai == "cho_duyet").count()

    approved_quotes_week = q_base.filter(
        Quote.trang_thai == "da_duyet",
        func.date(Quote.approved_at) >= week_start,
    ).count()

    # Revenue from approved sales orders this month
    so_q = db.query(func.sum(SalesOrder.tong_tien)).filter(
        SalesOrder.trang_thai.in_(["da_xuat", "hoan_thanh", "da_duyet"]),
        func.date(SalesOrder.ngay_don) >= month_start,
    )
    if scope_nv_ids is not None:
        from app.models.master import CustomerNhanVien
        visible_customers = (
            db.query(Customer.id)
            .join(CustomerNhanVien, CustomerNhanVien.customer_id == Customer.id)
            .filter(CustomerNhanVien.user_id.in_(scope_nv_ids))
        )
        so_q = so_q.filter(SalesOrder.customer_id.in_(visible_customers))
    total_revenue_month = float(so_q.scalar() or 0)

    # Customers assigned
    if scope_nv_ids is None:
        customers_assigned = db.query(func.count(Customer.id)).filter(Customer.trang_thai.is_(True)).scalar() or 0
    else:
        from app.models.master import CustomerNhanVien
        customers_assigned = (
            db.query(func.count(func.distinct(CustomerNhanVien.customer_id)))
            .filter(CustomerNhanVien.user_id.in_(scope_nv_ids))
            .scalar() or 0
        )

    return {
        "pending_quotes": pending_quotes,
        "approved_quotes_week": approved_quotes_week,
        "total_revenue_month": total_revenue_month,
        "customers_assigned": customers_assigned,
    }


@router.get("/quote-funnel")
def get_quote_funnel(
    tu_ngay: Optional[str] = Query(default=None),
    den_ngay: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Phễu báo giá: đếm số lượng theo trạng thái."""
    role_code = current_user.role.ma_vai_tro if current_user.role else None
    if role_code not in _SALE_REPORT_ROLES:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập báo cáo Sale")
    scope_nv_ids = get_sale_visible_nv_ids(current_user)

    q = db.query(Quote.trang_thai, func.count(Quote.id).label("count")).group_by(Quote.trang_thai)

    if scope_nv_ids is not None:
        q = q.filter(
            or_(
                Quote.nv_phu_trach_id.in_(scope_nv_ids),
                Quote.created_by.in_(scope_nv_ids),
            )
        )
    if tu_ngay:
        q = q.filter(func.date(Quote.ngay_bao_gia) >= tu_ngay)
    if den_ngay:
        q = q.filter(func.date(Quote.ngay_bao_gia) <= den_ngay)

    rows = q.all()
    counts = {r.trang_thai: r.count for r in rows}
    return {
        "moi": counts.get("moi", 0),
        "cho_duyet": counts.get("cho_duyet", 0),
        "da_duyet": counts.get("da_duyet", 0),
        "tu_choi": counts.get("tu_choi", 0),
        "het_han": counts.get("het_han", 0),
        "huy": counts.get("huy", 0),
    }


@router.get("/sale-by-nv")
def get_sale_by_nv(
    tu_ngay: Optional[str] = Query(default=None),
    den_ngay: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Báo cáo hiệu suất sale theo nhân viên."""
    from app.models.auth import Role
    _SALE_ROLES = {"SALE_ADMIN", "TRUONG_PHONG_SALE_ADMIN"}
    role_code = current_user.role.ma_vai_tro if current_user.role else None
    if role_code not in _SALE_REPORT_ROLES:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập báo cáo Sale")
    scope_nv_ids = get_sale_visible_nv_ids(current_user)

    nv_query = db.query(User).join(Role, User.role_id == Role.id).filter(
        Role.ma_vai_tro.in_(_SALE_ROLES),
        User.trang_thai.is_(True),
    )
    if scope_nv_ids is not None:
        nv_query = nv_query.filter(User.id.in_(scope_nv_ids))
    nvs = nv_query.order_by(User.ho_ten).all()

    result = []
    for nv in nvs:
        q_filter = [Quote.nv_phu_trach_id == nv.id]
        if tu_ngay:
            q_filter.append(func.date(Quote.ngay_bao_gia) >= tu_ngay)
        if den_ngay:
            q_filter.append(func.date(Quote.ngay_bao_gia) <= den_ngay)

        so_bao_gia = db.query(func.count(Quote.id)).filter(*q_filter).scalar() or 0
        so_duyet = db.query(func.count(Quote.id)).filter(*q_filter, Quote.trang_thai == "da_duyet").scalar() or 0

        so_filter = [SalesOrder.nv_kinh_doanh_id == nv.id]
        if tu_ngay:
            so_filter.append(func.date(SalesOrder.ngay_don) >= tu_ngay)
        if den_ngay:
            so_filter.append(func.date(SalesOrder.ngay_don) <= den_ngay)

        so_row = db.query(
            func.count(SalesOrder.id),
            func.coalesce(func.sum(SalesOrder.tong_tien), 0),
        ).filter(*so_filter).first()
        so_don_hang = so_row[0] or 0
        tong_doanh_thu = float(so_row[1] or 0)

        ty_le = round(so_duyet / so_bao_gia * 100, 1) if so_bao_gia > 0 else 0.0

        result.append({
            "nv_id": nv.id,
            "nv_name": nv.ho_ten,
            "username": nv.username,
            "so_bao_gia": so_bao_gia,
            "so_don_hang": so_don_hang,
            "tong_doanh_thu": tong_doanh_thu,
            "ty_le_chuyen_doi": ty_le,
        })
    return result


@router.get("/customer-by-nv")
def get_customer_by_nv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Danh sách khách hàng kèm NV phụ trách và tổng đơn hàng."""
    from sqlalchemy import exists as sa_exists
    role_code = current_user.role.ma_vai_tro if current_user.role else None
    if role_code not in _SALE_REPORT_ROLES:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập báo cáo Sale")
    scope_nv_ids = get_sale_visible_nv_ids(current_user)

    q = (
        db.query(
            Customer.id,
            Customer.ma_kh,
            Customer.ten_viet_tat,
            Customer.nv_phu_trach_id,
            func.count(SalesOrder.id).label("so_don_hang"),
            func.coalesce(func.sum(SalesOrder.tong_tien), 0).label("tong_doanh_thu"),
        )
        .outerjoin(SalesOrder, SalesOrder.customer_id == Customer.id)
        .filter(Customer.trang_thai.is_(True))
        .group_by(Customer.id, Customer.ma_kh, Customer.ten_viet_tat, Customer.nv_phu_trach_id)
    )
    if scope_nv_ids is not None:
        q = q.filter(
            or_(
                Customer.nv_phu_trach_id.in_(scope_nv_ids),
                sa_exists().where(
                    (CustomerNhanVien.customer_id == Customer.id)
                    & (CustomerNhanVien.user_id.in_(scope_nv_ids))
                ),
            )
        )

    rows = q.order_by(Customer.ten_viet_tat).all()

    # NV name lookup
    nv_ids_needed = {r.nv_phu_trach_id for r in rows if r.nv_phu_trach_id}
    nv_map: dict[int, str] = {}
    if nv_ids_needed:
        nv_map = {
            u.id: u.ho_ten
            for u in db.query(User).filter(User.id.in_(nv_ids_needed)).all()
        }

    return [
        {
            "customer_id": r.id,
            "ma_kh": r.ma_kh,
            "ten_viet_tat": r.ten_viet_tat,
            "nv_phu_trach_id": r.nv_phu_trach_id,
            "nv_phu_trach_name": nv_map.get(r.nv_phu_trach_id) if r.nv_phu_trach_id else None,
            "so_don_hang": r.so_don_hang or 0,
            "tong_doanh_thu": float(r.tong_doanh_thu or 0),
        }
        for r in rows
    ]
