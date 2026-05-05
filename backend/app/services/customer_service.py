from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.master import Customer
from app.schemas.master import CustomerCreate, CustomerUpdate, CustomerResponse, CustomerShort
from app.schemas.sales import PagedResponse


class CustomerService:
    def __init__(self, db: Session):
        self.db = db

    def get_customers_paginated(
        self,
        search: str = "",
        page: int = 1,
        page_size: int = 20,
        trang_thai: bool = True,
    ) -> PagedResponse:
        q = self.db.query(Customer).filter(Customer.trang_thai == trang_thai)
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

    def get_all_active_customers(self) -> list[CustomerShort]:
        customers = self.db.query(Customer).filter(Customer.trang_thai == True).order_by(Customer.ten_viet_tat).all()
        return [CustomerShort.model_validate(c) for c in customers]

    def get_customer_by_id(self, customer_id: int) -> CustomerResponse:
        customer = self.db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")
        return CustomerResponse.model_validate(customer)

    def create_customer(self, data: CustomerCreate) -> CustomerResponse:
        if self.db.query(Customer).filter(Customer.ma_kh == data.ma_kh).first():
            raise HTTPException(status_code=400, detail=f"Mã khách hàng '{data.ma_kh}' đã tồn tại")
        customer = Customer(**data.model_dump())
        self.db.add(customer)
        self.db.commit()
        self.db.refresh(customer)
        return CustomerResponse.model_validate(customer)

    def update_customer(self, customer_id: int, data: CustomerUpdate) -> CustomerResponse:
        customer = self.db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(customer, field, value)
        self.db.commit()
        self.db.refresh(customer)
        return CustomerResponse.model_validate(customer)