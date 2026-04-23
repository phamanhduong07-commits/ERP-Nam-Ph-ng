from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import Product, Customer
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
    q = db.query(Product).filter(Product.trang_thai == True)
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


@router.get("/by-customer/{customer_id}", response_model=list[ProductShort])
def get_products_by_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    products = (
        db.query(Product)
        .filter(Product.ma_kh_id == customer_id, Product.trang_thai == True)
        .order_by(Product.ten_hang)
        .all()
    )
    return [ProductShort.model_validate(p) for p in products]


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    product = db.query(Product).options(joinedload(Product.khach_hang)).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Không tìm thấy sản phẩm")
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
