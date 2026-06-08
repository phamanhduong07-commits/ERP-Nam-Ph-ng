# Plan: Trang thái hàng lỗi + Kho ảo

## Context

Hàng lỗi phát sinh từ sản xuất hiện chỉ được ghi nhận là số (`ProductionOutput.so_luong_loi`) — không có trạng thái, không có nơi lưu trữ, không có workflow xử lý. Cần: (1) gắn trạng thái để "treo cờ", (2) tạo kho ảo là điểm chứa trước khi xử lý nghiệp vụ (tái chế, thanh lý, phân loại...).

Sprint này = thêm trang_thai + nhập kho ảo. Xử lý trong kho ảo là Phase 2.

---

## Thiết kế

### Luồng

```
ProductionOutput.so_luong_loi > 0
    → trang_thai_loi = 'cho_xu_ly'   (auto-set khi save)
    → Thủ kho thấy badge "N phiếu chưa xử lý" trong KhoLoiPage
    → Click "Nhập kho ảo"
    → Tạo HangLoiKhoAo record
    → trang_thai_loi = 'da_nhap_kho_ao'
    → Hiển thị trong tab "Kho ảo"
```

### Tại sao dùng bảng riêng thay vì loai_kho='HANG_LOI' trong Warehouse?

`InventoryBalance` đòi `product_id` nhưng `ProductionOutput.product_id` nullable (nhiều record dùng `ten_hang` string). Bảng riêng `HangLoiKhoAo` đơn giản hơn, tránh conflict, dễ extend Phase 2 (nguyen_nhan, bien_phap_xu_ly).

---

## Thay đổi cần làm

### 1. Migration — 2 bước

**Migration A:** Thêm cột `trang_thai_loi` vào `production_outputs`
```python
op.add_column('production_outputs', sa.Column(
    'trang_thai_loi', sa.String(20), nullable=True
))
# Backfill: UPDATE production_outputs SET trang_thai_loi='cho_xu_ly'
#           WHERE so_luong_loi > 0 AND trang_thai_loi IS NULL
```

**Migration B:** Tạo bảng `hang_loi_kho_ao`
```python
op.create_table('hang_loi_kho_ao',
    sa.Column('id', sa.Integer, primary_key=True),
    sa.Column('production_output_id', sa.Integer,
              sa.ForeignKey('production_outputs.id'), unique=True, nullable=False),
    sa.Column('so_luong', sa.Numeric(12, 3), nullable=False),   # snapshot so_luong_loi
    sa.Column('trang_thai', sa.String(20), default='cho_xu_ly'), # cho_xu_ly|dang_xu_ly|da_xu_ly|huy
    # Phase 2 fields (nullable now):
    sa.Column('nguyen_nhan', sa.Text, nullable=True),
    sa.Column('bien_phap_xu_ly', sa.Text, nullable=True),
    sa.Column('nguoi_xu_ly_id', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
    sa.Column('han_xu_ly', sa.Date, nullable=True),
    sa.Column('ghi_chu', sa.Text, nullable=True),
    sa.Column('created_by', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True)),
    sa.Column('updated_at', sa.DateTime(timezone=True)),
)
```

### 2. Backend — Model

**File:** `backend/app/models/warehouse_doc.py`

Thêm field vào `ProductionOutput`:
```python
trang_thai_loi: Mapped[str | None] = mapped_column(String(20), nullable=True)
# None = không có lỗi | 'cho_xu_ly' | 'da_nhap_kho_ao'
```

Thêm class mới cùng file:
```python
class HangLoiKhoAo(Base):
    __tablename__ = "hang_loi_kho_ao"
    id / production_output_id (unique FK) / so_luong / trang_thai
    nguyen_nhan / bien_phap_xu_ly / nguoi_xu_ly_id / han_xu_ly / ghi_chu
    created_by / created_at / updated_at
    production_output = relationship("ProductionOutput")
    nguoi_xu_ly = relationship("User", foreign_keys=[nguoi_xu_ly_id])
```

### 3. Backend — Auto-set trang_thai_loi

**File:** `backend/app/routers/warehouse.py` — endpoint tạo/update ProductionOutput

