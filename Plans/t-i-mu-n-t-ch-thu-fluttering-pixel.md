# Kế hoạch hoàn thiện chức năng nghiệp vụ Thu Chi

## Context

ERP đã có đầy đủ infrastructure thu chi (CashReceipt/CashPayment CRUD, TienMatPage/NganHangPage list, sổ quỹ, sổ tiền gửi, đối soát, nộp thuế/bảo hiểm/lương). Yêu cầu hoàn thiện dựa trên screenshot tham chiếu (MISA-style) để đạt chuẩn UX kế toán chuyên nghiệp.

**Trạng thái hiện tại đã hoàn thành:**
- ✅ CRUD phiếu thu/chi, list pages, filter, phân trang
- ✅ TienMatPage / NganHangPage với bulk actions (bỏ ghi, nhân bản)
- ✅ TK Nợ/Có tự động theo khoản mục chi phí
- ✅ Sổ quỹ tiền mặt, sổ tiền gửi ngân hàng, đối soát
- ✅ Nộp thuế, nộp bảo hiểm, trả lương (batch payment pages)
- ✅ JournalEntry + JournalEntryLine models (auto-tạo khi approve)
- ✅ Print templates phiếu thu/chi

**Gap so với reference (MISA-style):**
1. ❌ **Hạch toán section trong form** — form chưa hiển thị journal lines
2. ❌ **Đính kèm file** — không có attachment support
3. ❌ **Quick approve từ form** — phải vào list page mới approve được
4. ❌ **Bút toán thủ công override** — chưa cho phép chỉnh journal trước khi approve

---

## Kiến trúc hiện tại — cần hiểu trước khi sửa

**JournalEntry flow:**
- `CashReceipt` tạo → trạng thái `cho_duyet` → **CHƯA có JournalEntry**
- Approve → `da_duyet` → `_post_cash_receipt_journal()` → tạo **2 lines**: (tk_no, Nợ=so_tien) + (tk_co, Có=so_tien)
- `CashPayment` có 2-step: `cho_chot → da_chot → da_duyet` → journal chỉ tạo khi `da_duyet`

**Endpoint lấy journal của document:**
- `GET /api/accounting/documents/{chung_tu_loai}/{chung_tu_id}/journal-entries`
- `chung_tu_loai` = `"phieu_thu"` hoặc `"phieu_chi"`

**Service file:** `backend/app/services/accounting_service.py`
- `_post_cash_receipt_journal()` — tạo journal khi approve receipt
- `_post_cash_payment_journal()` — tạo journal khi approve payment (có split VAT)

---

## Sprint 1: Hạch toán section trong form (3–4 ngày) ⭐ ƯU TIÊN CAO

Thêm section **"Hạch toán"** vào `CashReceiptForm.tsx` và `CashPaymentForm.tsx`.

### UX theo trạng thái:
| Trạng thái | Hành vi |
|---|---|
| `cho_duyet` / `cho_chot` | Preview bút toán computed client-side từ tk_no/tk_co/so_tien — read-only, realtime |
| `da_duyet` | Bút toán thực từ DB (GET journal-entries endpoint) — read-only, locked |
| `huy` | Ẩn section |

### Bảng Hạch toán (giống screenshot reference):
| # | Diễn giải | TK Nợ | TK Có | Số tiền |
|---|---|---|---|---|
| 1 | Thu tiền HĐ... | 112 | | 1.000.000 |
| 2 | Giảm công nợ KH | | 131 | 1.000.000 |

### Backend — KHÔNG cần thay đổi
Chỉ cần thêm API client method:

```typescript
// frontend/src/api/accounting.ts — thêm vào receiptApi:
getJournalEntries: (id: number) =>
  client.get(`/accounting/documents/phieu_thu/${id}/journal-entries`).then(r => r.data),

// và paymentApi:
getJournalEntries: (id: number) =>
  client.get(`/accounting/documents/phieu_chi/${id}/journal-entries`).then(r => r.data),
```

### Frontend Logic:
```tsx
// Khi cho_duyet: compute preview từ form fields
const previewLines = useMemo(() => {
  const tkNo = form.getFieldValue('tk_no')
  const tkCo = form.getFieldValue('tk_co')
  const soTien = Number(form.getFieldValue('so_tien') || 0)
  const dienGiai = form.getFieldValue('dien_giai') || ''
  if (!tkNo || !soTien) return []
  return [
    { key: 1, dien_giai: dienGiai, tk_no: tkNo, tk_co: '', so_tien: soTien },
    { key: 2, dien_giai: dienGiai, tk_no: '', tk_co: tkCo, so_tien: soTien },
  ]
}, [formValues])

// Khi da_duyet: fetch từ DB
const { data: journalEntries } = useQuery(
  ['journal-entries', 'phieu_thu', receiptId],
  () => receiptApi.getJournalEntries(receiptId),
  { enabled: !!receiptId && status === 'da_duyet' }
)
```

