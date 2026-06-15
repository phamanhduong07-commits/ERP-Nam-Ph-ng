# Kế hoạch: Phân quyền chi tiết per-endpoint

## Context

Hiện tại 3 router đã có router-level permission guard (từ sprint trước), nhưng tất cả
endpoints trong mỗi router đều dùng cùng 1 permission dù action khác nhau. Kết quả:
user có `production_order.view` có thể gọi cả POST/PATCH/DELETE — chỉ frontend đang
enforce phân biệt. Yêu cầu: thêm per-endpoint guard trên các mutation endpoints để
backend thực sự chặn đúng action theo permission.

**Chiến lược:** Giữ nguyên router-level dep (gating tổng), thêm per-endpoint dep chỉ
trên mutations. GETs đã được bảo vệ đủ bởi router-level.

---

## Dep function tái sử dụng

```python
# backend/app/deps.py — đã có sẵn, không cần thêm gì
from app.deps import get_current_user, require_any_permission

# Pattern thay thế trong function signature:
# CŨ:  _: User = Depends(get_current_user)
# MỚI: _: User = Depends(require_any_permission("production_order.create"))
```

`require_any_permission` đã tự gọi `get_current_user` bên trong + ADMIN bypass.

---

## File 1: `backend/app/routers/production_orders.py`

Router-level giữ nguyên: `require_any_permission("production_order.view")`

Thêm per-endpoint trên 16 mutations:

| Function | Line | HTTP | Permission |
|---|---|---|---|
| `tao_lenh_tu_don_hang` | ~447 | POST /tu-don-hang/{id} | `production_order.create` |
| `batch_set_tan_dung` | ~565 | PATCH /batch-tan-dung | `production_order.edit` |
| `create_order` | ~603 | POST / | `production_order.create` |
| `update_order` | ~613 | PUT /{id} | `production_order.edit` |
| `start_order` | ~624 | PATCH /{id}/start | `production_order.start` |
| `complete_order` | ~642 | PATCH /{id}/complete | `production_order.complete` |
| `pause_order` | ~671 | PATCH /{id}/pause | `production_order.edit` |
| `resume_order` | ~701 | PATCH /{id}/resume | `production_order.edit` |
| `cancel_order` | ~735 | PATCH /{id}/cancel | `production_order.cancel` |
| `update_item_progress` | ~752 | PATCH /{id}/items/{id}/progress | `production_order.start` |
| `update_item_sx_params` | ~797 | PATCH /{id}/items/{id}/sx-params | `production_order.edit` |
| `create_phieu_nhap_phoi_song` | ~911 | POST /{id}/phieu-nhap-phoi-song | `production_order.edit` |
| `ngung_phoi_song_tao_lenh_bu` | ~1021 | POST /{id}/ngung-phoi-song | `production_order.edit` |
| `delete_phieu_nhap_phoi_song` | ~1262 | DELETE /{id}/phieu-nhap-phoi-song/{id} | `production_order.cancel` |
| `chuyen_mua_phoi` | ~1310 | PATCH /{id}/chuyen-mua-phoi | `production_order.edit` |
| `push_to_cd2` | ~1371 | POST /{id}/push-to-cd2 | `production_order.edit` |

---

## File 2: `backend/app/routers/production_plans.py`

Router-level giữ nguyên: `require_any_permission("production_order.view")`

Thêm per-endpoint trên 13 mutations:

| Function | HTTP | Permission |
|---|---|---|
| `create_plan` | POST / | `production_order.create` |
| `reorder_queue` | PATCH /queue/reorder | `production_order.edit` |
| `push_to_queue` | POST /push-to-queue | `production_order.edit` |
| `start_queue_line` | PATCH /queue/{id}/start | `production_order.start` |
| `update_plan` | PUT /{id} | `production_order.edit` |
| `delete_plan` | DELETE /{id} | `production_order.cancel` |
| `export_plan` | PATCH /{id}/export | `production_order.edit` |
| `add_line` | POST /{id}/lines | `production_order.edit` |
| `update_line` | PUT /{id}/lines/{id} | `production_order.edit` |
| `delete_line` | DELETE /{id}/lines/{id} | `production_order.edit` |
| `complete_line` | PATCH /{id}/lines/{id}/complete | `production_order.complete` |
| `toggle_mua_phoi_ngoai` | PATCH /lines/{id}/phoi-ngoai | `production_order.edit` |
| `promote_pool_line` | PATCH /lines/{id}/promote-from-pool | `production_order.edit` |

---

## File 3: `backend/app/routers/reports.py`

Router-level giữ nguyên: `require_any_permission("report.view", "report.export")`

Thêm per-endpoint trên 9 endpoints — phân biệt view vs export:

| Function | HTTP | Permission | Lý do |
|---|---|---|---|
| `export_revenue_excel` | GET /revenue/export | `report.export` | Chỉ người có quyền export mới xuất Excel |
| `export_inventory_movement_excel` | GET /inventory-movement/export | `report.export` | idem |
| `export_debt_summary_excel` | GET /debt-summary/export | `report.export` | idem |
| `export_production_performance_excel` | GET /production-performance/export | `report.export` | idem |
| `export_order_progress_excel` | GET /order-progress/export | `report.export` | idem |
| `export_production_cost_excel` | GET /production-cost/export | `report.export` | idem |
| `create_sales_target` | POST /sales-targets | `report.export` | Quản lý mục tiêu = quyền cao hơn view |
| `update_sales_target` | PUT /sales-targets/{id} | `report.export` | idem |
| `delete_sales_target` | DELETE /sales-targets/{id} | `report.export` | idem |

**Kết quả sau thay đổi:**
- `report.view` only: xem report, không export, không quản lý targets
- `report.export`: xem + export Excel + quản lý sales targets

---

## Tổng số thay đổi

| File | Endpoints thay đổi |
|---|---|
| production_orders.py | 16 |
| production_plans.py | 13 |
| reports.py | 9 |
| **Tổng** | **38** |

Không thêm/xóa permission nào trong DB — toàn bộ `production_order.*` và `report.*`
đã tồn tại trong DB.

---

## Verification

```bash
# 1. Restart service
D:\NAM_PHUONG_SOFTWARE\deploy.bat → [2] ERP

# 2. Lấy token user có production_order.view nhưng KHÔNG có production_order.create
# 3. Test: GET /api/production-orders → 200 OK (view được)
# 4. Test: POST /api/production-orders → 403 Forbidden (không tạo được)
# 5. Test: PATCH /api/production-orders/{id}/start → 403 (không start được)

# 6. Lấy token user có production_order.create
# 7. Test: POST /api/production-orders → 201 Created ✓
# 8. Test: PATCH /api/production-orders/{id}/start → 403 (vẫn cần production_order.start)

# Reports:
# 9. Token report.view only: GET /api/reports/revenue → 200, GET /api/reports/revenue/export → 403
# 10. Token report.export: cả 2 → 200
```
