# Import, Export Va In/PDF

Muc tieu: moi man quan trong co import/export/in thong nhat, de go-live va doi soat du lieu.

## Nguyen tac chung

- Import phai co file mau, validate tung dong va bao loi ro cot/dong.
- Import khong commit neu loi bat buoc.
- Import can luu log: nguoi import, thoi gian, loai du lieu, file goc, so dong thanh cong/loi.
- Export dung bo loc dang xem.
- File export co ten nghiep vu va ngay xuat.
- Mau in/PDF co logo, phap nhan, so chung tu, ngay, noi dung, nguoi lap/duyet, chu ky.

## Nen tang da co

- Frontend import: `frontend/src/components/ImportExcelButton.tsx`, `ImportExcelDialog.tsx`.
- Export helper: `frontend/src/utils/exportUtils.ts`, `frontend/src/utils/excelUtils.ts`.
- Import service backend: `backend/app/services/*import*`.
- Lich su import: `backend/app/routers/import_logs.py`, page `/reports/import-history`.
- Thong tin phap nhan/mau in: `backend/app/routers/system.py`, `frontend/src/pages/master/PrintTemplatePage.tsx`.

## Import danh muc

| Du lieu | Trang/API | Trang thai |
| --- | --- | --- |
| Khach hang | `/api/customers/import` | Da co |
| Nha cung cap | `/api/suppliers/import` | Da co |
| San pham | `/api/products/import` | Da co |
| Nhom vat tu | `/api/material-groups/import` | Da co |
| Vat tu giay | `/api/paper-materials/import` | Da co |
| Vat tu khac | `/api/other-materials/import` | Da co |
| Don vi tinh | `/api/don-vi-tinh/import` | Da co |
| Kho | `/api/warehouses/import` | Da co |
| Vi tri | `/api/vi-tri/import` | Da co |
| Phap nhan | `/api/phap-nhan/import` | Da co |
| Phan xuong | `/api/warehouse/phan-xuong/import` | Da co |
| Xe/tai xe/lo xe | `/api/xe`, `/api/tai-xe`, `/api/lo-xe` | Da co mot phan |
| Tinh thanh/phuong xa | `/api/tinh-thanh`, `/api/phuong-xa` | Da co |
| Don gia van chuyen | `/api/don-gia-van-chuyen/import` | Da co |
| Tai khoan ngan hang | `/api/bank-accounts/import` | Da co |

## Import so du dau ky

- Ton kho dau ky: `/api/warehouse/ton-kho/import-template`, `/api/warehouse/ton-kho/import`.
- Cong no phai thu: `/api/accounting/opening-balances/template-ar`, `/api/accounting/opening-balances/import-ar`.
- Cong no phai tra: `/api/accounting/opening-balances/template-ap`, `/api/accounting/opening-balances/import-ap`.
- Quy tien mat: `/api/accounting/opening-balances/cash/import-template`, `/api/accounting/opening-balances/cash/import`.
- Ngan hang: `BankAccountList` qua `/api/bank-accounts/import`.
- CCDC/tai san/luong xuong: xem cac page accounting/workshop.

## Export/In can co

| Nhom | Can co |
| --- | --- |
| Ban hang | Bao gia PDF, don hang Excel/PDF, giao hang Excel/PDF, tra hang/credit note |
| Mua hang | PO Excel/PDF, GR Excel/PDF, hoa don mua PDF, tra hang NCC, bao cao mua hang |
| Kho | Ton kho, the kho, phieu nhap/xuat/chuyen/dieu chinh |
| Ke toan | Phieu thu/chi, AR/AP ledger, so quy, ngan hang, journal, bao cao thue |
| Bao cao | Doanh thu, cong no, NXT, gia thanh, lai lo xuong, VAT/CDPS |

## Backlog import nghiep vu

- Import don ban hang tu Excel.
- Import don mua hang tu Excel.
- Import bang kiem ke de tao phieu dieu chinh.
- Import sao ke ngan hang de doi soat.
- Import BOM/dinh muc.
- Import ke hoach san xuat.
- Import san luong CD2 tu file ngoai neu co.

## Checklist nghiem thu

- Tai file mau duoc.
- Preview hien dung du lieu.
- Loi hien theo dong/cot.
- Duplicate key duoc phat hien.
- Import xong xem duoc o man danh sach.
- Export dung bo loc.
- PDF khong tran bang va co phap nhan.
- Khong loi khi danh sach rong.
