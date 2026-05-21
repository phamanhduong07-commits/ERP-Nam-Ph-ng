# Plan: GPS Sprint 5 — Drain Alert Workflow + tiêu hao bất thường
Date: 2026-05-21
Status: PENDING_APPROVAL

## Mục tiêu
Nâng điểm từ ~8.2 → 9/10 bằng 5 cải tiến:
1. API liệt kê + cập nhật trạng thái `drain_alert_logs`
2. UI quản lý workflow cảnh báo rút dầu (Mới / Đang xử lý / Đã xử lý)
3. Poller safety: `_check_drain_realtime` trong try/except riêng
4. Phát hiện tiêu hao bất thường khi xe chạy (`tieu_hao_bat_thuong`)
5. Wire route + menu mục mới vào App.tsx

## Các bước thực thi

- [ ] **B1: Thêm `trang_thai` vào DrainAlertLog + DDL migration**
  - File: `backend/app/models/gps.py`
  - Thêm: `trang_thai: Mapped[str] = mapped_column(String(20), default="moi")` — giá trị: moi/dang_xu_ly/da_xu_ly
  - File: `backend/app/routers/gps.py` — chạy DDL `ALTER TABLE drain_alert_logs ADD COLUMN trang_thai VARCHAR(20) DEFAULT 'moi'` trực tiếp qua `init_db_extras()` (pattern cũ)
  - Tại sao: Alembic multi-head vẫn còn conflict → dùng cách apply DDL trực tiếp như Sprint 3

- [ ] **B2: Thêm `GET /gps/drain-alerts` + `PUT /gps/drain-alerts/{id}` vào gps.py**
  - GET: filter `from_date`, `to_date`, `bien_so`, `trang_thai` (tất cả optional)
  - PUT: chỉ cho phép update `trang_thai` → 200 + object mới
  - Auth: `Depends(get_current_user)` (không cần admin)
  - Sort: `ngay desc, id desc`, limit 500

- [ ] **B3: Poller safety — try/except riêng cho `_check_drain_realtime`**
  - File: `backend/app/routers/gps.py` — hàm `gps_poller_loop`
  - Hiện: cả `_check_drain_realtime` và `_try_save_snapshots` nằm trong 1 try block lớn
  - Fix: wrap `_check_drain_realtime` trong try/except riêng trước khi gọi `_try_save_snapshots`
  - Kết quả: nếu socket hoặc DB log fail → snapshots vẫn được lưu

- [ ] **B4: Cache dinh_muc + phát hiện `tieu_hao_bat_thuong` khi xe chạy**
  - File: `backend/app/routers/gps.py`
  - Thêm `_xe_dinh_muc_cache: dict[str, float]` (normalized_plate → dinh_muc, L/100km)
  - Cập nhật `_refresh_xe_cache` để load thêm `Xe.dinh_muc_dau`
  - Thêm `km_today` vào `_prev_snap` fields (để tính delta km)
  - Logic detect trong `_check_drain_realtime` khi `not curr_stop`:
    - km_delta = curr_km - prev_km (skip nếu <= 0 hoặc > 999 reset GPS)
    - expected_L = km_delta × dinh_muc / 100
    - nếu drop >= DRAIN_THRESHOLD AND drop > expected_L × DRAIN_WHILE_MOVING_FACTOR
    - → log phan_loai="tieu_hao_bat_thuong", emit socket drain_alert (same payload)

- [ ] **B5: Tạo `frontend/src/pages/logistics/CanhBaoDauPage.tsx`**
  - DateRangePicker (mặc định 7 ngày gần nhất)
  - Filter biển số (text input) + filter trạng thái (Select: tất cả/moi/dang_xu_ly/da_xu_ly)
  - Statistic cards: Tổng / Chưa xử lý / Đang xử lý / Đã xử lý
  - Table columns: Biển số | Ngày | Giờ | Hụt (L) | Rate (L/h) | Loại | Địa điểm | Trạng thái (Tag + inline Select)
  - Khi thay đổi trang_thai → `PUT /api/gps/drain-alerts/{id}` → invalidateQueries

- [ ] **B6: Wire CanhBaoDauPage vào App.tsx + menu logistics**
  - Thêm `lazy(() => import('./pages/logistics/CanhBaoDauPage'))` vào imports
  - Thêm `<Route path="logistics/canh-bao-dau" ...>` vào Routes
  - Tìm menu logistics (sidebar/layout) thêm mục "Cảnh báo dầu"

## Done Criteria
- [ ] `GET /api/gps/drain-alerts` trả 200, filter hoạt động đúng
- [ ] `PUT /api/gps/drain-alerts/{id}` cập nhật trang_thai thành công
- [ ] `trang_thai` column tồn tại trong DB
- [ ] Poller loop: khi `_check_drain_realtime` ném exception → snapshots vẫn được lưu (logic riêng)
- [ ] `tieu_hao_bat_thuong` detect được khi xe chạy và drop > 2.5× định mức
- [ ] CanhBaoDauPage render, filter, và update trạng thái hoạt động
- [ ] Route `/logistics/canh-bao-dau` accessible
- [ ] Lint: không có error
- [ ] Frontend build: không bị ảnh hưởng

## Rủi ro
- Alembic conflict → không dùng alembic, thêm column qua DDL check `PRAGMA table_info` trước
- `tieu_hao_bat_thuong`: km_today reset về 0 lúc 0h → km_delta âm → skip
- `dinh_muc_dau = 0` cho xe chưa cài → bỏ qua moving detection cho xe đó
- `_xe_plate_cache` hiện là `dict[str, int]` → cần thêm `_xe_dinh_muc_cache` riêng để không phá type
