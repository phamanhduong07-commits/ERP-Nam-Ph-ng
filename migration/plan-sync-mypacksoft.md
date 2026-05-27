# Plan: Tích hợp MYPACKSOFT → ERP Mới
Date: 2026-05-23
Status: PENDING_APPROVAL

---

## Mục tiêu

Cho phép 3 dev phát triển ERP mới dựa trên dữ liệu thật từ MYPACKSOFT,
không phụ thuộc vào MYPACKSOFT về lâu dài.

---

## Tổng quan kiến trúc

```
MYPACKSOFT SQL Server (203.162.54.176,1441)
          │
          │  Giai đoạn 1: Export 1 lần (master data)
          │  Giai đoạn 2: Sync tự động (data thay đổi hàng ngày)
          ▼
ERP mới PostgreSQL (192.168.1.128:5432)
          │
          ▼
3 Dev phát triển hoàn toàn trên PostgreSQL
Không cần kết nối MYPACKSOFT khi dev
```

---

## Phân loại dữ liệu

### Loại A — Export 1 lần (master data, ít thay đổi)
| Bảng MYPACKSOFT | Bảng ERP mới | Ghi chú |
|---|---|---|
| DMKhachHang | customers | Khách hàng |
| DMNCC / DMNhaCungCap | suppliers | Nhà cung cấp |
| DMHH | products | Hàng hóa |
| DMVatTu | materials | Vật tư |
| DMMay, DMMaySX | machines | Máy móc |
| DMXe | xe | Xe vận chuyển |
| PhongBan | departments | Phòng ban |
| DMNhomGiay | paper_groups | Nhóm giấy |
| GP_DMKetCau | box_structures | Kết cấu thùng |
| GP_CorGiayCuon | paper_prices | Giá giấy cuộn |

### Loại B — Sync tự động (thay đổi hàng ngày)
| Bảng MYPACKSOFT | Bảng ERP mới | Tần suất |
|---|---|---|
| DTDonHang | sales_orders | Mỗi 30 phút |
| DS_PhieuDieuXe | yeu_cau_giao_hang | Mỗi 30 phút |
| DTDieuVan | delivery_orders | Mỗi 30 phút |
| DTKH / DTLSX | production_orders | Mỗi 60 phút |

---

## Các bước thực hiện

### GIAI ĐOẠN 1 — PHÂN TÍCH DỮ LIỆU (1-2 ngày)
**Mục tiêu:** Hiểu rõ cấu trúc cột MYPACKSOFT trước khi viết script

- [ ] Bước 1.1: Chạy queries xem cột DTDonHang trong SSMS
- [ ] Bước 1.2: Chạy queries xem cột DMXe, DS_PhieuDieuXe, DTDieuVan
- [ ] Bước 1.3: Chạy queries xem cột DMKhachHang, DMHH, DMVatTu
- [ ] Bước 1.4: Xem dữ liệu mẫu (SELECT TOP 10) từng bảng
- [ ] Bước 1.5: Lập bảng mapping chi tiết cột MYPACKSOFT → ERP mới
- [ ] Bước 1.6: Xác định cột nào không có trong ERP mới → thêm hay bỏ qua

**Output:** File `migration/field_mapping.md` chứa mapping chi tiết từng cột

---

### GIAI ĐOẠN 2 — EXPORT MASTER DATA (1 ngày)
**Mục tiêu:** Đưa dữ liệu master vào PostgreSQL để 3 dev có data thật

- [ ] Bước 2.1: Cài thư viện
  ```
  pip install pyodbc pandas sqlalchemy psycopg2-binary
  ```
- [ ] Bước 2.2: Viết `migration/export_master.py`
  - Kết nối SQL Server MYPACKSOFT
  - Export từng bảng Loại A ra CSV
  - Validate số dòng sau export
- [ ] Bước 2.3: Viết `migration/import_master.py`
  - Đọc CSV → map sang schema ERP mới → import PostgreSQL
  - Validate số dòng sau import
- [ ] Bước 2.4: Chạy export → import → kiểm tra kết quả
- [ ] Bước 2.5: Báo 3 dev bắt đầu dev được

**Output:** PostgreSQL có đủ master data (khách hàng, xe, hàng hóa, vật tư...)

---

### GIAI ĐOẠN 3 — SYNC TỰ ĐỘNG HÀNG NGÀY (3-5 ngày)
**Mục tiêu:** Đơn hàng mới từ MYPACKSOFT tự động xuất hiện trong ERP mới

