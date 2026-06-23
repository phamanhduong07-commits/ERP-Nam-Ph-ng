# Plan: Chuyển BTP CD2 giữa các xưởng

## Context

Nghiệp vụ: hàng đang SX tại xưởng A, hoàn thành một phần CD2 (ví dụ: đã in xong nhưng chưa bế/dán), cần chuyển sang xưởng B để làm tiếp công đoạn còn lại.

Hệ thống hiện tại không hỗ trợ vì `PhieuChuyenKho` chỉ chuyển được phôi sóng (production_order_id) và NVL (paper/other_material_id) — không chuyển được sản phẩm (product_id). Chưa có khái niệm kho BTP và chưa có liên kết parent-child giữa các LSX.

**Infrastructure đã có sẵn — không cần thêm:**
- `InventoryBalance.product_id` FK đã có → đủ để track tồn kho BTP theo product
- `InventoryTransaction.product_id` FK đã có → đủ để log giao dịch BTP

---

## Workflow sau khi implement

```
Xưởng A — SX xong công đoạn 1:
1. LSX A hoàn thành phần mình làm (ví dụ: in xong)
2. ProductionOutput → chọn kho BTP xưởng A (loai_kho='BTP')
   → InventoryBalance(warehouse=kho_BTP_A, product_id=X) += N cái

Chuyển xưởng:
3. PhieuChuyenKho
   - Kho xuất: kho BTP xưởng A
   - Kho nhập: kho BTP xưởng B
   - Items: {product_id=X, so_luong=N, don_gia=gia_xuat_xuong_tu_ProductionOutput}
4. Duyệt phiếu:
   → InventoryBalance kho A: -N cái
   → InventoryBalance kho B: +N cái
   → 2 InventoryTransaction: CHUYEN_KHO_XUAT + CHUYEN_KHO_NHAP
   → Kế toán tự động (cùng pattern 1368/5112/3368 hiện có)

Xưởng B — Nhận và SX tiếp:
5. Tạo LSX B, chọn "Từ LSX" = LSX A (parent_production_order_id)
6. Xuất BTP từ kho BTP xưởng B vào SX (trừ InventoryBalance)
7. SX xong → ProductionOutput → kho TP xưởng B (loai_kho='TP')
```

---

## Tính đơn giá BTP

```
đơn_giá_BTP = gia_phoi_per_unit + addon_cong_doan_da_lam
```

**Nguồn `gia_phoi_per_unit`:**
- Lấy từ `QuoteItem.gia_phoi` (= a+b+e, đã có sẵn trong model)
- Trace: LSX A → `ProductionOrder.sales_order_id` → `SalesOrder` → `Quote` → `QuoteItem.gia_phoi`
- Đơn vị: đ/thùng (đã bao gồm tính diện tích)

**Nguồn `addon_cong_doan_da_lam`:**
- Tính từ ADDON_RATES × diện tích sản phẩm (m²/thùng)
- User chọn công đoạn xưởng A đã làm (in X màu, chống thấm, cán màng...)
- Hệ thống tự tính theo ADDON_RATES từ `price_calculator.py`
- Ví dụ: in 1 màu = 300đ/m² × dien_tich → đ/thùng

**Mục đích:** hoạch toán nội bộ giữa các xưởng — không cần khớp chính xác giá thị trường, không cần realtime.

**Implementation:**
- Backend: endpoint `GET /api/warehouse/btp-price?production_order_id=X&cong_doan=in_1_mau,...`
  - Query `QuoteItem.gia_phoi` qua chain LSX A → SalesOrder → Quote
  - Tính addon theo cong_doan params + product dimensions từ ProductionOrderItem
  - Trả về: `{gia_phoi, addon_breakdown, don_gia_btp}`
  - Nếu không có Quote liên kết → trả `{gia_phoi: null}` → frontend cho nhập tay
- Frontend: khi user chọn LSX A + công đoạn đã làm → auto-call endpoint → hiện giá gợi ý (editable, không bắt buộc khớp)

---

## Thay đổi cần thực hiện

### Backend — Models (4 thay đổi nhỏ)

**1. `backend/app/models/master.py`** — Warehouse.loai_kho
- Thêm giá trị `'BTP'` vào comment/enum choices (field là String, không cần migration logic phức tạp)
- Mục đích: phân biệt kho BTP với kho TP hoàn chỉnh

