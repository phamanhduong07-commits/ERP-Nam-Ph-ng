# Plan: Hoàn thiện & Mở rộng ERP Nam Phương
Date: 2026-05-19
Status: PHẦN 2 COMPLETE (Sprint 6-10 DONE)

---

## Mục tiêu

Đưa ERP từ trạng thái "chạy được" lên "tin cậy được":
1. **Hoàn thiện** — viết test coverage cho 51 module chưa có test, ưu tiên theo rủi ro tài chính
2. **Mở rộng** — xây 5 module mới có ROI cao nhất cho nhà máy carton

Kết thúc: mọi module Tier A đều có test xanh, 5 module mới đi vào sử dụng trong 16 tuần.

---

## Thực trạng baseline (2026-05-19)

| Hạng mục | Số liệu |
|---|---|
| Routers backend | 55 (auth guards đầy đủ, error handling tốt) |
| Test files | 4 / 55 — cd2_state, purchase, warehouse, conftest |
| Frontend pages | 155 TSX — không có TODO, forms hoàn chỉnh |
| Alembic migrations | 65 — cập nhật đến hôm nay |
| Rủi ro lớn nhất | 51 module chưa có test → không biết đúng/sai |

---

## Phân loại module theo rủi ro

### Tier A — Tiền bạc (sai = thiệt hại thật)
| Module | File router | Rủi ro cụ thể |
|---|---|---|
| Kế toán tổng hợp | `accounting.py` | Bút toán sai → BCTC sai |
| Hóa đơn bán hàng | `billing.py` | Doanh thu khai sai → thuế sai |
| Tính lương | `hr_payroll_calc.py` | Lương sai → khiếu nại lao động |
| Đơn bán hàng | `sales_orders.py` | Doanh số không khớp kế toán |
| Lệnh sản xuất | `production_orders.py` | Chi phí sản xuất không vào sổ |

### Tier B — Nghiệp vụ cốt lõi (sai = dữ liệu không khớp)
| Module | File router |
|---|---|
| Trả hàng bán | `sales_returns.py` |
| Trả hàng mua | `purchase_returns.py` |
| Nhân sự + nghỉ phép | `hr.py` |
| Kế hoạch sản xuất | `production_plans.py` |
| Báo giá | `quotes.py` |
| Yêu cầu mua hàng | `purchase_requisitions.py` |

### Tier C — Danh mục & báo cáo (sai = hiển thị sai, ít nguy hiểm)
Customers, suppliers, products, reports, dashboard, BOM, và ~30 module còn lại.

---

## PHẦN 1: HOÀN THIỆN (Sprint 1–5, Tuần 1–8)

### Sprint 1 — Tuần 1-2: Test Accounting + Billing

- [ ] **Bước 1.1** — Viết `test_accounting.py`
  - File: `backend/tests/test_accounting.py`
  - Mục tiêu: Cover `accounting.py` (journal entries, purchase/sales invoices, cash receipts/payments)
  - Test cases bắt buộc:
    - Happy path: tạo bút toán thủ công → verify Nợ = Có, phap_nhan_id khớp
    - Validation: bút toán không cân bằng → HTTP 400
    - Business rule: hủy phiếu thu đã có bút toán → sinh bút toán đảo ngược
    - Period closing: ghi bút toán vào kỳ đã đóng → HTTP 400
  - Pattern: dùng `client_purchase` fixture từ `test_purchase_module.py` làm mẫu

- [ ] **Bước 1.2** — Viết `test_billing.py`
  - File: `backend/tests/test_billing.py`
  - Mục tiêu: Cover `billing.py` (hóa đơn bán hàng, điều chỉnh hóa đơn, VAT)
  - Test cases:
    - Tạo invoice từ SO → kiểm tra tong_tien_hang, tien_thue đúng công thức
    - Invoice adjustment → bút toán điều chỉnh cân bằng
    - Duplicate invoice cho cùng 1 SO → HTTP 400
    - Hủy invoice đã có thanh toán → HTTP 400

