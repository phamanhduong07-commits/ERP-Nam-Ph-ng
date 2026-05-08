from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import Customer, Product
from app.services.product_service import ProductService
from app.services.excel_import_service import (
    ImportField,
    build_template_response,
    import_excel,
    parse_bool,
    parse_decimal,
    parse_int,
    parse_text,
)
from app.schemas.master import ProductCreate, ProductUpdate, ProductResponse, ProductShort
from app.schemas.sales import PagedResponse

router = APIRouter(prefix="/api/products", tags=["products"])


PRODUCT_IMPORT_FIELDS = [
    ImportField("ma_amis", "Ma AMIS", required=True, parser=parse_text, help_text="Ma san pham duy nhat"),
    ImportField("ma_hang", "Ma hang", parser=parse_text),
    ImportField("ten_hang", "Ten hang", required=True, parser=parse_text),
    ImportField("dai", "Dai", parser=parse_decimal),
    ImportField("rong", "Rong", parser=parse_decimal),
    ImportField("cao", "Cao", parser=parse_decimal),
    ImportField("so_lop", "So lop", parser=parse_int, default=3),
    ImportField("so_mau", "So mau", parser=parse_int, default=0),
    ImportField("ghim", "Ghim", parser=parse_bool, default=False),
    ImportField("dan", "Dan", parser=parse_bool, default=False),
    ImportField("dvt", "DVT", parser=parse_text, default="Thung"),
    ImportField("phan_xuong", "Phan xuong", parser=parse_text),
    ImportField("loai", "Loai", parser=parse_text),
    ImportField("ma_kh", "Ma KH", parser=parse_text, help_text="Neu co, phai ton tai trong danh muc khach hang"),
    ImportField("gia_ban", "Gia ban", parser=parse_decimal, default=0),
    ImportField("ghi_chu", "Ghi chu", parser=parse_text),
    ImportField("trang_thai", "Trang thai", parser=parse_bool, default=True),
]


def _resolve_product_import_row(db: Session, values: dict) -> tuple[dict, list[str]]:
    errors: list[str] = []
    ma_kh = values.pop("ma_kh", None)
    if ma_kh:
        customer = db.query(Customer).filter(Customer.ma_kh == ma_kh).first()
        if not customer:
            errors.append(f"Ma KH: khong ton tai '{ma_kh}'")
        else:
            values["ma_kh_id"] = customer.id
    return values, errors


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


@router.get("/import-template")
def download_product_import_template(
    _: User = Depends(get_current_user),
):
    return build_template_response("mau_import_san_pham.xlsx", PRODUCT_IMPORT_FIELDS)


@router.post("/import")
async def import_products(
    commit: bool = Query(default=False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await import_excel(
        db=db,
        file=file,
        model=Product,
        fields=PRODUCT_IMPORT_FIELDS,
        key_field="ma_amis",
        commit=commit,
        resolver=_resolve_product_import_row,
        user=_,
        loai_du_lieu="san_pham",
    )


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
