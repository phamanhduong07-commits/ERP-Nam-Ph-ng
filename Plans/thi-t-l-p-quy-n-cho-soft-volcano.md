# Kế hoạch: Thiết lập tài khoản Kế toán trưởng (loan)

## Context
Tạo tài khoản người dùng mới `loan` với role `KE_TOAN_TRUONG`, đồng thời đảm bảo role này có đầy đủ permissions được assign trong DB để frontend hiển thị đúng menu/quyền truy cập.

## Phân tích hiện trạng

- Role `KE_TOAN_TRUONG` **đã tồn tại** trong bảng `roles` (created trong migration `z1a2b3c4d5e6`)
- `seed_full_permissions.py` chỉ assign permissions cho **ADMIN**, không assign cho `KE_TOAN_TRUONG`
- Code-level role checks (`require_roles("KE_TOAN_TRUONG", ...)`) sẽ hoạt động đúng khi user có role này, nhưng DB permissions cần được seed để frontend render menu đúng
- Pattern tạo user: xem `backend/create_test_users.py` — dùng bcrypt hash + SQL INSERT với ON CONFLICT DO UPDATE

## Approach: Script Python một lần

Viết script `backend/create_loan_ke_toan_truong.py` thực hiện 3 việc theo thứ tự:

### Bước 1 — Assign permissions cho role `KE_TOAN_TRUONG`

Assign các permissions sau vào bảng `role_permissions`:

| Nhóm | Permissions |
|---|---|
| **Kế Toán** (full) | `accounting.view`, `accounting.receipts`, `accounting.payments`, `accounting.cash_book`, `accounting.bank_ledger`, `accounting.ar_ledger`, `accounting.ap_ledger`, `accounting.reconciliation`, `accounting.journal`, `accounting.general_ledger`, `accounting.ccdc`, `accounting.workshop_mgmt`, `accounting.manage`, `accounting.hoa_don_dien_tu` |
| **Mua Hàng** (read-only) | `purchase.view`, `purchase.orders`, `purchase.goods_receipts`, `purchase.reports` |
| **Nhân Sự** (lương) | `hr.view`, `hr.payroll`, `hr.payroll_config` |

Pattern: `ON CONFLICT DO NOTHING` — idempotent, chạy lại cũng an toàn.

### Bước 2 — Tạo user `loan`

```sql
INSERT INTO users (username, ho_ten, password_hash, role_id, trang_thai, created_at, updated_at)
VALUES ('loan', 'Loan', '<bcrypt_hash_of_123456>', <ke_toan_truong_role_id>, true, now(), now())
ON CONFLICT (username) DO UPDATE SET password_hash = ..., role_id = ..., trang_thai = true
```

- **username**: `loan`
- **ho_ten**: `Loan`
- **password**: `123456` (bcrypt rounds=14, pattern từ `create_test_users.py`)
- **role**: `KE_TOAN_TRUONG`

### Bước 3 — Verify

In ra: role_id tìm được, số permissions assigned, user ID vừa tạo.

## File cần tạo

- `backend/create_loan_ke_toan_truong.py` — script mới, pattern giống `create_test_users.py`

## File tham chiếu (không sửa)

- [`backend/create_test_users.py`](../backend/create_test_users.py) — pattern tạo user + bcrypt
- [`backend/seed_full_permissions.py`](../backend/seed_full_permissions.py) — danh sách permissions `accounting.*`
- [`backend/app/models/auth.py`](../backend/app/models/auth.py) — User model schema

## Chạy

```powershell
cd "D:\NAM_PHUONG_SOFTWARE\DU LIEU MPS\erp-nam-phuong\backend"
python create_loan_ke_toan_truong.py
```

## Verification

1. Script in ra: `Assigned X permissions to KE_TOAN_TRUONG` + `Created/updated user: loan`
2. Login thử: `POST http://localhost:8001/api/auth/login` với `{"username":"loan","password":"123456"}` → nhận `access_token`
3. Kiểm tra role: `GET http://localhost:8001/api/auth/me` với token → `role.ma_vai_tro == "KE_TOAN_TRUONG"`
