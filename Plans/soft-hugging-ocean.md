# Plan: Bổ sung 4 nghiệp vụ kế toán Tiền gửi

## Context

Module Tiền gửi hiện có Thu/Chi tiền và Sổ tiền gửi đầy đủ. Năm nghiệp vụ còn thiếu hoặc stub:
- `BankReconciliationPage` → stub "Tính năng đang phát triển"
- Khế ước đi vay / Khế ước cho vay → không có model, không có UI
- Dự báo dòng tiền → chỉ có báo cáo lịch sử, không có dự báo tương lai
- Ngân hàng điện tử → chưa có trang import sao kê
- Tính tỷ giá xuất quỹ → chưa có tiện ích

Infrastructure sẵn có: `BankTransaction` model có đủ field matching (`matched_chung_tu_loai/id`), import endpoint đã có trong `bank_accounts.py`, cashflow report endpoints đã có.

---

## Phạm vi thực hiện

**4 deliverables:**
1. Đối chiếu ngân hàng — hoàn thiện stub thành UI thực
2. Khế ước đi vay — model + API + list page + lịch trả nợ
3. Khế ước cho vay — model + API + list page
4. Dự báo dòng tiền — forecast endpoint + page với chart

---

## Phase 1 — Backend Models

**File:** `backend/app/models/accounting.py` — append 3 classes

```python
class KheUocVay(Base):
    __tablename__ = "khe_uoc_vay"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_khe_uoc: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    ngay_ky: Mapped[date] = mapped_column(Date, nullable=False)
    ngay_hieu_luc: Mapped[date] = mapped_column(Date, nullable=False)
    ngay_ket_thuc: Mapped[date] = mapped_column(Date, nullable=False)
    to_chuc_cho_vay: Mapped[str] = mapped_column(String(200), nullable=False)  # Tên tổ chức cho vay
    so_tien_vay: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    lai_suat: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False)   # %/năm
    ky_tinh_lai: Mapped[str] = mapped_column(String(10), default="thang")      # thang/quy/nam
    phuong_thuc_tra: Mapped[str] = mapped_column(String(20), default="goc_deu")  # goc_deu / gop_deu / cuoi_ky
    tai_khoan_nhan: Mapped[str] = mapped_column(String(20), nullable=True)     # TK Nợ nhận tiền vay
    tai_san_the_chap: Mapped[str | None] = mapped_column(Text, nullable=True)
    ghi_chu: Mapped[str | None] = mapped_column(Text, nullable=True)
    trang_thai: Mapped[str] = mapped_column(String(20), default="hieu_luc", index=True)  # hieu_luc/da_tra/huy
    phap_nhan_id: Mapped[int | None] = mapped_column(ForeignKey("phap_nhan.id"), nullable=True, index=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class KheUocChoVay(Base):
    __tablename__ = "khe_uoc_cho_vay"
    # Tương tự KheUocVay nhưng to_chuc_di_vay (bên vay từ mình)
    # + customer_id (nullable, nếu là khách hàng)
    id, so_khe_uoc, ngay_ky, ngay_hieu_luc, ngay_ket_thuc,
    to_chuc_di_vay, customer_id (FK customers.id nullable),
    so_tien_cho_vay, lai_suat, ky_tinh_lai, phuong_thuc_tra,
    tai_san_the_chap, ghi_chu, trang_thai, phap_nhan_id, created_by, created_at

class LichTraNo(Base):
    __tablename__ = "lich_tra_no"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    loai_khe_uoc: Mapped[str] = mapped_column(String(10))   # "di_vay" | "cho_vay"
    khe_uoc_id: Mapped[int] = mapped_column(Integer, index=True)
    ky_so: Mapped[int] = mapped_column(Integer)              # kỳ 1, 2, 3...
    ngay_den_han: Mapped[date] = mapped_column(Date, index=True)
    so_tien_goc: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    so_tien_lai: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    tong_cong: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    trang_thai: Mapped[str] = mapped_column(String(20), default="chua_tra")  # chua_tra/da_tra/qua_han
    ngay_tra_thuc: Mapped[date | None] = mapped_column(Date, nullable=True)
    so_tien_tra_thuc: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
```

**Số khế ước:** `KUV-YYYYMMDD-XXX` (vay) / `KUC-YYYYMMDD-XXX` (cho vay)

---

## Phase 2 — Backend Schemas

**File:** `backend/app/schemas/accounting.py` — append

