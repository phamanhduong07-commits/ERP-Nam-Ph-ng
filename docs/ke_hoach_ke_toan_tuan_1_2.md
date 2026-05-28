# Ke hoach hoan thien module ke toan - Tuan 1-2

## Muc tieu

Hoan thien nen tang ke toan loi de cac nghiep vu ban hang, mua hang, kho, san xuat, thu chi va hoa don co the tu dong sinh but toan dung, truy vet duoc nguon chung tu va len duoc cac bao cao co ban.

Trong 2 tuan nay chua tap trung vao bao cao nang cao hay gia thanh chi tiet. Muc tieu chinh la lam chac 3 lop nen:

1. He thong tai khoan ke toan.
2. So cai va but toan kep.
3. Chung tu ke toan va quy trinh duyet/huy.

## Pham vi

### Lam trong giai doan nay

- Chuan hoa danh muc tai khoan ke toan theo VAS.
- Kiem tra va bo sung rang buoc but toan No/Co.
- Chuan hoa so chung tu ke toan.
- Hoan thien luong tao, duyet, huy chung tu.
- Dam bao moi but toan co the truy nguon ve chung tu goc.
- Loc so lieu theo ngay, phap nhan, phan xuong.
- Dat nen cho hach toan noi bo giua phap nhan/phan xuong.
- Dat nen cho hach toan thue GTGT dau vao/dau ra.
- Giam sat audit cho thao tac tao, sua, duyet, huy va dao but toan.
- Bo sung test nghiep vu nen tang.

### Chua lam trong giai doan nay

- Gia thanh san xuat chi tiet theo lenh.
- Doi soat ngan hang tu sao ke.
- Bao cao tai chinh hoan chinh.
- Tich hop hoa don dien tu nang cao.
- Khoa ky ke toan chinh thuc.

## Yeu cau bat buoc ve phap nhan, phan xuong, noi bo, thue va audit

### Phap nhan

- Moi chung tu ke toan phat sinh theo don vi phap ly phai co `phap_nhan_id`.
- Moi but toan tu dong phai gan `phap_nhan_id` o header va line.
- Neu chung tu goc co `phap_nhan_id`, but toan sinh ra khong duoc de trong `phap_nhan_id`.
- So cai, bang can doi phat sinh, cong no, tien, VAT phai loc duoc theo phap nhan.
- Khong cho duyet chung tu ban/mua/thu/chi neu thieu phap nhan trong nghiep vu bat buoc co phap nhan.
- Chung tu lien quan hai phap nhan phai tach thanh nghiep vu noi bo, khong gop chung vao mot but toan mo ho.

### Phan xuong

- Chi phi san xuat, luong xuong, khau hao xuong, phan bo chi phi chung phai co `phan_xuong_id`.
- Doanh thu va gia von co the gan `phan_xuong_id` neu don hang/lenh san xuat xac dinh duoc xuong phu trach.
- But toan quan ly chung co the de trong `phan_xuong_id`, nhung but toan chi phi san xuat khong duoc de trong neu co nguon tu xuong.
- Bao cao quan tri phai loc duoc theo phan xuong.
- Khi header va line co phan xuong khac nhau, line la nguon dung cho bao cao chi tiet.

### Hach toan noi bo

Tai khoan noi bo toi thieu:

- `1368` - Phai thu noi bo.
- `3368` - Phai tra noi bo.
- `5112` - Doanh thu noi bo.
- `6322` - Gia von noi bo.

Nguyen tac:

- Giao dich noi bo giua hai phap nhan hoac hai xuong phai danh dau `is_internal` hoac co `loai_but_toan` rieng.
- Ben giao ghi doanh thu noi bo va gia von noi bo neu can theo doi lai lo quan tri.
- Ben nhan ghi hang ton kho, chi phi hoac cong no noi bo tuy nghiep vu.
- Bao cao quan tri co the tinh ca noi bo.
- Bao cao thue va bao cao tai chinh phai co co che loai tru noi bo.
- Tai khoan noi bo khong duoc lan vao bao cao thue neu dang chay che do bao cao thue.

