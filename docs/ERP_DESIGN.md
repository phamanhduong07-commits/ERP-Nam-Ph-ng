# ERP NAM PHƯƠNG — THIẾT KẾ CẤU TRÚC ĐẦY ĐỦ

> Cập nhật: 2026-04-23  
> Nguồn: Tài liệu Odoo (88 bài viết) + khảo sát mã nguồn hiện tại

---

## 1. TỔNG QUAN MODULE

| # | Module | Odoo docs | Hiện trạng | Ưu tiên |
|---|--------|-----------|------------|---------|
| 1 | Danh mục hệ thống | ✅ | ✅ Hoàn thiện | — |
| 2 | Báo giá | ✅ | ⚠️ Thiếu workflow duyệt & in | P1 |
| 3 | Đơn hàng | ✅ | ⚠️ Có cơ bản, thiếu từ-báo-giá | P1 |
| 4 | Lệnh sản xuất | ✅ | ⚠️ Có cơ bản, thiếu trạng thái | P1 |
| 5 | Hoạch toán BOM | ✅ | ✅ Hoàn thiện | — |
| 6 | Kế hoạch sản xuất | ✅ | ❌ Chưa có | P1 |
| 7 | Kho thành phẩm | ✅ | ❌ Model có, không có UI/workflow | P2 |
| 8 | Kho phôi sóng | ✅ | ❌ Chưa có | P2 |
| 9 | Hóa đơn bán hàng | ✅ | ❌ Chưa có | P2 |
| 10 | Phiếu bán hàng | ✅ | ❌ Chưa có | P2 |
| 11 | Thu mua — Đơn hàng giấy cuộn | ✅ | ❌ Chưa có | P1 |
| 12 | Thu mua — Đơn hàng khác | ✅ | ❌ Chưa có | P2 |
| 13 | Phiếu nhập nguyên liệu | ✅ | ❌ Chưa có | P1 |
| 14 | Kho nguyên liệu (sổ tổng hợp) | ✅ | ❌ Chưa có | P1 |
| 15 | Kế toán — Phiếu thu | ✅ | ❌ Chưa có | P3 |
| 16 | Kế toán — Phiếu chi | ✅ | ❌ Chưa có | P3 |
| 17 | Kế toán — Hóa đơn mua hàng | ✅ | ❌ Chưa có | P3 |
| 18 | Kế toán — Sổ công nợ | ✅ | ❌ Chưa có | P3 |
| 19 | Bảo trì máy móc | ✅ | ❌ Chưa có | P3 |
| 20 | Dashboard realtime | ✅ (backlog) | ❌ Chưa có | P2 |
| 21 | Báo cáo tổng hợp | ✅ | ❌ Chưa có | P2 |

---

## 2. LUỒNG NGHIỆP VỤ CHÍNH

```
[BÁO GIÁ] ──duyệt──► [ĐƠN HÀNG] ──duyệt──► [LỆNH SẢN XUẤT]
                                                      │
                                                      ▼
                                           [KẾ HOẠCH SẢN XUẤT]
                                                      │
                              ┌───────────────────────┤
                              ▼                       ▼
                     [XUẤT PHÔI SÓNG]        [NHẬP KHO TP]
                              │
                              ▼
                     [PHIẾU BÁN HÀNG] ──► [HÓA ĐƠN BÁN HÀNG]
                                                      │
                                                      ▼
                                               [PHIẾU THU]

[THU MUA: ĐH GIẤY CUỘN] ──duyệt──► [PHIẾU NHẬP NL] ──► [KHO NGUYÊN LIỆU]
                                                                │
[THU MUA: ĐH KHÁC]  ─────────────────────────────────────────►│
                                                                ▼
                                                       [PHIẾU CHI / HD MUA HÀNG]
```

---

## 3. THIẾT KẾ DATABASE

### 3.1 Module Thu Mua (Procurement)

