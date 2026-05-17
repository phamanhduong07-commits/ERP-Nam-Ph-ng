# KẾ HOẠCH BUILD WEB DOCUMENT (VITEPRESS)

## Mục tiêu
Chuyển đổi thư mục `docs/user_guide/` thành trang web hướng dẫn hoàn chỉnh, đẹp và chuyên nghiệp.

## PHASE 1: Thiết lập Hệ thống
- [x] Cài đặt VitePress & Vue.
- [x] Cấu hình giao diện cơ bản (Sidebar, Search).
- [ ] Chuyển `00_TrangChu.md` thành `index.md`.

## PHASE 2: Hoàn thiện Nội dung (5 Chặng Nghiệp vụ)

### Chặng 1: Module Bán Hàng & Báo Giá (Sales)
- **Thư mục:** `docs/user_guide/01_sales/`
- **Nội dung chi tiết:**
  - `01_tao_khach_hang_moi.md`: Quản lý tệp KH, mã số thuế, hạn mức.
  - `02_lap_bao_gia_thung_carton.md`: Công thức tính m2, chọn sóng, biên độ lợi nhuận.
  - `03_chuyen_doi_so_va_giao_hang.md`: Chốt đơn SO, theo dõi giao hàng, trả hàng.

### Chặng 2: Module Mua Hàng & Kho (Warehouse & Purchasing)
- **Thư mục:** `docs/user_guide/02_kho_mua_hang/`
- **Nội dung chi tiết:**
  - `01_du_bao_va_len_po.md`: Logic MRP, dự báo thiếu hụt giấy/vật tư.
  - `02_nhap_kho_va_xuat_kho.md`: Quy trình nhập mua, xuất SX, dùng barcode.
  - `03_the_kho_va_kiem_ke.md`: Truy vết lịch sử nhập xuất, xử lý lệch tồn.

### Chặng 3: Module Sản Xuất (Production & CD2)
- **Thư mục:** `docs/user_guide/03_san_xuat/`
- **Nội dung chi tiết:** Kéo thẻ Kanban, Đăng nhập máy KCS, Khai báo phế phẩm, Theo dõi hiệu suất máy (OEE).

### Chặng 4: Module Kế Toán & Nhân Sự (Accounting & HR)
- **Nội dung chi tiết:** Phân tách nghiệp vụ Tính giá thành, Thu/Chi, Tính lương sản phẩm, Quản lý phép.

### Chặng 5: Module Quản Trị & Báo Cáo (Admin)
- **Nội dung chi tiết:** Cách dùng Print Template kéo thả, Phân quyền hệ thống, Đọc báo cáo PNL xưởng.

---
*Định nghĩa DONE cho Chặng 1: Có thư mục 01_sales với ít nhất 3 file nghiệp vụ cực kỳ chi tiết, đọc như một cuốn sách hướng dẫn cầm tay chỉ việc.*
