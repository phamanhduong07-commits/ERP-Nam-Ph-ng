# TASK DEV 2 — App Báo Hàng Cần Giao & Điều Phối Xe

## Mục tiêu

Nhân viên kho báo danh sách đơn hàng cần giao → Dispatcher phân công xe và tài xế → Tài xế biết lịch → Khách hàng/sale theo dõi trạng thái giao.

## Kết quả cần đạt

- [ ] Danh sách đơn hàng đến hạn giao hiển thị rõ ràng (ưu tiên cao/thấp)
- [ ] Dispatcher phân được xe + tài xế cho từng đơn
- [ ] Xem hàng đã giao / chưa giao được
- [ ] Lịch trình xe trong ngày hiển thị gọn

---

## Code đã có sẵn (đọc trước khi code)

| File | Nội dung |
|---|---|
| `backend/app/routers/yeu_cau_giao_hang.py` | API yêu cầu giao hàng |
| `backend/app/routers/xe.py` | Danh mục xe |
| `backend/app/routers/tai_xe.py` | Danh mục tài xế |
| `backend/app/routers/gps.py` | Theo dõi GPS xe |
| `frontend/src/pages/logistics/` | Màn hình logistics |

**Bước đầu tiên:** Đọc các file trên, vào menu **Logistics** trên UI xem đang có gì.

---

## Các bước thực hiện

### Bước 1: Hiểu dữ liệu hiện có

Vào **http://localhost:8001/api/docs**, tìm các endpoint:
- `/api/yeu-cau-giao-hang` — xem cấu trúc dữ liệu
- `/api/xe` — danh sách xe
- `/api/tai-xe` — danh sách tài xế

Chạy thử từng API, hiểu dữ liệu trả về.

### Bước 2: Trang "Hàng cần giao hôm nay"

Tạo file mới: `frontend/src/pages/logistics/CanGiaoHomNay.tsx`

Màn hình này hiển thị:
```
┌─────────────────────────────────────────┐
│ HÀNG CẦN GIAO HÔM NAY — 15/05/2026     │
├──────┬──────────┬──────────┬────────────┤
│ Đơn  │ Khách    │ Địa chỉ  │ Trạng thái │
├──────┼──────────┼──────────┼────────────┤
│ #001 │ Cty ABC  │ Q.1 HCM  │ 🔴 Chưa giao│
│ #002 │ Cty XYZ  │ Bình Dương│ 🟡 Đang giao│
│ #003 │ Cty DEF  │ Q.7 HCM  │ 🟢 Đã giao  │
└──────┴──────────┴──────────┴────────────┘
```

**API cần gọi:**
```typescript
// Lấy đơn hàng đến hạn giao hôm nay
GET /api/yeu-cau-giao-hang?ngay_giao=today&trang_thai=pending
```

### Bước 3: Tính năng phân công xe

Thêm vào màn hình: nút **"Phân công xe"** cho mỗi đơn.

**Backend** — thêm endpoint:
```python
# File: backend/app/routers/yeu_cau_giao_hang.py

@router.post("/{id}/phan-cong")
def phan_cong_xe(
    id: int,
    xe_id: int,
    tai_xe_id: int,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    # Cập nhật xe_id và tai_xe_id vào yeu_cau_giao_hang
    # Đổi trang_thai = "assigned"
    pass
```

**Frontend** — Modal phân công:
```
Chọn xe: [ Xe 51A-123 (còn trống) ▼ ]
Chọn tài xế: [ Nguyễn Văn A ▼ ]
[Xác nhận phân công]
```

### Bước 4: Trang lịch trình xe trong ngày

Tạo file: `frontend/src/pages/logistics/LichTrinhXe.tsx`

Hiển thị theo từng xe:
```
Xe 51A-123 — Tài xế: Nguyễn Văn A
  08:00  Đơn #001 → Cty ABC, Q.1
  10:30  Đơn #005 → Cty MNO, Q.3
  14:00  Đơn #008 → Cty PQR, Bình Dương

Xe 51B-456 — Tài xế: Trần Văn B
  09:00  Đơn #002 → Cty XYZ, Bình Dương
```

### Bước 5: Thêm vào menu

Mở `frontend/src/components/Sidebar.tsx` (hoặc tương tự), thêm 2 menu mới vào mục Logistics:
- Hàng cần giao hôm nay
- Lịch trình xe

### Bước 6: Test

- Tạo vài đơn hàng test có ngày giao hôm nay
- Thử phân công xe
- Kiểm tra lịch trình hiển thị đúng

---

## Lưu ý khi code

- Xem `frontend/src/pages/logistics/GpsTrackingPage.tsx` để hiểu pattern UI logistics
- API filter ngày: xem `routers/sales_orders.py` để biết cách filter theo ngày
- Commit sau mỗi bước nhỏ

---

## Hỏi anh Dương khi

- Không biết model `YeuCauGiaoHang` có field xe_id và tai_xe_id chưa
- Cần thêm thông báo cho tài xế khi được phân công
- Không rõ UI nên hiển thị thế nào
