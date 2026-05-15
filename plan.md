# Plan: Hoàn thiện Purchase Module (YMH + PO + GR) — đạt 10/10
Date: 2026-05-15
Status: DONE — 2026-05-15

## Mục tiêu
Đưa 3 trang luồng mua hàng lên 10/10 theo scorecard:
- **YMHListPage** (Yêu cầu mua hàng): từ ~6.5 → 10
- **POListPage** (Đơn mua hàng): từ ~7.5 → 10
- **GoodsReceiptPage** (Phiếu nhập kho): từ ~7 → 10

Tính năng thêm cho cả 3: filter persistence, search text, shortcut buttons.
Thêm riêng: deadline color (PO/YMH), export Excel (YMH), TypeScript clean.

## Các bước thực thi

### BACKEND (3 bước)

- [ ] Bước 1: YMH router — thêm `search` param
  - File: `backend/app/routers/purchase_requisitions.py`
  - Hàm `list_ymh`: thêm `search: Optional[str] = None`
  - Filter: `or_(PurchaseRequisition.so_ymh.ilike(like), PurchaseRequisitionItem.ten_hang.ilike(like))` + outerjoin items + distinct
  - File: `frontend/src/api/purchase_requisitions.ts` — thêm `search?: string` vào `ymhApi.list` params
  - Mục tiêu: gõ tên hàng/số YMH tìm được ngay

- [ ] Bước 2: PO router — thêm `search` param
  - File: `backend/app/routers/purchase_orders.py`
  - Hàm `list_pos`: thêm `search: Optional[str] = None`
  - Filter: `or_(PurchaseOrder.so_po.ilike(like), Supplier.ten_viet_tat.ilike(like))` + outerjoin Supplier
  - File: `frontend/src/api/purchase.ts` — thêm `search?: string` vào `purchaseApi.list` params
  - Mục tiêu: gõ tên NCC / số PO tìm được

- [ ] Bước 3: GR router — thêm `search` param
  - File: `backend/app/routers/warehouse.py`
  - Hàm `list_goods_receipts`: thêm `search: Optional[str] = Query(None)`
  - Filter: `or_(GoodsReceipt.so_phieu.ilike(like), Supplier.ten_viet_tat.ilike(like))` + outerjoin Supplier
  - File: `frontend/src/api/warehouse.ts` — thêm `search?: string` vào `listGoodsReceipts` params
  - Mục tiêu: gõ số phiếu / tên NCC tìm được

### FRONTEND — YMHListPage (3 bước)

- [ ] Bước 4: Filter persistence + Search Input
  - File: `frontend/src/pages/purchase/YMHListPage.tsx`
  - Thêm `FILTER_KEY = 'ymh_filters'` + `loadFilters()` helper
  - State `search` mới; state hiện có đọc từ sessionStorage
  - `useEffect` ghi lại khi filter thay đổi
  - Thêm `<Input.Search>` vào filter bar (placeholder "Tìm số YMH / tên hàng...")
  - Query key bổ sung `search`; API call thêm `search`
  - Mục tiêu: F5 → filter restore; search hoạt động

- [ ] Bước 5: Shortcut filter buttons
  - File: `frontend/src/pages/purchase/YMHListPage.tsx`
  - Thêm state `shortcutFilter: string | null`
  - 3 nút bên dưới filter bar: **Chờ PB duyệt** (nhap) · **Chờ GĐ duyệt** (duyet_pb) · **Chờ tạo PO** (duyet_gd)
  - Nút active → `type="primary"`; shortcut override `trangThai` trong API call
  - Lưu shortcutFilter vào sessionStorage
  - Mục tiêu: 1 click lọc theo giai đoạn duyệt

- [ ] Bước 6: Export Excel + deadline color ngay_can
  - File: `frontend/src/pages/purchase/YMHListPage.tsx`
  - Thêm nút **Excel** (dùng `smartExportExcel` / `exportToExcel`)
  - Trong Drawer chi tiết: cột `ngay_can` render màu đỏ nếu quá hạn, cam nếu ≤ 3 ngày (chỉ khi YMH còn active: nhap/duyet_pb/duyet_gd)
  - Trong bảng list: thêm cột **Ngày cần sớm nhất** (min của ngay_can các items), tô màu tương tự
  - Mục tiêu: xuất được Excel; nhìn thấy ngay YMH nào urgent

