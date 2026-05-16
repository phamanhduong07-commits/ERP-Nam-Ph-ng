# Hướng dẫn hoàn thiện từng page — Rút từ QuoteList & QuoteDetail

> Tài liệu này ghi lại toàn bộ vấn đề phát hiện và cách xử lý khi hoàn thiện
> trang Báo giá (QuoteList + QuoteDetail). Dùng làm checklist cho các page tiếp theo.

---

## Mục lục

1. [Backend — Các lỗi thường gặp](#1-backend--các-lỗi-thường-gặp)
2. [Frontend — List page](#2-frontend--list-page)
3. [Frontend — Detail page](#3-frontend--detail-page)
4. [Checklist tổng hợp (copy & dùng ngay)](#4-checklist-tổng-hợp)

---

## 1. Backend — Các lỗi thường gặp

### 1.1 N+1 Query — thiếu `joinedload`

**Vấn đề:** Khi list endpoint đọc quan hệ (e.g. `qt.phap_nhan.ten_phap_nhan`),
mỗi row sinh thêm 1 SQL query → 100 row = 101 queries.

**Cách phát hiện:** Thêm `echo=True` vào SQLAlchemy engine, đếm số query khi load list.

**Fix:**
```python
# SAI — N+1
q = db.query(Quote)

# ĐÚNG — eager load tất cả FK cần dùng
q = db.query(Quote).options(
    joinedload(Quote.customer),
    joinedload(Quote.creator),
    joinedload(Quote.phap_nhan),   # ← thêm khi cần ten_phap_nhan
)
```

**Quy tắc:** Mọi field `model.relation.field` trong phần xây dựng response đều
cần `joinedload(Model.relation)` ở truy vấn.

---

### 1.2 Thiếu filter param

**Vấn đề:** List endpoint không hỗ trợ filter theo `phap_nhan_id`,
frontend phải load hết rồi filter client-side → chậm, không đúng pagination.

**Fix:**
```python
@router.get("")
def list_quotes(
    search: str | None = None,
    trang_thai: str | None = None,
    phap_nhan_id: int | None = Query(default=None),   # ← thêm
    ...
):
    q = db.query(Quote).options(...)
    if phap_nhan_id:
        q = q.filter(Quote.phap_nhan_id == phap_nhan_id)
```

**Quy tắc:** Mỗi filter trên UI phải có param tương ứng ở backend.
Không bao giờ load all rồi filter frontend.

---

### 1.3 Thiếu field trong schema response

**Vấn đề:** Schema `QuoteListItem` không có `phap_nhan_id` / `ten_phap_nhan` →
frontend không hiển thị được cột Pháp nhân.

**Fix:**
```python
class QuoteListItem(BaseModel):
    ...
    phap_nhan_id: int | None = None    # ← thêm
    ten_phap_nhan: str | None = None   # ← thêm
```

**Quy tắc:** Schema list item phải chứa đủ field để render mọi cột trong bảng
và mọi thông tin cần cho export Excel, không cần gọi API phụ.

---

## 2. Frontend — List page

### 2.1 sessionStorage filter persistence — thiếu state

**Vấn đề:** Khi thêm filter mới (`phapNhanId`), quên thêm vào deps array của
`useEffect` lưu sessionStorage → filter bị mất khi reload trang.

**Fix:**
```typescript
// Đảm bảo tất cả filter state đều trong deps
useEffect(() => {
  sessionStorage.setItem(SS_KEY, JSON.stringify({
    search, trangThai, phapNhanId,   // ← phapNhanId phải có ở đây
    dateRange, page, myOnly
  }))
}, [search, trangThai, phapNhanId, dateRange, page, myOnly, isEmbedded])
//                     ^^^^^^^^^^^ và ở đây
```

**Quy tắc:** Mỗi lần thêm filter state mới: kiểm tra ngay useEffect sessionStorage
và mảng deps. Thêm cả 2 chỗ cùng lúc.

---

### 2.2 `emptyText` không phản ánh đủ filter đang active

**Vấn đề:** `locale={{ emptyText: search || trangThai ? '...' : '...' }}`
thiếu `phapNhanId` → khi chỉ filter pháp nhân mà không có kết quả, hiển thị
"Chưa có báo giá nào" thay vì "Không tìm thấy báo giá nào".

**Fix:**
```typescript
locale={{ emptyText: search || trangThai || phapNhanId || dateRange.length
  ? 'Không tìm thấy báo giá nào'
  : 'Chưa có báo giá nào'
}}
```

**Quy tắc:** `emptyText` phải OR tất cả filter states. Dùng nullish — `0` và
`false` cũng coi là "không filter".

---

### 2.3 Table `scroll.x` quá hẹp

**Vấn đề:** `scroll={{ x: 900 }}` — khi thêm cột Pháp nhân, cột bị chen chật,
text bị wrap xấu.

**Fix:**
```typescript
// Tính tổng minWidth của tất cả cột rồi set x >= tổng đó
scroll={isEmbedded ? undefined : { x: 1300 }}
```

**Quy tắc:** Mỗi lần thêm cột, cộng `minWidth` của cột đó vào `scroll.x`.
Không để mặc định.

---

### 2.4 Thiếu import — hoặc import thừa

**Vấn đề:** Sau khi refactor, còn `import { exportToExcel }` nhưng function
đã bị xóa hoặc thay thế → TypeScript báo lỗi / warning.

**Quy tắc:** Sau mỗi lần refactor, chạy:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "imported"
```
Xóa ngay import thừa trước khi commit.

---

### 2.5 Variable name conflict trong function

**Vấn đề:** Khi thêm state `phapNhanId` (filter), function `handleExportExcel`
đã có `const phapNhanId = phapNhanIds[0]` → shadowing, TypeScript cảnh báo.

**Fix:**
```typescript
// Đổi tên biến local để tránh shadow state bên ngoài
const resolvedPhapNhanId = phapNhanId   // dùng filter state trực tiếp
  ?? (phapNhanIds.length === 1 ? phapNhanIds[0] : undefined)
```

**Quy tắc:** Khi đặt tên state mới, grep file tìm tên đó trước. Nếu đã tồn tại
tên giống ở scope nhỏ hơn → đổi tên scope nhỏ, giữ state ở scope ngoài.

---

### 2.6 Định dạng số tiền không nhất quán

**Vấn đề:** Một số cột dùng `v.toLocaleString('vi-VN') + ' ₫'`, cột khác dùng
`fmtVND(v)` → hiển thị không đồng nhất (có cột có đơn vị, có cột không).

**Fix:**
```typescript
// Chọn một chuẩn duy nhất — dùng fmtVND()
render: (v) => v ? fmtVND(v) : '—',
```

**Quy tắc:** Toàn project dùng `fmtVND()` từ utils. Không dùng `toLocaleString`
trực tiếp. `'—'` khi giá trị null/0.

---

### 2.7 Filter `staleTime` cho lookup data

**Vấn đề:** Danh sách pháp nhân được fetch mỗi lần render (không có staleTime)
→ thừa API call, chậm.

**Fix:**
```typescript
const { data: phapNhanList = [] } = useQuery({
  queryKey: ['phap-nhan-list'],
  queryFn: () => phapNhanApi.list(),
  staleTime: 5 * 60 * 1000,   // cache 5 phút — pháp nhân ít thay đổi
})
```

**Quy tắc:** Data "hiếm thay đổi" (pháp nhân, loại chứng từ, đơn vị...) nên
có `staleTime >= 5 phút`.

---

## 3. Frontend — Detail page

### 3.1 Duplicate JSX — 2 điều kiện render cùng 1 nút

**Vấn đề:** Nút "Sửa" xuất hiện trong 2 điều kiện riêng biệt nhưng render
cùng JSX → nếu logic thay đổi, dễ quên cập nhật một trong hai.

```typescript
// SAI — duplicate
{trangThai === 'moi' && !canApprove && (
  <Button onClick={...}>Sửa</Button>
)}
{(trangThai === 'moi' || trangThai === 'cho_duyet') && canApprove && (
  <Button onClick={...}>Sửa</Button>   // ← cùng JSX
)}

// ĐÚNG — gộp lại
{(trangThai === 'moi' || (trangThai === 'cho_duyet' && canApprove)) && (
  <Button onClick={...}>Sửa</Button>
)}
```

**Quy tắc:** Không có 2 điều kiện render cùng component giống nhau. Luôn gộp
thành 1 điều kiện phức hợp.

---

### 3.2 Dead code — function viết xong không dùng

**Vấn đề:** `buildSummaryHtml` (37 dòng) được viết nhưng UI đã dùng Card-based
component thay thế → function nằm đó không bao giờ được gọi.

**Cách phát hiện:**
```bash
# Grep function name xem có ai gọi không
grep -n "buildSummaryHtml" src/pages/quotes/QuoteDetail.tsx
```

**Fix:** Xóa hoàn toàn. Không comment out.

**Quy tắc:** Sau khi refactor, grep mọi function/constant bị thay thế. Nếu
chỉ còn 1 kết quả (chỗ định nghĩa) → xóa luôn.

---

### 3.3 Prop thừa truyền vào component con

**Vấn đề:** `ItemDetailDrawer` nhận `quoteId` nhưng không dùng. Vẫn được
truyền `quoteId={id}` từ parent → TypeScript chấp nhận nhưng gây nhầm lẫn.

**Fix:**
```typescript
// Xóa khỏi interface
function ItemDetailDrawer({ item, canEdit, hideCostDetails, onClose, onEditClick }: {
  item: QuoteItem | null
  canEdit: boolean
  // quoteId: string  ← xóa
  ...
})

// Xóa khỏi call site
<ItemDetailDrawer
  item={selectedItem}
  canEdit={...}
  // quoteId={id}   ← xóa
/>
```

**Quy tắc:** Interface component không được có prop nào không được đọc bên trong.
Sau refactor, scan lại interface.

---

### 3.4 Permission logic sai ở component con

**Vấn đề:** Parent cho phép `canApprove` user edit quote ở trạng thái `cho_duyet`,
nhưng khi mở drawer con lại truyền `canEdit={trangThai === 'moi'}` → user
không edit được dù có quyền.

**Fix:**
```typescript
// Phải khớp với điều kiện hiển thị nút Sửa ở parent
canEdit={trangThai === 'moi' || (trangThai === 'cho_duyet' && canApprove)}
```

**Quy tắc:** Logic quyền phải nhất quán giữa parent và con. Tạo biến
`const canEditQuote = ...` ở level trên, truyền xuống — đừng tính lại trong con.

---

### 3.5 Loading state cho async action quan trọng

**Vấn đề:** Nút "In" gọi API fetch template + render nhưng không có loading state
→ user bấm nhiều lần, nhiều popup mở.

**Fix:**
```typescript
const [isPrintLoading, setIsPrintLoading] = useState(false)

const handlePrint = async () => {
  setIsPrintLoading(true)
  try {
    const result = await fetchTemplate('in')
    if (!result) return
    printDocument(buildQuotePrintOpts(result.templateCols, result.template))
  } finally {
    setIsPrintLoading(false)   // luôn reset dù có lỗi
  }
}

// Truyền vào button
<Button loading={isPrintLoading} onClick={handlePrint}>In</Button>
```

**Quy tắc:** Mọi async action từ button (submit, print, export, confirm...) phải có:
- State loading riêng
- `try/finally` để reset state dù thành công hay lỗi
- `loading={...}` trên button

---

### 3.6 Zero-value rows trong cost summary

**Vấn đề:** Khi `chi_phi_bang_in = 0` hoặc `tien_vat = 0`, dòng vẫn hiển thị
"0 đ" → lộn xộn, không cần thiết.

**Fix:**
```typescript
{quote.chi_phi_bang_in > 0 && (
  <Row>
    <Col span={14}>CP Bảng in</Col>
    <Col span={10}>{vnd(quote.chi_phi_bang_in)} đ</Col>
  </Row>
)}
{quote.tien_vat > 0 && (
  <Row>
    <Col span={14}>Thuế VAT ({quote.ty_le_vat}%)</Col>
    <Col span={10}>{vnd(quote.tien_vat)} đ</Col>
  </Row>
)}
```

**Quy tắc:** Fields "tuỳ chọn" (phụ phí, VAT, giảm giá...) chỉ hiển thị khi
giá trị > 0. Luôn ẩn dòng 0 đồng.

---

### 3.7 Action buttons bị tràn ra màn hình hẹp

**Vấn đề:** Nhiều button đặt trong `<div style={{ display: 'flex', gap: 8 }}>`
→ trên màn hình nhỏ hoặc khi label dài, buttons tràn ra ngoài.

**Fix:**
```typescript
// Dùng Space wrap thay div flex
<Space wrap>
  <Button>In</Button>
  <Button>Tải PDF</Button>
  <Button>Duyệt</Button>
  ...
</Space>
```

**Quy tắc:** Action buttons trên detail page luôn dùng `<Space wrap>`.
Không dùng `flex` thuần khi số button > 3.

---

### 3.8 Deprecated Ant Design props

**Vấn đề:** `destroyOnClose` (trên `<Drawer>`) deprecated từ AntD v5.x → warning console.

**Fix:**
```typescript
// SAI
<Drawer destroyOnClose ...>

// ĐÚNG
<Drawer destroyOnHidden ...>
```

**Bảng deprecated props thường gặp (AntD v5):**

| Component | Prop cũ | Prop mới |
|---|---|---|
| `Drawer` | `destroyOnClose` | `destroyOnHidden` |
| `Modal` | `destroyOnClose` | `destroyOnHidden` |
| `Select` | `dropdownMatchSelectWidth` | `popupMatchSelectWidth` |

**Quy tắc:** Khi mở file có component AntD, check console warnings. Fix ngay,
không để tích luỹ.

---

### 3.9 Extract shared logic — tránh copy-paste giữa handlers

**Vấn đề:** `handlePrint` và `handleDownloadPdf` có ~20 dòng logic giống nhau
(fetch template, validate, build options) → nếu sửa một chỗ hay quên chỗ kia.

**Fix — extract helper:**
```typescript
// Hàm thuần — không có side effect, dễ test
function buildQuotePrintOpts(templateCols: string[], template: PrintTemplate): PrintDocumentOptions {
  return {
    template,
    columns: templateCols,
    items: quote?.items ?? [],
    ...
  }
}

async function fetchTemplate(mode: 'in' | 'pdf') {
  const cols = await quotesApi.getTemplateCols(id)
  const template = await printTemplateApi.getDefault(docType)
  if (!template) { message.error('Chưa có template'); return null }
  return { templateCols: cols, template }
}

// Dùng chung
const handlePrint = async () => {
  const result = await fetchTemplate('in')
  if (!result) return
  printDocument(buildQuotePrintOpts(result.templateCols, result.template))
}

const handleDownloadPdf = async () => {
  const result = await fetchTemplate('pdf')
  if (!result) return
  downloadPdf(buildQuotePrintOpts(result.templateCols, result.template))
}
```

**Quy tắc:** Nếu 2 handlers có > 5 dòng logic giống nhau → extract ra function riêng.

---

## 4. Checklist tổng hợp

Copy checklist này khi bắt đầu hoàn thiện một page mới.

### Backend

```
□ Tất cả FK relation dùng trong response đều có joinedload()
□ Mỗi filter trên UI có query param tương ứng ở backend
□ Schema list item chứa đủ field để render bảng + export (không thiếu, không thừa)
□ Filter params có default=None, không bắt buộc
```

### Frontend — List page

```
□ sessionStorage deps bao gồm TẤT CẢ filter states
□ emptyText OR tất cả filter states
□ scroll.x >= tổng minWidth tất cả cột
□ staleTime cho lookup data (pháp nhân, category...)
□ Không có tên biến shadow state bên ngoài
□ Tất cả cột số tiền dùng fmtVND(), không dùng toLocaleString trực tiếp
□ Import không có unused (chạy tsc --noEmit)
□ Filter Select có showSearch nếu có > 5 options
□ Phân trang: reset page về 1 khi filter thay đổi
```

### Frontend — Detail page

```
□ Không có 2 điều kiện render cùng JSX — gộp thành 1
□ Không có function/constant chưa dùng — grep trước khi commit
□ Không có prop thừa trong interface component con
□ Logic quyền nhất quán parent ↔ con — dùng biến chung
□ Mọi async button có loading state + try/finally
□ Zero-value rows trong summary bị ẩn (> 0 mới hiện)
□ Action buttons dùng <Space wrap> nếu > 3 nút
□ Không có deprecated AntD props (destroyOnClose → destroyOnHidden...)
□ Handler có logic chung > 5 dòng → extract helper function
□ Drawer/Modal có destroyOnHidden để tránh stale state
```

### Sau khi hoàn thiện

```
□ npx tsc --noEmit — 0 lỗi mới
□ Reload trang — filter state được restore đúng
□ Màn hình hẹp (1024px) — buttons không tràn
□ Dữ liệu null/0 hiển thị '—' hoặc bị ẩn (không hiển thị 'undefined' hay '0 đ')
□ Commit message: "refactor: [page] — [tóm tắt WHY]"
```

---

## Bài học rút ra theo vòng cải tiến

| Vòng | Vấn đề chính | Số lỗi sửa |
|---|---|---|
| Round 6 | Tính năng mới: filter pháp nhân, export Excel, refactor print | 6 |
| Round 7 | UX: loading state, canEdit bug, cost summary, responsive | 8 |
| Final | Code quality: dead code, unused props, deprecated API | 4 |
| **Tổng** | | **18 lỗi** |

**Nhận xét:** ~60% lỗi là code quality (dead code, duplicate, inconsistent format).
Những lỗi này dễ phát hiện bằng grep + TypeScript check — nên chạy trước khi
kết thúc bất kỳ feature nào.

---

*Tài liệu này được tổng hợp sau khi hoàn thiện QuoteList + QuoteDetail lên 10/10.*
*Cập nhật khi phát hiện pattern mới trong quá trình làm page khác.*
