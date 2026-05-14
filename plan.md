# Plan: Hoàn thiện Module Mua Hàng ERP Nam Phương
Date: 2026-05-15
Status: COMPLETED ✅ (2026-05-15)

## Mục tiêu
Xây dựng và hoàn thiện toàn bộ module mua hàng cho 3 pháp nhân (Nam Phương, Visunpack, Nam Phương Long An) và 4 xưởng sản xuất (Hoàng Gia, Nam Thuận, Hóc Môn, Củ Chi), bao gồm 7 giai đoạn tuần tự theo dependencies.

## Bối cảnh hiện tại
- **Đã có:** PO CRUD, PurchaseReturn, PurchaseInvoice, APLedger, CashPayment — backend ~85%
- **Thiếu lớn nhất:** UI phiếu nhập kho (GR), dự báo nhu cầu, YMH workflow, báo cáo quản trị
- **3 Pháp nhân DB:** id=2 Nam Phương, id=3 Visunpack, id=4 Nam Phương Long An
- **4 Xưởng DB:** id=1 Hoàng Gia, id=2 Nam Thuận, id=3 Hóc Môn, id=4 Củ Chi

---

## Giai đoạn 1 — UI Phiếu Nhập Kho (GoodsReceipt Frontend)

> Backend API đã đầy đủ. Chỉ cần xây dựng UI.

- [ ] **Bước 1.1** — Tạo API client frontend
  - File: `frontend/src/api/goodsReceipts.ts` (mới)
  - Mục tiêu: Wrap toàn bộ GR endpoints (`/api/warehouse/goods-receipts`)
  - Schemas: GoodsReceiptList, GoodsReceiptDetail, GoodsReceiptCreate, GoodsReceiptQuick

- [ ] **Bước 1.2** — Trang danh sách GR
  - File: `frontend/src/pages/warehouse/GoodsReceiptListPage.tsx` (mới)
  - Mục tiêu: Table filter theo supplier, warehouse, po, tu_ngay, den_ngay, trang_thai
  - Actions: Xem chi tiết, Duyệt (approve), Xoá
  - Hiển thị: so_phieu, ngay_nhap, supplier, po_so, warehouse, tong_gia_tri, trang_thai

- [ ] **Bước 1.3** — Form tạo/chỉnh sửa GR
  - File: `frontend/src/pages/warehouse/GoodsReceiptFormPage.tsx` (mới)
  - Mục tiêu: Form tạo GR có thể link từ PO (auto-fill items từ PO items chưa nhận đủ)
  - Items table: ma_vt, ten_hang, dvt, so_luong_po, so_luong_da_nhan, so_luong_nhap_them, don_gia, ket_qua_kiem_tra (DAT/KHONG_DAT)
  - Quick receipt mode: nhập nhanh không cần PO

- [ ] **Bước 1.4** — Mount routes và menu
  - File: `frontend/src/App.tsx` — thêm routes `/warehouse/goods-receipts`
  - File: `frontend/src/components/AppLayout.tsx` — thêm menu "Phiếu Nhập Kho" dưới Kho
  - Link "Tạo GR" từ POListPage khi PO ở trạng thái da_duyet/dang_giao

---

## Giai đoạn 2 — Hạch Toán Tự Động Khi Duyệt GR

> Kiểm tra và fix bút toán kế toán sinh ra khi approve GoodsReceipt.

- [ ] **Bước 2.1** — Audit logic approve GR hiện tại
  - File: `backend/app/routers/warehouse.py` — POST `/{gr_id}/approve`
  - Kiểm tra: Có tạo JournalEntry không? Tài khoản nào?
  - Bút toán chuẩn mua hàng nhập kho:
    - Nợ TK 152 (NVL giấy) / 153 (NVL khác) — số tiền hàng
    - Có TK 331 (Phải trả NCC) — số tiền hàng
    - Nợ TK 1331 (Thuế GTGT được khấu trừ) — nếu có VAT
    - Có TK 331 — tiền thuế