### Sprint 2 — Tuần 3-4: Test HR Payroll + Sales

- [ ] **Bước 2.1** — Viết `test_hr_payroll.py`
  - File: `backend/tests/test_hr_payroll.py`
  - Mục tiêu: Cover `hr_payroll_calc.py` (lương sản phẩm + lương số lớp giấy)
  - Test cases:
    - Lương loại `san_pham`: so_luong × don_gia → tổng đúng
    - Lương loại `so_lop_giay`: hệ số máy sóng × gia_tri → tổng đúng
    - Kỳ lương trùng nhau cho cùng nhân viên → HTTP 409
    - Kỳ lương nhân viên không tồn tại → HTTP 404

- [ ] **Bước 2.2** — Viết `test_sales.py`
  - File: `backend/tests/test_sales.py`
  - Mục tiêu: Cover `sales_orders.py` + `sales_returns.py`
  - Test cases:
    - Tạo SO → giao hàng → bút toán doanh thu + COGS sinh ra
    - Trả hàng bán → bút toán đảo ngược doanh thu + nhập lại kho
    - Giao hàng từ kho NVL (không phải kho TP) → HTTP 400
    - Trả hàng nhiều hơn số đã giao → HTTP 400

### Sprint 3 — Tuần 5-6: Test Production + Purchase Returns

- [ ] **Bước 3.1** — Viết `test_production.py`
  - File: `backend/tests/test_production.py`
  - Mục tiêu: Cover `production_orders.py` + `production_plans.py` + `bom.py`
  - Test cases:
    - Tạo LSX → nhập TP → bút toán Nợ 155 / Có 154 sinh ra, Nợ = Có
    - Xuất phôi giao thẳng cho khách → tồn kho phôi giảm đúng
    - BOM calculator: input DxRxC + số lượng → NVL cần đúng với công thức
    - Hủy LSX sau khi đã có phiếu nhập TP → HTTP 400

- [ ] **Bước 3.2** — Viết `test_purchase_returns.py`
  - File: `backend/tests/test_purchase_returns.py`
  - Mục tiêu: Cover `purchase_returns.py`
  - Test cases:
    - Trả hàng hợp lệ → tồn kho giảm + bút toán đảo ngược GR
    - Trả hàng số lượng > số đã nhập → HTTP 400
    - Trả hàng khi PO đã hủy → HTTP 400

### Sprint 4 — Tuần 7: Test Tier B còn lại

- [ ] **Bước 4.1** — Viết `test_hr.py`
  - File: `backend/tests/test_hr.py`
  - Test cases: CRUD nhân viên, duyệt nghỉ phép, từ chối với lý do

- [ ] **Bước 4.2** — Viết `test_quotes.py`
  - File: `backend/tests/test_quotes.py`
  - Test cases: Tạo báo giá, chấp nhận → tự tạo SO, từ chối báo giá

- [ ] **Bước 4.3** — Viết `test_purchase_requisitions.py`
  - File: `backend/tests/test_purchase_requisitions.py`
  - Test cases: Tạo PR, duyệt PR → tạo PO đề xuất, hủy PR

### Sprint 5 — Tuần 8: Smoke test Tier C + CI/CD

- [ ] **Bước 5.1** — Viết `test_master_data.py`
  - File: `backend/tests/test_master_data.py`
  - Mục tiêu: CRUD smoke test cho customers, suppliers, products, warehouses
  - 1 test per resource: create → list → update → verify

- [ ] **Bước 5.2** — Viết `test_reports.py`
  - File: `backend/tests/test_reports.py`
  - Test cases: revenue report trả đúng cấu trúc JSON, inventory report, debt summary

- [ ] **Bước 5.3** — Setup CI workflow
  - File: `.github/workflows/test.yml`
  - Nội dung: chạy `pytest backend/tests/ -v --tb=short` khi push bất kỳ branch nào

---

