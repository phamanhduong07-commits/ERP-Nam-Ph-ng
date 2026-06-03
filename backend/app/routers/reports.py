import io
from datetime import date
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, case
from sqlalchemy.orm import Session, selectinload, joinedload
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.billing import SalesInvoice
from app.models.accounting import PurchaseInvoice, ProductionCostAllocation
from app.models.sales import SalesOrder, SalesOrderItem
from app.models.master import Customer, Warehouse
from app.models.inventory import InventoryTransaction, InventoryBalance
from app.models.master import PaperMaterial, OtherMaterial, Product
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.warehouse_doc import DeliveryOrder

router = APIRouter(prefix="/api/reports", tags=["reports"])

# ── Hằng số ──────────────────────────────────────────────────────────────────

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
    _: User = Depends(get_current_user),
):
    today = date.fromisoformat(as_of_date) if as_of_date else date.today()

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
    _: User = Depends(get_current_user),
):
    d_from = date.fromisoformat(tu_ngay)
    d_to = date.fromisoformat(den_ngay)

    # Lấy tất cả InventoryBalance (tồn hiện tại)
    bal_q = db.query(InventoryBalance)
    if warehouse_id:
        bal_q = bal_q.filter(InventoryBalance.warehouse_id == warehouse_id)
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

_HEADER_FILL = PatternFill("solid", fgColor="E65100")
_HEADER_FONT = Font(bold=True, color="FFFFFF")
_HEADER_ALIGN = Alignment(horizontal="center", vertical="center", wrap_text=True)


def _make_workbook(sheet_name: str, headers: list[str], rows: list[list]) -> Workbook:
    """Tạo workbook Excel với header màu cam Nam Phương và dữ liệu."""
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name[:31]

    # Header row
    ws.append(headers)
    for cell in ws[1]:
        cell.font = _HEADER_FONT
        cell.fill = _HEADER_FILL
        cell.alignment = _HEADER_ALIGN

    # Data rows
    for row in rows:
        ws.append(row)

    # Auto column width (capped at 40 chars)
    for col in ws.columns:
        max_len = max(
            (len(str(c.value)) if c.value is not None else 0) for c in col
        )
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 40)

    return wb


def _stream_workbook(wb: Workbook, filename: str) -> StreamingResponse:
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── 7. Export: Báo cáo doanh thu ─────────────────────────────────────────────

