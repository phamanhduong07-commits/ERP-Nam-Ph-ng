"""
Thực thi các tool của ERP Agent bằng cách query SQLAlchemy trực tiếp.
Chạy cùng process với ERP backend — không cần HTTP round-trip.
"""

import json
from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, or_


def execute_tool(tool_name: str, tool_input: dict, db: Session, executed_by: int | None = None) -> str:
    """Dispatch tool call → trả về string kết quả để đưa vào Claude context."""
    handlers = {
        "query_orders": _query_orders,
        "query_quotes": _query_quotes,
        "query_production_status": _query_production_status,
        "query_inventory": _query_inventory,
        "query_customers": _query_customers,
        "query_purchase_orders": _query_purchase_orders,
        "get_dashboard_summary": _get_dashboard_summary,
        "generate_report": _generate_report,
        "update_order_status": lambda inp, db: _update_order_status(inp, db, executed_by),
        "create_quote_draft":  lambda inp, db: _create_quote_draft(inp, db, executed_by),
    }
    handler = handlers.get(tool_name)
    if not handler:
        return f"Lỗi: không tìm thấy tool '{tool_name}'"
    try:
        return handler(tool_input, db)
    except Exception as e:
        return f"Lỗi thực thi tool {tool_name}: {str(e)}"


# ─── Tool handlers ─────────────────────────────────────────────────────────────

def _customer_name(customer) -> str:
    return customer.ten_viet_tat or customer.ten_don_vi or customer.ma_kh or ""


def _supplier_name(supplier) -> str:
    return supplier.ten_viet_tat or supplier.ten_don_vi or supplier.ma_ncc or ""


def _customer_name_filter(Customer, keyword: str):
    pattern = f"%{keyword}%"
    return or_(Customer.ten_viet_tat.ilike(pattern), Customer.ten_don_vi.ilike(pattern), Customer.ma_kh.ilike(pattern))


def _supplier_name_filter(Supplier, keyword: str):
    pattern = f"%{keyword}%"
    return or_(Supplier.ten_viet_tat.ilike(pattern), Supplier.ten_don_vi.ilike(pattern), Supplier.ma_ncc.ilike(pattern))


def _query_orders(inp: dict, db: Session) -> str:
    from app.models.sales import SalesOrder
    from app.models.master import Customer

    q = db.query(SalesOrder).join(Customer, SalesOrder.customer_id == Customer.id)

    if inp.get("customer_name"):
        q = q.filter(_customer_name_filter(Customer, inp["customer_name"]))
    if inp.get("so_don"):
        q = q.filter(SalesOrder.so_don.ilike(f"%{inp['so_don']}%"))
    if inp.get("trang_thai"):
        q = q.filter(SalesOrder.trang_thai == inp["trang_thai"])
    if inp.get("date_from"):
        q = q.filter(SalesOrder.ngay_don >= inp["date_from"])
    if inp.get("date_to"):
        q = q.filter(SalesOrder.ngay_don <= inp["date_to"])

    limit = min(int(inp.get("limit", 10)), 50)
    orders = q.order_by(SalesOrder.ngay_don.desc()).limit(limit).all()

    if not orders:
        return "Không tìm thấy đơn hàng nào phù hợp."

    STATUS_LABEL = {
        "moi": "Mới", "da_duyet": "Đã duyệt",
        "dang_sx": "Đang SX", "hoan_thanh": "Hoàn thành", "huy": "Hủy",
    }
    rows = []
    for o in orders:
        tong = f"{float(o.tong_tien):,.0f}đ" if o.tong_tien else "—"
        giao = str(o.ngay_giao_hang) if o.ngay_giao_hang else "—"
        rows.append(
            f"- {o.so_don} | KH: {_customer_name(o.customer)} | "
            f"Ngày: {o.ngay_don} | Trạng thái: {STATUS_LABEL.get(o.trang_thai, o.trang_thai)} | "
            f"Giao: {giao} | Tổng: {tong}"
        )
    return f"Tìm thấy {len(orders)} đơn hàng:\n" + "\n".join(rows)


