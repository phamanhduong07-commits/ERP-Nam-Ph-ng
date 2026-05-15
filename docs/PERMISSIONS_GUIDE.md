# Permissions Guide

ERP dung ket hop role va permission:

- Role hien tai anh huong menu frontend trong `AppLayout.tsx`.
- Permission backend dung cho cac endpoint can guard chi tiet.
- Seed permission nam trong `backend/app/seeds/seed_permissions.py`.

## Role dang dung trong code

| Role | Mo ta |
| --- | --- |
| `ADMIN` | Quan tri toan he thong |
| `GIAM_DOC` | Ban giam doc |
| `KINH_DOANH` | Ban hang/bao gia/don hang |
| `SALE_ADMIN` | Sale admin |
| `TRUONG_PHONG_SALE_ADMIN` | Truong phong sale admin |
| `SAN_XUAT` | San xuat/CD2/BOM/ke hoach |
| `CONG_NHAN` | Cong nhan, uu tien mobile/CD2 |
| `KHO` | Kho, nhap/xuat/ton |
| `MUA_HANG` | Mua hang/PO/GR |
| `KE_TOAN` | Ke toan, hoa don, cong no, bao cao |

## Menu role frontend

File: `frontend/src/components/AppLayout.tsx`

Nhom role chinh:

- `ADMIN_GD`: `ADMIN`, `GIAM_DOC`
- `BAN_HANG`: ban hang va ke toan co lien quan hoa don
- `SAN_XUAT_FULL`, `SAN_XUAT_ALL`
- `KHO_ROLES`
- `MUA_HANG`

Khi them menu moi:

1. Them route trong `frontend/src/App.tsx`.
2. Them menu trong `buildMenuItems`.
3. Gan role phu hop.
4. Test bang user role tuong ung.

## API permissions

Router chinh:

- `/api/permissions`
- `/api/roles`

File:

- `backend/app/routers/permissions.py`
- `backend/app/services/role_service.py`
- `backend/app/models/auth.py`
- `backend/app/schemas/auth.py`

Mau guard endpoint:

```python
from app.deps import get_current_user_with_permission

@router.post("")
def create_item(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_with_permission("example.create")),
):
    ...
```

## Nhom permission nen dung

| Nhom | Vi du |
| --- | --- |
| `sales` | `quote.view`, `sales_order.create`, `sales_return.approve` |
| `production` | `production_order.view`, `bom.manage`, `cd2.scan` |
| `inventory` | `inventory.view`, `inventory.import`, `inventory.adjust` |
| `purchase` | `purchase_order.create`, `goods_receipt.approve` |
| `accounting` | `cash_receipt.approve`, `journal_entry.create` |
| `master` | `customer.import`, `product.edit` |
| `report` | `report.view`, `report.export` |
| `admin` | `user.manage`, `role.manage`, `permission.manage` |
| `hr` | `hr.employee.view`, `hr.payroll.approve` |

## Checklist khi them module moi

- Tao permission codes.
- Seed permission.
- Gan permission cho role can dung.
- Guard API quan trong.
- An/hien menu/button theo role/permission.
- Test user khong co quyen bi 403 va UI khong lo nut thao tac nguy hiem.