## PHẦN 2: MỞ RỘNG (Sprint 6–10, Tuần 9–16)

> Mỗi module mới theo đúng thứ tự: model → schema → router → migration → mount → frontend → test

### Sprint 6 — Tuần 9-10: Module QC (Kiểm tra chất lượng)

**Nghiệp vụ:** Mỗi lô NVL nhập và mỗi LSX cần phiếu kiểm tra chất lượng.
Khi QC fail → không cho xuất kho hoặc dùng NVL đó vào sản xuất.

- [ ] **Bước 6.1** — Model
  - File: `backend/app/models/quality.py`
  ```
  QCSheet: id, so_phieu, loai (nhan_hang|san_xuat|xuat_hang),
           ref_type (goods_receipt|production_order), ref_id,
           ngay, nguoi_kiem_tra, ket_qua (dat|khong_dat|tam_chap_nhan),
           ghi_chu, phap_nhan_id, user_id

  QCDefect: id, qc_sheet_id, loai_loi, mo_ta, so_luong_loi, hinh_anh_path
  ```

- [ ] **Bước 6.2** — Schema
  - File: `backend/app/schemas/quality.py`
  - Classes: QCSheetCreate, QCSheetUpdate, QCSheetResponse, QCDefectCreate, QCDefectResponse

- [ ] **Bước 6.3** — Router
  - File: `backend/app/routers/quality_control.py`
  - Routes:
    - `GET/POST /api/qc-sheets` — CRUD
    - `POST /api/qc-sheets/{id}/ket-qua` — cập nhật kết quả
    - `GET /api/qc-sheets/stats?tu_ngay=&den_ngay=` — tỷ lệ pass/fail theo xưởng
  - Guard: `Depends(get_current_user)` trên tất cả routes

- [ ] **Bước 6.4** — Migration
  - File: `backend/alembic/versions/[hash]_add_qc_tables.py`
  - Tạo 2 bảng: `qc_sheets`, `qc_defects`

- [ ] **Bước 6.5** — Mount
  - File: `backend/app/main.py`
  - Thêm: `app.include_router(quality_control.router, prefix="/api")`

- [ ] **Bước 6.6** — Frontend
  - File: `frontend/src/pages/quality/QCListPage.tsx`
  - Danh sách phiếu QC, filter theo loại/kết quả/khoảng ngày
  - Form tạo mới + cập nhật kết quả
  - Badge cảnh báo trên GoodsReceiptPage khi GR chưa có QC

- [ ] **Bước 6.7** — Test
  - File: `backend/tests/test_quality_control.py`
  - 4 test cases: Tạo phiếu, cập nhật kết quả "dat", cập nhật "khong_dat", stats API trả đúng tỷ lệ

---

### Sprint 7 — Tuần 10-11: Module Bảo trì máy

**Nghiệp vụ:** Theo dõi lịch bảo trì định kỳ + ghi nhật ký sự cố.
Kế thừa dữ liệu từ `may_dung_log` hiện có.

- [ ] **Bước 7.1** — Model
  - File: `backend/app/models/maintenance.py`
  ```
  Machine: id, ma_may, ten_may, hang_sx, nam_sx,
           phan_xuong_id, trang_thai (dang_dung|ngung|sua_chua)

  MaintenanceSchedule: id, machine_id, loai_bao_tri,
                       chu_ky_ngay, ngay_bao_tri_gan_nhat,
                       ngay_bao_tri_tiep_theo (computed),
                       trang_thai (dung_han|qua_han|sap_den_han)

  MaintenanceLog: id, machine_id, schedule_id (nullable),
                  loai (dinh_ky|su_co), ngay_bat_dau, ngay_ket_thuc,
                  downtime_phut, mo_ta_su_co, bien_phap_xu_ly,
                  chi_phi_vat_tu, chi_phi_nhan_cong, tong_chi_phi,
                  phieu_chi_id (FK → kế toán), user_id
  ```

