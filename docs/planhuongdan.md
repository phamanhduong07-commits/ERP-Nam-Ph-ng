# KẾ HOẠCH HOÀN THIỆN TÀI LIỆU HƯỚNG DẪN SỬ DỤNG — NAM PHƯƠNG ERP

> **Mục tiêu:** Mỗi bài viết phải đạt chuẩn "Cầm tay chỉ việc" — nhân viên mới đọc xong là làm được ngay, không cần hỏi ai.
> **Định nghĩa DONE:** Mỗi bài có đủ 4 phần: (1) Logic hệ thống, (2) Step-by-step thao tác, (3) Cảnh báo lỗi thường gặp, (4) Vị trí ảnh chụp màn hình.
> **Quy trình viết:** Đọc source code → Hiểu nghiệp vụ → Viết nội dung HTML → Inject vào DocsPage.tsx → Test trên localhost:5173/docs

---

## ✅ CHẶNG 1: Module Bán Hàng & Báo Giá (Sales) — HOÀN THÀNH

- [x] `1.1` Tạo và quản lý Khách Hàng mới (CustomerList.tsx)
- [x] `1.2` Lập Báo Giá thùng Carton — Costing Engine (QuoteForm.tsx)
- [x] `1.3` Chuyển đổi SO và Lập Lệnh Sản Xuất (OrderDetail.tsx)
- [x] `1.4` Trả Hàng Bán (SalesReturnsPage.tsx)
- [x] `1.5` Theo Dõi Đơn Hàng Realtime (TheoDonHangPage.tsx)
- [x] `1.6` Giao Hàng (GiaoHangPage + TabGiaoHang.tsx)
- [x] `1.7` Hóa Đơn VAT (SalesInvoiceListPage.tsx)

---

## 🔲 CHẶNG 2: Module Mua Hàng (Purchasing)

> **Source files:** `purchase/MuaGiayPage.tsx`, `purchase/MuaNVLPage.tsx`, `purchase/POListPage.tsx`, `purchase/YMHListPage.tsx`, `purchase/GoodsReceiptPage.tsx`, `purchase/DuBaoNhuCauPage.tsx`, `purchase/PurchaseReturnPage.tsx`

### Bài 2.1 — Yêu Mua Hàng (YMH) & Dự Báo Nhu Cầu
- **File nguồn:** `YMHListPage.tsx`, `DuBaoNhuCauPage.tsx`
- **Logic cần giải thích:**
  - Ai có quyền tạo YMH? (Thủ kho, Quản đốc, hay Sales?)
  - Hệ thống dự báo thiếu hụt dựa trên: Tồn kho hiện tại + Đơn hàng đang SX − Tổng NVL đã lên PO
  - Khi nào YMH tự động chuyển thành PO?
- **Step-by-step:**
  1. Vào **Mua Hàng > Yêu Mua Hàng**, xem danh sách đang chờ duyệt
  2. Bấm **[+ Tạo YMH]**, chọn loại vật tư (Giấy / NVL phụ)
  3. Điền: Tên hàng, Số lượng cần, Ngày cần hàng, Lý do
  4. Trưởng phòng duyệt YMH → hệ thống hiển thị nút **[Tạo PO]**
- **Ảnh cần chụp:** Màn hình danh sách YMH, Form tạo mới, Trạng thái "Chờ duyệt"
- **Lỗi thường gặp:** Tạo YMH trùng (cùng NVL đang có PO chưa nhận hàng)

### Bài 2.2 — Đặt Hàng Giấy Cuộn (Purchase Order Giấy)
- **File nguồn:** `MuaGiayPage.tsx`, `POListPage.tsx`
- **Logic cần giải thích:**
  - Giấy cuộn có thông số đặc biệt: Khổ giấy (mm), Định lượng (gsm), Loại giấy (Kraft/Test/Medium)
  - Hệ thống tự tính số cuộn dựa trên KG cần mua và trọng lượng/cuộn
  - Quản lý theo NCC (Nhà cung cấp) — giá khác nhau theo từng đợt