```python
# backend/app/models/procurement.py

class PurchaseOrder(Base):
    """Đơn hàng mua nguyên liệu (giấy cuộn hoặc khác)"""
    __tablename__ = "purchase_orders"
    id = Column(Integer, primary_key=True)
    so_don_mua = Column(String(50), unique=True, nullable=False)   # PO-2024-001
    loai_don = Column(String(20), nullable=False)                   # 'giay_cuon' | 'khac'
    ngay_dat = Column(Date, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    nv_thu_mua_id = Column(Integer, ForeignKey("users.id"))
    nguoi_duyet_id = Column(Integer, ForeignKey("users.id"))
    ngay_duyet = Column(DateTime)
    ten_nhom_hang = Column(String(200))                            # Tên nhóm hàng đặt
    tong_tien = Column(Numeric(18, 2))
    trang_thai = Column(String(20), default="cho_duyet")           # cho_duyet | da_duyet | hoan_thanh | huy
    noi_dung = Column(Text)
    ghi_chu = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    items = relationship("PurchaseOrderItem", back_populates="order", cascade="all, delete-orphan")


class PurchaseOrderItem(Base):
    """Dòng chi tiết đơn mua hàng"""
    __tablename__ = "purchase_order_items"
    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    paper_material_id = Column(Integer, ForeignKey("paper_materials.id"))     # giấy cuộn
    other_material_id = Column(Integer, ForeignKey("other_materials.id"))     # hàng khác
    so_cuon = Column(Integer)                                                  # số cuộn (giấy cuộn)
    so_luong = Column(Numeric(18, 3), nullable=False)
    dvt = Column(String(20))
    don_gia = Column(Numeric(18, 2))
    don_gia_ban = Column(Numeric(18, 2))                                       # giá bán lại
    thanh_tien = Column(Numeric(18, 2))
    so_luong_da_nhap = Column(Numeric(18, 3), default=0)                      # đã nhập kho
    ghi_chu = Column(Text)

    order = relationship("PurchaseOrder", back_populates="items")


class MaterialReceipt(Base):
    """Phiếu nhập nguyên liệu"""
    __tablename__ = "material_receipts"
    id = Column(Integer, primary_key=True)
    so_phieu = Column(String(50), unique=True, nullable=False)      # PIN-2024-001
    ngay_nhap = Column(Date, nullable=False)
    phan_xuong = Column(String(100))
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id"))      # đơn hàng liên kết
    so_phieu_can = Column(String(100))                                          # số phiếu cân xe
    bien_so_xe = Column(String(50))                                             # biển số xe
    trong_luong_xe = Column(Numeric(10, 3))                                     # tổng tải
    trong_luong_hang = Column(Numeric(10, 3))                                   # trọng lượng hàng
    hinh_anh_chung_tu = Column(Text)                                            # JSON list URL ảnh
    tong_tien = Column(Numeric(18, 2))
    ghi_chu = Column(Text)
    trang_thai = Column(String(20), default="nhap")                             # nhap | xac_nhan
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    items = relationship("MaterialReceiptItem", back_populates="receipt", cascade="all, delete-orphan")


class MaterialReceiptItem(Base):
    """Chi tiết phiếu nhập nguyên liệu"""
    __tablename__ = "material_receipt_items"
    id = Column(Integer, primary_key=True)
    receipt_id = Column(Integer, ForeignKey("material_receipts.id"), nullable=False)
    purchase_order_item_id = Column(Integer, ForeignKey("purchase_order_items.id"))
    paper_material_id = Column(Integer, ForeignKey("paper_materials.id"))
    other_material_id = Column(Integer, ForeignKey("other_materials.id"))
    paper_roll_id = Column(Integer, ForeignKey("paper_rolls.id"))               # cuộn giấy cụ thể
    so_luong = Column(Numeric(18, 3), nullable=False)                           # kg
    don_gia = Column(Numeric(18, 2))
    thanh_tien = Column(Numeric(18, 2))
    ghi_chu = Column(Text)

    receipt = relationship("MaterialReceipt", back_populates="items")
```

### 3.2 Module Kế Hoạch Sản Xuất

```python
# backend/app/models/production_plan.py

class ProductionPlan(Base):
    """Kế hoạch sản xuất (lịch chạy máy)"""
    __tablename__ = "production_plans"
    id = Column(Integer, primary_key=True)
    so_ke_hoach = Column(String(50), unique=True, nullable=False)   # KH-2024-001
    ngay_ke_hoach = Column(Date, nullable=False)
    ngay_tu = Column(Date)
    ngay_den = Column(Date)
    ghi_chu = Column(Text)
    trang_thai = Column(String(20), default="nhap")                 # nhap | xuat | hoan_thanh
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    lines = relationship("ProductionPlanLine", back_populates="plan", cascade="all, delete-orphan")


class ProductionPlanLine(Base):
    """Dòng kế hoạch — mỗi dòng là 1 lệnh SX được lên kế hoạch"""
    __tablename__ = "production_plan_lines"
    id = Column(Integer, primary_key=True)
    plan_id = Column(Integer, ForeignKey("production_plans.id"), nullable=False)
    production_order_item_id = Column(Integer, ForeignKey("production_order_items.id"), nullable=False)
    thu_tu = Column(Integer)                                        # thứ tự chạy
    ngay_chay = Column(Date)
    # Thông số máy sóng
    kho_giay = Column(Numeric(8, 2))                               # Ch Khổ (cm) — khổ giấy chọn
    so_dao = Column(Integer)                                        # tính tự động theo kho_giay
    kho_tt = Column(Numeric(8, 2))                                 # khổ thực tế
    # Số lượng
    so_luong_ke_hoach = Column(Numeric(12, 0))
    so_luong_hoan_thanh = Column(Numeric(12, 0), default=0)
    trang_thai = Column(String(20), default="cho")                 # cho | dang_chay | hoan_thanh
    ghi_chu = Column(Text)

    plan = relationship("ProductionPlan", back_populates="lines")
    production_order_item = relationship("ProductionOrderItem")
```

### 3.3 Module Kho (Warehouse Transactions)