- [ ] **Bước 7.2** — Schema
  - File: `backend/app/schemas/maintenance.py`
  - Classes: MachineCreate/Response, ScheduleCreate/Response, LogCreate/Response

- [ ] **Bước 7.3** — Router
  - File: `backend/app/routers/maintenance.py`
  - Routes:
    - `GET/POST /api/maintenance/machines` — quản lý máy
    - `GET/POST /api/maintenance/schedules` — lịch bảo trì
    - `POST /api/maintenance/schedules/{id}/complete` — hoàn thành → tự tính ngày tiếp theo
    - `GET/POST /api/maintenance/logs` — nhật ký
    - `GET /api/maintenance/overdue` — máy quá hạn (cảnh báo)

- [ ] **Bước 7.4** — Migration
  - File: `backend/alembic/versions/[hash]_add_maintenance_tables.py`

- [ ] **Bước 7.5** — Mount — File: `backend/app/main.py`

- [ ] **Bước 7.6** — Frontend
  - `frontend/src/pages/maintenance/MaintenanceSchedulePage.tsx`
    — lịch bảo trì + highlight đỏ/vàng cho máy quá hạn/sắp đến hạn
  - `frontend/src/pages/maintenance/MaintenanceLogPage.tsx`
    — nhật ký sự cố, chi phí, liên kết phiếu chi kế toán

- [ ] **Bước 7.7** — Test
  - File: `backend/tests/test_maintenance.py`
  - 4 test cases: Tạo máy + lịch, complete → ngày tiếp theo tự tính đúng chu kỳ,
    log sự cố → tổng chi phí đúng, overdue API trả đúng danh sách

---

### Sprint 8 — Tuần 12: Module CRM cơ bản

**Nghiệp vụ:** Lịch sử tương tác KH + hạn mức công nợ tự động cảnh báo.
Tích hợp với Zalo bot (bot ghi log tương tác quan trọng qua API).

- [ ] **Bước 8.1** — Model
  - File: `backend/app/models/crm.py`
  ```
  CustomerInteraction: id, customer_id, kenh (zalo|dien_thoai|gap_mat|email),
                       ngay, noi_dung_tom_tat, ket_qua, user_id

  CreditLimit: id, customer_id, han_muc, canh_bao_pct (default=80),
               ngay_cap_nhat, ghi_chu
  ```

- [ ] **Bước 8.2** — Schema + Router
  - Files: `backend/app/schemas/crm.py`, `backend/app/routers/crm.py`
  - Routes:
    - `GET/POST /api/crm/interactions` — lịch sử tương tác
    - `GET/PUT /api/crm/credit-limits/{customer_id}` — hạn mức công nợ
    - `GET /api/crm/credit-alerts` — KH gần/vượt hạn mức → list để sales theo dõi

- [ ] **Bước 8.3** — Migration + Mount

- [ ] **Bước 8.4** — Frontend
  - File: `frontend/src/pages/crm/CustomerCRMPage.tsx`
  - Timeline tương tác theo từng KH
  - Cột "Hạn mức" + badge đỏ/vàng trong CustomerList
  - Trang credit-alerts cho sales manager

- [ ] **Bước 8.5** — Test
  - File: `backend/tests/test_crm.py`
  - 3 test cases: Ghi tương tác, set hạn mức + verify alert threshold, credit-alerts trả đúng danh sách

---

### Sprint 9 — Tuần 13-14: Module TSCĐ (Tài sản cố định + Khấu hao)

**Nghiệp vụ:** Khấu hao tháng tự động → sinh bút toán Nợ 627/Có 214. Bắt buộc cho BCTC chuẩn VAS.