- **Step-by-step:**
  1. Vào **Mua Hàng > Mua Giấy**, bấm **[Tạo PO Giấy]**
  2. Chọn Nhà Cung Cấp → hệ thống tự đề xuất giá gần nhất
  3. Chọn từng loại giấy: Khổ, Định lượng, Số cuộn/Số kg
  4. Điền Ngày giao hàng dự kiến, Điều khoản thanh toán
  5. **[Duyệt PO]** → gửi email/Zalo thông báo cho NCC
- **Ảnh cần chụp:** Form tạo PO Giấy (với các trường Khổ, DL, Loại), Danh sách PO với trạng thái
- **Lỗi thường gặp:** Chọn sai đơn vị (Cuộn vs Kg), Giá nhập tay không khớp hợp đồng

### Bài 2.3 — Nhận Hàng Vào Kho (Goods Receipt)
- **File nguồn:** `GoodsReceiptPage.tsx`, `DoiSoatKhoPage.tsx`
- **Logic cần giải thích:**
  - Phải có PO đã duyệt mới được tạo Phiếu Nhận Hàng
  - Hệ thống so sánh SL Nhận thực tế vs SL đặt hàng → tự tính chênh lệch
  - Sau khi xác nhận → Tồn kho NVL tự động cộng lên
  - Tạo Phiếu Nhập Kho (tài liệu chứng từ kế toán)
- **Step-by-step:**
  1. Khi xe hàng về, vào **Mua Hàng > Nhận Hàng**, bấm **[Tạo Phiếu Nhận]**
  2. Chọn PO liên quan → hệ thống tự điền danh sách hàng cần nhận
  3. Điền SL thực nhận từng dòng (có thể nhận 1 phần — partial receipt)
  4. Chụp ảnh phiếu giao hàng NCC đính kèm
  5. **[Xác Nhận Nhận Hàng]** → kho tự động cộng tồn
- **Ảnh cần chụp:** Màn hình tạo Phiếu Nhận, So sánh SL Đặt vs Nhận
- **Lỗi thường gặp:** Nhận hàng mà không link PO → Kế toán không đối soát được

### Bài 2.4 — Trả Hàng Nhà Cung Cấp
- **File nguồn:** `PurchaseReturnPage.tsx`
- **Logic:** Trả hàng NCC (hàng lỗi, sai spec) → Tồn kho tự động trừ, Kế toán ghi giảm công nợ phải trả
- **Step-by-step:** Vào **Mua Hàng > Trả Hàng NCC**, chọn PO gốc, nhập SL trả và lý do

---

## 🔲 CHẶNG 3: Module Kho (Warehouse)

> **Source files:** `warehouse/NhapGiayPage.tsx`, `warehouse/ReceiptsPage.tsx`, `warehouse/IssuesPage.tsx`, `warehouse/TransfersPage.tsx`, `warehouse/InventoryPage.tsx`, `warehouse/InventoryCardPage.tsx`, `warehouse/StockAdjustmentsPage.tsx`, `warehouse/KhoNVLPage.tsx`, `warehouse/NhapPhoiNgoaiPage.tsx`

### Bài 3.1 — Nhập Kho Giấy Cuộn (Nguyên liệu đầu vào)
- **File nguồn:** `NhapGiayPage.tsx`, `ReceiptsPage.tsx`
- **Logic cần giải thích:**
  - Nhập kho Giấy = nhập từ Phiếu Nhận Hàng (link với PO)
  - Mỗi cuộn giấy có ID riêng (barcode) để truy xuất nguồn gốc
  - Kho Giấy tách biệt khỏi Kho NVL Phụ
