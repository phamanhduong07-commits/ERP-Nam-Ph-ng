# Huong Dan Khoi Dong ERP Nam Phuong

Tai lieu nay dung cho may dev Windows. Neu moi clone repo, lam tu tren xuong duoi.

## 1. Yeu cau

- Python 3.11+.
- Node.js 20+ hoac 22+.
- PostgreSQL 15+.
- Git.

## 2. Tao database PostgreSQL

Mo `psql` hoac pgAdmin va chay:

```sql
CREATE USER erp_user WITH PASSWORD 'erp_password';
CREATE DATABASE erp_nam_phuong OWNER erp_user;
GRANT ALL PRIVILEGES ON DATABASE erp_nam_phuong TO erp_user;
```

Connection mac dinh trong code:

```text
postgresql://erp_user:erp_password@localhost:5432/erp_nam_phuong
```

Neu dung thong tin khac, tao file `backend/.env` va khai bao `DATABASE_URL`.

## 3. Cai backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
```

Neu can seed mau in/quyen:

```powershell
python -m app.seeds.seed_permissions
python -m app.seeds.seed_templates
```

## 4. Cai frontend

```powershell
cd frontend
npm install
```

## 5. Chay he thong

Chay backend:

```powershell
cd backend
.\venv\Scripts\activate
python run.py
```

Chay frontend o terminal khac:

```powershell
cd frontend
npm run dev
```

Dia chi thuong dung:

- Frontend: `http://localhost:5173`
- API docs: `http://localhost:8000/api/docs`
- Health check: `http://localhost:8000/api/health`

## 6. Cach khoi dong nhanh bang script

O thu muc goc co cac script:

- `start.bat`: khoi dong nhanh ca he thong theo cau hinh local.
- `start-backend.bat`: chi backend.
- `start-frontend.bat`: chi frontend.
- `restart-backend.bat`: restart backend.

Neu script khong dung voi may minh, uu tien chay thu cong theo muc 5 roi cap nhat script sau.

## 7. Dang nhap

Tai khoan admin tuy thuoc database/seed dang dung. Thuong gap:

- `admin` / `Admin@123`
- `admin` / `admin123`

Sau khi vao duoc he thong, doi mat khau admin ngay neu la moi truong that.

## 8. Loi thuong gap

- Backend khong ket noi DB: kiem tra PostgreSQL service, `DATABASE_URL`, database/user/password.
- Frontend goi API loi CORS: them origin frontend vao `ALLOWED_ORIGINS` trong `backend/.env`.
- Alembic bao loi revision: kiem tra cac file trong `backend/alembic/versions/`, dam bao repo khong thieu migration.
- Import Excel loi font/cot: tai file mau tu dung man hinh import, khong tu tao file bang cot khac ten.
