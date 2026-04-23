from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import Customer
from app.schemas.master import CustomerCreate, CustomerUpdate, CustomerResponse, CustomerShort
from app.schemas.sales import PagedResponse

router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.get("", response_model=PagedResponse)
def list_customers(
    search: str = Query(default="", description="Tìm theo tên hoặc mã"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    trang_thai: bool = Query(default=True),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Customer).filter(Customer.trang_thai == trang_thai)
    if search:
        like = f"%{search}%"
        q = q.filter(
            Customer.ma_kh.ilike(like)
            | Customer.ten_viet_tat.ilike(like)
            | Customer.ten_don_vi.ilike(like)
        )
    total = q.count()
    items = q.order_by(Customer.ten_viet_tat).offset((page - 1) * page_size).limit(page_size).all()
    return PagedResponse(
        items=[CustomerShort.model_validate(c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/all", response_model=list[CustomerShort])
def get_all_customers(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    customers = db.query(Customer).filter(Customer.trang_thai == True).order_by(Customer.ten_viet_tat).all()
    return [CustomerShort.model_validate(c) for c in customers]


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")
    return CustomerResponse.model_validate(customer)


@router.post("", response_model=CustomerResponse, status_code=201)
def create_customer(
    data: CustomerCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if db.query(Customer).filter(Customer.ma_kh == data.ma_kh).first():
        raise HTTPException(status_code=400, detail=f"Mã khách hàng '{data.ma_kh}' đã tồn tại")
    customer = Customer(**data.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return CustomerResponse.model_validate(customer)


@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    data: CustomerUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return CustomerResponse.model_validate(customer)