- [ ] **Bước 2.2** — Fix/bổ sung JournalEntry nếu thiếu
  - File: `backend/app/routers/warehouse.py`
  - Thêm: Tự động tạo JournalEntry khi trang_thai → da_duyet và bo_qua_hach_toan=False
  - Mapping TK theo loai_hang: giay_cuon → TK 1521, nvl_khac → TK 1522
  - phap_nhan_id trên JournalEntry = GR.phap_nhan_id

- [ ] **Bước 2.3** — Đảm bảo DebtLedgerEntry NCC được tạo
  - File: `backend/app/routers/warehouse.py`
  - Khi approve GR: tạo DebtLedgerEntry loai=tang_no, doi_tuong=nha_cung_cap
  - Link: chung_tu_loai="GoodsReceipt", chung_tu_id=gr.id, phap_nhan_id=gr.phap_nhan_id

- [ ] **Bước 2.4** — Update PO.so_luong_da_nhan sau khi GR approved
  - File: `backend/app/routers/warehouse.py`
  - Cập nhật PurchaseOrderItem.so_luong_da_nhan += gr_item.so_luong_nhap
  - Update PurchaseOrder.trang_thai: nếu tất cả items đã nhận đủ → hoan_thanh

---

## Giai đoạn 3 — Đối Soát Kho (GR vs PO Reconciliation)

> Báo cáo so sánh số lượng đặt hàng vs số lượng đã nhận, phân theo pháp nhân và xưởng.

- [ ] **Bước 3.1** — API báo cáo đối soát PO-GR
  - File: `backend/app/routers/purchase_orders.py`
  - Endpoint: `GET /api/purchase-orders/doi-soat-kho`
  - Params: tu_ngay, den_ngay, supplier_id, phap_nhan_id, phan_xuong_id, loai_po
  - Output per PO line: so_po, ten_hang, so_luong_dat, so_luong_da_nhan, con_thieu, don_gia, tien_con_thieu, trang_thai_nhan
  - Group by: phap_nhan, phan_xuong

- [ ] **Bước 3.2** — API tóm tắt đối soát theo pháp nhân
  - File: `backend/app/routers/purchase_orders.py`
  - Endpoint: `GET /api/purchase-orders/doi-soat-kho/summary`
  - Output: tổng PO, tổng giá trị đặt, tổng đã nhận, % hoàn thành — per phap_nhan

- [ ] **Bước 3.3** — Frontend trang đối soát kho
  - File: `frontend/src/pages/purchase/DoiSoatKhoPage.tsx` (mới)
  - Tabs: Chi tiết (per PO line) | Tóm tắt (per pháp nhân) | Xuất Excel
  - Filter: kỳ, pháp nhân, xưởng, NCC, loại hàng
  - Highlight: hàng chưa nhận đủ (màu vàng), hàng nhận thừa (màu đỏ)

---

## Giai đoạn 4 — Hoàn Thiện Đối Chiếu Phải Trả (AP)

> Bổ sung phần còn thiếu trong APLedger: matching GR↔PI, biên bản đối chiếu đầy đủ.

- [ ] **Bước 4.1** — API matching GR ↔ PurchaseInvoice
  - File: `backend/app/routers/accounting.py`
  - Endpoint: `GET /api/accounting/ap/gr-invoice-matching`
  - Output: GR chưa có HĐ, HĐ chưa link GR, GR đã link HĐ nhưng giá trị lệch
  - Filter: phap_nhan_id, supplier_id, kỳ

- [ ] **Bước 4.2** — Biên bản đối chiếu NCC cải tiến
  - File: `backend/app/routers/accounting.py` — endpoint `/ap/doi-chieu/{supplier_id}` (đã có, cần cải tiến)
  - Bổ sung: liệt kê GR tương ứng với mỗi HĐ, số tiền chênh lệch
  - PDF/HTML export cho biên bản đối chiếu ký tay

