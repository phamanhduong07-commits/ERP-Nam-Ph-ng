from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.services.customer_service import CustomerService
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
    service = CustomerService(db)
    return service.get_customers_paginated(search, page, page_size, trang_thai)


@router.get("/all", response_model=list[CustomerShort])
def get_all_customers(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    service = CustomerService(db)
    return service.get_all_active_customers()


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    service = CustomerService(db)
    return service.get_customer_by_id(customer_id)


@router.post("", response_model=CustomerResponse, status_code=201)
def create_customer(
    data: CustomerCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    service = CustomerService(db)
    return service.create_customer(data)


@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    data: CustomerUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    service = CustomerService(db)
    return service.update_customer(customer_id, data)