```python
class KheUocVayCreate(BaseModel):
    ngay_ky: date; ngay_hieu_luc: date; ngay_ket_thuc: date
    to_chuc_cho_vay: str; so_tien_vay: Decimal; lai_suat: Decimal
    ky_tinh_lai: Literal["thang", "quy", "nam"] = "thang"
    phuong_thuc_tra: Literal["goc_deu", "gop_deu", "cuoi_ky"] = "gop_deu"
    phap_nhan_id: int | None = None; ghi_chu: str | None = None

class KheUocVayResponse(BaseModel):
    id: int; so_khe_uoc: str; ngay_ky: date; ngay_hieu_luc: date; ngay_ket_thuc: date
    to_chuc_cho_vay: str; so_tien_vay: Decimal; lai_suat: Decimal
    trang_thai: str; lich_tra: list[LichTraNoResponse] = []
    model_config = {"from_attributes": True}

class LichTraNoResponse(BaseModel):
    id: int; ky_so: int; ngay_den_han: date
    so_tien_goc: Decimal; so_tien_lai: Decimal; tong_cong: Decimal
    trang_thai: str; ngay_tra_thuc: date | None = None
    model_config = {"from_attributes": True}

# Tương tự KheUocChoVayCreate / KheUocChoVayResponse
```

---

## Phase 3 — Backend Endpoints

**File:** `backend/app/routers/accounting.py` — append vào cuối file

### Khế ước đi vay (8 endpoints)
```
GET  /api/accounting/khe-uoc-vay                    — list (filter: trang_thai, phap_nhan_id)
POST /api/accounting/khe-uoc-vay                    — create, auto-gen so_khe_uoc
GET  /api/accounting/khe-uoc-vay/{id}               — detail + lich_tra
PUT  /api/accounting/khe-uoc-vay/{id}               — update (chỉ khi trang_thai=hieu_luc)
POST /api/accounting/khe-uoc-vay/{id}/generate-schedule  — sinh lịch trả nợ
DELETE /api/accounting/khe-uoc-vay/{id}/schedule    — xóa lịch (để regenerate)
PATCH /api/accounting/khe-uoc-vay/{id}/tra-no       — đánh dấu đã trả kỳ k
PATCH /api/accounting/khe-uoc-vay/{id}/ket-thuc     — kết thúc khế ước
```

### Khế ước cho vay (tương tự, prefix `/khe-uoc-cho-vay`)

### Dự báo dòng tiền
```
GET /api/accounting/cash-flow/forecast
    ?days=30&phap_nhan_id=X
```
Logic aggregate:
- **Thu sắp tới:** CashReceipt[trang_thai='cho_duyet'] trong `days` ngày tới
- **Chi sắp tới:** CashPayment[trang_thai='cho_chot'] trong `days` ngày tới
- **Trả nợ sắp đến hạn:** LichTraNo[trang_thai='chua_tra', ngay_den_han <= today+days]
- **Thu nợ cho vay:** LichTraNo[loai='cho_vay', trang_thai='chua_tra', ngay_den_han <= today+days]
- Group by ngày, return array: `[{ngay, thu, chi, tra_no, thu_no, net, luy_ke}]`

### Schedule generation logic
```python
def generate_schedule(so_tien, lai_suat_nam, ky_tinh_lai, phuong_thuc_tra, ngay_hieu_luc, ngay_ket_thuc):
    r = lai_suat_nam / 100 / (12 if ky_tinh_lai=="thang" else 4 if ky_tinh_lai=="quy" else 1)
    n = số kỳ (tính từ ngay_hieu_luc đến ngay_ket_thuc theo ky_tinh_lai)

    if phuong_thuc_tra == "gop_deu":  # annuity — góp đều
        M = P * r * (1+r)^n / ((1+r)^n - 1)
        each period: lai = remaining * r; goc = M - lai; remaining -= goc

    elif phuong_thuc_tra == "goc_deu":  # equal principal
        goc = P / n
        each period: lai = remaining * r; total = goc + lai

    elif phuong_thuc_tra == "cuoi_ky":  # bullet
        each period (except last): tong = P * r (chỉ lãi)
        last period: tong = P + P * r
```

---

## Phase 4 — Frontend Pages (6 files)

### 4.1 BankReconciliationPage.tsx — Hoàn thiện stub
**Route:** `/accounting/bank-reconciliation` (đã có trong App.tsx)

Layout 2 cột (Col 12 / Col 12):
- **Trái:** `Table` sao kê ngân hàng (`GET /api/accounting/bank-transactions?trang_thai=chua_doi_soat`)
  - Columns: ngày, mô tả, thu, chi, trạng thái
  - Row highlight nếu đang selected
- **Phải:** `Table` phiếu thu/chi nội bộ chưa đối soát
  - `GET /api/accounting/cash-receipts?trang_thai=da_duyet&chua_khop=true`
- **Actions:** Chọn 1 dòng mỗi bên → nút "Khớp" (POST `/api/accounting/bank-transactions/{id}/match`)
- **Summary Card:** Tổng sao kê / Tổng nội bộ / Chênh lệch (số đỏ nếu ≠ 0)
- Filter: DatePicker range + BankAccount select

