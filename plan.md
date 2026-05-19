# Plan: Hoàn thiện giao diện điện thoại công nhân — Mobile + Scan sync
Date: 2026-05-19
Status: APPROVED

## Mục tiêu
Đồng bộ real-time giữa mobile và desktop cho tất cả 3 loại máy (in/sau in/scan),
cải thiện UX list items và PhieuDetailDrawer để công nhân dễ kiểm tra thông tin.

## Các bước thực thi

- [ ] Bước 1: Header live clock + trạng thái máy
  - Hiện giờ thực HH:mm (useEffect interval 1 phút)
  - Khi isRunning → header pill xanh "🟢 ĐANG IN" + tên hàng rút gọn
  - Khi isPaused  → header pill vàng "⏸ TẠM DỪNG"
  - Khi isPending → header pill xám "⏳ CHỜ BẮT ĐẦU"

- [ ] Bước 2: Confirm dialog trước BẮT ĐẦU
  - Modal.confirm nhỏ: "Bắt đầu in [ten_hang]?"
  - Nút xác nhận màu xanh lớn, nút huỷ nhỏ
  - Chỉ gọi trackMutation sau khi confirm

- [ ] Bước 3: Fix form HOÀN THÀNH reset đúng
  - Thêm `key={currentOrder?.id}` vào <Modal> để destroy + re-create khi đổi lệnh
  - `initialValues` sẽ lấy đúng `so_luong_phoi` của lệnh mới

- [ ] Bước 4: Thu gọn ô tìm kiếm khi đã chọn lệnh
  - Khi `currentOrder != null`: ô tìm kiếm collapse thành 1 nút nhỏ "Đổi lệnh / Quét mã"
  - Nhấn nút → expand ô tìm kiếm (state `showSearch`)
  - Khi `currentOrder == null`: ô tìm kiếm luôn expand

- [ ] Bước 5: Tiến độ in trên card phiếu
  - Khi `so_luong_in_ok > 0`: hiện progress bar
    "Đã in: X / Y tờ — Z% hoàn thành"
  - Tính phần trăm = so_luong_in_ok / so_luong_phoi × 100
  - Dùng Ant Design Progress (line, strokeColor theo %)

- [ ] Bước 6: Nút "Chọn lệnh tiếp" khi post-print
  - Khi isPostPrint: dưới banner xanh, thêm nút "Chọn lệnh khác"
  - Click → setCurrentOrder(null), scroll lên đầu trang
  - Giúp công nhân không phải scroll tay

- [ ] Bước 7: Fallback worker name trong nhật ký
  - Khi `log.worker` là null/empty → hiện "Công nhân" hoặc `workerSession.worker_name`
  - Nhật ký cũng hiện giờ rõ hơn: "14:35 · STOP · Thay dao"

## Done Criteria
- [ ] Header hiện giờ thực tế HH:mm, cập nhật mỗi phút
- [ ] Header pill trạng thái thay đổi theo isRunning / isPaused / isPending
- [ ] Bấm BẮT ĐẦU → confirm dialog xuất hiện trước khi gọi API
- [ ] Đổi sang lệnh mới → modal HOÀN THÀNH hiện đúng so_luong_phoi của lệnh mới
- [ ] Khi đã chọn lệnh → ô tìm kiếm thu gọn thành nút "Đổi lệnh"
- [ ] Khi so_luong_in_ok > 0 → progress bar hiện trên card
- [ ] Khi isPostPrint → nút "Chọn lệnh khác" hiện
- [ ] TypeScript: PASS
- [ ] Build: SUCCESS

## Rủi ro
- Modal.confirm sẽ thêm 1 tap extra cho BẮT ĐẦU — chấp nhận được vì sai giờ bắt đầu không sửa lại được
- Progress bar chỉ có dữ liệu nếu backend đã cập nhật so_luong_in_ok
