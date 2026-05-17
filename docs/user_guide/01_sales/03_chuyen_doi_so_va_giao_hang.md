# NGHIỆP VỤ 3: CHUYỂN ĐỔI SO VÀ THEO DÕI GIAO HÀNG

Báo giá chỉ là bản nháp để thương lượng với khách. Khi khách hàng chính thức "chốt deal" (kèm PO hoặc xác nhận qua Zalo/Email), bạn bắt buộc phải chuyển Báo giá thành **Đơn Bán Hàng (SO - Sales Order)**. SO là tờ lệnh "kích hoạt" toàn bộ quy trình Sản xuất và Kế toán của nhà máy.

## 1. Logic Hệ Thống & Lưu Ý Nghiệp Vụ
- **Sự khác biệt giữa Báo giá và SO:** Báo giá có thể sửa thoải mái. Nhưng SO một khi đã được đẩy sang trạng thái `SẴN SÀNG SẢN XUẤT`, bạn **KHÔNG THỂ** sửa lại số lượng hay kích thước, vì dữ liệu đã chốt vào BOM để xuất kho giấy.
- **Tình trạng Đơn hàng:** Được quản lý xuyên suốt từ lúc tạo -> đang in -> đang bế -> lưu kho thành phẩm -> đang đi giao -> hoàn thành. NVKD dùng trạng thái này để trả lời khách hàng ngay lập tức mà không cần gọi điện hỏi quản đốc.

---

## 2. Hướng Dẫn Thao Tác (Step-by-step)

### Bước 1: Chuyển đổi Báo giá thành SO (Sales Order)
1. Vào màn hình Báo giá đã được chốt.
2. Nhấn nút **[Tạo Đơn Hàng SO]** (Convert to SO) ở góc phải.
3. Phần mềm sẽ tự động copy 100% dữ liệu từ báo giá sang màn hình tạo SO mới. Không cần gõ lại bất cứ ký tự nào!

### Bước 2: Bổ Sung Thông Tin Giao Hàng & Sản Xuất
Trên màn hình SO, bạn phải điền bổ sung các thông tin then chốt sau:
1. **Ngày yêu cầu giao hàng:** Rất quan trọng. Hệ thống Xếp lịch Sản xuất (CD2 Kanban) dựa vào ngày này để ưu tiên chạy máy nào trước, máy nào sau.
2. **Địa chỉ giao hàng thực tế:** Nếu khách đổi kho nhận, cập nhật lại tại đây.
3. **Mã ký hiệu / Mã in ấn:** Ghi chú rõ thùng này in Market nào (Ví dụ: *Bản in Vinamilk Mẫu Mới 2026*).
4. **Ghi chú sản xuất:** Nơi bạn dặn dò quản đốc. Ví dụ: *"Khách yêu cầu dán kỹ mép, không để lem mực"*.

### Bước 3: Chốt SO và Đẩy Lệnh Sản Xuất
- Sau khi kiểm tra, bấm **[Lưu Đơn Hàng]**. 
- Trạng thái SO hiện tại là `MỚI` (New).
- Khi bạn chắc chắn mọi thứ đã đúng, bấm nút **[Duyệt SO & Chuyển Sản Xuất]**. Lúc này, thông tin đơn hàng lập tức bắn sang màn hình của Quản Đốc Phân Xưởng và bộ phận Mua Hàng (nếu thiếu giấy).

---

## 3. Theo Dõi Tiến Độ (Order Tracking)

Sales không cần chạy xuống xưởng hỏi thăm tiến độ nữa. Hãy sử dụng tính năng **Báo Cáo Tiến Độ**.
- Truy cập **Bán Hàng > Tiến độ Đơn hàng** (`/reports/order-progress`).
- Màn hình sẽ hiển thị thanh tiến độ (Progress Bar) cho từng SO:
  - 🟩 **CĐ1 - Chạy sóng:** 100% (Đã nhập phôi xong).
  - 🟨 **CĐ2 - In Flexo:** 50% (Đang in dở dang).
  - ⬜ **Thành phẩm:** 0% (Chưa đóng gói).
- Nhìn vào đây, bạn có thể tự tin báo với khách: *"Anh ơi hàng đang trên máy in rồi, khoảng chiều mai là em cho xe đi giao nhé!"*

---

## 4. Giao Hàng & Hàng Bán Trả Lại

### 4.1. Theo Dõi Phiếu Giao Hàng
- Khi kho xuất hàng lên xe tải, hệ thống sinh ra **Phiếu Xuất Giao Hàng (Delivery Note)**. Trạng thái SO sẽ chuyển sang `ĐANG GIAO`.
- Khi tài xế giao xong, Kế toán sẽ xác nhận hoàn tất. SO chuyển sang `ĐÃ HOÀN THÀNH`. Kế toán phát hành Hóa đơn đỏ (Sales Invoice).

### 4.2. Xử Lý Hàng Bán Trả Lại (Sales Returns)
Trường hợp xấu nhất: Khách hàng trả lại 200 thùng do lem mực.
1. Bạn phải vào hệ thống tạo phiếu **Hàng bán trả lại** (`/sales/returns/create`).
2. Chọn SO gốc, chọn mặt hàng bị lỗi, nhập số lượng trả lại là `200`.
3. **Bắt buộc:** Chọn lý do trả lại (Ví dụ: `Lỗi in ấn CĐ2`). 
4. Phiếu này sẽ làm 2 việc:
   - Tự động tạo lệnh nhập 200 thùng này vào Kho Hàng Lỗi.
   - Báo cho Kế toán trừ công nợ khách hàng (Customer Refund).
   - Đánh dấu KPI phạt lỗi đối với ca sản xuất tương ứng.

> [!WARNING]
> Tuyệt đối không giải quyết hàng lỗi qua thỏa thuận miệng. Bắt buộc phải có phiếu Hàng Bán Trả Lại trên hệ thống để Kế toán có chứng từ trừ tiền.

---
🔙 **Trở về:** [Lập báo giá](./02_lap_bao_gia_thung_carton.md) | 🏠 **Về Trang chủ:** [Mục lục ERP](../00_TrangChu.md)