### 4.2 KheUocVayPage.tsx
**Route:** `/accounting/khe-uoc-vay`

**Layout:**
- Filter bar: trang_thai, phap_nhan_id, date range
- Table: so_khe_uoc | to_chuc_cho_vay | so_tien_vay | lai_suat | ngay_ket_thuc | trang_thai | actions
- Click row → Drawer detail với 2 tabs:
  - Tab "Thông tin": fields của khế ước
  - Tab "Lịch trả nợ": Table lich_tra + nút "Sinh lịch" + nút "Đánh dấu đã trả"
- Modal create/edit

### 4.3 KheUocChoVayPage.tsx
**Route:** `/accounting/khe-uoc-cho-vay`
- Tương tự KheUocVayPage, đổi "to_chuc_cho_vay" → "to_chuc_di_vay"

### 4.4 DuBaoDongTienPage.tsx
**Route:** `/accounting/du-bao-dong-tien`

**Layout:**
- Top: Select pháp nhân + Radio "7 ngày / 14 ngày / 30 ngày / 60 ngày"
- Chart (recharts `ComposedChart`): Bar thu + Bar chi + Line lũy kế tồn quỹ
- Table bên dưới: ngày | thu | chi | trả nợ | thu nợ | net | lũy kế
- Row highlight đỏ nếu lũy kế < 0 (cảnh báo âm quỹ)

API: `GET /api/accounting/cash-flow/forecast?days=30&phap_nhan_id=X`

---

## Phase 5 — Wiring

### App.tsx — thêm lazy imports + routes
```tsx
const KheUocVayPage     = lazy(() => import('./pages/accounting/KheUocVayPage'))
const KheUocChoVayPage  = lazy(() => import('./pages/accounting/KheUocChoVayPage'))
const DuBaoDongTienPage = lazy(() => import('./pages/accounting/DuBaoDongTienPage'))
// Routes (nằm trong /accounting/* block):
<Route path="accounting/khe-uoc-vay"       element={<KheUocVayPage />} />
<Route path="accounting/khe-uoc-cho-vay"   element={<KheUocChoVayPage />} />
<Route path="accounting/du-bao-dong-tien"  element={<DuBaoDongTienPage />} />
```

### AccountingHubPage.tsx — update nhóm "Tiền gửi"
Thêm vào nhóm "Tiền gửi" (hoặc tạo nhóm mới nếu cần):
```
{ icon: '🔄', label: 'Đối chiếu ngân hàng',  to: '/accounting/bank-reconciliation' }
{ icon: '📈', label: 'Dự báo dòng tiền', to: '/accounting/du-bao-dong-tien' }
{ icon: '📋', label: 'Khế ước đi vay',  to: '/accounting/khe-uoc-vay' }
{ icon: '💼', label: 'Khế ước cho vay', to: '/accounting/khe-uoc-cho-vay' }
```

### main.py — KHÔNG cần thay đổi
Tất cả endpoint mới đều thêm vào `accounting.router` (đã mount sẵn).

---

## Thứ tự thực hiện

```
1. models/accounting.py    — KheUocVay, KheUocChoVay, LichTraNo
2. schemas/accounting.py   — Pydantic schemas
3. routers/accounting.py   — Endpoints khe_uoc + forecast
4. BankReconciliationPage  — Complete stub
5. KheUocVayPage           — List + drawer + schedule tab
6. KheUocChoVayPage        — List + drawer
7. DuBaoDongTienPage       — Forecast chart
8. App.tsx + AccountingHubPage — Wire routes + menu
```

Bước 1-3 chạy tuần tự (models trước, schemas sau, routers cuối).
Bước 4-10 chạy song song (frontend độc lập nhau).

---

## Verification

```bash
# Backend server đang chạy ở port 8001
# Lấy token:
TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Test khe uoc vay
curl http://localhost:8001/api/accounting/khe-uoc-vay -H "Authorization: Bearer $TOKEN"
# Expected: [] hoặc danh sách

# Test forecast
curl "http://localhost:8001/api/accounting/cash-flow/forecast?days=30" \
  -H "Authorization: Bearer $TOKEN"
# Expected: [{ngay, thu, chi, net, luy_ke}...]

# Test bank reconciliation endpoint
curl http://localhost:8001/api/accounting/bank-transactions?trang_thai=chua_doi_soat \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 + list

# Frontend: mở http://localhost:5173
# /accounting/bank-reconciliation — phải thấy 2 bảng, không phải stub
# /accounting/khe-uoc-vay        — phải thấy list table + nút Tạo mới
# /accounting/du-bao-dong-tien   — phải thấy chart + period selector
```
