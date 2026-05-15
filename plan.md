# Plan: Báo giá UI — Round 6
Date: 2026-05-15
Status: COMPLETED

## Mục tiêu
4 bước cải thiện trang báo giá:
1. Backend + frontend: thêm filter pháp nhân cho danh sách báo giá
2. QuoteList: hiển thị cột pháp nhân, tự động điền khi export Excel
3. QuoteDetail: gộp nút Sửa trùng lặp, thêm wrap cho action bar
4. QuoteDetail: rút gọn handlePrint/handleDownloadPdf bằng hàm dùng chung

## Các bước thực thi

- [x] Bước 1: Backend — thêm phap_nhan_id vào QuoteListItem schema + list filter
  - File: `backend/app/schemas/quotes.py` dòng 248–262
  - Thêm `phap_nhan_id: int | None = None` và `ten_phap_nhan: str | None = None` vào QuoteListItem
  - File: `backend/app/routers/quotes.py` dòng 383–414
  - Thêm `phap_nhan_id: int | None = Query(default=None)` → `q = q.filter(Quote.phap_nhan_id == phap_nhan_id)`
  - Thêm `ten_phap_nhan=qt.phap_nhan.ten_phap_nhan if qt.phap_nhan else None` khi tạo QuoteListItem
  - Thêm `joinedload(Quote.phap_nhan)` vào query options

- [x] Bước 2: Frontend API — cập nhật types và list params
  - File: `frontend/src/api/quotes.ts`
  - Thêm `phap_nhan_id?: number | null` và `ten_phap_nhan?: string | null` vào type `QuoteListItem`
  - Thêm `phap_nhan_id?: number` vào params của `quotesApi.list()`

- [x] Bước 3: QuoteList — thêm filter pháp nhân + cột + auto-fill export
  - File: `frontend/src/pages/quotes/QuoteList.tsx`
  - Thêm state `const [phapNhanId, setPhapNhanId] = useState<number | undefined>()`
  - Thêm useQuery load danh sách pháp nhân
  - Thêm Select filter pháp nhân vào filter bar (sau Select trạng thái)
  - Thêm cột "Pháp nhân" vào fullColumns (width 130, sau cột Người lập)
  - Truyền `phap_nhan_id: phapNhanId` vào quotesApi.list()
  - Thêm phapNhanId vào queryKey và sessionStorage
  - Fix handleExportExcel: nếu phapNhanId đã được chọn thì bỏ qua kiểm tra multi-phap-nhan

- [x] Bước 4: QuoteDetail — gộp Sửa trùng + wrap action bar + extract buildQuotePrintOpts()
  - File: `frontend/src/pages/quotes/QuoteDetail.tsx`
  - Gộp 2 điều kiện Sửa (dòng 754–771) thành 1 điều kiện: `trangThai === 'moi' || (trangThai === 'cho_duyet' && canApprove)`
  - Thêm `wrap` vào `<Space>` chứa action buttons (dòng 753)
  - Extract `buildQuotePrintOpts(quote, companyInfo, templateCols, template)` → return `PrintDocumentOptions`
  - Dùng hàm trên trong cả handlePrint và handleDownloadPdf

## Done Criteria
- [ ] QuoteList có Select "Pháp nhân" trong filter bar, danh sách lọc được theo pháp nhân
- [ ] Cột "Pháp nhân" hiện trong fullColumns của QuoteList
- [ ] Export Excel tự động dùng phap_nhan đã chọn trong filter thay vì báo lỗi
- [ ] QuoteDetail: nút Sửa chỉ render 1 lần
- [ ] QuoteDetail: action buttons wrap khi hẹp
- [ ] TypeScript: 0 lỗi mới
- [ ] Backend: `GET /quotes?phap_nhan_id=1` trả về đúng kết quả

## Rủi ro
- Bước 1: cần `joinedload(Quote.phap_nhan)` — phải kiểm tra relationship tên đúng trong models
- Bước 4 (extract): không thay đổi hành vi, chỉ tổ chức lại code
