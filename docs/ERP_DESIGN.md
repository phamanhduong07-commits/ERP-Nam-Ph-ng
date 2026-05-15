# ERP Design

Tai lieu nay mo ta kien truc hien tai cua ERP Nam Phuong de team nam duoc module va diem cham code.

## 1. Kien truc tong the

```text
React/Vite/Ant Design
        |
        | Axios + JWT
        v
FastAPI routers (/api/*)
        |
        | SQLAlchemy session/service
        v
PostgreSQL
```

Thanh phan bo sung:

- Socket.IO cho realtime/tracking.
- Alembic cho migration.
- Agent noi bo tai `/api/agent`.
- Upload file tai `backend/uploads/`.
- SPA fallback trong `backend/app/main.py` neu co thu muc `dist`.

## 2. Module va file chinh

| Module | Backend | Frontend |
| --- | --- | --- |
| Auth/RBAC | `routers/auth.py`, `routers/permissions.py`, `models/auth.py` | `store/auth.ts`, `pages/danhmuc/RolePermissionsPage.tsx` |
| Danh muc | `routers/customers.py`, `products.py`, `suppliers.py`, `warehouses.py`, ... | `pages/danhmuc/` |
| Bao gia | `routers/quotes.py`, `schemas/quotes.py` | `pages/quotes/`, `api/quotes.ts` |
| Ban hang | `routers/sales_orders.py`, `sales_returns.py`, `yeu_cau_giao_hang.py` | `pages/sales/` |
| San xuat | `routers/production_orders.py`, `production_plans.py`, `bom.py`, `phieu_phoi.py` | `pages/production/` |
| CD2 | `routers/cd2.py`, `models/cd2.py`, `services/cd2_service.py` | `pages/production/*CD2*`, `api/cd2.ts` |
| Kho | `routers/warehouse.py`, `models/warehouse_doc.py`, `services/inventory_service.py` | `pages/warehouse/`, `api/warehouse.ts` |
| Mua hang | `routers/purchase_orders.py`, `purchase_returns.py`, `purchase_requisitions.py` | `pages/purchase/` |
| Billing | `routers/billing.py`, `models/billing.py` | `pages/billing/`, `api/billing.ts` |
| Ke toan | `routers/accounting.py`, `customer_refunds.py`, `models/accounting.py` | `pages/accounting/`, `api/accounting.ts` |
| Bao cao | `routers/reports.py` va accounting reports | `pages/reports/` |
| HRM | `routers/hr*.py`, `models/hr.py`, `services/hr_service.py` | `pages/hr/`, `api/hr.ts` |
| Agent | `app/agent/*`, `routers/system.py` | `pages/agent/AgentPage.tsx`, `api/agent.ts` |

## 3. Luong nghiep vu chinh

### Ban hang -> san xuat -> giao hang -> cong no

```text
Bao gia -> Don hang -> Lenh san xuat -> Ke hoach SX/BOM
       -> Nhap thanh pham -> Giao hang -> Hoa don VAT -> Cong no AR
```

Diem code:

- Bao gia: `/api/quotes`
- Don hang: `/api/sales-orders`
- Lenh san xuat: `/api/production-orders`
- Kho/giao hang: `/api/warehouse/deliveries`
- Hoa don ban: `/api/billing/invoices`
- Cong no phai thu: `/api/accounting/ar/*`

### Mua hang -> nhap kho -> cong no NCC

```text
Du bao/YMH -> PO -> Goods Receipt -> Hoa don mua -> Cong no AP
```

Diem code:

- YMH: `/api/purchase-requisitions`
- PO: `/api/purchase-orders`
- GR: `/api/warehouse/goods-receipts`
- Hoa don mua: `/api/accounting/purchase-invoices`
- Cong no phai tra: `/api/accounting/ap/*`

### Kho

```text
Nhap mua/Nhap nhanh/Nhap phoi/Nhap TP
        -> inventory_transactions
        -> inventory_balances
        -> The kho / Bao cao NXT
```

Luu y: phieu da duyet/huy moi anh huong so lieu tuy tung loai chung tu. Khi debug lech kho, xem ca phieu goc, transaction va balance.

### CD2

```text
Lenh SX -> Phieu in -> Kanban may in -> Cho dinh hinh
       -> Sau in -> Hoan thanh -> Scan san luong
```

CD2 co ca phieu in, may in, may sau in, may scan, ca lam viec va RFID/dang nhap may.

## 4. Route frontend chinh

- `/dashboard`
- `/quotes`, `/sales/orders`, `/sales/returns`, `/sales/giao-hang`
- `/production/orders`, `/production/plans`, `/production/queue`, `/production/bom`
- `/production/cd2/*`
- `/warehouse/*`
- `/purchasing/*`
- `/billing/invoices`, `/billing/adjustments`
- `/accounting/*`
- `/reports/*`
- `/hr/*`
- `/master/*`, `/danhmuc/*`
- `/agent`

## 5. Nguyen tac thiet ke du lieu

- Chung tu co `so_*`, `ngay_*`, `trang_thai`, `created_by`, `created_at`.
- Danh muc co ma/ten va trang thai hoat dong neu can.
- So tien dung `Numeric`, ngay dung `Date`/`DateTime`.
- Cac thay doi ton kho/cong no can co transaction/ledger de audit.
- Thong tin phap nhan dung cho in/PDF, khong hard-code trong tung page.

## 6. Ranh gioi can can than

- `warehouse.py` rat lon va co nhieu side effect: can doc ky truoc khi sua phieu kho.
- Accounting va inventory lien quan nhau: sua mot ben phai test bao cao va ledger.
- CD2 co tich hop he thong ngoai qua `CD2_URL`; can co timeout/fallback ro rang.
- HR/payroll/logistics co migration moi; can test Alembic tren database sach.