### Thue GTGT

Tai khoan thue toi thieu:

- `1331` - Thue GTGT dau vao duoc khau tru.
- `3331` - Thue GTGT dau ra phai nop.

Nguyen tac:

- Hoa don mua co VAT: No hang hoa/chi phi, No `1331`, Co `331`.
- Hoa don ban co VAT: No `131`, Co doanh thu, Co `3331`.
- Hoa don khong VAT khong sinh dong thue.
- Thue phai tach theo phap nhan.
- Giao dich noi bo khong mac dinh tinh VAT, tru khi cau hinh nghiep vu yeu cau xuat hoa don noi bo.
- Bao cao VAT sau nay phai lay du lieu tu chung tu hoa don va but toan thue da duyet.

### Audit va giam sat

Moi thao tac quan trong phai co dau vet:

- Tao chung tu.
- Sua chung tu.
- Duyet chung tu.
- Huy chung tu.
- Tao but toan tu dong.
- Tao but toan dao.
- Sua but toan tong hop.
- Mo khoa/sua chung tu da duyet neu co co che dac biet.

Thong tin audit toi thieu:

- Bang/loai doi tuong.
- ID doi tuong.
- Hanh dong.
- Gia tri truoc.
- Gia tri sau.
- Nguoi thuc hien.
- Thoi diem thuc hien.
- Ly do thao tac neu la huy, sua chung tu da duyet hoac tao but toan dao.

Nguyen tac audit:

- Khong xoa audit log.
- Khong cho sua audit log qua API thong thuong.
- Audit log phai loc duoc theo loai chung tu, nguoi thao tac, ngay thao tac.
- Chung tu da duyet khi bi huy phai luu ly do va sinh audit.
- Neu tao but toan dao, audit phai lien ket chung tu goc, but toan goc va but toan dao.

## Hien trang can kiem tra

He thong da co cac thanh phan lien quan:

- Model tai khoan: `ChartOfAccounts`.
- But toan: `JournalEntry`, `JournalEntryLine`.
- Hoa don mua hang: `PurchaseInvoice`.
- Phieu thu: `CashReceipt`.
- Phieu chi: `CashPayment`.
- So du dau ky: `OpeningBalance`.
- Cong no: `DebtLedgerEntry`.
- Tai san va khau hao: `FixedAsset`.
- API ke toan: `backend/app/routers/accounting.py`.
- Service ke toan: `backend/app/services/accounting_service.py`.
- Test hien co: `backend/tests/test_accounting.py`.

## Ke hoach chi tiet

## Ngay 1: Ra soat cau truc du lieu ke toan

### Backend

- Kiem tra bang `chart_of_accounts`.
- Kiem tra bang `journal_entries`.
- Kiem tra bang `journal_entry_lines`.
- Kiem tra cac bang chung tu dang sinh but toan:
  - `cash_receipts`
  - `cash_payments`
  - `purchase_invoices`
  - `sales_invoices`
  - `customer_refund_vouchers`
  - `fixed_assets`
  - `workshop_payroll`
- Lap danh sach cot bat buoc cho moi bang.
- Kiem tra cac cot phap nhan, phan xuong, nguoi tao, nguoi duyet, ngay duyet.
- Kiem tra da co bang audit log dung chung hay chua.
- Neu chua co, thiet ke bang audit log cho module ke toan.

### Ket qua dau ra

- Co danh sach thieu/sai trong schema.
- Biet chung tu nao da sinh but toan, chung tu nao chua.
- Biet chung tu nao thieu phap nhan/phan xuong.
- Biet audit hien tai dang ghi duoc den dau va thieu dau.

## Ngay 2: Chuan hoa he thong tai khoan

### Tai khoan toi thieu can co

