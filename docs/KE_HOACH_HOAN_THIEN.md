# Kế hoạch hoàn thiện ERP Nam Phương

> Cập nhật: 2026-05-07 | Trạng thái tổng thể: ~96% hoàn thiện

---

## Checklist bổ sung

- [ ] Import/export toàn ERP: xem chi tiết tại `docs/IMPORT_EXPORT_CHECKLIST.md`

---

## Ưu tiên 1 — Lỗi cần sửa ngay

### 1.1 Menu "Giao hàng" (Bán hàng) trỏ sai đường dẫn ✅
- **File:** `frontend/src/components/AppLayout.tsx:32`
- **Sửa:** Đổi thành `/warehouse/delivery`
- **Trạng thái:** [x] Hoàn thành — commit `0236583`

### 1.2 Dashboard hardcode số 0 ✅
- **File:** `frontend/src/pages/Dashboard.tsx`
- **Đã làm:**
  - [x] Backend: endpoint `GET /api/dashboard/stats` — commit `0236583`
  - [x] Frontend: useQuery gọi API, refresh 60s

---

## Ưu tiên 2 — Tính năng còn thiếu (quan trọng với nghiệp vụ)

### 2.1 Phân quyền theo role ✅
- **Roles trong DB:** ADMIN, GIAM_DOC, KE_TOAN, KINH_DOANH, KHO, SAN_XUAT, MUA_HANG, CONG_NHAN
- **Đã làm:**
  - [x] Frontend: `filterByRole()` lọc menu theo `user.role`
  - [x] Menu Danh mục: chỉ ADMIN, GIAM_DOC
  - [x] Menu Bán hàng: ADMIN, GIAM_DOC, KINH_DOANH, KE_TOAN
  - [x] Menu Sản xuất: ADMIN, GIAM_DOC, SAN_XUAT, KINH_DOANH, CONG_NHAN (có lọc item con)
  - [x] Menu Kho: ADMIN, GIAM_DOC, KHO, SAN_XUAT, KE_TOAN, MUA_HANG
  - [x] Menu Mua hàng: ADMIN, GIAM_DOC, MUA_HANG, KE_TOAN
- **Còn lại:** [ ] Backend guard role cho endpoint nhạy cảm (xóa, duyệt)

### 2.2 Xuất Excel / In danh sách ✅
- **Đã có từ trước:** Đơn hàng, Báo giá, Lệnh SX — đã có Excel + PDF
- **Mới thêm:**
  - [x] Tồn kho (`/warehouse/inventory`) — xuất Excel + PDF
  - [x] Đơn mua hàng (`/purchasing/orders`) — xuất Excel + PDF

### 2.3 Báo giá — In PDF gửi khách hàng
- **File:** `frontend/src/pages/quotes/QuoteDetail.tsx`
- **Việc cần làm:**
  - [ ] Thiết kế template PDF báo giá có logo, thông tin pháp nhân, bảng giá
  - [ ] Nút "In báo giá / Xuất PDF" trên QuoteDetail

---

## Ưu tiên 3 — Cải thiện UX / nhỏ nhưng đáng làm

### 3.1 Hướng dẫn nhanh trên Dashboard sai link ✅
- **File:** `frontend/src/pages/Dashboard.tsx`
- **Trạng thái:** [x] Hoàn thành — commit `0236583`

### 3.2 Menu Sản xuất quá nhiều mục ✅
- **Đã làm:** Gom 10 mục CD2 vào sub-menu "🖨 Công đoạn 2 (CD2)"
- **Trạng thái:** [x] Hoàn thành

### 3.3 Thêm xác nhận trước khi xóa ✅ (by design)
- **Kết luận:** CustomerList, ProductList, SupplierList, UserList không có delete là **cố ý** — dùng toggle `trang_thai` thay vì xóa cứng (tránh vi phạm FK trong orders)
- Các trang có delete đều đã có `Popconfirm`
- **Trạng thái:** [x] Không cần thêm

### 3.4 Thông báo lỗi thân thiện hơn ✅
- **Đã làm:** Patch toàn bộ 60 chỗ `onError: () =>` → `onError: (e: any) =>` hiện `e?.response?.data?.detail` trên 22 file
- **Trạng thái:** [x] Hoàn thành