- **Step-by-step:**
  1. Vào **Kho > Nhập Kho Giấy**, chọn Phiếu Nhận Hàng đã tạo bước trước
  2. Scan/nhập barcode từng cuộn giấy
  3. Chọn Vị Trí Kho (Kệ A1, A2...) để lưu
  4. Xác nhận → Tồn kho hiển thị ngay trên **Kho > Tồn Kho NVL**
- **Ảnh cần chụp:** Giao diện quét barcode, Màn hình Tồn kho NVL sau khi nhập

### Bài 3.2 — Xuất Kho Sản Xuất (Cấp phát NVL cho máy)
- **File nguồn:** `IssuesPage.tsx`
- **Logic:**
  - Xuất NVL cho Lệnh Sản Xuất cụ thể → hệ thống biết cuộn nào dùng cho đơn hàng nào
  - Phương pháp FIFO: cuộn nào nhập trước xuất trước
  - Sau khi xuất → Tồn kho giảm, Lệnh SX cộng vật tư đã cấp
- **Step-by-step:**
  1. Vào **Kho > Xuất Kho**, chọn Lệnh Sản Xuất cần cấp NVL
  2. Hệ thống tự đề xuất cuộn giấy theo FIFO
  3. Scan cuộn giấy để xác nhận đúng vật tư
  4. Xác nhận xuất → Quản đốc nhận thấy trên màn hình máy

### Bài 3.3 — Chuyển Kho Nội Bộ
- **File nguồn:** `TransfersPage.tsx`
- **Logic:** Di chuyển hàng giữa các kho (Kho Giấy → Kho Phân Xưởng A, hay Kho TP → Kho Xuất Hàng)
- **Step-by-step:** Tạo Phiếu Chuyển Kho, chọn kho nguồn/đích, xác nhận

### Bài 3.4 — Xem Tồn Kho & Thẻ Kho
- **File nguồn:** `InventoryPage.tsx`, `InventoryCardPage.tsx`, `KhoNVLPage.tsx`
- **Logic:**
  - **Tồn Kho tổng hợp:** Số lượng + Giá trị hiện tại theo từng loại NVL
  - **Thẻ Kho (Card):** Lịch sử từng lần nhập/xuất của 1 mặt hàng cụ thể
- **Step-by-step:** Tra cứu tồn kho theo tên/mã, xem thẻ kho từng mặt hàng

### Bài 3.5 — Kiểm Kê & Điều Chỉnh Tồn Kho
- **File nguồn:** `StockAdjustmentsPage.tsx`
- **Logic:** Khi kiểm kê phát hiện số thực tế ≠ số trên hệ thống → tạo Phiếu Điều Chỉnh
- **Step-by-step:** Vào **Kho > Điều Chỉnh Tồn**, nhập số thực đếm, chọn lý do lệch, xác nhận

---

## 🔲 CHẶNG 4: Module Sản Xuất (Production)

> **Source files:** `production/ProductionOrderList.tsx`, `production/ProductionPlanList.tsx`, `production/MaySongPage.tsx`, `production/CD2KanbanPage.tsx`, `production/SauInKanbanPage.tsx`, `production/PhieuPhoiPage.tsx`, `production/KhoPhoiPage.tsx`, `production/KhoThanhPhamPage.tsx`, `production/MayInQueuePage.tsx`, `production/ScanMayPage.tsx`, `production/ShiftPage.tsx`

### Bài 4.1 — Lập Kế Hoạch Sản Xuất & Tạo Lệnh SX
- **File nguồn:** `ProductionPlanList.tsx`, `ProductionOrderList.tsx`
- **Logic cần giải thích:**
  - SO (Đơn hàng) → Quản đốc/KHSX tạo Kế Hoạch SX → Tách thành Lệnh SX cho từng máy
  - Lệnh SX có Ngày yêu cầu, Số lượng, Máy thực hiện
  - Ưu tiên chạy theo: Ngày giao hàng sớm nhất → màu đỏ trên kanban
