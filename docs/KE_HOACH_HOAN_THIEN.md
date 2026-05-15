# Ke Hoach Hoan Thien

Tai lieu nay dung de uu tien viec con lai sau cac dot phat trien lon.

## P0 - On dinh nen tang

- Don Alembic: dam bao mot chuoi revision ro, chay duoc tren database moi.
- Chay build frontend va smoke test backend sau moi dot merge.
- Chuan hoa `.env.example` cho backend/frontend neu chua co.
- Tach/ghi chu cac script dev cu de tranh chay nham database.
- Kiem tra encoding tieng Viet trong code/doc.

## P1 - Luong nghiep vu cot loi

- Test end-to-end: bao gia -> don hang -> LSX -> giao hang -> hoa don -> cong no.
- Test end-to-end: YMH -> PO -> GR -> hoa don mua -> cong no AP.
- Test ton kho: nhap, xuat, chuyen, dieu chinh, the kho.
- Test accounting: phieu thu, phieu chi, journal, so quy, ngan hang, AR/AP.
- Test CD2: tao phieu in, kanban, scan, lich su, dashboard.

## P2 - Go-live va du lieu

- Hoan thien import so du dau ky.
- Khoa cac thao tac xoa nguy hiem hoac them confirm/audit.
- Backup/restore thu nghiem tren may khac.
- Lap checklist doi soat sau import: danh muc, ton kho, cong no, so quy, ngan hang.
- Chuan hoa mau in theo phap nhan.

## P3 - Bao cao va quan tri

- Doi soat doanh thu, VAT, cong no, NXT, gia thanh.
- Them export cho cac bao cao chua co.
- Xay report theo xe/tai xe/tuyen.
- Hoan thien dashboard KPI theo role.

## P4 - Chat/AI/tu dong hoa

- Test Agent voi Ollama local va Anthropic.
- Them tool read-only truoc, write tool sau khi co confirm/audit.
- Neu ket noi Zalo/email, di qua API/permission, khong ket noi DB truc tiep.
