# Plan: Tùy chỉnh cột bảng toàn ERP (ẩn/hiện + đổi thứ tự)

## Context

ERP hiện có 178/244 page dùng `<Table>` của Ant Design, nhưng chưa có cơ chế nào cho phép người dùng ẩn/hiện cột hay kéo đổi thứ tự cột. Mỗi cột được định nghĩa inline dưới dạng `ColumnsType<T>[]` tại từng page — không có wrapper chung. Yêu cầu: xây một hệ thống tùy chỉnh cột có thể áp dụng đồng bộ toàn ERP với thay đổi tối thiểu (~3 dòng) cho mỗi page.

---

## Kiến trúc đề xuất

### 2 file cần tạo mới

**`frontend/src/hooks/useColumnPrefs.ts`** — Hook trung tâm
- Nhận `pageKey` (unique string per page) + `columns` gốc + tùy chọn `nonHideable[]`
- Đọc/ghi `localStorage` với key `erp-cols-v1-${pageKey}`
- Lưu dạng `{ [colKey]: { visible: boolean, order: number } }`
- **Merge strategy**: cột mới thêm vào code mà chưa có trong storage → tự động hiện (không bị mất)
- Trả về: `{ displayColumns, settingsButton }`

```typescript
// Cách dùng tại mỗi page (thêm 3 dòng):
const { displayColumns, settingsButton } = useColumnPrefs('sales-order-list', columns, {
  nonHideable: ['so_don']   // cột không cho phép ẩn
})
// Thay columns → displayColumns trong <Table>
// Thêm settingsButton vào toolbar
```

**`frontend/src/components/ColumnSettings.tsx`** — Modal UI (như screenshot)
- Ô tìm kiếm lọc tên cột
- List có checkbox + drag handle (⠿) để kéo đổi thứ tự
- Link "Hiện tất cả" / "Ẩn tất cả"
- Nút "Xác nhận" → lưu localStorage, đóng modal
- Cột `nonHideable`: checkbox disabled, luôn checked

### Drag-and-drop

Kiểm tra `package.json` xem `@dnd-kit/sortable` có sẵn chưa. Nếu có → dùng. Nếu không → cài thêm:
```
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```
(~45KB gzip, không ảnh hưởng bundle lớn)

### Xác định `key` cho mỗi cột

Hook dùng `col.key ?? col.dataIndex` làm identifier. Các cột dùng `render` mà không có `dataIndex` (ví dụ: cột action) cần có `key` tường minh → khi apply vào page nào thì kiểm tra và bổ sung `key: 'action'` nếu thiếu.

---

## Thứ tự triển khai

### Phase 1 — Xây infrastructure (không sửa page nào)

1. Tạo `frontend/src/hooks/useColumnPrefs.ts`
2. Tạo `frontend/src/components/ColumnSettings.tsx`
3. Viết unit test nhỏ cho merge logic (new col not in storage → visible by default)

### Phase 2 — Apply vào 10 page ưu tiên cao

Áp dụng pattern 3 dòng cho:

| Page | File |
|---|---|
| Danh sách đơn hàng | `pages/sales/OrderList.tsx` |
| Danh sách nhân viên | `pages/hr/EmployeeListPage.tsx` |
| Tồn kho giấy | `pages/warehouse/InventoryPage.tsx` |
| Sổ quỹ tiền mặt | `pages/accounting/CashBookPage.tsx` |
| Sổ chi tiết công nợ | `pages/accounting/APLedgerPage.tsx` |
| Danh sách khách hàng | `pages/crm/` (file chính) |
| Danh sách báo giá | `pages/quotes/` (file chính) |
| Danh sách phiếu mua hàng | `pages/purchase/` (file chính) |
| Danh sách lệnh sản xuất | `pages/production/` (file chính) |
| Danh sách phiếu nhập kho | `pages/warehouse/` (file chính) |

### Phase 3 — Phủ toàn bộ 168 page còn lại

Áp dụng cùng pattern — có thể làm theo module (accounting trước, rồi hr, rồi warehouse...). Mỗi page chỉ cần:
1. Import hook
2. Thêm `useColumnPrefs(pageKey, columns)`
3. Đổi `columns=` → `columns={displayColumns}` trong Table
4. Thêm `settingsButton` vào toolbar/header

---

## Chi tiết kỹ thuật

### localStorage schema
```typescript
// Key: "erp-cols-v1-sales-order-list"
// Value:
{
  "so_don":        { "visible": true,  "order": 0 },
  "ngay_giao":     { "visible": false, "order": 1 },
  "khach_hang":    { "visible": true,  "order": 2 },
  "tong_tien":     { "visible": true,  "order": 3 }
}
```

### Xử lý cột conditional (permissions-based)

Các page dùng pattern `...(canViewPrice ? [{...}] : [])` → không ảnh hưởng gì. Hook nhận `columns` đã được build xong (sau khi permissions đã resolve), chỉ xử lý visibility/order trên đó.

### Cột `fixed: 'left'` / `fixed: 'right'`

Cột có `fixed` → mặc định `nonHideable` hoặc đặt `order` ưu tiên đầu/cuối. Đảm bảo sau khi reorder, các cột `fixed` vẫn nằm đúng vị trí (xử lý trong hook: sort fixed-left lên đầu, fixed-right xuống cuối).

### `settingsButton` placement

Mỗi page có toolbar khác nhau. Hai cách đặt button:
- **Có toolbar sẵn**: thêm button vào cuối toolbar row
- **Không có toolbar**: dùng `title` prop của Table: `<Table title={() => <div style={{textAlign:'right'}}>{settingsButton}</div>} />`

---

## Verification

Sau Phase 1:
- Render `ColumnSettings` trong Storybook hoặc một page test → kiểm tra checkbox, drag, save/load localStorage

Sau Phase 2 (mỗi page):
1. Khởi động dev server: `_start_frontend.bat`
2. Mở page → click icon cài đặt → modal hiện ra với đủ cột
3. Uncheck 2 cột → Xác nhận → cột biến mất khỏi bảng
4. Reload page → cột vẫn ẩn (persist localStorage)
5. Kéo đổi thứ tự → Xác nhận → thứ tự cột đổi đúng
6. Click "Hiện tất cả" → tất cả cột hiện lại

Sau Phase 3:
- Grep `<Table` trong codebase → đếm xem còn bao nhiêu page chưa apply hook
