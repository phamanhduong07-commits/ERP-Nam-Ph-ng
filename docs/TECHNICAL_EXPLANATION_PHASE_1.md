# Technical Notes - Phase 1

Phase 1 tap trung vao nen tang ERP: FastAPI, PostgreSQL, React/Vite, danh muc, ban hang, san xuat, kho va import/export co ban.

## Thanh phan cot loi

- `backend/app/main.py`: tao FastAPI app, CORS, middleware log, routers, static upload va SPA fallback.
- `backend/app/database.py`: SQLAlchemy engine/session/Base va cac helper schema legacy.
- `backend/app/config.py`: cau hinh tu `.env`.
- `frontend/src/App.tsx`: route frontend.
- `frontend/src/components/AppLayout.tsx`: menu, role filtering, layout.

## Diem can nho

- Schema moi nen di bang Alembic, khong dua vao auto-create.
- `AUTO_CREATE_SCHEMA` chi nen dung cho local recovery/import cu.
- Backend va frontend dang tach dev server; production co the serve `dist` qua backend neu build vao dung vi tri.
- File upload dang nam duoi `/uploads`.

## Kiem tra Phase 1

- Tao DB rong, chay migration.
- Dang nhap duoc.
- Danh muc load duoc.
- Tao bao gia/don hang co ban.
- Ton kho va bao cao khong crash khi chua co du lieu.
