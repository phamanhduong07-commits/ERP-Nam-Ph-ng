# Plan: Ổn định nền tảng ERP
Date: 2026-05-15
Status: PENDING_APPROVAL

## Mục tiêu
Đảm bảo toàn bộ chuỗi Alembic migration là một chuỗi tuyến tính duy nhất có thể chạy
trên database trắng, backend import không lỗi, và frontend build thành công.

## Các bước thực thi

- [ ] Bước 1: Merge nhánh HR vào main chain
  - File: `backend/alembic/versions/h1r2s3t4u5v8_logistics_trip_vehicle_payroll.py`
  - Mục tiêu: Sửa `down_revision` của migration tiếp theo trong main chain để nối HR vào sau `ac1_add_purchase_requisitions` (head hiện tại), hoặc tạo merge migration bằng `alembic merge`
  - Cách làm: Tạo 1 merge migration `alembic merge -m "merge_hr_into_main" ac1_add_purchase_requisitions h1r2s3t4u5v8`

- [ ] Bước 2: Merge nhánh quote_item vào main chain
  - File: `backend/alembic/versions/aa_quote_item_ma_ky_hieu_sale_admin_roles.py`
  - Mục tiêu: Nối migration này vào sau merge ở bước 1
  - Cách làm: Tạo merge migration thứ 2 hoặc nối tiếp vào kết quả bước 1

- [ ] Bước 3: Kiểm tra chuỗi sau merge
  - Chạy `alembic heads` → phải ra đúng 1 head
  - Chạy `alembic history --verbose` để xác nhận thứ tự

- [ ] Bước 4: Test upgrade trên database dev
  - Chạy `alembic upgrade head` trên database dev
  - Xác nhận không có lỗi

- [ ] Bước 5: Smoke test backend import
  - Chạy `python -c "from app.main import app"` trong venv
  - Xác nhận tất cả router import được, không có ImportError

- [ ] Bước 6: Build frontend
  - Chạy `npm run build` trong thư mục `frontend/`
  - Xác nhận build thành công, không có TypeScript error

## Done Criteria
- [ ] `alembic heads` trả về đúng 1 revision
- [ ] `alembic upgrade head` chạy thành công trên database trắng
- [ ] `python -c "from app.main import app"` không có error
- [ ] `npm run build` thành công (exit code 0)
- [ ] Lint: không có error blocking

## Rủi ro
- Merge migration có thể gây conflict nếu HR và main chain đều tạo cùng 1 bảng/column → kiểm tra nội dung 2 nhánh trước khi merge
- `alembic upgrade head` trên database đang có dữ liệu có thể fail nếu column NOT NULL không có default → test trên database dev mới trước
