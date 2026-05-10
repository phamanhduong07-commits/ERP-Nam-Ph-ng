# 📝 Diễn giải Kỹ thuật: Giai đoạn 1 (Quick Wins)

Tài liệu này giải thích chi tiết logic triển khai hai hạng mục ưu tiên cao nhất để tối ưu hóa hệ thống Nam Phương ERP.

---

## ⚡ 1. Tối ưu hóa Database Index

### 🔍 Vấn đề hiện tại
Hệ thống đang truy vấn dữ liệu theo kiểu "duyệt tuần tự". Khi bảng `inventory_transactions` (Nhật ký kho) đạt đến 100.000 dòng, các báo cáo tổng hợp sẽ mất từ 5-10 giây để tải, gây cảm giác hệ thống bị "treo".

### 🛠️ Giải pháp kỹ thuật
Triển khai **B-Tree Index** cho các bảng quan trọng nhất. Đây là cách "lập mục lục" cho dữ liệu.

| Bảng | Cột cần đánh Index | Mục đích |
| :--- | :--- | :--- |
| `production_logs` | `machine_id`, `created_at` | Lấy trạng thái máy mới nhất ngay lập tức. |
| `inventory_transactions` | `warehouse_id`, `product_id`, `created_at` | Tăng tốc báo cáo Nhập - Xuất - Tồn. |
| `inventory_balances` | `warehouse_id`, `product_id` | Xem số dư tồn kho hiện tại siêu tốc. |
| `sales_order_items` | `sales_order_id` | Truy xuất nhanh danh sách sản phẩm trong đơn hàng. |

**Kết quả:** Thời gian phản hồi của các API báo cáo sẽ giảm xuống còn dưới 100ms (nhanh hơn gấp 50-100 lần).

---

## 📡 2. Triển khai WebSockets cho Monitoring

### 🔄 Cơ chế hiện tại: HTTP Polling (Hỏi thăm định kỳ)
Frontend (Dashboard) cứ mỗi 60 giây lại gọi API `/monitor/machines` một lần. 
- **Độ trễ:** Thông tin bị chậm tối đa 60 giây.
- **Tải trọng:** 100 người mở Dashboard sẽ tạo ra 100 request/phút dù không có ai làm việc.

### 🚀 Cơ chế mới: WebSockets (Đẩy dữ liệu tức thì)
Thiết lập một kết nối song phương (Full-duplex) giữa Server và Client.

**Luồng hoạt động:**
1.  **Trigger:** Công nhân nhấn nút trên điện thoại báo cáo sản xuất.
2.  **Broadcast:** Backend (FastAPI) lưu dữ liệu xong sẽ phát một tín hiệu (Event) qua Socket.io: `emit("machine_update", {id: 5, status: "RUNNING"})`.
3.  **Update:** Tất cả các Dashboard đang mở sẽ nhận được tín hiệu này và cập nhật giao diện ngay lập tức mà không cần tải lại trang.

**Công nghệ sử dụng:**
- **Backend:** `fastapi-socketio` (Dựa trên nền tảng python-socketio).
- **Frontend:** `socket.io-client`.

**Kết quả:** Quản lý xưởng sẽ nhìn thấy sự thay đổi tại hiện trường theo thời gian thực (Real-time), tạo sự tin tưởng tuyệt đối vào số liệu trên hệ thống.

---
> *Tài liệu được biên soạn bởi Antigravity AI để hỗ trợ đội ngũ lập trình viên.*
