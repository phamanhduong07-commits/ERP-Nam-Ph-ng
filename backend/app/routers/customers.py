from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import assert_has_permission, get_current_user, get_sale_visible_nv_ids, require_permissions
from app.models.auth import Role, User
from app.models.master import Customer, CustomerNhanVien
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

def _get_scope(current_user: User) -> list[int] | None:
    return get_sale_visible_nv_ids(current_user)


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
    ImportField("email", "Email", parser=parse_text),
    ImportField("phap_nhan", "Phap nhan", parser=parse_text, aliases=("PHAP NHAN", "Phap Nhan")),
    ImportField("ke_toan_phu_trach", "Ke toan phu trach", parser=parse_text, aliases=("KE TOAN PHU TRACH",)),
    ImportField("dieu_khoan_tt", "Dieu khoan TT", parser=parse_text, aliases=("DIEU KHOAN THANH TOAN",)),
    ImportField("sa_cskh", "SA CSKH", parser=parse_text, aliases=("SA-CSKH",)),
    ImportField("trang_thai", "Trang thai", parser=parse_bool, default=True),
]


class SaleUserOut(BaseModel):
    id: int
    ho_ten: str
    username: str


@router.get("/sale-users", response_model=list[SaleUserOut])
def get_sale_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Trả về danh sách nhân viên có role SALE_ADMIN để chọn NV phụ trách.
    Ưu tiên dùng ho_ten từ Employee (tên đầy đủ) nếu user đã được link với employee record.
    """
    from app.models.hr import Employee
    from sqlalchemy import case
    _SALE_ROLES = {"SALE_ADMIN", "TRUONG_PHONG_SALE_ADMIN"}
    rows = (
        db.query(User, Employee)
        .join(Role, User.role_id == Role.id)
        .outerjoin(Employee, Employee.user_id == User.id)
        .filter(Role.ma_vai_tro.in_(_SALE_ROLES), User.trang_thai.is_(True))
        .order_by(Employee.ho_ten.nullslast(), User.ho_ten)
        .all()
    )
    return [
        SaleUserOut(
            id=u.id,
            ho_ten=emp.ho_ten if emp else u.ho_ten,
            username=u.username,
        )
        for u, emp in rows
    ]


@router.get("", response_model=PagedResponse)
def list_customers(
    search: str = Query(default="", description="Tìm theo tên hoặc mã"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=1000),
    trang_thai: bool = Query(default=True),
    nv_id: int | None = Query(default=None, description="Lọc theo NV phụ trách"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CustomerService(db)
    return service.get_customers_paginated(search, page, page_size, trang_thai, nv_id, _get_scope(current_user))


@router.get("/all", response_model=list[CustomerShort])
def get_all_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CustomerService(db)
    return service.get_all_active_customers(_get_scope(current_user))


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
    current_user: User = Depends(require_permissions("sales.import")),
):
    return await import_excel(
        db=db,
        file=file,
        model=Customer,
        fields=CUSTOMER_IMPORT_FIELDS,
        key_field="ma_kh",
        commit=commit,
        user=current_user,
        loai_du_lieu="khach_hang",
    )


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CustomerService(db)
    return service.get_customer_by_id(customer_id, _get_scope(current_user))


@router.post("", response_model=CustomerResponse, status_code=201)
def create_customer(
    data: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CustomerService(db)
    customer = service.create_customer(data)
    # Bug 2 fix: auto-assign creator as NV phụ trách khi không phải ADMIN
    role_code = current_user.role.ma_vai_tro if current_user.role else None
    if role_code != "ADMIN":
        db.add(CustomerNhanVien(customer_id=customer.id, user_id=current_user.id))
        db.commit()
    return customer


@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    data: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CustomerService(db)
    # Ownership check: SALE roles chỉ được sửa KH của mình
    scope_nv_ids = _get_scope(current_user)
    if scope_nv_ids is not None:
        from app.models.master import Customer as _Customer
        from app.services.customer_service import _scope_filter
        in_scope = db.query(_Customer).filter(
            _Customer.id == customer_id,
            _scope_filter(scope_nv_ids),
        ).first()
        if not in_scope:
            raise HTTPException(status_code=403, detail="Bạn không có quyền chỉnh sửa khách hàng này")
    return service.update_customer(customer_id, data)


@router.delete("/{customer_id}", status_code=204)
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assert_has_permission("customer.delete", current_user, db)
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")
    if customer.sales_orders:
        raise HTTPException(status_code=400, detail="Không thể xóa khách hàng đã có đơn hàng")
    db.delete(customer)
    db.commit()
    return Response(status_code=204)