- **Step-by-step:**
  1. Vào **Sản Xuất > Kế Hoạch SX**, xem danh sách SO cần sắp lịch
  2. Bấm **[Tạo Lệnh SX]**, chọn SO, chọn Máy thực hiện
  3. Đặt lịch chạy (ca, ngày), số lượng mỗi ca
  4. **[Phát Lệnh]** → hiển thị trên màn hình màu Kanban ở xưởng

### Bài 4.2 — Quy Trình Công Đoạn 1 — Máy Sóng (CĐ1)
- **File nguồn:** `MaySongPage.tsx`, `PhieuPhoiPage.tsx`, `PhieuNhapPhoiSongPage.tsx`
- **Logic cần giải thích:**
  - CĐ1 = Chạy sóng tấm carton nhiều lớp (3/5/7 lớp)
  - Phiếu Phôi = chứng từ theo dõi số lượng phôi đã chạy, tỉ lệ hao hụt
  - Sau CĐ1 → Phôi (tấm carton chưa in) nhập vào Kho Phôi
- **Step-by-step:**
  1. Công nhân scan thẻ vào ca → hệ thống ghi nhận bắt đầu ca sản xuất
  2. Vào **Sản Xuất > Máy Sóng**, chọn Lệnh SX đang chạy
  3. Nhập SL phôi thực sản xuất sau mỗi ca
  4. Nhập SL phế phẩm (phôi lỗi, đứt sóng)
  5. **[Nhập Phôi Vào Kho]** → Kho Phôi tự động cộng số lượng

### Bài 4.3 — Quy Trình Công Đoạn 2 — In Flexo & Sau In (CĐ2)
- **File nguồn:** `CD2KanbanPage.tsx`, `SauInKanbanPage.tsx`, `MayInQueuePage.tsx`
- **Logic cần giải thích:**
  - CĐ2 = In màu, bế hình, dán/ghim thùng
  - Kanban CĐ2: kéo thẻ từ "Chờ In" → "Đang In" → "Đã In" → "Sau In" → "Thành Phẩm"
  - Máy in có hàng đợi (Queue) — thợ vận hành chọn Job để chạy tiếp theo
- **Step-by-step:**
  1. Vào **Sản Xuất > Kanban CĐ2**, xem các thẻ đang "Chờ In"
  2. Kéo thẻ Job → "Đang In", nhập SL thực in (có thể in nhiều lần)
  3. Sau khi in xong: chuyển sang "Sau In" (công đoạn Bế/Ghim/Dán)
  4. Sau In xong → **[Nhập Thành Phẩm]** vào Kho Thành Phẩm
- **Ảnh cần chụp:** Board Kanban CĐ2 với các thẻ màu sắc

### Bài 4.4 — Scan Máy & Theo Dõi OEE
- **File nguồn:** `ScanMayPage.tsx`, `MachineLoginPage.tsx`, `ShiftPage.tsx`
- **Logic:** Mỗi lần bấm sản phẩm xong → scan barcode → hệ thống ghi nhận sản lượng theo giây → tính OEE tự động
- **Step-by-step:** Đăng nhập máy, bấm Start ca, scan sau mỗi lần sản xuất

### Bài 4.5 — Kho Phôi & Kho Thành Phẩm
- **File nguồn:** `KhoPhoiPage.tsx`, `KhoThanhPhamPage.tsx`
- **Logic:** Theo dõi tồn phôi (đầu vào CĐ2) và tồn thành phẩm (chờ giao hàng)
- **Step-by-step:** Tra cứu tồn theo mã lệnh SX, đơn hàng, ngày sản xuất

---

## 🔲 CHẶNG 5: Module Kế Toán (Accounting)

> **Source files:** `accounting/CashReceiptListPage.tsx`, `accounting/CashPaymentListPage.tsx`, `accounting/APLedgerPage.tsx`, `accounting/ARLedgerPage.tsx`, `accounting/PurchaseInvoiceListPage.tsx`, `billing/SalesInvoiceDetailPage.tsx`, `accounting/ProfitLossPage.tsx`, `accounting/WorkshopManagement.tsx`, `accounting/JournalEntryListPage.tsx`

