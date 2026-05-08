# Hướng dẫn Hệ thống Kế toán Quản trị Phân xưởng - Nam Phương ERP

## 1. Mục tiêu hệ thống
Hệ thống được thiết kế để giải quyết bài toán quản trị tài chính đa xưởng, giúp chủ doanh nghiệp trả lời được các câu hỏi:
- Xưởng nào đang hoạt động hiệu quả nhất?
- Lợi nhuận thực tế của từng xưởng sau khi trừ chi phí vận hành (lương, điện, khấu hao) là bao nhiêu?
- Xưởng sản xuất có tiết kiệm được chi phí so với định mức kế hoạch không?

---

## 2. Các công việc đã thực hiện

### A. Hạ tầng Hạch toán (Backend)
- **Tagging Đa chiều**: Cập nhật sổ cái để gán nhãn `Pháp nhân` và `Phân xưởng` vào từng dòng bút toán (dimension tracking).
- **Giá Định Mức (Standard Costing)**: Tích hợp trường giá chuẩn vào danh mục vật tư/sản phẩm để làm căn cứ tính hiệu quả nội bộ.
- **Tự động hóa 100%**: Mọi nghiệp vụ Kho (Nhập, Xuất, Chuyển, Kiểm kê) đều tự động sinh bút toán kế toán tương ứng.

### B. Module Quản trị Chi phí
- **Workshop Payroll**: Module nhập và duyệt bảng lương theo từng xưởng.
- **Overhead Allocation**: Công cụ phân bổ chi phí dùng chung (điện, nước, quản lý) theo tỷ lệ %.
- **Asset Depreciation**: Module quản lý máy móc và trích khấu hao tự động hàng tháng về từng xưởng.

### C. Hệ thống Báo cáo
- **Workshop P&L**: Báo cáo lãi lỗ chi tiết cho từng xưởng.
- **Legal Entity Cashflow**: Theo dõi dòng tiền theo từng pháp nhân.

---

## 3. Hướng dẫn Vận hành (Workflow)

### Bước 1: Thiết lập Danh mục
- Truy cập danh mục Vật tư/Sản phẩm: Nhập giá trị vào trường **Giá định mức** (đây là giá kỳ vọng mà xưởng xuất hàng cho nội bộ).
- Khai báo **Tài sản cố định**: Nhập máy móc thiết bị, nguyên giá và gán cho xưởng đang sử dụng.

### Bước 2: Nghiệp vụ Hàng ngày
- **Chuyển kho nội bộ**: Khi xưởng A chuyển hàng cho xưởng B, chỉ cần tạo *Phiếu chuyển kho*. Hệ thống sẽ tự hạch toán:
    - Xưởng A: Ghi nhận Doanh thu (Giá định mức) và Giá vốn (Giá thực tế).
    - Xưởng B: Ghi nhận Nhập kho (Giá định mức).
- **Nhập/Xuất kho**: Mọi nghiệp vụ nhập mua, xuất sản xuất, xuất bán đều tự động hạch toán, kế toán không cần nhập tay lại.

### Bước 3: Nghiệp vụ Cuối tháng
1. **Chốt Lương**: Nhập tổng quỹ lương tháng vào module *Workshop Payroll* và duyệt.
2. **Trích Khấu hao**: Vào module *Fixed Asset*, chọn tháng/năm và bấm *Chạy khấu hao*.
3. **Phân bổ Chi phí**: Sử dụng tính năng *Allocate Overhead* để chia các hóa đơn điện, nước dùng chung cho các xưởng.
4. **Xem Báo cáo**: Mở API/Báo cáo *Workshop P&L* để xem kết quả kinh doanh của tháng.

---

## 4. Lưu ý quan trọng
- **Đối soát Thuế**: Khi làm báo cáo thuế, hãy sử dụng chế độ lọc bỏ các tài khoản nội bộ (`5112`, `6322`, `1368`, `3368`). Hệ thống đã tách biệt các tài khoản này để không làm ảnh hưởng đến báo cáo tài chính chính thức.
- **Tính nhất quán**: Đảm bảo mọi phiếu kho đều được chọn đúng Phân xưởng để số liệu báo cáo được tập hợp đầy đủ.

---
*Tài liệu được khởi tạo ngày 08/05/2026 bởi Antigravity AI.*
