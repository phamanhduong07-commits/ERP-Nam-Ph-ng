from fastapi import HTTPException
from sqlalchemy import exists, or_
from sqlalchemy.orm import Session, selectinload
from app.models.master import Customer, CustomerNhanVien
from app.schemas.master import CustomerCreate, CustomerUpdate, CustomerResponse, CustomerShort
from app.schemas.sales import PagedResponse


def _scope_filter(scope_user_id: int):
    """Filter: customer phụ trách bởi user này (nv_phu_trach_id hoặc junction table)."""
    return or_(
        Customer.nv_phu_trach_id == scope_user_id,
        exists().where(
            (CustomerNhanVien.customer_id == Customer.id)
            & (CustomerNhanVien.user_id == scope_user_id)
        ),
    )


def _nv_ids(customer: Customer) -> list[int]:
    return [cnv.user_id for cnv in customer.nhan_vien]


def _to_short(c: Customer) -> CustomerShort:
    return CustomerShort(
        id=c.id,
        ma_kh=c.ma_kh,
        ten_viet_tat=c.ten_viet_tat,
        ten_don_vi=c.ten_don_vi,
        dien_thoai=c.dien_thoai,
        nv_ids=_nv_ids(c),
    )


def _to_response(c: Customer) -> CustomerResponse:
    data = CustomerResponse.model_validate(c)
    data.nv_ids = _nv_ids(c)
    return data


class CustomerService:
    def __init__(self, db: Session):
        self.db = db

    def _load_opts(self):
        return selectinload(Customer.nhan_vien)

    def get_customers_paginated(
        self,
        search: str = "",
        page: int = 1,
        page_size: int = 20,
        trang_thai: bool = True,
        nv_id: int | None = None,
        scope_user_id: int | None = None,
    ) -> PagedResponse:
        q = self.db.query(Customer).options(self._load_opts()).filter(Customer.trang_thai == trang_thai)
        if scope_user_id is not None:
            q = q.filter(_scope_filter(scope_user_id))
        if search:
            like = f"%{search}%"
            q = q.filter(
                Customer.ma_kh.ilike(like)
                | Customer.ten_viet_tat.ilike(like)
                | Customer.ten_don_vi.ilike(like)
                | Customer.ma_so_thue.ilike(like)
            )
        if nv_id is not None:
            q = q.filter(
                exists().where(
                    (CustomerNhanVien.customer_id == Customer.id)
                    & (CustomerNhanVien.user_id == nv_id)
                )
            )
        total = q.count()
        items = q.order_by(Customer.ten_viet_tat).offset((page - 1) * page_size).limit(page_size).all()
        return PagedResponse(
            items=[_to_response(c) for c in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size,
        )

    def get_all_active_customers(self, scope_user_id: int | None = None) -> list[CustomerShort]:
        q = (
            self.db.query(Customer)
            .options(self._load_opts())
            .filter(Customer.trang_thai.is_(True))
        )
        if scope_user_id is not None:
            q = q.filter(_scope_filter(scope_user_id))
        customers = q.order_by(Customer.ten_viet_tat).all()
        return [_to_short(c) for c in customers]

    def get_customer_by_id(self, customer_id: int, scope_user_id: int | None = None) -> CustomerResponse:
        customer = (
            self.db.query(Customer)
            .options(self._load_opts())
            .filter(Customer.id == customer_id)
            .first()
        )
        if not customer:
            raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")
        if scope_user_id is not None:
            from sqlalchemy import func
            in_scope = self.db.query(Customer).filter(
                Customer.id == customer_id,
                _scope_filter(scope_user_id),
            ).first()
            if not in_scope:
                raise HTTPException(status_code=403, detail="Không có quyền xem khách hàng này")
        return _to_response(customer)

    def create_customer(self, data: CustomerCreate) -> CustomerResponse:
        if self.db.query(Customer).filter(Customer.ma_kh == data.ma_kh).first():
            raise HTTPException(status_code=400, detail=f"Mã khách hàng '{data.ma_kh}' đã tồn tại")
        customer = Customer(**data.model_dump())
        self.db.add(customer)
        self.db.commit()
        self.db.refresh(customer)
        return _to_response(customer)

    def update_customer(self, customer_id: int, data: CustomerUpdate) -> CustomerResponse:
        customer = (
            self.db.query(Customer)
            .options(self._load_opts())
            .filter(Customer.id == customer_id)
            .first()
        )
        if not customer:
            raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")

        payload = data.model_dump(exclude_unset=True)
        nv_ids = payload.pop("nv_ids", None)

        for field, value in payload.items():
            setattr(customer, field, value)

        # Sync junction table when nv_ids explicitly provided
        if nv_ids is not None:
            self.db.query(CustomerNhanVien).filter(
                CustomerNhanVien.customer_id == customer_id
            ).delete()
            for uid in nv_ids:
                self.db.add(CustomerNhanVien(customer_id=customer_id, user_id=uid))

        self.db.commit()
        self.db.refresh(customer)
        return _to_response(customer)
