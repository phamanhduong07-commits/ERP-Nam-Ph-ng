# 🏛️ Tài liệu Kỹ thuật Tổng thể Dự án Nam Phương ERP

Tài liệu này là "Bản đồ số" cung cấp cái nhìn toàn diện về mọi Module và logic nghiệp vụ trong hệ thống Nam Phương ERP. Đây là tài liệu bắt buộc cho đội ngũ phát triển để hiểu cách các Module tương tác với nhau.

---

## 🏗️ 1. Kiến trúc Tổng thể

Hệ thống được thiết kế theo hướng **Data-Driven** (Dẫn dắt bởi dữ liệu), đảm bảo tính nhất quán giữa kho, sản xuất và kế toán.

- **Frontend:** React + Vite + Ant Design. Sử dụng `TanStack Query` để đồng bộ trạng thái server.
- **Backend:** FastAPI + SQLAlchemy. Sử dụng `Alembic` cho migration và `Pydantic` cho data contract.
- **Database:** PostgreSQL (Hỗ trợ JSONB cho các cấu hình kỹ thuật sản phẩm phức tạp).

---

## 🧩 2. Hệ thống Module Nghiệp vụ

### 💰 2.1. Module Kinh doanh (Sales & CRM)
- **Báo giá (Quotes):** Lưu trữ thông tin kỹ thuật chi tiết của sản phẩm carton.
- **Đơn hàng (Sales Orders):** Quản lý trạng thái đơn hàng (Mới -> Đã duyệt -> Đang SX -> Đã giao).
- **Hỗ trợ Import:** Cho phép Import hàng loạt đơn hàng từ Excel.
- **Trả hàng (Sales Returns):** Xử lý quy trình nhập lại kho khi khách trả hàng.

### 🛒 2.2. Module Thu mua (Purchase)
- **Đơn mua hàng (PO):** Theo dõi tiến độ giao hàng từ nhà cung cấp giấy cuộn và NVL phụ.
- **Theo dõi công nợ:** Tự động đồng bộ với module kế toán khi có phiếu nhập kho.

### 📦 2.3. Module Kho & Logistics (Inventory)
Đây là module có logic phức tạp nhất, được xử lý tại `warehouse.py` và `inventory_service.py`:
- **Quản lý đa tầng:** Giấy cuộn -> Phôi sóng -> Thành phẩm.
- **Phiếu Nhập/Xuất:** 
  - `GoodsReceipt` (Nhập mua, Nhập phôi ngoại).
  - `MaterialIssue` (Xuất NVL cho sản xuất).
  - `ProductionOutput` (Nhập thành phẩm từ xưởng).
  - `DeliveryOrder` (Xuất bán hàng cho khách).
- **Tính giá vốn:** Hỗ trợ tính giá bình quân gia quyền.

### 🏭 2.4. Module Sản xuất & Tracking (CD1 - CD2)
- **Lệnh SX (Production Orders):** Chuyển đổi từ đơn hàng kinh doanh sang lệnh sản xuất tại xưởng.
- **Công đoạn 1 (CD1):** Chạy máy sóng tạo phôi.
- **Công đoạn 2 (CD2):** In ấn và hoàn thiện (Ghim, dán, bế...).
- **Mobile Tracking:** Công nhân báo cáo tiến độ thời gian thực (Start/Stop/Complete) qua thiết bị di động.

### 🧾 2.5. Tài chính & Kế toán (Accounting)
- **Billing:** Tự động phát hành hóa đơn dựa trên phiếu xuất kho.
- **Accounting Service:** Tự động ghi nhận bút toán kho (621, 154, 155...) dựa trên cấu hình tài khoản định sẵn.

---

## 🗄️ 3. Cấu trúc Database Quan trọng

- **`customers` / `suppliers`:** Danh mục đối tác.
- **`products`:** Danh mục sản phẩm (Lưu thông tin khổ giấy, sóng, cấu trúc).
- **`inventory_balances`:** Bảng cân đối tồn kho (luôn cập nhật số dư hiện tại).
- **`inventory_transactions`:** Nhật ký mọi biến động kho (Sổ chi tiết vật tư).
- **`production_logs`:** Nhật ký vận hành máy móc.

---

## 🔑 4. Các Logic Đặc thù (Developer Needs to Know)

1.  **Cơ chế Auto-Resolve Warehouse:** Khi nhập/xuất, nếu không chỉ định ID kho, hệ thống tự động tìm kho dựa trên `phan_xuong_id` và `loai_kho` (GIAY_CUON, PHOI, THANH_PHAM).
2.  **Hạch toán tự động:** Mỗi khi thực hiện `nhap_balance` hoặc `xuat_balance`, hệ thống gọi qua `AccountingService` để đảm bảo số liệu kho và kế toán luôn khớp nhau.
3.  **Hệ thống QR/RFID:** 
    - QR Code dùng để trỏ nhanh đến Máy hoặc Lệnh SX.
    - RFID Token dùng để thay thế Username/Password cho công nhân tại xưởng (Tăng tốc độ thao tác).

---

## 🛠️ 5. Quy trình Phát triển (Development Workflow)

1.  **Cấu hình:** File `.env` chứa thông tin DB và JWT Secret.
2.  **Routes:** Các router được chia nhỏ theo nghiệp vụ và đăng ký tập trung tại `app/main.py`.
3.  **Frontend Pages:** Nằm trong `src/pages/`, tuân thủ cấu trúc của Ant Design Pro.
4.  **Deployment:** Sử dụng các file `.bat` ở thư mục gốc để khởi động nhanh hoặc cập nhật hệ thống từ Git.

---
> *Tài liệu được thiết kế bởi Antigravity AI - Trợ lý phát triển hệ thống Nam Phương Software.*