- `111` - Tien mat.
- `112` - Tien gui ngan hang.
- `131` - Phai thu khach hang.
- `1331` - Thue GTGT duoc khau tru.
- `1368` - Phai thu noi bo.
- `154` - Chi phi san xuat kinh doanh do dang.
- `155` - Thanh pham.
- `211` - Tai san co dinh huu hinh.
- `214` - Hao mon tai san co dinh.
- `331` - Phai tra nguoi ban.
- `3331` - Thue GTGT phai nop.
- `3368` - Phai tra noi bo.
- `5111` - Doanh thu ban hang ben ngoai.
- `5112` - Doanh thu noi bo.
- `6321` - Gia von ban hang ben ngoai.
- `6322` - Gia von noi bo.
- `641` - Chi phi ban hang.
- `642` - Chi phi quan ly doanh nghiep.
- `711` - Thu nhap khac.
- `811` - Chi phi khac.
- `911` - Xac dinh ket qua kinh doanh.

### Dau viec

- Viet/ra soat seed tai khoan.
- Dam bao `so_tk` la duy nhat.
- Dam bao tai khoan con co `so_tk_cha` hop le.
- Khong cho xoa tai khoan da co but toan.
- Them trang thai hoat dong/ngung su dung.
- Danh dau nhom tai khoan noi bo de co the loai tru khi bao cao thue/BCTC.
- Danh dau nhom tai khoan thue de phuc vu bao cao VAT.

### Ket qua dau ra

- Chay seed tai khoan duoc nhieu lan khong tao trung.
- Tat ca but toan mau co tai khoan hop le.
- Tai khoan noi bo va tai khoan thue duoc nhan dien ro.

## Ngay 3: Chuan hoa ham tao but toan

### Nguyen tac bat buoc

- Moi but toan phai co it nhat 2 dong.
- Tong No phai bang tong Co.
- Khong cho dong but toan co ca No va Co cung luc.
- Khong cho dong co so tien am.
- Khong cho hach toan vao tai khoan khong ton tai hoac dang ngung dung.
- Moi but toan phai co ngay but toan, dien giai, loai but toan.
- Neu la but toan tu dong, phai co `chung_tu_loai` va `chung_tu_id`.
- Neu nghiep vu bat buoc co phap nhan, but toan khong duoc thieu `phap_nhan_id`.
- Neu la chi phi san xuat/xuong, line but toan khong duoc thieu `phan_xuong_id`.
- Neu la but toan noi bo, phai dung tai khoan noi bo hoac loai but toan noi bo.
- Neu la but toan thue, phai dung tai khoan `1331` hoac `3331` theo dung chieu nghiep vu.

### Dau viec

- Ra soat ham tao but toan trong `AccountingService`.
- Gom logic validate but toan vao mot ham dung chung.
- Chuan hoa cach tinh `tong_no`, `tong_co`.
- Chuan hoa cach gan `phap_nhan_id`, `phan_xuong_id` o header va line.
- Dam bao rollback khi tao but toan loi.
- Ghi audit khi tao but toan tu dong va but toan tong hop.
- Ghi audit khi validate that bai voi loi nghiem trong neu can truy vet.

### Ket qua dau ra

- Tao but toan sai No/Co bi chan.
- Tao but toan tai khoan sai bi chan.
- But toan hop le duoc ghi day du header va line.
- But toan hop le co audit tao moi.
- But toan noi bo/thue khong bi hach toan nham tai khoan.

## Ngay 4: Chuan hoa danh so chung tu

### Mau so de xuat

- But toan tong hop: `BT-YYYYMM-0001`.
- Phieu thu: `PT-YYYYMM-0001`.
- Phieu chi: `PC-YYYYMM-0001`.
- Hoa don mua hang noi bo: `HDM-YYYYMM-0001`.
- So du dau ky: `SDK-YYYYMM-0001`.
- Hoan tien khach hang: `HT-YYYYMM-0001`.
- Khau hao tai san: `KH-YYYYMM-0001`.
- Phan bo chi phi: `PB-YYYYMM-0001`.

### Dau viec

- Ra soat cac ham sinh so phieu hien co.
- Dam bao so phieu duy nhat theo bang.
- Xu ly tranh trung khi nhieu nguoi tao cung luc.
- Khong cho sua so chung tu sau khi da duyet.
- Neu can sua so chung tu, chi cho phep nguoi co quyen cao va phai luu log.