@router.get("/revenue/export")
def export_revenue_excel(
    tu_ngay: str = Query(...),
    den_ngay: str = Query(...),
    nhom: str = Query("month", description="day | month | quarter"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Xuất báo cáo doanh thu ra file Excel."""
    # Lấy data từ endpoint gốc (reuse logic)
    result = get_revenue_report(tu_ngay=tu_ngay, den_ngay=den_ngay, nhom=nhom, db=db, _=_)

    # Sheet 1: Doanh thu theo kỳ
    wb = _make_workbook(
        "Theo kỳ",
        ["Kỳ", "Doanh thu (đ)"],
        [[r["ky"], r["doanh_thu"]] for r in result["theo_ky"]],
    )

    # Sheet 2: Top khách hàng
    ws2 = wb.create_sheet("Top khách hàng")
    headers2 = ["#", "Khách hàng", "Số đơn", "Doanh thu (đ)"]
    ws2.append(headers2)
    for cell in ws2[1]:
        cell.font = _HEADER_FONT
        cell.fill = _HEADER_FILL
        cell.alignment = _HEADER_ALIGN
    for i, r in enumerate(result["top_khach_hang"], 1):
        ws2.append([i, r["ten_khach_hang"], r["so_don"], r["doanh_thu"]])
    for col in ws2.columns:
        max_len = max((len(str(c.value)) if c.value is not None else 0) for c in col)
        ws2.column_dimensions[col[0].column_letter].width = min(max_len + 2, 40)

    filename = f"doanh_thu_{tu_ngay}_{den_ngay}.xlsx"
    return _stream_workbook(wb, filename)


# ── 8. Export: Báo cáo xuất-nhập-tồn kho ─────────────────────────────────────

@router.get("/inventory-movement/export")
def export_inventory_movement_excel(
    tu_ngay: str = Query(...),
    den_ngay: str = Query(...),
    warehouse_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Xuất báo cáo xuất-nhập-tồn kho ra file Excel."""
    result = get_inventory_movement(
        tu_ngay=tu_ngay, den_ngay=den_ngay,
        warehouse_id=warehouse_id, db=db, _=_,
    )
    rows_data = [
        [
            r["ten_kho"], r["ten_hang"], r["don_vi"],
            r["ton_dau_ky"], r["nhap_trong_ky"],
            r["xuat_trong_ky"], r["ton_cuoi_ky"], r["gia_tri_ton"],
        ]
        for r in result["rows"]
    ]
    wb = _make_workbook(
        "Xuất nhập tồn",
        ["Kho", "Hàng hóa", "ĐVT", "Tồn đầu kỳ", "Nhập trong kỳ",
         "Xuất trong kỳ", "Tồn cuối kỳ", "Giá trị tồn (đ)"],
        rows_data,
    )
    filename = f"xuat_nhap_ton_{tu_ngay}_{den_ngay}.xlsx"
    return _stream_workbook(wb, filename)


# ── 9. Export: Báo cáo công nợ tổng hợp ─────────────────────────────────────

@router.get("/debt-summary/export")
def export_debt_summary_excel(
    as_of_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Xuất báo cáo công nợ tổng hợp (AR + AP) ra file Excel."""
    result = get_debt_summary(as_of_date=as_of_date, db=db, _=_)

    headers = ["Đối tượng", "Số HĐ", "Tổng phát sinh (đ)", "Đã thanh toán (đ)",
               "Còn lại (đ)", "Trong hạn (đ)", "Quá hạn (đ)"]

    def _debt_rows(rows: list[dict]) -> list[list]:
        return [
            [r["ten_doi_tuong"], r["so_hoa_don"], r["tong_phat_sinh"],
             r["da_thanh_toan"], r["con_lai"], r["trong_han"], r["qua_han"]]
            for r in rows
        ]

    wb = _make_workbook("Phải thu (AR)", headers, _debt_rows(result["ar"]["rows"]))

    ws2 = wb.create_sheet("Phải trả (AP)")
    ws2.append(headers)
    for cell in ws2[1]:
        cell.font = _HEADER_FONT
        cell.fill = _HEADER_FILL
        cell.alignment = _HEADER_ALIGN
    for row in _debt_rows(result["ap"]["rows"]):
        ws2.append(row)
    for col in ws2.columns:
        max_len = max((len(str(c.value)) if c.value is not None else 0) for c in col)
        ws2.column_dimensions[col[0].column_letter].width = min(max_len + 2, 40)

    today_str = result["as_of_date"].replace("-", "")
    filename = f"cong_no_{today_str}.xlsx"
    return _stream_workbook(wb, filename)


# ── 10. Export: Báo cáo năng suất sản xuất ───────────────────────────────────

@router.get("/production-performance/export")
def export_production_performance_excel(
    tu_ngay: str = Query(...),
    den_ngay: str = Query(...),
    phan_xuong_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Xuất báo cáo năng suất sản xuất ra file Excel."""
    result = get_production_performance(
        tu_ngay=tu_ngay, den_ngay=den_ngay,
        phan_xuong_id=phan_xuong_id, db=db, _=_,
    )
    rows_data = [
        [
            r["so_lenh"], r["ngay_lenh"] or "", r["trang_thai"],
            r["ten_khach_hang"] or "", r["ten_phan_xuong"] or "",
            r["tong_ke_hoach"], r["tong_hoan_thanh"], r["ty_le_hoan_thanh"],
            r["ngay_ke_hoach_xong"] or "", r["ngay_thuc_te_xong"] or "",
            r["tre_han"] if r["tre_han"] is not None else "",
        ]
        for r in result["rows"]
    ]
    wb = _make_workbook(
        "Năng suất SX",
        ["Số lệnh", "Ngày lệnh", "Trạng thái", "Khách hàng", "Phân xưởng",
         "KH (Thùng)", "Thực tế", "Tỉ lệ (%)", "Ngày KH xong", "Ngày TT xong", "Trễ (ngày)"],
        rows_data,
    )
    filename = f"nang_suat_sx_{tu_ngay}_{den_ngay}.xlsx"
    return _stream_workbook(wb, filename)


# ── 11. Export: Báo cáo tiến độ đơn hàng ─────────────────────────────────────

@router.get("/order-progress/export")
def export_order_progress_excel(
    tu_ngay: str = Query(...),
    den_ngay: str = Query(...),
    trang_thai: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Xuất báo cáo tiến độ đơn hàng ra file Excel."""
    result = get_order_progress(
        tu_ngay=tu_ngay, den_ngay=den_ngay,
        trang_thai=trang_thai, customer_id=customer_id, db=db, _=_,
    )
    rows_data = [
        [
            r["so_don"], r["ngay_don"] or "", r["ngay_giao_du_kien"] or "",
            r["trang_thai"], r["ten_khach_hang"] or "",
            r["so_luong_dat"], r["so_luong_da_giao"], r["so_luong_con_lai"],
            r["ty_le_giao"], r["tong_tien"],
        ]
        for r in result["rows"]
    ]
    wb = _make_workbook(
        "Tiến độ đơn hàng",
        ["Số đơn", "Ngày đặt", "Ngày giao DK", "Trạng thái", "Khách hàng",
         "SL đặt", "SL đã giao", "Còn lại", "Tỉ lệ (%)", "Tổng tiền (đ)"],
        rows_data,
    )
    filename = f"tien_do_don_hang_{tu_ngay}_{den_ngay}.xlsx"
    return _stream_workbook(wb, filename)


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
    _: User = Depends(get_current_user),
):
    """Xuất Excel báo cáo chi phí / lợi nhuận theo LSX."""
    rows, totals = _build_production_cost_rows(
        db, tu_ngay, den_ngay, phap_nhan_id, phan_xuong_id, trang_thai
    )

    headers = [
        "Số lệnh", "Ngày lệnh", "Trạng thái", "Tên hàng", "Khách hàng",
        "Số đơn", "Pháp nhân", "Phân xưởng",
        "SL kế hoạch", "SL hoàn thành", "Diện tích (m²)",
        "Doanh thu", "CP NVL", "CP Nhân công", "CP SXC", "Tổng CP",
        "Đã phân bổ", "Lợi nhuận", "Tỉ lệ LN (%)",
    ]
    rows_data = [
        [
            r["so_lenh"], r["ngay_lenh"] or "", r["trang_thai"],
            r["ten_hang"] or "", r["ten_khach"] or "", r["so_don"] or "",
            r["ten_phap_nhan"] or "", r["ten_xuong"] or "",
            r["so_luong_ke_hoach"], r["so_luong_hoan_thanh"], r["dien_tich"],
            r["doanh_thu"], r["chi_phi_nvl"], r["chi_phi_nhan_cong"],
            r["chi_phi_sxc"], r["tong_chi_phi"],
            "Có" if r["da_phan_bo"] else "Chưa",
            r["loi_nhuan"], r["ty_le_loi_nhuan"] if r["ty_le_loi_nhuan"] is not None else "",
        ]
        for r in rows
    ]

    wb = _make_workbook("Chi phí & Lợi nhuận LSX", headers, rows_data)

    # Dòng tổng cuối
    ws = wb.active
    last_row = ws.max_row + 1
    total_cells = ["", "", "", "", "", "", "", "", "", "", "",
                   totals["tong_doanh_thu"], totals["tong_chi_phi_nvl"],
                   totals["tong_chi_phi_nhan_cong"], totals["tong_chi_phi_sxc"],
                   totals["tong_chi_phi"], "", totals["tong_loi_nhuan"],
                   totals["ty_le_loi_nhuan"] if totals["ty_le_loi_nhuan"] is not None else ""]
    total_cells[0] = "TỔNG CỘNG"
    ws.append(total_cells)
    bold_fill = PatternFill("solid", fgColor="FFF3E0")
    for cell in ws[last_row]:
        cell.font = Font(bold=True)
        cell.fill = bold_fill

    suffix = f"_{tu_ngay}_{den_ngay}" if tu_ngay else ""
    return _stream_workbook(wb, f"chi_phi_loi_nhuan_lsx{suffix}.xlsx")