def _query_quotes(inp: dict, db: Session) -> str:
    from app.models.sales import Quote
    from app.models.master import Customer

    q = db.query(Quote).join(Customer, Quote.customer_id == Customer.id)

    if inp.get("customer_name"):
        q = q.filter(_customer_name_filter(Customer, inp["customer_name"]))
    if inp.get("so_bao_gia"):
        q = q.filter(Quote.so_bao_gia.ilike(f"%{inp['so_bao_gia']}%"))
    if inp.get("trang_thai"):
        q = q.filter(Quote.trang_thai == inp["trang_thai"])
    if inp.get("date_from"):
        q = q.filter(Quote.ngay_bao_gia >= inp["date_from"])
    if inp.get("date_to"):
        q = q.filter(Quote.ngay_bao_gia <= inp["date_to"])

    limit = min(int(inp.get("limit", 10)), 50)
    quotes = q.order_by(Quote.ngay_bao_gia.desc()).limit(limit).all()

    if not quotes:
        return "Không tìm thấy báo giá nào phù hợp."

    STATUS_LABEL = {
        "moi": "Mới", "da_duyet": "Đã duyệt",
        "tu_choi": "Từ chối", "het_han": "Hết hạn",
    }
    rows = []
    for bq in quotes:
        tong = f"{float(bq.tong_cong):,.0f}đ" if bq.tong_cong else "—"
        het_han = str(bq.ngay_het_han) if bq.ngay_het_han else "—"
        rows.append(
            f"- {bq.so_bao_gia} | KH: {_customer_name(bq.customer)} | "
            f"Ngày: {bq.ngay_bao_gia} | Trạng thái: {STATUS_LABEL.get(bq.trang_thai, bq.trang_thai)} | "
            f"Hết hạn: {het_han} | Tổng: {tong}"
        )
    return f"Tìm thấy {len(quotes)} báo giá:\n" + "\n".join(rows)


def _query_production_status(inp: dict, db: Session) -> str:
    from app.models.production import ProductionOrder
    from app.models.sales import SalesOrder

    q = db.query(ProductionOrder)

    if inp.get("so_lenh"):
        q = q.filter(ProductionOrder.so_lenh.ilike(f"%{inp['so_lenh']}%"))
    if inp.get("sales_order_id"):
        q = q.filter(ProductionOrder.sales_order_id == inp["sales_order_id"])
    if inp.get("trang_thai"):
        q = q.filter(ProductionOrder.trang_thai == inp["trang_thai"])
    if inp.get("tre_han"):
        today = date.today()
        q = q.filter(
            ProductionOrder.ngay_hoan_thanh_ke_hoach.isnot(None),
            ProductionOrder.ngay_hoan_thanh_ke_hoach < today,
            ProductionOrder.trang_thai.notin_(["hoan_thanh", "huy"]),
        )

    limit = min(int(inp.get("limit", 10)), 50)
    lsx_list = q.order_by(ProductionOrder.ngay_lenh.desc()).limit(limit).all()

    if not lsx_list:
        return "Không tìm thấy lệnh sản xuất nào phù hợp."

    STATUS_LABEL = {
        "moi": "Mới", "dang_chay": "Đang chạy",
        "hoan_thanh": "Hoàn thành", "huy": "Hủy",
    }
    today = date.today()
    rows = []
    for lsx in lsx_list:
        ke_hoach = str(lsx.ngay_hoan_thanh_ke_hoach) if lsx.ngay_hoan_thanh_ke_hoach else "—"
        thuc_te = str(lsx.ngay_hoan_thanh_thuc_te) if lsx.ngay_hoan_thanh_thuc_te else "—"
        tre = ""
        if (lsx.ngay_hoan_thanh_ke_hoach and
                lsx.ngay_hoan_thanh_ke_hoach < today and
                lsx.trang_thai not in ("hoan_thanh", "huy")):
            so_ngay = (today - lsx.ngay_hoan_thanh_ke_hoach).days
            tre = f" ⚠️ TRỄ {so_ngay} ngày"
        rows.append(
            f"- {lsx.so_lenh} | Trạng thái: {STATUS_LABEL.get(lsx.trang_thai, lsx.trang_thai)}{tre} | "
            f"KH hoàn thành: {ke_hoach} | Thực tế: {thuc_te}"
        )
    return f"Tìm thấy {len(lsx_list)} lệnh sản xuất:\n" + "\n".join(rows)


