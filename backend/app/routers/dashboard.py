from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.sales import SalesOrder, Quote
from app.models.production import ProductionOrder
from app.models.purchase import PurchaseOrder
from app.models.master import Customer, Warehouse, PaperMaterial, OtherMaterial, Product
from app.models.inventory import InventoryBalance
from app.models.warehouse_doc import GoodsReceipt, MaterialIssue, DeliveryOrder
from app.models.accounting import CashReceipt, CashPayment
from app.models.billing import SalesInvoice
from app.models.accounting import PurchaseInvoice

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_stats(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    today = date.today()
    next_7_days = today + timedelta(days=7)

    don_hang_moi_hom_nay = (
        db.query(SalesOrder)
        .filter(SalesOrder.ngay_don == today)
        .count()
    )

    cho_duyet = (
        db.query(SalesOrder)
        .filter(SalesOrder.trang_thai == "moi")
        .count()
    ) + (
        db.query(Quote)
        .filter(Quote.trang_thai == "moi")
        .count()
    )

    dang_san_xuat = (
        db.query(ProductionOrder)
        .filter(ProductionOrder.trang_thai.in_(["dang_sx", "dang_chay"]))
        .count()
    )

    tong_khach_hang = db.query(Customer).count()
    bao_gia_moi = db.query(Quote).filter(Quote.trang_thai == "moi").count()
    don_hang_cho_duyet = db.query(SalesOrder).filter(SalesOrder.trang_thai == "moi").count()
    don_hang_da_duyet = db.query(SalesOrder).filter(SalesOrder.trang_thai.in_(["da_duyet", "dang_sx"])).count()
    don_hang_can_giao = (
        db.query(SalesOrder)
        .filter(
            SalesOrder.ngay_giao_hang.isnot(None),
            SalesOrder.ngay_giao_hang <= next_7_days,
            SalesOrder.trang_thai.notin_(["hoan_thanh", "huy"]),
        )
        .count()
    )

    lenh_sx_moi = db.query(ProductionOrder).filter(ProductionOrder.trang_thai == "moi").count()
    lenh_sx_tre = (
        db.query(ProductionOrder)
        .filter(
            ProductionOrder.ngay_hoan_thanh_ke_hoach.isnot(None),
            ProductionOrder.ngay_hoan_thanh_ke_hoach < today,
            ProductionOrder.trang_thai.notin_(["hoan_thanh", "huy"]),
        )
        .count()
    )
    lenh_sx_hoan_thanh_hom_nay = (
        db.query(ProductionOrder)
        .filter(ProductionOrder.ngay_hoan_thanh_thuc_te == today)
        .count()
    )

    po_cho_duyet = db.query(PurchaseOrder).filter(PurchaseOrder.trang_thai == "moi").count()
    po_dang_ve = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.trang_thai.in_(["da_duyet", "da_gui_ncc", "dang_giao"]))
        .count()
    )
    phieu_nhap_hom_nay = db.query(GoodsReceipt).filter(GoodsReceipt.ngay_nhap == today).count()
    phieu_xuat_nvl_hom_nay = db.query(MaterialIssue).filter(MaterialIssue.ngay_xuat == today).count()
    phieu_giao_hom_nay = db.query(DeliveryOrder).filter(DeliveryOrder.ngay_xuat == today).count()
    giao_hang_cho_xuat = db.query(DeliveryOrder).filter(DeliveryOrder.trang_thai == "nhap").count()

    ton_kho_rows = (
        db.query(InventoryBalance)
        .join(Warehouse, Warehouse.id == InventoryBalance.warehouse_id)
        .filter(InventoryBalance.ton_luong > 0)
        .all()
    )
    tong_gia_tri_ton = sum(float(r.gia_tri_ton or 0) for r in ton_kho_rows)
    ton_thap = []
    for r in ton_kho_rows:
        ten_hang = r.ten_hang or ""
        don_vi = r.don_vi or ""
        ton_toi_thieu = 0.0
        if r.paper_material_id:
            mat = db.get(PaperMaterial, r.paper_material_id)
            if mat:
                ten_hang = mat.ten
                don_vi = mat.dvt
                ton_toi_thieu = float(mat.ton_toi_thieu or 0)
        elif r.other_material_id:
            mat = db.get(OtherMaterial, r.other_material_id)
            if mat:
                ten_hang = mat.ten
                don_vi = mat.dvt
                ton_toi_thieu = float(mat.ton_toi_thieu or 0)
        elif r.product_id:
            prod = db.get(Product, r.product_id)
            if prod:
                ten_hang = prod.ten_hang
                don_vi = getattr(prod, "dvt", "Thung") or "Thung"

        if ton_toi_thieu > 0 and float(r.ton_luong or 0) < ton_toi_thieu:
            wh = db.get(Warehouse, r.warehouse_id)
            ton_thap.append({
                "ten_hang": ten_hang,
                "ten_kho": wh.ten_kho if wh else "",
                "ton_luong": float(r.ton_luong or 0),
                "ton_toi_thieu": ton_toi_thieu,
                "don_vi": don_vi,
            })
    ton_thap = sorted(ton_thap, key=lambda x: x["ton_luong"] / max(x["ton_toi_thieu"], 1))[:6]

    doanh_thu_hom_nay = (
        db.query(func.coalesce(func.sum(SalesOrder.tong_tien), 0))
        .filter(SalesOrder.ngay_don == today)
        .scalar()
    )
    doanh_thu_thang = (
        db.query(func.coalesce(func.sum(SalesOrder.tong_tien), 0))
        .filter(
            func.extract("year", SalesOrder.ngay_don) == today.year,
            func.extract("month", SalesOrder.ngay_don) == today.month,
            SalesOrder.trang_thai != "huy",
        )
        .scalar()
    )

    # Tháng trước
    if today.month == 1:
        prev_year, prev_month = today.year - 1, 12
    else:
        prev_year, prev_month = today.year, today.month - 1
    doanh_thu_thang_truoc = (
        db.query(func.coalesce(func.sum(SalesOrder.tong_tien), 0))
        .filter(
            func.extract("year", SalesOrder.ngay_don) == prev_year,
            func.extract("month", SalesOrder.ngay_don) == prev_month,
            SalesOrder.trang_thai != "huy",
        )
        .scalar()
    )

    # Kế toán
    phieu_thu_cho_duyet = db.query(CashReceipt).filter(CashReceipt.trang_thai == "cho_duyet").count()
    phieu_chi_cho_duyet = db.query(CashPayment).filter(CashPayment.trang_thai.in_(["cho_chot", "da_chot"])).count()

    ar_qua_han = db.query(
        func.count(SalesInvoice.id),
        func.coalesce(func.sum(SalesInvoice.con_lai), 0),
    ).filter(SalesInvoice.trang_thai == "qua_han").first()
    ar_so_kh = int(ar_qua_han[0]) if ar_qua_han else 0
    ar_tien_qua_han = float(ar_qua_han[1]) if ar_qua_han else 0.0

    ap_qua_han = db.query(
        func.count(PurchaseInvoice.id),
        func.coalesce(func.sum(PurchaseInvoice.con_lai), 0),
    ).filter(PurchaseInvoice.trang_thai == "qua_han").first()
    ap_so_hd = int(ap_qua_han[0]) if ap_qua_han else 0
    ap_tien_qua_han = float(ap_qua_han[1]) if ap_qua_han else 0.0

    return {
        "don_hang_moi_hom_nay": don_hang_moi_hom_nay,
        "cho_duyet": cho_duyet,
        "dang_san_xuat": dang_san_xuat,
        "tong_khach_hang": tong_khach_hang,
        "sales": {
            "bao_gia_moi": bao_gia_moi,
            "don_hang_cho_duyet": don_hang_cho_duyet,
            "don_hang_da_duyet": don_hang_da_duyet,
            "don_hang_can_giao": don_hang_can_giao,
            "doanh_thu_hom_nay": float(doanh_thu_hom_nay or 0),
            "doanh_thu_thang": float(doanh_thu_thang or 0),
        },
        "production": {
            "lenh_sx_moi": lenh_sx_moi,
            "dang_san_xuat": dang_san_xuat,
            "lenh_sx_tre": lenh_sx_tre,
            "lenh_sx_hoan_thanh_hom_nay": lenh_sx_hoan_thanh_hom_nay,
        },
        "warehouse": {
            "phieu_nhap_hom_nay": phieu_nhap_hom_nay,
            "phieu_xuat_nvl_hom_nay": phieu_xuat_nvl_hom_nay,
            "phieu_giao_hom_nay": phieu_giao_hom_nay,
            "giao_hang_cho_xuat": giao_hang_cho_xuat,
            "tong_gia_tri_ton": tong_gia_tri_ton,
            "ton_thap": ton_thap,
        },
        "purchase": {
            "po_cho_duyet": po_cho_duyet,
            "po_dang_ve": po_dang_ve,
        },
        "accounting": {
            "phieu_thu_cho_duyet": phieu_thu_cho_duyet,
            "phieu_chi_cho_duyet": phieu_chi_cho_duyet,
            "ar_tien_qua_han": ar_tien_qua_han,
            "ar_so_hoa_don_qua_han": ar_so_kh,
            "ap_tien_qua_han": ap_tien_qua_han,
            "ap_so_hoa_don_qua_han": ap_so_hd,
            "doanh_thu_thang_truoc": float(doanh_thu_thang_truoc or 0),
        },
    }
