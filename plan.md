# Plan: Hợp nhất ensure_schema() vào Alembic
Date: 2026-05-17
Status: PENDING_APPROVAL

## Mục tiêu
Chuyển toàn bộ DDL đang nằm trong `ensure_schema()` (database.py) vào Alembic migrations,
để Alembic trở thành nguồn sự thật duy nhất về schema. Không thay đổi cấu trúc dữ liệu
hiện tại — mọi thao tác đều dùng `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`.

## Phân tích — Kết quả Phase 1

### Heads hiện tại
- **Head 1**: `cc1dd2ee3ff4` (add_so_po_kh)
- **Head 2**: `t1u2v3w4x5y7` (hr_payroll_details)

### Bảng chỉ có trong ensure_schema(), KHÔNG có trong migration nào
| Bảng | Model | Vấn đề |
|---|---|---|
| `machines` | `Machine` trong cd2.py | Không import trong __init__.py |
| `production_logs` | `ProductionLog` trong cd2.py | Không import trong __init__.py |
| `agent_sessions` | Không có model | Cần tạo mới |

### Cột chỉ có trong ensure_schema(), KHÔNG có trong migration nào (30 cột)
- `purchase_orders`: phan_xuong_id, loai_po
- `purchase_order_items`: kho_mm, so_cuon, ky_hieu_cuon, phoi_spec (JSONB), production_plan_line_id
- `production_plan_lines`: mua_phoi_ngoai
- `paper_materials`: ma_dong_cap, do_buc_tb, do_nen_vong_tb
- `goods_receipt_items`: kho_mm, so_cuon, ky_hieu_cuon, dai_mm, so_lop
- `goods_receipts`: so_xe, invoice_image, hd_tong_kg, phap_nhan_id
- `printer_user`: machine_id (FK → machines)
- `production_orders`: don_gia_noi_bo
- `delivery_orders`: lo_xe_id (FK), lo_xe_id_2 (FK), lo_xe_2, so_seal, gui_kem_theo, phap_nhan_id
- `don_gia_van_chuyen`: don_gia_m2
- `print_templates`: phap_nhan_id + DROP CONSTRAINT print_templates_ma_mau_key

### Model không được import trong __init__.py (Alembic không thấy)
- Từ `cd2.py`: Machine, ProductionLog, PrinterUser, MayScan, ScanLog, MaySauIn, ShiftCa, ShiftConfig
- Từ `master.py`: LoXe, TaiXe, Xe, DonGiaVanChuyen, DonViTinh, ViTri, TinhThanh, PhuongXa

## Các bước thực thi

- [ ] **Bước 1**: Thêm `AgentSession` model vào `backend/app/models/system.py`
  - File: `backend/app/models/system.py`
  - Mục tiêu: Tạo class SQLAlchemy ánh xạ bảng `agent_sessions`

- [ ] **Bước 2**: Cập nhật `backend/app/models/__init__.py` — thêm import còn thiếu
  - File: `backend/app/models/__init__.py`
  - Mục tiêu: Alembic nhìn thấy đủ toàn bộ model, autogenerate chính xác

- [ ] **Bước 3**: Tạo migration tổng hợp (merge heads + DDL catch-up)
  - File: `backend/alembic/versions/a0b1c2d3e4f5_sync_ensure_schema_to_alembic.py`
  - Mục tiêu: Merge cc1dd2ee3ff4 + t1u2v3w4x5y7, CREATE/ADD IF NOT EXISTS toàn bộ

- [ ] **Bước 4**: Làm sạch `ensure_schema()` trong `backend/app/database.py`
  - File: `backend/app/database.py`
  - Mục tiêu: Xóa toàn bộ DDL, giữ nguyên data seed (phan_xuong)

## Done Criteria
- [ ] `backend/app/models/__init__.py` import đủ tất cả model classes
- [ ] Migration mới chạy không lỗi trên DB hiện tại (IF NOT EXISTS bảo vệ)
- [ ] `ensure_schema()` không còn chứa bất kỳ CREATE TABLE / ALTER TABLE nào
- [ ] `alembic check` (so sánh model với DB) không phát hiện diff mới nào
- [ ] Backend khởi động bình thường sau thay đổi

## Rủi ro
- **Không có rủi ro với dữ liệu hiện tại**: Tất cả DDL dùng IF NOT EXISTS — nếu cột/bảng đã tồn tại thì no-op
- **Rủi ro lý thuyết với fresh deploy**: Bảng `lo_xe` được tạo bởi ensure_schema() trước migration `h1r2s3t4u5v8` (vấn đề tiền sử, không thay đổi trong task này)
- **Downgrade**: Migration này không có downgrade hoàn chỉnh (các ADD COLUMN IF NOT EXISTS không có DROP tương ứng) — đây là trade-off chủ ý vì đây là catch-up migration
