# Plan: Hoàn thiện Template In toàn hệ thống — Round 2
Date: 2026-05-15
Status: APPROVED

## Mục tiêu
Sửa 2 vấn đề còn lại sau Round 1:
1. `DEFAULT_HEADER` trong `seed_templates.py` chứa `{{meta_rows}}` không bao giờ được inject
   → 9 templates hiển thị chữ `{{meta_rows}}` thô
2. `DOC_TYPE_SCHEMAS` thiếu `deliveryLabel` cho 6 entries → UI hiển thị label mặc định sai

## Các bước thực thi

- [x] Bước 1: Fix DEFAULT_HEADER — backend/app/seeds/seed_templates.py
  - Thay `{{meta_rows}}` bằng: `<div>Số: <strong>{{document_number}}</strong></div><div>Ngày: {{document_date}}</div>`

- [x] Bước 2: Thêm deliveryLabel 6 entries — frontend/src/pages/master/PrintTemplatePage.tsx
  - SALES_ORDER: `'Địa chỉ giao hàng'`
  - SALES_INVOICE: `'Địa chỉ'`
  - PURCHASE_ORDER: `'Ngày giao dự kiến'`
  - WAREHOUSE_OUT: `'Lý do xuất'`
  - WAREHOUSE_IN: `'Kho nhập'`
  - delivery_order: `'Địa chỉ giao'`

- [ ] Bước 3: Chạy seed + TypeScript check

## Done Criteria
- [ ] DEFAULT_HEADER không còn `{{meta_rows}}`, hiển thị số và ngày chứng từ
- [ ] 6 entries trong DOC_TYPE_SCHEMAS có `deliveryLabel` đúng
- [ ] Seed chạy không lỗi
- [ ] TypeScript: 0 lỗi mới

## Rủi ro
- Bước 1 ảnh hưởng 9 templates dùng DEFAULT_HEADER — chỉ sửa phần `{{meta_rows}}`, không thay đổi cấu trúc khác
- Bước 2 chỉ thêm label, không thay đổi logic
