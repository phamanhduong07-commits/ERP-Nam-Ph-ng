# Plan: Hoàn thiện Trang Kế hoạch Sản xuất — đạt 10/10
Date: 2026-05-16
Status: APPROVED — executing

## Mục tiêu
Đưa trang Kế hoạch Sản xuất (ProductionPlansPage) lên 10/10 theo scorecard chuẩn, với trọng tâm đặc biệt vào phiếu in cho công nhân đứng máy: đúng, đủ, rõ, khó nhầm.

## Các bước thực thi

- [ ] **Bước 1 — Backend schema**: Thêm `created_by_name` + `noi_sx` vào `ProductionPlanListItem` và `ProductionPlanResponse`
  - File: `backend/app/schemas/production_plan.py`
  - Mục tiêu: 2 field mới cho frontend dùng

- [ ] **Bước 2 — Backend router**: Populate `created_by_name` + `noi_sx` trong list endpoint và `_build_plan_response`
  - File: `backend/app/routers/production_plans.py`
  - Mục tiêu: joinedload `creator`, lấy `creator.ho_ten` và `creator.phan_xuong`

- [ ] **Bước 3 — Frontend API types**: Thêm `created_by_name`, `noi_sx` vào `PlanListItem` và `PlanResponse`
  - File: `frontend/src/api/productionPlans.ts`
  - Mục tiêu: TypeScript types khớp backend

- [ ] **Bước 4 — ProductionPlanList**: Filter persistence + shortcuts + ngày màu + người lập + debounce
  - File: `frontend/src/pages/production/ProductionPlanList.tsx`
  - Chi tiết:
    - sessionStorage key `production_plan_filters` (save/restore: search, trangThai, dateRange, page)
    - Shortcut buttons: "Nháp" (lọc `nhap`) + "Đã xuất" (lọc `da_xuat`)
    - Ngày màu: `ngay_ke_hoach` < hôm nay AND `trang_thai !== 'hoan_thanh'` → màu cam; quá 3 ngày → đỏ
    - Thêm cột "Người lập" (created_by_name)
    - Debounce search 400ms

- [ ] **Bước 5 — ProductionPlanDetail**: ngay_chay + Người lập + Nơi SX + print CSS + invalidate list
  - File: `frontend/src/pages/production/ProductionPlanDetail.tsx`
  - Chi tiết:
    - Thêm `ngay_chay` hiển thị dưới "Số LSX" (sub-text DD/MM, tránh thêm cột mới làm bảng rộng hơn)
    - Header detail: thêm "Người lập: {created_by_name}" + "Nơi SX: {noi_sx}"
    - Print CSS: `@page { size: A4 landscape; margin: 8mm; }` + `font-size: 8px` trong print mode
    - `completeLineMut.onSuccess` → thêm `qc.invalidateQueries({ queryKey: ['production-plans'] })`
    - `exportMut.onSuccess` đã invalidate (giữ nguyên ✓)
    - PDF export: thêm Người lập + Nơi SX vào phần header của PDF

## Done Criteria
- [ ] F5 trên ProductionPlansPage → filter (search, trangThai, dateRange) restore đúng
- [ ] Nút "Nháp" click → lọc ngay các kế hoạch status=nhap
- [ ] Nút "Đã xuất" click → lọc kế hoạch status=da_xuat; click lại → bỏ lọc
- [ ] Kế hoạch ngay_ke_hoach < hôm nay và chưa hoan_thanh → ngày hiển thị màu cam/đỏ
- [ ] Cột "Người lập" xuất hiện trong danh sách kế hoạch
- [ ] Trong detail: thấy "Người lập: [tên]" và "Nơi SX: [phân xưởng]" ở header
- [ ] Mỗi dòng trong detail: ngay_chay hiển thị dạng "14/05" ngay dưới số LSX
- [ ] Bấm "Hoàn thành dòng" → danh sách bên trái cập nhật status của kế hoạch
- [ ] In (Ctrl+P): bảng in theo A4 landscape, không bị cắt cột, font đủ nhỏ để vừa trang
- [ ] TypeScript: 0 lỗi mới sau khi thay đổi

## Rủi ro
- Bước 2: `list_plans` hiện dùng query scalar, cần thêm joinedload creator mà không break N+1 (dùng options joinedload trên query chính)
- Bước 4: Shortcut buttons khi click lại cùng value → toggle off (null), tránh stuck state
- Bước 5: `ngay_chay` sub-text dưới Số LSX — cần đảm bảo ô không quá cao khi không có ngay_chay (hiện `—`)
- Bước 5: `@page landscape` chỉ ảnh hưởng `window.print()`, không ảnh hưởng `printToPdf()` (đó là popup HTML riêng — cần thêm CSS riêng cho nó)