- [ ] Bước 3.1: Thêm cột `mypacksoft_id` vào bảng liên quan trong ERP mới
  - sales_orders.mypacksoft_id
  - yeu_cau_giao_hang.mypacksoft_id
  - Dùng để tránh import trùng (upsert key)
- [ ] Bước 3.2: Viết `migration/sync_daily.py`
  - Lấy records mới/cập nhật trong 24h (dựa vào ngay_don hoặc updated_at)
  - Map sang schema ERP mới
  - Upsert vào PostgreSQL (insert mới, update nếu đã có)
- [ ] Bước 3.3: Test sync với dữ liệu thật
  - Tạo đơn hàng mới trong MYPACKSOFT
  - Chờ 30 phút → kiểm tra xuất hiện trong ERP mới
- [ ] Bước 3.4: Đặt lịch tự động — Windows Task Scheduler
  - Chạy mỗi 30 phút, 6:00 - 22:00
  - Log vào `D:\BACKUP\sync_log\sync_YYYY-MM-DD.log`
  - Telegram alert nếu sync lỗi

**Output:** Đơn hàng từ MYPACKSOFT tự động vào ERP mới mỗi 30 phút

---

### GIAI ĐOẠN 4 — 3 DEV PHÁT TRIỂN MODULE (song song, 2-4 tuần)
**Mục tiêu:** 3 dev làm việc hoàn toàn trên ERP mới

- [ ] Dev 1: Module Yêu cầu mua VPP (task DEV1)
  - Cần: users, departments → có sau giai đoạn 2
- [ ] Dev 2: Module Điều phối xe (task DEV2)
  - Cần: sales_orders (sync), xe, tai_xe → có sau giai đoạn 3
- [ ] Dev 3: Module QC + Bảo dưỡng (task DEV3)
  - Cần: machines → có sau giai đoạn 2

---

### GIAI ĐOẠN 5 — VALIDATE (3-5 ngày)
- [ ] Bước 5.1: So sánh tổng records MYPACKSOFT vs ERP mới
- [ ] Bước 5.2: Kiểm tra 10 đơn hàng ngẫu nhiên — khớp không?
- [ ] Bước 5.3: Test sync realtime end-to-end
- [ ] Bước 5.4: Test 3 module với data thật
- [ ] Bước 5.5: Kiểm tra sync log — có lỗi không?

---

### GIAI ĐOẠN 6 — DÀI HẠN (3-6 tháng)
- [ ] Khi module đủ mạnh: chuyển nhân viên nhập liệu vào ERP mới
- [ ] Tắt sync từng phần khi ERP mới thay thế được MYPACKSOFT
- [ ] Khi 100% chạy trên ERP mới: dừng trả phí MYPACKSOFT

---

## Done Criteria

- [ ] PostgreSQL có đủ master data từ MYPACKSOFT
- [ ] Đơn hàng mới sync tự động mỗi 30 phút
- [ ] 3 dev dev được hoàn toàn không cần kết nối MYPACKSOFT
- [ ] Sync log đầy đủ, alert khi lỗi
- [ ] Số liệu khớp 2 hệ thống (sai lệch < 0.1%)

---

## Rủi ro và xử lý

| Rủi ro | Xử lý |
|---|---|
| Schema không khớp | Thêm cột vào ERP hoặc bỏ qua cột không dùng |
| MYPACKSOFT không có updated_at | Dùng ngay_don hoặc ID lớn hơn lần sync trước |
| Trùng dữ liệu khi sync | mypacksoft_id làm unique key, upsert |
| MYPACKSOFT offline | Retry 3 lần, log lỗi, Telegram alert |
| IP MYPACKSOFT thay đổi | Lưu vào .env, dễ thay |

---

## Timeline

```
Tuần 1:   Giai đoạn 1 + 2  (phân tích + export master data)
Tuần 2:   Giai đoạn 3      (sync tự động)
Tuần 2-5: Giai đoạn 4      (3 dev làm module song song)
Tuần 5-6: Giai đoạn 5      (validate)
Tháng 3+: Giai đoạn 6      (migration dài hạn)
```

---

## Files sẽ tạo

```
erp-nam-phuong/
└── migration/
    ├── plan-sync-mypacksoft.md  ← file này
    ├── field_mapping.md         ← Bước 1.5
    ├── export_master.py         ← Bước 2.2
    ├── import_master.py         ← Bước 2.3
    ├── sync_daily.py            ← Bước 3.2
    └── validate.py              ← Bước 5.1
```