```python
# Mở rộng inventory.py — thêm các loại phiếu xuất

class InventoryVoucher(Base):
    """Phiếu xuất/nhập kho (thành phẩm, phôi, nguyên liệu)"""
    __tablename__ = "inventory_vouchers"
    id = Column(Integer, primary_key=True)
    so_phieu = Column(String(50), unique=True, nullable=False)
    loai_phieu = Column(String(30), nullable=False)
    # loai_phieu:
    #   nhap_thanh_pham      — nhập kho TP sau SX
    #   xuat_ban_hang        — xuất theo phiếu bán hàng
    #   nhap_phoi_song       — nhập kho phôi sóng
    #   xuat_phoi_san_xuat   — xuất phôi vào sản xuất
    #   xuat_phoi_ban        — xuất phôi bán (tấm)
    #   dieu_chinh           — điều chỉnh tồn kho
    ngay_phieu = Column(Date, nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    production_order_item_id = Column(Integer, ForeignKey("production_order_items.id"))  # nếu từ SX
    sales_voucher_id = Column(Integer, ForeignKey("sales_vouchers.id"))                   # nếu từ bán hàng
    ghi_chu = Column(Text)
    trang_thai = Column(String(20), default="nhap")
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())

    items = relationship("InventoryVoucherItem", back_populates="voucher", cascade="all, delete-orphan")


class InventoryVoucherItem(Base):
    __tablename__ = "inventory_voucher_items"
    id = Column(Integer, primary_key=True)
    voucher_id = Column(Integer, ForeignKey("inventory_vouchers.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"))
    paper_material_id = Column(Integer, ForeignKey("paper_materials.id"))
    other_material_id = Column(Integer, ForeignKey("other_materials.id"))
    so_luong = Column(Numeric(12, 3), nullable=False)
    dvt = Column(String(20))
    don_gia = Column(Numeric(18, 2))
    gia_tri = Column(Numeric(18, 2))
    ton_sau = Column(Numeric(12, 3))
    ghi_chu = Column(Text)

    voucher = relationship("InventoryVoucher", back_populates="items")
```

### 3.4 Module Phiếu Bán Hàng & Hóa Đơn

```python
# backend/app/models/billing.py

class SalesVoucher(Base):
    """Phiếu bán hàng (giao hàng + xuất kho TP)"""
    __tablename__ = "sales_vouchers"
    id = Column(Integer, primary_key=True)
    so_phieu = Column(String(50), unique=True, nullable=False)      # PBH-2024-001
    ngay_phieu = Column(Date, nullable=False)
    sales_order_id = Column(Integer, ForeignKey("sales_orders.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    # Giao hàng
    dia_chi_giao = Column(Text)
    xe_id = Column(Integer, ForeignKey("xe.id"))
    tai_xe_id = Column(Integer, ForeignKey("tai_xe.id"))
    ma_so_chuyen = Column(String(50))                               # mã số chuyến (backlog)
    # Tiền
    tong_tien_hang = Column(Numeric(18, 2))
    ty_le_vat = Column(Numeric(5, 2), default=8)
    tien_vat = Column(Numeric(18, 2))
    tong_cong = Column(Numeric(18, 2))
    # In giá trên phiếu
    hien_thi_gia = Column(Boolean, default=False)                   # cài đặt khách hàng
    ghi_chu = Column(Text)
    trang_thai = Column(String(20), default="cho_xuat")             # cho_xuat | da_xuat | huy
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    items = relationship("SalesVoucherItem", back_populates="voucher", cascade="all, delete-orphan")
    invoices = relationship("SalesInvoice", back_populates="voucher")


class SalesVoucherItem(Base):
    __tablename__ = "sales_voucher_items"
    id = Column(Integer, primary_key=True)
    voucher_id = Column(Integer, ForeignKey("sales_vouchers.id"), nullable=False)
    sales_order_item_id = Column(Integer, ForeignKey("sales_order_items.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    ten_hang = Column(String(500))
    so_luong = Column(Numeric(12, 0), nullable=False)
    dvt = Column(String(20))
    don_gia = Column(Numeric(18, 2))
    thanh_tien = Column(Numeric(18, 2))
    ghi_chu = Column(Text)


class SalesInvoice(Base):
    """Hóa đơn bán hàng (VAT invoice)"""
    __tablename__ = "sales_invoices"
    id = Column(Integer, primary_key=True)
    so_hoa_don = Column(String(50), unique=True)                    # HD số
    so_seri = Column(String(50))
    ngay_hoa_don = Column(Date, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    sales_voucher_id = Column(Integer, ForeignKey("sales_vouchers.id"))
    ten_don_vi = Column(String(500))
    dia_chi = Column(Text)
    ma_so_thue = Column(String(50))
    hinh_thuc_tt = Column(String(50))                               # TM / CK / TM+CK
    han_tt = Column(Date)
    tong_tien_hang = Column(Numeric(18, 2))
    ty_le_vat = Column(Numeric(5, 2))
    tien_vat = Column(Numeric(18, 2))
    tong_cong = Column(Numeric(18, 2))
    trang_thai = Column(String(20), default="nhap")                 # nhap | phat_hanh | huy
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())

    voucher = relationship("SalesVoucher", back_populates="invoices")
```

### 3.5 Module Kế Toán

