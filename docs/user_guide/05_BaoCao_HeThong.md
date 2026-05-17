# HƯỚNG DẪN SỬ DỤNG - BÁO CÁO & CẤU HÌNH HỆ THỐNG

Phần này dành cho Ban Giám Đốc để xem bức tranh tổng thể của doanh nghiệp và IT/Admin để cấu hình các luồng hoạt động linh hoạt (Mẫu in, AI Agent).

## 1. Hệ Thống Báo Cáo Thông Minh (Reporting Hub)

Truy cập **Báo cáo > Trung tâm Báo cáo** (`/reports/hub`). Nam Phương ERP cung cấp các Dashboard trực quan dạng biểu đồ (Charts):

### 1.1. Báo Cáo Lợi Nhuận (PNL - Profit & Loss)
- Phân tách theo từng Pháp nhân và Từng Xưởng (`/reports/workshop-pnl`).
- Ban Giám Đốc biết ngay tháng này Xưởng nào làm có lãi, xưởng nào đang lỗ để điều chỉnh chi phí hoặc giá bán.

### 1.2. Báo Cáo Dòng Tiền (Cashflow)
- Cảnh báo dòng tiền hụt (`/reports/cashflow`). Theo dõi tiền sắp thu từ các khoản phải thu (AR) quá hạn, và tiền chuẩn bị phải chi (AP).

### 1.3. Báo Cáo Sản Xuất (Production Performance)
- Đo lường hiệu suất OEE (Overall Equipment Effectiveness) của từng máy in, máy bế.
- Báo cáo chi tiết số lượng Phế phẩm, nguyên nhân gây phế (do giấy, do máy, hay do công nhân).

---

## 2. Quản Lý Biểu Mẫu In Ấn & Excel (Print Templates)

Hệ thống cho phép bạn tự thiết kế các biểu mẫu In (PDF) như Phiếu xuất kho, Báo giá, Hợp đồng **mà không cần nhờ lập trình viên sửa code**.

**Thao tác cấu hình:**
1. Vào **Cấu hình > Mẫu In Ấn** (`/master/print-templates`).
2. Nhấn sửa một biểu mẫu (Ví dụ: *Báo Giá*).
3. Màn hình cung cấp giao diện thiết lập "Dễ sử dụng" (Easy Config):
   - Bật/tắt Logo, điều chỉnh vị trí logo (Trái/Giữa/Phải).
   - Đổi màu sắc chủ đạo của bảng.
   - Bật/tắt các trường thông tin (Tên công ty, Khách hàng, Hiển thị chi phí Bảng in, Tiền Khuôn...).
   - Kéo thả các Cột cần hiển thị trong bảng dữ liệu (STT, Mã hàng, Kích thước, Đơn giá).
   - Tuỳ chỉnh Người Ký (Thêm chữ ký Giám đốc, Kế toán, Khách hàng...).
4. Mọi thay đổi đều được **Preview (Xem trước)** ngay lập tức ở màn hình bên phải. Nhấn **[LƯU CHO PHÁP NHÂN ĐANG CHỌN]**.

> [!TIP]
> **Đa Pháp Nhân:** Bạn có thể tạo 1 mẫu In Báo giá riêng cho Công ty A, và 1 mẫu In Báo giá khác cho Công ty B (Khác Logo, Khác màu sắc, Khác chữ ký).

---

## 3. Trợ Lý AI (AI Agent)

ERP Nam Phương tích hợp AI để tối ưu hóa thời gian xử lý:
1. Vào **Trợ lý AI** (`/agent`).
2. Giao diện Chatbot xuất hiện.
3. Bạn có thể ra lệnh bằng giọng nói (Voice) hoặc gõ chữ.
   - *Ví dụ 1:* "Tìm cho tôi các báo giá của khách hàng ABC trong tháng này."
   - *Ví dụ 2:* "Tính giá thùng carton 5 lớp sóng BC kích thước 50x40x30."
4. AI sẽ trích xuất dữ liệu từ RAG (Knowledge Base) và trả về kết quả lập tức, hoặc tự động điền form Báo giá cho bạn.

---
**[KẾT THÚC TÀI LIỆU HƯỚNG DẪN]**
Cảm ơn bạn đã tin tưởng sử dụng Hệ thống Nam Phương ERP. Chúc công ty vận hành xuất sắc!
