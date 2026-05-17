# HƯỚNG DẪN SỬ DỤNG - KẾ TOÁN & NHÂN SỰ (ACCOUNTING & HR)

Hai phân hệ này xử lý dòng tiền (Cashflow), tính giá thành, công nợ, và tính lương cho nhân viên dựa trên các hoạt động từ Kho, Mua hàng và Sản xuất.

## 1. Phân Hệ Kế Toán (Accounting & Billing)

Kế toán không cần nhập liệu lại các nghiệp vụ mà kế thừa (inherit) dữ liệu từ Kho và Bán hàng.

### 1.1. Xuất Hóa Đơn Bán Hàng (Billing)
1. Vào **Kế toán > Hóa đơn bán hàng** (`/billing/invoices/new`).
2. Kéo dữ liệu từ **Phiếu Xuất Kho Bán Hàng** (Warehouse Issue).
3. Hệ thống tự động tính Tiền hàng + VAT + Chi phí (Vận chuyển, Khuôn, Bảng in) dựa trên Báo giá gốc.
4. Xác nhận và phát hành (Có thể in hóa đơn trực tiếp bằng Print Template).

### 1.2. Thu / Chi Tiền (Cash Receipt & Payment)
- **Phiếu Thu:** Khi khách hàng chuyển khoản, vào **Kế toán > Phiếu Thu** (`/accounting/receipts`). Chọn mục đích thu (Thu tiền đơn hàng / Thu khác). Hệ thống tự cấn trừ công nợ khách hàng (AR).
- **Phiếu Chi:** Khi trả tiền cho NCC mua giấy, vào **Phiếu Chi** (`/accounting/payments`). Cấn trừ công nợ phải trả (AP).
- **Sổ Quỹ / Sổ Tiền Gửi Ngân Hàng:** Hai sổ này tự động cộng trừ số dư sau mỗi lần lập Phiếu thu/chi.

### 1.3. Tính Giá Thành Sản Xuất (Production Costing)
Đây là nghiệp vụ khó nhất nhưng ERP đã tự động hóa:
1. Chi phí Nguyên vật liệu trực tiếp: Kéo tự động từ định mức xuất kho BOM.
2. Chi phí Nhân công trực tiếp: Kéo từ tính năng quẹt thẻ / khai báo năng suất KCS (Mobile Tracking).
3. Chi phí Phân bổ (Khấu hao, Điện nước): Cấu hình trong **Kế toán > Phân bổ chi phí** (`/accounting/workshop-management`).
=> Truy cập `/accounting/reports/production-costing` để xem giá thành thực tế của từng lệnh sản xuất.

---

## 2. Phân Hệ Nhân Sự (HR)

### 2.1. Quản lý Nhân sự & Phòng ban
- Truy cập `/hr/employees` để cập nhật hồ sơ, hợp đồng, lương cơ bản.
- Sơ đồ tổ chức được quản lý tại `/hr/departments`. Chức danh kết hợp với Phòng ban sẽ tạo ra Role (Ví dụ: Tổ trưởng Sản xuất).

### 2.2. Chấm Công & Tính Lương
```mermaid
flowchart LR
    A[Dữ liệu Quẹt vân tay] --> B[Duyệt Chấm Công]
    C[Dữ liệu Khoán / KCS Sản xuất] --> B
    B --> D[Tính Lương (Payroll)]
    D --> E[Gửi Phiếu Lương Điện Tử]
```
- **Chấm công:** Dữ liệu có thể được import từ máy chấm công. Các đơn xin nghỉ phép (Leave Approvals) được nộp qua điện thoại và duyệt trên `/hr/approvals`.
- **Bảng lương:** Truy cập `/hr/payroll`. Hệ thống sẽ tính Lương = Lương cơ bản (theo công chuẩn) + Lương khoán (Từ CD2) + Thưởng/Phạt - Tạm ứng.

### 2.3. Ma trận Phân quyền (Permission Matrix)
Đây là tính năng bảo mật then chốt.
1. Vào **Nhân sự > Ma trận phân quyền** (`/hr/permission-matrix`).
2. Màn hình hiển thị danh sách tất cả các màn hình (Modules) giao với các Nhóm quyền (Roles).
3. Đánh dấu tick (Read / Write / Delete / Approve) cho từng nhóm.
   - *Ví dụ:* NVKD không được quyền Xóa Đơn hàng, Kế toán trưởng được quyền Duyệt Giá thành.

---
*Tiếp theo: [Hướng dẫn Cấu hình Hệ thống & Báo cáo](./05_BaoCao_HeThong.md)*
