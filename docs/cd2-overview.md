# Công Đoạn 2 (CD2) — Tổng quan quy trình & cấu trúc hệ thống

## 1. Quy trình nghiệp vụ

### 1.1 Vòng đời Phiếu In

```
[Lệnh SX]
    │
    ▼
[CHỜ IN] ──► [KẾ HOẠCH] ──► [Máy in cụ thể] ──► [ĐANG IN]
                                                        │
                                                        ▼
                                              [CHỜ ĐỊNH HÌNH]
                                                        │
                                                        ▼
                                    [SAU IN] ◄──── gán máy sau in ────► [ĐANG SAU IN]
                                                        │
                                                        ▼
                                               [HOÀN THÀNH]
                                                    (hoặc HUỶ bất kỳ lúc nào)
```

### 1.2 Các trạng thái phiếu in (`trang_thai`)

| Trạng thái     | Ý nghĩa                                              |
|----------------|------------------------------------------------------|
| `cho_in`       | Mới tạo, chờ lên kế hoạch                           |
| `ke_hoach`     | Đã lên kế hoạch, chưa gán máy (pool chờ)            |
| `dang_in`      | Đang chạy máy in (gán `may_in_id`)                  |
| `cho_dinh_hinh`| In xong, chờ định hình / cấn dán                    |
| `sau_in`       | Đang trong giai đoạn sau in, chờ gán máy sau in      |
| `dang_sau_in`  | Đang chạy trên máy sau in (gán `may_sau_in_id`)     |
| `hoan_thanh`   | Hoàn tất toàn bộ                                     |
| `huy`          | Huỷ (ẩn khỏi kanban)                                |

### 1.3 Các hành động chuyển trạng thái (API PATCH)

| Endpoint                          | Chuyển sang        | Ghi chú                              |
|-----------------------------------|--------------------|--------------------------------------|
| `/phieu-in/{id}/move`             | Bất kỳ             | Drag-drop kanban, kèm `may_in_id`    |
| `/phieu-in/{id}/start`            | `dang_in`          | Ghi `ngay_in = today`                |
| `/phieu-in/{id}/complete`         | `cho_dinh_hinh`    | Lưu kết quả in, xoá `may_in_id`     |
| `/phieu-in/{id}/sau-in`           | `sau_in`           | Lưu kết quả sau in                   |
| `/phieu-in/{id}/assign-sauin`     | —                  | Gán `may_sau_in_id`                  |
| `/phieu-in/{id}/bat-dau-sauin`    | `dang_sau_in`      | Bắt đầu chạy máy sau in              |
| `/phieu-in/{id}/tra-ve-sauin`     | `sau_in`           | Trả về pool chờ, xoá `may_sau_in_id` |
| `/phieu-in/{id}/hoan-thanh`       | `hoan_thanh`       | Kết thúc toàn bộ                     |

---

## 2. Cấu trúc dữ liệu

### 2.1 Các bảng chính (PostgreSQL)

```
may_in              — Danh sách máy in (id, ten_may, sort_order, active, capacity)
may_sau_in          — Danh sách máy sau in (id, ten_may, sort_order, active)
may_scan            — Danh sách máy scan sản lượng (id, ten_may, don_gia, active)

phieu_in            — Phiếu in (đối tượng trung tâm)
  ├── Thông tin đơn hàng: ten_hang, ma_kh, ten_khach_hang, so_don, ngay_giao_hang
  ├── Thông tin kỹ thuật: quy_cach, loai_in, loai, ths, pp_ghep, so_luong_phoi
  ├── Kết quả in:         ngay_in, ca, so_luong_in_ok, so_luong_loi, so_luong_setup
  ├── Kết quả sau in:     ngay_sau_in, ca_sau_in, so_luong_sau_in_ok, so_luong_sau_in_loi
  ├── FK may_in_id        → may_in (khi đang in)
  ├── FK may_sau_in_id    → may_sau_in (khi sau in)
  └── FK production_order_id → production_orders

scan_log            — Log scan sản lượng thực tế
  ├── so_lsx, ten_hang, dai, rong, cao, kho_tt
  ├── so_luong_tp, dien_tich (m²), don_gia, tien_luong
  └── FK may_scan_id → may_scan

shift_ca            — Danh sách ca làm việc (tên ca, trưởng ca)
shift_config        — Lịch ca theo máy và ngày (may_in + shift_ca + ngay + giờ)
printer_user        — Tài khoản máy in vật lý (RFID, token đăng nhập)
```