- [ ] **Bước 4.3** — Báo cáo tổng hợp AP theo pháp nhân
  - File: `backend/app/routers/accounting.py`
  - Endpoint: `GET /api/accounting/ap/summary-by-entity`
  - Output: per phap_nhan: tổng phải trả, đã thanh toán, còn lại, quá hạn
  - Breakdown: by supplier, by kỳ

- [ ] **Bước 4.4** — Frontend update APLedgerPage
  - File: `frontend/src/pages/accounting/APLedgerPage.tsx`
  - Thêm tab: GR↔HĐ Matching | Tổng hợp theo pháp nhân
  - Thêm filter phap_nhan_id vào tất cả tabs

---

## Giai đoạn 5 — Dự Báo Nhu Cầu Mua Hàng

> Thuật toán dự báo dựa trên: tồn kho thực tế + lịch sử mua hàng + tần suất sử dụng.

- [ ] **Bước 5.1** — Model DuBaoNhuCau
  - File: `backend/app/models/purchase.py`
  - Thêm class `PurchaseForecast`:
    - material_id, material_type (giay/nvl), phap_nhan_id, phan_xuong_id
    - ky_du_bao (YYYY-MM), ton_kho_hien_tai, muc_an_toan, tieu_thu_tb_thang
    - sl_can_mua, sl_de_xuat, don_gia_tham_chieu, gia_tri_de_xuat
    - algorithm_version, ghi_chu, trang_thai (cho_duyet | da_duyet | da_tao_ymh)
    - created_at, updated_at

- [ ] **Bước 5.2** — Migrate database
  - File: `database/migrations/` — tạo file migration mới (ALTER TABLE / CREATE TABLE)
  - Chạy migration: thêm bảng purchase_forecasts

- [ ] **Bước 5.3** — Service dự báo
  - File: `backend/app/services/purchase_forecast_service.py` (mới)
  - Thuật toán:
    1. Lấy tồn kho hiện tại (inventory_balances) per material per phap_nhan
    2. Tính tiêu thụ trung bình 3 tháng gần nhất từ GR history (loai_nhap=TRA_SX + xuất kho)
    3. Tính safety stock = tiêu thụ_TB × lead_time (mặc định 7 ngày)
    4. Số cần mua = max(0, muc_an_toan + tiêu_thu_TB × 30 - ton_kho)
    5. Lấy giá tham chiếu từ PO gần nhất cùng supplier + material
  - Function: `generate_monthly_forecast(phap_nhan_id, ky_du_bao)`

- [ ] **Bước 5.4** — API dự báo
  - File: `backend/app/routers/purchase_forecast.py` (mới)
  - `POST /api/purchase-forecast/generate` — trigger tính toán, output danh sách đề xuất
  - `GET /api/purchase-forecast` — xem danh sách dự báo (filter: ky, phap_nhan, phan_xuong)
  - `PATCH /api/purchase-forecast/{id}` — điều chỉnh số lượng trước khi duyệt
  - `POST /api/purchase-forecast/{id}/duyet` — duyệt để chuyển sang YMH
  - Mount trong `backend/app/main.py`

- [ ] **Bước 5.5** — Frontend trang dự báo
  - File: `frontend/src/pages/purchase/DuBaoNhuCauPage.tsx` (mới)
  - File: `frontend/src/api/purchaseForecast.ts` (mới)
  - Layout: Chọn kỳ + pháp nhân → Generate → Bảng kết quả chỉnh sửa được → Duyệt → Tạo YMH
  - Cột: Vật tư, Tồn kho, Tiêu thụ TB, Mức an toàn, Cần mua, Đơn giá TK, Giá trị
  - Highlight: vật tư sắp hết (đỏ), đủ hàng (xanh)

---

## Giai đoạn 6 — Đề Xuất / Yêu Cầu Mua Hàng (YMH Workflow)

> Phiếu yêu cầu mua hàng từ dự báo hoặc manual → duyệt → tạo PO.

