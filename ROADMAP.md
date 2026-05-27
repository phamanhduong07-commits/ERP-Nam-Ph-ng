# ROADMAP — ERP Nam Phương Bao Bì
Date: 2026-05-23
Mục tiêu: Thay thế hoàn toàn MYPACKSOFT bằng ERP tự chủ

---

## Tổng quan

```
Hiện tại:   MYPACKSOFT (thuê, cũ, khó tùy chỉnh)
                    │
                    ▼
6 tháng:    Song song 2 hệ thống (ERP mới dần thay thế)
                    │
                    ▼
12 tháng:   ERP mới thay thế hoàn toàn
                    │
                    ▼
Dài hạn:    Tự chủ 100%, không phụ thuộc vendor
```

---

## Các module cần xây dựng

| # | Module | Ưu tiên | Phụ thuộc |
|---|---|---|---|
| 1 | Khách hàng (CRM) | Cao | Không |
| 2 | Tính giá carton | Cao | Đã có |
| 3 | Báo giá | Cao | 1, 2 |
| 4 | Đơn hàng bán | Cao | 1, 3 |
| 5 | Kho (nhập/xuất/tồn) | Cao | 4 |
| 6 | Sản xuất (lệnh SX, kế hoạch) | Cao | 4 |
| 7 | Mua hàng (NCC, đặt hàng) | Cao | Không |
| 8 | Điều phối xe & Giao hàng | Cao | 4, 5 |
| 9 | QC Chất lượng | Trung bình | 6 |
| 10 | Bảo dưỡng máy | Trung bình | Không |
| 11 | Yêu cầu mua VPP | Trung bình | Không |
| 12 | Công nợ khách hàng | Cao | 4, 5 |
| 13 | Thu chi / Tài chính | Cao | 12 |
| 14 | Nhân sự & Chấm công | Trung bình | Không |
| 15 | Báo cáo & Dashboard | Cao | Tất cả |
| 16 | Zalo bot tích hợp sâu | Thấp | 1, 2, 4 |
| 17 | GPS xe | Thấp | 8 |
| 18 | Mobile app | Thấp | Tất cả |

---

## PHASE 0 — NỀN TẢNG (Tháng 1)
**Mục tiêu:** 3 dev có data thật, môi trường dev ổn định

### Data Migration
- [ ] Phân tích cấu trúc MYPACKSOFT (xem cột từng bảng)
- [ ] Export master data 1 lần: khách hàng, xe, máy móc, vật tư, sản phẩm
- [ ] Sync tự động hàng ngày: đơn hàng, lệnh SX, phiếu giao hàng

### Dev Team
- [ ] 3 dev onboard, đọc ONBOARDING.md
- [ ] Mỗi dev có local PostgreSQL riêng
- [ ] Git branch workflow hoạt động

### 3 Module đầu tiên (DEV1, DEV2, DEV3)
- [ ] DEV1: Hoàn thiện Yêu cầu mua VPP
- [ ] DEV2: Hoàn thiện Điều phối xe
- [ ] DEV3: Hoàn thiện QC + Bảo dưỡng

---

## PHASE 1 — LÕI BÁN HÀNG (Tháng 1-3)
**Mục tiêu:** Nhân viên sales dùng được ERP mới thay MYPACKSOFT cho bán hàng

### Module Khách hàng (CRM)
- [ ] Danh sách khách hàng (đã có cơ bản)
- [ ] Lịch sử đơn hàng theo khách
- [ ] Công nợ hiện tại của từng khách
- [ ] Phân loại khách hàng (VIP, thường, mới)
- [ ] Import từ MYPACKSOFT DMKhachHang

### Module Báo giá
- [ ] Tạo báo giá từ công thức tính giá carton
- [ ] In PDF báo giá (đã có cơ bản)
- [ ] Theo dõi trạng thái: draft → gửi → chấp nhận → từ chối
- [ ] Lịch sử báo giá theo khách hàng

### Module Đơn hàng bán
- [ ] Tạo đơn từ báo giá được duyệt
- [ ] Theo dõi trạng thái đơn hàng
- [ ] Xác nhận giao hàng
- [ ] In phiếu bán hàng A4
- [ ] Sync từ MYPACKSOFT DTDonHang

### Done Criteria Phase 1
- [ ] Sales dùng ERP mới tạo báo giá, đơn hàng hàng ngày
- [ ] Không cần MYPACKSOFT cho nghiệp vụ bán hàng

---

## PHASE 2 — KHO & SẢN XUẤT (Tháng 3-6)
**Mục tiêu:** Kho và sản xuất chạy hoàn toàn trên ERP mới

### Module Kho
- [ ] Danh mục kho, vị trí kho
- [ ] Phiếu nhập kho (từ mua hàng / sản xuất xong)
- [ ] Phiếu xuất kho (theo đơn hàng)
- [ ] Tồn kho realtime (theo từng sản phẩm, từng kho)
- [ ] Cảnh báo tồn kho thấp
- [ ] In phiếu nhập/xuất kho A5

### Module Sản xuất
- [ ] Kế hoạch sản xuất theo tuần/tháng
- [ ] Lệnh sản xuất (từ đơn hàng → lệnh SX)
- [ ] BOM (Bill of Materials) — nguyên liệu cần cho mỗi sản phẩm
- [ ] Ghi nhận tiến độ sản xuất
- [ ] Hoàn thành → nhập kho thành phẩm
- [ ] Phân công máy móc cho từng lệnh SX
- [ ] Sync từ MYPACKSOFT DTKH, DTLSX

