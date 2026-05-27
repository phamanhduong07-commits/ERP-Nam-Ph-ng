# Plan: Module Điều Phối Xe
Date: 2026-05-23
Status: PENDING_APPROVAL

---

## Mục tiêu
Xây dựng module điều phối xe mức 1-2:
- Hiển thị đơn hàng sẵn hàng (TP + phôi) tự động từ tồn kho
- Gợi ý ghép đơn theo tuyến giao hàng
- Dispatcher confirm và điều chỉnh

---

## Tổng quan kiến trúc

```
MYPACKSOFT (SQL Server)
    │  sync mỗi 30 phút
    ▼
ERP PostgreSQL
    ├── Tồn kho TP (từ qlgiaonhan_viewOrderWithStock)
    ├── Tồn kho Phôi (từ DTNPhoi - DTXPhoi)
    └── Đơn cần giao (từ viewTinhTrangDH)
    │
    ▼
Module Điều phối xe
    ├── [Tab 1] Đơn sẵn hàng — grouped by tuyến + ngày giao
    ├── [Tab 2] Tạo chuyến xe — gợi ý + dispatcher confirm
    └── [Tab 3] Lịch sử chuyến xe
```

---

## PHASE 1 — DỮ LIỆU NỀN (1-2 ngày)

### Bước 1.1 — Thu thập tuyến giao hàng từ dispatcher
**Cần hỏi user:**
- Có bao nhiêu tuyến thường xuyên? (ví dụ: Bình Dương, Long An, Nội thành...)
- Mỗi tuyến thường dùng xe nào?
- Xe nào chạy nội bộ (Hóc Môn, Củ Chi)?

**Output:** Danh sách tuyến + xe phụ trách

---

### Bước 1.2 — Migration database
Chạy Alembic migration thêm:

```sql
-- Bảng tuyến giao hàng
CREATE TABLE tuyen_giao_hang (
    id          SERIAL PRIMARY KEY,
    ma_tuyen    VARCHAR(20) UNIQUE NOT NULL,
    ten_tuyen   VARCHAR(100) NOT NULL,
    xe_id       INTEGER REFERENCES xe(id),     -- xe thường chạy tuyến này
    mo_ta       TEXT,
    thu_tu      INTEGER DEFAULT 0,             -- thứ tự hiển thị
    active      BOOLEAN DEFAULT TRUE
);

-- Bảng chuyến xe
CREATE TABLE chuyen_xe (
    id           SERIAL PRIMARY KEY,
    ma_chuyen    VARCHAR(50) UNIQUE,           -- auto: CX-YYYYMMDD-001
    xe_id        INTEGER REFERENCES xe(id),
    tai_xe_id    INTEGER REFERENCES tai_xe(id),
    lo_xe_id     INTEGER REFERENCES lo_xe(id), -- lơ xe (phụ xe)
    ngay         DATE NOT NULL,
    ca           VARCHAR(10),                  -- sang / trua / toi
    tuyen_id     INTEGER REFERENCES tuyen_giao_hang(id),
    trang_thai   VARCHAR(20) DEFAULT 'nhap',   -- nhap/dang_giao/hoan_thanh
    tong_trong_luong NUMERIC,
    tong_the_tich    NUMERIC,
    ghi_chu      TEXT,
    created_by   INTEGER REFERENCES users(id),
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Thêm cột vào delivery_orders
ALTER TABLE delivery_orders
    ADD COLUMN chuyen_xe_id   INTEGER REFERENCES chuyen_xe(id),
    ADD COLUMN phan_xuong_id  INTEGER REFERENCES phan_xuong(id);

-- Thêm cột vào customers
ALTER TABLE customers
    ADD COLUMN tuyen_id       INTEGER REFERENCES tuyen_giao_hang(id),
    ADD COLUMN xuat_phoi      BOOLEAN DEFAULT FALSE;  -- đặt tên rõ hơn mua_phoi
```

---

### Bước 1.3 — Nhập dữ liệu tuyến
- INSERT các tuyến giao hàng (sau khi có info từ Bước 1.1)
- UPDATE xe phụ trách từng tuyến

### Bước 1.4 — Gán tuyến cho khách hàng
- UPDATE customers SET tuyen_id = X cho từng khách (bulk theo khu vực)
- UPDATE customers SET xuat_phoi = TRUE cho 12 khách mua phôi:
  VBO, IMV, NTB, TPH, PHA, AAP, MDU, TYU, TCD, ISG, GPL, DER

---

## PHASE 2 — SYNC DATA TỪ MYPACKSOFT (2-3 ngày)

### Bước 2.1 — Thêm cột mypacksoft_id vào ERP
```sql
ALTER TABLE sales_orders ADD COLUMN mypacksoft_id VARCHAR(50);
ALTER TABLE sales_order_items ADD COLUMN mypacksoft_id VARCHAR(50);
```

### Bước 2.2 — Viết script sync tồn kho TP
File: `migration/sync_ton_kho_tp.py`
- Source: `qlgiaonhan_viewOrderWithStock` (MYPACKSOFT)
- Target: inventory_balances hoặc bảng tạm `ton_kho_tp_sync`
- Key: DTDHID (mypacksoft_id của order item)
- Cột: SLNhap, SLBan, SLTra, SLTon

