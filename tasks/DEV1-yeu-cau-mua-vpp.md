# TASK DEV 1 — App Đặt Văn Phòng Phẩm (Yêu Cầu Mua VPP)

## Mục tiêu

Nhân viên có thể tạo yêu cầu mua văn phòng phẩm → Trưởng phòng duyệt → Bộ phận mua hàng nhận và xử lý.

## Kết quả cần đạt

- [ ] Nhân viên tạo được yêu cầu mua VPP (chọn mặt hàng, số lượng, lý do)
- [ ] Trưởng phòng nhận thông báo và duyệt/từ chối
- [ ] Bộ phận mua hàng thấy danh sách yêu cầu đã duyệt
- [ ] Người tạo xem được trạng thái yêu cầu của mình

---

## Code đã có sẵn (đọc trước khi code)

| File | Nội dung |
|---|---|
| `backend/app/routers/purchase_requisitions.py` | API yêu cầu mua hàng |
| `backend/app/models/purchase_requisition.py` | Model database |
| `frontend/src/pages/purchase/PurchaseRequisition*` | Màn hình UI |

**Bước đầu tiên:** Đọc 3 file trên để hiểu đang có gì.

---

## Các bước thực hiện

### Bước 1: Chạy project và xem UI hiện tại

1. Chạy project theo ONBOARDING.md
2. Vào menu **Mua hàng → Yêu cầu mua hàng**
3. Ghi chú lại: màn hình đang thiếu gì, nút nào chưa hoạt động

### Bước 2: Thêm trường "Loại VPP"

Hiện tại yêu cầu mua hàng dùng chung cho tất cả. Cần thêm loại "Văn phòng phẩm" để lọc riêng.

**Backend** — thêm field vào model:
```python
# File: backend/app/models/purchase_requisition.py
loai = Column(String, default="hang_hoa")
# Giá trị: "hang_hoa" | "van_phong_pham" | "nvl"
```

**Tạo migration:**
```powershell
cd backend
.\venv\Scripts\activate
alembic revision --autogenerate -m "add loai field to purchase_requisition"
alembic upgrade head
```

### Bước 3: Thêm workflow duyệt

Thêm các trạng thái vào model:

```python
# trang_thai hiện tại: "draft" | "submitted" | "approved" | "rejected"
# Cần thêm logic: chỉ trưởng phòng mới approve được
```

**Backend** — thêm API endpoint duyệt:
```python
# File: backend/app/routers/purchase_requisitions.py

@router.post("/{id}/approve")
def approve_requisition(id: int, db=Depends(get_db), user=Depends(get_current_user)):
    # Kiểm tra user có role "manager" không
    # Đổi trang_thai = "approved"
    # Trả về requisition đã cập nhật
    pass

@router.post("/{id}/reject")
def reject_requisition(id: int, ly_do: str, db=Depends(get_db), user=Depends(get_current_user)):
    pass
```

### Bước 4: Cập nhật giao diện

**Frontend** — file `frontend/src/pages/purchase/PurchaseRequisitionDetail.tsx`:
- Thêm nút **"Duyệt"** và **"Từ chối"** (chỉ hiện với role manager)
- Thêm badge màu cho từng trạng thái (xanh = approved, đỏ = rejected, vàng = pending)
- Thêm filter "Loại: Văn phòng phẩm" ở trang danh sách

### Bước 5: Test

- Đăng nhập tài khoản nhân viên thường → tạo yêu cầu VPP
- Đăng nhập tài khoản manager → duyệt yêu cầu
- Kiểm tra trạng thái cập nhật đúng chưa

---

## Lưu ý khi code

- Xem pattern của file `routers/purchase_orders.py` để viết API đúng chuẩn project
- Xem `frontend/src/pages/purchase/PurchaseOrder*.tsx` để viết UI đúng style
- Mọi API cần có `Depends(get_current_user)` — không được bỏ qua auth
- Commit sau mỗi bước nhỏ

---

## Hỏi anh Dương khi

- Không biết role "manager" được config ở đâu
- Cần thêm thông báo (notification) khi có yêu cầu mới
- Không chắc UI nên trông như thế nào
