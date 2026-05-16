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
- Nghiep vu in/xuat file phai lay dung mau theo phap nhan cua chung tu.
- Neu thieu phap nhan hoac thieu mau dung phap nhan thi bao loi va dung, khong fallback sang mau chung/mau phap nhan khac.
- Chi man cau hinh duoc phep xem/copy mau de tao ban rieng; luong nghiep vu khong duoc tu dong thay mau.

## Phan loai luong in/xuat

| Loai luong | Vi du | Rule phap nhan |
| --- | --- | --- |
| Chung tu phap ly/nghiep vu | Bao gia, don hang, hoa don, phieu thu/chi, phieu nhap/xuat/chuyen kho | Bat buoc co 1 phap nhan va template dung phap nhan |
| Danh sach chung tu | Danh sach don hang, lenh san xuat, phieu kho | Chi in/xuat khi danh sach thuoc 1 phap nhan; neu nhieu phap nhan thi yeu cau loc |
| Bao cao noi bo tong hop | Cong no, so cai, ton kho tong hop nhieu phap nhan | Khong tu gan phap nhan mac dinh; neu can logo/phap nhan thi phai co filter ro |
| Import/export du lieu cau hinh | Danh muc, import master data | Khong can template phap nhan tru khi file la chung tu nghiep vu |

## Ma mau toi thieu can co

| Ma mau | Nghiep vu | Yeu cau |
| --- | --- | --- |
| SALES_QUOTE | Bao gia chi tiet / Excel bao gia | Bat buoc theo phap nhan |
| SALES_QUOTE_LIST | Danh sach bao gia PDF | Bat buoc danh sach chi co 1 phap nhan |
| SALES_ORDER, SALES_ORDER_DETAIL | Don hang ban | Bat buoc theo phap nhan |
| PRODUCTION_ORDER, PRODUCTION_ORDER_DETAIL | Lenh san xuat | Bat buoc theo phap nhan |
| PURCHASE_ORDER, PURCHASE_ORDER_LIST | Don mua hang | Bat buoc theo phap nhan |
| GOODS_RECEIPT, GOODS_RECEIPT_PURCHASE | Phieu nhap kho | Bat buoc theo phap nhan |
| MATERIAL_ISSUE, WAREHOUSE_TRANSFER, STOCK_ADJUSTMENT | Xuat/chuyen/kiem ke kho | Bat buoc theo phap nhan |
| CASH_RECEIPT, CASH_PAYMENT, SALES_INVOICE | Thu/chi/hoa don | Bat buoc theo phap nhan |

Truoc go-live phai tao du cac ma mau tren cho tung phap nhan dang su dung chung tu. Neu thieu mau, luong nghiep vu se bao loi va khong tao file.

## Checklist khi sua mau

- Preview tren man hinh cau hinh.
- In/PDF tu chung tu that.
- Thu voi phap nhan co/thieu logo.
- Thu case thieu mau theo phap nhan: he thong phai bao loi, khong in bang mau khac.
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
