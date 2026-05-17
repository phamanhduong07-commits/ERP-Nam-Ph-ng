# NGHIỆP VỤ 1: TẠO VÀ QUẢN LÝ KHÁCH HÀNG MỚI

Trước khi có thể làm Báo giá hoặc lên Đơn hàng, bắt buộc bạn phải có thông tin Khách hàng trong hệ thống. Việc quản lý khách hàng chặt chẽ giúp bộ phận Kế toán theo dõi công nợ chính xác và Kế hoạch sắp xếp xe giao hàng đúng địa chỉ.

## 1. Logic Hệ Thống & Lưu Ý Nghiệp Vụ
- **Mã Khách Hàng (Mã KH):** Hệ thống thường tự động sinh ra (ví dụ: `KH001`, `KH002`) hoặc bạn có thể nhập tay theo quy tắc của công ty (Ví dụ: tên viết tắt `VINAMILK`, `SAMSUNG`). Khuyến nghị dùng mã tự động để tránh trùng lặp.
- **Phân loại Khách hàng:** Khách lẻ, Khách đại lý, Khách VIP. Mỗi phân loại có thể được hệ thống gắn với một **Chính sách giá / Mức chiết khấu** khác nhau.
- **Hạn mức công nợ:** Kế toán có thể thiết lập Hạn mức công nợ cho từng KH. Nếu SO mới làm vượt quá hạn mức này, phần mềm sẽ chặn không cho giao hàng trừ khi Giám đốc duyệt.

---

## 2. Hướng Dẫn Thao Tác (Step-by-step)

### Bước 1: Truy cập Danh mục
- Trên menu chính, tìm và click vào **Danh mục** (Master Data) > **Khách hàng** (Customers).
- Giao diện hiển thị danh sách toàn bộ khách hàng hiện có. Bạn có thể dùng ô tìm kiếm để kiểm tra xem khách hàng này đã tồn tại chưa (tránh tạo rác dữ liệu).

### Bước 2: Thêm mới Khách hàng
- Click nút **[+ Thêm Mới]** ở góc trên cùng bên phải.
- Một form điền thông tin sẽ hiện ra.

### Bước 3: Điền Thông Tin Cơ Bản
Bạn cần điền chính xác các trường sau:
1. **Tên Khách Hàng:** Ghi đầy đủ tên trên Giấy phép kinh doanh (Ví dụ: *Công ty TNHH Bao Bì ABC*).
2. **Tên Viết Tắt / Tên thường gọi:** Dùng để hiển thị cho gọn trên các màn hình sản xuất (Ví dụ: *ABC*).
3. **Mã Số Thuế (Rất quan trọng):** Nhập chính xác MST. Hệ thống Kế toán sẽ dùng mã này để xuất Hóa đơn điện tử (Sales Invoice).
4. **Nhân viên phụ trách (Sales In Charge):** Chọn tên bạn (hoặc NVKD đang chăm sóc). Tính năng này giúp hệ thống tự động lọc báo cáo hoa hồng doanh số vào cuối tháng.

### Bước 4: Điền Thông Tin Liên Hệ & Giao Hàng
1. **Địa chỉ xuất hóa đơn:** Là địa chỉ pháp lý đăng ký kinh doanh.
2. **Địa chỉ giao hàng thực tế:** Đây là nơi xe tải sẽ chở thùng carton tới. *(Chú ý: Nếu khách hàng có nhiều kho nhận, hãy ghi rõ ở mục Ghi chú hoặc tạo các địa chỉ giao hàng phụ nếu hệ thống cho phép).*
3. **Người liên hệ:** Tên, Số điện thoại của người Mua hàng (Purchaser) bên đối tác.

### Bước 5: Lưu dữ liệu
- Kiểm tra lại thông tin và nhấn **[Lưu]**.
- Hệ thống thông báo xanh "Đã tạo thành công". Bây giờ bạn có thể chuyển sang Bước Lập Báo Giá cho khách hàng này.

---

## 3. Các Lỗi Thường Gặp & Cách Khắc Phục

> [!WARNING] 
> **Lỗi: "Mã số thuế này đã tồn tại trong hệ thống!"**
> - *Nguyên nhân:* Khách hàng này đã được một Sales khác tạo trước đó.
> - *Khắc phục:* Quay lại màn hình Danh sách, tìm kiếm bằng MST. Nếu phát hiện khách của Sales khác đã bỏ, hãy liên hệ Quản lý để xin quyền chuyển đổi người phụ trách.

> [!TIP]
> **Mẹo:** Đừng bỏ trống ô "Số điện thoại" và "Địa chỉ giao hàng". Khi bạn in Báo giá bằng công cụ **Print Template**, hệ thống sẽ tự động bốc 2 trường này điền vào bản in PDF, giúp bạn không phải gõ tay mỗi lần làm báo giá!

---
🔙 **Trở về:** [Mục lục Sales](./README.md) | 🔜 **Tiếp theo:** [Nghiệp vụ Lập Báo Giá](./02_lap_bao_gia_thung_carton.md)