### Bài 5.1 — Thu Tiền Khách Hàng (AR — Accounts Receivable)
- **File nguồn:** `CashReceiptListPage.tsx`, `ARLedgerPage.tsx`
- **Logic:**
  - Khi KH thanh toán → tạo Phiếu Thu
  - Phiếu Thu link với Hóa Đơn → hệ thống tự tính còn nợ bao nhiêu
  - Sổ Công Nợ (AR Ledger) = tổng hợp tất cả KH và số dư nợ
- **Step-by-step:**
  1. Vào **Kế Toán > Phiếu Thu**, bấm **[+ Tạo Phiếu Thu]**
  2. Chọn Khách Hàng, chọn Hóa Đơn cần thanh toán
  3. Nhập Số Tiền thực nhận, Ngày thu, Hình thức (Tiền mặt/CK)
  4. Xác nhận → Công nợ KH giảm tự động

### Bài 5.2 — Chi Tiền Nhà Cung Cấp (AP — Accounts Payable)
- **File nguồn:** `CashPaymentListPage.tsx`, `APLedgerPage.tsx`
- **Logic:** Thanh toán cho NCC → link Phiếu Mua Hàng → Công nợ phải trả giảm
- **Step-by-step:** Tương tự Phiếu Thu nhưng là Phiếu Chi, chọn NCC và PO liên quan

### Bài 5.3 — Hóa Đơn Bán Hàng & Xuất Hóa Đơn Điện Tử
- **File nguồn:** `billing/SalesInvoiceDetailPage.tsx`
- **Logic:**
  - Sau khi giao hàng → tạo Hóa Đơn từ SO
  - Hóa Đơn Điện Tử: ký số và gửi lên cổng HTKK/VIETTEL
- **Step-by-step:**
  1. Vào **Kế Toán > Hóa Đơn Bán**, chọn SO đã giao hàng
  2. Kiểm tra thông tin KH, MST, địa chỉ
  3. Bấm **[Phát Hành HĐ]** → hệ thống ký số và gửi lên cổng HTKK

### Bài 5.4 — Theo Dõi Công Nợ & Đối Soát
- **File nguồn:** `ARLedgerPage.tsx`, `APLedgerPage.tsx`, `CustomerReconciliation.tsx`
- **Logic:** Sổ Công Nợ KH/NCC — xem ai đang nợ bao nhiêu, quá hạn bao nhiêu ngày
- **Step-by-step:** Lọc theo KH/NCC, xuất Excel báo cáo công nợ

### Bài 5.5 — Báo Cáo Lãi Lỗ & Quản Lý Chi Phí Xưởng
- **File nguồn:** `ProfitLossPage.tsx`, `WorkshopManagement.tsx`
- **Logic:** P&L theo tháng/quý, phân bổ chi phí theo phân xưởng (CĐ1 vs CĐ2)

---

## 🔲 CHẶNG 6: Module Nhân Sự (HR)

> **Source files:** `hr/EmployeeListPage.tsx`, `hr/AttendancePage.tsx`, `hr/PayrollPage.tsx`, `hr/PayrollConfigPage.tsx`, `hr/LeaveApprovalPage.tsx`, `hr/PermissionMatrixPage.tsx`

### Bài 6.1 — Quản Lý Hồ Sơ Nhân Viên
- **File nguồn:** `EmployeeListPage.tsx`
- **Logic:** Thêm mới nhân viên, phân phòng ban, phân xưởng, vị trí
- **Step-by-step:** Thêm hồ sơ, upload CCCD/ảnh, thiết lập lương cơ bản

### Bài 6.2 — Chấm Công & Nghỉ Phép
- **File nguồn:** `AttendancePage.tsx`, `LeaveApprovalPage.tsx`
- **Logic:**
  - Chấm công tự động từ scan máy (ScanMayPage) vs nhập tay
  - Đơn Nghỉ Phép → Trưởng phòng duyệt → tự trừ ngày công
