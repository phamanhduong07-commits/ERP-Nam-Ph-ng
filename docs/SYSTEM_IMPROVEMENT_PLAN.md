# System Improvement Plan

Ke hoach cai thien he thong theo huong ben vung, de bao tri va de ban giao.

## 1. Chat luong code

- Tach cac router qua lon, uu tien `warehouse.py` va `accounting.py`.
- Dua side effect vao service: ton kho, cong no, but toan, in/PDF.
- Viet helper chung cho sinh so chung tu.
- Giam lap logic export/print giua cac page.

## 2. Du lieu va audit

- Moi chung tu quan trong can co audit: nguoi tao, nguoi sua, nguoi duyet, ly do huy.
- Cac bang ledger/transaction khong nen sua/xoa im lang.
- Them idempotency hoac check trung khi duyet phieu tao but toan/ton kho.
- Them bao cao doi soat lech kho va lech cong no.

## 3. Testing

- Backend: test service ton kho, accounting, import Excel.
- Frontend: build gate `npm run build`.
- Smoke test API: health, login, danh muc, ton kho, bao cao.
- Test migration tren database rong va database co du lieu.

## 4. Security

- Khong commit `.env`, token, file backup database.
- CORS chi mo origin can thiet tren production.
- Permission guard cho thao tac ghi/duyet/xoa/export nhay cam.
- Upload can gioi han dinh dang va kich thuoc.

## 5. Deployment/operation

- Co mot script start production ro rang.
- Log backend xoay vong hoac don dinh ky.
- Backup database va uploads theo lich.
- Tai lieu restore phai duoc thu that, khong chi viet ly thuyet.
