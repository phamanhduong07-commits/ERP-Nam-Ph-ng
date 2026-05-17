---
aside: false
---
# NGHIỆP VỤ 2: LẬP BÁO GIÁ THÙNG CARTON (QUOTATION)

Lập báo giá là kỹ năng quan trọng nhất của Sales ngành bao bì. Nam Phương ERP trang bị một **Costing Engine** cực kỳ mạnh mẽ, giúp tính chính xác giá thành dựa trên thông số kỹ thuật và cộng các chi phí phụ trợ.

## 1. Logic Tính Giá Hệ Thống (Costing Logic)
1. **Tính diện tích phôi (m2):** Cộng thêm các hệ số bù hao (bờ chừa, mép dán).
2. **Áp đơn giá giấy:** Tùy vào loại **Sóng** (B, C, BC) và **Số lớp** (3, 5 lớp).
3. **Tính chi phí gia công & phụ phí:** Chi phí in, chi phí bế, Tiền Khuôn (Mould Cost), Tiền Bảng In (Plate Cost).

---

## 2. Hướng Dẫn Thao Tác (Step-by-step)

<div class="split-layout">
<div class="text-col">

### Bước 1: Mở form Báo giá
- Vào menu **Báo giá** (Quotes) > **Tạo Báo giá mới** (`/quotes/new`).
- Chọn Khách hàng (đã tạo ở bước trước).
- Điền **Ngày hiệu lực** (Rất quan trọng, để khóa giá giấy).

### Bước 2: Khai báo Cấu trúc Sản phẩm
1. **Kích thước (Dài x Rộng x Cao):** 
   - *Lưu ý:* Hệ thống đang dùng đơn vị `mm`. Đừng nhập nhầm `cm`!
2. **Quy cách giấy:**
   - **Số lớp:** Chọn 3, 5, hoặc 7 lớp.
   - **Tổ hợp sóng:** Chọn đúng loại sóng khách yêu cầu.
3. **Số lượng:** Số lượng càng lớn, Đơn giá càng giảm.
4. **Các Chi phí Phụ trợ (Tùy chọn):** Tiền bản in, Tiền khuôn bế.

</div>
<div class="img-col">
  <img src="https://placehold.co/600x400?text=Man+Hinh+Bao+Gia" alt="Form khai báo thông số bao bì" />
  <div class="img-caption">Hình 1: Nhập thông số Kích thước, Sóng, Lớp</div>
</div>
</div>


<div class="split-layout">
<div class="text-col">

### Bước 3: Đánh giá Lợi Nhuận (Margin) & Chốt Đơn Giá
- Sau khi điền đủ thông số, bấm **[Tính Giá / Calculate]**.
- Hệ thống hiện ra **Giá Vốn Dự Kiến**.
- Bạn nhập **Đơn giá bán mong muốn** vào ô Đơn giá. Hệ thống tự động tính ra **% Margin**.

::: info CẢNH BÁO QUAN TRỌNG
Nếu `% Margin` hiện **màu đỏ** (ví dụ: dưới mức sàn 10%), báo giá sẽ rơi vào trạng thái `CHỜ DUYỆT`. Chỉ khi Giám đốc bấm Duyệt, bạn mới in được PDF.
:::

### Bước 4: In Báo Giá Gửi Khách
1. Bấm nút **[In Báo Giá]**.
2. Chọn các **Mẫu In** (Print Templates) đã được Admin thiết lập sẵn. 
3. Tải file PDF về và gửi Zalo cho khách.

</div>
<div class="img-col">
  <img src="https://placehold.co/600x400?text=Tinh+Gia+Margin" alt="Tính giá và hiển thị Margin" />
  <div class="img-caption">Hình 2: Hệ thống tính Giá vốn và % Lợi nhuận (Margin)</div>
</div>
</div>

---

## 3. Lỗi Thường Gặp

::: warning Nhập sai kích thước Phủ Bì vs Lọt Lòng
Nếu khách hàng đưa kích thước *Lọt lòng* (Kích thước chứa đồ bên trong), bạn phải tự tính cộng thêm độ dày của sóng để ra kích thước *Phủ bì* trước khi nhập vào phần mềm.
:::
