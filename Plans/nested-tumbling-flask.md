# Kế Hoạch Thực Hiện — ERP Nam Phương

> Re-audit lần 2 (2026-06-02): 6 agents song song, audit sâu hơn lần đầu.
> **Điểm hệ thống: 3.3/5** (từ 3.2/5 — Sprint 1+2 fix stability nhưng audit sâu hơn lộ issues mới).
> Mục tiêu: production-ready → 4.2/5 sau Sprint 3.

---

## Điểm từng module (Re-audit 2026-06-02)

| Module | Điểm | Delta | Nhận xét |
|--------|------|-------|---------|
| Auth/Security | 3.2/5 | ~0 | Sprint 1 auth guards ✓, nhưng CD2 plain-text pwd còn, no rate limit |
| Sales/CRM | 3.4/5 | +0.4 | Sprint 2 fixes ✓, nhưng mới phát hiện race condition so_don + float/Decimal |
| Production/Warehouse | 3.4/5 | +0.4 | Sprint 2 fixes ✓, nhưng thiếu row lock trên InventoryBalance |
| Finance/Accounting | 3.4/5 | +0.4 | Sprint 2 fixes một phần, PUT /hoa-don-dien-tu vẫn raw dict, journal sync thiếu |
| HR/Payroll | 2.4/5 | -0.8 | Audit sâu hơn: tam_ung=tong_phat bug, he_so_ca_nhan không áp dụng |
| Logistics/QC/MRP | 3.6/5 | +0.6 | Eager load ✓, nhưng QC field mapping sai, MRP không tính warehouse riêng |
| **Tổng** | **3.3/5** | **+0.1** | Score barely moved — Sprint 2 fix stability, nhưng audit sâu lộ issues mới |

---

## Sprint 1 — DONE ✅ (Tuần 1)

Tất cả 8 tasks Sprint 1 đã hoàn thành: auth guards 44 endpoints, so_lop_giay payroll, N+1 selectinload, chuyển kho, hash password centralize.

---

## Sprint 2 — DONE ✅ (Tuần 2)

Tất cả Sprint 2 tasks đã hoàn thành: SO confirm-delivery/complete, quote date fix, SalesReturn Decimal, _sync_so_trang_thai, CD2 rollback, warehouse null check + with_for_update, accounting try/except + Decimal, HoaDonDienTu POST Pydantic, yeu_cau_giao_hang eager load, reports/production-cost endpoint.

**NOTE:** Sprint 2 đã fix THEO PLAN nhưng audit sâu hơn phát hiện gaps mới:
- `PUT /hoa-don-dien-tu/{id}` vẫn nhận `body: dict` (chỉ fix POST)
- `approve_payment` thiếu idempotency check (chỉ thêm try/except, chưa check đã approved chưa)
- Finance: VAT split và revenue journal sync chưa làm (Sprint 3)
- HR: `hr.py:727` default password "123456" vẫn còn (Sprint 1 task không đủ — chỉ centralize hash, chưa xóa hardcode)

---

## Sprint 3 — Security & Business Logic Gaps (Tuần 3) ← CURRENT

**Mục tiêu:** Đóng tất cả CRITICAL còn lại + HIGH priority business logic.

### 3.A Quick Wins (1-5 line fixes)

| Task | File | Chi tiết |
|------|------|---------|
| Fix `tam_ung = tong_phat` → tách thành `khau_tru_kl` riêng | `hr_payroll_calc.py:206` | CRITICAL — discipline deduction ≠ advance payment |
| Xóa hardcode `'123456'` — generate random password + force change | `hr.py:727` | CRITICAL — bảo mật |
| Fix `tc_sai_so_pct` lấy từ `pm.tieu_chuan_dinh_luong` sai field | `qc_giay_cuon.py:197` | CRITICAL — QC pass/fail logic sai |
| Fix `PUT /hoa-don-dien-tu/{id}` nhận raw dict → Pydantic model | `hoa_don_dien_tu.py:107` | CRITICAL — injection risk |
| Thêm state guard trong `approve_payment`: check đã approved chưa | `accounting_service.py:~1200` | CRITICAL — double-spend |

### 3.B Finance Fixes