def _query_inventory(inp: dict, db: Session) -> str:
    from app.models.inventory import InventoryBalance
    from app.models.master import Warehouse, PaperMaterial, OtherMaterial, Product

    q = db.query(InventoryBalance).join(Warehouse, InventoryBalance.warehouse_id == Warehouse.id)

    loai_kho = inp.get("loai_kho", "tat_ca")
    if loai_kho == "nguyen_lieu":
        q = q.filter(Warehouse.loai_kho.in_(["nguyen_lieu", "NVL"]))
    elif loai_kho == "thanh_pham":
        q = q.filter(Warehouse.loai_kho.in_(["thanh_pham", "TP"]))
    elif loai_kho == "phoi_song":
        q = q.filter(Warehouse.loai_kho.in_(["phoi_song", "PS"]))

    if inp.get("chi_hang_sap_het"):
        q = q.filter(InventoryBalance.ton_luong > 0)

    limit = min(int(inp.get("limit", 20)), 100)
    rows_db = q.limit(limit * 3).all()

    if not rows_db:
        return "Không tìm thấy dữ liệu tồn kho phù hợp."

    results = []
    ten_filter = inp.get("ten_hang", "").lower()

    for r in rows_db:
        ten_hang = r.ten_hang or ""
        don_vi = r.don_vi or ""
        ton_toi_thieu = 0.0

        if r.paper_material_id:
            mat = db.get(PaperMaterial, r.paper_material_id)
            if mat:
                ten_hang = mat.ten
                don_vi = mat.dvt or don_vi
                ton_toi_thieu = float(mat.ton_toi_thieu or 0)
        elif r.other_material_id:
            mat = db.get(OtherMaterial, r.other_material_id)
            if mat:
                ten_hang = mat.ten
                don_vi = mat.dvt or don_vi
                ton_toi_thieu = float(mat.ton_toi_thieu or 0)
        elif r.product_id:
            prod = db.get(Product, r.product_id)
            if prod:
                ten_hang = prod.ten_hang
                don_vi = getattr(prod, "dvt", "Thùng") or "Thùng"

        if ten_filter and ten_filter not in ten_hang.lower():
            continue

        ton = float(r.ton_luong or 0)
        if inp.get("chi_hang_sap_het") and (ton_toi_thieu <= 0 or ton >= ton_toi_thieu):
            continue

        wh = db.get(Warehouse, r.warehouse_id)
        ten_kho = wh.ten_kho if wh else "—"
        gia_tri = f"{float(r.gia_tri_ton or 0):,.0f}đ" if r.gia_tri_ton else "—"
        canh_bao = " ⚠️ SẮP HẾT" if ton_toi_thieu > 0 and ton < ton_toi_thieu else ""
        results.append(
            f"- {ten_hang} | Kho: {ten_kho} | "
            f"Tồn: {ton:,.2f} {don_vi}{canh_bao} | Giá trị: {gia_tri}"
        )

        if len(results) >= limit:
            break

    if not results:
        return "Không tìm thấy dữ liệu tồn kho phù hợp."

    return f"Tồn kho ({len(results)} dòng):\n" + "\n".join(results)


def _query_customers(inp: dict, db: Session) -> str:
    from app.models.master import Customer

    q = db.query(Customer).filter(Customer.trang_thai == True)

    if inp.get("ten"):
        q = q.filter(_customer_name_filter(Customer, inp["ten"]))
    if inp.get("so_dien_thoai"):
        phone_pattern = f"%{inp['so_dien_thoai']}%"
        q = q.filter(or_(Customer.dien_thoai.ilike(phone_pattern), Customer.so_dien_thoai_lh.ilike(phone_pattern)))

    limit = min(int(inp.get("limit", 10)), 50)
    customers = q.order_by(Customer.ten_viet_tat).limit(limit).all()

    if not customers:
        return "Không tìm thấy khách hàng nào phù hợp."

    rows = []
    for c in customers:
        sdt = c.so_dien_thoai or "—"
        email = c.email or "—"
        rows.append(f"- {c.ten_khach_hang} | SĐT: {sdt} | Email: {email}")
    return f"Tìm thấy {len(customers)} khách hàng:\n" + "\n".join(rows)


