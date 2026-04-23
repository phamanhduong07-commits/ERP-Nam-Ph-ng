from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import Supplier
from app.schemas.sales import PagedResponse

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class SupplierShort(BaseModel):
    id: int
    ma_ncc: str
    ten_viet_tat: str
    ten_don_vi: str | None = None
    dien_thoai: str | None = None
    trang_thai: bool

    class Config:
        from_attributes = True


class SupplierCreate(BaseModel):
    ma_ncc: str
    ten_viet_tat: str
    ten_don_vi: str | None = None
    dia_chi: str | None = None
    dien_thoai: str | None = None
    fax: str | None = None
    di_dong: str | None = None
    ma_so_thue: str | None = None
    nguoi_dai_dien: str | None = None
    phan_loai: str | None = None
    ma_ncc_amis: str | None = None
    ghi_chu: str | None = None


class SupplierUpdate(BaseModel):
    ma_ncc: str | None = None
    ten_viet_tat: str | None = None
    ten_don_vi: str | None = None
    dia_chi: str | None = None
    dien_thoai: str | None = None
    fax: str | None = None
    di_dong: str | None = None
    ma_so_thue: str | None = None
    nguoi_dai_dien: str | None = None
    phan_loai: str | None = None
    ma_ncc_amis: str | None = None
    ghi_chu: str | None = None
    trang_thai: bool | None = None


class SupplierResponse(BaseModel):
    id: int
    ma_ncc: str
    ten_viet_tat: str
    ten_don_vi: str | None = None
    dia_chi: str | None = None
    dien_thoai: str | None = None
    fax: str | None = None
    di_dong: str | None = None
    ma_so_thue: str | None = None
    nguoi_dai_dien: str | None = None
    phan_loai: str | None = None
    ma_ncc_amis: str | None = None
    ghi_chu: str | None = None
    trang_thai: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=PagedResponse)
def list_suppliers(
    search: str = Query(default="", description="Tìm theo tên hoặc mã"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    trang_thai: bool = Query(default=True),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Supplier).filter(Supplier.trang_thai == trang_thai)
    if search:
        like = f"%{search}%"
        q = q.filter(
            Supplier.ma_ncc.ilike(like)
            | Supplier.ten_viet_tat.ilike(like)
            | Supplier.ten_don_vi.ilike(like)
        )
    total = q.count()
    items = q.order_by(Supplier.ten_viet_tat).offset((page - 1) * page_size).limit(page_size).all()
    return PagedResponse(
        items=[SupplierShort.model_validate(s) for s in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/all", response_model=list[SupplierShort])
def get_all_suppliers(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    items = db.query(Supplier).filter(Supplier.trang_thai == True).order_by(Supplier.ten_viet_tat).all()
    return [SupplierShort.model_validate(s) for s in items]


@router.get("/{id}", response_model=SupplierResponse)
def get_supplier(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(Supplier).filter(Supplier.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhà cung cấp")
    return SupplierResponse.model_validate(obj)


@router.post("", response_model=SupplierResponse, status_code=201)
def create_supplier(
    data: SupplierCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if db.query(Supplier).filter(Supplier.ma_ncc == data.ma_ncc).first():
        raise HTTPException(status_code=400, detail=f"Mã NCC '{data.ma_ncc}' đã tồn tại")
    obj = Supplier(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return SupplierResponse.model_validate(obj)


@router.put("/{id}", response_model=SupplierResponse)
def update_supplier(
    id: int,
    data: SupplierUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(Supplier).filter(Supplier.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhà cung cấp")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return SupplierResponse.model_validate(obj)
