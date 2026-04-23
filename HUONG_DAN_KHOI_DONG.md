# HƯỚNG DẪN KHỞI ĐỘNG ERP NAM PHƯƠNG

## Yêu cầu
- Python 3.14 (đã cài)
- Node.js 24 (đã cài)
- PostgreSQL 15+ (cần cài thêm)

---

## BƯỚC 1: Cài PostgreSQL

1. Tải tại: https://www.postgresql.org/download/windows/
2. Cài với mật khẩu `postgres`
3. Tạo database và user:

```sql
-- Chạy trong psql hoặc pgAdmin
CREATE USER erp_user WITH PASSWORD 'erp_password';
CREATE DATABASE erp_nam_phuong OWNER erp_user;
GRANT ALL PRIVILEGES ON DATABASE erp_nam_phuong TO erp_user;
```

---

## BƯỚC 2: Cấu hình Backend

```bash
cd backend
copy .env.example .env
# Sửa .env nếu cần đổi mật khẩu DB
```

---

## BƯỚC 3: Khởi tạo Database & Import dữ liệu Excel

```bash
cd backend

# Tạo bảng + import dữ liệu từ Excel
C:\Users\USER\AppData\Local\Programs\Python\Python314\python.exe scripts/import_excel.py
```

---

## BƯỚC 4: Chạy Backend (cửa sổ 1)

```bash
cd backend
C:\Users\USER\AppData\Local\Programs\Python\Python314\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

API docs: http://localhost:8000/api/docs

---

## BƯỚC 5: Chạy Frontend (cửa sổ 2)

```bash
cd frontend
npm run dev
```

Truy cập: http://localhost:5173

---

## Đăng nhập lần đầu
- **Tài khoản**: admin
- **Mật khẩu**: Admin@123
- **⚠️ Đổi mật khẩu ngay!**

---

## Cấu trúc dự án

```
erp-nam-phuong/
├── database/
│   └── schema.sql          -- Schema PostgreSQL đầy đủ
├── backend/                -- FastAPI (Python)
│   ├── app/
│   │   ├── models/         -- SQLAlchemy models
│   │   ├── schemas/        -- Pydantic schemas
│   │   └── routers/        -- API endpoints
│   └── scripts/
│       └── import_excel.py -- Import dữ liệu từ Excel
└── frontend/               -- React + Ant Design
    └── src/
        ├── pages/sales/    -- Module Đơn hàng
        ├── api/            -- API clients
        └── store/          -- Zustand state
```

## Module đã hoàn thành
- ✅ Database schema (9 module, 45+ bảng)
- ✅ Xác thực & phân quyền (8 vai trò)
- ✅ Import dữ liệu từ Excel (khách hàng, sản phẩm, NVL, tồn kho)
- ✅ Module Bán hàng: Nhận đơn / Duyệt / Huỷ
- ✅ Module Lệnh sản xuất: Tạo / Bắt đầu / Cập nhật tiến độ / Hoàn thành / Huỷ

## Module tiếp theo sẽ làm
- Mua hàng & Nhập kho NVL
- Quản lý tồn kho cuộn giấy
- Xuất kho thành phẩm / Giao hàng
- Kế toán công nợ
