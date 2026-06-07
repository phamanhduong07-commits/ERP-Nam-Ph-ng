# CLAUDE.md — ERP Nam Phương (erp-nam-phuong)

## QUAN TRỌNG — Restart service (PHẢI dùng cách này)

Không dùng `sc.exe` trực tiếp — sẽ bị từ chối quyền. Dùng lệnh này:

```powershell
"" | Out-File "D:\NAM_PHUONG_SOFTWARE\.deploying" -Encoding utf8
Start-Process powershell -Verb RunAs -ArgumentList "-Command sc.exe stop NamPhuong-ERP; Start-Sleep 4; sc.exe start NamPhuong-ERP" -Wait
Start-Sleep 12
Remove-Item "D:\NAM_PHUONG_SOFTWARE\.deploying" -ErrorAction SilentlyContinue
```

Bắt buộc tạo `.deploying` trước khi stop — để error watcher không báo false alarm.

Hoặc chạy `D:\NAM_PHUONG_SOFTWARE\deploy.bat` → chọn **[2] ERP** (cách đơn giản nhất).

## Stack
- **Frontend**: React 18 + TypeScript + Vite + Ant Design 5 + React Query + Zustand
- **Backend**: Python FastAPI + SQLAlchemy + Alembic + SQLite/PostgreSQL
- **Dev**: `_start_backend.bat` / `_start_frontend.bat` hoặc `start.ps1`

---

## Automation Rules — Claude tự động thực hiện

### 🔒 Security Review (tự động)
Khi được yêu cầu sửa hoặc vừa sửa xong bất kỳ file nào trong danh sách sau,
**BẮT BUỘC gọi agent `security-reviewer`** trước khi báo cáo hoàn thành:

- `backend/app/routers/auth.py`
- `backend/app/routers/billing.py`
- `backend/app/routers/permissions.py`
- `backend/app/routers/hr_payroll_calc.py`
- `backend/app/routers/hr.py`
- `backend/app/routers/accounting.py`
- Bất kỳ file nào chứa `Depends(get_admin_user)` hoặc xử lý `luong`, `thuong`, `phat`

Cách gọi:
```
Agent(subagent_type="security-reviewer", prompt="Review file [tên file]: [nội dung thay đổi]")
```

### 🏗️ Tạo module/router mới (tự động)
Khi user yêu cầu "tạo module X", "thêm tính năng Y", "làm router Z",
**BẮT BUỘC dùng skill `/new-router`** thay vì tự viết boilerplate.

Dấu hiệu nhận biết:
- "tạo module ...", "thêm bảng ...", "làm CRUD cho ..."
- Cần tạo file mới trong `backend/app/routers/`

### 📚 Tra cứu tài liệu thư viện (tự động)
Khi trả lời câu hỏi liên quan đến các thư viện sau,
**BẮT BUỘC dùng MCP context7** để lấy docs đúng version:

| Thư viện | Khi nào dùng context7 |
|---|---|
| Ant Design (`antd`) | Component props, API, theming |
| React Query (`@tanstack/react-query`) | useQuery, useMutation, caching |
| SQLAlchemy | ORM query, relationship, migration |
| Alembic | Migration commands, autogenerate |
| FastAPI | Depends, middleware, response model |

Cách dùng: thêm `use context7` vào resolve-libraries-id call.

---

## Cấu trúc project

```
backend/app/
├── routers/     — 40+ FastAPI routers (1 file = 1 resource)
├── models/      — SQLAlchemy ORM models
├── schemas/     — Pydantic request/response schemas
├── deps.py      — get_current_user, get_admin_user
├── main.py      — mount routers, CORS, startup
└── database.py  — engine, SessionLocal, get_db

frontend/src/
├── pages/       — React pages (production/, hr/, sales/, ...)
├── components/  — Shared components
└── api/         — Axios API calls
```

## Pattern chuẩn khi thêm router mới

```
1. models/     → thêm SQLAlchemy class
2. schemas/    → Create / Update / Response
3. routers/    → CRUD + Depends(get_current_user)
4. main.py     → app.include_router(...)
```

## Import chuẩn (backend)

```python
from app.deps import get_current_user, get_admin_user
from app.models.auth import User
from app.database import get_db
```

## Quy tắc bắt buộc

- Route admin → `Depends(get_admin_user)`, không tự check `user.role`
- Không dùng f-string SQL → dùng ORM hoặc `text()` với bind params
- Không trả `password`/`hashed_password` trong response
- Migration Alembic → xác nhận tay trước khi chạy `alembic upgrade head`