### Ket qua dau ra

- So chung tu tang dung theo thang.
- Khong trung so phieu.
- Chung tu da duyet khong bi doi so.

## Ngay 5: Hoan thien luong duyet/huy chung tu

### Trang thai chuan

- `nhap`: chung tu moi lap, chua anh huong so cai.
- `cho_duyet`: cho ke toan truong hoac nguoi co quyen duyet.
- `da_duyet`: da ghi nhan vao so cai/cong no.
- `huy`: bi huy, khong tinh vao bao cao.

Mot so chung tu co the co bien the rieng, nhung can quy ve nghia chung nhu tren.

### Nguyen tac

- Chung tu nhap co the sua.
- Chung tu da duyet khong sua truc tiep.
- Huy chung tu da duyet phai tao but toan dao neu truoc do da sinh but toan.
- Khong xoa cung chung tu da duyet.
- Luu nguoi duyet, ngay duyet.
- Moi thao tac duyet/huy phai ghi audit.
- Huy chung tu da duyet bat buoc nhap ly do huy.
- Neu huy chung tu da co but toan, audit phai ghi ro but toan dao nao duoc sinh ra.

### Dau viec

- Ra soat phieu thu.
- Ra soat phieu chi.
- Ra soat hoa don mua.
- Ra soat but toan tong hop.
- Ra soat phieu hoan tien khach hang.
- Dong nhat API approve/cancel.

### Ket qua dau ra

- Chung tu nao duyet thi co but toan.
- Chung tu nao huy thi khong con tac dong sai vao so cai.
- Khong co trang thai mo ho.
- Co audit day du cho tao, sua, duyet, huy.

## Ngay 6: Truy vet chung tu goc

### Dau viec

- Dam bao `journal_entries.chung_tu_loai` luu dung loai chung tu.
- Dam bao `journal_entries.chung_tu_id` tro dung id chung tu.
- Tao API xem but toan theo chung tu goc.
- Tao API xem chung tu goc tu but toan.
- Hien thi link chung tu goc o man hinh so cai/frontend neu chua co.
- Tao API xem audit theo chung tu.
- Tao API xem audit theo but toan.

### Loai chung tu de xuat

- `cash_receipt`
- `cash_payment`
- `purchase_invoice`
- `sales_invoice`
- `customer_refund`
- `fixed_asset_depreciation`
- `workshop_payroll`
- `overhead_allocation`
- `manual_journal`

### Ket qua dau ra

- Tu phieu thu xem duoc but toan.
- Tu but toan xem lai duoc phieu thu/phieu chi/hoa don goc.
- Ke toan co the giai trinh so lieu khi doi chieu.
- Tu chung tu xem duoc lich su audit.
- Tu but toan dao xem duoc but toan goc.

## Ngay 7: Loc theo phap nhan, phan xuong, ngay chung tu

### Dau viec

- Ra soat tat ca API danh sach chung tu.
- Ra soat API so cai.
- Ra soat bang can doi phat sinh.
- Dam bao filter `tu_ngay`, `den_ngay`, `phap_nhan_id`, `phan_xuong_id` nhat quan.
- Kiem tra phap nhan o header va line but toan.
- Bo sung index neu truy van cham.
- Dam bao bao cao thue co the loai giao dich noi bo.
- Dam bao bao cao quan tri co the bao gom giao dich noi bo.
- Audit log loc duoc theo phap nhan neu doi tuong audit co phap nhan.

### Ket qua dau ra

- Xem so cai theo tung phap nhan.
- Xem so cai theo tung phan xuong khi can.
- Bao cao khong lan so lieu giua cac phap nhan.
- Co nen de tach bao cao quan tri va bao cao thue.

## Ngay 8: Hoan thien audit va giam sat

### Backend

- Tao hoac chuan hoa bang audit log dung chung cho ke toan.
- Bo sung helper ghi audit trong service.
- Gan audit vao cac luong:
  - tao chung tu
  - cap nhat chung tu
  - duyet chung tu
  - huy chung tu
  - tao but toan
  - tao but toan dao
