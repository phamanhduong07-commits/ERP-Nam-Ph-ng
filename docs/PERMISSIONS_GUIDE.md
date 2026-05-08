# Hệ thống Phân Quyền (RBAC) - ERP Nam Phương

## Tổng Quan

Đã tạo hệ thống **Role-Based Access Control (RBAC)** hoàn chỉnh để quản lý quyền cho từng vị trí trong công ty.

## Cấu Trúc

### 1. Database Tables

#### `permissions` (Quyền)
```sql
id: INT - ID duy nhất
ma_quyen: VARCHAR(100) - Mã quyền (VD: "customer.view", "sales_order.create")
ten_quyen: VARCHAR(255) - Tên quyền (VD: "Xem danh sách khách hàng")
mo_ta: TEXT - Mô tả chi tiết
nhom: VARCHAR(50) - Nhóm quyền (sales, production, inventory, master_data, admin, reports)
trang_thai: BOOLEAN - Có hoạt động hay không (DEFAULT: TRUE)
created_at: TIMESTAMPTZ - Ngày tạo
```

#### `role_permissions` (Liên kết Role-Permission)
```sql
id: INT - ID duy nhất
role_id: INT (FK) - Vai trò
permission_id: INT (FK) - Quyền
created_at: TIMESTAMPTZ - Ngày gán
UNIQUE(role_id, permission_id) - Mỗi quyền chỉ gán 1 lần cho mỗi role
```

### 2. Models (Python/SQLAlchemy)

```python
# app/models/auth.py

class Permission(Base):
    id, ma_quyen, ten_quyen, mo_ta, nhom, trang_thai, created_at
    role_permissions: list[RolePermission]  # Relationships

class RolePermission(Base):
    id, role_id, permission_id, created_at
    role: Role  # Relationship
    permission: Permission  # Relationship

class Role(Base):  # (cập nhật)
    # ... (các field cũ)
    role_permissions: list[RolePermission]  # Thêm relationship
```

### 3. API Endpoints

#### Permission Management (`/api/permissions`)

```
GET    /api/permissions                    # Danh sách quyền (có phân trang)
  ?search=<string>&nhom=<string>&page=1&page_size=20

GET    /api/permissions/{permission_id}   # Chi tiết quyền

GET    /api/permissions/group/{nhom}      # Danh sách quyền theo nhóm

POST   /api/permissions                    # Tạo quyền mới
Body: { "ma_quyen": "...", "ten_quyen": "...", "mo_ta": "...", "nhom": "..." }

PUT    /api/permissions/{permission_id}   # Cập nhật quyền
Body: { "ten_quyen": "...", "mo_ta": "...", "nhom": "...", "trang_thai": true }

DELETE /api/permissions/{permission_id}   # Xóa quyền
```

#### Role Management (`/api/roles`)

```
GET    /api/roles                          # Danh sách vai trò (có phân trang)
  ?search=<string>&page=1&page_size=20

GET    /api/roles/active                   # Danh sách vai trò hoạt động

GET    /api/roles/{role_id}                # Chi tiết vai trò + danh sách quyền

POST   /api/roles                          # Tạo vai trò mới
Body: { "ma_vai_tro": "...", "ten_vai_tro": "...", "mo_ta": "..." }

PUT    /api/roles/{role_id}                # Cập nhật vai trò
Body: { "ten_vai_tro": "...", "mo_ta": "...", "trang_thai": true }

DELETE /api/roles/{role_id}                # Xóa vai trò (nếu không có user)
```

#### Role-Permission Assignment

```
POST   /api/roles/{role_id}/permissions         # Gán nhiều quyền cho role (thay thế toàn bộ)
Body: { "permission_ids": [1, 2, 3, ...] }

POST   /api/roles/{role_id}/permissions/{permission_id}      # Thêm 1 quyền cho role

DELETE /api/roles/{role_id}/permissions/{permission_id}      # Xóa 1 quyền khỏi role
```

### 4. Danh Sách Quyền (40 quyền)

#### Sales (6 quyền)
- `customer.view` - Xem danh sách khách hàng
- `customer.create` - Tạo khách hàng
- `customer.edit` - Sửa khách hàng
- `customer.delete` - Xóa khách hàng
- `sales_order.view` - Xem đơn hàng
- `sales_order.create` - Tạo đơn hàng
- `sales_order.edit` - Sửa đơn hàng
- `sales_order.approve` - Duyệt đơn hàng
- `sales_order.cancel` - Hủy đơn hàng

#### Production (6 quyền)
- `production_order.view` - Xem lệnh sản xuất
- `production_order.create` - Tạo lệnh sản xuất
- `production_order.edit` - Sửa lệnh sản xuất
- `production_order.start` - Bắt đầu sản xuất
- `production_order.complete` - Hoàn thành sản xuất
- `production_order.cancel` - Hủy lệnh sản xuất