---

## Ưu tiên 4 — Kỹ thuật / trước khi deploy production

### 4.1 Giới hạn CORS ✅
- **Đã làm:** `ALLOWED_ORIGINS` env var trong config.py, mặc định chỉ localhost
- Production: set `ALLOWED_ORIGINS=https://erp.namphuong.com` trong `.env`
- **Trạng thái:** [x] Hoàn thành

### 4.2 Bảo mật JWT — refresh token ✅
- **Đã làm:**
  - Backend: `create_refresh_token()` (30 ngày), endpoint `POST /api/auth/refresh`
  - Backend: fix bug `pwd_context` không tồn tại trong `change-password`
  - Backend: validate `type` field để access token không dùng được làm refresh và ngược lại
  - Frontend: `client.ts` interceptor tự gọi `/auth/refresh` khi 401, retry request gốc
  - Frontend: `auth.ts` store lưu `refresh_token`, `Login.tsx` truyền đúng tham số
- **Trạng thái:** [x] Hoàn thành

### 4.3 Alembic migration ✅
- **Đã làm:** Tạo migration `09797a29e0d7_quote_phan_xuong_nv_theo_doi.py` cho các thay đổi schema gần đây
- `create_all` giữ lại cho dev, production dùng `alembic upgrade head`
- **Trạng thái:** [x] Hoàn thành

### 4.4 Logging & monitoring ✅
- **Đã làm:** HTTP request logging middleware (method, path, status, duration_ms)
- Log ghi ra console + file `backend.log` (UTF-8)
- **Trạng thái:** [x] Hoàn thành

---

## Module mới thêm 2026-05-07

### M1. Danh mục tài khoản ngân hàng ✅
- **Backend:** model `BankAccount` (master.py) + router `/api/bank-accounts`
- **Frontend:** `pages/danhmuc/BankAccountList.tsx` + route `/master/bank-accounts`
- **Menu:** Danh mục → Tài khoản ngân hàng

### M2. Sổ quỹ tiền mặt ✅
- **Backend:** endpoint `GET /api/accounting/cash-book?tu_ngay&den_ngay`
- **Frontend:** `pages/accounting/CashBookPage.tsx` + route `/accounting/cash-book`
- **Menu:** Kế toán → Sổ quỹ / Ngân hàng → Sổ quỹ tiền mặt

### M3. Sổ ngân hàng ✅
- **Backend:** endpoint `GET /api/accounting/bank-ledger?tu_ngay&den_ngay&so_tai_khoan`
- **Frontend:** `pages/accounting/BankLedgerPage.tsx` + route `/accounting/bank-ledger`
- **Menu:** Kế toán → Sổ quỹ / Ngân hàng → Sổ ngân hàng

### M4. Công cụ dụng cụ (CCDC) ✅
- **Backend:** models `NhomCCDC`, `CongCuDungCu`, `PhieuXuatCCDC`, `PhieuXuatCCDCItem` (ccdc.py)
- **Router:** `/api/ccdc` — CRUD nhóm + CCDC + phiếu xuất (tạo/duyệt/hủy)
- **Frontend:** `pages/accounting/CCDCListPage.tsx` (3 tab: Danh mục / Phiếu xuất / Nhóm)
- **Menu:** Kế toán → Công cụ dụng cụ (CCDC)

---

## Tóm tắt tiến độ

| Nhóm | Số task | Hoàn thành |
|------|---------|------------|
| Lỗi cần sửa ngay | 4 | 4/4 ✅ |
| Tính năng thiếu | 8 | 6/8 |
| Cải thiện UX | 4 | 4/4 ✅ |
| Kỹ thuật / production | 4 | 4/4 ✅ |
| Module mới (ngân hàng, quỹ, CCDC) | 4 | 4/4 ✅ |
| **Tổng** | **24** | **22/24** |

---

## Ghi chú kỹ thuật

- Frontend build: luôn chạy `npm run build` trong `frontend/` sau khi sửa code (app dùng `backend/dist`)
- Backend chạy port 8000, frontend dev server port 5174
- PostgreSQL, SQLAlchemy 2.0 Mapped style, Pydantic v2
- Ant Design v5, React 18, Vite, TanStack Query