def _query_purchase_orders(inp: dict, db: Session) -> str:
    from app.models.purchase import PurchaseOrder
    from app.models.master import Supplier

    q = db.query(PurchaseOrder).join(Supplier, PurchaseOrder.supplier_id == Supplier.id)

    if inp.get("supplier_name"):
        q = q.filter(Supplier.ten_nha_cung_cap.ilike(f"%{inp['supplier_name']}%"))
    if inp.get("so_don_mua"):
        q = q.filter(PurchaseOrder.so_don_mua.ilike(f"%{inp['so_don_mua']}%"))
    if inp.get("trang_thai"):
        q = q.filter(PurchaseOrder.trang_thai == inp["trang_thai"])
    if inp.get("date_from"):
        q = q.filter(PurchaseOrder.ngay_dat >= inp["date_from"])

    limit = min(int(inp.get("limit", 10)), 50)
    pos = q.order_by(PurchaseOrder.ngay_dat.desc()).limit(limit).all()

    if not pos:
        return "Không tìm thấy đơn mua hàng nào phù hợp."

    STATUS_LABEL = {
        "moi": "Mới", "cho_duyet": "Chờ duyệt", "da_duyet": "Đã duyệt",
        "hoan_thanh": "Hoàn thành", "huy": "Hủy",
    }
    rows = []
    for po in pos:
        tong = f"{float(po.tong_tien):,.0f}đ" if po.tong_tien else "—"
        rows.append(
            f"- {po.so_don_mua} | NCC: {po.supplier.ten_nha_cung_cap} | "
            f"Ngày: {po.ngay_dat} | Trạng thái: {STATUS_LABEL.get(po.trang_thai, po.trang_thai)} | "
            f"Tổng: {tong}"
        )
    return f"Tìm thấy {len(pos)} đơn mua hàng:\n" + "\n".join(rows)


