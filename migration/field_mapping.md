# Field Mapping: MYPACKSOFT → ERP Mới
Date: 2026-05-23

---

## 1. Khách hàng: DMKhachHang → customers

| MYPACKSOFT | ERP mới | Ghi chú |
|---|---|---|
| MaKH | ma_kh | Mã khách hàng — dùng làm mypacksoft_id |
| TenTat | ten_viet_tat | Tên viết tắt |
| TenKH | ten_don_vi | Tên đầy đủ |
| DiaChi | dia_chi | Địa chỉ |
| GiaoHang | dia_chi_giao_hang | Địa chỉ giao hàng |
| MST | ma_so_thue | Mã số thuế |
| DienThoai | so_dien_thoai | SĐT chính |
| SDT_LH | so_dien_thoai_lh | SĐT liên hệ |
| HMNo | han_muc_no | Hạn mức nợ |
| HTTT | hinh_thuc_thanh_toan | Hình thức thanh toán |
| TGNo | thoi_gian_no | Số ngày được nợ |
| Duyet | trang_thai | 1=active, 0=inactive |
| GhiChu | ghi_chu | Ghi chú |
| GhiChuGH | ghi_chu_giao_hang | Ghi chú giao hàng |

**Lưu ý:** MaKH lưu vào trường `mypacksoft_id` để tránh trùng khi sync

---

## 2. Đơn hàng header: MTDonHang → sales_orders

| MYPACKSOFT | ERP mới | Ghi chú |
|---|---|---|
| MTDHID | mypacksoft_id | UUID — dùng làm key sync |
| SoDH | so_don | Số đơn hàng |
| NgayCT | ngay_don | Ngày chứng từ |
| MaKH | customer_id | JOIN DMKhachHang → customers.id |
| NVPT | nv_kinh_doanh_id | Nhân viên phụ trách |
| DiaChi | dia_chi_giao | Địa chỉ giao hàng |
| TrangThai | trang_thai | Trạng thái đơn |
| Huy | — | Nếu Huy=1 → trang_thai = "huy" |
| Duyet | — | Nếu Duyet=1 → trang_thai = "da_duyet" |
| NgayDuyet | approved_at | Ngày duyệt |

**Mapping trạng thái:**
```
Huy = 1             → "huy"
Duyet = 1, Huy = 0  → "da_duyet"
Duyet = 0, Huy = 0  → "moi"
```

---

## 3. Đơn hàng chi tiết: DTDonHang → sales_order_items

| MYPACKSOFT | ERP mới | Ghi chú |
|---|---|---|
| DTDHID | mypacksoft_id | UUID của dòng |
| MTDHID | order_id | JOIN MTDonHang → sales_orders.id |
| TenHang | ten_hang | Tên hàng |
| DVT | dvt | Đơn vị tính |
| SoLuong | so_luong | Số lượng |
| GiaBan | don_gia | Đơn giá bán |
| ThanhTien | thanh_tien | Thành tiền |
| NgayGH | ngay_giao_hang | Ngày giao hàng |
| Dai | dai | Chiều dài (mm) |
| Rong | rong | Chiều rộng (mm) |
| Cao | cao | Chiều cao (mm) |
| KetCau | to_hop_song | Kết cấu (3 lớp, 5 lớp...) |
| LoaiThung | loai_thung | Loại thùng |
| Mat_Giay | mat | Giấy mặt |
| SB_Giay | song_1 | Giấy sóng B |
| MB_Giay | mat_1 | Giấy mặt B |
| SC_Giay | song_2 | Giấy sóng C |
| MC_Giay | mat_2 | Giấy mặt C |
| Mat_DL | mat_dl | Định lượng mặt |
| SB_DL | song_1_dl | Định lượng sóng B |
| LoaiIn | loai_in | Loại in |
| SoMau | so_mau | Số màu |
| GhiChu | ghi_chu_san_pham | Ghi chú sản phẩm |

---

## 4. Xe: DMXe → xe

| MYPACKSOFT | ERP mới | Ghi chú |
|---|---|---|
| ID | mypacksoft_id | ID số nguyên |
| SoXe | bien_so | Biển số xe |
| Loai | loai_xe | Loại xe |
| TaiTrong | trong_tai | Tải trọng (tấn) |
| SoM3 | — | Thể tích m3 (ERP mới chưa có — cần thêm) |
| TenTX | — | Tên tài xế (lưu riêng bảng tai_xe) |
| SoDT | — | SĐT tài xế (lưu riêng bảng tai_xe) |
| Duyet | trang_thai | 1=active |
| QuyCach | ghi_chu | Quy cách xe |

**Lưu ý:** TenTX + SoDT trong DMXe → tạo bản ghi tai_xe riêng và link xe_id

---

## 5. Phiếu điều xe: DS_PhieuDieuXe → yeu_cau_giao_hang

| MYPACKSOFT | ERP mới | Ghi chú |
|---|---|---|
| ID | mypacksoft_id | |
| SoPhieu | so_yeu_cau | Số phiếu |
| SoXe | xe_id | JOIN DMXe.SoXe → xe.id |
| KhachHang | customer_id | Tên KH → JOIN customers |
| NgayGH | ngay_giao_yeu_cau | Ngày giao hàng |
| SoM3 | — | Thể tích (chưa có trong ERP mới) |
| SoM2 | — | Diện tích (chưa có trong ERP mới) |
| ChuyenGH | ghi_chu | Thông tin chuyến |

---

## 6. Hàng hóa: DMHH → products

| MYPACKSOFT | ERP mới | Ghi chú |
|---|---|---|
| MaHH | ma_hang / mypacksoft_id | Mã hàng hóa |
| TenHH | ten_hang | Tên hàng hóa |
| DVT | dvt | Đơn vị tính |
| QuyCach | quy_cach | Quy cách |
| GiaBan | gia_ban | Giá bán |
| GiaMua | gia_mua | Giá mua |
| TonTT | — | Tồn kho hiện tại (lưu vào inventory) |
| Loai | loai | Loại hàng hóa |
| GhiChu | ghi_chu | Ghi chú |

---

## Các trường cần THÊM vào ERP mới

| Bảng ERP mới | Trường cần thêm | Lý do |
|---|---|---|
| customers | mypacksoft_id (varchar 16) | Key sync, tránh trùng |
| sales_orders | mypacksoft_id (uuid) | Key sync |
| sales_order_items | mypacksoft_id (uuid) | Key sync |
| xe | mypacksoft_id (int) | Key sync |
| xe | so_m3 (decimal) | Thể tích xe — có trong MYPACKSOFT |
| yeu_cau_giao_hang | mypacksoft_id (int) | Key sync |
| products | mypacksoft_id (varchar 200) | Key sync |

---

## Lưu ý quan trọng

1. **DMMay không phải master máy móc** — đây là bảng log sản xuất (Số LSX, SL In, SL Hư...)
   → Cần tìm bảng máy móc thật hoặc tạo mới trong ERP

2. **DMXe gộp tài xế vào** (TenTX, SoDT) — ERP mới tách riêng bảng tai_xe
   → Khi import xe: tạo luôn bản ghi tai_xe tương ứng

3. **MTDonHang dùng UUID** (MTDHID) — khác ERP mới dùng integer ID
   → Lưu vào mypacksoft_id dạng string, không dùng làm PK

4. **Không có updated_at trong MYPACKSOFT** — không sync incremental được bằng timestamp
   → Sync bằng cách so sánh SoDH (số đơn hàng) với lần sync trước

5. **DS_PhieuDieuXe ít cột** — chỉ có xe, khách, ngày, thể tích
   → Đủ để làm tính năng sắp xe cơ bản