- **Step-by-step:** Xem bảng chấm công tháng, duyệt đơn xin nghỉ

### Bài 6.3 — Tính Lương
- **File nguồn:** `PayrollPage.tsx`, `PayrollConfigPage.tsx`
- **Logic:**
  - Lương sản phẩm: SL sản xuất thực tế (từ ScanMay) × Đơn giá công
  - Lương thời gian: Ngày công × Lương ngày
  - Các khoản khấu trừ: BHXH, tạm ứng, vi phạm
- **Step-by-step:**
  1. Vào **Nhân Sự > Tính Lương**, chọn tháng cần tính
  2. Bấm **[Tính Lương Tự Động]** → hệ thống đọc dữ liệu chấm công + sản lượng
  3. Kiểm tra từng dòng, điều chỉnh nếu có sai sót
  4. **[Chốt Bảng Lương]** → xuất File Excel

### Bài 6.4 — Phân Quyền Hệ Thống
- **File nguồn:** `PermissionMatrixPage.tsx`
- **Logic:** Admin chọn Role → tick quyền từng module → Lưu → Hiệu lực ngay
- **Step-by-step:** Vào **Nhân Sự > Ma Trận Phân Quyền**, chọn role bên trái, tick quyền bên phải

---

## 🔲 CHẶNG 7: Module Danh Mục (Master Data)

> **Source files:** `danhmuc/PaperMaterialList.tsx`, `danhmuc/OtherMaterialList.tsx`, `danhmuc/SupplierList.tsx`, `danhmuc/ProductList.tsx`, `danhmuc/WarehouseList.tsx`, `danhmuc/CauTrucList.tsx`, `danhmuc/PhanXuongList.tsx`

### Bài 7.1 — Quản Lý Danh Mục Giấy (Nguyên Liệu Chính)
- **File nguồn:** `PaperMaterialList.tsx`
- **Logic:** Mỗi loại giấy có: Tên, Khổ (mm), Định lượng (gsm), Nhà cung cấp mặc định, Đơn giá mua
- **Step-by-step:** Thêm loại giấy mới, cập nhật đơn giá khi NCC báo giá mới

### Bài 7.2 — Quản Lý Nhà Cung Cấp
- **File nguồn:** `SupplierList.tsx`
- **Logic:** NCC có thông tin: MST, Điều khoản TT, Ngân hàng, Người liên hệ
- **Step-by-step:** Thêm NCC mới trước khi tạo PO

### Bài 7.3 — Cấu Trúc Thùng Carton (BOM cơ sở)
- **File nguồn:** `CauTrucList.tsx`
- **Logic:** Định nghĩa cấu trúc sóng chuẩn (3L BC, 5L BCB...) → làm nền tảng cho Costing Engine
- **Step-by-step:** Xem và cập nhật công thức tính định mức NVL

---

## 📌 THỨ TỰ THỰC HIỆN ĐỀ XUẤT

```
Chặng 2 (Mua Hàng) → Chặng 3 (Kho) → Chặng 4 (Sản Xuất) 
→ Chặng 5 (Kế Toán) → Chặng 6 (Nhân Sự) → Chặng 7 (Danh Mục)
```

## 📌 CÁCH INJECT NỘI DUNG VÀO ERP

Mỗi bài viết xong → thêm object vào mảng `initialDocs` trong:
```
frontend/src/pages/docs/DocsPage.tsx
```

Format mỗi object:
```typescript
{
  id: '2.1',
  category: 'Phân hệ Mua Hàng',
  title: '2.1 Yêu Mua Hàng & Dự Báo Nhu Cầu',
  content: `<HTML nội dung đầy đủ>`
}
```

Sau khi thêm xong → đổi `localStorage key` (erp_docs_v5, v6...) để force reload dữ liệu mới.
