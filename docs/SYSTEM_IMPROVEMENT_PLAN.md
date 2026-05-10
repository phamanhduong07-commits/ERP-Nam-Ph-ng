# 🚀 Kế hoạch Cải tiến Toàn diện Hệ thống Nam Phương ERP (System Improvement Plan)

Dựa trên hiện trạng kiến trúc và nhu cầu mở rộng trong tương lai, dưới đây là lộ trình cải tiến hệ thống nhằm nâng cao **hiệu năng**, **độ ổn định**, và **trải nghiệm người dùng**.

---

## 🏗️ 1. Tối ưu Hiệu suất & Kiến trúc (Performance & Architecture)

Hệ thống hiện tại xử lý đồng bộ (synchronous) nhiều tác vụ nặng. Khi lượng dữ liệu (đơn hàng, nhật ký kho) tăng lên, cần các giải pháp sau:

*   **Xử lý Bất đồng bộ (Async Background Jobs):** 
    *   **Vấn đề:** Việc Import Excel hàng ngàn dòng (Đơn hàng, Tồn kho) hoặc tính toán lại giá vốn đang block request.
    *   **Giải pháp:** Tích hợp **Celery** hoặc **FastAPI BackgroundTasks** kết hợp với Redis để xử lý ngầm. Người dùng sẽ nhận được thông báo khi hoàn tất thay vì phải chờ màn hình loading.
*   **Tối ưu Cơ sở dữ liệu (Database Tuning):**
    *   **Giải pháp:** Rà soát và thêm **Index** cho các cột thường xuyên truy vấn (ví dụ: `production_order_id`, `warehouse_id`, `created_at` trong các bảng `inventory_transactions` và `production_logs`).
    *   **Database Engine:** Loại bỏ hoàn toàn SQLite (ngay cả ở local) để đồng nhất môi trường với Production (PostgreSQL), tận dụng triệt để JSONB và các hàm tối ưu của Postgres.
*   **Caching Strategy:**
    *   Sử dụng **Redis** để cache các dữ liệu ít thay đổi (Danh mục sản phẩm, Khách hàng, Cấu trúc xưởng) nhằm giảm tải cho DB.

---

## 📱 2. Nâng cấp Trải nghiệm Người dùng & Vận hành (UI/UX)

Đặc biệt tập trung vào môi trường sản xuất (xưởng) và thao tác của người dùng cuối.

*   **Offline-First cho Mobile Tracking:**
    *   **Vấn đề:** Mạng Wi-Fi tại xưởng có thể không ổn định, gây gián đoạn việc quét QR hoặc báo cáo sản lượng.
    *   **Giải pháp:** Chuyển đổi giao diện Mobile thành **PWA (Progressive Web App)** hoặc dùng React Native. Cho phép lưu log offline (nhấn Start/Stop khi mất mạng) và tự động đồng bộ (sync) lên server khi có mạng lại.
*   **Real-time Dashboard (WebSockets):**
    *   **Vấn đề:** Màn hình giám sát máy (Monitor) hiện tại đang dùng cơ chế Polling (gọi API liên tục mỗi 60s).
    *   **Giải pháp:** Chuyển sang **WebSockets (FastAPI + Socket.io)**. Khi công nhân nhấn "Bắt đầu" trên điện thoại, Dashboard trên phòng giám đốc sẽ lập tức nhấp nháy xanh mà không có độ trễ.
*   **Tối ưu Form nhập liệu phức tạp:**
    *   Chuyển đổi các form dài (như Tạo đơn hàng, Phiếu nhập kho nhiều dòng) sang sử dụng `react-hook-form` để giảm thiểu re-render của React, giúp giao diện mượt mà hơn khi nhập liệu số lượng lớn.

---

## 🛠️ 3. Chất lượng Code & Trải nghiệm Phát triển (Code Quality & DX)

Để đội ngũ có thể cùng phát triển dễ dàng và ít sinh ra bug (lỗi) ngầm.

*   **Tự động tạo Type (Type generation):**
    *   Sử dụng OpenAPI/Swagger của FastAPI để tự động sinh ra các file TypeScript interface cho Frontend. Đảm bảo Backend đổi tên trường gì thì Frontend sẽ báo lỗi ngay lập tức lúc build.
*   **Kiểm thử tự động (Automated Testing):**
    *   Bổ sung Unit Test (với `pytest`) cho các logic tính toán quan trọng, đặc biệt là module **Hạch toán tồn kho (`inventory_service`)** và **Tính giá**. Đây là nơi tuyệt đối không được phép sai sót.
*   **CI/CD Pipeline:**
    *   Thiết lập GitHub Actions hoặc GitLab CI để tự động chạy Test và Build mỗi khi có người push code mới.

---

## 🔒 4. Bảo mật & Quản trị Rủi ro (Security & Reliability)

*   **Audit Trail (Nhật ký kiểm toán):**
    *   Xây dựng hệ thống ghi log thay đổi dữ liệu chi tiết (Ai, đổi cột gì, giá trị cũ là gì, giá trị mới là gì, vào lúc nào). Đặc biệt cần thiết cho Kế toán và Chỉnh sửa Đơn hàng.
*   **Quản lý Session chặt chẽ:**
    *   Thiết lập cơ chế Revoke Token (buộc đăng xuất) khi phát hiện dấu hiệu bất thường, giới hạn số phiên đăng nhập đồng thời của một tài khoản.

---

## 📅 Lộ trình Triển khai Đề xuất (Roadmap)

1.  **Giai đoạn 1 (Quick Wins - Làm ngay trong tuần tới):**
    *   Thêm Database Indexes cho các bảng lõi.
    *   Triển khai WebSockets cho Màn hình giám sát sản xuất.
2.  **Giai đoạn 2 (Trải nghiệm xưởng):**
    *   Nâng cấp PWA cho Mobile Tracking để hỗ trợ offline.
    *   Cải thiện UX các Form nhập liệu dài.
3.  **Giai đoạn 3 (Nền tảng lâu dài):**
    *   Tách các tác vụ nặng sang Background Jobs (Celery).
    *   Phát triển hệ thống Audit Trail.

---
> *Kế hoạch được đề xuất bởi Antigravity AI - Hướng tới việc biến Nam Phương ERP thành một hệ thống chuẩn Enterprise.*
