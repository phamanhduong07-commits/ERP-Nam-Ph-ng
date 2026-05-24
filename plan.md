# Plan: Trang Trả Hàng Bán — Cải thiện 6 tiêu chí
Date: 2026-05-24
Status: DONE ✅ (2026-05-24)

## Mục tiêu
Nâng chất lượng trang Trả hàng bán từ **64% → 85%+** bằng cách giải quyết các gap đã phân tích.
6 hạng mục theo đúng thứ tự ưu tiên: Bug trước → Security → Logic → UX → Tích hợp → Refactor.

---

## Hạng mục 1 — Bug Fix (Kỹ thuật) 🔴

**Vấn đề:** `ghi_chu` của từng item không bao giờ được lưu khi edit.
Root cause: Form.Item đặt `name="ghi_chu_item_{id}"` nhưng `handleSave` đọc `values["ghi_chu_{id}"]`.

- [x] **B1** — Fix key mismatch trong `handleSave`
- [x] **B2** — Fix type cast `(returnsData as any)?.summary` → `PagedReturnsResponse`
- [x] **B3** — Fix `customers` list hard-code `page_size: 100` → `500`

---

## Hạng mục 2 — Security (Phân quyền) 🔴

- [x] **S1** — `approve_return`: dùng `require_permissions("sales_order.approve")`
- [x] **S2** — `cancel_return`: role check cho hủy phiếu đã duyệt
- [x] **S3** — Frontend: nút Duyệt/Hủy gated by `APPROVE_ROLES`

---

## Hạng mục 3 — Logic nghiệp vụ (Đầy đủ nghiệp vụ) 🟡

- [x] **L1** — Cancel endpoint: xử lý CustomerRefundVoucher mồ côi
- [x] **L2** — Summary KPI: context filter (customer_id, tu_ngay, den_ngay)

---

## Hạng mục 4 — UX / Khả năng sử dụng 🟡

- [x] **U1** — Items table: `scroll={{ x: 900 }}`
- [x] **U2** — Pagination reset khi đổi phuongAn filter
- [x] **U3** — Empty state rõ ràng khi không có kết quả
- [x] **U4** — KPI cards label "Theo bộ lọc hiện tại" khi filter active

---

## Hạng mục 5 — Tích hợp module khác 🟡

- [x] **I1** — Phiếu giao hàng: clickable link navigate đến delivery order
- [x] **I2** — Invalidate `debt-ledger` + `customer-debt` sau approve/cancel

---

## Hạng mục 6 — Bảo trì (Refactor) 🟢

- [x] **R1** — `PHUONG_AN_LABELS` → single source of truth tại `api/salesReturns.ts`
- [x] **R2** — Xóa dead import `Badge`
- [x] **R3** — IIFE extracted → `renderApprovedSidebar()` named function; dead code removed

---

## Thứ tự thực thi

```
B1 → B2 → B3  (fix bugs trước — không phụ thuộc gì)
S1 → S2 → S3  (security — backend trước, frontend sau)
L1 → L2       (logic — backend)
U1 → U2 → U3 → U4  (UX — frontend)
I1 → I2       (integration — frontend)
R1 → R2 → R3  (refactor — cuối cùng)
```

Tổng: **15 bước**, ước ~4-5 giờ.

---

## Done Criteria
- [ ] Edit items → save → reload: `ghi_chu` item được lưu đúng
- [ ] User role `nhan_vien` gọi `PATCH /sales-returns/:id/approve` → 403
- [ ] Cancel phiếu `da_duyet` có refund voucher `da_duyet` → API trả lỗi rõ ràng
- [ ] Cancel phiếu `da_duyet` có refund voucher `nhap` → voucher bị xóa, kho/bút toán đảo ngược
- [ ] Phiếu giao hàng trong Detail page có thể click navigate
- [ ] `PHUONG_AN_LABELS` không còn duplicate (grep → 1 kết quả duy nhất)
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `Badge` không còn trong import list SalesReturnDetail.tsx

## Rủi ro
- S1/S2: cần đồng bộ với bảng `permissions` hiện tại — kiểm tra `project_permission_matrix.md` để dùng đúng role name
- L1: khi cancel và refund đã duyệt → raise error; UX cần hiển thị lỗi này rõ ràng trong modal confirm
- R3: extract component không thay đổi logic — chỉ di chuyển JSX, safe

