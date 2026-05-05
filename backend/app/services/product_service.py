from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.master import Product
from app.schemas.master import ProductCreate, ProductUpdate, ProductResponse, ProductShort
from app.schemas.sales import PagedResponse


class ProductService:
    def __init__(self, db: Session):
        self.db = db

    def get_products_paginated(
        self,
        search: str = "",
        ma_kh_id: int = None,
        so_lop: int = None,
        page: int = 1,
        page_size: int = 20,
    ) -> PagedResponse:
        q = self.db.query(Product).filter(Product.trang_thai == True)
        if search:
            like = f"%{search}%"
            q = q.filter(
                Product.ma_amis.ilike(like)
                | Product.ma_hang.ilike(like)
                | Product.ten_hang.ilike(like)
            )
        if ma_kh_id:
            q = q.filter(Product.ma_kh_id == ma_kh_id)
        if so_lop:
            q = q.filter(Product.so_lop == so_lop)

        total = q.count()
        items = q.order_by(Product.ten_hang).offset((page - 1) * page_size).limit(page_size).all()
        return PagedResponse(
            items=[ProductShort.model_validate(p) for p in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size,
        )

    def get_products_by_customer(self, customer_id: int) -> list[ProductShort]:
        products = self.db.query(Product).filter(
            Product.ma_kh_id == customer_id,
            Product.trang_thai == True
        ).order_by(Product.ten_hang).all()
        return [ProductShort.model_validate(p) for p in products]

    def get_product_by_id(self, product_id: int) -> ProductResponse:
        product = self.db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Không tìm thấy sản phẩm")
        return ProductResponse.model_validate(product)

    def create_product(self, data: ProductCreate) -> ProductResponse:
        product = Product(**data.model_dump())
        self.db.add(product)
        self.db.commit()
        self.db.refresh(product)
        return ProductResponse.model_validate(product)

    def update_product(self, product_id: int, data: ProductUpdate) -> ProductResponse:
        product = self.db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Không tìm thấy sản phẩm")
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(product, key, value)
        self.db.commit()
        self.db.refresh(product)
        return ProductResponse.model_validate(product)