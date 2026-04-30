# Kế hoạch hoàn thiện ERP Nam Phương

> Cập nhật: 2026-04-30 | Trạng thái tổng thể: ~88% hoàn thiện

---

## Ưu tiên 1 — Lỗi cần sửa ngay

### 1.1 Menu "Giao hàng" (Bán hàng) trỏ sai đường dẫn
- **File:** `frontend/src/components/AppLayout.tsx:32`
- **Vấn đề:** Link `/sales/delivery` không tồn tại trong router, bị redirect về dashboard
- **Sửa:** Đổi thành `/warehouse/delivery` hoặc thêm route alias
- **Trạng thái:** [ ] Chưa làm

### 1.2 Dashboard hardcode số 0
- **File:** `frontend/src/pages/Dashboard.tsx:30–54`
- **Vấn đề:** 3/4 thống kê hiển thị số cố định, "Khách hàng" hardcode 763
- **Việc cần làm:**
  - [ ] Backend: thêm endpoint `GET /api/dashboard/stats` trả về:
    - `don_hang_moi_hom_nay`: COUNT sales_orders có `ngay_don = today`
    - `cho_duyet`: COUNT sales_orders + quotes có `trang_thai = 'moi'`
    - `dang_san_xuat`: COUNT production_orders có `trang_thai = 'dang_sx'`
    - `tong_khach_hang`: COUNT customers
  - [ ] Frontend: thêm `useQuery` gọi endpoint trên, hiển thị số thực

---

## Ưu tiên 2 — Tính năng còn thiếu (quan trọng với nghiệp vụ)

### 2.1 Phân quyền theo role
- **Vấn đề:** Mọi user đăng nhập đều thấy toàn bộ menu và chức năng
- **Việc cần làm:**
  - [ ] Định nghĩa các role: `admin`, `kinh_doanh`, `san_xuat`, `kho`, `ke_toan`
  - [ ] Frontend: ẩn/hiện menu theo role của user đang đăng nhập
  - [ ] Backend: kiểm tra role trong các endpoint nhạy cảm (xóa, duyệt, cấu hình)

### 2.2 Xuất Excel / In danh sách
- **Vấn đề:** Các trang danh sách không có chức năng xuất dữ liệu
- **Danh sách cần làm:**
  - [ ] Đơn hàng bán (`/sales/orders`) — xuất Excel
  - [ ] Báo giá (`/quotes`) — xuất Excel + in PDF báo giá gửi khách
  - [ ] Lệnh sản xuất (`/production/orders`) — xuất Excel
  - [ ] Tồn kho (`/warehouse/inventory`) — xuất Excel
  - [ ] Đơn mua hàng (`/purchasing/orders`) — xuất Excel
- **Gợi ý thư viện:** `xlsx` (SheetJS) cho Excel, `@react-pdf/renderer` cho PDF

### 2.3 Báo giá — In PDF gửi khách hàng
- **File:** `frontend/src/pages/quotes/QuoteDetail.tsx`
- **Việc cần làm:**
  - [ ] Thiết kế template PDF báo giá có logo, thông tin pháp nhân, bảng giá
  - [ ] Nút "In báo giá / Xuất PDF" trên QuoteDetail

---

## Ưu tiên 3 — Cải thiện UX / nhỏ nhưng đáng làm

### 3.1 Hướng dẫn nhanh trên Dashboard sai link
- **File:** `frontend/src/pages/Dashboard.tsx:77`
- **Vấn đề:** Bước "4. Xuất kho → Giao hàng" trỏ tới `/warehouse/issues` thay vì `/warehouse/delivery`
- **Sửa:** Đổi `path` thành `/warehouse/delivery`
- **Trạng thái:** [ ] Chưa làm

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
| Lỗi cần sửa ngay | 4 | 0/4 |
| Tính năng thiếu | 8 | 0/8 |
| Cải thiện UX | 4 | 0/4 |
| Kỹ thuật / production | 4 | 0/4 |
| **Tổng** | **20** | **0/20** |

---

## Ghi chú kỹ thuật

- Frontend build: luôn chạy `npm run build` trong `frontend/` sau khi sửa code (app dùng `backend/dist`)
- Backend chạy port 8000, frontend dev server port 5174
- PostgreSQL, SQLAlchemy 2.0 Mapped style, Pydantic v2
- Ant Design v5, React 18, Vite, TanStack Query