```python
# backend/app/models/accounting.py

class CashReceipt(Base):
    """Phiếu thu tiền từ khách hàng"""
    __tablename__ = "cash_receipts"
    id = Column(Integer, primary_key=True)
    so_phieu = Column(String(50), unique=True, nullable=False)      # PT-2024-001
    ngay_phieu = Column(Date, nullable=False)
    phan_xuong = Column(String(100))
    hinh_thuc_tt = Column(String(50))                               # TM / CK
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    sales_invoice_id = Column(Integer, ForeignKey("sales_invoices.id"))
    hang_muc_thu = Column(String(200))
    so_tien = Column(Numeric(18, 2), nullable=False)
    ghi_chu = Column(Text)
    trang_thai = Column(String(20), default="cho_duyet")            # cho_duyet | da_duyet
    nguoi_duyet_id = Column(Integer, ForeignKey("users.id"))
    ngay_duyet = Column(DateTime)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())


class CashPayment(Base):
    """Phiếu chi"""
    __tablename__ = "cash_payments"
    id = Column(Integer, primary_key=True)
    so_phieu = Column(String(50), unique=True, nullable=False)      # PC-2024-001
    ngay_phieu = Column(Date, nullable=False)
    phan_xuong = Column(String(100))
    loai_phieu = Column(String(50))                                 # loại chi
    hinh_thuc_tt = Column(String(50))
    noi_dung = Column(Text)
    hang_muc_chi = Column(String(200))
    chi_tiet = Column(Text)
    so_tien = Column(Numeric(18, 2), nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))       # nếu chi cho NCC
    purchase_invoice_id = Column(Integer, ForeignKey("purchase_invoices.id"))
    ghi_chu = Column(Text)
    trang_thai = Column(String(20), default="cho_chot")             # cho_chot | da_chot | da_duyet
    nguoi_duyet_id = Column(Integer, ForeignKey("users.id"))
    ngay_duyet = Column(DateTime)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())


class PurchaseInvoice(Base):
    """Hóa đơn mua hàng (từ NCC)"""
    __tablename__ = "purchase_invoices"
    id = Column(Integer, primary_key=True)
    so_hoa_don = Column(String(50))
    so_seri = Column(String(50))
    ngay_lap = Column(Date, nullable=False)
    ngay_hoa_don = Column(Date)
    han_tt = Column(Date)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    material_receipt_id = Column(Integer, ForeignKey("material_receipts.id"))
    thue_suat = Column(Numeric(5, 2))
    tong_giam_tru = Column(Numeric(18, 2), default=0)
    tong_tien_hang = Column(Numeric(18, 2))
    tien_thue = Column(Numeric(18, 2))
    tong_thanh_toan = Column(Numeric(18, 2))
    trang_thai = Column(String(20), default="nhap")                 # nhap | xac_nhan | da_thanh_toan
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())


class DebtLedgerEntry(Base):
    """Bút toán công nợ (phát sinh thu/chi)"""
    __tablename__ = "debt_ledger_entries"
    id = Column(Integer, primary_key=True)
    ngay = Column(Date, nullable=False)
    loai = Column(String(10))                                       # 'thu' | 'chi'
    doi_tuong = Column(String(20))                                  # 'khach_hang' | 'nha_cung_cap'
    customer_id = Column(Integer, ForeignKey("customers.id"))
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    chung_tu_loai = Column(String(50))                              # 'phieu_thu' | 'hoa_don_ban' | ...
    chung_tu_id = Column(Integer)
    so_tien_phat_sinh = Column(Numeric(18, 2))
    so_du_sau = Column(Numeric(18, 2))
    ghi_chu = Column(Text)
    created_at = Column(DateTime, default=func.now())
```

### 3.6 Module Bảo Trì