| Task | File | Chi tiết |
|------|------|---------|
| Thêm VAT split (TK 133) trong `_post_cash_payment_journal()` khi `vat_pct > 0` | `accounting_service.py:462` | HIGH — TK 331 vs TK 3331 |
| Gọi `_post_revenue_journal()` sau khi phát hành HĐDT thành công | `hoa_don_dien_tu.py:161` | HIGH — doanh thu không vào sổ |
| Fix float→Decimal trong `_apply_cash_payment_to_invoice_and_debt` line 313-315 | `accounting_service.py:313` | HIGH — precision loss |

### 3.C Production/Warehouse

| Task | File | Chi tiết |
|------|------|---------|
| Add `with_for_update()` trên InventoryBalance trước `xuat_balance()` | `warehouse.py:1642` | CRITICAL — race condition |
| Validate `balance.ton_luong >= sl_nhap` trước khi delete PhieuNhapPhoiSong | `production_orders.py:879` | CRITICAL — negative inventory |
| Store `sl_nhap` vào PhieuNhapPhoiSongItem để dùng khi reversal | `production_orders.py:782` | HIGH — deletion mismatch |
| Validate `trang_thai in ('dang_chay','hoan_thanh')` trước khi tạo MaterialIssue | `warehouse.py:1624` | MEDIUM |

### 3.D HR & Payroll

| Task | File | Chi tiết |
|------|------|---------|
| Áp dụng `he_so_ca_nhan` vào `luong_theo_ngay_cong` | `hr_payroll_calc.py:130` | HIGH — coefficient bị ignore |
| Thêm payroll approval endpoint `POST /api/hr/payroll/{id}/approve` | `hr_payroll_calc.py` | CRITICAL — no workflow |
| Export Excel bảng lương `GET /api/hr/payroll/export-excel` | `hr_payroll_calc.py` | HIGH |
| Add AuditLog cho generate/approve payroll | `hr_payroll_calc.py` | MEDIUM |

### 3.E Auth Hardening

| Task | File | Chi tiết |
|------|------|---------|
| Xóa plain-text password fallback trong CD2 (lines 2055-2056) | `cd2.py:2055` | CRITICAL |
| Add rate limiting: 5 failed logins / 15 phút / IP | `auth.py:38` | HIGH |
| Add account lockout sau 10 failed attempts | `users.py` | HIGH |

### 3.F QC & Sales

| Task | File | Chi tiết |
|------|------|---------|
| Add role guard `require_roles('QC','GIAM_DOC','ADMIN')` cho CREATE qc_giay_cuon | `qc_giay_cuon.py:181` | HIGH |
| Fix race condition so_don/so_bao_gia — dùng `SELECT FOR UPDATE` hoặc DB SEQUENCE | `sales_order_service.py:22` | HIGH |
| Fix float/Decimal trong SalesOrder tong_tien calculation | `sales_orders.py:183` | HIGH |

### 3.G Verify Sprint 3
```bash
# Test double-spend guard
# Approve same payment twice → expect 400 thứ hai

# Test tam_ung vs tong_phat
# Tạo discipline record, generate payroll, verify thuc_linh = tong_thu_nhap - tong_phat, tam_ung riêng

# Test InventoryBalance lock
# Concurrent warehouse exports → no negative inventory

# Test HĐDT journal
# Publish HĐDT → check journal entry TK 511 created

# Test VAT split
# Approve payment có VAT → check TK 133 entry in journal

# Test rate limiting
# 6 failed logins → expect 429
```

---

## Sprint 4 — Architecture (Tuần 4) ← NEXT

**Mục tiêu:** 2 module thiếu nền tảng và gaps logistics.

### 4.1 MRP Redesign (thêm warehouse + lead time + other materials)

| Task | File | Chi tiết |
|------|------|---------|
| Add `warehouse_id` param + filter InventoryBalance by warehouse | `mrp_service.py:42` | CRITICAL — cross-warehouse overcounting |
| Thêm `lead_time_ngay` vào `NhaCungCap` và `VatTu` | `models/master.py` | HIGH |
| Extend MRP BOM loop: tính cả `other_material_id` items | `mrp_service.py:33` | HIGH |
| Add `GET /api/mrp/alerts` — materials dưới ton_toi_thieu | `routers/mrp.py` | MEDIUM |

### 4.2 Logistics — Trip Consolidation

