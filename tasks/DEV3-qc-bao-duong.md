# TASK DEV 3 — Chất Lượng (QC) & Bảo Dưỡng Máy

## Mục tiêu

**QC:** Kiểm tra chất lượng sản phẩm theo từng lô sản xuất, ghi nhận lỗi, cảnh báo khi lỗi vượt ngưỡng.

**Bảo dưỡng:** Lịch bảo dưỡng máy định kỳ, cảnh báo khi đến hạn, ghi nhận kết quả bảo dưỡng.

## Kết quả cần đạt

**QC:**
- [ ] Tạo phiếu kiểm tra chất lượng cho từng lô sản xuất
- [ ] Ghi nhận số lượng đạt/lỗi và loại lỗi
- [ ] Hiển thị cảnh báo khi tỷ lệ lỗi > ngưỡng cho phép

**Bảo dưỡng:**
- [ ] Lịch bảo dưỡng hiển thị rõ máy nào cần bảo dưỡng khi nào
- [ ] Cảnh báo khi đến hạn (còn 3 ngày, quá hạn)
- [ ] Ghi nhận đã bảo dưỡng xong

---

## Code đã có sẵn (đọc trước khi code)

| File | Nội dung |
|---|---|
| `backend/app/routers/quality_control.py` | API kiểm tra chất lượng |
| `backend/app/routers/maintenance.py` | API bảo dưỡng |
| `backend/app/models/quality.py` | Model QC |
| `frontend/src/pages/quality/` | Màn hình QC |
| `frontend/src/pages/maintenance/` | Màn hình bảo dưỡng |

**Bước đầu tiên:** Đọc các file trên, vào menu **Chất lượng** và **Bảo dưỡng** xem đang có gì.

---

## PHẦN 1: CHẤT LƯỢNG (QC)

### Bước 1: Hiểu flow kiểm tra

Mỗi lô sản xuất (ProductionOrder) sau khi xong cần được QC kiểm tra:
```
Lệnh SX hoàn thành → Tạo phiếu QC → Kiểm tra → Ghi kết quả → Pass/Fail
```

### Bước 2: Thêm loại lỗi (DefectType)

Hiện tại chưa có danh mục loại lỗi. Thêm vào:

**Backend** — file `backend/app/models/quality.py`:
```python
class DefectType(Base):
    __tablename__ = "defect_types"
    id = Column(Integer, primary_key=True)
    ma_loi = Column(String)        # VD: "THAM_NUOC", "BO_IN"
    ten_loi = Column(String)       # VD: "Thấm nước", "Bỏ in"
    mo_ta = Column(String)
```

**Tạo migration:**
```powershell
alembic revision --autogenerate -m "add defect_types table"
alembic upgrade head
```

### Bước 3: Cập nhật phiếu QC

Thêm chi tiết lỗi vào phiếu kiểm tra:

```python
# Thêm vào QualityCheck model:
so_luong_kiem = Column(Integer)     # Tổng số kiểm tra
so_luong_dat = Column(Integer)      # Số đạt
so_luong_loi = Column(Integer)      # Số lỗi
# Chi tiết lỗi lưu dạng JSON:
chi_tiet_loi = Column(JSON)
# VD: [{"defect_type_id": 1, "so_luong": 5}, {"defect_type_id": 2, "so_luong": 2}]
ket_qua = Column(String)            # "pass" | "fail" | "pending"
```

### Bước 4: Cảnh báo tỷ lệ lỗi

**Backend** — thêm logic vào API:
```python
# Khi lưu phiếu QC, tự động tính:
ty_le_loi = so_luong_loi / so_luong_kiem * 100
if ty_le_loi > 5:  # Ngưỡng 5% — hỏi anh Dương con số thực tế
    ket_qua = "fail"
else:
    ket_qua = "pass"
```

**Frontend** — hiển thị badge cảnh báo màu đỏ khi tỷ lệ lỗi cao.

---

## PHẦN 2: BẢO DƯỠNG MÁY

### Bước 5: Xem lịch bảo dưỡng hiện tại

Vào menu Bảo dưỡng, kiểm tra màn hình đang hiển thị gì.

### Bước 6: Thêm cảnh báo đến hạn

**Backend** — thêm endpoint:
```python
# File: backend/app/routers/maintenance.py

@router.get("/can-bao-duong")
def get_sap_den_han(db=Depends(get_db), user=Depends(get_current_user)):
    """Lấy danh sách máy cần bảo dưỡng trong 7 ngày tới"""
    from datetime import date, timedelta
    ngay_canh_bao = date.today() + timedelta(days=7)
    return db.query(MaintenanceSchedule).filter(
        MaintenanceSchedule.ngay_bao_duong_tiep <= ngay_canh_bao,
        MaintenanceSchedule.trang_thai != "done"
    ).all()
```

### Bước 7: Dashboard cảnh báo

**Frontend** — tạo widget cảnh báo ở trang Bảo dưỡng:
```
⚠️ MÁY SẮP ĐẾN HẠN BẢO DƯỠNG
┌──────────────┬──────────────┬──────────┐
│ Máy          │ Hạn bảo dưỡng│ Còn      │
├──────────────┼──────────────┼──────────┤
│ Máy in #1    │ 20/05/2026   │ 🔴 1 ngày │
│ Máy cắt #2   │ 22/05/2026   │ 🟡 3 ngày │
│ Máy dán #1   │ 25/05/2026   │ 🟢 6 ngày │
└──────────────┴──────────────┴──────────┘
```

### Bước 8: Nút "Đã bảo dưỡng xong"

Thêm vào màn hình chi tiết: nút xác nhận đã bảo dưỡng → tự động tính ngày bảo dưỡng tiếp theo.

```python
@router.post("/{id}/hoan-thanh")
def hoan_thanh_bao_duong(id: int, ghi_chu: str, db=Depends(get_db), user=Depends(get_current_user)):
    schedule = db.query(MaintenanceSchedule).get(id)
    schedule.trang_thai = "done"
    schedule.ngay_thuc_hien = date.today()
    # Tạo lịch bảo dưỡng tiếp theo
    schedule_moi = MaintenanceSchedule(
        may_id=schedule.may_id,
        ngay_bao_duong_tiep=date.today() + timedelta(days=schedule.chu_ky_ngay),
        trang_thai="pending"
    )
    db.add(schedule_moi)
    db.commit()
```

---

## Thứ tự làm (quan trọng)

1. Làm QC trước (bước 1-4)
2. Test QC hoạt động ổn
3. Làm Bảo dưỡng (bước 5-8)
4. Test Bảo dưỡng
5. Tạo Pull Request

---

## Hỏi anh Dương khi

- Ngưỡng % lỗi chấp nhận được là bao nhiêu?
- Máy móc trong nhà máy gồm những loại nào? (để tạo dữ liệu mẫu)
- Chu kỳ bảo dưỡng thường là bao nhiêu ngày?