```python
# backend/app/models/maintenance.py

class Workshop(Base):
    """Danh mục phân xưởng"""
    __tablename__ = "workshops"
    id = Column(Integer, primary_key=True)
    ma_px = Column(String(50), unique=True, nullable=False)
    ten_px = Column(String(200), nullable=False)
    ghi_chu = Column(Text)
    trang_thai = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())


class Machine(Base):
    """Danh mục máy móc"""
    __tablename__ = "machines"
    id = Column(Integer, primary_key=True)
    ma_may = Column(String(50), unique=True, nullable=False)
    ten_may = Column(String(200), nullable=False)
    workshop_id = Column(Integer, ForeignKey("workshops.id"))
    nhom_may = Column(String(100))                                  # nhóm máy (máy sóng, máy in,...)
    la_may = Column(Boolean, default=True)
    ghi_chu = Column(Text)
    trang_thai = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())


class MaintenanceMaterial(Base):
    """Danh mục vật tư bảo trì"""
    __tablename__ = "maintenance_materials"
    id = Column(Integer, primary_key=True)
    ma_vat_tu = Column(String(50), unique=True, nullable=False)
    ten_vat_tu = Column(String(200), nullable=False)
    machine_id = Column(Integer, ForeignKey("machines.id"))
    don_gia = Column(Numeric(18, 2))
    dvt = Column(String(20))
    theo_doi_nhap_xuat = Column(Boolean, default=True)
    ton_hien_tai = Column(Numeric(12, 3), default=0)
    trang_thai = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())


class MaintenanceSupplier(Base):
    """Danh mục nhà cung cấp bảo trì"""
    __tablename__ = "maintenance_suppliers"
    id = Column(Integer, primary_key=True)
    ma_ncc = Column(String(50), unique=True, nullable=False)
    ten_viet_tat = Column(String(100))
    ten_don_vi = Column(String(300), nullable=False)
    dia_chi = Column(Text)
    ma_so_thue = Column(String(50))
    dien_thoai = Column(String(50))
    fax = Column(String(50))
    nguoi_dai_dien = Column(String(200))
    di_dong = Column(String(50))
    trang_thai = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())


class MaintenancePurchaseRequest(Base):
    """Phiếu đề nghị mua hàng (bảo trì)"""
    __tablename__ = "maintenance_purchase_requests"
    id = Column(Integer, primary_key=True)
    so_phieu = Column(String(50), unique=True, nullable=False)      # DNMH-2024-001
    ngay_yeu_cau = Column(Date, nullable=False)
    nguoi_yeu_cau_id = Column(Integer, ForeignKey("users.id"))
    bo_phan = Column(String(100))
    noi_dung = Column(Text)
    hinh_anh = Column(Text)                                         # JSON list URL
    workshop_id = Column(Integer, ForeignKey("workshops.id"))
    machine_id = Column(Integer, ForeignKey("machines.id"))
    trang_thai = Column(String(20), default="cho_duyet")            # cho_duyet | da_duyet | huy
    nguoi_duyet_id = Column(Integer, ForeignKey("users.id"))
    ngay_duyet = Column(DateTime)
    created_at = Column(DateTime, default=func.now())

    items = relationship("MaintenancePurchaseRequestItem", back_populates="request", cascade="all, delete-orphan")


class MaintenancePurchaseRequestItem(Base):
    __tablename__ = "maintenance_purchase_request_items"
    id = Column(Integer, primary_key=True)
    request_id = Column(Integer, ForeignKey("maintenance_purchase_requests.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("maintenance_materials.id"))
    so_luong_yeu_cau = Column(Numeric(12, 3), nullable=False)
    don_gia_de_nghi = Column(Numeric(18, 2))
    thanh_tien_de_nghi = Column(Numeric(18, 2))
    dvt = Column(String(20))
    ghi_chu = Column(Text)


class MaintenancePurchaseOrder(Base):
    """Phiếu mua hàng bảo trì (nhập kho vật tư)"""
    __tablename__ = "maintenance_purchase_orders"
    id = Column(Integer, primary_key=True)
    so_phieu = Column(String(50), unique=True, nullable=False)      # MHBT-2024-001
    ngay_mua = Column(Date, nullable=False)
    request_id = Column(Integer, ForeignKey("maintenance_purchase_requests.id"))
    nguoi_mua_id = Column(Integer, ForeignKey("users.id"))
    supplier_id = Column(Integer, ForeignKey("maintenance_suppliers.id"))
    noi_dung = Column(Text)
    workshop_id = Column(Integer, ForeignKey("workshops.id"))
    machine_id = Column(Integer, ForeignKey("machines.id"))
    tong_tien = Column(Numeric(18, 2))
    hinh_anh_hoa_don = Column(Text)                                 # ảnh chụp HĐ
    trang_thai = Column(String(20), default="nhap")                 # nhap | da_nhap_kho
    created_at = Column(DateTime, default=func.now())

    items = relationship("MaintenancePurchaseOrderItem", back_populates="order", cascade="all, delete-orphan")


class MaintenancePurchaseOrderItem(Base):
    __tablename__ = "maintenance_purchase_order_items"
    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("maintenance_purchase_orders.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("maintenance_materials.id"))
    so_luong_de_nghi = Column(Numeric(12, 3))
    don_gia_de_nghi = Column(Numeric(18, 2))
    so_luong_thuc_te = Column(Numeric(12, 3), nullable=False)
    don_gia_thuc_te = Column(Numeric(18, 2))
    thanh_tien = Column(Numeric(18, 2))
    dvt = Column(String(20))


class MaintenanceMaterialIssue(Base):
    """Phiếu xuất kho vật tư bảo trì"""
    __tablename__ = "maintenance_material_issues"
    id = Column(Integer, primary_key=True)
    so_phieu = Column(String(50), unique=True, nullable=False)      # XKVT-2024-001
    ngay_xuat = Column(Date, nullable=False)
    warehouse_code = Column(String(50))                             # mã kho
    workshop_id = Column(Integer, ForeignKey("workshops.id"))
    machine_id = Column(Integer, ForeignKey("machines.id"))
    nguoi_nhan = Column(String(200))
    ghi_chu = Column(Text)
    trang_thai = Column(String(20), default="nhap")
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())

    items = relationship("MaintenanceMaterialIssueItem", back_populates="issue", cascade="all, delete-orphan")


class MaintenanceMaterialIssueItem(Base):
    __tablename__ = "maintenance_material_issue_items"
    id = Column(Integer, primary_key=True)
    issue_id = Column(Integer, ForeignKey("maintenance_material_issues.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("maintenance_materials.id"), nullable=False)
    so_luong_xuat = Column(Numeric(12, 3), nullable=False)
    ton_truoc = Column(Numeric(12, 3))
    ton_sau = Column(Numeric(12, 3))
    ghi_chu = Column(Text)
```

---

## 4. API ENDPOINTS CẦN BỔ SUNG

### Thu mua
```
POST   /api/procurement/purchase-orders              # tạo đơn mua
GET    /api/procurement/purchase-orders              # danh sách (phân trang, lọc loại)
GET    /api/procurement/purchase-orders/{id}         # chi tiết
PUT    /api/procurement/purchase-orders/{id}         # cập nhật
PATCH  /api/procurement/purchase-orders/{id}/approve # duyệt
PATCH  /api/procurement/purchase-orders/{id}/cancel  # hủy

POST   /api/procurement/material-receipts            # tạo phiếu nhập NL
GET    /api/procurement/material-receipts            # danh sách
GET    /api/procurement/material-receipts/{id}       # chi tiết
PATCH  /api/procurement/material-receipts/{id}/confirm # xác nhận nhập kho

GET    /api/procurement/inventory/material           # tồn kho nguyên liệu (sổ tổng hợp)
GET    /api/procurement/inventory/balance            # số dư từng mã NL
```

