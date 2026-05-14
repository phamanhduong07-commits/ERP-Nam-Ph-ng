# Plan: Hoàn thiện 7 vấn đề Module Kế Toán
Date: 2026-05-14
Status: APPROVED

## Mục tiêu
Sửa 7 bug và feature gap trong module kế toán (backend accounting router + service, không động đến HR hay các module khác).

---

## Các bước thực thi

### Bước 1 — Xoá duplicate endpoint `GET /fixed-assets`
- **File**: `backend/app/routers/accounting.py` — dòng 1194–1202
- **Vấn đề**: Python reassign tên hàm → FastAPI dùng bản thứ 2 (line 1194), bỏ filter `trang_thai` và đổi auth thành admin-only
- **Fix**: Xoá toàn bộ block `@router.get("/fixed-assets")` thứ 2 (lines 1194–1202); giữ nguyên bản đúng ở line 1152
- **Mục tiêu**: Endpoint `/fixed-assets` hoạt động với `trang_thai` filter và auth user thường

### Bước 2 — Thêm Pydantic schema cho `POST /journal-entries`
- **File**: `backend/app/schemas/accounting.py` + `backend/app/routers/accounting.py` line 1104
- **Vấn đề**: `data: dict` không validate → KeyError crash khi thiếu field
- **Fix**:
  - Thêm `ManualJournalLineIn` + `ManualJournalEntryCreate` vào schemas.py
  - Thay `data: dict` → `data: ManualJournalEntryCreate` trong router
- **Mục tiêu**: POST /journal-entries trả về 422 Unprocessable Entity khi thiếu field bắt buộc

### Bước 3 — Xoá dead code `get_ar_balance` tại line 771
- **File**: `backend/app/services/accounting_service.py` — dòng 771–800
- **Vấn đề**: Định nghĩa bị override bởi bản đúng ở line 1128; bản line 771 gọi `_calc_balance_before("131", tu_ngay, customer_id=customer_id)` sai signature
- **Fix**: Xoá toàn bộ method definition tại lines 771–800
- **Mục tiêu**: Không còn dead code gây nhầm lẫn

### Bước 4 — Thêm `trang_thai` filter vào service `list_fixed_assets`
- **File**: `backend/app/services/accounting_service.py` — dòng 2273–2279
- **Vấn đề**: Router truyền `trang_thai` query param (sau bước 1) nhưng service method không nhận
- **Fix**: Thêm `trang_thai: str | None = None` vào signature service method; áp dụng filter nếu có
- **Mục tiêu**: Filter TSCĐ theo trạng thái (dang_su_dung / da_kh_het / thanh_ly) hoạt động end-to-end

### Bước 5 — Thêm AMIS opening balance vào `get_bank_ledger`
- **File**: `backend/app/services/accounting_service.py` — dòng 1564–1579
- **Vấn đề**: `so_du_dau` tính từ đầu thời gian, không dùng `OpeningBalance` — không nhất quán với cash book; ngân hàng chưa có `doi_tuong="ngan_hang"` trong OB
- **Fix**:
  - Thêm OB lookup `doi_tuong="ngan_hang"` vào `get_bank_ledger` (giống pattern cash book)
  - Cập nhật import router (`POST /opening-balances/cash`) để hỗ trợ nhập OB ngân hàng (doi_tuong="ngan_hang") hoặc thêm field `so_tai_khoan` trong query OB
- **Mục tiêu**: Số dư đầu kỳ sổ ngân hàng chính xác từ ngày mở sổ AMIS

### Bước 6 — Bổ sung OpeningBalance vào `get_general_ledger`
- **File**: `backend/app/services/accounting_service.py` — dòng 1852–1862
- **Vấn đề**: `so_du_dau = pre_no - pre_co` chỉ tổng hợp bút toán, bỏ qua số dư đầu kỳ AMIS cho TK 131 (KH) và 331 (NCC)
- **Fix**: Sau khi tính `pre_no - pre_co`, thêm lookup `OpeningBalance` cho TK prefix 131/331/111/112; cộng `ob.so_du_dau_ky` vào `so_du_dau` nếu `ob.ky_mo_so < tu_ngay`
- **Mục tiêu**: Sổ cái TK 131/331 có số dư mở đúng sau migration AMIS

### Bước 7 — Bổ sung OpeningBalance vào `get_balance_sheet`
- **File**: `backend/app/services/accounting_service.py` — dòng 2030–2047 (hàm `_get_balance`)
- **Vấn đề**: Bảng CĐKT tổng hợp từ JournalEntryLines không có OB → TK 131/331/111/112 bị sai khi mới migrate
- **Fix**: Trong `_get_balance(tk_prefix)`, với prefix "131"/"331"/"11", tổng hợp thêm `SUM(OpeningBalance.so_du_dau_ky)` filter theo `phap_nhan_id` và `ky_mo_so <= ngay`; cộng vào `no` hoặc `co` tương ứng
- **Mục tiêu**: Bảng CĐKT phản ánh đúng số dư kể cả tài sản/nợ từ kỳ AMIS

---

## Done Criteria
- [ ] GET /fixed-assets trả về đúng list theo `trang_thai` filter (kiểm tra bằng curl)
- [ ] POST /journal-entries với body thiếu `lines` trả về HTTP 422
- [ ] Không còn định nghĩa `get_ar_balance` thứ 2 tại line 771 (grep confirm)
- [ ] GET /fixed-assets?trang_thai=da_kh_het chỉ trả về TSCĐ đã khấu hao hết
- [ ] GET /bank-ledger trả về `so_du_dau` khác 0 khi đã nhập OB ngân hàng
- [ ] GET /general-ledger?so_tk=131 có `so_du_dau` bao gồm OB AMIS
- [ ] GET /balance-sheet?ngay=... có `phai_thu_khach_hang` bao gồm OB AMIS
- [ ] Lint: không có error mới
- [ ] Server khởi động không lỗi

## Rủi ro
- **Bước 5 + 6 + 7**: Nếu `doi_tuong` value không khớp với data đã nhập trong DB → OB không được cộng. Cần kiểm tra giá trị `doi_tuong` trong bảng `opening_balances` trước khi fix.
- **Bước 6 + 7**: Tránh double-count — OB chỉ cộng một lần (dùng MAX ky_mo_so < ngày bắt đầu, không SUM toàn bộ lịch sử).
- **Bước 2**: Phải import schema mới vào router — tránh circular import.
