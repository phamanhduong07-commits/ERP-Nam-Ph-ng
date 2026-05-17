# NGHIỆP VỤ 2: LẬP BÁO GIÁ THÙNG CARTON (QUOTATION)

Lập báo giá là kỹ năng quan trọng nhất của Sales ngành bao bì. Nam Phương ERP trang bị một **Costing Engine** (Bộ máy tính giá) cực kỳ mạnh mẽ, giúp tính chính xác giá thành dựa trên thông số kỹ thuật (dài, rộng, cao, loại sóng) và cộng các chi phí phụ trợ.

## 1. Logic Tính Giá Hệ Thống (Costing Logic)

Khi bạn nhập Kích thước (Dài x Rộng x Cao) của thùng/hộp, phần mềm sẽ ngầm tính toán các bước sau:
1. **Tính diện tích phôi (m2):** Dựa trên cấu trúc (Thùng A1 nắp chồm, Hộp nắp gài...), phần mềm cộng thêm các hệ số bù hao (bờ chừa, mép dán) để ra diện tích giấy cần dùng.
2. **Áp đơn giá giấy:** Tùy vào loại **Sóng** (B, C, E, BC) và **Số lớp** (3, 5, 7 lớp), hệ thống móc nối với Bảng giá vật tư từ Kế toán để ra *Chi phí vật tư nguyên bản*.
3. **Tính chi phí gia công:** Chi phí in (In Flexo, In Offset), chi phí bế, chi phí ghim/dán.
4. **Cộng chi phí phụ:** Tiền Khuôn (Mould Cost), Tiền Bảng In (Plate Cost), Tiền Vận Chuyển.
5. **Gợi ý Giá Bán:** Dựa trên Biên độ lợi nhuận (Margin) kỳ vọng.

---

## 2. Hướng Dẫn Thao Tác (Step-by-step)

### Bước 1: Mở form Báo giá
- Vào menu **Báo giá** (Quotes) > **Tạo Báo giá mới** (`/quotes/new`).
- Chọn Khách hàng (đã tạo ở bước trước).
- Điền **Ngày hiệu lực** (Rất quan trọng, nếu quá hạn báo giá, khách chốt đơn thì hệ thống sẽ cảnh báo phải làm giá mới do giá giấy có thể đã thay đổi).

### Bước 2: Khai báo Cấu trúc Sản phẩm (Dòng hàng)
Trong phần **Chi tiết Báo giá**, mỗi dòng là một sản phẩm. Bạn cần nhập kỹ:
1. **Tên sản phẩm:** Ví dụ *Thùng Carton A1 đựng trái cây*.
2. **Kích thước (Dài x Rộng x Cao):** 
   - *Lưu ý:* Hệ thống đang dùng đơn vị `mm`. Đừng nhập nhầm `cm` sẽ khiến giá nhảy sai hoàn toàn!
3. **Quy cách giấy:**
   - **Số lớp:** Chọn 3, 5, hoặc 7 lớp.
   - **Tổ hợp sóng:** Chọn đúng loại sóng khách yêu cầu (B, C, E, AB, BC...).
4. **Số lượng:** Số lượng càng lớn, hệ thống sẽ tự động phân bổ chi phí khuôn/bảng in trên mỗi đầu thùng càng nhỏ, giúp Đơn giá giảm xuống.
5. **Các Chi phí Phụ trợ (Tùy chọn):**
   - *Tiền bản in (Plate Cost):* Có tính phí khách không? Nếu có, nhập số tiền vào.
   - *Tiền khuôn bế (Mould Cost):* Nếu thùng bế phức tạp phải làm khuôn mới, hãy nhập vào.

### Bước 3: Đánh giá Lợi Nhuận (Margin) & Chốt Đơn Giá
Sau khi điền đủ thông số, bấm **[Tính Giá / Calculate]**:
- Hệ thống hiện ra **Giá Vốn Dự Kiến**.
- Bạn nhập **Đơn giá bán mong muốn** vào ô Đơn giá.
- Phần mềm tự động tính ra **% Margin (Lợi nhuận gộp)**.

> [!IMPORTANT]
> - Nếu `% Margin` hiện **màu xanh**: Giá tốt, bạn có thể Lưu & Gửi khách.
> - Nếu `% Margin` hiện **màu đỏ** (ví dụ: dưới mức sàn 10% công ty quy định): Bạn vẫn có thể Lưu báo giá, nhưng báo giá này sẽ rơi vào trạng thái `CHỜ DUYỆT` (Pending Approval). Chỉ khi Giám đốc bấm Duyệt trên hệ thống, bạn mới in được PDF.

### Bước 4: In Báo Giá Gửi Khách (Sử dụng Print Template)
1. Khi báo giá đã ở trạng thái `HOÀN THÀNH` (hoặc `ĐÃ DUYỆT`).
2. Bấm nút **[In Báo Giá]**.
3. Bạn sẽ được chọn các **Mẫu In** (Print Templates) đã được Admin thiết lập sẵn. 
4. Hệ thống sẽ kết xuất ra một bản xem trước đẹp mắt (Có logo công ty, thông tin khách hàng, bảng giá, chữ ký). Bạn tải file PDF về và gửi Zalo/Email cho khách.

---

## 3. Các Lỗi Thường Gặp & Cảnh Báo

> [!WARNING]
> **Nhập sai kích thước Phủ Bì vs Lọt Lòng**
> Nếu khách hàng đưa kích thước *Lọt lòng* (Kích thước chứa đồ bên trong), bạn phải tự tính cộng thêm độ dày của sóng để ra kích thước *Phủ bì* trước khi nhập vào phần mềm. ERP thường tính giá dựa trên kích thước Phủ bì.

> [!TIP]
> Nếu sản phẩm báo giá này giống hệt một sản phẩm cũ khách từng đặt, bạn không cần gõ lại! Hãy vào menu **Sản phẩm**, tìm mã cũ và bấm **[Copy thông số]** vào báo giá mới. Hệ thống sẽ tự cập nhật chi phí theo giá vật tư tại thời điểm hiện tại.

---
🔙 **Trở về:** [Tạo Khách hàng](./01_tao_khach_hang_moi.md) | 🔜 **Tiếp theo:** [Chuyển đổi Đơn Hàng SO](./03_chuyen_doi_so_va_giao_hang.md)
