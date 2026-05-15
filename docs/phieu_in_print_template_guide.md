# Huong Dan Mau In Phieu In

Mau in quan ly trong module cau hinh bieu mau.

## File va route lien quan

- Backend: `backend/app/routers/system.py`
- Seed template: `backend/app/seeds/seed_templates.py`
- Frontend page: `frontend/src/pages/master/PrintTemplatePage.tsx`
- Route: `/master/print-templates`

## Nguyen tac

- Mau in khong hard-code thong tin phap nhan.
- Logo, ten cong ty, dia chi, MST, dien thoai, tai khoan ngan hang lay tu danh muc phap nhan/cau hinh.
- Bien placeholder can dat ten ro va on dinh.
- Khi them placeholder moi, cap nhat ca seed, UI preview va ham render.

## Checklist khi sua mau

- Preview tren man hinh cau hinh.
- In/PDF tu chung tu that.
- Thu voi phap nhan co/thieu logo.
- Bang chi tiet khong tran ngang.
- Co vung chu ky nguoi lap/duyet/giao/nhan neu chung tu can.

## Goi y placeholder

```text
{{so_chung_tu}}
{{ngay_chung_tu}}
{{ten_phap_nhan}}
{{dia_chi_phap_nhan}}
{{ma_so_thue}}
{{logo_url}}
{{nguoi_lap}}
{{ghi_chu}}
{{bang_chi_tiet}}
```
