# Huong Dan Van Hanh ERP Nam Phuong

Tai lieu nay danh cho nguoi quan tri he thong va team ho tro van hanh.

## Thong tin he thong

| Thanh phan | Gia tri mac dinh |
| --- | --- |
| Database | PostgreSQL `erp_nam_phuong` |
| Backend | FastAPI, cong `8000` |
| Frontend dev | Vite, cong `5173` |
| API docs | `/api/docs` |
| File upload | `backend/uploads/` |
| Log backend | `backend.log`, `erp_server.log` neu chay script |

## Thu tu khoi dong hang ngay

1. Kiem tra PostgreSQL service dang chay.
2. Khoi dong backend bang `python run.py` hoac `start-backend.bat`.
3. Khoi dong frontend bang `npm run dev` hoac `start-frontend.bat`.
4. Mo `http://localhost:5173` va thu dang nhap.
5. Kiem tra `http://localhost:8000/api/health` neu nghi backend loi.

## Backup

Backup database bang pgAdmin hoac `pg_dump`:

```powershell
pg_dump -Fc -U erp_user -d erp_nam_phuong -f erp_nam_phuong_YYYYMMDD.backup
```

Can backup kem:

- `backend/uploads/`
- File `.env` production, luu rieng va bao mat.
- Cac file migration trong `backend/alembic/versions/`.

Khuyen nghi backup it nhat moi ngay trong giai do go-live, sau do toi thieu moi tuan.

## Restore

Tao database rong roi restore:

```powershell
createdb -U erp_user erp_nam_phuong
pg_restore -U erp_user -d erp_nam_phuong erp_nam_phuong_YYYYMMDD.backup
```

Sau restore, chay:

```powershell
cd backend
alembic upgrade head
```

## Quy tac du lieu

- Khong sua truc tiep database production neu khong co backup.
- Thay doi schema phai co Alembic migration.
- Import du lieu lon phai tai file mau tu he thong, preview loi, roi moi xac nhan import.
- File dinh kem nam trong `backend/uploads/`; khong xoa thu muc nay khi don log/cache.

## Kiem tra nhanh sau khi cap nhat

- Backend khoi dong khong loi import.
- `/api/health` tra `status: ok`.
- Frontend build duoc bang `npm run build`.
- Dang nhap thanh cong.
- Thu cac luong chinh: bao gia, don hang, ton kho, phieu thu/chi, bao cao.

## Xu ly loi thuong gap

- Loi 401/403: kiem tra token, role, permission va menu role trong `AppLayout.tsx`.
- Loi 422 khi import: sai ten cot, kieu ngay/tien/so luong, hoac thieu khoa tham chieu.
- Ton kho lech: kiem tra `inventory_transactions`, `inventory_balances`, phieu kho da duyet/huy.
- Cong no lech: kiem tra hoa don, phieu thu/chi, tra hang, hoan tien, opening balance.
- File in thieu thong tin phap nhan: kiem tra danh muc phap nhan va cau hinh mau in.