| Task | File | Chi tiết |
|------|------|---------|
| Implement `POST /api/lo-xe/create-from-yc` — gộp YC thành 1 chuyến | `routers/lo_xe.py` (new) | HIGH |
| Thêm `da_sap_xe` state trong YeuCauGiaoHang lifecycle | `yeu_cau_giao_hang.py` | HIGH |
| Fix cước tính theo route, không phải flat m² rate | `warehouse.py:2363` | MEDIUM |

### 4.3 Auth — Persistent Token Blacklist

| Task | File | Chi tiết |
|------|------|---------|
| Move JTI blacklist từ in-memory → DB (TokenBlacklist model) | `deps.py:33` | HIGH |
| Implement refresh token rotation | `auth.py` | MEDIUM |

### 4.4 Sales Precision

| Task | File | Chi tiết |
|------|------|---------|
| Fix SalesReturn approval transaction (accounting journal + inventory atomically) | `sales_returns.py:530` | HIGH |
| Add Quote reject path: `cho_duyet` → `moi` | `quotes.py` | HIGH |

---

## CRITICAL Issues Còn Lại (sau Sprint 2) — 17 issues

| # | Module | Issue | File:Line | Priority |
|---|--------|-------|-----------|---------|
| 1 | Auth | CD2 plain-text password fallback | `cd2.py:2055` | **Sprint 3.E** |
| 2 | Auth | Default password "123456" không xóa | `hr.py:727` | **Sprint 3.A** |
| 3 | Sales | Race condition so_don generation | `sales_order_service.py:22` | Sprint 3.F |
| 4 | Sales | Float/Decimal trong order totals | `sales_orders.py:183` | Sprint 3.F |
| 5 | Sales | SalesReturn approve không transactional | `sales_returns.py:530` | Sprint 4 |
| 6 | Production | No row lock InventoryBalance | `warehouse.py:1642` | **Sprint 3.C** |
| 7 | Production | PhieuNhapPhoiSong delete → negative inv | `production_orders.py:879` | **Sprint 3.C** |
| 8 | Finance | Double-spend idempotency missing | `accounting_service.py:~1200` | **Sprint 3.A** |
| 9 | Finance | Float/Decimal trong payment tracking | `accounting_service.py:313` | Sprint 3.B |
| 10 | Finance | PUT /hoa-don-dien-tu raw dict injection | `hoa_don_dien_tu.py:107` | **Sprint 3.A** |
| 11 | Finance | HĐDT publish không sync revenue journal | `hoa_don_dien_tu.py:161` | Sprint 3.B |
| 12 | Finance | VAT split thiếu trong payment journal | `accounting_service.py:462` | Sprint 3.B |
| 13 | HR | `tam_ung = tong_phat` wrong semantics | `hr_payroll_calc.py:206` | **Sprint 3.A** |
| 14 | HR | `he_so_ca_nhan` không áp dụng vào lương | `hr_payroll_calc.py:130` | Sprint 3.D |
| 15 | HR | Không có payroll approval workflow | `hr_payroll_calc.py` | Sprint 3.D |
| 16 | QC | `tc_sai_so_pct` lấy wrong field | `qc_giay_cuon.py:197` | **Sprint 3.A** |
| 17 | MRP | Không tính theo warehouse riêng | `mrp_service.py:42` | Sprint 4.1 |

---

## Tiến độ mục tiêu (revised)

| Sprint | Tuần | Điểm kỳ vọng | Gate |
|--------|------|-------------|------|
| Sprint 1 | Tuần 1 | 3.2/5 ✅ | Auth guards + blockers |
| Sprint 2 | Tuần 2 | 3.3/5 ✅ | Stability + business logic |
| Sprint 3 | Tuần 3 | **3.8/5** | 0 CRITICAL finance/hr/qc còn lại |
| Sprint 4 | Tuần 4 | **4.2/5** | MRP + Logistics + Auth hardening |

---

## Quy tắc trong suốt kế hoạch

- Mỗi fix phải có curl test verify ngay sau khi code
- Migration Alembic: xác nhận tay trước `alembic upgrade head`
- Security changes → bắt buộc gọi `security-reviewer` agent trước khi báo xong
- Deploy: `.\update.ps1` (build frontend → copy → restart backend port 8001)
