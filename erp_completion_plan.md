# Kế hoạch Hoàn thiện ERP Nam Phương
Date: 2026-05-24
Status: IN_PROGRESS — Sprint 6 kế tiếp

---

## Mục tiêu
Thay thế hoàn toàn MYPACKSOFT trong 12 tháng (deadline: 2026-12).

## Trạng thái tổng thể
| Module | % | Ghi chú |
|---|---|---|
| Bán hàng | ~90% | Gần production-ready |
| Kho & Sản xuất | ~72% | fix chuyển kho ✅ Sprint 1 |
| Tài chính | ~82% | CĐPS ✅ Sprint 4, HĐDT MISA ✅ Sprint 5 |
| Nhân sự | ~85% | Import bulk ✅ Sprint 3 |
| Mua hàng | ~80% | YMH workflow ✅ Sprint 2 |
| Báo cáo | ~75% | Export Excel ✅ Sprint 2+4, giá thành+P&L ✅ Sprint 4 |
| Security | ~95% | 44 endpoints secured ✅ Sprint 1 |

---

## Sprint 1 — DONE (2026-05-24)
- [x] Auth guard 44 endpoints (7 routers) — 4071b64
- [x] don_gia_noi_bo chuyển kho phôi + migration dnb001 — 2349fdd
- [x] N+1 fix selectinload (purchase_orders x2, prod_order_svc) — 61ef5e1

## Sprint 2 — DONE (2026-05-24)
- [x] YMH workflow: submit → approve → reject → auto tạo PO — b1c489e
- [x] Export Excel: 5 báo cáo chính (doanh thu, XNT, công nợ, SX, tiến độ) — 05e4f6f
- [x] Dashboard KPI: backlog SX, tồn phôi/TP, công nợ quá hạn — 66cd9ed
- Bug fixed: migration ymh001 branch conflict (down_revision del001→dnb001)

## Sprint 3 — Data Migration (Tháng 7 T1-2) — DONE (2026-05-24)
- [x] Import lịch sử đơn hàng 2 năm (bo_qua_hach_toan trên SalesOrder + import field) — 9266c43
- [x] Import lịch sử nhân viên bulk (POST /hr/employees/import, upsert ma_nv) — 7ee6807
- [x] Import lịch sử lương 1 năm (POST /hr/payroll/import-history, upsert thang/nam) — 7ee6807
- Note: KH/NCC/SP import đã có sẵn từ trước (customers, suppliers, products router)

## Sprint 4 — Báo cáo Nâng cao (Tháng 7 T3-4) — DONE (2026-05-24)
- [x] CĐPS export Excel (GET /accounting/trial-balance/export) — 27e183e
- [x] Giá thành SX export Excel (GET /accounting/reports/production-costing/export) — 27e183e
- [x] Workshop P&L export Excel (GET /accounting/reports/workshop-pnl-export) — 27e183e
- [x] Frontend: nút Xuất Excel cho CĐPS, Giá thành SX, Workshop P&L — 36aa521
- Fix: phan_xuong_id optional (int | None) cho Workshop P&L endpoint + service

## Sprint 5 — Hóa đơn điện tử (Tháng 8) — DONE (2026-05-24)
- [x] Quyết định: API MISA meInvoice
- [x] Model HoaDonDienTu + migration hdt001 — c825f67
- [x] MISA service (create/publish/cancel/sync) + config settings — c825f67
- [x] Router /hoa-don-dien-tu (CRUD + phát hành + hủy + sync-status) — c825f67
- [x] Frontend: danh sách HĐ + filter + actions + menu Kế toán — 72e0de8
- Note: Cần set MISA_USERNAME/PASSWORD/COMPANY_CODE/SERIAL trong .env để kết nối thật

## Sprint 6 — Zalo Bot (Tháng 8-9)
- [ ] Bot thông báo: tồn thấp, đơn quá hạn, phiếu thu đến hạn
- [ ] Khách tra đơn qua Zalo → ERP API

---

## Go/No-Go checklist dừng MYPACKSOFT
- [ ] ERP mới chạy 100% nghiệp vụ hàng ngày ≥ 30 ngày
- [ ] 0 endpoint sensitive không có auth
- [ ] Data migration verified bởi kế toán + sales
- [ ] Backup daily + test restore thành công
- [ ] Tất cả user training ≥ 2 buổi
- [ ] HĐDT ổn định ≥ 1 tháng

---

## Quy trình Orchestrator (mỗi sprint)
```
1. Chia task → 3 nhóm độc lập, mỗi nhóm 1 agent
2. Dispatch song song — prompt ngắn (~200 từ), chỉ context cần thiết
3. Chờ notification → audit ngay khi xong
4. Fix bugs trong audit (không để agent fix lại — tránh vòng lặp)
5. Commit 1 commit/nhóm — message WHY
6. Cập nhật file này → sprint tiếp theo
```
