# Fix: Tính gia_tri_ton giấy cuộn theo giá bình quân gia quyền

## Context

Trang Tồn kho giấy cuộn hiện tính `gia_tri_ton = ton_luong × giá nhập gần nhất` (lấy từ `GoodsReceiptItem` có `id` lớn nhất). Điều này sai về kế toán (vi phạm VAS 02) và gây chênh lệch ~89 triệu so với SQL Server HTCPH vốn đang dùng giá bình quân gia quyền.

`InventoryBalance` đã có sẵn field `don_gia_binh_quan` (weighted average, được cập nhật mỗi lần approve phiếu nhập). Các endpoint `/du-tru-giay` và `/doi-soat-giay` trong cùng file đã dùng đúng nguồn này — chỉ `/ton-kho-giay` bị sót.

## Thay đổi duy nhất

**File:** `backend/app/routers/inventory_reports.py` — hàm `ton_kho_giay`

**Xoá** đoạn build `don_gia_map` từ `GoodsReceiptItem` (lines 628–643):
```python
# XOÁ ĐOẠN NÀY
don_gia_rows = (
    db.query(
        GoodsReceiptItem.paper_material_id,
        func.max(GoodsReceiptItem.id).label("max_id"),
    )
    ...
)
```

**Mở rộng** query `bien_dong_map` (đã query `InventoryBalance` sẵn) để lấy thêm `don_gia_binh_quan`:
```python
bal_rows = (
    db.query(
        InventoryBalance.paper_material_id,
        func.sum(InventoryBalance.ton_luong).label("ton_now"),
        func.sum(InventoryBalance.ton_luong_truoc).label("ton_prev"),
        func.sum(
            InventoryBalance.don_gia_binh_quan * InventoryBalance.ton_luong
        ).label("weighted"),
    )
    .filter(InventoryBalance.paper_material_id.in_(pm_ids))
    .group_by(InventoryBalance.paper_material_id)
    .all()
)
don_gia_map: dict[int, float] = {}
for b in bal_rows:
    if b.ton_now and float(b.ton_now) > 0:
        don_gia_map[b.paper_material_id] = float(b.weighted) / float(b.ton_now)
    if b.ton_prev is not None:
        bien_dong_map[b.paper_material_id] = float(b.ton_now or 0) - float(b.ton_prev)
```

Pattern này giống hệt `/du-tru-giay` line 819 và `/doi-soat-giay` line 1088 — không phát minh gì mới.

## Không thay đổi

- Frontend (`KhoGiayCuonPage.tsx`, `warehouse.ts`): giữ nguyên — vẫn dùng `gia_tri_ton` và `don_gia_binh_quan` như cũ
- Các endpoint khác: không liên quan
- Schema/migration: không cần

## Verification

```bash
# 1. Restart backend
# 2. Gọi endpoint
curl http://localhost:8001/api/warehouse/ton-kho-giay \
  -H "Authorization: Bearer TOKEN" | python -m json.tool | grep gia_tri_ton

# 3. Tổng giá trị tồn phải gần 11.479 tỷ (khớp SQL Server) thay vì 11.39 tỷ
```