- Luu snapshot truoc/sau voi cac truong quan trong.
- Khong luu thong tin nhay cam khong can thiet.
- Bo sung API xem audit theo doi tuong.

### Frontend

- Them tab hoac khu vuc "Lich su" trong man hinh chi tiet chung tu.
- Hien thi nguoi thao tac, thoi gian, hanh dong, ly do.
- Voi chung tu da huy, hien thi ly do huy va but toan dao neu co.
- Voi but toan tu dong, hien thi chung tu goc.

### Ket qua dau ra

- Ke toan truong xem duoc lich su thao tac cua tung chung tu.
- Giam doc co the kiem tra ai sua/duyet/huy chung tu.
- Du lieu audit khong bi mat khi huy chung tu.

## Ngay 9: Hoan thien frontend cho nen tang ke toan

### Man hinh can ra soat

- So cai tong hop.
- But toan tong hop.
- Phieu thu.
- Phieu chi.
- Hoa don mua hang.
- Bang can doi phat sinh.

### Dau viec

- Bo sung cot trang thai.
- Bo sung cot phap nhan/phan xuong.
- Bo sung link xem but toan lien quan.
- Bo sung nut duyet/huy theo quyen.
- Hien thi thong bao loi ro rang khi but toan lech.
- Chan thao tac sua/huy khi khong du quyen.
- Hien thi phap nhan, phan xuong tren danh sach va chi tiet.
- Hien thi dau hieu giao dich noi bo neu co.
- Hien thi dong thue VAT tren chung tu lien quan.
- Hien thi audit log trong chi tiet chung tu.

### Ket qua dau ra

- Ke toan nhap, duyet, huy duoc chung tu tren UI.
- Loi nghiep vu hien thi de hieu.
- Trang thai chung tu ro rang.
- Lich su thao tac xem duoc ngay tren UI.

## Ngay 10: Test nghiep vu nen tang

### Test can co

- Tao but toan tong hop hop le.
- Chan but toan lech No/Co.
- Chan but toan co tai khoan khong ton tai.
- Tao phieu thu va duyet sinh but toan No 111/112 - Co 131.
- Tao phieu chi va duyet sinh but toan No 331 - Co 111/112.
- Huy phieu da duyet khong lam lech so cai.
- Loc so cai theo phap nhan.
- Loc so cai theo ngay.
- Bang can doi phat sinh tong No bang tong Co.
- Chung tu thieu phap nhan bi chan neu nghiep vu bat buoc co phap nhan.
- Chi phi san xuat thieu phan xuong bi chan neu nghiep vu co nguon tu xuong.
- But toan noi bo dung tai khoan `1368`, `3368`, `5112`, `6322`.
- Hoa don mua co VAT sinh dong `1331`.
- Hoa don ban co VAT sinh dong `3331`.
- Giao dich noi bo duoc loai tru khi chay che do bao cao thue.
- Tao/sua/duyet/huy chung tu co audit log.
- Huy chung tu da duyet co ly do va audit lien ket but toan dao.

### Ket qua dau ra

- `backend/tests/test_accounting.py` bao phu cac nghiep vu loi.
- Test chay qua truoc khi chuyen sang giai doan cong no.

## Ngay 11: Nghiem thu noi bo va khoa pham vi

### Checklist nghiem thu

- He thong tai khoan toi thieu da co.
- Tao duoc but toan tong hop.
- But toan sai bi chan.
- Phieu thu duyet sinh but toan dung.
- Phieu chi duyet sinh but toan dung.
- Huy chung tu khong lam sai so cai.
- Loc so cai theo ngay/phap nhan/phan xuong dung.
- Bang can doi phat sinh khong lech.
- Moi but toan tu dong co chung tu goc.
- Nguoi tao, nguoi duyet, ngay duyet duoc ghi nhan.
- Phap nhan bat buoc duoc validate.
- Phan xuong duoc gan cho chi phi san xuat/xuong.
- Tai khoan noi bo co trong seed va duoc dung dung nghiep vu.
- Tai khoan thue co trong seed va duoc dung dung nghiep vu.
- Audit log ghi du thao tac tao, sua, duyet, huy, dao but toan.
- UI xem duoc lich su thao tac cua chung tu.

