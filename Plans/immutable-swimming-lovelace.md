# Kế hoạch nâng 4 trang tiện ích đối trừ lên 8/10

## Context

4 trang tiện ích Mua hàng → Tiện ích (DoiTruPage, DoiTruNhieuPage, BoDoiTruPage, BoDoiTruNhieuPage) hiện ở mức 6.0–7.5/10. Các gap chính:
- **BoDoiTruPage**: auto-fetch 200 records khi vào trang dù chưa chọn NCC (UX/Hiệu năng 4-5)
- **BoDoiTruNhieuPage**: hủy hàng loạt mà không có preview trước (Nghiệp vụ/UX 5-6)
- **4 trang**: TK Nợ/TK Có và Loại tiền không được lưu backend (Hoàn chỉnh 6-7)
- **4 trang**: không có role guard cho thao tác hủy (Bảo mật 5-7)

---

## Findings từ codebase

- **Model**: `DoiTruChungTu` tại `backend/app/models/accounting.py:746` — chưa có `tk_no`, `tk_co`, `loai_tien`
- **Role guard**: `backend/app/deps.py` — `get_admin_user` (chỉ ADMIN) và `require_roles(*roles)` (ADMIN + list)
- **Frontend role**: `usePermission()` hook tại `frontend/src/hooks/usePermission.ts` → `{ isAdmin, role, hasPermission }`
- **Excel export**: `exportToExcel()` tại `frontend/src/utils/excelUtils.ts` — dùng `xlsx` + `file-saver`, client-side

---

## Phase 1 — Quick fixes (est. ~45 min)

### 1a. BoDoiTruPage — Auto-fetch fix

**File:** `frontend/src/pages/purchase/BoDoiTruPage.tsx`

Đổi `enabled: true` → `enabled: !!supplierId`. Kết quả: trang mount sạch, chỉ query khi chọn NCC.

```tsx
// Before
enabled: true,

// After  
enabled: !!supplierId,
```

Thêm empty state khi chưa chọn NCC (thay cho blank table):
```tsx
locale={{ emptyText: supplierId ? 'Không có đối trừ nào' : 'Chọn NCC để xem danh sách đối trừ' }}
```

### 1b. DoiTruPage — Giải thích lý do khi buildPairs = []

**File:** `frontend/src/pages/purchase/DoiTruPage.tsx`

Trong `handleConfirm()`, khi `pairs.length === 0`, hiện thông tin cụ thể:
```tsx
if (!pairs.length) {
  const totPay = selectedPayIds.reduce((s, id) => s + (payAmounts[id] ?? 0), 0)
  const totInv = selectedInvIds.reduce((s, id) => s + (invAmounts[id] ?? 0), 0)
  message.warning(
    `Không tạo được cặp đối trừ — Tổng phiếu chi: ${fmt(totPay)} đ / Tổng hóa đơn: ${fmt(totInv)} đ. Kiểm tra số tiền đã nhập.`
  )
  return
}
```

---

## Phase 2 — Preview hủy hàng loạt (est. ~2.5h)

### 2a. Backend — Thêm endpoint preview-huy

**File:** `backend/app/routers/doi_tru.py`

Thêm route ngay trước `huy_nhieu_doi_tuong`. Tái dùng `HuyNhieuIn` schema đã có:

```python
@router.post("/nhieu-doi-tuong/preview-huy")
def preview_huy_nhieu(
    data: HuyNhieuIn,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> Any:
    from app.models.master import Supplier
    results = []
    for sid in data.supplier_ids:
        q = db.query(DoiTruChungTu).filter(
            DoiTruChungTu.supplier_id == sid,
            DoiTruChungTu.trang_thai == "da_xac_nhan",
        )
        if data.tu_ngay:
            q = q.filter(DoiTruChungTu.ngay_doi_tru >= data.tu_ngay)
        if data.den_ngay:
            q = q.filter(DoiTruChungTu.ngay_doi_tru <= data.den_ngay)
        if data.phap_nhan_id:
            q = q.filter(DoiTruChungTu.phap_nhan_id == data.phap_nhan_id)
        rows = q.options(selectinload(DoiTruChungTu.supplier)).all()
        supplier = rows[0].supplier if rows else db.query(Supplier).get(sid)
        ten_ncc = (supplier.ten_viet_tat or supplier.ten_don_vi or supplier.ma_ncc) if supplier else str(sid)
        results.append({
            "supplier_id": sid,
            "ten_ncc": ten_ncc,
            "so_bao": len(rows),
            "tong_tien": sum(float(r.tong_tien_doi_tru) for r in rows),
            "items": [
                {
                    "ma_doi_tru": r.ma_doi_tru,
                    "ngay_doi_tru": r.ngay_doi_tru.isoformat() if r.ngay_doi_tru else None,
                    "tong_tien": float(r.tong_tien_doi_tru),
                }
                for r in rows
            ],
        })
    return results
```

### 2b. Frontend — Đổi BoDoiTruNhieuPage sang 2-bước

**File:** `frontend/src/pages/purchase/BoDoiTruNhieuPage.tsx`

Thêm state:
```tsx
const [preview, setPreview] = useState<any[] | null>(null)
const [showPreview, setShowPreview] = useState(false)
```

Thêm mutation preview:
```tsx
const previewMut = useMutation({
  mutationFn: (body: object) => client.post(`${API}/doi-tru/nhieu-doi-tuong/preview-huy`, body),
  onSuccess: res => { setPreview(res.data); setShowPreview(true) },
  onError: (e: any) => message.error(e.response?.data?.detail ?? 'Lỗi'),
})
```

