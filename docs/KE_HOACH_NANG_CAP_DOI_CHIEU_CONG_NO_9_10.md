# Kế hoạch nâng cấp Đối chiếu công nợ lên 9/10

Ngày lập: 2026-05-25  
Phạm vi: Đối chiếu công nợ khách hàng (AR) và nhà cung cấp (AP)

## Mục tiêu

Đưa phân hệ đối chiếu công nợ từ mức bản nháp nghiệp vụ lên mức vận hành chính thức:

- Dữ liệu đúng nguồn công nợ kế toán, có số dư đầu kỳ, phát sinh, thanh toán, trả hàng/giảm trừ, số dư cuối kỳ.
- Có biên bản đối chiếu lưu trong hệ thống, có trạng thái gửi/xác nhận/chốt.
- Có phân tách pháp nhân, đối tượng, kỳ đối chiếu.
- Có xuất Excel/PDF và lưu lịch sử theo từng lần đối chiếu.
- Chỉ lấy chứng từ đủ điều kiện: đã duyệt, không hủy, đúng pháp nhân/kỳ.

Điểm mục tiêu: 9/10.

## Hiện trạng

Điểm hiện tại: khoảng 5.4/10.

Vấn đề chính:

- Trang đối chiếu khách hàng đang gọi sai API, dùng sổ công nợ thường thay vì API đối chiếu.
- AP gọi đúng API hơn AR, nhưng chưa có link menu rõ cho AP.
- Backend đang tính phiếu thu/chi với điều kiện `trang_thai != "huy"`, có nguy cơ tính cả chứng từ chưa duyệt.
- Đối chiếu đang dựa nhiều vào giao hàng/nhập kho, chưa lấy ledger công nợ làm nguồn chuẩn.
- Chưa có bảng lưu biên bản đối chiếu, trạng thái xác nhận, lịch sử, bản in đã chốt.

## Tiêu chí đạt 9/10

1. Gọi đúng API và UI không lỗi dữ liệu: 9/10.
2. Công thức công nợ đúng: số dư đầu kỳ + phát sinh tăng - phát sinh giảm = số dư cuối kỳ.
3. AR/AP dùng cùng chuẩn dữ liệu ledger, không mỗi bên một logic rời rạc.
4. Chỉ lấy chứng từ đã duyệt, có pháp nhân/kỳ rõ ràng.
5. Có biên bản lưu DB, trạng thái và lịch sử thao tác.
6. Có xuất PDF/Excel từ dữ liệu biên bản đã lưu.

## Giai đoạn 1 - Sửa lỗi nền và thống nhất màn hình

Mục tiêu điểm sau giai đoạn: 6.5/10.

Checklist:

- [x] Sửa `CustomerReconciliation.tsx` gọi `arApi.getReconciliation` thay vì `arApi.getLedger`.
- [x] Bổ sung type response rõ ràng cho AR reconciliation trong `frontend/src/api/accounting.ts`.
- [x] Thêm menu cho AP reconciliation hoặc gộp AR/AP thành một trang có tab.
- [x] Thống nhất mặc định kỳ đối chiếu là đầu tháng đến hôm nay cho cả AR và AP.
- [ ] Thêm empty state/error state rõ ràng khi chưa có dữ liệu.
- [x] Chạy `npm.cmd run build`.

Tiêu chí nghiệm thu:

- Chọn khách hàng và kỳ, trang AR hiện đúng tổng giao hàng/thanh toán/còn lại.
- Chọn nhà cung cấp và kỳ, trang AP vẫn hoạt động.
- Menu truy cập được cả khách hàng và nhà cung cấp.

## Giai đoạn 2 - Sửa điều kiện chứng từ và pháp nhân

Mục tiêu điểm sau giai đoạn: 7.2/10.

Checklist:

- [x] Backend AR chỉ tính `CashReceipt.trang_thai == "da_duyet"`.
- [x] Backend AP chỉ tính `CashPayment.trang_thai == "da_duyet"`.
- [x] Thêm query `phap_nhan_id` cho API AR/AP reconciliation.
- [x] UI thêm bộ lọc pháp nhân.
- [ ] Khi chọn hóa đơn/chứng từ có pháp nhân, tự lọc đúng danh sách đối tượng liên quan nếu có thể.
- [x] Bổ sung test backend cho phiếu chưa duyệt không được tính vào đối chiếu.

Tiêu chí nghiệm thu:

- Phiếu thu/chi nháp, chờ duyệt, đã chốt nhưng chưa duyệt không làm thay đổi số đối chiếu.
- Có thể đối chiếu riêng từng pháp nhân.

## Giai đoạn 3 - Chuyển nguồn chuẩn sang ledger công nợ

Mục tiêu điểm sau giai đoạn: 8/10.

Checklist:

- [x] Tạo service chung tính reconciliation từ `DebtLedgerEntry`.
- [x] AR dùng ledger entries: tăng nợ từ hóa đơn bán, giảm nợ từ phiếu thu, hủy/điều chỉnh, hoàn tiền/trả hàng nếu có.
- [x] AP dùng ledger entries: tăng nợ từ hóa đơn mua, giảm nợ từ phiếu chi, trả hàng NCC nếu có.
- [x] Tính `so_du_dau_ky` bằng `_calc_balance_before`.
- [x] Tính `phat_sinh_tang`, `phat_sinh_giam`, `so_du_cuoi_ky`.
- [x] Vẫn giữ bảng chi tiết giao hàng/nhập kho làm phụ lục, không dùng làm số công nợ chính.
- [x] Bổ sung test số dư đầu kỳ, phát sinh tăng/giảm, số dư cuối kỳ.

