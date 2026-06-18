# Plan: Tách Thu Chi theo phương thức thanh toán

## Context

Hiện tại ERP có 2 page riêng lẻ: **Phiếu thu** và **Phiếu chi**, mỗi trang liệt kê cả tiền mặt lẫn ngân hàng lẫn bù trừ. Kế toán tiền mặt và kế toán ngân hàng phải lọc thủ công mỗi lần vào.

Yêu cầu: Tổ chức lại thành 2 trang theo phương thức thanh toán:
- **Tiền mặt**: gồm cả thu + chi có `hinh_thuc_tt ∈ {TM, tien_mat}`
- **Ngân hàng**: gồm cả thu + chi có `hinh_thuc_tt ∈ {CK, chuyen_khoan}`
- **Bù trừ công nợ / Khác**: thuộc module mua/bán, không nằm ở đây
- Thay hoàn toàn trang cũ, không giữ lại song song

---

## Thay đổi cần thực hiện

### 1. Backend — `backend/app/routers/accounting.py`

Thêm query param `hinh_thuc_tt: Optional[str] = None` vào 2 endpoint:
- `list_receipts()` — thêm filter `if hinh_thuc_tt: query = query.filter(CashReceipt.hinh_thuc_tt.in_(...))`
- `list_payments()` — tương tự

Logic filter: chuẩn hóa input:
- `tien_mat` hoặc `TM` → filter `hinh_thuc_tt IN ('TM', 'tien_mat')`
- `chuyen_khoan` hoặc `CK` → filter `hinh_thuc_tt IN ('CK', 'chuyen_khoan')`
- Không truyền → không filter (giữ nguyên hành vi cũ)

---

### 2. Frontend — 2 trang mới

#### `frontend/src/pages/accounting/TienMatPage.tsx` (NEW)

```
Layout:
  PageLayout title="Quỹ Tiền Mặt"
  Tabs: [Thu tiền mặt] | [Chi tiền mặt]
  Bộ lọc chung (dùng lại pattern từ CashReceiptListPage):
    - RangePicker ngày
    - Select trạng thái
    - Select pháp nhân
    - Select xưởng
  Tab Thu: table receipts, query với hinh_thuc_tt='TM'
    - Columns: STT, Ngày, Số CT, Đối tượng (KH), Diễn giải, Số tiền, Pháp nhân, Xưởng, Trạng thái
    - Bỏ cột "Số TK NH" (không dùng cho tiền mặt)
  Tab Chi: table payments, query với hinh_thuc_tt='TM'
    - Columns tương tự, Đối tượng là NCC
    - Bỏ cột "Số TK NH"
  Nút tạo mới:
    - Tab Thu đang active → navigate('/accounting/receipts/new?hinh_thuc=tien_mat')
    - Tab Chi đang active → navigate('/accounting/payments/new?hinh_thuc=tien_mat')
```

#### `frontend/src/pages/accounting/NganHangPage.tsx` (NEW)

Giống TienMatPage, nhưng:
- Title: "Ngân Hàng"
- Query với `hinh_thuc_tt='CK'`
- **Giữ lại** cột "Số TK NH" và thêm cột "Số tham chiếu" (`so_tham_chieu`)
- Nút tạo mới → `?hinh_thuc=chuyen_khoan`

---

### 3. Frontend — `frontend/src/App.tsx`

- **Thêm** import và routes:
  ```
  /accounting/tien-mat  → TienMatPage
  /accounting/ngan-hang → NganHangPage
  ```
- **Giữ nguyên** routes cũ `/accounting/receipts` và `/accounting/payments` (form tạo/sửa vẫn dùng)
- **Xóa** routes list cũ:
  - `/accounting/receipts` (list) → redirect về `/accounting/tien-mat`
  - `/accounting/payments` (list) → redirect về `/accounting/tien-mat`

  Thực tế: route cũ chỉ xóa phần `element={<CashReceiptListPage />}` và thay bằng `<Navigate to="/accounting/tien-mat" />`.

---

### 4. Frontend — `frontend/src/components/AppLayout.tsx`

Trong section "Quỹ & Ngân hàng" (dòng ~175-186), thay:
```
- Phiếu thu → /accounting/receipts
- Phiếu chi → /accounting/payments
```
Thành:
```
- Tiền mặt  → /accounting/tien-mat
- Ngân hàng → /accounting/ngan-hang
```

---

### 5. Forms — pre-fill hinh_thuc_tt (nhỏ)

Đọc URL param `?hinh_thuc=tien_mat|chuyen_khoan` trong:
- `CashReceiptForm.tsx`: `useSearchParams()` → set initial value của field `hinh_thuc_tt`
- `CashPaymentForm.tsx`: tương tự

Hiện tại cả 2 form đều default `chuyen_khoan` — chỉ cần ghi đè initial value nếu param tồn tại.

---

## Files bị thay đổi

| File | Loại thay đổi |
|------|--------------|
| `backend/app/routers/accounting.py` | Thêm filter param (2 hàm) |
| `frontend/src/pages/accounting/TienMatPage.tsx` | TẠO MỚI |
| `frontend/src/pages/accounting/NganHangPage.tsx` | TẠO MỚI |
| `frontend/src/App.tsx` | Thêm import + routes + redirect |
| `frontend/src/components/AppLayout.tsx` | Đổi menu item |
| `frontend/src/pages/accounting/CashReceiptForm.tsx` | Đọc URL param (nhỏ) |
| `frontend/src/pages/accounting/CashPaymentForm.tsx` | Đọc URL param (nhỏ) |

**Không thay đổi:** `api/accounting.ts` (đã dùng `Record<string, unknown>` nên không cần sửa), CashReceiptListPage/CashPaymentListPage vẫn tồn tại (chỉ bỏ route list, giữ để form detail dùng).

---

## Verification

1. Vào `/accounting/tien-mat` → chỉ hiện giao dịch TM, tab Thu/Chi hoạt động
2. Vào `/accounting/ngan-hang` → chỉ hiện giao dịch CK, có cột Số TK NH
3. Click "Tạo phiếu thu" từ trang Tiền mặt → form mở với `hinh_thuc_tt = tien_mat`
4. URL cũ `/accounting/receipts` → redirect về `/accounting/tien-mat`
5. Sidebar menu hiển thị "Tiền mặt" và "Ngân hàng" thay cho "Phiếu thu"/"Phiếu chi"