def _generate_report(inp: dict, db: Session) -> str:
    from app.models.sales import SalesOrder
    from app.models.production import ProductionOrder
    from app.models.inventory import InventoryBalance
    from app.models.master import Warehouse, PaperMaterial, OtherMaterial

    loai = inp.get("loai_bao_cao", "doanh_thu")
    ky   = inp.get("ky", "thang_nay")

    today = date.today()
    if ky == "thang_nay":
        d_from = today.replace(day=1)
        d_to   = today
        label  = f"Tháng {today.month}/{today.year}"
    elif ky == "thang_truoc":
        first_this = today.replace(day=1)
        last_prev  = first_this - __import__("datetime").timedelta(days=1)
        d_from = last_prev.replace(day=1)
        d_to   = last_prev
        label  = f"Tháng {d_from.month}/{d_from.year}"
    elif ky == "quy_nay":
        q = (today.month - 1) // 3
        d_from = today.replace(month=q * 3 + 1, day=1)
        d_to   = today
        label  = f"Quý {q + 1}/{today.year}"
    elif ky == "nam_nay":
        d_from = today.replace(month=1, day=1)
        d_to   = today
        label  = f"Năm {today.year}"
    else:  # tuy_chinh
        d_from = date.fromisoformat(inp["date_from"]) if inp.get("date_from") else today.replace(day=1)
        d_to   = date.fromisoformat(inp["date_to"])   if inp.get("date_to")   else today
        label  = f"{d_from} → {d_to}"

    if loai == "doanh_thu":
        rows = db.query(
            func.extract("month", SalesOrder.ngay_don).label("thang"),
            func.extract("year",  SalesOrder.ngay_don).label("nam"),
            func.count(SalesOrder.id).label("so_don"),
            func.coalesce(func.sum(SalesOrder.tong_tien), 0).label("tong"),
        ).filter(
            SalesOrder.ngay_don >= d_from,
            SalesOrder.ngay_don <= d_to,
            SalesOrder.trang_thai != "huy",
        ).group_by("thang", "nam").order_by("nam", "thang").all()

        if not rows:
            return f"Báo cáo doanh thu {label}: Không có dữ liệu."

        total_don  = sum(r.so_don for r in rows)
        total_tien = sum(float(r.tong) for r in rows)
        lines = [f"=== BÁO CÁO DOANH THU — {label} ==="]
        for r in rows:
            lines.append(f"  T{int(r.thang)}/{int(r.nam)}: {r.so_don} đơn — {float(r.tong):,.0f}đ")
        lines.append(f"Tổng: {total_don} đơn hàng — {total_tien:,.0f}đ")
        return "\n".join(lines)

    elif loai == "san_xuat":
        status_counts = {}
        for s in ["moi", "dang_chay", "hoan_thanh", "huy"]:
            cnt = db.query(ProductionOrder).filter(
                ProductionOrder.ngay_lenh >= d_from,
                ProductionOrder.ngay_lenh <= d_to,
                ProductionOrder.trang_thai == s,
            ).count()
            status_counts[s] = cnt

        tre = db.query(ProductionOrder).filter(
            ProductionOrder.ngay_lenh >= d_from,
            ProductionOrder.ngay_lenh <= d_to,
            ProductionOrder.ngay_hoan_thanh_ke_hoach < date.today(),
            ProductionOrder.trang_thai.notin_(["hoan_thanh", "huy"]),
        ).count()

        tong = sum(status_counts.values())
        return (
            f"=== BÁO CÁO SẢN XUẤT — {label} ===\n"
            f"Tổng lệnh SX: {tong}\n"
            f"  Mới: {status_counts['moi']}\n"
            f"  Đang chạy: {status_counts['dang_chay']}\n"
            f"  Hoàn thành: {status_counts['hoan_thanh']}\n"
            f"  Hủy: {status_counts['huy']}\n"
            f"  Trễ kế hoạch (hiện tại): {tre}"
        )

    else:  # ton_kho
        rows_db = db.query(InventoryBalance).join(
            Warehouse, InventoryBalance.warehouse_id == Warehouse.id
        ).filter(InventoryBalance.ton_luong > 0).all()

        tong_gia_tri = sum(float(r.gia_tri_ton or 0) for r in rows_db)
        tong_mat_hang = len(rows_db)
        sap_het = 0
        for r in rows_db:
            ttmin = 0.0
            if r.paper_material_id:
                mat = db.get(PaperMaterial, r.paper_material_id)
                if mat: ttmin = float(mat.ton_toi_thieu or 0)
            elif r.other_material_id:
                mat = db.get(OtherMaterial, r.other_material_id)
                if mat: ttmin = float(mat.ton_toi_thieu or 0)
            if ttmin > 0 and float(r.ton_luong or 0) < ttmin:
                sap_het += 1

        return (
            f"=== BÁO CÁO TỒN KHO ===\n"
            f"Tổng mặt hàng có tồn: {tong_mat_hang}\n"
            f"Tổng giá trị tồn: {tong_gia_tri:,.0f}đ\n"
            f"Hàng sắp hết (dưới mức tối thiểu): {sap_het} mặt hàng\n"
            f"(Dùng query_inventory để xem chi tiết từng mặt hàng)"
        )


def _update_order_status(inp: dict, db: Session, executed_by: int | None) -> str:
    from app.models.sales import SalesOrder

    order = db.get(SalesOrder, inp["order_id"])
    if not order:
        return f"Không tìm thấy đơn hàng ID {inp['order_id']}."

    old_status = order.trang_thai
    new_status = inp["trang_thai_moi"]
    order.trang_thai = new_status
    if inp.get("ghi_chu"):
        order.ghi_chu = (order.ghi_chu or "") + f"\n[Agent] {inp['ghi_chu']}"
    if new_status == "da_duyet" and executed_by:
        order.approved_by = executed_by
        order.approved_at = datetime.utcnow()

    db.commit()
    db.refresh(order)

    STATUS_LABEL = {
        "moi": "Mới", "da_duyet": "Đã duyệt",
        "dang_sx": "Đang SX", "hoan_thanh": "Hoàn thành", "huy": "Hủy",
    }
    return (
        f"✅ Đã cập nhật đơn hàng {order.so_don}: "
        f"{STATUS_LABEL.get(old_status, old_status)} → {STATUS_LABEL.get(new_status, new_status)}"
    )