### Module Mua hàng
- [ ] Danh mục nhà cung cấp
- [ ] Đặt hàng NCC (Purchase Order)
- [ ] Theo dõi trạng thái đơn mua
- [ ] Nhận hàng → tự động tạo phiếu nhập kho
- [ ] In đơn mua hàng A4
- [ ] Công nợ nhà cung cấp

### Done Criteria Phase 2
- [ ] Kho không dùng MYPACKSOFT nữa
- [ ] Lệnh SX tạo từ ERP mới
- [ ] Tồn kho chính xác, realtime

---

## PHASE 3 — TÀI CHÍNH & NHÂN SỰ (Tháng 6-9)
**Mục tiêu:** Tài chính và nhân sự cơ bản chạy trên ERP mới

### Module Công nợ & Thu chi
- [ ] Công nợ khách hàng (theo đơn hàng đã giao)
- [ ] Phiếu thu tiền (in A5 Mẫu 01-TT)
- [ ] Phiếu chi tiền (in A5 Mẫu 02-TT)
- [ ] Báo cáo công nợ theo ngày/tuần/tháng
- [ ] Cảnh báo khách hàng quá hạn thanh toán
- [ ] Đối chiếu thu chi với ngân hàng

### Module Nhân sự
- [ ] Danh sách nhân viên
- [ ] Chấm công (import từ máy chấm công hoặc nhập tay)
- [ ] Tính lương cơ bản
- [ ] Quản lý phép năm
- [ ] Import từ MYPACKSOFT Employee

### Done Criteria Phase 3
- [ ] Kế toán dùng ERP mới cho thu chi hàng ngày
- [ ] Báo cáo công nợ chính xác

---

## PHASE 4 — BÁO CÁO & NÂNG CAO (Tháng 9-12)
**Mục tiêu:** Ban lãnh đạo có đủ báo cáo để ra quyết định

### Dashboard & Báo cáo
- [ ] Dashboard tổng quan: doanh thu, tồn kho, sản xuất, công nợ
- [ ] Báo cáo doanh thu theo ngày/tuần/tháng/năm
- [ ] Báo cáo sản xuất: năng suất, hiệu quả máy
- [ ] Báo cáo kho: xuất nhập tồn
- [ ] Báo cáo QC: tỷ lệ lỗi theo lô/máy/sản phẩm
- [ ] Báo cáo vận chuyển: chi phí, hiệu quả xe
- [ ] Export Excel tất cả báo cáo

### Nâng cao
- [ ] Phân quyền chi tiết theo vai trò (sale, kho, kế toán, giám đốc...)
- [ ] Audit log: ai làm gì, lúc nào
- [ ] Backup tự động hàng ngày (đã có)
- [ ] Thông báo Zalo/email cho các sự kiện quan trọng

### Tích hợp Zalo Bot
- [ ] Bot báo tồn kho thấp
- [ ] Bot báo đơn hàng mới
- [ ] Bot báo xe cần bảo dưỡng
- [ ] Khách hàng hỏi đơn hàng qua Zalo

### Done Criteria Phase 4
- [ ] Giám đốc xem được toàn bộ tình hình công ty trên 1 màn hình
- [ ] Không cần MYPACKSOFT cho bất kỳ báo cáo nào

---

## PHASE 5 — DỪNG MYPACKSOFT (Tháng 12+)
**Mục tiêu:** Tự chủ 100%

- [ ] Toàn bộ nhân viên dùng ERP mới
- [ ] Migrate 100% dữ liệu lịch sử từ MYPACKSOFT
- [ ] Dừng trả phí MYPACKSOFT
- [ ] Lưu trữ MYPACKSOFT database để tham chiếu lịch sử

---

## Phân công 3 Dev (Phase 0 → Phase 1)

| Dev | Phase 0 | Phase 1 | Phase 2 |
|---|---|---|---|
| Dev 1 | Yêu cầu mua VPP | Module Khách hàng | Module Mua hàng |
| Dev 2 | Điều phối xe | Module Đơn hàng | Module Kho |
| Dev 3 | QC + Bảo dưỡng | Module Báo giá | Module Sản xuất |

---

## Quy tắc phát triển (áp dụng mọi phase)

1. **Data migration trước** — có data thật mới dev được chính xác
2. **Test với data thật** — không dùng dữ liệu giả
3. **Commit sau mỗi bước nhỏ** — dễ rollback nếu có lỗi
4. **Backup hàng ngày** — đã setup Task Scheduler 2:00 AM
5. **PR review** — anh Dương review trước khi merge vào main
6. **Hỏi ngay khi không rõ** — không tự giả định nghiệp vụ

---

## Thứ tự ưu tiên tuyệt đối

```
Tháng 1:  Data migration + DEV1 + DEV2 + DEV3
Tháng 2:  Bán hàng (báo giá + đơn hàng)
Tháng 3:  Kho cơ bản + Sản xuất cơ bản
Tháng 4:  Mua hàng + Kho nâng cao
Tháng 5:  Tài chính cơ bản (thu chi, công nợ)
Tháng 6:  Báo cáo + Dashboard
Tháng 7+: Nhân sự, nâng cao, tích hợp sâu
Tháng 12: Dừng MYPACKSOFT
```

---

## Rủi ro lớn cần theo dõi

| Rủi ro | Xác suất | Xử lý |
|---|---|---|
| Dev nghỉ giữa chừng | Trung bình | Code review kỹ, document đầy đủ |
| Scope creep (thêm tính năng không có kế hoạch) | Cao | Giữ đúng roadmap, tính năng mới → phase sau |
| Data MYPACKSOFT không khớp | Trung bình | Phân tích kỹ Phase 0 |
| Nhân viên kháng cự đổi hệ thống | Cao | Training sớm, UI đơn giản hơn MYPACKSOFT |
| Server cúp điện/hỏng | Thấp | Backup hàng ngày, UPS |
