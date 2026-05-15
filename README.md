# ERP Nam Phuong

ERP Nam Phuong la he thong quan tri noi bo cho bao bi carton: ban hang, bao gia, san xuat, kho, mua hang, ke toan, bao cao, HRM, CD2 va tro ly AI.

## Cong nghe

| Tang | Cong nghe | Thu muc |
| --- | --- | --- |
| Frontend | React 18, Vite, TypeScript, Ant Design, TanStack Query | `frontend/` |
| Backend | FastAPI, SQLAlchemy, Pydantic, Alembic | `backend/` |
| Database | PostgreSQL | `database/`, `backend/alembic/` |
| Realtime | Socket.IO | `backend/app/socket_manager.py` |
| Agent | Ollama hoac Anthropic qua FastAPI | `backend/app/agent/` |

## Khoi dong nhanh

```powershell
# Backend
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python run.py

# Frontend
cd ..\frontend
npm install
npm run dev
```

Mac dinh:

- Backend API: `http://localhost:8000`
- Swagger: `http://localhost:8000/api/docs`
- Frontend: `http://localhost:5173`
- Database: `postgresql://erp_user:erp_password@localhost:5432/erp_nam_phuong`

## Cau truc nhanh

```text
backend/app/
  main.py              Dang ky FastAPI, CORS, routers, SPA fallback
  config.py            Bien moi truong va cau hinh he thong
  database.py          SQLAlchemy engine/session/Base
  models/              ORM models
  schemas/             Pydantic request/response schemas
  routers/             API theo module nghiep vu
  services/            Logic dung chung
  agent/               Tro ly AI noi bo
  seeds/               Seed permission/template

frontend/src/
  App.tsx              Khai bao route
  components/          Layout, import dialog, error boundary
  api/                 Axios clients theo module
  pages/               Man hinh nghiep vu
  store/               Auth state
  utils/               Export, socket, tra cuu MST

docs/                  Tai lieu ky thuat, module, van hanh
database/              SQL schema/migration cu
```

## Module dang co

- Danh muc: khach hang, nha cung cap, san pham, vat tu giay, vat tu khac, kho, phan xuong, xe, tai xe, phap nhan, tai khoan ngan hang, mau in.
- Ban hang: bao gia, don hang, tra hang, theo doi don, giao hang.
- San xuat: lenh san xuat, ke hoach san xuat, queue, BOM, phieu phoi song, kho phoi, kho thanh pham.
- CD2: kanban may in, may sau in, scan san luong, dashboard, ca lam viec, dang nhap may.
- Kho: ton kho, nhap nhanh, nhap giay, nhap NVL, xuat NVL, nhap thanh pham, chuyen kho, kiem ke, the kho.
- Mua hang: du bao nhu cau, yeu cau mua hang, PO, GR, doi soat kho, tra hang NCC, bao cao mua hang.
- Ke toan: phieu thu/chi, hoa don mua/ban, cong no AR/AP, so quy, ngan hang, but toan, CCDC, tai san, ket chuyen ky.
- Bao cao: doanh thu, ton kho, cong no, tien do don, giao hang, gia thanh, lai lo phan xuong, VAT, can doi phat sinh.
- HRM: ho so nhan vien, phong ban, cham cong, bang luong, phe duyet don tu, khen thuong/ky luat, logistics.
- Agent: chat noi bo voi cong cu truy van ERP.

## Tai lieu nen doc truoc

1. `HUONG_DAN_KHOI_DONG.md` - cai moi va chay local.
2. `HUONG_DAN_VAN_HANH.md` - van hanh, backup, xu ly loi.
3. `docs/DEVELOPER_GUIDE.md` - quy uoc code va workflow dev.
4. `docs/ERP_DESIGN.md` - kien truc/module/luong nghiep vu.
5. `docs/IMPORT_EXPORT_CHECKLIST.md` - import, export, in/PDF.
6. `docs/PERMISSIONS_GUIDE.md` - role va permission.

## Quy tac lam viec cho team

- Khong sua schema truc tiep bang SQL ad hoc neu co the viet Alembic migration.
- Backend route moi dat trong `backend/app/routers/`, schema trong `schemas/`, model trong `models/`.
- Frontend page moi dat theo module trong `frontend/src/pages/`, API client trong `frontend/src/api/`.
- Import/export dung component va helper co san, khong copy logic tung page.
- Khong commit file upload, log, cache, build output hoac du lieu nhay cam.
