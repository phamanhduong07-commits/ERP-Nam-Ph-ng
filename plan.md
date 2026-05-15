# Plan: Fix 5 UI Issues — QuoteForm + QuoteList (Round 4)
Date: 2026-05-15
Status: COMPLETED

## Mục tiêu
Sửa 5 vấn đề cụ thể: rowKey không ổn định, editingIdx trỏ sai sau delete,
copy button thiếu loading, export button thiếu loading, và modal chồng nhau khi click nhanh.

## Các bước thực thi

- [x] Bước 1: QuoteForm — đổi rowKey từ "stt" sang array index
  - File: `frontend/src/pages/quotes/QuoteForm.tsx`
  - `rowKey="stt"` → `rowKey={(_, idx) => String(idx)}`

- [x] Bước 2: QuoteForm — điều chỉnh editingIdx khi xóa dòng trước dòng đang edit
  - File: `frontend/src/pages/quotes/QuoteForm.tsx` hàm `handleDeleteItem`
  - Thêm: `else if (editingIdx !== null && idx < editingIdx) setEditingIdx(editingIdx - 1)`

- [x] Bước 3: QuoteList — thêm loading state cho nút Copy trong bảng
  - File: `frontend/src/pages/quotes/QuoteList.tsx`
  - Thêm `loading={copyMutation.isPending}` vào Button

- [x] Bước 4: QuoteList — thêm loading state cho nút Xuất Excel
  - File: `frontend/src/pages/quotes/QuoteList.tsx`
  - Thêm state `const [isExporting, setIsExporting] = useState(false)`
  - Wrap `handleExportExcel` với setIsExporting(true/false) trong try/finally
  - Thêm `loading={isExporting}` + `disabled={isExporting}` vào cả 2 nút Excel và PDF

- [x] Bước 5: QuoteForm — chặn Modal.confirm chồng nhau khi click nhanh
  - File: `frontend/src/pages/quotes/QuoteForm.tsx` hàm `handleSubmit`
  - Thêm `const confirmOpenRef = useRef(false)`
  - Guard `if (confirmOpenRef.current) return` + `afterClose` reset

## Done Criteria
- [x] rowKey dùng array index thay vì stt — ổn định sau delete/reorder
- [x] Xóa dòng trước dòng đang edit → editingIdx cập nhật đúng
- [x] Click Copy → nút show loading spinner đến khi navigate
- [x] Click Xuất Excel → spinner trên nút, không thể click lại trong khi fetch
- [x] Click "Lưu" nhanh 3 lần khi editingIdx != null → chỉ 1 modal xuất hiện
- [x] TypeScript: 1 lỗi pre-existing ở PrintTemplatePage.tsx (không do chúng ta gây ra)