Trong hàm save ProductionOutput, sau khi commit:
```python
if output.so_luong_loi > 0 and output.trang_thai_loi is None:
    output.trang_thai_loi = 'cho_xu_ly'
    db.commit()
```

### 4. Backend — Endpoints mới

**File mới:** `backend/app/routers/kho_ao.py`

```
POST   /api/kho-ao/nhap
  Body: { production_output_id: int }
  Logic:
    - Validate: output.so_luong_loi > 0 AND trang_thai_loi == 'cho_xu_ly'
    - Raise 400 nếu đã tồn tại HangLoiKhoAo record
    - Tạo HangLoiKhoAo { so_luong=output.so_luong_loi, trang_thai='cho_xu_ly' }
    - Update output.trang_thai_loi = 'da_nhap_kho_ao'
    - Return HangLoiKhoAoResponse

GET    /api/kho-ao
  Params: trang_thai?, phap_nhan_id?, phan_xuong_id?, tu_ngay?, den_ngay?
  Join:   ProductionOutput → ProductionOrder → ProductionOrderItem, PhanXuong, PhapNhan
  Return: list[HangLoiKhoAoResponse] (gồm ten_hang, so_lenh, ten_khach_hang, specs)

PATCH  /api/kho-ao/{id}/trang-thai  (Phase 2 placeholder — chỉ cho phép update ghi_chu hiện tại)
```

Mount vào `backend/app/main.py`.

### 5. Frontend — KhoLoiPage

**File:** `frontend/src/pages/production/KhoLoiPage.tsx`

**Tab "Hàng lỗi" (hiện có):**
- Thêm cột `trang_thai_loi` với Tag màu:
  - `cho_xu_ly` → Tag đỏ "Chưa xử lý"
  - `da_nhap_kho_ao` → Tag xanh "Đã vào kho ảo"
- Thêm action button "Nhập kho ảo" (icon: InboxOutlined):
  - Chỉ hiện khi `trang_thai_loi == 'cho_xu_ly'`
  - Require `inventory.transfer` permission
  - Gọi `POST /api/kho-ao/nhap` với `production_output_id`
  - Invalidate query sau khi thành công
- Stats card: thêm "N phiếu chưa xử lý" (đếm `cho_xu_ly`)

**Tab mới "Kho ảo" (thêm):**
- Query: `GET /api/kho-ao`
- Cùng filter phap_nhan/phan_xuong
- Columns: ten_hang, so_lenh, so_luong, trang_thai, ngay_nhap, ten_phan_xuong, ten_khach_hang
- Trang_thai tag: `cho_xu_ly`=đỏ, `dang_xu_ly`=vàng, `da_xu_ly`=xanh, `huy`=xám

### 6. Frontend — API

**File:** `frontend/src/api/kho_ao.ts` (mới)
```typescript
export const khoAoApi = {
  nhap: (production_output_id: number) =>
    client.post('/kho-ao/nhap', { production_output_id }),
  list: (params?) => client.get('/kho-ao', { params }),
}
```

---

## Files cần thay đổi

| File | Loại |
|------|------|
| `backend/app/models/warehouse_doc.py` | Thêm field + class mới |
| `backend/app/routers/warehouse.py` | Auto-set trang_thai_loi |
| `backend/app/routers/kho_ao.py` | **MỚI** — 3 endpoints |
| `backend/app/main.py` | Mount router |
| `backend/alembic/versions/zmh015_*.py` | Migration A + B |
| `frontend/src/api/kho_ao.ts` | **MỚI** |
| `frontend/src/pages/production/KhoLoiPage.tsx` | Badge, button, tab mới |

---

## Verify

1. Tạo ProductionOutput với `so_luong_loi > 0` → kiểm tra DB: `trang_thai_loi='cho_xu_ly'`
2. Gọi `POST /api/kho-ao/nhap` → `HangLoiKhoAo` record tạo, `trang_thai_loi='da_nhap_kho_ao'`
3. Gọi lại endpoint trên → trả 400 "đã nhập kho ảo"
4. `GET /api/kho-ao` → trả record vừa tạo kèm join data
5. Frontend KhoLoiPage: badge đỏ "Chưa xử lý" hiện, click "Nhập kho ảo" → badge chuyển xanh, record xuất hiện tab Kho ảo
6. `tsc --noEmit` → 0 errors
