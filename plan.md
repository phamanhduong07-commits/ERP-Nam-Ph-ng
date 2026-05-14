# Plan: Hoàn thiện 5 vấn đề Module Kế Toán (Đợt 3)
Date: 2026-05-14
Status: APPROVED

## Mục tiêu
Sửa 5 bug đã xác minh: data bleed phap_nhan trong balance reports, N+1 queries trong general ledger và sổ chi tiết, thiếu DebtLedgerEntry khi duyệt phiếu trả hàng, và N+1 trong list_customer_refunds.

---

## Các bước thực thi

### Bước 1 — Thêm `phap_nhan_id` vào `_calc_balance_before`, `get_ar_balance`, `get_ap_balance` và router
- **Files**:
  - `backend/app/services/accounting_service.py` — `_calc_balance_before` line 1171; `get_ar_balance` line 1097; `get_ap_balance` line 1122
  - `backend/app/routers/accounting.py` — `/ar/balance` line 250; `/ap/balance` line 303
- **Vấn đề**: `_calc_balance_before` không có param `phap_nhan_id` → filter OB và DebtLedgerEntry không theo pháp nhân; `get_ar_balance`/`get_ap_balance` cũng không lọc DebtLedgerEntry theo pháp nhân; router không expose param này
- **Fix**:
  - Thêm `phap_nhan_id: int | None = None` vào `_calc_balance_before`; thêm filter `OpeningBalance.phap_nhan_id == phap_nhan_id` và `DebtLedgerEntry.phap_nhan_id == phap_nhan_id`
  - Thêm `phap_nhan_id` vào `get_ar_balance` + `get_ap_balance`; pass vào `_calc_balance_before` và DebtLedgerEntry query
  - Thêm `phap_nhan_id: int | None = Query(None)` vào 2 router endpoints
- **Mục tiêu**: `GET /ar/balance?phap_nhan_id=X` chỉ trả số dư đúng pháp nhân X

### Bước 2 — Loại bỏ N+1 trong `get_general_ledger` (batch TK đối ứng)
- **File**: `backend/app/services/accounting_service.py` — line 1901–1914 (vòng lặp gọi `_get_tk_doi_ung`)
- **Vấn đề**: Vòng lặp gọi `self._get_tk_doi_ung(line.entry.id, so_tk)` per line → 1 DB query per line; sổ cái 500 dòng = 500 extra queries
- **Fix**: Trước vòng lặp, collect tất cả `entry_id` từ `lines`, query 1 lần `WHERE entry_id IN (...)`, build dict `{entry_id: "tk1/tk2"}`; thay `self._get_tk_doi_ung(...)` bằng dict lookup
- **Mục tiêu**: `get_general_ledger` chỉ dùng O(1) extra queries thay vì O(N)

### Bước 3 — Sửa `get_so_chi_tiet_mua_hang`: N+1 + thêm `phap_nhan_id`
- **Files**:
  - `backend/app/services/accounting_service.py` — line 1229–1293
  - `backend/app/routers/accounting.py` — line 318–326
- **Vấn đề 1**: Line 1261: `sup = self.db.get(Sup, e.supplier_id)` trong vòng lặp → N+1 query
- **Vấn đề 2**: Không có `phap_nhan_id` filter trong DebtLedgerEntry query; không pass vào `_calc_balance_before`
- **Fix**:
  - Preload suppliers: collect `supplier_ids` từ entries, query 1 lần `WHERE id IN (...)`, build dict → thay `db.get` bằng dict lookup
  - Thêm `phap_nhan_id: int | None = None` vào service + router; thêm `DebtLedgerEntry.phap_nhan_id == phap_nhan_id` filter; pass vào `_calc_balance_before`
- **Mục tiêu**: 1 extra query thay vì N; sổ chi tiết đúng theo pháp nhân

### Bước 4 — Thêm `DebtLedgerEntry` khi duyệt/hủy phiếu trả hàng bán
- **File**: `backend/app/routers/sales_returns.py` — `approve_return` line 487; `cancel_return` line ~620
- **Vấn đề**: Khi duyệt phiếu trả hàng, bút toán kho (Dr 155/Cr 632) được tạo nhưng KHÔNG có `DebtLedgerEntry(loai="giam_no")` → số dư AR (TK 131) trong sổ công nợ sai; trong khi purchase_return.py tạo đầy đủ (line 399)
- **Fix**:
  - Trong `approve_return`: sau `return_obj.trang_thai = "da_duyet"`, thêm `DebtLedgerEntry(loai="giam_no", doi_tuong="khach_hang", chung_tu_loai="sales_return", ...)`
  - Trong `cancel_return`: trước `return_obj.trang_thai = "huy"`, xóa DebtLedgerEntry tương ứng (`chung_tu_loai="sales_return"`) để hoàn nguyên
- **Mục tiêu**: AR ledger phản ánh đúng khi hàng bán bị trả về

### Bước 5 — Loại bỏ N+1 trong `list_customer_refunds`
- **File**: `backend/app/services/accounting_service.py` — line 1638–1641
- **Vấn đề**: Vòng lặp dùng `self.db.get(Customer, v.customer_id)` + `self.db.get(SalesReturn, v.sales_return_id)` per item → 2 queries per phiếu hoàn tiền; page 20 items = 40 extra queries
- **Fix**: Collect `customer_ids` và `sales_return_ids` từ `items`; query 2 lần với `IN`; build dicts; thay `db.get` bằng dict lookup trong vòng lặp
- **Mục tiêu**: 2 extra queries cho cả page thay vì 2×N

---

## Done Criteria
- [ ] `GET /ar/balance?phap_nhan_id=1&tu_ngay=...&den_ngay=...` chỉ trả số dư pháp nhân 1
- [ ] `GET /ap/balance?phap_nhan_id=1&...` tương tự
- [ ] `GET /general-ledger?so_tk=331&...` với 500+ lines: số lượng SQL queries không tăng tuyến tính
- [ ] `GET /purchase/so-chi-tiet?phap_nhan_id=1&...` chỉ trả data pháp nhân 1; SQL queries không N+1
- [ ] Duyệt phiếu trả hàng → DebtLedgerEntry(loai="giam_no") tồn tại trong DB
- [ ] Hủy phiếu trả hàng đã duyệt → DebtLedgerEntry bị xóa
- [ ] `GET /customer-refunds` page 20 items: SQL log không có 40 extra queries
- [ ] Lint: không có error mới
- [ ] Server khởi động không lỗi

## Rủi ro
- **Bước 1**: `get_doi_chieu_cong_no` cũng gọi `_calc_balance_before` — sau khi thêm param, cần kiểm tra caller này có pass phap_nhan_id không (hoặc để mặc định None vì hàm đó lấy 1 supplier cụ thể)
- **Bước 2**: Khi `lines` rỗng → `entry_ids` rỗng → không query; cần guard `if not lines: return {...}` hoặc kiểm tra trước khi IN query
- **Bước 4**: `return_obj.tong_tien_tra` phải khác NULL; kiểm tra field name trong SalesReturn model trước khi dùng
- **Bước 5**: `sales_return_id` có thể NULL trên CustomerRefundVoucher → lọc ra trước khi query
