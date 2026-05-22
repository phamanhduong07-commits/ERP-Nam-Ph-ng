# HƯỚNG DẪN CHO DEV MỚI — ERP Nam Phương

## Bước 1: Cài đặt phần mềm cần thiết

Cài theo thứ tự sau (chỉ cần làm 1 lần):

| Phần mềm | Link tải | Ghi chú |
|---|---|---|
| Git | https://git-scm.com | Bấm Next hết, giữ mặc định |
| Python 3.11+ | https://python.org/downloads | ✅ Tick "Add to PATH" khi cài |
| Node.js 20+ | https://nodejs.org | Chọn bản LTS |
| PostgreSQL 15+ | https://postgresql.org/download | Nhớ mật khẩu postgres khi cài |
| VS Code | https://code.visualstudio.com | Editor code |

---

## Bước 2: Clone code về máy

Mở terminal (PowerShell hoặc Git Bash), chạy:

```bash
git clone https://github.com/[TEN_ORG]/erp-nam-phuong.git
cd erp-nam-phuong
```

> Hỏi anh Dương link repo GitHub nếu chưa có.

---

## Bước 3: Tạo database

Mở **pgAdmin** (cài cùng PostgreSQL) → Tools → Query Tool, chạy:

```sql
CREATE USER erp_user WITH PASSWORD 'erp_password';
CREATE DATABASE erp_nam_phuong OWNER erp_user;
GRANT ALL PRIVILEGES ON DATABASE erp_nam_phuong TO erp_user;
```

---

## Bước 4: Cài backend

Mở PowerShell, vào thư mục project:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

Tạo file `.env` trong thư mục `backend/`:

```env
DATABASE_URL=postgresql://erp_user:erp_password@localhost:5432/erp_nam_phuong
SECRET_KEY=dev-secret-key-123
```

Chạy migration (tạo bảng trong DB):

```powershell
alembic upgrade head
```

---

## Bước 5: Cài frontend

Mở **PowerShell mới** (giữ cửa sổ backend), vào thư mục frontend:

```powershell
cd frontend
npm install
```

---

## Bước 6: Chạy project

**Cách dễ nhất:** Double-click file `start.bat` ở thư mục gốc.

Hoặc chạy thủ công 2 terminal:

**Terminal 1 — Backend:**
```powershell
cd backend
.\venv\Scripts\activate
python run.py
```

**Terminal 2 — Frontend:**
```powershell
cd frontend
npm run dev
```

---

## Bước 7: Đăng nhập

Mở trình duyệt vào: **http://localhost:5173**

- Username: `admin`
- Password: `admin123`

API Docs (xem danh sách endpoint): **http://localhost:8001/api/docs**

---

## Cấu trúc code quan trọng

```
erp-nam-phuong/
├── backend/app/
│   ├── routers/      ← API endpoints (1 file = 1 module)
│   ├── models/       ← Cấu trúc bảng database (SQLAlchemy)
│   ├── schemas/      ← Định dạng dữ liệu vào/ra (Pydantic)
│   └── main.py       ← Đăng ký tất cả routers
├── frontend/src/
│   ├── pages/        ← Các màn hình giao diện
│   ├── components/   ← Component dùng chung
│   └── api/          ← Gọi API từ frontend
└── alembic/versions/ ← Lịch sử thay đổi database
```

---

## Quy trình làm việc (bắt buộc)

```
1. Tạo branch mới trước khi code
   git checkout -b feature/ten-tinh-nang

2. Code → test thử trên máy

3. Commit thường xuyên
   git add .
   git commit -m "feat: mô tả ngắn gọn"

4. Push lên GitHub
   git push origin feature/ten-tinh-nang

5. Tạo Pull Request → báo anh Dương review
```

**Không được push thẳng vào nhánh `main`.**

---

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách fix |
|---|---|---|
| `ModuleNotFoundError` | Chưa activate venv | Chạy `.\venv\Scripts\activate` |
| `Connection refused` | PostgreSQL chưa chạy | Mở Services → Start PostgreSQL |
| `Port already in use` | App đang chạy rồi | Tắt terminal cũ, chạy lại |
| CORS error | Frontend sai URL | Kiểm tra `.env` frontend |

---

## Liên hệ khi gặp vấn đề

Nhắn **anh Dương** qua Zalo hoặc tạo Issue trên GitHub mô tả lỗi + ảnh chụp màn hình.