### Kế hoạch sản xuất
```
POST   /api/production-plans                         # tạo kế hoạch
GET    /api/production-plans                         # danh sách
GET    /api/production-plans/{id}                   # chi tiết + lines
PUT    /api/production-plans/{id}                   # cập nhật
PATCH  /api/production-plans/{id}/export            # xuất kế hoạch SX
GET    /api/production-plans/pending-lsx            # LSX chưa lên kế hoạch
```

### Kho thành phẩm & phôi sóng
```
POST   /api/inventory/receipts                      # nhập kho TP / phôi
GET    /api/inventory/receipts                      # danh sách phiếu nhập
GET    /api/inventory/issues                        # danh sách phiếu xuất
POST   /api/inventory/issues                        # xuất kho

GET    /api/inventory/balance/finished-goods        # tồn kho thành phẩm
GET    /api/inventory/balance/semi-finished         # tồn kho phôi sóng
GET    /api/inventory/balance/by-product/{id}       # tồn theo sản phẩm
```

### Phiếu bán hàng & hóa đơn
```
POST   /api/billing/sales-vouchers                  # tạo phiếu BH
GET    /api/billing/sales-vouchers                  # danh sách
GET    /api/billing/sales-vouchers/{id}             # chi tiết
PATCH  /api/billing/sales-vouchers/{id}/export      # xuất kho & phát hành
GET    /api/billing/sales-vouchers/{id}/print       # in phiếu (5 mẫu)

POST   /api/billing/sales-invoices                  # tạo hóa đơn
GET    /api/billing/sales-invoices                  # danh sách
PATCH  /api/billing/sales-invoices/{id}/issue       # phát hành HĐ
```

### Kế toán
```
POST   /api/accounting/cash-receipts                # tạo phiếu thu
GET    /api/accounting/cash-receipts                # danh sách
PATCH  /api/accounting/cash-receipts/{id}/approve   # duyệt

POST   /api/accounting/cash-payments                # tạo phiếu chi
GET    /api/accounting/cash-payments                # danh sách
PATCH  /api/accounting/cash-payments/{id}/chot      # chốt
PATCH  /api/accounting/cash-payments/{id}/approve   # duyệt

POST   /api/accounting/purchase-invoices            # tạo HĐ mua
GET    /api/accounting/purchase-invoices            # danh sách

GET    /api/accounting/debt-ledger/customer/{id}    # công nợ phải thu của 1 KH
GET    /api/accounting/debt-ledger/supplier/{id}    # công nợ phải trả với 1 NCC
GET    /api/accounting/debt-ledger/summary          # sổ công nợ tổng hợp
```

### Bảo trì
```
# Danh mục
GET/POST/PUT/DELETE  /api/maintenance/workshops
GET/POST/PUT/DELETE  /api/maintenance/machines
GET/POST/PUT/DELETE  /api/maintenance/materials
GET/POST/PUT/DELETE  /api/maintenance/suppliers

# Nghiệp vụ
POST   /api/maintenance/purchase-requests           # đề nghị mua hàng
GET    /api/maintenance/purchase-requests           # danh sách
PATCH  /api/maintenance/purchase-requests/{id}/approve  # duyệt

POST   /api/maintenance/purchase-orders             # phiếu mua hàng
GET    /api/maintenance/purchase-orders             # danh sách
PATCH  /api/maintenance/purchase-orders/{id}/receive    # xác nhận nhập kho

POST   /api/maintenance/material-issues             # phiếu xuất kho VT
GET    /api/maintenance/material-issues             # danh sách

GET    /api/maintenance/inventory/balance           # tồn kho vật tư
GET    /api/maintenance/inventory/pending-purchase  # vật tư chưa mua
GET    /api/maintenance/reports/history             # báo cáo bảo trì
```

### Báo cáo & Dashboard
```
GET    /api/reports/dashboard                       # số liệu realtime dashboard
GET    /api/reports/sales-summary                   # doanh thu tổng hợp
GET    /api/reports/production-progress             # tiến độ SX
GET    /api/reports/material-consumption            # xuất NL theo kỳ
GET    /api/reports/debt-summary                    # công nợ tổng hợp
```

---

## 5. FRONTEND PAGES CẦN BỔ SUNG

### Thu mua (`/procurement/`)
```
/procurement/purchase-orders              # PurchaseOrdersPage
/procurement/purchase-orders/new          # PurchaseOrderForm (loại: giấy cuộn)
/procurement/purchase-orders/other/new    # PurchaseOrderForm (loại: khác)
/procurement/purchase-orders/:id          # PurchaseOrderDetail

/procurement/material-receipts            # MaterialReceiptsPage
/procurement/material-receipts/new        # MaterialReceiptForm (chọn đơn hàng, nhập cân)
/procurement/material-receipts/:id        # MaterialReceiptDetail

/procurement/warehouse                    # MaterialWarehousePage (sổ tổng hợp NXTồn NL)
```

### Kế hoạch sản xuất (`/production/`)
```
/production/plans                         # ProductionPlansPage (danh sách kế hoạch)
/production/plans/new                     # ProductionPlanForm (chọn LSX, xếp lịch)
/production/plans/:id                     # ProductionPlanDetail (bảng lịch sản xuất)
```

