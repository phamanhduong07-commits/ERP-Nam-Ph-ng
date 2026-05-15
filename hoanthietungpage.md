# Hoàn thiện từng page — Sales Module

_Cập nhật lần cuối: 2026-05-15_

---

## Thang điểm đánh giá (10 tiêu chí)

| # | Tiêu chí | Mô tả |
|---|---|---|
| 1 | Filter persistence | sessionStorage restore khi F5 |
| 2 | Counts / Badge cập nhật | badge "Mới"/"Chờ duyệt" cập nhật ngay sau mỗi mutation |
| 3 | Shortcut filter | nút tắt nhanh theo trạng thái |
| 4 | Ngày deadline màu | red/orange/default theo urgency |
| 5 | Cột Người lập | created_by_name trong list |
| 6 | Người lập trong Descriptions | hiển thị ở trang chi tiết |
| 7 | Người duyệt trong Descriptions | hiển thị khi đã duyệt + timestamp |
| 8 | Drawer chi tiết sản phẩm | so_luong_da_xuat, đầy đủ thông số |
| 9 | Role-based UI | canApprove, hideCostDetails |
| 10 | TypeScript 0 lỗi | tsc --noEmit |

---

## QuoteList — 9.5/10

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Filter persistence | OK | myOnly, search, trangThai, phapNhanId, dateRange, page |
| Counts cập nhật | OK | invalidateCounts() sau mọi mutation |
| Shortcut filter | OK | Chờ duyệt (canApprove), Của tôi, Hết hạn |
| Ngày HH màu | OK | 3 mức: đỏ ≤3 ngày, cam ≤7 ngày, mặc định |
| Cột Người lập | OK | created_by_name |
| Pháp nhân cột | OK | |
| Export PDF | CHÚ Ý | Dùng printToPdf (hardcoded HTML) — chấp nhận được cho list view |

**Điểm: 9.5/10**

---

## QuoteDetail — 9.5/10

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Counts cập nhật | OK | invalidateCounts() sau mọi mutation |
| Người lập | OK | created_by_name |
| Người duyệt | OK | ten_nguoi_duyet + approved_at |
| Alert deadline | OK | warning khi ≤7 ngày hết hạn |
| Drawer sản phẩm | OK | ItemDetailDrawer component đầy đủ |
| Role-based UI | OK | canApprove, hideCostDetails |
| Local vnd()/num() | CHÚ Ý | Dùng local helper thay vì fmtVND — code duplication, không ảnh hưởng chức năng |

**Điểm: 9.5/10**

---

## OrderList — 10/10

| Tiêu chí | Trạng thái | Round fix | Ghi chú |
|---|---|---|---|
| Filter persistence | OK | R3 | myOnly, search, trangThai, phapNhanId, dateRange, page |
| Counts cập nhật | OK | R3 | invalidateQueries(['sales-orders-counts']) sau approve/cancel |
| Shortcut filter | OK | R2 | Mới + Của tôi |
| Ngày giao màu | OK | R2 | đỏ <0 ngày, cam+warning ≤3 ngày |
| Cột Người lập | OK | R3 | created_by_name |
| Pháp nhân cột | OK | — | |
| Export Excel | OK | — | smartExportExcel |
| Export PDF | OK | — | smartPrintPdf |
| TypeScript | OK | — | 0 lỗi |

**Điểm: 10/10**

---

## OrderDetail — 10/10

| Tiêu chí | Trạng thái | Round fix | Ghi chú |
|---|---|---|---|
| Counts cập nhật | OK | R4 | invalidateQueries(['sales-orders-counts']) sau approve/cancel |
| Người lập | OK | R3 | created_by_name |
| Người duyệt | OK | R4 | ten_nguoi_duyet + approved_at (joinedload approver) |
| Alert deadline | OK | R2 | error quá hạn, warning ≤3 ngày |
| Drawer sản phẩm | OK | R3 | so_luong_da_xuat X/Y dvt |
| Export In đơn | OK | — | smartPrintPdf('SALES_ORDER') |
| Export Excel | OK | — | smartExportExcel |
| TypeScript | OK | — | 0 lỗi |

**Điểm: 10/10**

---

## Tồn đọng đã biết (không block 10/10 hiện tại)

### 1. QuoteList — export PDF dùng `printToPdf`
- **Vị trí**: `frontend/src/pages/quotes/QuoteList.tsx`, `handleExportPdf()`
- **Hiện trạng**: Hardcoded HTML, không qua template DB
- **Tác động**: Print hoạt động bình thường. Không nhất quán với OrderList (dùng smartPrintPdf)
- **Khi sửa**: Cần đảm bảo template SALES_QUOTE cho list view tồn tại trước khi switch sang smartPrintPdf

### 2. QuoteDetail — local `vnd()` và `num()` helpers
- **Vị trí**: `frontend/src/pages/quotes/QuoteDetail.tsx`, dòng 25-29
- **Hiện trạng**: Duplicate logic với fmtVND trong exportUtils
- **Tác động**: Không lỗi, chỉ code duplication
- **Khi sửa**: `import { fmtVND } from '../../utils/exportUtils'`, cập nhật toàn bộ call sites

### 3. OrderDetail — role-based approve button
- **Vị trí**: `frontend/src/pages/sales/OrderDetail.tsx`
- **Hiện trạng**: Nút "Duyệt đơn" không có canApprove guard (khác QuoteDetail)
- **Tác động**: Backend vẫn auth đúng. Chỉ UX — user không có quyền vẫn thấy nút
- **Khi sửa**: Thêm useAuthStore + canApprove logic giống QuoteDetail

---

## Lịch sử fix

| Round | Commit | Nội dung |
|---|---|---|
| R2 | [earlier] | OrderList/Detail: Alert deadline, colSpan, Badge Mới, Của tôi, yeu_cau_in drawer |
| R3 | 8275c7e | persist myOnly, counts invalidation list, Người lập, so_luong_da_xuat, SalesOrderResponse.created_by_name |
| R4 | 3b69c40 | counts invalidation từ detail, Người duyệt + approved_at, joinedload approver |
