# HƯỚNG DẪN VẬN HÀNH & QUẢN LÝ DỮ LIỆU ERP NAM PHƯƠNG

Tài liệu này ghi lại các thay đổi quan trọng sau đợt khôi phục hệ thống (Tháng 05/2026).

## 1. Thay đổi cốt lõi (Core Changes)
- **Cơ sở dữ liệu:** Đã chuyển hoàn toàn từ **SQLite** (`.db` file) sang **PostgreSQL**.
- **Lý do:** Tăng hiệu năng, tính bảo mật và khả năng mở rộng cho báo cáo kế toán.
- **Dữ liệu hiện tại:** Đã migrate toàn bộ danh mục Master (13.000+ bản ghi) từ máy cũ sang Postgres.

## 2. Thông tin kỹ thuật (Technical Info)
- **Database Engine:** PostgreSQL 15+
- **DB Name:** `erp_nam_phuong`
- **Cổng Backend:** 8088
- **Cổng Frontend:** 5178
- **Tài khoản Admin khôi phục:** `admin` / `admin123`

## 3. Luồng khởi động (Startup Workflow)
Mỗi khi khởi động máy, cần thực hiện theo thứ tự:

### Bước 1: Kiểm tra Database
Đảm bảo PostgreSQL Service đã chạy. (Mở `Services.msc` trên Windows, tìm `postgresql-x64-15`).

### Bước 2: Chạy Backend
Mở Terminal tại `backend/`:
```powershell
.\venv\Scripts\activate
python main.py
```

### Bước 3: Chạy Frontend
Mở Terminal tại `frontend/`:
```bash
npm run dev
```

## 4. Quản lý dữ liệu (Data Management)
- **Dữ liệu mới:** Mọi thông tin nhập từ giao diện web sẽ lưu trực tiếp vào **PostgreSQL**. 
- **File đính kèm:** Lưu tại `backend/static/uploads/`.
- **Lưu ý quan trọng:** Không nhập dữ liệu vào file `.db` cũ vì hệ thống không còn sử dụng file đó.

## 5. Quy trình Sao lưu (Backup) - QUAN TRỌNG
Vì dữ liệu không còn là 1 file đơn lẻ như SQLite, cần dùng công cụ để backup:
1. Mở **pgAdmin 4**.
2. Chuột phải vào database `erp_nam_phuong` -> chọn **Backup...**
3. Lưu file thành định dạng `.backup` (nên đặt tên theo ngày, ví dụ: `erp_backup_2026_05_08.backup`).
4. **Khuyến nghị:** Backup 1 lần/tuần và lưu vào Google Drive hoặc USB.

## 6. Xử lý lỗi thường gặp
- **Lỗi 422 khi load vật tư:** Thường do dữ liệu cũ có các trường NULL. Đã được xử lý trong code bằng cách ép kiểu an toàn. Nếu gặp lại, kiểm tra log tại `backend/backend.log`.
- **Trang báo cáo trống:** Do dữ liệu giao dịch cũ (Sổ cái) không có trong file backup ban đầu. Cần nhập mới hoặc khôi phục từ file dump kế toán riêng biệt.

---
*Người soạn: Antigravity AI Assistant*
*Ngày cập nhật: 08/05/2026*