### Kho (`/warehouse/`)
```
/warehouse/finished-goods                 # FinishedGoodsPage (tồn kho TP)
/warehouse/finished-goods/receive         # ReceiveFinishedGoodsForm (nhập TP từ SX)
/warehouse/semi-finished                  # SemiFinishedPage (kho phôi sóng)
/warehouse/semi-finished/receive          # ReceiveSemiFinishedForm
/warehouse/semi-finished/issue            # IssueSemiFinishedForm (xuất phôi SX)
```

### Phiếu bán hàng & Hóa đơn (`/billing/`)
```
/billing/sales-vouchers                   # SalesVouchersPage
/billing/sales-vouchers/new               # SalesVoucherForm (từ đơn hàng, chọn hàng, xe, tài xế)
/billing/sales-vouchers/:id               # SalesVoucherDetail + nút in (5 mẫu)

/billing/sales-invoices                   # SalesInvoicesPage
/billing/sales-invoices/new               # SalesInvoiceForm (từ phiếu BH)
/billing/sales-invoices/:id               # SalesInvoiceDetail
```

### Kế toán (`/accounting/`)
```
/accounting/cash-receipts                 # CashReceiptsPage
/accounting/cash-receipts/new             # CashReceiptForm (chọn KH, HĐ, số tiền)
/accounting/cash-receipts/:id             # CashReceiptDetail

/accounting/cash-payments                 # CashPaymentsPage
/accounting/cash-payments/new             # CashPaymentForm
/accounting/cash-payments/:id             # CashPaymentDetail

/accounting/purchase-invoices             # PurchaseInvoicesPage
/accounting/purchase-invoices/new         # PurchaseInvoiceForm (từ phiếu nhập NL)
/accounting/purchase-invoices/:id         # PurchaseInvoiceDetail

/accounting/debt-ledger                   # DebtLedgerPage (sổ công nợ KH + NCC)
```

### Bảo trì (`/maintenance/`)
```
# Danh mục
/maintenance/workshops                    # WorkshopList
/maintenance/machines                     # MachineList
/maintenance/materials                    # MaintenanceMaterialList
/maintenance/suppliers                    # MaintenanceSupplierList

# Nghiệp vụ
/maintenance/purchase-requests            # PurchaseRequestsPage
/maintenance/purchase-requests/new        # PurchaseRequestForm
/maintenance/purchase-requests/:id        # PurchaseRequestDetail

/maintenance/purchase-orders              # MaintenancePOsPage
/maintenance/purchase-orders/:id          # MaintenancePODetail

/maintenance/material-issues              # MaterialIssuesPage
/maintenance/material-issues/new          # MaterialIssueForm

/maintenance/inventory                    # MaintenanceInventoryPage (tồn vật tư)
/maintenance/pending-purchase             # PendingPurchasePage (VT chưa mua)
/maintenance/reports                      # MaintenanceReportsPage
```

### Dashboard & Báo cáo (`/`)
```
/dashboard                                # DashboardPage (realtime KPIs)
/reports/sales                            # SalesReportPage
/reports/production                       # ProductionReportPage
/reports/materials                        # MaterialReportPage
/reports/debt                             # DebtReportPage
```

---

## 6. CẤU TRÚC FILE BACKEND (đích đến)

```
backend/app/
├── models/
│   ├── auth.py          ✅
│   ├── master.py        ✅
│   ├── production.py    ✅
│   ├── sales.py         ✅
│   ├── inventory.py     ⚠️ (cần InventoryVoucher)
│   ├── bom.py           ✅
│   ├── procurement.py   ❌ thêm mới
│   ├── production_plan.py  ❌ thêm mới
│   ├── billing.py       ❌ thêm mới
│   ├── accounting.py    ❌ thêm mới
│   └── maintenance.py   ❌ thêm mới
├── schemas/
│   ├── auth.py          ✅
│   ├── master.py        ✅
│   ├── sales.py         ✅
│   ├── production.py    ✅
│   ├── bom.py           ✅
│   ├── procurement.py   ❌
│   ├── production_plan.py ❌
│   ├── billing.py       ❌
│   ├── accounting.py    ❌
│   └── maintenance.py   ❌
├── routers/
│   ├── [hiện có 20 file] ✅
│   ├── procurement.py   ❌ (PO + phiếu nhập NL)
│   ├── production_plans.py ❌
│   ├── warehouse.py     ❌ (kho TP, phôi)
│   ├── billing.py       ❌ (phiếu BH + HĐ bán)
│   ├── accounting.py    ❌ (PT, PC, HĐ mua, công nợ)
│   ├── maintenance.py   ❌ (toàn bộ BT)
│   └── reports.py       ❌ (dashboard + báo cáo)
└── services/
    ├── price_calculator.py  ✅
    ├── inventory_service.py ❌ (logic NXT tồn)
    ├── debt_service.py      ❌ (tính công nợ)
    └── report_service.py    ❌ (aggregation)
```

---

## 7. CẤU TRÚC FILE FRONTEND (đích đến)

