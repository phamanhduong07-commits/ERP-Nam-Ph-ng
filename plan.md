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
