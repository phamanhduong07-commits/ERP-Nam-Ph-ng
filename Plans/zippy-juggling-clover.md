# Plan: Mở rộng Ctrl+N / Ctrl+S toàn bộ trang list

## Context

Hệ thống keyboard shortcuts đã có nền tảng (`HotkeyContext`, `useHotkey`, `ALL_HOTKEYS`).  
Hiện chỉ **CustomerList** implement Ctrl+N/Ctrl+S. Còn **52 trang list** có nút "Thêm mới" chưa có shortcut.  
Mục tiêu: nhân viên nhấn Ctrl+N để mở form tạo mới trên bất kỳ trang nào, không cần chuột.

## Exploration findings

- **53 trang** tổng cộng có nút Thêm mới
- Pattern tên hàm: `openCreate` (40 file), `setModalOpen` (8), `setCreateOpen` (5), `navigate(...)` (1)
- Pattern save: hầu hết dùng `handleSave` + `modalOpen` — giống CustomerList
- `useHotkey` đã import sẵn trong `hooks/useHotkey.ts`, không cần cài thêm gì

## Pattern chuẩn (copy từ CustomerList)

```typescript
// Thêm import (nếu chưa có)
import { useHotkey } from '../../hooks/useHotkey'

// Sau khi khai báo openCreate và handleSave:
useHotkey('ctrl+n', openCreate, 'Thêm [tên resource] mới')
useHotkey('ctrl+s', handleSave, 'Lưu [tên resource]', 'Trang hiện tại', modalOpen)
```

## Danh sách file cần sửa

### Nhóm 1 — Nghiệp vụ hàng ngày (ưu tiên cao)

| File | Ctrl+N | Ctrl+S enabled khi |
|------|--------|--------------------|
| `pages/danhmuc/SupplierList.tsx` | `openCreate` | `modalOpen` |
| `pages/sales/OrderList.tsx` | `() => navigate('/sales/orders/new')` | *(không có modal save)* |
| `pages/accounting/CashReceiptListPage.tsx` | `openCreate` | `modalOpen` |
| `pages/accounting/CashPaymentListPage.tsx` | `openCreate` | `modalOpen` |
| `pages/accounting/JournalEntryListPage.tsx` | `openCreate` | `modalOpen` |
| `pages/purchasing/NhapGiayPage.tsx` | `openCreate` | `modalOpen` |
| `pages/purchasing/MuaGiayPage.tsx` | `openCreate` | `modalOpen` |
| `pages/purchasing/MuaNVLPage.tsx` | `openCreate` | `modalOpen` |
| `pages/purchasing/GoodsReceiptPage.tsx` | `openCreate` | `modalOpen` |
| `pages/hr/EmployeeListPage.tsx` | `openCreate` | `modalOpen` |

### Nhóm 2 — Danh mục (master data thường xuyên chỉnh sửa)

| File | Ctrl+N | Ctrl+S enabled khi |
|------|--------|--------------------|
| `pages/danhmuc/ProductList.tsx` | `openCreate` | `modalOpen` |
| `pages/danhmuc/WarehouseList.tsx` | `openCreate` | `modalOpen` |
| `pages/danhmuc/PaperMaterialList.tsx` | `openCreate` | `modalOpen` |
| `pages/danhmuc/OtherMaterialList.tsx` | `openCreate` | `modalOpen` |
| `pages/danhmuc/MaterialGroupList.tsx` | `openCreate` | `modalOpen` |
| `pages/danhmuc/UserList.tsx` | `openCreate` | `open` *(tên state khác)* |
| `pages/danhmuc/BankAccountList.tsx` | `openCreate` | `modalOpen` |
| `pages/danhmuc/DvtList.tsx` | `openCreate` | `modalOpen` |
| `pages/danhmuc/PhanXuongList.tsx` | `openCreate` | `modalOpen` |
| `pages/danhmuc/ViTriList.tsx` | `openCreate` | `modalOpen` |