- [ ] **Bước 6.1** — Model YeuCauMuaHang
  - File: `backend/app/models/purchase.py`
  - Thêm class `PurchaseRequisition`:
    - so_ymh (YMH-YYYYMM-XXXX), ngay_yeu_cau, can_truoc_ngay
    - phap_nhan_id, phan_xuong_id, nguon (du_bao | thu_cong | khan_cap)
    - trang_thai: nhap | cho_duyet_pb | da_duyet_pb | cho_duyet_gd | da_duyet | da_tao_po | huy
    - po_id (FK, nullable — khi đã chuyển thành PO)
    - forecast_id (FK, nullable — link từ dự báo)
    - nguoi_lap, duyet_pb_by, duyet_gd_by, ghi_chu
    - items: list[PurchaseRequisitionItem]
  - Thêm class `PurchaseRequisitionItem`:
    - ymh_id, material_id, material_type, ten_hang, dvt
    - so_luong_yeu_cau, so_luong_duyet, don_gia_du_kien, thanh_tien_du_kien
    - ghi_chu

- [ ] **Bước 6.2** — Migrate database
  - Thêm bảng purchase_requisitions, purchase_requisition_items

- [ ] **Bước 6.3** — API YMH
  - File: `backend/app/routers/purchase_requisitions.py` (mới)
  - `GET /api/purchase-requisitions` — filter: trang_thai, phap_nhan_id, phan_xuong_id
  - `POST /api/purchase-requisitions` — tạo YMH thủ công
  - `POST /api/purchase-requisitions/from-forecast` — tạo YMH từ dự báo đã duyệt
  - `PATCH /api/purchase-requisitions/{id}/submit` — gửi duyệt trưởng BP
  - `PATCH /api/purchase-requisitions/{id}/duyet-pb` — trưởng BP duyệt
  - `PATCH /api/purchase-requisitions/{id}/duyet-gd` — GĐ duyệt (nếu > ngưỡng)
  - `POST /api/purchase-requisitions/{id}/tao-po` — tạo PO từ YMH đã duyệt
  - Mount trong `backend/app/main.py`

- [ ] **Bước 6.4** — Frontend YMH
  - File: `frontend/src/pages/purchase/YMHListPage.tsx` (mới)
  - File: `frontend/src/pages/purchase/YMHFormPage.tsx` (mới)
  - File: `frontend/src/api/purchaseRequisitions.ts` (mới)
  - YMHListPage: Table + filter + action buttons theo role (duyệt/từ chối)
  - YMHFormPage: Form tạo YMH (từ dự báo hoặc nhập tay)
  - Button "Tạo PO" khi YMH đã được duyệt đầy đủ
  - Notification badge khi có YMH chờ duyệt

---

## Giai đoạn 7 — Báo Cáo Quản Trị Mua Hàng

> Dashboard và báo cáo tổng hợp cho BGĐ theo 3 pháp nhân / 4 xưởng.

- [ ] **Bước 7.1** — API báo cáo tổng hợp mua hàng
  - File: `backend/app/routers/reports.py` hoặc tạo `purchase_reports.py`
  - Endpoint: `GET /api/reports/purchase/summary`
  - KPIs: tổng giá trị PO, tổng đã nhận, tổng HĐ, tổng đã thanh toán, công nợ NCC
  - Breakdown: by phap_nhan, by phan_xuong, by supplier, by period
  - Endpoint: `GET /api/reports/purchase/trend` — xu hướng mua hàng theo tháng (12 tháng)
  - Endpoint: `GET /api/reports/purchase/top-suppliers` — top NCC theo giá trị
  - Endpoint: `GET /api/reports/purchase/top-materials` — top NVL theo giá trị mua

- [ ] **Bước 7.2** — API bảng điều khiển mua hàng theo pháp nhân
  - Endpoint: `GET /api/reports/purchase/by-entity`
  - Per phap_nhan: PO pending, GR tháng này, HĐ quá hạn, YMH chờ duyệt, tồn kho NVL chính

