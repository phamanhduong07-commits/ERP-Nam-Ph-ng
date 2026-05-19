# Plan: 10 Điểm Cải Tiến ERP — Sprint 2026-05-19
Date: 2026-05-19
Status: DONE

## Mục tiêu
Hoàn thiện 10 điểm cải tiến trải rộng toàn hệ thống ERP:
1. Phiếu trả hàng bán — fix bugs + nghiệp vụ tài chính
2. Tích hợp PhotoCapture vào 3 module chính

---

## Các bước thực thi

### Group A — Sales Returns
- [x] Bước 1: Fix create_return (tong_tien_tra = 0)
- [x] Bước 2: Thêm bút toán 5213/131 khi duyệt
- [x] Bước 3: phuong_an_can_tru (3 case cấn trừ)
- [x] Bước 4: SalesReturnDetail — 4-step progress, 3-case UI, voucher, bút toán card
- [x] Bước 5: SalesReturnsPage — tong_tien đỏ, tooltip, type updates

### Group B — Production
- [x] Bước 6: cong_doan computed (production_orders + plans)
- [x] Bước 7: SxParamsTab — kho_ke_hoach, ghi_chu editable, so_dao
- [x] Bước 8: ProductionOrderDetail — kho nhập phôi, ghi_chu_don_hang
- [x] Bước 9: MaySongPage + exportUtils — loai_lan trên tem

### Group C — Media / Photo
- [x] Bước 10a: media.py + media.ts + PhotoCapture.tsx (backend + component)
- [x] Bước 10b: Tích hợp PhotoCapture → SalesReturnDetail
- [x] Bước 10c: Tích hợp PhotoCapture → GoodsReceiptPage
- [x] Bước 10d: Tích hợp PhotoCapture → ProductionOrderDetail

### Group D — Misc
- [x] Bước 11: quotes.py — gia_noi_bo
- [x] Bước 12: DocsPage — nội dung hướng dẫn (+196 dòng)
- [x] Bước 13: accounting.py — filter journal entries by chung_tu

## Done Criteria
- [x] PhotoCapture xuất hiện trong 3 page (Sales Return, Goods Receipt, Production Order)
- [x] Lint: không có error
- [x] Build: thành công