```
frontend/src/
├── api/
│   ├── [hiện có 16 file] ✅
│   ├── procurement.ts   ❌
│   ├── productionPlans.ts ❌
│   ├── warehouse.ts     ❌
│   ├── billing.ts       ❌
│   ├── accounting.ts    ❌
│   ├── maintenance.ts   ❌
│   └── reports.ts       ❌
├── pages/
│   ├── dashboard/       ⚠️ (cần KPIs realtime)
│   ├── sales/           ✅
│   ├── quotes/          ✅
│   ├── production/      ⚠️ (thiếu ProductionPlanPage)
│   ├── danhmuc/         ✅
│   ├── procurement/     ❌ thêm mới
│   ├── warehouse/       ❌ thêm mới
│   ├── billing/         ❌ thêm mới
│   ├── accounting/      ❌ thêm mới
│   ├── maintenance/     ❌ thêm mới
│   └── reports/         ❌ thêm mới
└── components/
    ├── AppLayout.tsx    ⚠️ (cần thêm menu cho module mới)
    ├── MasterDetailLayout.tsx ✅
    ├── PrintVoucher.tsx ❌ (component in phiếu)
    └── KpiCard.tsx      ❌ (dashboard widget)
```

---

## 8. MENU NAVIGATION (AppLayout)

```
📊 Dashboard
──────────────
📝 Bán hàng
   ├─ Báo giá
   ├─ Đơn hàng
   ├─ Phiếu bán hàng
   └─ Hóa đơn bán hàng
──────────────
🏭 Sản xuất
   ├─ Lệnh sản xuất
   ├─ Kế hoạch sản xuất
   └─ Hoạch toán BOM
──────────────
🛒 Thu mua
   ├─ Đơn hàng giấy cuộn
   ├─ Đơn hàng khác
   └─ Phiếu nhập nguyên liệu
──────────────
🏪 Kho
   ├─ Kho nguyên liệu
   ├─ Kho thành phẩm
   └─ Kho phôi sóng
──────────────
💰 Kế toán
   ├─ Phiếu thu
   ├─ Phiếu chi
   ├─ Hóa đơn mua hàng
   └─ Sổ công nợ
──────────────
🔧 Bảo trì
   ├─ Đề nghị mua hàng
   ├─ Phiếu mua hàng
   ├─ Phiếu xuất vật tư
   └─ Tồn kho vật tư
──────────────
📋 Báo cáo
   ├─ Doanh thu
   ├─ Tiến độ SX
   ├─ Nguyên liệu
   └─ Công nợ
──────────────
⚙️ Danh mục
   ├─ Khách hàng
   ├─ Nhà cung cấp
   ├─ Sản phẩm
   ├─ Nguyên liệu giấy
   ├─ Nguyên liệu khác
   ├─ Nhóm nguyên liệu
   ├─ Kho
   ├─ Cấu trúc thông dụng
   ├─ [Bảo trì] Phân xưởng
   ├─ [Bảo trì] Máy móc
   ├─ [Bảo trì] Vật tư
   ├─ [Bảo trì] NCC bảo trì
   ├─ Xe / Tài xế
   ├─ Tỉnh thành
   └─ Người dùng
```

---

## 9. HỆ THỐNG MÃ CHỨNG TỪ

| Chứng từ | Prefix | Ví dụ |
|----------|--------|-------|
| Báo giá | BG | BG-2024-001 |
| Đơn hàng | DH | DH-2024-001 |
| Lệnh SX | LSX | LSX-2024-001 |
| Kế hoạch SX | KH | KH-2024-001 |
| Đơn mua giấy cuộn | DMGC | DMGC-2024-001 |
| Đơn mua khác | DMK | DMK-2024-001 |
| Phiếu nhập NL | PIN | PIN-2024-001 |
| Phiếu nhập TP | PNTP | PNTP-2024-001 |
| Phiếu xuất TP | PXTP | PXTP-2024-001 |
| Phiếu nhập phôi | PNP | PNP-2024-001 |
| Phiếu xuất phôi | PXP | PXP-2024-001 |
| Phiếu bán hàng | PBH | PBH-2024-001 |
| Hóa đơn bán hàng | HDBH | HDBH-2024-001 |
| Phiếu thu | PT | PT-2024-001 |
| Phiếu chi | PC | PC-2024-001 |
| Hóa đơn mua hàng | HDMH | HDMH-2024-001 |
| ĐNMH bảo trì | DNMH | DNMH-2024-001 |
| Phiếu mua BT | MHBT | MHBT-2024-001 |
| Phiếu xuất VT | XKVT | XKVT-2024-001 |

---

## 10. LỘ TRÌNH TRIỂN KHAI

### Giai đoạn 1 — P1 (Luồng SX cốt lõi)
1. **Kế hoạch sản xuất** — models + API + trang lịch chạy máy
2. **Thu mua giấy cuộn** — models + API + trang ĐHGC
3. **Phiếu nhập nguyên liệu** — models + API + form nhập cân
4. **Kho nguyên liệu** — sổ tổng hợp NXTồn
5. **Hoàn thiện báo giá** — workflow duyệt đúng Odoo, print

### Giai đoạn 2 — P2 (Hoàn thiện vòng tiền)
6. **Kho thành phẩm** — nhập TP từ SX, tồn kho
7. **Kho phôi sóng** — nhập/xuất phôi
8. **Phiếu bán hàng** — xuất kho + giao hàng, in 5 mẫu
9. **Hóa đơn bán hàng** — phát hành VAT
10. **Dashboard** — KPI realtime (SX, kho, doanh thu)

### Giai đoạn 3 — P3 (Kế toán & Bảo trì)
11. **Phiếu thu / Phiếu chi**
12. **Hóa đơn mua hàng**
13. **Sổ công nợ**
14. **Toàn bộ module Bảo trì**
15. **Báo cáo tổng hợp**
