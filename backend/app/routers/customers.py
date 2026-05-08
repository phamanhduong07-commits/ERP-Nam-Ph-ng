from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import Customer
from app.services.customer_service import CustomerService
from app.services.excel_import_service import (
    ImportField,
    build_template_response,
    import_excel,
    parse_bool,
    parse_decimal,
    parse_int,
    parse_text,
)
from app.schemas.master import CustomerCreate, CustomerUpdate, CustomerResponse, CustomerShort
from app.schemas.sales import PagedResponse

router = APIRouter(prefix="/api/customers", tags=["customers"])


CUSTOMER_IMPORT_FIELDS = [
    ImportField("ma_kh", "Ma KH", required=True, parser=parse_text, help_text="Ma khach hang duy nhat"),
    ImportField("ten_viet_tat", "Ten viet tat", required=True, parser=parse_text),
    ImportField("ten_don_vi", "Ten don vi", parser=parse_text),
    ImportField("dia_chi", "Dia chi", parser=parse_text),
    ImportField("dia_chi_giao_hang", "Dia chi giao hang", parser=parse_text),
    ImportField("dien_thoai", "Dien thoai", parser=parse_text),
    ImportField("ma_so_thue", "Ma so thue", parser=parse_text),
    ImportField("nguoi_dai_dien", "Nguoi dai dien", parser=parse_text),
    ImportField("nguoi_lien_he", "Nguoi lien he", parser=parse_text),
    ImportField("so_dien_thoai_lh", "SDT lien he", parser=parse_text),
    ImportField("no_tran", "No tran", parser=parse_decimal, default=0),
    ImportField("so_ngay_no", "So ngay no", parser=parse_int, default=0),
    ImportField("xep_loai", "Xep loai", parser=parse_text),
    ImportField("la_khach_vip", "Khach VIP", parser=parse_bool, default=False),
    ImportField("ghi_chu", "Ghi chu", parser=parse_text),
    ImportField("trang_thai", "Trang thai", parser=parse_bool, default=True),
]


@router.get("", response_model=PagedResponse)
def list_customers(
    search: str = Query(default="", description="Tìm theo tên hoặc mã"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=1000),
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


@router.get("/import-template")
def download_customer_import_template(
    _: User = Depends(get_current_user),
):
    return build_template_response("mau_import_khach_hang.xlsx", CUSTOMER_IMPORT_FIELDS)


@router.post("/import")
async def import_customers(
    commit: bool = Query(default=False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await import_excel(
        db=db,
        file=file,
        model=Customer,
        fields=CUSTOMER_IMPORT_FIELDS,
        key_field="ma_kh",
        commit=commit,
        user=_,
        loai_du_lieu="khach_hang",
    )


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