def _create_quote_draft(inp: dict, db: Session, executed_by: int | None) -> str:
    from app.models.sales import Quote
    from app.models.master import Customer

    customer = db.get(Customer, inp["customer_id"])
    if not customer:
        return f"Không tìm thấy khách hàng ID {inp['customer_id']}."

    today = date.today()
    prefix = f"BG{today.strftime('%Y%m%d')}"
    last = (
        db.query(Quote)
        .filter(Quote.so_bao_gia.like(f"{prefix}%"))
        .order_by(Quote.so_bao_gia.desc())
        .first()
    )
    seq = int(last.so_bao_gia[-3:]) + 1 if last else 1
    so_bao_gia = f"{prefix}{seq:03d}"

    het_han = None
    if inp.get("ngay_het_han"):
        try:
            het_han = date.fromisoformat(inp["ngay_het_han"])
        except ValueError:
            pass
    if het_han is None:
        het_han = today.replace(day=today.day) if False else date(today.year, today.month, min(today.day + 30, 28))

    quote = Quote(
        so_bao_gia=so_bao_gia,
        ngay_bao_gia=today,
        customer_id=inp["customer_id"],
        trang_thai="moi",
        ghi_chu=inp.get("ghi_chu"),
        ngay_het_han=het_han,
        created_by=executed_by,
    )
    db.add(quote)
    db.commit()
    db.refresh(quote)

    return (
        f"✅ Đã tạo bản nháp báo giá {quote.so_bao_gia} "
        f"cho khách hàng {customer.ten_khach_hang}. "
        f"Hết hạn: {het_han}. "
        f"Vào ERP để thêm sản phẩm và hoàn thiện báo giá."
    )


def _get_dashboard_summary(inp: dict, db: Session) -> str:
    from app.models.sales import SalesOrder, Quote
    from app.models.production import ProductionOrder
    from app.models.purchase import PurchaseOrder
    from app.models.inventory import InventoryBalance
    from app.models.master import Warehouse, PaperMaterial, OtherMaterial

    today = date.today()

    don_moi = db.query(SalesOrder).filter(SalesOrder.ngay_don == today).count()
    cho_duyet = db.query(SalesOrder).filter(SalesOrder.trang_thai == "moi").count()
    dang_sx = db.query(ProductionOrder).filter(
        ProductionOrder.trang_thai.in_(["moi", "dang_chay"])
    ).count()
    lenh_tre = db.query(ProductionOrder).filter(
        ProductionOrder.ngay_hoan_thanh_ke_hoach < today,
        ProductionOrder.trang_thai.notin_(["hoan_thanh", "huy"]),
    ).count()

    doanh_thu_thang = db.query(
        func.coalesce(func.sum(SalesOrder.tong_tien), 0)
    ).filter(
        func.extract("year", SalesOrder.ngay_don) == today.year,
        func.extract("month", SalesOrder.ngay_don) == today.month,
        SalesOrder.trang_thai != "huy",
    ).scalar()

    po_cho_duyet = db.query(PurchaseOrder).filter(PurchaseOrder.trang_thai == "moi").count()

    ton_thap_count = 0
    for r in db.query(InventoryBalance).filter(InventoryBalance.ton_luong > 0).all():
        ttmin = 0.0
        if r.paper_material_id:
            mat = db.get(PaperMaterial, r.paper_material_id)
            if mat: ttmin = float(mat.ton_toi_thieu or 0)
        elif r.other_material_id:
            mat = db.get(OtherMaterial, r.other_material_id)
            if mat: ttmin = float(mat.ton_toi_thieu or 0)
        if ttmin > 0 and float(r.ton_luong or 0) < ttmin:
            ton_thap_count += 1

    return (
        f"=== TỔNG QUAN HÔM NAY ({today}) ===\n"
        f"Đơn hàng mới hôm nay: {don_moi}\n"
        f"Đơn hàng chờ duyệt: {cho_duyet}\n"
        f"Lệnh SX đang chạy: {dang_sx}\n"
        f"Lệnh SX trễ kế hoạch: {lenh_tre}\n"
        f"Đơn mua hàng chờ duyệt: {po_cho_duyet}\n"
        f"Hàng tồn kho sắp hết: {ton_thap_count} mặt hàng\n"
        f"Doanh thu tháng {today.month}/{today.year}: {float(doanh_thu_thang or 0):,.0f}đ"
    )
