# Checklist import/export ERP Nam Phuong

> Cap nhat: 2026-05-08  
> Muc tieu: chuan hoa import/export cho toan bo ERP, uu tien du lieu go-live va chung tu can in/doi soat.
> Da trien khai dot 1: khung import dung chung + import khach hang, nha cung cap, san pham.  
> Da trien khai dot 2: import nhom vat tu, vat tu giay, vat tu phu.
> Da trien khai dot 3: import toan bo danh muc con lai (don vi tinh, kho, vi tri, phap nhan, phan xuong, xe, tai xe, tinh thanh, phuong xa, don gia van chuyen, tai khoan ngan hang).
> Da trien khai dot 4: import ton kho dau ky + so du dau ky AR/AP; export Excel/Print cho: so quy, so ngan hang, tra hang ban, tra hang NCC, hoan tien KH, phieu nhap/xuat/chuyen kho/kiem ke, bao cao mua hang.
> Da trien khai dot 5: import so du quy tien mat (OpeningBalance doi_tuong=quy_tien_mat); the kho / lich su XNT (trang /warehouse/the-kho); export Excel + In PDF cho the kho; hoa don mua hang PDF.
> Da trien khai dot 6: export Excel yeu cau giao hang + phieu ban hang; in phieu tra hang ban + phieu nhap kho hang tra; in credit note/bien ban can tru; in bao gia chi tiet PDF gui khach.
> Da trien khai dot 7 (phap nhan vao mau in): Mo rong PrintDocumentOptions.companyInfo (dia_chi/MST/SDT/TK ngan hang); tao hook usePhapNhan.ts; da cap nhat CashReceiptDetailPage + CashPaymentDetailPage + SalesReturnDetail (2 nut in) + CustomerRefundDetailPage.
> Da trien khai dot 8 (Trung tam Bao cao & Gia thanh): Redesign Dashboard & Reporting Hub; hach toan nhanh theo mau (luong, khau hao, chi phi); bao cao Gia thanh thuc te; quan ly tai san & khau hao xuong.

## Nguyen tac chung

- [x] Moi man danh sach co `Export Excel` theo dung bo loc hien tai.
- [ ] Moi chung tu co mau `In/PDF` thong nhat: logo, phap nhan, so chung tu, ngay, nguoi lap, nguoi duyet, chu ky.
  - [x] PrintDocumentOptions mo rong companyInfo (ten/dia_chi/MST/SDT/TK ngan hang) + buildDocumentHtml render day du.
  - [x] Hook usePhapNhan.ts: usePhapNhanList() + usePhapNhanForPrint(id?) — fallback phap nhan default.
  - [x] CashReceiptDetailPage, CashPaymentDetailPage, SalesReturnDetail, CustomerRefundDetailPage — da dung companyInfo.
  - [ ] QuoteDetail.tsx (buildQuoteHtml rieng) — can cap nhat ten_phap_nhan + dia_chi/MST/SDT.
  - [ ] Phieu kho (nhap/xuat/chuyen/dieu chinh) — chua co phap nhan.
  - [ ] Phieu giao hang (GiaoHangPage) — chua co phap nhan.
- [x] Moi import co file mau, upload, preview, validate, dong loi, xac nhan ghi du lieu.
- [x] Import khong ghi truc tiep khi con loi bat buoc.
- [x] Luu lich su import: nguoi import, thoi gian, loai du lieu, file goc, so dong thanh cong/loi. (ImportHistoryPage)
- [x] Co nut tai file loi Excel de nguoi dung sua lai. (Trong modal preview import)
- [ ] Co phan quyen rieng cho import/export theo module.

## P0 - Nen tang dung chung

- [x] Tao backend service import dung chung: doc Excel, map cot, validate, tra ket qua preview.
- [ ] Tao backend bang/nhat ky import neu can audit rieng.
- [x] Tao frontend component `ImportExcelButton` dung chung.
- [x] Tao frontend modal import: tai mau, chon file, preview, hien loi, xac nhan import.
- [x] Tao utility export thong nhat ten file, tieu de, bo loc, ngay xuat.
- [x] Chuan hoa mau in/PDF dung chung cho danh sach va chung tu (PrintDocumentOptions).
- [ ] Bo sung permission: master.import, inventory.import, accounting.import, sales.import, purchase.import, report.export.

