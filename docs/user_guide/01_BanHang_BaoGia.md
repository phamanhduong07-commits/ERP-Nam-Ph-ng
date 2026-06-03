# Hướng dẫn sử dụng Trang Báo Giá

## Mục lục
1. [Tổng quan](#1-tổng-quan)
2. [Tạo báo giá mới](#2-tạo-báo-giá-mới)
3. [Phần thông tin chung](#3-phần-thông-tin-chung)
4. [Thêm mặt hàng vào báo giá](#4-thêm-mặt-hàng-vào-báo-giá)
5. [Bảng danh sách mặt hàng](#5-bảng-danh-sách-mặt-hàng)
6. [Lưu, gửi duyệt và duyệt báo giá](#6-lưu-gửi-duyệt-và-duyệt-báo-giá)
7. [Lập đơn hàng từ báo giá](#7-lập-đơn-hàng-từ-báo-giá)
8. [Câu hỏi thường gặp](#8-câu-hỏi-thường-gặp)

---

## 1. Tổng quan

Trang Báo Giá là nơi tạo và quản lý toàn bộ báo giá gửi cho khách hàng. Mỗi báo giá bao gồm:

- **Thông tin chung**: khách hàng, ngày tháng, nhân viên phụ trách
- **Danh sách mặt hàng**: từng loại thùng carton, kích thước, cấu trúc giấy, gia công
- **Tài chính**: chi phí bảng in, khuôn, vận chuyển, VAT, giá bán tổng

Luồng một báo giá thông thường:

```
Tạo mới → Thêm mặt hàng → Lưu → Gửi duyệt → Được duyệt → Lập đơn hàng
```

---

## 2. Tạo báo giá mới

1. Vào menu **Báo giá** → bấm nút **"Thêm báo giá mới"**
2. Trang sẽ mở form trống với tiêu đề **"Thêm báo giá mới"**

> **Lưu ý:** Số báo giá (BG-YYYYMMDD-XXX) được hệ thống tự tạo khi lưu lần đầu — bạn không cần nhập.

---

## 3. Phần thông tin chung

Đây là phần phía trên cùng của form, gồm 2 hàng:

### Hàng 1

| Trường | Bắt buộc | Mô tả |
|--------|----------|-------|
| **Số BG copy** | Không | Nếu báo giá này sao chép từ một báo giá cũ, ghi số BG gốc vào đây để tra cứu |
| **Ngày** | Có | Ngày lập báo giá, mặc định là hôm nay |
| **Khách hàng** | **Có** | Gõ tên hoặc mã khách để tìm. Phải chọn từ danh sách |
| **Ngày hết hạn** | Không | Mặc định 30 ngày sau ngày lập. Có thể thay đổi |

### Hàng 2

| Trường | Mô tả |
|--------|-------|
| **Pháp nhân** | Công ty xuất báo giá (Nam Phương, Visunpack...) |
| **Nơi sản xuất** | Phân xưởng sẽ sản xuất đơn hàng này |
| **NV phụ trách** | Nhân viên kinh doanh chịu trách nhiệm báo giá |
| **NV theo dõi đơn** | Nhân viên theo dõi khi chuyển thành đơn hàng |

> **Quan trọng:** Phải chọn Khách hàng trước, sau đó mới thêm mặt hàng — một số tính năng tìm kiếm sản phẩm dựa vào thông tin khách hàng.

---

## 4. Thêm mặt hàng vào báo giá

Đây là phần trung tâm của trang. Nhìn từ trên xuống:

### 4.1 Thanh thông tin dòng hàng (hàng đầu tiên)

Gồm 6 ô nằm ngang:

| Ô | Tên | Mô tả |
|---|-----|-------|
| 1 | **Loại** | Loại hàng tự do, ví dụ: "Thùng", "Tấm lót", "Hộp". Không bắt buộc |
| 2 | **Tìm SP từ danh mục** | Gõ tên hoặc mã AMIS để tìm sản phẩm đã có sẵn. Khi chọn, tất cả thông tin tự điền vào |
| 3 | **Tên hàng** ✱ | Tên mặt hàng, bắt buộc. Có nút ⚡ (sét) bên phải để **tự tạo tên** theo kích thước |
| 4 | **ĐVT** | Đơn vị tính, mặc định "Thùng" |
| 5 | **Số lượng BG** | Số lượng dùng để tính giá (ảnh hưởng đến hao hụt và giá thành) |
| 6 | **Giá bán/thùng** | Giá bán đề nghị. Viền đỏ nếu chưa nhập. Có nút **Gợi ý** bên phải khi đủ dữ liệu |

**Nút ⚡ Tự tạo tên:** Bấm vào biểu tượng sét bên phải ô Tên hàng → hệ thống tự điền tên theo dạng "Thùng Carton DxRxC NL" dựa trên kích thước và cấu trúc đã nhập.

**Nút Gợi ý giá:** Chỉ hiện ra khi đã nhập đủ kích thước + số lượng + cấu trúc giấy. Bấm để hệ thống tự tính giá theo công thức (giá giấy + gián tiếp + hao hụt + gia công).

---

### 4.2 Panel trái — LOẠI GIẤY (nền xanh dương nhạt)

Đây là phần khai báo cấu trúc giấy của thùng.

**Số lớp:** Chọn 3, 5 hoặc 7 lớp. Số lớp ảnh hưởng đến bao nhiêu dòng giấy hiển thị bên dưới.

**Tổ hợp sóng:** Chọn sau khi chọn số lớp. Ví dụ: 3 lớp có sóng B, C, E; 5 lớp có BC, BE...

**Bảng lớp giấy:** Mỗi hàng gồm:
- **Tên lớp** (Mặt, Sóng B, Mặt 1...): cố định
- **Mã Giấy Đồng Cấp**: chọn từ danh sách (ví dụ: 98, 87, NKG...). Đây là mã nhóm chất lượng
- **Định lượng (g/m²)**: sau khi chọn mã, danh sách định lượng tự lọc phù hợp

> Ví dụ cấu trúc thùng 3 lớp thông thường:
> - Mặt: mã 98, định lượng 125
> - Sóng B: mã 87, định lượng 112
> - Mặt 1: mã 87, định lượng 112

**Nút "Chọn kết cấu":** Bấm để mở bảng chọn kết cấu nhanh — chọn từ các kết cấu đã được định sẵn thay vì nhập từng lớp.

**Mã Ký Hiệu:** Tự động hiển thị sau khi nhập đủ các lớp. Đây là mã in trên phiếu sản xuất.

**Lấy giá mới NL:** Tick vào nếu muốn tính giá theo giá nguyên liệu mới nhất (thay vì giá chuẩn).

**Đơn giá m²:** Cho phép nhập thủ công đơn giá m² nếu biết trước, thay vì để hệ thống tính.

---

### 4.3 Panel giữa — KÍCH THƯỚC & IN ẤN (nền xanh lá nhạt)

**Kích thước hộp:**

| Trường | Đơn vị | Ghi chú |
|--------|--------|---------|
| Loại thùng/hộp | — | Chọn từ danh sách: A1, A3, A5, Hộp cài, Khay... |
| Dài | cm | Kích thước trong của thùng |
| Rộng | cm | Kích thước trong của thùng |
| Cao | cm | Kích thước trong của thùng |
| Khổ TT | cm | Tự tính, không cần nhập |
| Dài TT | cm | Tự tính, không cần nhập |

Sau khi nhập Loại thùng + D×R×C, hệ thống tự hiển thị thêm:
- **Kho × Dài** (kích thước tờ carton trước khi gấp)
- **KKH** (khổ kế hoạch)
- **Số dao** (số con/dao trên máy)
- Tag **2 mảnh** nếu sản phẩm cần cắt 2 mảnh

**Không CT:** Tick vào nếu muốn tắt tính toán tự động và nhập kích thước thủ công.

**Diện tích (m²):** Tự tính từ kích thước. Dùng trong công thức giá.

---

**Phần in ấn:**

*In thường (Flexo / Kỹ thuật số):*
- Chọn **Loại in** (Không in / Flexo / Kỹ thuật số)
- Nhập **Số màu** nếu có in
- Các ô chống thấm, cán màng, bồi, bế con... xuất hiện khi chọn loại gia công tương ứng

*Tem Offset bồi:* Bật công tắc "Tem offset bồi" để mở thêm phần khai báo:
- Loại giấy tem (DUP / Ivory / Couche)
- GSM
- Số màu, kẹp màu, cán màng, UV, Suppo, Lưới
- Kích thước tờ (tự tính từ D×R×C hoặc nhập thủ công)

---

### 4.4 Panel phải — TÀI CHÍNH (nền cam nhạt)

Panel này dùng để điều chỉnh các chi phí liên quan đến toàn bộ báo giá (không phải từng mặt hàng).

| Trường | Mô tả |
|--------|-------|
| CP bảng in | Chi phí làm bản in (flexo) |
| CP khuôn | Chi phí làm khuôn bế |
| CP vận chuyển | Chi phí giao hàng |
| Tổng tiền hàng | Tổng giá trị các mặt hàng (tính tự động từ số lượng × giá bán) |
| VAT % | Thuế suất, nhập con số (ví dụ: 8 hoặc 10) |
| Tiền VAT | Tự tính |
| CP HH và DV | Tổng tiền hàng + VAT, tự tính |
| CP khác 1 / CP khác 2 | Chi phí phát sinh tự đặt tên (ví dụ: "Phí kiểm hàng") |
| Chiết khấu | Số tiền giảm giá |
| **Giá bán** | **Tổng cộng cuối cùng sau tất cả chi phí và chiết khấu** |
| Giá phôi | Đơn giá phôi carton (tự tính, dùng cho nội bộ) |
| Giá xuất phôi VSP | Đơn giá xuất phôi sang Visunpack (tự tính) |

---

### 4.5 Thêm / Cập nhật dòng hàng

Sau khi điền đủ thông tin:

- **Thêm dòng mới:** Bấm nút **"Thêm vào danh sách"** (góc trên phải của form mặt hàng). Dòng hàng xuất hiện trong bảng bên dưới.
- **Sửa dòng đã có:** Bấm **"Sửa"** ở dòng đó trong bảng → form hiển thị lại nội dung dòng đó, tiêu đề đổi thành "Sửa dòng N" → chỉnh sửa xong bấm **"Cập nhật dòng"**.
- **Huỷ sửa:** Bấm **"Huỷ sửa"** để bỏ qua thay đổi, về lại trạng thái nhập dòng mới.

---

### 4.6 Lưu thông tin về danh mục sản phẩm

Nếu bạn đã **chọn sản phẩm từ danh mục** (ô Tìm SP từ danh mục) và sau đó **chỉnh sửa kích thước hoặc cấu trúc giấy**, bạn có thể cập nhật ngược lại về danh mục:

Bấm nút **"Lưu vào danh mục"** (biểu tượng 🔄, nằm bên trái nút "Thêm vào danh sách") → hệ thống tự cập nhật sản phẩm trong Danh mục sản phẩm với thông tin mới nhất bạn vừa nhập.

> Nút này chỉ hiện ra khi dòng hàng đang chỉnh sửa có liên kết với sản phẩm trong danh mục.

---

## 5. Bảng danh sách mặt hàng

Sau khi thêm, mỗi dòng hàng hiển thị trong bảng với các cột:

| Cột | Nội dung |
|-----|---------|
| STT | Số thứ tự |
| Mã hàng | Mã AMIS nếu có |
| Tên hàng | Tên mặt hàng |
| ĐVT | Đơn vị tính |
| SL | Số lượng báo giá |
| Kết cấu | Số lớp + tổ hợp sóng |
| Loại thùng | Mã kiểu dáng thùng |
| Mã Ký Hiệu | Mã đầy đủ cấu trúc giấy |
| D×R×C | Kích thước |
| S (m²) | Diện tích |
| Loại in | Flexo / KTS / Offset |
| Giá bán | Đơn giá/thùng |
| Thành tiền | Số lượng × Giá bán |

**Các nút hành động trên mỗi dòng:**

- ✏️ **Sửa**: Mở lại form để chỉnh sửa dòng đó
- 📋 **Copy**: Nhân đôi dòng hàng, tạo thêm một dòng giống hệt (tiện khi báo giá nhiều quy cách tương tự)
- 🗑️ **Xoá**: Xoá dòng hàng khỏi báo giá (yêu cầu xác nhận)

---

## 6. Lưu, gửi duyệt và duyệt báo giá

### Lưu báo giá

Bấm nút **"Lưu báo giá"** (nếu tạo mới) hoặc **"Lưu thay đổi"** (nếu đang sửa) ở góc trên phải màn hình.

> Hệ thống cũng **tự lưu** sau mỗi thay đổi (autosave). Giờ lưu tự động hiện bên cạnh tiêu đề.

### Trạng thái báo giá

| Trạng thái | Ý nghĩa | Màu |
|-----------|---------|-----|
| **Mới** | Vừa tạo, đang chỉnh sửa | Xanh dương |
| **Chờ duyệt** | Đã gửi, chờ trưởng phòng duyệt | Vàng |
| **Đã duyệt** | Được duyệt, chốt với khách | Xanh lá |

### Gửi duyệt (nhân viên kinh doanh)

Sau khi hoàn chỉnh báo giá, bấm nút **"Gửi duyệt"**.

- Nếu có mặt hàng chưa nhập giá bán, hệ thống sẽ cảnh báo và hỏi có muốn gửi không.
- Sau khi gửi, **không thể chỉnh sửa** nội dung báo giá nữa.

> Nút "Gửi duyệt" chỉ hiện cho nhân viên kinh doanh thường, không hiện cho Trưởng phòng/Giám đốc.

### Duyệt báo giá (Trưởng phòng / Giám đốc / Admin)

Bấm nút **"Duyệt báo giá"** → xác nhận → trạng thái chuyển sang **Đã duyệt**.

> Sau khi duyệt, nội dung báo giá bị khoá, không sửa được.

---

## 7. Lập đơn hàng từ báo giá

Khi báo giá đã ở trạng thái **Đã duyệt**, nút **"Lập đơn hàng"** (màu xanh lá) xuất hiện ở góc trên phải.

Bấm nút này → hệ thống tạo đơn hàng mới dựa trên toàn bộ thông tin trong báo giá → chuyển sang trang đơn hàng vừa tạo.

---

## 8. Câu hỏi thường gặp

**Q: Tôi nhập kích thước nhưng không thấy Khổ TT và Dài TT thay đổi?**
A: Cần chọn **Loại thùng** trước. Công thức tính kích thước tờ phụ thuộc vào kiểu dáng thùng.

**Q: Nút "Gợi ý" giá không xuất hiện?**
A: Cần nhập đủ: Loại thùng + Dài + Rộng + Cao (nếu không phải tấm lót) + Số lượng + Tổ hợp sóng + tất cả các lớp giấy. Thiếu bất kỳ trường nào nút không hiện.

**Q: Giá bán tính ra bằng 0 hoặc hiện cảnh báo?**
A: Kiểm tra lại giá giấy trong Danh mục → Giá giấy có được cập nhật chưa, và các định mức chi phí trong Cấu hình đã được thiết lập chưa.

**Q: Tôi muốn báo giá nhiều số lượng khác nhau cho cùng 1 sản phẩm?**
A: Bấm nút **Copy** ở dòng hàng đó trong bảng, sau đó bấm Sửa trên dòng copy để đổi số lượng. Giá bán sẽ khác nhau tuỳ số lượng.

**Q: Sao tôi không sửa được báo giá nữa?**
A: Báo giá đã được **gửi duyệt** hoặc **đã duyệt** thì bị khoá. Liên hệ Trưởng phòng nếu cần chỉnh sửa.

**Q: Tìm sản phẩm từ danh mục nhưng không thấy kết quả?**
A: Thử gõ tên hoặc mã AMIS. Nếu đã chọn khách hàng ở trên, hệ thống sẽ ưu tiên hiện sản phẩm của khách đó trước.
