from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime, timezone
from app.database import get_db
from app.deps import get_current_user
from app.models.hr import LeaveRequest, Employee, AttendanceLog
from app.models.auth import User
from pydantic import BaseModel
from decimal import Decimal

router = APIRouter(prefix="/api/hr", tags=["HR Approval Workflow"])

# --- Schemas ---
class LeaveRequestCreate(BaseModel):
    employee_id: int
    loai_don: str # nghi_phep | tang_ca | di_muon_ve_som | cong_tac
    ngay_bat_dau: datetime
    ngay_ket_thuc: datetime
    tong_ngay: Decimal
    ly_do: Optional[str] = None

class LeaveRequestUpdate(BaseModel):
    trang_thai: str # phong_ban_duyet | bgd_duyet | tu_choi | huy
    y_kien_duyet: Optional[str] = None
    nguoi_duyet_id: int

# --- API Endpoints ---

@router.get("/leave-requests")
def list_leave_requests(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(LeaveRequest)
    if status:
        query = query.filter(LeaveRequest.trang_thai == status)
    
    requests = query.order_by(LeaveRequest.created_at.desc()).all()
    
    result = []
    for req in requests:
        result.append({
            "id": req.id,
            "employee": {"ho_ten": req.employee.ho_ten, "ma_nv": req.employee.ma_nv},
            "loai_don": req.loai_don,
            "ngay_bat_dau": req.ngay_bat_dau.isoformat(),
            "ngay_ket_thuc": req.ngay_ket_thuc.isoformat(),
            "tong_ngay": req.tong_ngay,
            "ly_do": req.ly_do,
            "trang_thai": req.trang_thai,
            "created_at": req.created_at.isoformat()
        })
    return result

@router.post("/leave-requests")
def create_leave_request(body: LeaveRequestCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    db_obj = LeaveRequest(**body.model_dump())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return {"status": "success", "id": db_obj.id}

@router.put("/leave-requests/{id}/approve")
def approve_leave_request(id: int, body: LeaveRequestUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    req = db.query(LeaveRequest).filter(LeaveRequest.id == id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn")
    
    req.trang_thai = body.trang_thai
    req.y_kien_duyet = body.y_kien_duyet
    req.ngay_duyet = datetime.now(timezone.utc)
    
    # Nếu là trưởng phòng duyệt
    if body.trang_thai == "phong_ban_duyet":
        req.nguoi_duyet_dept_id = body.nguoi_duyet_id
    # Nếu là BGD duyệt (Duyệt cuối)
    elif body.trang_thai == "bgd_duyet":
        req.nguoi_duyet_bgd_id = body.nguoi_duyet_id
        
        # TỰ ĐỘNG CẬP NHẬT VÀO CHẤM CÔNG NẾU LÀ NGHỈ PHÉP
        if req.loai_don == "nghi_phep":
            # Logic tạo/cập nhật AttendanceLog cho các ngày nghỉ
            # (Tạm thời note lại để triển khai chi tiết sau)
            pass
            
    db.commit()
    return {"status": "approved"}