- [ ] **Bước 9.1** — Model
  - File: `backend/app/models/fixed_assets.py`
  ```
  FixedAsset: id, ma_tscd, ten_ts, loai_ts (may_moc|nha_xuong|xe|thiet_bi),
              ngay_mua, nguyen_gia, gia_tri_con_lai,
              thoi_gian_su_dung_thang, khau_hao_thang (= nguyen_gia / thoi_gian),
              tk_nguyen_gia (211), tk_hao_mon (214), tk_chi_phi_kh (627),
              trang_thai (dang_dung|ngung|thanh_ly), phap_nhan_id

  DepreciationEntry: id, asset_id, thang, nam,
                     so_tien_kh, journal_entry_id (FK),
                     trang_thai (chua_ghi|da_ghi)
  ```

- [ ] **Bước 9.2** — Schema + Router
  - Files: `backend/app/schemas/fixed_assets.py`, `backend/app/routers/fixed_assets.py`
  - Routes:
    - CRUD `/api/fixed-assets`
    - `POST /api/fixed-assets/run-depreciation?thang=X&nam=Y` — chạy khấu hao tháng → sinh bút toán cho tất cả TS đang dùng
    - `GET /api/fixed-assets/depreciation-schedule/{asset_id}` — bảng khấu hao dự kiến toàn kỳ

- [ ] **Bước 9.3** — Migration + Mount
  - Chú ý: security review bắt buộc do liên kết bút toán kế toán

- [ ] **Bước 9.4** — Frontend
  - `frontend/src/pages/accounting/FixedAssetListPage.tsx` — danh sách TS + giá trị còn lại
  - `frontend/src/pages/accounting/DepreciationPage.tsx` — chạy khấu hao tháng + xem lịch sử

- [ ] **Bước 9.5** — Test
  - File: `backend/tests/test_fixed_assets.py`
  - 4 test cases:
    - Tạo TS → khau_hao_thang tính đúng
    - Run-depreciation → bút toán Nợ/Có cân bằng, TK đúng (627/214)
    - Chạy 2 lần cùng tháng → HTTP 409 (idempotent check)
    - TS trạng thái "ngung" → bỏ qua khi run-depreciation

---

### Sprint 10 — Tuần 15-16: Module MRP Lite (Hoạch định NVL)

**Nghiệp vụ:** Từ kế hoạch sản xuất → tính NVL cần → so tồn → đề xuất PO mua thêm.
Phụ thuộc: BOM đã có, InventoryBalance đã có.

- [x] **Bước 10.1** — Service logic
  - File: `backend/app/services/mrp_service.py`
  ```python
  def calculate_mrp(plan_ids: list[int], db: Session) -> MRPResult:
      # 1. Lấy production_plan items → sản phẩm + số lượng kế hoạch
      # 2. Với mỗi sản phẩm → tra BOM → bung ra NVL cần (tối đa depth=3)
      # 3. Tổng hợp NVL cần theo ma_vt
      # 4. So với InventoryBalance hiện tại
      # 5. Return: {nvl_du: [...], nvl_thieu: [{ma_vt, ten, can, co, thieu}]}
  ```

- [x] **Bước 10.2** — Router
  - File: `backend/app/routers/mrp.py`
  - Routes:
    - `POST /api/mrp/calculate` — input: `{plan_ids: [1,2,3]}` → MRPResult
    - `POST /api/mrp/create-po` — từ MRPResult → tạo PO draft với items thiếu

- [x] **Bước 10.3** — Mount — File: `backend/app/main.py`

- [x] **Bước 10.4** — Frontend
  - File: `frontend/src/pages/production/MRPPage.tsx`
  - Chọn kế hoạch SX (multi-select) → bấm "Tính MRP"
  - Bảng kết quả: NVL đủ (xanh) / NVL thiếu (đỏ + số lượng cần mua)
  - Nút "Tạo đề xuất mua hàng" → tạo PO draft → redirect PO list

- [x] **Bước 10.5** — Test
  - File: `backend/tests/test_mrp.py`
  - 3 test cases:
    - Tính MRP khi tồn kho đủ → nvl_thieu rỗng
    - Tính MRP khi tồn kho thiếu → số lượng thiếu đúng (= can - co)
    - create-po từ MRPResult → PO draft được tạo với items đúng

