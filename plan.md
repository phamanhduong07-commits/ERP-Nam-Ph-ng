# Plan: Hoàn thiện 6 vấn đề Module Kế Toán (Đợt 2)
Date: 2026-05-14
Status: APPROVED

## Mục tiêu
Sửa 6 bug và feature gap trong module kế toán — tập trung vào tính nhất quán hủy phiếu chi, số dư thử trên bảng CĐPS, phap_nhan_id cho OpeningBalance, filter aging theo pháp nhân, và hiển thị TK đối ứng đầy đủ.

> **Lưu ý nghiệp vụ đã xác nhận:** Khi VAT = 0, hạch toán nội bộ (không có GR) KHÔNG tạo định khoản — hành vi hiện tại `_post_purchase_invoice_journal` là đúng, không sửa.

---

## Các bước thực thi

### Bước 1 — Cho phép hủy phiếu chi `da_duyet` (nhất quán với hủy phiếu thu)
- **File**: `backend/app/services/accounting_service.py` — line 670–689
- **Vấn đề**: `cancel_payment` raise HTTP 400 khi `trang_thai == "da_duyet"`; trong khi `cancel_receipt` cho phép hủy `da_duyet` bằng cách đảo ngược bút toán
- **Fix**: Bỏ dòng raise 400; thêm `if was_approved: self._reverse_journal_entries("phieu_chi", p.id)` (pattern giống `cancel_receipt`); giữ nguyên phần restore invoice + delete DebtLedgerEntry + set `trang_thai = "huy"`
- **Mục tiêu**: Kế toán có thể hủy phiếu chi đã duyệt nhầm

### Bước 2 — Thêm OpeningBalance vào `get_trial_balance` cho TK 131/331/111/112
- **File**: `backend/app/services/accounting_service.py` — line 1933–1971
- **Vấn đề**: `so_du_dau = pre_no - pre_co` không nhìn vào `OpeningBalance`; bảng CĐPS hiện `so_du_dau` = 0 cho KH/NCC/tiền sau migration AMIS
- **Fix**: Trong vòng lặp per-account, nếu `acc.so_tk` match prefix 131/331/111/112, lookup OB; điều chỉnh `base_pre` bắt từ `ob_date`; `so_du_dau = ob_amount + pre_no - pre_co`
- **Mục tiêu**: Bảng CĐPS có `so_du_dau` đúng cho tài khoản KH/NCC/tiền

### Bước 3 — Thêm OpeningBalance vào `get_trial_balance_tax`
- **File**: `backend/app/services/accounting_service.py` — line 2488–2551
- **Vấn đề**: Cùng vấn đề như Bước 2; bảng CĐPS thuế/BCTC không bao gồm OB
- **Fix**: Cùng pattern: lookup OB per account khi prefix match; adjust pre-period query start; `so_du_dau = ob_amount + pre_no - pre_co`
- **Mục tiêu**: Bảng CĐPS dùng cho kê khai thuế có số dư đầu kỳ đúng

### Bước 4 — Thêm `phap_nhan_id` vào `OpeningBalanceCreate` schema + service
- **Files**:
  - `backend/app/schemas/accounting.py` — line 272–278 (class `OpeningBalanceCreate`)
  - `backend/app/services/accounting_service.py` — line 1152–1165 (method `create_opening_balance`)
- **Vấn đề**: Schema không có field `phap_nhan_id`; service không pass nó khi create; mọi OB tạo qua `POST /opening-balances` đều có `phap_nhan_id = NULL` → filter multi-entity không hoạt động
- **Fix**:
  - Thêm `phap_nhan_id: int | None = None` vào `OpeningBalanceCreate`
  - Thêm `phap_nhan_id=data.phap_nhan_id` vào constructor `OpeningBalance(...)`
- **Mục tiêu**: OB gắn với đúng pháp nhân; filter hoạt động trong GL/CĐKT

### Bước 5 — Thêm `phap_nhan_id` filter vào `get_ar_aging` và `get_ap_aging`
- **Files**:
  - `backend/app/services/accounting_service.py` — `get_ar_aging` line 771; `get_ap_aging` line 1046
  - `backend/app/routers/accounting.py` — `/ar/aging` line 240; `/ap/aging` line 292
- **Vấn đề**: Báo cáo tuổi nợ mix data từ tất cả pháp nhân; không có parameter lọc theo entity
- **Fix**:
  - Thêm `phap_nhan_id: int | None = None` vào signature service; thêm filter khi provided
  - Thêm `phap_nhan_id: int | None = Query(None)` vào router và truyền xuống service
- **Mục tiêu**: `GET /ar/aging?phap_nhan_id=X` chỉ trả về aging cho pháp nhân X

### Bước 6 — Sửa `_get_tk_doi_ung` hiển thị đầy đủ TK đối ứng
- **File**: `backend/app/services/accounting_service.py` — line 1926–1931
- **Vấn đề**: `.first()` chỉ lấy một TK đối ứng; bút toán phức tạp (Dr 152 + Dr 1331 / Cr 331) hiển thị "331" thay vì "1331/331" trong sổ cái
- **Fix**: Thay `.first()` bằng `.all()`; collect tất cả TK đối ứng distinct; join với "/"
- **Mục tiêu**: Sổ cái hiển thị TK đối ứng đầy đủ (e.g. "1331/331")

---

## Done Criteria
- [ ] `PATCH /payments/{id}/cancel` thành công khi payment ở `da_duyet`; journal entry đảo ngược
- [ ] `GET /trial-balance?tu_ngay=...` trả về `so_du_dau` ≠ 0 cho TK 131 khi đã có OB
- [ ] `GET /reports/trial-balance-tax?tu_ngay=...` tương tự có `so_du_dau` đúng cho TK 131
- [ ] `POST /opening-balances` với `phap_nhan_id` → OB lưu đúng pháp nhân vào DB
- [ ] `GET /ar/aging?phap_nhan_id=1` chỉ trả về data của pháp nhân 1
- [ ] `GET /general-ledger?so_tk=331` bút toán phức tạp hiển thị `tk_doi_ung` đầy đủ
- [ ] Lint: không có error mới
- [ ] Server khởi động không lỗi

## Rủi ro
- **Bước 1**: Khi payment `da_duyet` bị hủy, `DebtLedgerEntry` cần được xóa (không add reversing entry, giống pattern hiện tại của cancel_payment non-approved)
- **Bước 2 + 3**: Tránh double-count — `base_pre` phải bắt từ `ob_date`, không phải epoch
- **Bước 5**: `get_ar_aging` dùng `DebtLedgerEntry.customer_id` aggregation — cần thêm phap_nhan filter cho cả phần credits và reversals
