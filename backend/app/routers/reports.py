from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.billing import SalesInvoice
from app.models.accounting import PurchaseInvoice
from app.models.sales import SalesOrder, SalesOrderItem
from app.models.master import Customer, Warehouse, Supplier
from app.models.inventory import InventoryTransaction, InventoryBalance
from app.models.master import PaperMaterial, OtherMaterial, Product
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.warehouse_doc import DeliveryOrder, DeliveryOrderItem

router = APIRouter(prefix="/api/reports", tags=["reports"])

# ── Hằng số ──────────────────────────────────────────────────────────────────

_NHAP_LOAI = {"NHAP_MUA", "NHAP_SX", "DIEU_CHINH_TANG"}
_XUAT_LOAI = {"XUAT_SX", "XUAT_BAN", "DIEU_CHINH_GIAM", "XOA_NHAP_SX"}


# ── 1. Báo cáo công nợ tổng hợp ──────────────────────────────────────────────

@router.get("/debt-summary")
def get_debt_summary(
    as_of_date: Optional[str] = Query(None, description="Ngày tính (YYYY-MM-DD), mặc định hôm nay"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    today = date.fromisoformat(as_of_date) if as_of_date else date.today()

    # ── AR (phải thu) ─────────────────────────────────────────────────────────
    ar_rows = (
        db.query(
            SalesInvoice.customer_id,
            SalesInvoice.ten_don_vi,
            func.count(SalesInvoice.id).label("so_hoa_don"),
            func.coalesce(func.sum(SalesInvoice.tong_cong), 0).label("tong_phat_sinh"),
            func.coalesce(func.sum(SalesInvoice.da_thanh_toan), 0).label("da_thu"),
            func.coalesce(func.sum(SalesInvoice.con_lai), 0).label("con_lai"),
            func.coalesce(func.sum(
                case((SalesInvoice.han_tt < today, SalesInvoice.con_lai), else_=0)
            ), 0).label("qua_han"),
        )
        .filter(SalesInvoice.trang_thai.notin_(["huy"]), SalesInvoice.con_lai > 0)
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
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    d_from = date.fromisoformat(tu_ngay)
    d_to = date.fromisoformat(den_ngay)

    # ── Doanh thu theo kỳ ─────────────────────────────────────────────────────
    base_rows = (
        db.query(SalesOrder, Customer.ten_don_vi)
        .join(Customer, Customer.id == SalesOrder.customer_id)
        .filter(
            SalesOrder.ngay_don >= d_from,
            SalesOrder.ngay_don <= d_to,
            SalesOrder.trang_thai.notin_(["huy"]),
        )
        .all()
    )

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
        ton_hien_tai = float(b.ton_luong)
        # Tồn cuối = tồn hiện tại; tồn đầu ≈ cuối - nhập + xuất
        ton_cuoi = ton_hien_tai
        ton_dau = ton_cuoi - nhap + xuat

        rows.append({
            "warehouse_id": b.warehouse_id,
            "ten_kho": wh_map.get(b.warehouse_id, ""),
            "ten_hang": _ten_hang(b),
            "don_vi": _don_vi(b),
            "ton_dau_ky": max(ton_dau, 0.0),
            "nhap_trong_ky": nhap,
            "xuat_trong_ky": xuat,
            "ton_cuoi_ky": ton_cuoi,
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

