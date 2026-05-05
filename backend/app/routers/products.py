from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.services.product_service import ProductService
from app.schemas.master import ProductCreate, ProductUpdate, ProductResponse, ProductShort
from app.schemas.sales import PagedResponse

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=PagedResponse)
def list_products(
    search: str = Query(default=""),
    ma_kh_id: int | None = Query(default=None),
    so_lop: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    service = ProductService(db)
    return service.get_products_paginated(search, ma_kh_id, so_lop, page, page_size)


@router.get("/by-customer/{customer_id}", response_model=list[ProductShort])
def get_products_by_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    service = ProductService(db)
    return service.get_products_by_customer(customer_id)


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    service = ProductService(db)
    return service.get_product_by_id(product_id)
    result = ProductResponse.model_validate(product)
    if product.khach_hang:
        result.ten_khach_hang = product.khach_hang.ten_viet_tat
    return result


@router.post("", response_model=ProductResponse, status_code=201)
def create_product(
    data: ProductCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if db.query(Product).filter(Product.ma_amis == data.ma_amis).first():
        raise HTTPException(status_code=400, detail=f"Mã sản phẩm '{data.ma_amis}' đã tồn tại")
    product = Product(**data.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return ProductResponse.model_validate(product)


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    data: ProductUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Không tìm thấy sản phẩm")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return ProductResponse.model_validate(product)