---

# Plan: Code Cleanup — BOM, Dead Code, Unused Imports
Date: 2026-05-23
Status: PENDING_APPROVAL

## Mục tiêu
Làm sạch codebase: loại bỏ dead code, unused imports, và BOM encoding
KHÔNG thay đổi bất kỳ logic nghiệp vụ nào.

## Các bước thực thi

- [ ] Bước 1: Xóa BOM khỏi 17 Python files
  File: backend/app/deps.py, routers/{auth,ccdc,hr,hr_workflow,purchase_orders,
  purchase_requisitions,purchase_returns,quality_control,quotes,sales_orders,
  sales_returns,warehouse}.py, services/{accounting_service,billing_service,
  inventory_service}.py, agent/tool_executor.py
  Mục tiêu: Python files không có UTF-8 BOM (0xEF BB BF) ở đầu

- [ ] Bước 2: Xóa unused imports trong backend
  File: backend/app/models/gps.py (Decimal, Numeric)
        backend/app/routers/qc_giay_cuon.py (func)
  Mục tiêu: Không còn import dead trong các file này

- [ ] Bước 3: Xóa dead file frontend
  File: frontend/src/pages/master/PhapNhanPage.tsx (xóa — không dùng ở đâu)
        frontend/src/api/phap-nhan.ts (xóa — phiên bản cũ)
  Cập nhật: frontend/src/pages/master/PrintTemplatePage.tsx
    → đổi import từ ../../api/phap-nhan sang ../../api/phap_nhan
  Mục tiêu: Không còn file phap-nhan.ts, không còn import đến file cũ

## Done Criteria
- [ ] python -m py_compile trên tất cả 17 file → ALL OK
- [ ] Không file Python nào bắt đầu bằng 0xEF BB BF
- [ ] npx tsc --noEmit trong frontend/ → 0 errors
- [ ] grep -r "phap-nhan" frontend/src/ → 0 kết quả

## Rủi ro
- BOM removal: không ảnh hưởng logic, chỉ thay đổi encoding bytes
- Unused imports: được confirm bằng AST + grep, an toàn
- Dead file deletion: PhapNhanPage không có route trong App.tsx (đã verify)
- PrintTemplatePage migration: phap_nhan.ts có đủ fields và methods cần thiết

---

# Plan: ERP Maintainability — Logging + Service Layer + Migration Discipline
Date: 2026-05-22
Status: DONE ✅ (2026-05-22)

## Mục tiêu
Giảm technical debt ở 3 điểm đang cản trở debug và maintain:
1. **Logging** — thêm structured log vào routers/services quan trọng nhất để khi có bug biết ngay ở đâu
2. **Service layer** — tách business logic khỏi router (bắt đầu với `production_orders.py`)
3. **Migration discipline** — chuẩn hóa naming convention cho migration mới từ giờ trở đi

---

## Module 1 — Logging

### Hiện trạng
`main.py` đã có `basicConfig` + middleware log HTTP request/response. Tuy nhiên **không router nào** import `logging` hay dùng logger — khi lỗi xảy ra trong business logic, không có trace.

### Approach
Không thêm vào cả 63 routers. Tập trung vào **10 routers có traffic cao nhất** và **toàn bộ service layer**.

**Tạo 1 utility function ở `backend/app/utils/log.py`:**
```python
import logging

def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
```

**Log ở 3 điểm trong mỗi router/service:**
- `INFO` khi create/update/delete thành công: `logger.info("created production_order id=%s by user=%s", id, user_id)`
- `WARNING` khi business rule bị vi phạm (HTTPException 4xx): `logger.warning("order %s not found", id)`
- `ERROR` trong except blocks (nếu có): `logger.error("failed to ...", exc_info=True)`