### FRONTEND — POListPage (2 bước)

- [ ] Bước 7: Filter persistence + Search Input + Deadline color
  - File: `frontend/src/pages/purchase/POListPage.tsx`
  - Thêm `FILTER_KEY = 'po_filters'`; đọc/ghi sessionStorage cho tất cả filter state
  - Thêm `search` state + `<Input.Search>` vào filter bar
  - Query key + API call bổ sung `search`
  - Cột `ngay_du_kien_nhan`: render màu đỏ + WarningOutlined nếu quá hạn và trang_thai không phải `da_nhan/huy`, màu cam nếu ≤ 3 ngày
  - Mục tiêu: F5 restore; search theo NCC/số PO; PO quá hạn nổi bật

- [ ] Bước 8: Shortcut buttons POListPage
  - File: `frontend/src/pages/purchase/POListPage.tsx`
  - 3 nút shortcut: **Chưa giao** (da_duyet + da_gui_ncc) · **Đang giao** (dang_giao) · **Quá hạn DK** (frontend filter: active PO AND ngay_du_kien_nhan < today)
  - "Chưa giao" và "Đang giao" dùng API param; "Quá hạn DK" filter frontend (useMemo displayItems)
  - Lưu shortcut vào sessionStorage
  - Mục tiêu: 1 click xem PO cần xử lý

### FRONTEND — GoodsReceiptPage (1 bước)

- [ ] Bước 9: Filter persistence + Search Input + Shortcut buttons
  - File: `frontend/src/pages/purchase/GoodsReceiptPage.tsx`
  - Thêm `FILTER_KEY = 'gr_filters'`; lưu/đọc 7 filter: filterNCC, filterTrangThai, filterPhapNhan, filterXuong, filterKho, tuNgay, denNgay
  - Thêm `search` state + `<Input.Search>` (placeholder "Tìm số phiếu / NCC...")
  - Query key + API call bổ sung `search`
  - Shortcut buttons: **Chờ duyệt** (nhap + nhap_nhanh) · **Đã duyệt** (da_duyet)
    - "Chờ duyệt": shortcut bật → API gọi với `trang_thai=nhap` (phần nhap_nhanh filter frontend)
    - Hoặc đơn giản: shortcut override `filterTrangThai` = 'nhap'/'da_duyet'
  - Mục tiêu: F5 restore; search theo số phiếu/NCC; shortcut filter nhanh

### PHASE 5 (1 bước)

- [ ] Bước 10: TypeScript check + fix
  - Chạy `npx tsc --noEmit` trong `frontend/`
  - Fix tất cả lỗi mới phát sinh (target: 0 lỗi)

## Done Criteria
- [ ] GET /api/purchase-requisitions?search=xxx → filter đúng
- [ ] GET /api/purchase-orders?search=xxx → filter đúng
- [ ] GET /api/warehouse/goods-receipts?search=xxx → filter đúng
- [ ] F5 trên YMHListPage → filter/search/shortcut restore
- [ ] F5 trên POListPage → filter/search/shortcut restore
- [ ] F5 trên GoodsReceiptPage → filter/search/shortcut restore
- [ ] Nút shortcut YMH hoạt động đúng (3 trạng thái)
- [ ] Nút shortcut PO hoạt động đúng (Quá hạn DK filter frontend)
- [ ] Nút shortcut GR hoạt động đúng
- [ ] Deadline color ngay_can hiển thị trong YMH list + drawer
- [ ] Deadline color ngay_du_kien_nhan hiển thị trong PO list
- [ ] Export Excel YMHListPage hoạt động
- [ ] TypeScript: 0 lỗi mới

## Rủi ro
- Bước 1: join items trong YMH có thể tạo duplicate rows → cần `.distinct()`
- Bước 2/3: join Supplier cần import đúng model, kiểm tra tên class
- Bước 9: GoodsReceiptPage có 7 filters → sessionStorage key-value phức tạp hơn, cần serialize JSON
- Bước 8: "Chờ duyệt" GR bao gồm cả `nhap_nhanh` và `nhap` → shortcut dùng frontend useMemo thay vì API param
