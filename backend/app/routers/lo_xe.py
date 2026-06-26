from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from decimal import Decimal
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import LoXe
from app.models.hr import Employee

router = APIRouter(prefix="/api/lo-xe", tags=["lo-xe"])


class LoXeBase(BaseModel):
    ho_ten: str
    so_dien_thoai: str | None = None
    employee_id: int | None = None
    he_so_chuyen: Decimal = Decimal("0.3")
    ghi_chu: str | None = None
    trang_thai: bool = True


class LoXeResponse(LoXeBase):
    id: int

    class Config:
        from_attributes = True


@router.get("", response_model=list[LoXeResponse])
def list_lo_xe(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(LoXe).filter(LoXe.trang_thai.is_(True)).order_by(LoXe.ho_ten).all()


@router.post("", response_model=LoXeResponse, status_code=201)
def create_lo_xe(
    data: LoXeBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = LoXe(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=LoXeResponse)
def update_lo_xe(
    id: int,
    data: LoXeBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(LoXe).filter(LoXe.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy lơ xe")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{id}")
def delete_lo_xe(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(LoXe).filter(LoXe.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy lơ xe")
    db.delete(obj)
    db.commit()
    return {"ok": True}


@router.post("/sync-from-employees")
def sync_lo_xe_from_employees(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Đồng bộ danh sách lơ xe từ hồ sơ nhân viên có is_lo_xe=True."""
    assistants = (
        db.query(Employee)
        .filter(Employee.is_lo_xe.is_(True), Employee.trang_thai != "da_nghi")
        .all()
    )
    created = updated = 0
    for emp in assistants:
        existing = db.query(LoXe).filter(LoXe.employee_id == emp.id).first()
        if existing:
            existing.ho_ten = emp.ho_ten
            existing.so_dien_thoai = emp.so_dien_thoai
            existing.trang_thai = emp.trang_thai == "dang_lam"
            updated += 1
        else:
            obj = LoXe(
                ho_ten=emp.ho_ten,
                so_dien_thoai=emp.so_dien_thoai,
                employee_id=emp.id,
                he_so_chuyen=Decimal("0.3"),
                trang_thai=emp.trang_thai == "dang_lam",
            )
            db.add(obj)
            created += 1
    db.commit()
    return {"created": created, "updated": updated, "total": len(assistants)}