### Các bước
- [ ] **L1**: Tạo `backend/app/utils/log.py` — `get_logger(name)` helper
- [ ] **L2**: Thêm logger vào `production_orders.py` — 5 operations: create, update, delete, status change, generate PDF
- [ ] **L3**: Thêm logger vào `sales_orders.py` — create, update, status change
- [ ] **L4**: Thêm logger vào `purchase_orders.py` — create, approve, receive
- [ ] **L5**: Thêm logger vào `hr.py` — payroll calc, checkin/checkout
- [ ] **L6**: Thêm logger vào `warehouse.py` — nhập/xuất kho
- [ ] **L7**: Thêm logger vào `quality_control.py` + `qc_giay_cuon.py`
- [ ] **L8**: Thêm logger vào các service files lớn nhất: `accounting_service.py`, `production_order_service.py`, `billing_service.py`

---

## Module 2 — Service Layer Cleanup

### Hiện trạng
`production_orders.py` có 5 helper functions ở top-level router file (không phải routes):
- `_auto_kho_sx_id()` — tìm kho SX tự động
- `_generate_so_lenh()` — sinh số lệnh sản xuất
- `_build_response()` — format response object (~110 dòng)
- `_load_order()` — load order + eager load relationships
- `_phieu_to_dict()` — convert model to dict (~40 dòng)

Pattern đúng đã có: `ProductionOrderService(db)` tồn tại ở `services/production_order_service.py`.

### Approach
Di chuyển 5 helper functions vào `ProductionOrderService`. Router chỉ gọi service method, không chứa logic.

**Không refactor các router khác trong sprint này** — chỉ dùng `production_orders.py` làm mẫu, document pattern, áp dụng cho code mới từ đây trở đi.

### Các bước
- [ ] **S1**: Đọc `production_order_service.py` hiện tại — xác định chỗ thêm các methods
- [ ] **S2**: Move `_auto_kho_sx_id()` → `ProductionOrderService.resolve_kho_sx_id()`
- [ ] **S3**: Move `_generate_so_lenh()` → `ProductionOrderService.generate_so_lenh()`
- [ ] **S4**: Move `_build_response()` → `ProductionOrderService.build_response()`
- [ ] **S5**: Move `_load_order()` → `ProductionOrderService.load_order()`
- [ ] **S6**: Move `_phieu_to_dict()` → `ProductionOrderService.phieu_to_dict()`
- [ ] **S7**: Cập nhật tất cả call sites trong `production_orders.py` → dùng `service.method()`
- [ ] **S8**: Viết `CLAUDE.md` rule cho project: _"Router chỉ được gọi service methods. Business logic luôn nằm trong service class."_

---

## Module 3 — Migration Discipline

### Hiện trạng
71 migrations đã có — naming không nhất quán:
- `{random_uuid}_slug.py` (phổ biến nhất)
- `idx001_add_missing_hot_indexes.py`
- `ab1_add_da_dieu_chinh.py`

Autogenerate đã được setup đúng trong `env.py`.

### Approach
**Không squash 71 migrations cũ** — rủi ro cao, không cần thiết trong dev.
Chỉ cần 2 việc:
1. Đặt naming convention cho migration mới từ giờ trở đi
2. Thêm rule vào `CLAUDE.md` để không quên

**Convention mới:**
```
YYYYMMDD_NN_mo_ta_ngan.py
Ví dụ: 20260522_01_add_qc_giay_cuon_phieu.py
       20260523_01_add_index_production_orders.py
```

**Rule tạo migration:**
```bash
# Luôn dùng autogenerate:
alembic revision --autogenerate -m "YYYYMMDD_NN_mo_ta"
# Sau đó review file được tạo trước khi upgrade
alembic upgrade head
```

### Các bước
- [ ] **M1**: Thêm section "Migration Convention" vào `backend/CLAUDE.md` (hoặc tạo `backend/CONTRIBUTING.md` nếu chưa có)
- [ ] **M2**: Đổi tên `backend/alembic/versions/` file gần nhất (`idx001_...`) theo convention mới nếu chưa apply
- [ ] **M3**: Áp dụng convention ngay cho migration QC Giấy Cuộn (plan tiếp theo)

---

## Done Criteria
- [ ] `backend/app/utils/log.py` tồn tại, import được
- [ ] 10 routers quan trọng có logger — test: trigger 1 create operation → thấy log dòng INFO trong `backend.log`
- [ ] `production_orders.py` không còn helper function top-level nào ngoài routes
- [ ] `ProductionOrderService` có đủ 5 methods mới, import OK
- [ ] `CLAUDE.md` (backend) có rule về router/service và migration convention
- [ ] `npm run build` (frontend) không bị ảnh hưởng
- [ ] Backend khởi động không lỗi: `uvicorn app.main:app`

