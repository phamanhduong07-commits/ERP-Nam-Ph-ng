# Workshop Accounting Guide

Tai lieu nay ghi chu cac luong ke toan lien quan phan xuong, gia thanh, luong va tai san.

## Module lien quan

- Backend: `backend/app/routers/accounting.py`, `backend/app/models/accounting.py`.
- HR/payroll: `backend/app/routers/hr_payroll_calc.py`, `backend/app/models/hr.py`.
- Frontend: `pages/accounting/WorkshopManagement.tsx`, `pages/reports/WorkshopPNLPage.tsx`, `pages/reports/ProductionCostingPage.tsx`.

## Luong du lieu

```text
San luong/scan/CD2 + bang luong + khau hao + chi phi chung
        -> phan bo theo xuong/ky
        -> gia thanh thuc te
        -> bao cao lai lo phan xuong
```

## Checklist doi soat

- Co ky bao cao dung ngay bat dau/ket thuc.
- Co phan xuong/phap nhan dung.
- Luong, khau hao, chi phi chung duoc nhap/import dung ky.
- San luong/lenh san xuat co du du lieu quy doi.
- Bao cao gia thanh khong tinh trung chi phi.

## Ranh gioi can can than

- Khong ghi but toan ke toan khi chi dang preview bao cao.
- Neu da chot ky, can khoa sua hoac co audit ly do sua.
- Chi phi phan bo can co cong thuc ro de ke toan doi soat lai.