### 2.2 Quan hệ giữa các bảng

```
production_orders ──► phieu_in ──► may_in
                                └──► may_sau_in

may_scan ──► scan_log
```

---

## 3. Cấu trúc backend

### 3.1 File chính

| File                              | Vai trò                                          |
|-----------------------------------|--------------------------------------------------|
| `backend/app/models/cd2.py`       | Định nghĩa ORM (SQLAlchemy) tất cả bảng CD2     |
| `backend/app/routers/cd2.py`      | Toàn bộ API endpoints (FastAPI router)           |
| `backend/app/services/cd2_service.py` | Tích hợp hệ thống CD2 MES ngoài (`cd2-namphuong.mypacksoft.com`) |

### 3.2 Nhóm API endpoints (`/api/cd2/...`)

| Nhóm             | Endpoints                                            |
|------------------|------------------------------------------------------|
| Máy in           | `GET/POST /may-in`, `PUT/DELETE /may-in/{id}`       |
| Máy sau in       | `GET/POST /may-sau-in`, `PUT/DELETE /may-sau-in/{id}` |
| Máy scan         | `GET/POST /may-scan`, `PUT/DELETE /may-scan/{id}`   |
| Kanban in        | `GET /kanban`                                        |
| Kanban sau in    | `GET /sauin/kanban`                                  |
| Phiếu in         | `GET/POST /phieu-in`, `GET/PUT/DELETE /phieu-in/{id}` |
| Phiếu từ LSX     | `POST /phieu-in/tu-lenh-sx/{order_id}`              |
| Điều phối phiếu  | `PATCH /phieu-in/{id}/move|start|complete|sau-in|hoan-thanh|...` |
| Scan sản lượng   | `GET /scan/lookup/{so_lsx}`, `POST /scan/log`       |
| Lịch sử scan     | `GET /scan/history`                                  |
| Dashboard        | `GET /dashboard`                                     |
| Lịch sử phiếu   | `GET /history/phieu-in`                             |
| Ca làm việc      | `GET/POST /shift/ca`, `PUT/DELETE /shift/ca/{id}`   |
| Lịch ca          | `GET/POST /shift/config`, `DELETE /shift/config/{id}` |
| PrinterUser      | `GET/POST /config/printer-user`, `PUT/DELETE ...`   |

### 3.3 Logic `GET /kanban`

Backend phân phiếu vào các cột:

```python
cho_in        ← trang_thai == "cho_in"
ke_hoach      ← trang_thai == "ke_hoach" AND may_in_id IS NULL
may_{id}      ← trang_thai IN ("ke_hoach","dang_in") AND may_in_id == id
cho_dinh_hinh ← trang_thai == "cho_dinh_hinh"
sau_in        ← trang_thai IN ("sau_in","dang_sau_in")
hoan_thanh    ← trang_thai == "hoan_thanh"
```

### 3.4 Logic `GET /dashboard`

Trả về:
- `phieu_in_counts` — đếm theo 6 trạng thái chính
- `scan_24h` — tổng scan 24h qua (lần scan, SL TP, m², tiền lương)
- `in_hoan_thanh_hom_nay` — số phiếu hoàn thành hôm nay (`ngay_in = today`)
- `may_scan_stats` — thống kê từng máy scan trong 24h (outerjoin để hiện cả máy chưa scan)

### 3.5 Tích hợp CD2 MES ngoài (`cd2_service.py`)