## Rủi ro
- Move helpers vào service có thể break import nếu có file khác dùng `from routers.production_orders import _build_response` — kiểm tra trước khi move (grep)
- Logger format hiện tại (`%(name)s`) sẽ hiển thị tên module — đây là behavior mong muốn
- Migration rename: chỉ rename file chưa apply, **không rename file đã chạy** vì Alembic track theo filename

---

# Plan: QC Giấy Cuộn — Kiểm tra chất lượng nguyên liệu giấy cuộn
Date: 2026-05-22
Status: PENDING_APPROVAL

## Mục tiêu
Xây dựng module kiểm tra chất lượng giấy cuộn nhập kho, dựa trên cấu trúc dữ liệu từ file Excel `BANGTONGHOPKETQUAKIEMTRAGIAYCUON.xlsx`.

**Nguyên tắc thiết kế (sau khi đọc kỹ model hiện có):**
- Tiêu chuẩn QC đã có sẵn trong `PaperMaterial` (`do_buc_tieu_chuan`, `do_nen_vong_tc`, `tieu_chuan_dinh_luong`, `dinh_luong`) → **KHÔNG tạo bảng spec mới**
- `QCGiayCuonPhieu` link tới `PaperMaterial` (lấy tiêu chuẩn) + tùy chọn link `GoodsReceipt` (biết lô nhập nào)
- Phiếu QC cho từng **cuộn giấy riêng lẻ** trong một lô nhập (1 GoodsReceipt có thể có nhiều phiếu QC)

Mỗi phiếu QC ghi nhận **3 chỉ tiêu** đo thực tế so với tiêu chuẩn trong `PaperMaterial`:
- **Định lượng** (GSM): đo L1, L2 → TB → so với `dinh_luong ± tieu_chuan_dinh_luong%` → Đạt/Không đạt
- **Độ bục**: đo L1–L4 → TB → so với `do_buc_tieu_chuan` (min) → Đạt/Không đạt
- **Độ nén vòng**: đo L1–L3 → TB → so với `do_nen_vong_tc` (min) → Đạt/Không đạt

Kết quả tổng = "không đạt" nếu bất kỳ chỉ tiêu nào không đạt.

---

## Liên kết với hệ thống hiện có

```
GoodsReceipt (lô nhập)
  └── GoodsReceiptItem.paper_material_id ──→ PaperMaterial
                                              ├── dinh_luong (GSM chuẩn)
                                              ├── tieu_chuan_dinh_luong (sai số %)
                                              ├── do_buc_tieu_chuan (min)
                                              ├── do_nen_vong_tc (min)
                                              ├── do_buc_tb (TB lịch sử — cập nhật sau QC)
                                              └── do_nen_vong_tb (TB lịch sử — cập nhật sau QC)

QCGiayCuonPhieu
  ├── paper_material_id ──────────────────→ PaperMaterial (bắt buộc)
  ├── goods_receipt_id ────────────────────→ GoodsReceipt (tùy chọn)
  └── goods_receipt_item_id ───────────────→ GoodsReceiptItem (tùy chọn)
```

---

## Các bước thực thi

### Backend

- [ ] **Bước 1**: Thêm model `QCGiayCuonPhieu` vào `backend/app/models/quality.py`
  - Link `paper_material_id → PaperMaterial` (FK bắt buộc)
  - Link `goods_receipt_id → GoodsReceipt` (FK tùy chọn)
  - Các cột đo: dl_l1/l2/tb/ket_qua, buc_l1-l4/tb/ket_qua, nen_vong_l1-l3/tb/ket_qua
  - Cột tiêu chuẩn snapshot (lưu giá trị tại thời điểm kiểm tra để audit sau này)

- [ ] **Bước 2**: Thêm schemas vào `backend/app/schemas/quality.py`
  - `QCGiayCuonCreate`, `QCGiayCuonUpdate`, `QCGiayCuonResponse`, `QCGiayCuonStats`

