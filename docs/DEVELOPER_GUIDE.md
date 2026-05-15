# Developer Guide

Tai lieu nay la checklist lam viec cho dev trong repo ERP Nam Phuong.

## 1. Chay local

```powershell
cd backend
.\venv\Scripts\activate
alembic upgrade head
python run.py

cd ..\frontend
npm run dev
```

Kiem tra:

- API docs: `http://localhost:8000/api/docs`
- Frontend: `http://localhost:5173`
- Health: `GET /api/health`

## 2. Backend conventions

- Model SQLAlchemy dat trong `backend/app/models/<module>.py`.
- Schema Pydantic dat trong `backend/app/schemas/<module>.py`.
- Router dat trong `backend/app/routers/<module>.py`, prefix dang `/api/<module>`.
- Logic lap lai hoac co side effect nen dua vao `backend/app/services/`.
- Dang ky router moi tai `backend/app/main.py`.
- Thay doi schema phai tao Alembic migration trong `backend/alembic/versions/`.

Khung router nen theo mau:

```python
router = APIRouter(prefix="/api/example", tags=["example"])

@router.get("")
def list_items(db: Session = Depends(get_db)):
    ...
```

## 3. Frontend conventions

- Route khai bao trong `frontend/src/App.tsx`.
- Menu khai bao trong `frontend/src/components/AppLayout.tsx`.
- API client dat trong `frontend/src/api/<module>.ts`.
- Page dat trong `frontend/src/pages/<module>/`.
- Goi server qua axios client dung chung trong `frontend/src/api/client.ts`.
- Danh sach nen co filter, loading, empty state, export neu la nghiep vu can doi soat.
- Form chung tu nen co validate bat buoc truoc khi goi API.

## 4. Database va migration

Quy trinh an toan:

1. Sua model.
2. Tao migration Alembic.
3. Chay `alembic upgrade head` tren DB dev.
4. Test route/page lien quan.
5. Neu co seed, dat trong `backend/app/seeds/`.

Khong nen:

- Sua truc tiep production DB neu chua backup.
- Tao cot moi trong code ma khong co migration.
- Xoa migration cu khi da co may khac dung.

## 5. Import/export/in

- Import dung component `ImportExcelButton`/`ImportExcelDialog`.
- Backend import nen co template endpoint, preview/validate, log ket qua.
- Export dung helper trong `frontend/src/utils/exportUtils.ts`.
- Mau in/PDF can lay thong tin phap nhan, logo, so chung tu, ngay, nguoi lap, chu ky.

## 6. Permission va role

- Guard backend dung dependency trong `backend/app/deps.py`.
- Menu frontend dang loc theo role trong `AppLayout.tsx`.
- Permission seed nam trong `backend/app/seeds/seed_permissions.py`.
- Khi them module moi, cap nhat ca backend guard, menu role va seed permission.

## 7. Checklist truoc PR/commit

- `git status --short` de xem file da sua.
- Backend khoi dong duoc.
- Frontend build duoc: `npm run build`.
- Migration chay duoc tren DB dev moi.
- Khong commit `uploads/`, log, cache, file build, credential.
- Tai lieu lien quan da cap nhat neu them route/module/luong moi.