---

## Timeline tổng quan (16 tuần)

```
PHẦN 1 — HOÀN THIỆN
─────────────────────────────────────────────────────
Tuần 1-2  │ Sprint 1 │ test_accounting + test_billing
Tuần 3-4  │ Sprint 2 │ test_hr_payroll + test_sales
Tuần 5-6  │ Sprint 3 │ test_production + test_purchase_returns
Tuần 7    │ Sprint 4 │ test_hr + test_quotes + test_purchase_requisitions
Tuần 8    │ Sprint 5 │ test_master_data + test_reports + CI/CD

PHẦN 2 — MỞ RỘNG
─────────────────────────────────────────────────────
Tuần 9-10 │ Sprint 6 │ Module QC (Kiểm tra chất lượng)
Tuần 10-11│ Sprint 7 │ Module Bảo trì máy
Tuần 12   │ Sprint 8 │ Module CRM cơ bản
Tuần 13-14│ Sprint 9 │ Module TSCĐ + Khấu hao
Tuần 15-16│ Sprint 10│ Module MRP Lite
```

---

## Done Criteria (toàn kế hoạch)

### Hoàn thiện
- [ ] 10 test files mới (accounting, billing, hr_payroll, sales, production, purchase_returns, hr, quotes, purchase_requisitions, master_data, reports)
- [ ] `pytest backend/tests/ -v` chạy xanh hoàn toàn — 0 failures, 0 errors
- [ ] Không có test nào skip hoặc xfail mà không có comment lý do
- [ ] CI workflow `.github/workflows/test.yml` chạy tự động khi push
- [ ] `flake8 backend/app --max-line-length=120` — 0 errors

### Mở rộng
- [ ] 5 module mới (QC, Bảo trì, CRM, TSCĐ, MRP) có router mount thành công
- [ ] Mỗi module có ít nhất 3 test cases xanh
- [ ] Mỗi module có migration Alembic riêng, `alembic upgrade head` chạy sạch
- [ ] Mỗi module có ít nhất 1 frontend page hoạt động + vào menu sidebar
- [ ] Bút toán TSCĐ: Nợ = Có, TK 627 Nợ / TK 214 Có
- [ ] MRP calculation cho kết quả khớp thủ công với BOM + tồn kho test data

---

## Nguyên tắc thực thi

1. **1 sprint = commit riêng** — không gộp nhiều sprint vào 1 commit
2. **Test xanh trước khi tick** — không đánh dấu done nếu `pytest` chưa pass
3. **Dùng pattern sẵn có** — copy `conftest.py` + `_make_*` helpers, không viết lại từ đầu
4. **Migration riêng từng module** — không gộp nhiều bảng vào 1 file migration
5. **Security review tự động** — khi sửa `accounting.py`, `billing.py`, `hr_payroll_calc.py`, `fixed_assets.py` → gọi `security-reviewer` agent trước khi báo done

---

## Rủi ro & xử lý

| Rủi ro | Khả năng | Xử lý |
|---|---|---|
| Test fail do SQLite/PostgreSQL type mismatch | Cao | Dùng `_create_cd2_tables()` pattern từ conftest — đã giải quyết vấn đề JSONB/ARRAY |
| Migration conflict khi làm song song | Trung bình | Mỗi sprint = 1 nhánh git riêng, merge tuần tự |
| Ant Design version conflict khi thêm component mới | Thấp | Copy pattern từ page hiện có, không upgrade antd |
| MRP chậm khi BOM nhiều cấp | Trung bình | Giới hạn depth BOM = 3, không đệ quy vô hạn |
| Scope creep (muốn thêm ảnh QC, barcode...) | Cao | Chỉ implement spec trong plan — ghi "Phase 2" cho yêu cầu thêm |
| TSCĐ: chạy khấu hao 2 lần cùng tháng | Cao | Unique constraint (asset_id, thang, nam) + HTTP 409 |