- [ ] **Bước 3**: Tạo router `backend/app/routers/qc_giay_cuon.py`
  - `GET /api/qc-giay-cuon` — list, filter: paper_material_id, goods_receipt_id, ket_qua, tu_ngay, den_ngay
  - `POST /api/qc-giay-cuon` — tạo phiếu, auto-tính TB và ket_qua mỗi chỉ tiêu
  - `GET /api/qc-giay-cuon/stats` — thống kê
  - `GET /api/qc-giay-cuon/{id}` — chi tiết
  - `PATCH /api/qc-giay-cuon/{id}` — cập nhật
  - `DELETE /api/qc-giay-cuon/{id}`
  - `POST /api/qc-giay-cuon/{id}/cap-nhat-tb` — cập nhật PaperMaterial.do_buc_tb / do_nen_vong_tb (tùy chọn)

- [ ] **Bước 4**: Mount router vào `backend/app/main.py`

- [ ] **Bước 5**: Tạo Alembic migration
  ```
  alembic revision --autogenerate -m "add qc_giay_cuon_phieu table"
  alembic upgrade head
  ```

### Frontend

- [ ] **Bước 6**: Tạo `frontend/src/api/qcGiayCuon.ts`
  - Interfaces: `QCGiayCuon`, `QCGiayCuonStats`, payload types
  - API calls, bao gồm lookup paper materials từ endpoint có sẵn

- [ ] **Bước 7**: Tạo `frontend/src/pages/quality/QCGiayCuonPage.tsx`
  - Stats cards: Tổng/Đạt/Không đạt/Tỷ lệ đạt %
  - Filter: khoảng ngày, nhà sản xuất (Supplier), kết quả
  - Table: Số phiếu | Mã NVL + Tên | NCC | Ngày nhập / Ngày KT | Định lượng TB/KQ | Độ bục TB/KQ | Nén vòng TB/KQ | Kết quả tổng | Phiếu nhập | Actions
  - **Create drawer** (quan trọng):
    - Chọn `PaperMaterial` (search/select) → auto-load tiêu chuẩn hiển thị dưới dạng reference
    - Tùy chọn link `GoodsReceipt` (số phiếu nhập)
    - Section Định lượng: hiển thị TC chuẩn + sai số → nhập L1, L2 → auto-calc TB + pass/fail badge màu real-time
    - Section Độ bục: hiển thị TC min → nhập L1-L4 → auto-calc TB + badge
    - Section Độ nén vòng: hiển thị TC min → nhập L1-L3 → auto-calc TB + badge
    - Kết quả tổng: tự động tính, hiển thị nổi bật
  - **Detail drawer**: full read-only, so sánh đo vs tiêu chuẩn từng chỉ tiêu

- [ ] **Bước 8**: Thêm route + menu item
  - `frontend/src/App.tsx`: thêm route `quality/giay-cuon`
  - `frontend/src/components/AppLayout.tsx`: menu item "Giấy cuộn (QC)" trong group Chất lượng

---

## Model chi tiết: QCGiayCuonPhieu (`qc_giay_cuon_phieu`)

