---
aside: false
---
# NGHIỆP VỤ 3: CHUYỂN ĐỔI SO VÀ THEO DÕI GIAO HÀNG

Báo giá chỉ là bản nháp để thương lượng. Khi khách hàng chính thức "chốt deal", bạn bắt buộc phải chuyển Báo giá thành **Đơn Bán Hàng (SO)**. SO là tờ lệnh kích hoạt toàn bộ quy trình Sản xuất và Kế toán.

---

## 1. Chuyển Đổi Sang Đơn SO

<div class="split-layout">
<div class="text-col">

### Bước 1: Chuyển đổi Báo giá
1. Vào màn hình Báo giá đã được chốt.
2. Nhấn nút **[Tạo Đơn Hàng SO]** (Convert to SO). Phần mềm sẽ copy 100% dữ liệu.

### Bước 2: Bổ Sung Thông Tin Giao Hàng & Sản Xuất
1. **Ngày yêu cầu giao hàng:** Rất quan trọng. Hệ thống Dàn máy Sản xuất (CD2 Kanban) dựa vào ngày này để ưu tiên chạy máy nào trước.
2. **Mã ký hiệu / Mã in ấn:** Ví dụ: *Bản in Vinamilk 2026*.
3. **Ghi chú sản xuất:** Nơi bạn dặn dò quản đốc (VD: *Dán kỹ mép*).

### Bước 3: Đẩy Lệnh Sản Xuất
- Bấm **[Lưu Đơn Hàng]**. Trạng thái là `MỚI`.
- Bấm **[Duyệt SO & Chuyển Sản Xuất]**. Thông tin đơn hàng lập tức bắn sang màn hình của Quản Đốc Phân Xưởng.

</div>
<div class="img-col">
  <img src="https://placehold.co/600x400?text=Chuyen+Doi+SO" alt="Nút Chuyển đổi SO và form thông tin" />
  <div class="img-caption">Hình 1: Chuyển đổi Báo giá sang SO và điền Ngày giao hàng</div>
</div>
</div>

---

## 2. Theo Dõi Tiến Độ (Order Tracking)

<div class="split-layout">
<div class="text-col">

Sales không cần chạy xuống xưởng hỏi thăm tiến độ. Hãy truy cập **Bán Hàng > Tiến độ Đơn hàng** (`/reports/order-progress`).

Màn hình sẽ hiển thị thanh tiến độ (Progress Bar):
- 🟩 **CĐ1 - Chạy sóng:** 100% (Đã nhập phôi xong).
- 🟨 **CĐ2 - In Flexo:** 50% (Đang in dở dang).
- ⬜ **Thành phẩm:** 0% (Chưa đóng gói).

Nhìn vào đây, bạn có thể tự tin báo với khách: *"Anh ơi hàng đang trên máy in rồi, chiều mai xe đi giao nhé!"*

</div>
<div class="img-col">
  <img src="https://placehold.co/600x400?text=Theo+Doi+Tien+Do" alt="Thanh tiến độ đơn hàng" />
  <div class="img-caption">Hình 2: Theo dõi tiến độ từng công đoạn Thời gian thực</div>
</div>
</div>

---

## 3. Xử Lý Hàng Bán Trả Lại (Sales Returns)

Trường hợp khách hàng trả lại hàng do lỗi (Ví dụ: 200 thùng lem mực):
1. Vào **Bán hàng > Hàng bán trả lại** (`/sales/returns/create`).
2. Chọn SO gốc, chọn mặt hàng, nhập số lượng trả lại là `200`.
3. **Bắt buộc:** Chọn lý do trả lại (Ví dụ: `Lỗi in ấn CĐ2`). 
4. Hệ thống sẽ tự động tạo lệnh nhập Kho Hàng Lỗi và báo Kế toán trừ tiền.

::: warning KHÔNG ĐƯỢC THỎA THUẬN MIỆNG
Tuyệt đối không giải quyết hàng lỗi qua thỏa thuận miệng. Bắt buộc phải có phiếu Hàng Bán Trả Lại trên hệ thống để Kế toán có chứng từ trừ tiền công nợ.
:::