## P1 - Import du lieu go-live

### Danh muc

- [x] Import khach hang.
- [x] Import nha cung cap.
- [x] Import san pham thanh pham.
- [x] Import vat tu giay.
- [x] Import vat tu phu.
- [x] Import nhom vat tu.
- [x] Import don vi tinh.
- [x] Import kho.
- [x] Import vi tri kho.
- [x] Import phap nhan.
- [x] Import phan xuong.
- [x] Import xe.
- [x] Import tai xe (khoa upsert: so dien thoai).
- [x] Import tinh/thanh.
- [x] Import phuong/xa (co resolver tim tinh theo ma_tinh).
- [x] Import don gia van chuyen.
- [x] Import tai khoan ngan hang.
- [ ] Import chi phi gian tiep (dung /seed de reset, khong can import Excel).
- [ ] Import he so phu phi/addon rate (dung /seed de reset, khong can import Excel).

### So du dau ky

- [x] Import ton kho dau ky theo kho, vat tu/san pham (GET /api/warehouse/ton-kho/import-template, POST /api/warehouse/ton-kho/import).
- [x] Import cong no phai thu dau ky theo khach hang (GET /api/accounting/opening-balances/template-ar, POST /import-ar).
- [x] Import cong no phai tra dau ky theo nha cung cap (GET /api/accounting/opening-balances/template-ap, POST /import-ap).
- [x] Import so du quy tien mat (GET/POST /api/accounting/opening-balances/cash/import-template|import; nut Import so du tren CashBookPage).
- [x] Import so du tai khoan ngan hang (da co trong BankAccountList.tsx qua /api/bank-accounts/import-template|import; cot so_du_dau trong file mau).
- [x] Import CCDC dau ky (GET/POST /api/ccdc/import-template|import; nut Import CCDC trong CCDCListPage.tsx).
- [x] Import Tai san co dinh (WorkshopManagement.tsx - Tab Khau hao).
- [x] Import Bang luong phan xuong (WorkshopManagement.tsx - Tab Bang luong).

## P1 - Export/In can hoan thien som

### Ban hang

- [x] Bao gia chi tiet: mau PDF gui khach co logo/phap nhan.
- [x] Don ban hang: export chi tiet + PDF chung tu.
- [x] Yeu cau giao hang/giao hang: export theo ngay, khach hang, xe, tai xe.
- [x] Phieu giao hang: in/PDF chuan.
- [x] Tra hang ban: export danh sach Excel (SalesReturnsPage).
- [x] Tra hang ban: in phieu tra hang.
- [x] Tra hang ban: in phieu nhap lai kho.
- [x] Tra hang ban/hoan tien: in credit note/bien ban can tru.

### Ke toan

- [x] Hoa don ban hang: export danh sach + PDF chi tiet.
- [x] Phieu thu: export danh sach + PDF chi tiet.
- [x] Phieu chi: export danh sach + PDF chi tiet.
- [x] So cong no phai thu: Excel + PDF theo bo loc.
- [x] So cong no phai tra: Excel + PDF theo bo loc.
- [x] Tuoi no phai thu/phai tra: Excel + PDF.
- [x] So quy tien mat: Excel (CashBookPage - nut Xuat Excel).
- [x] So ngan hang: Excel (BankLedgerPage - nut Xuat Excel).
- [x] Phieu hoan tien khach hang: export danh sach Excel (CustomerRefundListPage).

### Kho

- [x] Ton kho hien tai: Excel + PDF theo bo loc.
- [x] The kho: Excel + PDF (InventoryCardPage.tsx tai /warehouse/the-kho, dung endpoint /giao-dich voi ten_hang/ten_kho).
- [x] Lich su nhap/xuat/ton: Excel (cung trong InventoryCardPage.tsx, xuat theo bo loc).
- [x] Phieu nhap kho: PDF (nut In tren tung dong) + Excel danh sach (ReceiptsPage).
- [x] Phieu xuat NVL san xuat: PDF (nut In tren tung dong) + Excel danh sach (IssuesPage).
- [x] Phieu chuyen kho: PDF (nut In tren tung dong) + Excel danh sach (TransfersPage).
- [x] Phieu dieu chinh / Bien ban kiem ke: PDF (nut In) + Excel chi tiet (StockAdjustmentsPage).

