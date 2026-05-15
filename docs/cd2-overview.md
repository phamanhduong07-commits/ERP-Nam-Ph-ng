# CD2 Overview

CD2 la module quan ly cong doan in va sau in: lap phieu in, dieu phoi may, scan san luong, tinh luong san pham va theo doi dashboard.

## Luong phieu in

```text
Lenh SX
  -> Cho in
  -> Ke hoach
  -> Dang in tren may in
  -> Cho dinh hinh
  -> Sau in
  -> Dang sau in
  -> Hoan thanh
```

Trang thai chinh:

| Trang thai | Y nghia |
| --- | --- |
| `cho_in` | Moi tao, cho len ke hoach |
| `ke_hoach` | Da len ke hoach, co the chua gan may |
| `dang_in` | Dang chay may in |
| `cho_dinh_hinh` | In xong, cho cong doan tiep |
| `sau_in` | Dang o pool sau in |
| `dang_sau_in` | Dang chay may sau in |
| `hoan_thanh` | Hoan tat |
| `huy` | Huy/an khoi kanban |

## Backend

| File | Vai tro |
| --- | --- |
| `backend/app/models/cd2.py` | ORM: may in, may sau in, may scan, phieu in, scan log, ca |
| `backend/app/routers/cd2.py` | API `/api/cd2/*` |
| `backend/app/services/cd2_service.py` | Tich hop CD2 MES ngoai |

Nhom endpoint:

- May in/sau in/scan: CRUD.
- Kanban: `/api/cd2/kanban`, `/api/cd2/sauin/kanban`.
- Phieu in: `/api/cd2/phieu-in`.
- Dieu phoi: start, complete, move, sau-in, hoan-thanh, huy.
- Scan: lookup LSX, submit log, history.
- Dashboard: `/api/cd2/dashboard`.
- Ca lam viec va printer user/RFID.

## Frontend

| Route | Page |
| --- | --- |
| `/production/cd2/dashboard` | Tong quan CD2 |
| `/production/cd2` | Kanban may in |
| `/production/cd2/may-in` | Queue may in |
| `/production/cd2/scan` | Scan san luong |
| `/production/cd2/mobile-tracking` | Mobile tracking cong nhan |
| `/cd2/machine-login` | Dang nhap may |
| `/production/cd2/scan-history` | Lich su scan |
| `/production/cd2/history` | Lich su phieu in |
| `/production/cd2/dhcho2` | Cho dinh hinh |
| `/production/cd2/sauin-kanban` | Kanban sau in |
| `/production/cd2/shift` | Quan ly ca |
| `/production/cd2/config` | Cau hinh CD2 |

## Tich hop CD2 ngoai

Cau hinh trong `backend/.env`:

```text
CD2_URL=http://cd2-namphuong.mypacksoft.com:38981
CD2_USERNAME=
CD2_PASSWORD=
```

Neu tich hop ngoai loi, module noi bo van nen bao loi ro rang va khong lam sap backend.
