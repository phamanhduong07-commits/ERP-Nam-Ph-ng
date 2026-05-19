---
name: new-router
description: Tạo FastAPI router mới theo chuẩn project Nam Phương ERP. Nhận tên resource (ví dụ: "bao_bi" hoặc "nha_kho") và tạo đầy đủ model + schema + router + mount vào main.py.
---

Tạo FastAPI router mới cho resource: **$ARGUMENTS**

## Thực thi theo thứ tự sau

### Bước 1 — Đọc context
Đọc các file sau để hiểu pattern hiện tại trước khi viết:
- `backend/app/models/` — xem 1 model mẫu gần nhất
- `backend/app/schemas/` — xem 1 schema mẫu
- `backend/app/routers/customers.py` hoặc `suppliers.py` — router CRUD mẫu
- `backend/app/deps.py` — import get_current_user, get_admin_user
- `backend/app/main.py` — xem cách mount router

### Bước 2 — Tạo Model
Thêm SQLAlchemy model vào file phù hợp trong `backend/app/models/`.
Dùng các cột chuẩn: `id`, `created_at`, `updated_at`, `user_id` (nếu cần).

### Bước 3 — Tạo Schema
Thêm Pydantic schemas vào `backend/app/schemas/`:
- `{Resource}Create` — input khi tạo mới
- `{Resource}Update` — input khi cập nhật (fields Optional)
- `{Resource}Response` — output trả về client

### Bước 4 — Tạo Router
Tạo `backend/app/routers/{resource}.py` với CRUD đầy đủ:
- `GET /` — list (có search `?q=`)
- `GET /{id}` — detail
- `POST /` — create
- `PUT /{id}` — update
- `DELETE /{id}` — delete (soft delete nếu có `is_active`)

Bắt buộc: mọi route dùng `Depends(get_current_user)`.

### Bước 5 — Mount vào main.py
Thêm `app.include_router(...)` vào `backend/app/main.py` theo đúng nhóm hiện có.

### Bước 6 — Báo cáo
```
✅ Model: [tên class] — [tên bảng DB]
✅ Schema: Create / Update / Response
✅ Router: [N] endpoints — prefix: /api/{resource}
✅ Mounted: main.py

Test nhanh:
  GET  http://localhost:8000/api/{resource}
  POST http://localhost:8000/api/{resource}
```