### Mua hang

- [x] Don mua hang: export danh sach + PDF.
- [x] Hoa don mua hang: export danh sach + PDF (PurchaseInvoiceDetailPage co nut In PDF).
- [x] Tra hang nha cung cap: export danh sach Excel (PurchaseReturnPage).
- [x] Bao cao mua hang: Excel + PDF (SoChiTietTab trong PurchaseReportPage).

## P2 - Import nghiep vu co kiem soat

- [ ] Import don ban hang tu file mau, co preview ton tai khach hang/san pham/gia.
- [ ] Import don mua hang tu file mau, co preview NCC/vat tu/don gia.
- [ ] Import bang kiem ke kho de tao phieu dieu chinh.
- [ ] Import sao ke ngan hang de doi soat phieu thu/chi.
- [ ] Import BOM/dinh muc san pham.
- [ ] Import ke hoach san xuat tu Excel.
- [ ] Import bang san luong CD2/scan neu co du lieu tu may hoac file ngoai.

## P2 - Export bao cao quan tri

- [x] Bao cao doanh thu: Excel + PDF. (RevenueReportPage)
- [x] Bao cao cong no tong hop: Excel + PDF. (DebtSummaryPage)
- [x] Bao cao XNT kho: Excel + PDF. (InventoryReportPage)
- [x] Bao cao mua hang theo NCC/vat tu/ky: Excel + PDF. (PurchaseReportPage)
- [x] Bao cao Gia thanh san xuat (Thuc te vs Dinh muc): Excel. (ProductionCostingPage)
- [x] Bao cao Lai lo phan xuong: Excel. (WorkshopPNLPage)
- [x] Bao cao Thue GTGT & Bang CDPS Thue: Excel. (VATSummaryPage, TaxTrialBalancePage)
- [ ] Bao cao nang suat san xuat theo lenh/may/cong doan: Excel.
- [ ] Bao cao tien do don hang: Excel.
- [ ] Bao cao loi/huy/hao hut san xuat: Excel.
- [ ] Bao cao van chuyen theo xe/tai xe/tuyen: Excel.

## P3 - Tich hop va nang cao

- [ ] API export du lieu cho BI/Power BI neu can.
- [ ] Lich export tu dong gui email cho cong no/doanh thu/ton kho.
- [ ] Import tu Google Sheet/OneDrive neu van hanh thuc te can.
- [ ] Doi soat ngan hang ban tu dong tu sao ke.
- [ ] Mau in theo tung phap nhan/chi nhanh.

## Tieu chi nghiem thu import

- [ ] File mau co day du cot bat buoc va cot tuy chon.
- [ ] He thong phat hien trung ma, thieu ma, sai kieu du lieu, sai ngay, sai tien, sai don vi.
- [ ] Loi hien theo tung dong/tung cot.
- [ ] Import thanh cong co thong bao so dong tao moi/cap nhat/bo qua.
- [ ] Co rollback hoac khong commit khi loi nghiem trong.
- [ ] Du lieu import xong xem duoc ngay o man danh sach.
- [ ] Co log nguoi thuc hien va thoi diem.

## Tieu chi nghiem thu export/in

- [ ] Export dung bo loc dang xem.
- [ ] File co ten ro nghiep vu va ngay xuat.
- [ ] Cot tien/so luong/ngay thang dung dinh dang.
- [ ] PDF/in khong tran bang, khong mat cot quan trong.
- [ ] Chung tu co thong tin phap nhan va khu vuc chu ky.
- [ ] Man co du lieu rong khong bi loi khi export.

## Thu tu lam de de kiem soat

1. Hoan thien khung import/export dung chung.
2. Lam import danh muc: khach hang, NCC, san pham, vat tu.
3. Lam import so du dau ky: ton kho, AR, AP, quy, ngan hang.
4. Hoan thien export/in cho tra hang hoan tien.
5. Bo sung export cho so quy, so ngan hang, the kho, chung tu kho.
6. Lam import nghiep vu co preview: don ban, don mua, kiem ke, sao ke ngan hang.
7. Xay dung Trung tam bao cao, redesign Dashboard va trien khai bao cao Gia thanh thuc te.