#### Inventory (5 quyền)
- `inventory.view` - Xem kho
- `inventory.import` - Nhập kho
- `inventory.export` - Xuất kho
- `inventory.adjust` - Điều chỉnh kho
- `inventory.transfer` - Chuyển kho

#### Master Data (4 quyền)
- `product.view` - Xem sản phẩm
- `product.create` - Tạo sản phẩm
- `product.edit` - Sửa sản phẩm
- `product.delete` - Xóa sản phẩm

#### Admin (9 quyền)
- `user.view` - Xem người dùng
- `user.create` - Tạo người dùng
- `user.edit` - Sửa người dùng
- `user.delete` - Xóa người dùng
- `user.reset_password` - Reset mật khẩu
- `permission.view` - Xem quyền
- `permission.manage` - Quản lý quyền
- `role.view` - Xem vai trò
- `role.create` - Tạo vai trò
- `role.edit` - Sửa vai trò

#### Reports (3 quyền)
- `report.view` - Xem báo cáo
- `report.export` - Xuất báo cáo
- `report.schedule` - Lên lịch báo cáo

### 5. Mô Tả Từng Vị Trí

#### BGD (Ban Giám Đốc) - `bgd`
✅ Có **TẤT CẢ** quyền (40/40)

#### Trưởng Phòng - `truong_phong`
✅ 20 quyền: Quản lý bộ phận (customer, sales_order, production_order, inventory, product, report)

#### Giám Sát - `giam_sat`
✅ 15 quyền: Giám sát quy trình sản xuất (sales_order, production_order, inventory.adjust, product, report)

#### Tổ Trưởng - `to_truong`
✅ 8 quyền: Quản lý nhóm (sales_order, production_order.start/complete, inventory, product)

#### Nhân Viên - `nhan_vien`
✅ 4 quyền: Quyền cơ bản (sales_order.view, production_order.view, inventory.view, product.view)

#### Nhân Viên Theo Dõi (SA) - `nhan_vien_theo_doi`
✅ 7 quyền: Theo dõi đơn hàng (customer.view, sales_order.*,  production_order.view, inventory.view, product.view, report.view)

## Files Tạo/Sửa

### Mới Tạo
1. **database/migrate_006_permissions.sql** - Migration SQL tạo bảng + seed data
2. **backend/app/services/role_service.py** - Service layer cho permissions & roles
3. **backend/app/routers/permissions.py** - API endpoints
4. **backend/reset_and_migrate.py** - Script thực hiện migration
5. **backend/migrate_db.py** - Script legacy (có thể xóa)
6. **PERMISSIONS_GUIDE.md** - File này

### Sửa Đổi
1. **backend/app/models/auth.py** - Thêm Permission, RolePermission models
2. **backend/app/schemas/auth.py** - Thêm Pydantic schemas cho permissions
3. **backend/app/main.py** - Import + include routers

## Cách Sử Dụng

### 1. Áp Dụng Migration
```bash
cd backend
python reset_and_migrate.py
```

### 2. Khởi Động Server
```bash
python run.py
```

### 3. Test API
```bash
# Xem danh sách quyền
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8000/api/permissions?page=1"

# Xem vai trò và quyền
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8000/api/roles/1"

# Gán quyền cho role
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"permission_ids": [1, 2, 3]}' \
  "http://localhost:8000/api/roles/1/permissions"
```

### 4. Thêm Guard vào Endpoints (Tiếp Theo)
Để bảo vệ endpoint, thêm dependency injection:

```python
from app.deps import get_current_user_with_permission

@router.get("/sensitive-data")
def get_data(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user_with_permission("sensitive_data.view"))
):
    # Chỉ user có "sensitive_data.view" permission mới vào được
    ...
```

## Mô Tả Nhóm Quyền

| Nhóm | Mô Tả |
|------|-------|
| **sales** | Quản lý khách hàng, đơn hàng, báo giá |
| **production** | Quản lý lệnh sản xuất, quy trình SX |
| **inventory** | Quản lý kho, tồn kho, nhập xuất |
| **master_data** | Quản lý dữ liệu cơ bản (sản phẩm, nhà cung cấp, ...) |
| **admin** | Quản lý hệ thống (người dùng, vai trò, quyền) |
| **reports** | Xem báo cáo, xuất dữ liệu |

## Tiếp Theo

1. ✅ Tạo hệ thống RBAC
2. ⏳ Thêm guard decorator để check permission trên endpoints
3. ⏳ Thêm audit log cho thay đổi quyền
4. ⏳ Frontend: Tạo giao diện quản lý vai trò & quyền
5. ⏳ Frontend: Ẩn/hiện button dựa trên user permission

## Testing Checklist

- [x] Database tables created successfully
- [x] Models generated without errors
- [x] API endpoints registered
- [x] Server starts without errors
- [ ] Permission list returns data
- [ ] Can assign permissions to role
- [ ] Can update role
- [ ] Can delete role (if no users assigned)
- [ ] Error handling for invalid IDs