Đổi flow:
1. Nút "Xem trước" (gọi previewMut) thay vì Popconfirm trực tiếp
2. Card preview hiện sau khi có kết quả: table NCC | Số bản | Tổng tiền | expandable chi tiết mã đối trừ
3. Nút "Xác nhận hủy" nằm trong preview card, có Popconfirm

Thêm nút export sau khi `result` có dữ liệu:
```tsx
import { exportToExcel } from '../../utils/excelUtils'

// Sau khi huyMut.onSuccess:
<Button onClick={() => exportToExcel(result.map(r => ({
  'Nhà cung cấp': (suppliers||[]).find((s:any)=>s.id===r.supplier_id)?.ten_viet_tat ?? r.supplier_id,
  'Số bản đã hủy': r.so_bao_doi_tru_huy,
})), `bo-doi-tru-${dayjs().format('YYYYMMDD')}`)}>
  Xuất Excel
</Button>
```

---

## Phase 3 — Role guard (est. ~45 min)

### 3a. Backend

**File:** `backend/app/routers/doi_tru.py`

```python
# Import thêm
from app.deps import get_current_user, require_roles

# POST /{doi_tru_id}/huy — cho phép ADMIN + KE_TOAN
@router.post("/{doi_tru_id}/huy")
def huy_doi_tru(
    doi_tru_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("ADMIN", "KE_TOAN")),
) -> Any: ...

# POST /nhieu-doi-tuong/huy — chỉ ADMIN (destructive nhất)
@router.post("/nhieu-doi-tuong/huy")
def huy_nhieu_doi_tuong(
    data: HuyNhieuIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_admin_user),
) -> Any: ...
```

### 3b. Frontend

**Files:** `BoDoiTruPage.tsx`, `BoDoiTruNhieuPage.tsx`

```tsx
import { usePermission } from '../../hooks/usePermission'

const { isAdmin, role } = usePermission()
const canHuy = isAdmin || role === 'KE_TOAN'
const canHuyHangLoat = isAdmin

// Disable nút + tooltip
<Tooltip title={!canHuy ? 'Chỉ kế toán mới được hủy đối trừ' : ''}>
  <Button danger disabled={!canHuy} ...>Bỏ đối trừ</Button>
</Tooltip>
```

---

## Phase 4 — Lưu TK Nợ / TK Có / Loại tiền (est. ~2h)

### 4a. Model

**File:** `backend/app/models/accounting.py` — class `DoiTruChungTu`

Thêm 3 columns sau `ghi_chu`:
```python
tk_no: Mapped[str | None] = mapped_column(String(10), nullable=True)
tk_co: Mapped[str | None] = mapped_column(String(10), nullable=True)
loai_tien: Mapped[str] = mapped_column(String(10), default="VND", nullable=False)
```

### 4b. Schema + Router

**File:** `backend/app/routers/doi_tru.py`

`DoiTruCreate`:
```python
tk_no: str | None = "3311"
tk_co: str | None = "1121"
loai_tien: str = "VND"
```

`_create_and_confirm()` — set trên `DoiTruChungTu`:
```python
dt = DoiTruChungTu(
    ...
    tk_no=data.tk_no,
    tk_co=data.tk_co,
    loai_tien=data.loai_tien,
)
```

`_doi_tru_out()` — thêm vào dict trả về:
```python
"tk_no": dt.tk_no,
"tk_co": dt.tk_co,
"loai_tien": dt.loai_tien,
```

### 4c. Alembic migration

```bash
cd backend
alembic revision --autogenerate -m "add_tk_loai_tien_to_doi_tru_chung_tu"
alembic upgrade head
```

Cần chạy tay trước khi restart service.

### 4d. Frontend — Gửi TK + loại tiền

**Files:** `DoiTruPage.tsx`, `DoiTruNhieuPage.tsx`

`createMut` / `confirmMut` body — đọc từ Select controls đã có sẵn trong UI (TK phải trả, Loại tiền):

```tsx
// Thêm state
const [tkNo, setTkNo] = useState('3311')
const [loaiTien, setLoaiTien] = useState('VND')

// Bind Select onChange
<Select value={tkNo} onChange={setTkNo} ...>

// Trong createMut body
tk_no: tkNo,
tk_co: '1121',   // TK tiền mặt/ngân hàng — có thể làm Select sau
loai_tien: loaiTien,
```

---

## Thứ tự thực hiện

```
Phase 1 (quick) → Phase 3 (role guard) → Phase 2 (preview) → Phase 4 (TK + migration)
```

Phase 4 có migration nên để cuối — cần test kỹ trước khi chạy production.

---

## Verification

1. **Phase 1**: Vào BoDoiTruPage → không thấy loading/request khi chưa chọn NCC; chọn NCC → bảng load đúng
2. **Phase 1**: DoiTruPage → chọn payment + invoice không khớp tiền → message hiện tổng 2 phía
3. **Phase 2**: BoDoiTruNhieuPage → "Xem trước" → hiện table NCC + số bản + tổng tiền; "Xác nhận hủy" → Popconfirm → hủy xong → thấy nút "Xuất Excel"
4. **Phase 3**: Login user thường → nút "Bỏ đối trừ" bị disable + tooltip; login ADMIN → nút active
5. **Phase 3**: curl `POST /api/doi-tru/{id}/huy` với token user thường → 403
6. **Phase 4**: Sau migration, tạo đối trừ → DB có `tk_no=3311`, `loai_tien=VND`
