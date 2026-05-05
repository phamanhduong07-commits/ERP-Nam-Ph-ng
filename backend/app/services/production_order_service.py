from datetime import date
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.sales import SalesOrderItem, SalesOrder
from app.models.master import Product
from app.schemas.production import (
    ProductionOrderCreate, ProductionOrderUpdate,
    ProductionOrderResponse, ProductionOrderListItem,
    PagedResponse
)


class ProductionOrderService:
    def __init__(self, db: Session):
        self.db = db

    def _generate_so_lenh(self) -> str:
        today = date.today()
        prefix = f"LSX{today.strftime('%Y%m%d')}"
        last = (
            self.db.query(ProductionOrder)
            .filter(ProductionOrder.so_lenh.like(f"{prefix}%"))
            .order_by(ProductionOrder.so_lenh.desc())
            .first()
        )
        if last:
            seq = int(last.so_lenh[-3:]) + 1
        else:
            seq = 1
        return f"{prefix}{seq:03d}"

    def get_production_orders_paginated(
        self,
        search: str = "",
        trang_thai: str = "",
        sales_order_id: int = None,
        tu_ngay: date = None,
        den_ngay: date = None,
        page: int = 1,
        page_size: int = 20,
    ) -> PagedResponse:
        q = self.db.query(ProductionOrder).options(
            joinedload(ProductionOrder.sales_order).joinedload(SalesOrder.customer),
            joinedload(ProductionOrder.phap_nhan_sx),
            joinedload(ProductionOrder.kho_sx),
        )

        if search:
            like = f"%{search}%"
            q = q.filter(ProductionOrder.so_lenh.ilike(like))
        if trang_thai:
            q = q.filter(ProductionOrder.trang_thai == trang_thai)
        if sales_order_id:
            q = q.filter(ProductionOrder.sales_order_id == sales_order_id)
        if tu_ngay:
            q = q.filter(ProductionOrder.ngay_tao >= tu_ngay)
        if den_ngay:
            q = q.filter(ProductionOrder.ngay_tao <= den_ngay)

        total = q.count()
        orders = q.order_by(ProductionOrder.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

        items = []
        for o in orders:
            items.append(ProductionOrderListItem(
                id=o.id,
                so_lenh=o.so_lenh,
                ngay_tao=o.ngay_tao,
                sales_order_id=o.sales_order_id,
                so_don=o.sales_order.so_don if o.sales_order else None,
                ten_khach_hang=o.sales_order.customer.ten_viet_tat if o.sales_order and o.sales_order.customer else None,
                phap_nhan_sx_id=o.phap_nhan_sx_id,
                ten_phap_nhan_sx=o.phap_nhan_sx.ten_phap_nhan if o.phap_nhan_sx else None,
                kho_sx_id=o.kho_sx_id,
                ten_kho_sx=o.kho_sx.ten_kho if o.kho_sx else None,
                trang_thai=o.trang_thai,
                tong_so_luong=o.tong_so_luong,
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

    def get_production_order_by_id(self, order_id: int) -> ProductionOrderResponse:
        order = self.db.query(ProductionOrder).options(
            joinedload(ProductionOrder.phan_xuong),
            joinedload(ProductionOrder.items).joinedload(ProductionOrderItem.sales_order_item)
        ).filter(ProductionOrder.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Không tìm thấy lệnh sản xuất")
        return ProductionOrderResponse.model_validate(order)

    def create_production_order(self, data: ProductionOrderCreate, user_id: int) -> ProductionOrderResponse:
        if data.sales_order_id:
            so = self.db.query(SalesOrder).filter(SalesOrder.id == data.sales_order_id).first()
            if not so:
                raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
            if so.trang_thai not in ("da_duyet", "dang_sx"):
                raise HTTPException(status_code=400, detail="Chỉ tạo lệnh SX từ đơn hàng đã duyệt")

        order_data = data.model_dump(exclude={'items'})
        order_data['so_lenh'] = self._generate_so_lenh()
        order_data['created_by'] = user_id
        order_data['trang_thai'] = "moi"
        order = ProductionOrder(**order_data)
        self.db.add(order)

        for item_data in data.items:
            product = None
            if item_data.product_id:
                product = self.db.query(Product).filter(Product.id == item_data.product_id).first()
            item = ProductionOrderItem(
                production_order=order,
                product_id=item_data.product_id,
                sales_order_item_id=item_data.sales_order_item_id,
                ten_hang=item_data.ten_hang or (product.ten_hang if product else ""),
                so_luong_ke_hoach=item_data.so_luong_ke_hoach,
                dvt=item_data.dvt,
                ngay_giao_hang=item_data.ngay_giao_hang,
                ghi_chu=item_data.ghi_chu,
            )
            self.db.add(item)

        # Cập nhật trạng thái đơn hàng → dang_sx
        if data.sales_order_id:
            so = self.db.query(SalesOrder).filter(SalesOrder.id == data.sales_order_id).first()
            if so and so.trang_thai == "da_duyet":
                so.trang_thai = "dang_sx"

        self.db.commit()
        self.db.refresh(order)
        return ProductionOrderResponse.model_validate(order)

    def update_production_order(self, order_id: int, data: ProductionOrderUpdate) -> ProductionOrderResponse:
        order = self.db.query(ProductionOrder).filter(ProductionOrder.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Không tìm thấy lệnh sản xuất")
        if order.trang_thai == "huy":
            raise HTTPException(status_code=400, detail="Lệnh đã huỷ, không thể sửa")
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(order, key, value)
        self.db.commit()
        self.db.refresh(order)
        return ProductionOrderResponse.model_validate(order)