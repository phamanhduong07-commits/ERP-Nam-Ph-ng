# Plan: TabGiaoHang — Fix backend + hoàn thiện modal

Date: 2026-05-16
Status: PENDING_APPROVAL

## Mục tiêu
Sửa 2 bug backend làm hỏng tính năng vừa implement (Người lập + filter pháp nhân),
đồng thời bổ sung các field còn thiếu trong modal lập phiếu BH và lưu tiền chuyến vào DB.

---

## Root cause phát hiện

### Bug 1 — `created_by_name` luôn null
- **File**: `backend/app/routers/warehouse.py`
- **Endpoint**: `GET /warehouse/deliveries` (list) + `GET /warehouse/deliveries/{id}` (detail)
- **Nguyên nhân**:
  - Model `DeliveryOrder` CÓ `created_by` FK và relationship `creator → User` (dòng 173, 179)
  - Nhưng query **không có** `joinedload(DeliveryOrder.creator)` → `creator` = None khi truy cập
  - Và `_do_to_dict()` **không thêm** `created_by_name` vào dict return
- **Hậu quả**: Cột "Người lập" trong Tab 4 luôn hiển thị "—"

### Bug 2 — Filter `phap_nhan_id` không hoạt động
- **File**: `backend/app/routers/warehouse.py`
- **Endpoint**: `GET /warehouse/deliveries`
- **Nguyên nhân**: Parameter `phap_nhan_id` được khai báo nhưng **không được apply** vào query builder
- **Hậu quả**: Chọn pháp nhân ở Tab 4 không lọc được gì

---

## Các bước thực thi

### Bước 1 — Fix backend: `created_by_name` [BACKEND]
- File: `backend/app/routers/warehouse.py`
- 1a. Thêm `joinedload(DeliveryOrder.creator)` vào query của `list_deliveries`
- 1b. Thêm `"created_by_name": do.creator.ho_ten if do.creator else None` vào `_do_to_dict()`

### Bước 2 — Fix backend: `phap_nhan_id` filter [BACKEND]
- File: `backend/app/routers/warehouse.py`
- Thêm param `phap_nhan_id: Optional[int] = Query(None)` vào signature (nếu chưa có)
- Thêm vào query: `if phap_nhan_id: q = q.filter(DeliveryOrder.phap_nhan_id == phap_nhan_id)`

### Bước 3 — Fix frontend: xóa imports thừa [FRONTEND]
- File: `frontend/src/pages/production/TabGiaoHang.tsx`
- Xóa `printDocument` khỏi import (không được dùng)
- Xóa `useEffect` khỏi import (không được dùng)

### Bước 4 — Bổ sung modal: `dia_chi_giao` + `nguoi_nhan` + `ghi_chu` [FRONTEND]
- File: `frontend/src/pages/production/TabGiaoHang.tsx`
- Modal lập phiếu BH trực tiếp (isRequest=false) hiện thiếu:
  - `dia_chi_giao` — Input text, auto-fill từ tồn kho nhưng user cần chỉnh
  - `nguoi_nhan` — Input text, tên người nhận tại điểm giao
  - `ghi_chu` — TextArea ghi chú cho phiếu
- Thêm 3 field này vào Form (2 dòng cuối của modal, full-width)

### Bước 5 — Lưu `tien_van_chuyen` vào API khi submit [FRONTEND]
- File: `frontend/src/pages/production/TabGiaoHang.tsx`
- Hiện tại: breakdown lương chuyến hiển thị nhưng **không được gửi** lên API
- Fix: trong `handleSaveModal`, thêm `tien_van_chuyen: estimatedTripMoney` vào payload
- Cụ thể: `createDOMutation.mutate({ ...vals, tien_van_chuyen: estimatedTripMoney, ... })`

### Bước 6 — Fix lịch sử PBH: thêm cột "Lơ xe 2" [FRONTEND]
- File: `frontend/src/pages/production/TabGiaoHang.tsx`
- Vấn đề: bảng lịch sử phiếu bán hàng (`doCols`) chỉ có cột `ten_lo_xe` (Lơ xe),
  nhưng một chuyến có thể có 2 lơ xe (lo_xe_id + lo_xe_id_2)
- Fix:
  - Trong `doCols`: thêm `{ title: 'Lơ xe 2', dataIndex: 'ten_lo_xe_2', width: 110 }` ngay sau cột "Lơ xe"
  - Trong Excel export columns: thêm `{ key: 'ten_lo_xe_2', label: 'Lơ xe 2', width: 18 }` ngay sau `ten_lo_xe`

### Bước 7 — Fix tồn kho TP: đổi nhãn cột từ (tấm) → (thùng) [FRONTEND]
- File: `frontend/src/pages/production/TabGiaoHang.tsx`
- Vấn đề: `tpCols` có 3 cột với nhãn "(tấm)" — 'Nhập (tấm)', 'Xuất (tấm)', 'Tồn (tấm)'
  nhưng bảng này là tồn kho **thành phẩm** (hộp carton), đơn vị phải là **(thùng)**
- Lý do: `TonKhoTPRow.dvt = "Thùng"` cho thành phẩm, không phải tấm
  (tấm là đơn vị của phôi sóng — tab Kho phôi đã có cột "(tấm)" đúng)
- Fix: đổi 3 title → 'Nhập (thùng)', 'Xuất (thùng)', 'Tồn (thùng)'

---

## Done Criteria
- [ ] Column "Người lập" Tab 4 hiển thị tên thật (không phải "—")
- [ ] Filter pháp nhân Tab 4 thực sự lọc được dữ liệu
- [ ] TypeScript 0 lỗi (tsc --noEmit)
- [ ] Modal PBH có field dia_chi_giao, nguoi_nhan, ghi_chu
- [ ] `tien_van_chuyen` được lưu vào phiếu khi tạo
- [ ] Không còn unused import warning
- [ ] Bảng lịch sử PBH có 2 cột lơ xe (Lơ xe + Lơ xe 2)
- [ ] Bảng tồn kho TP dùng nhãn "(thùng)" thay "(tấm)"

## Rủi ro
- `creator.ho_ten` có thể null nếu user bị xóa → dùng `do.creator.ho_ten if do.creator else None`
- `tien_van_chuyen` = `estimatedTripMoney` chỉ đúng khi có tripRate; khi = 0 thì không gửi