**2. `backend/app/models/warehouse_doc.py`** — PhieuChuyenKhoItem
```python
# Thêm sau other_material_id:
product_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("products.id"), nullable=True)
# Thêm relationship:
product = relationship("Product")
```

**3. `backend/app/models/production.py`** — ProductionOrder
```python
# Thêm:
parent_production_order_id: Mapped[int | None] = mapped_column(
    Integer, ForeignKey("production_orders.id"), nullable=True
)
parent_order = relationship("ProductionOrder", remote_side="ProductionOrder.id", foreign_keys=[parent_production_order_id])
```

**4. Alembic migration** — 2 cột mới:
```sql
ALTER TABLE phieu_chuyen_kho_item ADD COLUMN product_id INTEGER REFERENCES products(id);
ALTER TABLE production_orders ADD COLUMN parent_production_order_id INTEGER REFERENCES production_orders(id);
```

---

### Backend — Routers (3 thay đổi)

**5. `backend/app/routers/stock_transfers.py`** — logic approve PhieuChuyenKho
- Hiện tại: xử lý 2 loại item (phôi via production_order_id; NVL via paper/other_material_id)
- Thêm: loại thứ 3 — **sản phẩm** (product_id)
  - Validate: kiểm tra `InventoryBalance(warehouse=kho_xuat, product_id=X).ton_luong >= so_luong`
  - Approve xuat: `_xuat_balance(db, warehouse_id=kho_xuat, product_id=X, so_luong, don_gia)` + log `CHUYEN_KHO_XUAT`
  - Approve nhap: `_nhap_balance(db, warehouse_id=kho_nhap, product_id=X, so_luong, don_gia)` + log `CHUYEN_KHO_NHAP`
  - Schema (`PhieuChuyenKhoItemCreate`): thêm `product_id: int | None`

**6. `backend/app/routers/production_outputs.py`** — cho phép kho BTP
- Nếu hiện tại đang filter `loai_kho='TP'` khi chọn kho nhập → bỏ filter hoặc thêm `'BTP'`
- Schema response: đảm bảo trả `warehouse.loai_kho` để frontend biết phân biệt

**7. `backend/app/routers/production_orders.py`** — nhận parent_production_order_id
- `ProductionOrderCreate` schema: thêm `parent_production_order_id: int | None = None`
- Endpoint POST: lưu field này vào model

---

### Frontend — 3 thay đổi UI

**8. `frontend/src/pages/warehouse/TransfersPage.tsx`**
- Form thêm item phiếu chuyển kho: thêm loại "Sản phẩm/BTP" bên cạnh "Phôi" và "NVL"
- Khi chọn loại Sản phẩm → hiện product selector (dropdown/search)
- Gửi `product_id` trong items payload

**9. `frontend/src/pages/warehouse/ProductionOutputPage.tsx`**
- Dropdown chọn kho nhập: thêm kho `loai_kho='BTP'` vào danh sách

**10. ProductionOrder form** (tìm file tương ứng trong `frontend/src/pages/production/`)
- Thêm field tùy chọn "Từ LSX" → chọn LSX cha (parent_production_order_id)
- Field này nullable, chỉ hiện khi tích "Tiếp nối LSX khác"

---

## Verification

1. **Tạo kho BTP xưởng A** trong master data (loai_kho='BTP')
2. **Chạy migration**: `alembic revision --autogenerate -m "add_product_id_chuyen_kho_parent_lsx"` → `alembic upgrade head`
3. **Test luồng end-to-end**:
   - ProductionOutput LSX A → chọn kho BTP xưởng A → verify InventoryBalance có record (product_id=X, warehouse=kho_BTP_A)
   - Tạo PhieuChuyenKho với item product_id=X, so_luong=50 → status nhap
   - Duyệt phiếu → verify InventoryBalance: kho A -50, kho B +50; verify 2 InventoryTransaction
   - Tạo LSX B với parent = LSX A → verify field lưu đúng
4. **Test accounting**: duyệt phiếu chuyển kho → kiểm tra journal entries tự động sinh (pattern 1368/3368)
5. **Test cancel**: hủy phiếu đã duyệt → verify inventory rollback