- [ ] **Bước 7.3** — Frontend Dashboard mua hàng
  - File: `frontend/src/pages/purchase/PurchaseManagementDashboard.tsx` (mới)
  - File: `frontend/src/api/purchaseReports.ts` (mới)
  - Layout:
    - Header: kỳ filter (tháng/quý/năm) + phap_nhan selector
    - Row 1 (4 KPI cards): Tổng PO | Tổng nhập kho | Tổng phải trả | Đã thanh toán
    - Row 2: Biểu đồ xu hướng mua hàng 12 tháng (line chart)
    - Row 3: Bảng tổng hợp 3 pháp nhân (cột: PO, GR, HĐ, Phải trả, Đã TT, Còn lại)
    - Row 4: Top 10 NCC | Top 10 NVL mua nhiều
    - Row 5: YMH + GR đang pending (action needed)

- [ ] **Bước 7.4** — Cập nhật menu navigation
  - File: `frontend/src/components/AppLayout.tsx`
  - Nhóm "Mua Hàng" hoàn chỉnh:
    - Dự báo nhu cầu
    - Yêu cầu mua hàng (YMH)
    - Đơn mua hàng (PO) — đã có
    - Phiếu nhập kho (GR) — mới
    - Đối soát kho
    - Dashboard mua hàng

---

## Done Criteria

### Giai đoạn 1 (GR Frontend):
- [ ] Truy cập `/warehouse/goods-receipts` → hiện danh sách GR
- [ ] Tạo GR từ PO: auto-fill items, lưu được, duyệt được
- [ ] Duyệt GR → trang_thai chuyển da_duyet, inventory cập nhật

### Giai đoạn 2 (Hạch toán):
- [ ] Approve GR → JournalEntry Nợ 152/153 Có 331 được tạo
- [ ] DebtLedgerEntry NCC được tạo với đúng phap_nhan_id
- [ ] PurchaseOrderItem.so_luong_da_nhan tăng đúng

### Giai đoạn 3 (Đối soát kho):
- [ ] `GET /api/purchase-orders/doi-soat-kho?phap_nhan_id=2` trả đúng data
- [ ] UI DoiSoatKhoPage load được, filter được, highlight được

### Giai đoạn 4 (AP):
- [ ] GR↔HĐ matching API hoạt động
- [ ] APLedgerPage có filter phap_nhan_id
- [ ] Biên bản đối chiếu NCC in được

### Giai đoạn 5 (Dự báo):
- [ ] `POST /api/purchase-forecast/generate?phap_nhan_id=2&ky=2026-05` tạo được danh sách
- [ ] DuBaoNhuCauPage hiển thị, chỉnh sửa được số lượng, duyệt được

### Giai đoạn 6 (YMH):
- [ ] Tạo YMH từ dự báo đã duyệt
- [ ] Workflow: nhap → submit → duyet_pb → tao_po hoạt động end-to-end
- [ ] PO được tạo từ YMH đã duyệt

### Giai đoạn 7 (Dashboard):
- [ ] `/purchase/dashboard` load được, KPI cards đúng số liệu
- [ ] Biểu đồ xu hướng 12 tháng hiển thị
- [ ] Bảng 3 pháp nhân breakdown đúng

### Chung:
- [ ] Lint: không error mới
- [ ] Backend khởi động không lỗi
- [ ] API test từng endpoint mới qua curl

---

## Rủi ro

| Rủi ro | Xử lý |
|---|---|
| JournalEntry TK mapping sai VAS | Dùng ChartOfAccounts table để validate trước khi insert |
| Thuật toán dự báo cho kết quả không thực tế | Cho phép user override số lượng trước khi duyệt |
| Migration làm ảnh hưởng dữ liệu cũ | Tất cả fields mới đều nullable hoặc có default |
| YMH workflow quá phức tạp cho user | Bắt đầu với 2 bước duyệt, có thể disable GĐ approval |
| Performance báo cáo tổng hợp chậm | Thêm index trên (phap_nhan_id, ngay_po, trang_thai) |