```
# Liên kết
paper_material_id   FK paper_materials.id    (bắt buộc)
goods_receipt_id    FK goods_receipts.id     (tùy chọn — lô nhập giấy)
goods_receipt_item_id FK goods_receipt_items.id (tùy chọn — dòng item cụ thể)

# Thông tin phiếu
so_phieu            String unique  QCGC-YYYYMMDD-001
ngay_nhap_giay      Date|None      từ GoodsReceipt hoặc nhập tay
ngay_kiem_tra       Date           bắt buộc
nguoi_kiem_tra      String|None
trong_luong_tem     Float|None     KG trên nhãn cuộn
kho_thuc_te         Float|None     cm — khổ thực tế đo được
kho_tc              Float|None     cm — khổ tiêu chuẩn (snapshot từ GoodsReceiptItem hoặc nhập tay)
kho_ket_qua         String|None    "dat"|"khong_dat"
                                   dat nếu (kho_tc-4) ≤ kho_thuc_te ≤ (kho_tc+4)

# Snapshot tiêu chuẩn (lưu lại tại thời điểm KT để audit)
tc_dinh_luong       Float|None     copy từ PaperMaterial.dinh_luong
tc_sai_so_pct       Float|None     copy từ PaperMaterial.tieu_chuan_dinh_luong
tc_do_buc           Float|None     copy từ PaperMaterial.do_buc_tieu_chuan
tc_do_nen_vong      Float|None     copy từ PaperMaterial.do_nen_vong_tc

# Định lượng GSM
dl_l1               Float|None
dl_l2               Float|None
dl_tb               Float|None     = (l1 + l2) / 2
dl_ket_qua          String|None    "dat"|"khong_dat"
                                   dat nếu tc_dl*(1-tc_sai_so/100) ≤ tb ≤ tc_dl*(1+tc_sai_so/100)

# Độ bục
buc_l1..buc_l4      Float|None     (4 lần đo)
buc_tb              Float|None     = avg(l1..l4)
buc_ket_qua         String|None    dat nếu tb ≥ tc_do_buc

# Độ nén vòng
nen_vong_l1..l3     Float|None     (3 lần đo)
nen_vong_tb         Float|None     = avg(l1..l3)
nen_vong_ket_qua    String|None    dat nếu tb ≥ tc_do_nen_vong

# Tổng hợp
ket_qua             String|None    "dat"|"khong_dat"
                                   = "dat" nếu dl_kq = buc_kq = nen_kq = kho_kq = "dat" (chỉ tính chỉ tiêu đã đo)
ghi_chu             Text|None
phap_nhan_id        FK phap_nhan.id (tùy chọn)
created_by          FK users.id
created_at, updated_at
```

---

## Logic pass/fail (backend tự tính khi save)

```python
# Định lượng
if dl_tb and tc_dinh_luong and tc_sai_so_pct:
    lower = tc_dinh_luong * (1 - tc_sai_so_pct / 100)
    upper = tc_dinh_luong * (1 + tc_sai_so_pct / 100)
    dl_ket_qua = "dat" if lower <= dl_tb <= upper else "khong_dat"

# Độ bục
if buc_tb and tc_do_buc:
    buc_ket_qua = "dat" if buc_tb >= tc_do_buc else "khong_dat"

# Độ nén vòng
if nen_vong_tb and tc_do_nen_vong:
    nen_vong_ket_qua = "dat" if nen_vong_tb >= tc_do_nen_vong else "khong_dat"

# Khổ giấy
if kho_thuc_te and kho_tc:
    kho_ket_qua = "dat" if (kho_tc - 4) <= kho_thuc_te <= (kho_tc + 4) else "khong_dat"

# Tổng (chỉ tính chỉ tiêu đã có đủ dữ liệu)
all_kq = [dl_ket_qua, buc_ket_qua, nen_vong_ket_qua, kho_ket_qua]
filled = [k for k in all_kq if k is not None]
ket_qua = "dat" if filled and all(k == "dat" for k in filled) else "khong_dat"
```

---

## Done Criteria
- [ ] POST `/api/qc-giay-cuon` tạo phiếu, auto-snapshot tiêu chuẩn từ PaperMaterial, auto-tính TB và ket_qua (4 chỉ tiêu)
- [ ] GET `/api/qc-giay-cuon?goods_receipt_id=X` lọc theo lô nhập
- [ ] GET `/api/qc-giay-cuon/stats` trả đúng tỷ lệ đạt
- [ ] Frontend: chọn mã NVL → tiêu chuẩn hiện ra ngay (không cần nhập tay)
- [ ] Frontend: nhập số đo → TB + badge Đạt/Không đạt real-time, không cần nhấn Save
- [ ] Frontend: kết quả tổng tự cập nhật theo từng chỉ tiêu (gồm khổ giấy)
- [ ] Frontend: filter theo lô nhập (GoodsReceipt) hoạt động
- [ ] Menu "Chất lượng > Giấy cuộn (QC)" mở đúng trang
- [ ] Build TypeScript: không có error
- [ ] Backend lint: không có error

## Rủi ro
- Migration chỉ tạo 1 bảng mới → safe, không động vào bảng cũ
- `tieu_chuan_dinh_luong` trong PaperMaterial có thể NULL → xử lý gracefully (bỏ qua chỉ tiêu nếu TC chưa có)
- Snapshot TC tại thời điểm KT: đảm bảo audit trail khi spec thay đổi sau này
