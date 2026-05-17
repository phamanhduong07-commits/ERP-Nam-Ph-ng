---
aside: false
---
# NGHIỆP VỤ 1: TẠO VÀ QUẢN LÝ KHÁCH HÀNG MỚI

Trước khi có thể làm Báo giá hoặc lên Đơn hàng, bắt buộc bạn phải có thông tin Khách hàng trong hệ thống. Việc quản lý khách hàng chặt chẽ giúp bộ phận Kế toán theo dõi công nợ chính xác và Kế hoạch sắp xếp xe giao hàng đúng địa chỉ.

## 1. Logic Hệ Thống & Lưu Ý Nghiệp Vụ
- **Mã Khách Hàng (Mã KH):** Hệ thống thường tự động sinh ra (ví dụ: `KH001`, `KH002`) hoặc bạn có thể nhập tay theo quy tắc của công ty.
- **Hạn mức công nợ:** Kế toán có thể thiết lập Hạn mức công nợ cho từng KH. Nếu SO mới làm vượt quá hạn mức này, phần mềm sẽ chặn không cho giao hàng trừ khi Giám đốc duyệt.

---

## 2. Hướng Dẫn Thao Tác (Step-by-step)

<div class="split-layout">
<div class="text-col">

### Bước 1: Truy cập Danh mục
- Trên menu chính bên trái, tìm và click vào **Danh mục** (Master Data) > **Khách hàng** (Customers).
- Giao diện hiển thị danh sách toàn bộ khách hàng hiện có. 
- *Lưu ý:* Hãy dùng ô tìm kiếm để kiểm tra xem khách hàng này đã tồn tại chưa (tránh tạo rác dữ liệu).

### Bước 2: Thêm mới Khách hàng
- Click nút **[+ Thêm Mới]** ở góc trên cùng bên phải.
- Một form điền thông tin sẽ xuất hiện.

</div>
<div class="img-col">
  <img src="https://placehold.co/600x400?text=Hinh+Anh+Khach+Hang" alt="Màn hình Danh sách Khách hàng" />
  <div class="img-caption">Hình 1: Màn hình Danh sách Khách Hàng</div>
</div>
</div>

<div class="split-layout">
<div class="text-col">

### Bước 3: Điền Thông Tin Cơ Bản
Bạn cần điền chính xác các trường sau:
1. **Tên Khách Hàng:** Ghi đầy đủ tên trên Giấy phép kinh doanh.
2. **Mã Số Thuế (Rất quan trọng):** Nhập chính xác MST. Hệ thống Kế toán sẽ dùng mã này để xuất Hóa đơn điện tử.
3. **Nhân viên phụ trách:** Chọn tên bạn (Giúp tính hoa hồng cuối tháng).

### Bước 4: Điền Thông Tin Giao Hàng
1. **Địa chỉ xuất hóa đơn:** Là địa chỉ pháp lý.
2. **Địa chỉ giao hàng thực tế:** Nơi xe tải sẽ chở thùng carton tới. 
3. **Người liên hệ:** Tên, Số điện thoại người Mua hàng.

### Bước 5: Lưu dữ liệu
- Kiểm tra lại thông tin và nhấn **[Lưu]**. Hệ thống thông báo xanh "Đã tạo thành công".

</div>
<div class="img-col">
  <img src="https://placehold.co/600x400?text=Form+Khach+Hang+Moi" alt="Form thêm mới Khách hàng" />
  <div class="img-caption">Hình 2: Form điền thông tin Khách hàng mới</div>
</div>
</div>

---

## 3. Các Lỗi Thường Gặp & Cách Khắc Phục

::: warning Lỗi: "Mã số thuế này đã tồn tại trong hệ thống!"
- *Nguyên nhân:* Khách hàng này đã được một Sales khác tạo trước đó.
- *Khắc phục:* Quay lại màn hình Danh sách, tìm kiếm bằng MST. Nếu phát hiện khách của Sales khác đã bỏ, hãy liên hệ Quản lý để xin quyền chuyển người phụ trách.
:::

::: tip Mẹo In Báo Giá
Đừng bỏ trống ô "Số điện thoại" và "Địa chỉ giao hàng". Khi bạn in Báo giá bằng công cụ **Print Template**, hệ thống sẽ tự động bốc 2 trường này điền vào bản in PDF, giúp bạn không phải gõ tay mỗi lần làm báo giá!
:::