Gọi HTTP thẳng tới server `cd2-namphuong.mypacksoft.com:38981`:
- `cd2_login()` — lấy JWT token
- `cd2_create_dhcho()` — tạo đơn hàng chờ
- `cd2_get_all_dhcho()` — lấy danh sách đơn hàng chờ

Cấu hình trong `.env`: `CD2_URL`, `CD2_USERNAME`, `CD2_PASSWORD`

---

## 4. Cấu trúc frontend

### 4.1 Các trang giao diện

| Trang                         | Route                         | Mô tả                               |
|-------------------------------|-------------------------------|-------------------------------------|
| `CD2DashboardPage.tsx`        | `/production/cd2/dashboard`   | Tổng quan: thống kê trạng thái, scan 24h, quick links |
| `CD2KanbanPage.tsx`           | `/production/cd2`             | Kanban drag-drop máy in + phiếu in  |
| *(SauInKanban)*               | `/production/cd2/sau-in`      | Kanban máy sau in                   |
| *(ScanPage)*                  | `/production/cd2/scan`        | Nhập scan sản lượng theo LSX        |
| *(ScanHistory)*               | `/production/cd2/scan-history`| Lịch sử scan                        |
| *(History)*                   | `/production/cd2/history`     | Lịch sử phiếu in                    |

### 4.2 Frontend API (`frontend/src/api/cd2.ts`)

Tất cả gọi qua `axios client` với `baseURL: '/api'`, tự đính kèm JWT token từ `localStorage`.

Các interface TypeScript chính:
- `PhieuIn` — phiếu in đầy đủ trường
- `KanbanData` — `{ may_ins[], columns: Record<colId, PhieuIn[]> }`
- `SauInKanbanData` — `{ may_sau_ins[], cho_gang_may[], machines }`
- `DashboardData` — thống kê dashboard
- `ScanLog`, `MayScan`, `MayIn`, `MaySauIn`, `ShiftCa`, `ShiftConfig`, `PrinterUser`

### 4.3 Kanban component (`CD2KanbanPage.tsx`)

- Dùng `@dnd-kit/core` cho drag-drop
- Mỗi cột là `KanbanColumn` (droppable)
- Mỗi phiếu là `KanbanCard` (sortable)
- Khi thả: gọi `cd2Api.movePhieuIn(id, { trang_thai, may_in_id, sort_order })`
- `StatCards` ở đầu trang hiển thị đếm nhanh 6 trạng thái + tổng đang xử lý
- Auto-refetch mỗi 30 giây

---

## 5. Số phiếu in

Định dạng tự sinh: **`PIN-YYYYMM-XXXX`**

Ví dụ: `PIN-202604-0001`, `PIN-202604-0012`

Logic: lấy phiếu cuối cùng trong tháng → tăng sequence 4 chữ số.

---

## 6. Scan sản lượng

Quy trình:
1. Công nhân quét barcode LSX → `GET /scan/lookup/{so_lsx}` → auto-điền thông tin hàng, kích thước
2. Nhập số lượng thành phẩm, chọn máy scan, nhập người sản xuất
3. Frontend tính `dien_tich = dien_tich_don_vi × so_luong_tp`
4. Gọi `POST /scan/log` → backend tính `tien_luong = dien_tich × don_gia_may`
5. Lưu vào bảng `scan_log`

---

## 7. Cấu hình hệ thống

| Thực thể        | Quản lý bởi                  | Ghi chú                              |
|-----------------|------------------------------|--------------------------------------|
| `MayIn`         | `MayInSettingsModal`         | CRUD, sắp xếp thứ tự, capacity       |
| `MaySauIn`      | Settings modal               | CRUD                                  |
| `MayScan`       | Settings                     | CRUD + đơn giá lương                 |
| `ShiftCa`       | Settings                     | Tên ca, trưởng ca                    |
| `ShiftConfig`   | Settings                     | Lịch ca theo máy và ngày             |
| `PrinterUser`   | `/config/printer-user`       | Tài khoản RFID cho máy in vật lý     |