### Nhóm 3 — Danh mục phụ (ít dùng hơn nhưng vẫn có giá trị)

| File | Ctrl+N |
|------|--------|
| `pages/danhmuc/TinhThanhList.tsx` | `openCreate` |
| `pages/danhmuc/PhuongXaList.tsx` | `openCreate` |
| `pages/danhmuc/NganHangList.tsx` | `openCreate` |
| `pages/danhmuc/LoaiTienList.tsx` | `openCreate` |
| `pages/danhmuc/XeList.tsx` | `openCreate` |
| `pages/danhmuc/TaiXeList.tsx` | `openCreate` |
| `pages/danhmuc/LoXeList.tsx` | `openCreate` |
| `pages/danhmuc/KhoanMucChiPhiList.tsx` | `openCreate` |
| `pages/danhmuc/MucThuChiList.tsx` | `openCreate` |
| `pages/danhmuc/DieuKhoanThanhToanList.tsx` | `openCreate` |
| `pages/danhmuc/NhomDoiTuongList.tsx` | `openCreate` |
| `pages/danhmuc/NhapPhoiNgoaiPage.tsx` | `openCreate` |
| `pages/danhmuc/TemPaperPriceList.tsx` | `openCreate` |
| `pages/danhmuc/KyHieuChamCongList.tsx` | `openCreate` |
| `pages/danhmuc/LoaiTaisanCoDinhList.tsx` | `openCreate` |
| `pages/danhmuc/CauTrucList.tsx` | `openCreate` |
| `pages/danhmuc/TieuChuanKyThuatList.tsx` | `openCreate` |
| `pages/danhmuc/DepartmentPage.tsx` | `openCreate` |
| `pages/danhmuc/ChartOfAccountsPage.tsx` | `openCreate` |
| `pages/danhmuc/OffsetAddonPriceList.tsx` | `openCreate` |

## Edge cases

**UserList.tsx** — modal state tên là `open` (không phải `modalOpen`):
```typescript
useHotkey('ctrl+s', handleSave, 'Lưu tài khoản', 'Trang hiện tại', open)
```

**OrderList.tsx** — không có inline modal, Ctrl+N navigate đến trang tạo mới:
```typescript
useHotkey('ctrl+n', () => navigate('/sales/orders/new'), 'Tạo đơn hàng mới')
// Ctrl+S không áp dụng
```

**setCreateOpen pages** (FixedAssetPage, QCListPage, YMHListPage...):
```typescript
useHotkey('ctrl+n', () => setCreateOpen(true), 'Thêm mới')
```

## Files KHÔNG sửa

- Pages có suffix `Form`, `Detail`, `Card` — không phải list page
- `WorkshopManagement`, `CD2KanbanPage` — complex state, cần verify riêng
- Pages production/manufacturing phức tạp — để sprint sau

## ALL_HOTKEYS

Không cần sửa — entry `ctrl+n` và `ctrl+s` đã là generic, áp dụng cho toàn bộ trang list.

## Verification

```powershell
# 1. TypeScript check
cd frontend; npx tsc --noEmit

# 2. Build
npx vite build

# 3. Deploy
"" | Out-File "D:\NAM_PHUONG_SOFTWARE\.deploying" -Encoding utf8
Start-Process powershell -Verb RunAs -ArgumentList "-Command sc.exe stop NamPhuong-ERP; Start-Sleep 4; sc.exe start NamPhuong-ERP" -Wait
Start-Sleep 12
Remove-Item "D:\NAM_PHUONG_SOFTWARE\.deploying" -ErrorAction SilentlyContinue

# 4. Health check
Invoke-WebRequest -Uri "http://localhost:8001/api/health" -UseBasicParsing | Select StatusCode
```

Sau khi deploy: mở SupplierList, nhấn Ctrl+N → modal tạo nhà cung cấp mở ra.