### Bước 2.3 — Viết script sync đơn cần giao
File: `migration/sync_don_can_giao.py`
- Source: `viewTinhTrangDH` (MYPACKSOFT)
- Target: `sales_orders` + `sales_order_items` (ERP)
- Filter: NgayGH trong 14 ngày tới
- Logic trang thái:
  - Nhập TP > 0, Xuất TP < SoLuong → "san_hang_cho_giao"
  - Nhập phôi > 0, Nhập TP = 0, xuat_phoi = TRUE → "phoi_cho_giao"

### Bước 2.4 — Setup Windows Task Scheduler
```
Tên job: ERP_Sync_TonKho
Lịch: mỗi 30 phút, 6:00 - 22:00
Script: python D:\...\migration\sync_don_can_giao.py
Log: D:\BACKUP\sync_log\sync_YYYY-MM-DD.log
```

---

## PHASE 3 — BACKEND API (2-3 ngày)

### Bước 3.1 — API đơn sẵn hàng
```
GET /api/dieu-phoi/don-san-hang
Params: ngay_giao (date), tuyen_id (optional)
Response: Danh sách đơn grouped by tuyen_giao_hang
  {
    tuyen: { id, ten_tuyen, xe_default },
    don_tp: [ { so_don, ten_kh, dia_chi, sl_ton, trong_luong, ... } ],
    don_phoi: [ { so_don, ten_kh, sl_ton, ... } ]
  }
```

### Bước 3.2 — API chuyến xe CRUD
```
GET    /api/dieu-phoi/chuyen-xe         — danh sách chuyến
POST   /api/dieu-phoi/chuyen-xe         — tạo chuyến mới
PUT    /api/dieu-phoi/chuyen-xe/{id}    — cập nhật
POST   /api/dieu-phoi/chuyen-xe/{id}/goi-y  — gợi ý tự động
POST   /api/dieu-phoi/chuyen-xe/{id}/xac-nhan — confirm chuyến
```

### Bước 3.3 — Logic gợi ý sắp xe (auto-suggest)
```python
def goi_y_sap_xe(ngay, tuyen_id):
    # 1. Lấy đơn sẵn hàng trong ngày thuộc tuyến
    don_list = lay_don_san_hang(ngay, tuyen_id)

    # 2. Lấy xe mặc định của tuyến
    xe = tuyen.xe_id

    # 3. Tính tổng trọng lượng vs tải trọng xe
    tong_kl = sum(d.trong_luong for d in don_list)
    if tong_kl > xe.tai_trong * 1000:  # kg
        # Cảnh báo: cần thêm xe
        pass

    # 4. Trả về gợi ý: 1 chuyến xe với tất cả đơn cùng tuyến
    return { xe, don_list, canh_bao }
```

---

## PHASE 4 — FRONTEND UI (3-4 ngày)

### Bước 4.1 — Tab "Đơn sẵn hàng"
- Bộ lọc: ngày giao, tuyến, loại hàng (TP/phôi)
- Bảng đơn hàng grouped by tuyến
- Màu sắc: đỏ = quá hạn, vàng = hôm nay, xanh = tương lai
- Nút "Gợi ý sắp xe" theo tuyến

### Bước 4.2 — Tab "Tạo chuyến xe"
- Form: chọn xe, tài xế, lơ xe, ngày, ca
- Danh sách đơn được gợi ý (có thể bỏ bớt / thêm)
- Hiển thị tổng trọng lượng / tải trọng xe (%)
- Nút Confirm → tạo delivery_orders + gán chuyen_xe_id

### Bước 4.3 — Tab "Lịch sử chuyến xe"
- Danh sách chuyến xe theo ngày
- Trạng thái: nhap / dang_giao / hoan_thanh
- Click xem chi tiết từng điểm giao

---

## Done Criteria

- [ ] Dispatcher thấy đơn sẵn hàng tự cập nhật mỗi 30 phút
- [ ] Hệ thống gợi ý xe theo tuyến, dispatcher chỉ cần confirm
- [ ] 1 chuyến xe có thể gồm cả đơn khách ngoài lẫn xưởng nội bộ
- [ ] Tổng tải trọng hiển thị và cảnh báo khi quá tải
- [ ] Sync log đầy đủ, alert khi lỗi

---

## Timeline

```
Tuần 1: Phase 1 (thu thập tuyến + migration + gán dữ liệu)
Tuần 2: Phase 2 (sync script từ MYPACKSOFT)
Tuần 3: Phase 3 (backend API)
Tuần 4: Phase 4 (frontend UI)
```

---

## Thông tin cần xác nhận trước khi bắt đầu

1. Danh sách tuyến giao hàng (tên tuyến + khu vực)
2. Xe nào phụ trách tuyến nào
3. Xe nào chạy nội bộ (Hóc Môn, Củ Chi)
4. Ca giao hàng: sáng/trưa/tối hay chỉ có 1 ca?
