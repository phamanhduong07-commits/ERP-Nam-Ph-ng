# Plan: Kích hoạt auto-discovery cột DB cho 8 trang key

## Context

Hook `useColumnPrefs` đã có sẵn option `data?: unknown[]` để tự động phát hiện các field trong DB mà chưa được map vào `columns[]`. Khi truyền vào, hook sẽ:
1. Đọc `data[0]` (row đầu tiên của API response)
2. Tìm các key chưa có trong `columns[]` định nghĩa trong code
3. Tự tạo column definition cho các key đó (ẩn mặc định)
4. Hiển thị chúng trong modal "Tùy chỉnh giao diện" dưới dạng unchecked

**Vấn đề hiện tại:** Không trang nào truyền `data` vào hook → modal chỉ hiện cột code-defined → user không thấy cột nào để thêm.

## Approach

Thêm `data: <rows>` vào options của `useColumnPrefs` ở 8 trang key. Chỉ 1 dòng thay đổi mỗi trang. Không thay đổi hook logic, không break cột hiện tại.

## Các trang cần thay đổi

| # | File | Line | data variable | Thay đổi |
|---|------|------|---------------|---------|
| 1 | `pages/sales/OrderList.tsx` | 362 | `data?.items` | thêm `data: data?.items` |
| 2 | `pages/quotes/QuoteList.tsx` | 435 | `data?.items` | thêm `data: data?.items` |
| 3 | `pages/danhmuc/CustomerList.tsx` | 150 | `data?.items` | thêm `data: data?.items` |
| 4 | `pages/danhmuc/ProductList.tsx` | 197 | `data?.items` | thêm `data: data?.items` |
| 5 | `pages/purchase/POListPage.tsx` | 416 | `rawPoList` (flat array) | thêm `data: rawPoList` |
| 6 | `pages/billing/SalesInvoiceListPage.tsx` | 204 | `data?.items` | thêm `data: data?.items` |
| 7 | `pages/production/ProductionOrderList.tsx` | 627 | `data?.items` | thêm `data: data?.items` |
| 8 | `pages/warehouse/ReceiptsPage.tsx` | 497 | `receiptList` (flat array) | thêm `data: receiptList` |

## Pattern áp dụng

**Trang dùng paginated response (6/8 trang):**
```tsx
// TRƯỚC:
const { displayColumns, settingsButton } = useColumnPrefs('page-key', columns, {
  nonHideable: ['so_don'],
})

// SAU — chỉ thêm 1 dòng:
const { displayColumns, settingsButton } = useColumnPrefs('page-key', columns, {
  nonHideable: ['so_don'],
  data: data?.items,   // ← dòng thêm
})
```

**Trang dùng flat array (POListPage, ReceiptsPage):**
```tsx
const { displayColumns, settingsButton } = useColumnPrefs('purchase-order-list', columns, {
  nonHideable: ['so_po'],
  data: rawPoList,   // ← flat array trực tiếp
})
```

## Kết quả sau khi áp dụng

- User mở modal → thấy đầy đủ cột DB (kể cả cột chưa được code trong `columns[]`)
- Cột extra mặc định ẩn (unchecked) — user tích vào để hiện
- Tên cột auto-generate từ field name (`_` → space)
- Persist vào localStorage như cột thường

**Lưu ý:** Auto-columns chỉ xuất hiện sau khi data load xong (bảng có ít nhất 1 row). Object/array fields bị lọc tự động.

## Verification

1. Khởi động frontend dev server
2. Mở trang Orders → click icon settings (⚙) cột
3. Modal hiện → thấy các cột DB unchecked ở phía dưới
4. Tích 1 cột → Xác nhận → cột xuất hiện trong bảng
5. Reload → cột vẫn hiện (persist localStorage)