Tiêu chí nghiệm thu:

- Số đối chiếu khớp với sổ công nợ AR/AP.
- Giao hàng/nhập kho chỉ là phụ lục giải trình, không làm lệch số công nợ kế toán.

## Giai đoạn 4 - Lưu biên bản đối chiếu

Mục tiêu điểm sau giai đoạn: 8.5/10.

Checklist:

- [x] Thêm model `DebtReconciliationStatement`.
- [x] Thêm model `DebtReconciliationLine`.
- [ ] Các trường chính:
  - `doi_tuong`: `khach_hang` hoặc `nha_cung_cap`
  - `customer_id`, `supplier_id`
  - `phap_nhan_id`
  - `tu_ngay`, `den_ngay`
  - `so_bien_ban`
  - `so_du_dau_ky`, `phat_sinh_tang`, `phat_sinh_giam`, `so_du_cuoi_ky`
  - `trang_thai`: `nhap`, `da_gui`, `da_xac_nhan`, `tu_choi`, `da_chot`, `huy`
  - `created_by`, `confirmed_by`, `confirmed_at`
  - `ghi_chu`, `file_ky_url`
- [x] API tạo biên bản từ dữ liệu tính toán hiện tại.
- [x] API xem danh sách biên bản.
- [x] API xem chi tiết biên bản.
- [x] API đổi trạng thái: gửi, xác nhận, từ chối, chốt, hủy.
- [x] Migration đầy đủ.

Tiêu chí nghiệm thu:

- Người dùng có thể tạo một biên bản đối chiếu cho khách/NCC và kỳ.
- Biên bản đã tạo không bị thay đổi số liệu khi chứng từ sau đó phát sinh thêm.
- Có lịch sử trạng thái cơ bản.

## Giai đoạn 5 - PDF/Excel chính thức từ biên bản đã lưu

Mục tiêu điểm sau giai đoạn: 8.8/10.

Checklist:

- [x] Xuất PDF từ `DebtReconciliationStatement`, không xuất trực tiếp từ dữ liệu động.
- [x] Xuất Excel gồm:
  - Sheet tổng hợp
  - Sheet phát sinh công nợ
  - Sheet thanh toán
  - Sheet phụ lục giao hàng/nhập kho nếu có
- [x] Mẫu in có đủ:
  - Pháp nhân
  - Đối tượng đối chiếu
  - Kỳ
  - Số biên bản
  - Số dư đầu kỳ
  - Phát sinh tăng/giảm
  - Số dư cuối kỳ
  - Khu vực ký hai bên
- [ ] Cho upload file biên bản đã ký.

Tiêu chí nghiệm thu:

- Có thể in lại đúng biên bản đã chốt.
- Có thể lưu file ký để tra cứu sau.

## Giai đoạn 6 - Cảnh báo lệch và khóa kỳ

Mục tiêu điểm sau giai đoạn: 9/10.

Checklist:

- [ ] Cảnh báo khi biên bản đã chốt nhưng có chứng từ phát sinh ngược kỳ.
- [ ] Cảnh báo đối tượng có phát sinh nhưng chưa tạo biên bản trong kỳ.
- [ ] Không cho hủy/sửa chứng từ thuộc kỳ đã chốt đối chiếu nếu chưa có quyền đặc biệt.
- [ ] Thêm quyền nghiệp vụ:
  - Kế toán công nợ tạo biên bản
  - Kế toán trưởng chốt
  - Giám đốc xem/xác nhận đặc biệt nếu cần
- [ ] Dashboard nhỏ: số biên bản chưa gửi, chờ xác nhận, lệch sau chốt.

Tiêu chí nghiệm thu:

- Công nợ đã đối chiếu/chốt được bảo vệ.
- Có cảnh báo khi dữ liệu sau chốt có khả năng làm lệch biên bản.

## Thứ tự triển khai đề xuất

1. Giai đoạn 1: sửa lỗi UI/API đang sai.
2. Giai đoạn 2: sửa điều kiện chứng từ và pháp nhân.
3. Giai đoạn 3: chuyển số liệu chính sang ledger công nợ.
4. Giai đoạn 4: lưu biên bản.
5. Giai đoạn 5: xuất PDF/Excel từ biên bản.
6. Giai đoạn 6: cảnh báo, quyền và khóa kỳ.

## Ghi chú kỹ thuật

- Không xóa API cũ ngay; giữ tương thích rồi chuyển UI sang API mới.
- Các test cần ưu tiên backend trước vì đây là nghiệp vụ tiền.
- Khi thêm bảng biên bản, phải có migration Alembic.
- Không dùng giao hàng/nhập kho làm công nợ chính vì có thể lệch hóa đơn, VAT, trả hàng, giảm trừ.
- Ledger công nợ là nguồn chuẩn cho số tiền đối chiếu.
