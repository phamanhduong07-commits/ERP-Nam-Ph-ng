from datetime import date
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from app.models.sales import SalesOrder, SalesOrderItem
from app.models.master import Customer
from app.schemas.sales import (
    SalesOrderCreate, SalesOrderUpdate, SalesOrderResponse,
    SalesOrderListItem, PagedResponse
)


class SalesOrderService:
    def __init__(self, db: Session):
        self.db = db

    def _generate_so_don(self) -> str:
        today = date.today()
        prefix = f"DH{today.strftime('%Y%m%d')}"
        last = (
            self.db.query(SalesOrder)
            .filter(SalesOrder.so_don.like(f"{prefix}%"))
            .order_by(SalesOrder.so_don.desc())
            .first()
        )
        if last:
            seq = int(last.so_don[-3:]) + 1
        else:
            seq = 1
        return f"{prefix}{seq:03d}"

    def get_sales_orders_paginated(
        self,
        search: str = "",
        trang_thai: str = "",
        customer_id: int = None,
        tu_ngay: str = None,
        den_ngay: str = None,
        page: int = 1,
        page_size: int = 20,
    ) -> PagedResponse:
        q = self.db.query(SalesOrder).options(joinedload(SalesOrder.customer))

        if search:
            like = f"%{search}%"
            q = q.join(Customer).filter(
                SalesOrder.so_don.ilike(like) | Customer.ten_viet_tat.ilike(like)
            )
        if trang_thai:
            q = q.filter(SalesOrder.trang_thai == trang_thai)
        if customer_id:
            q = q.filter(SalesOrder.customer_id == customer_id)
        if tu_ngay:
            q = q.filter(SalesOrder.ngay_don >= tu_ngay)
        if den_ngay:
            q = q.filter(SalesOrder.ngay_don <= den_ngay)

        total = q.count()
        orders = q.order_by(SalesOrder.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

        items = []
        for o in orders:
            items.append(SalesOrderListItem(
                id=o.id,
                so_don=o.so_don,
                ngay_don=o.ngay_don,
                customer_id=o.customer_id,
                ten_khach_hang=o.customer.ten_viet_tat if o.customer else None,
                trang_thai=o.trang_thai,
                ngay_giao_hang=o.ngay_giao_hang,
                tong_tien=o.tong_tien,
                so_dong=len(o.items),
                created_at=o.created_at,
            ))

        return PagedResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size,
        )

    def get_sales_order_by_id(self, order_id: int) -> SalesOrderResponse:
        order = (
            self.db.query(SalesOrder)
            .options(
                joinedload(SalesOrder.customer),
                joinedload(SalesOrder.phap_nhan),
                joinedload(SalesOrder.phap_nhan_sx),
                joinedload(SalesOrder.phan_xuong),
                joinedload(SalesOrder.items).joinedload(SalesOrderItem.product),
                joinedload(SalesOrder.items).joinedload(SalesOrderItem.quote_item).joinedload(QuoteItem.quote),
            )
            .filter(SalesOrder.id == order_id)
            .first()
        )
        if not order:
            raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

        # Process items with spec fallback
        for item in order.items:
            self._apply_spec_fallback(item)

        return SalesOrderResponse.model_validate(order)

    def _apply_spec_fallback(self, item: SalesOrderItem):
        """Apply spec fallback from QuoteItem if SOItem fields are NULL."""
        if item.quote_item:
            for field in ['ten_hang', 'dvt', 'don_gia', 'ghi_chu']:
                if getattr(item, field, None) is None:
                    setattr(item, field, getattr(item.quote_item, field, None))

    def create_sales_order(self, data: SalesOrderCreate, user_id: int) -> SalesOrderResponse:
        order_data = data.model_dump()
        if not order_data.get('so_don'):
            order_data['so_don'] = self._generate_so_don()
        order_data['created_by'] = user_id
        order = SalesOrder(**order_data)
        self.db.add(order)
        self.db.commit()
        self.db.refresh(order)
        return SalesOrderResponse.model_validate(order)

    def update_sales_order(self, order_id: int, data: SalesOrderUpdate) -> SalesOrderResponse:
        order = self.db.query(SalesOrder).filter(SalesOrder.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(order, key, value)
        self.db.commit()
        self.db.refresh(order)
        return SalesOrderResponse.model_validate(order)