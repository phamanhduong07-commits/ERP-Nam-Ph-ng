# HƯỚNG DẪN SỬ DỤNG - MUA HÀNG & QUẢN LÝ KHO (PURCHASING & WAREHOUSE)

Phân hệ Mua hàng (Purchasing) và Kho (Warehouse) đảm bảo nhà máy luôn có đủ nguyên vật liệu (Giấy cuộn, Phôi sóng, Mực, Hóa chất) để sản xuất liên tục mà không bị tồn kho "chết" quá nhiều.

## 1. Mục tiêu Nghiệp vụ
- Số hóa quy trình Đề xuất vật tư và Đơn mua hàng (Purchase Order - PO).
- Quản lý chính xác Tồn kho thực tế (Inventory) đa chi nhánh/xưởng.
- Tự động hóa tính toán nhu cầu nguyên vật liệu (MRP) từ Lệnh sản xuất.

---

## 2. Phân Hệ Mua Hàng (Purchasing)

### 2.1. Quy trình Mua hàng
```mermaid
flowchart TD
    A[Yêu Cầu Mua Hàng (YMH)] --> B[Duyệt YMH]
    B --> C[Tạo Đơn Mua Hàng (PO)]
    C --> D[Chờ Hàng Về]
    D --> E[Phiếu Nhập Kho Mua Hàng]
    E --> F[Ghi nhận Công nợ (AP)]
```

### 2.2. Lên Đơn Mua Hàng (PO)
Hệ thống cho phép mua 2 loại chính: **Mua Giấy cuộn** và **Mua NVL khác / Phôi ngoài**.
1. Truy cập **Mua hàng > Danh sách Đơn mua hàng (PO)** (`/purchasing/orders`).
2. Nhấn **[Tạo PO mới]**.
3. Chọn Nhà cung cấp (Hệ thống tự load Bảng giá/Chiết khấu lưu sẵn).
4. Thêm hàng hóa cần mua, số lượng, ngày dự kiến nhận.
5. Nhấn **[Gửi Duyệt]**. Sau khi Giám đốc duyệt (trạng thái `ĐÃ DUYỆT`), PO sẽ được In và gửi cho NCC.

> [!TIP]
> **Dự báo nhu cầu (MRP):** Sử dụng trang `/purchasing/du-bao-nhu-cau`. Phần mềm sẽ tự động quét các Đơn hàng (SO) chưa sản xuất, trừ đi Tồn kho hiện tại và Đơn mua đang đi đường để tính ra số lượng Giấy/Mực/Phôi bạn cần đặt mua thêm ngay hôm nay!

---

## 3. Phân Hệ Quản Lý Kho (Warehouse)

Hệ thống ERP Nam Phương áp dụng cơ chế quản lý **Đa Kho**: Kho NVL, Kho Thành Phẩm, Kho Phôi, Kho Hàng Lỗi.

### 3.1. Nhập Kho Mua Hàng (Goods Receipt)
Khi xe của Nhà cung cấp tới xưởng:
1. Thủ kho vào **Quản lý Kho > Phiếu Nhập Kho Mua Hàng** (`/warehouse/nhap-giay` hoặc `/warehouse/receipts`).
2. Kéo (Fetch) dữ liệu từ mã PO của phòng Mua Hàng xuống. 
   *(Tuyệt đối hạn chế tự gõ tay để tránh sai lệch với kế toán).*
3. Nhập số lượng thực nhận (Hệ thống cho phép nhập chênh lệch +/- 5% tùy cấu hình).
4. Bấm **[Lưu & Nhập kho]**. Tồn kho ngay lập tức tăng lên, và phiếu được chuyển cho Kế toán để ghi nhận hóa đơn đầu vào.

### 3.2. Xuất Kho Sản Xuất (Material Issue)
Khi xưởng cần xuất cuộn giấy hoặc xuất mực cho máy In:
1. Vào **Quản lý Kho > Phiếu Xuất NVL** (`/warehouse/issues`).
2. Nhập mã Lệnh Sản Xuất (Phần mềm tự động đổ ra BOM - Định mức vật tư cần xuất).
3. Thủ kho xác nhận xuất theo thực tế (có thể quét mã vạch cuộn giấy).

> [!WARNING]
> Nếu xưởng yêu cầu xuất vượt định mức (ví dụ do chạy hỏng quá nhiều), phần mềm sẽ hiện thông báo cảnh báo và yêu cầu lý do hao hụt.

### 3.3. Chuyển Kho (Transfer) & Thẻ Kho (Stock Card)
- **Chuyển kho:** Dùng khi chuyển hàng từ Xưởng A sang Xưởng B. Vào `/warehouse/transfers`, điền Kho Xuất, Kho Nhập. Hàng đang đi đường sẽ nằm ở trạng thái `IN TRANSIT`.
- **Thẻ Kho:** Bất cứ khi nào bạn thấy tồn kho sai lệch, vào **Kho > Thẻ Kho** (`/warehouse/the-kho`). Gõ mã sản phẩm, hệ thống sẽ vẽ lại lịch sử: Tồn Đầu Kỳ → Nhập → Xuất → Tồn Cuối Kỳ chi tiết đến từng phút để truy vết.

### 3.4. Kiểm Kê Định Kỳ (Stock Adjustment)
Cuối tháng, thủ kho tiến hành kiểm kê:
1. Vào `/warehouse/stock-adjustments`.
2. Hệ thống load tồn kho lý thuyết trên phần mềm.
3. Nhập số đếm thực tế vào ô `SL Thực tế`.
4. Nếu có chênh lệch, điền lý do. Bấm **[Duyệt Điều Chỉnh]**, phần mềm sẽ sinh ra bút toán chênh lệch tồn kho gửi Kế toán.

---
*Tiếp theo: [Hướng dẫn Sản xuất & CD2](./03_SanXuat.md)*
