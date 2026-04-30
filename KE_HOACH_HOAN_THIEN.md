# Kế hoạch hoàn thiện ERP Nam Phương

> Cập nhật: 2026-04-30 | Trạng thái tổng thể: ~90% hoàn thiện

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

### 3.2 Menu Sản xuất quá nhiều mục (15 items)
- **File:** `frontend/src/components/AppLayout.tsx`
- **Đề xuất:** Nhóm lại:
  - "Công đoạn 2 (CD2)" → sub-menu riêng chứa: Dashboard CD2, Kanban, Queue, Scan, Lịch sử, Định hình, Kanban sau in, Ca, Cấu hình
- **Trạng thái:** [ ] Chưa làm

### 3.3 Thêm xác nhận trước khi xóa / hủy
- **Vấn đề:** Một số trang chưa có modal xác nhận khi xóa bản ghi quan trọng
- **Kiểm tra lại:** danh mục khách hàng, nhà cung cấp, sản phẩm
- **Trạng thái:** [ ] Cần kiểm tra

### 3.4 Thông báo lỗi thân thiện hơn
- **Vấn đề:** Khi backend trả lỗi 400/500, một số trang chỉ hiện lỗi kỹ thuật
- **Đề xuất:** Chuẩn hóa hiển thị lỗi từ axios interceptor → `message.error(...)` của Ant Design
- **Trạng thái:** [ ] Cần kiểm tra

---

## Ưu tiên 4 — Kỹ thuật / trước khi deploy production

### 4.1 Giới hạn CORS
- **File:** `backend/app/main.py:37`
- **Vấn đề:** `allow_origins: ["*"]` — bảo mật kém
- **Sửa:** Đổi thành domain thực tế của server production
- **Trạng thái:** [ ] Chưa làm

### 4.2 Bảo mật JWT — thêm refresh token
- **Vấn đề:** Hiện tại chỉ có access token, hết hạn là bị logout ngay
- **Đề xuất:** Thêm refresh token endpoint để tự gia hạn session
- **Trạng thái:** [ ] Chưa làm

### 4.3 Migration thay vì `create_all`
- **File:** `backend/app/main.py:20`
- **Vấn đề:** `Base.metadata.create_all()` chạy mỗi lần khởi động, không kiểm soát schema version
- **Đề xuất:** Dùng Alembic migration trước khi deploy production thực sự
- **Trạng thái:** [ ] Chưa làm

### 4.4 Logging & monitoring
- **Vấn đề:** Chưa có structured logging, không theo dõi được lỗi production
- **Đề xuất:** Thêm Python `logging` với format JSON, hoặc tích hợp Sentry
- **Trạng thái:** [ ] Chưa làm

---

## Tóm tắt tiến độ

| Nhóm | Số task | Hoàn thành |
|------|---------|------------|
| Lỗi cần sửa ngay | 4 | 4/4 ✅ |
| Tính năng thiếu | 8 | 6/8 |
| Cải thiện UX | 4 | 1/4 |
| Kỹ thuật / production | 4 | 0/4 |
| **Tổng** | **20** | **5/20** |

---

## Ghi chú kỹ thuật

- Frontend build: luôn chạy `npm run build` trong `frontend/` sau khi sửa code (app dùng `backend/dist`)
- Backend chạy port 8000, frontend dev server port 5174
- PostgreSQL, SQLAlchemy 2.0 Mapped style, Pydantic v2
- Ant Design v5, React 18, Vite, TanStack Query