### Files cần thay đổi:
| File | Thay đổi |
|---|---|
| `frontend/src/api/accounting.ts` | Thêm `getJournalEntries()` vào receiptApi + paymentApi |
| `frontend/src/pages/accounting/CashReceiptForm.tsx` | Thêm HachToanSection dưới form fields |
| `frontend/src/pages/accounting/CashPaymentForm.tsx` | Thêm HachToanSection |
| `frontend/src/components/accounting/HachToanSection.tsx` | Component mới (shared) |

---

## Sprint 2: Đính kèm file (1–2 ngày)

### Backend — model mới:
```python
# backend/app/models/accounting.py
class Attachment(Base):
    __tablename__ = "attachments"
    id: Mapped[int] (PK)
    chung_tu_loai: Mapped[str]   # "phieu_thu", "phieu_chi"
    chung_tu_id: Mapped[int]
    file_name: Mapped[str]
    file_path: Mapped[str]       # relative path từ D:\NAM_PHUONG_SOFTWARE\attachments\
    file_size: Mapped[int]
    uploaded_by: Mapped[int] (FK → User)
    uploaded_at: Mapped[datetime]
```

### Backend — 4 endpoints mới:
```
POST   /api/attachments/{loai}/{id}        — upload (multipart, max 5MB)
GET    /api/attachments/{loai}/{id}        — list files
DELETE /api/attachments/{attach_id}        — xóa
GET    /api/attachments/{attach_id}/file   — download
```

### Frontend:
- Component `AttachmentSection.tsx` dùng AntD `Upload.Dragger`
- Tái sử dụng cho cả receipt, payment, và các form khác sau này
- Giới hạn: 5MB/file, max 10 files, cho phép: PDF, PNG, JPG, XLSX, DOCX

### Files cần thay đổi:
| File | Thay đổi |
|---|---|
| `backend/app/models/accounting.py` | Thêm Attachment model |
| `backend/app/routers/accounting.py` | 4 endpoints upload/list/delete/download |
| Alembic migration | Tạo bảng `attachments` |
| `frontend/src/api/accounting.ts` | Thêm attachmentApi |
| `frontend/src/components/accounting/AttachmentSection.tsx` | Component mới |
| `frontend/src/pages/accounting/CashReceiptForm.tsx` | Thêm AttachmentSection |
| `frontend/src/pages/accounting/CashPaymentForm.tsx` | Thêm AttachmentSection |

---

## Sprint 3: Quick approve + Workflow UX (1–2 ngày)

### 3a. Nút Duyệt trực tiếp trong form
Thêm action button vào header của form (cạnh nút Lưu):
- CashReceiptForm: `trang_thai === 'cho_duyet'` → hiện nút **"Duyệt"**
- CashPaymentForm: `trang_thai === 'cho_chot'` → hiện **"Chốt"**; `'da_chot'` → hiện **"Duyệt"**
- Gọi `receiptApi.approve(id)` / `paymentApi.approve(id)` rồi refetch

### 3b. Timeline trạng thái
Thêm mini timeline dưới tiêu đề form:
```
🟢 Tạo — Dương — 18/06/2026 12:30  →  🟡 Chờ duyệt  →  ✅ Đã duyệt — Admin — 18/06/2026 14:00
```
Data: `created_at`, `ngay_duyet`, `nguoi_duyet_id` đã có sẵn trong model.

### Files:
- `frontend/src/pages/accounting/CashReceiptForm.tsx`
- `frontend/src/pages/accounting/CashPaymentForm.tsx`
- (Optional) `frontend/src/components/accounting/DocumentTimeline.tsx`

---

## Sprint 4: Bút toán override (Nâng cao — làm sau) 

Cho phép kế toán chỉnh journal lines trước khi approve:
- Backend: thêm `journal_lines_override: JSON` vào CashReceipt/CashPayment
- Frontend: editable table với Thêm/Xóa dòng, validate ∑ Nợ = ∑ Có
- Khi approve: dùng override nếu có, auto-compute nếu không

**Chỉ làm khi Sprint 1-3 xong và user cần tính năng này.**

---

## Thứ tự thực hiện

```
Sprint 1 (3-4 ngày)    Sprint 2 (1-2 ngày)    Sprint 3 (1-2 ngày)    Sprint 4 (2-3 ngày)
Hạch toán section  →   Đính kèm file      →   Quick approve UX   →   Override journal
Backend KHÔNG đổi      Model + API mới        Frontend only           Optional/advanced
```

---

## Verification

**Sprint 1:**
1. Tạo phiếu thu mới → nhập TK Nợ=112, TK Có=131, Số tiền=1.000.000 → section Hạch toán hiển thị 2 dòng preview
2. Thay đổi số tiền → preview cập nhật realtime
3. Approve phiếu → section hiển thị bút toán thực từ DB (cùng dữ liệu)

**Sprint 2:**
1. Upload PDF 2MB → xuất hiện trong danh sách đính kèm với tên file + size
2. Click download → file tải về đúng
3. Xóa → biến mất
4. Upload > 5MB → báo lỗi

**Sprint 3:**
1. Form phiếu thu `cho_duyet` → có nút "Duyệt" → click → phiếu chuyển sang `da_duyet`, reload
2. Timeline hiển thị đúng thứ tự và timestamp