### Dieu kien sang giai doan tiep theo

Chi chuyen sang giai doan cong no AR/AP khi:

- So cai chay dung.
- But toan kep da co validate.
- Chung tu thu/chi da co quy trinh duyet/huy on dinh.
- Test nen tang da pass.
- Audit log du de truy vet sai lech.
- Co nen tach bao cao quan tri noi bo va bao cao thue.

## Task ky thuat de tach cho dev

### Backend

1. Ra soat va bo sung seed `chart_of_accounts`.
2. Chuan hoa ham validate but toan trong `AccountingService`.
3. Chuan hoa ham sinh so chung tu.
4. Bo sung logic chan sua/xoa chung tu da duyet.
5. Bo sung but toan dao khi huy chung tu da hach toan.
6. Bo sung API truy vet but toan theo chung tu.
7. Bo sung filter phap nhan, phan xuong cho so cai va bang can doi phat sinh.
8. Bo sung test ke toan nen tang.
9. Bo sung cau truc/audit helper cho module ke toan.
10. Bo sung validate phap nhan, phan xuong theo loai nghiep vu.
11. Bo sung co che danh dau va loai tru giao dich noi bo.
12. Bo sung validate tai khoan thue `1331`, `3331`.

### Frontend

1. Ra soat man hinh so cai.
2. Ra soat man hinh but toan tong hop.
3. Bo sung trang thai va thao tac duyet/huy cho phieu thu, phieu chi.
4. Bo sung link xem chung tu goc/but toan lien quan.
5. Bo sung filter phap nhan, phan xuong, ngay.
6. Chuan hoa thong bao loi nghiep vu.
7. Bo sung lich su audit trong chi tiet chung tu.
8. Bo sung hien thi giao dich noi bo va dong thue.

### Du lieu

1. Kiem tra tai khoan ke toan dang co.
2. Import/seed tai khoan thieu.
3. Kiem tra chung tu cu co thieu phap nhan/phan xuong.
4. Kiem tra but toan cu co lech No/Co.
5. Lap script doi chieu neu du lieu hien tai da co phat sinh.
6. Kiem tra du lieu cu co but toan noi bo/thue hach toan nham tai khoan khong.
7. Kiem tra audit log neu he thong da co du lieu van hanh that.

## Rủi ro

- Du lieu cu da co chung tu nhung thieu phap nhan hoac phan xuong.
- Mot so chung tu da duyet nhung chua sinh but toan.
- Trang thai chung tu giua cac module dang chua dong nhat.
- Huy chung tu da hach toan co the lam lech so cai neu khong tao but toan dao.
- Bao cao hien tai co the dang tinh truc tiep tu chung tu, chua di qua so cai.
- Hach toan noi bo co the bi tinh nham vao bao cao thue.
- Thue GTGT co the bi ghi sai phap nhan neu chung tu nguon thieu phap nhan.
- Audit log co the phinh nhanh neu luu snapshot qua lon.

## Cach xu ly rui ro

- Chay script kiem tra but toan lech.
- Chay script kiem tra chung tu da duyet chua co but toan.
- Khong migrate sua du lieu hang loat neu chua co file backup.
- Uu tien them validate cho du lieu moi truoc.
- Du lieu cu xu ly bang script doi chieu rieng.
- Tach co bao cao quan tri va bao cao thue ngay tu dau.
- Audit chi luu truong quan trong, khong luu payload qua lon neu khong can.

## Ket qua cuoi Tuan 2

Sau 2 tuan, module ke toan phai dat muc:

- Co danh muc tai khoan dung va du.
- Tao/duyet/huy duoc chung tu co ban.
- But toan kep duoc validate chat.
- So cai truy vet duoc ve chung tu goc.
- Bang can doi phat sinh khong lech.
- Co test bao ve cac nghiep vu nen tang.
- Phap nhan, phan xuong, noi bo va thue co validate nen.
- Audit log du de giam sat thao tac ke toan quan trong.
