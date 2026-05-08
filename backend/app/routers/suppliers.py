from datetime import datetime
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import Supplier
from app.services.excel_import_service import (
    ImportField,
    build_template_response,
    import_excel,
    parse_bool,
    parse_text,
)
from app.schemas.sales import PagedResponse

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])


SUPPLIER_IMPORT_FIELDS = [
    ImportField("ma_ncc", "Ma NCC", required=True, parser=parse_text, help_text="Ma nha cung cap duy nhat"),
    ImportField("ten_viet_tat", "Ten viet tat", required=True, parser=parse_text),
    ImportField("ten_don_vi", "Ten don vi", parser=parse_text),
    ImportField("dia_chi", "Dia chi", parser=parse_text),
    ImportField("dien_thoai", "Dien thoai", parser=parse_text),
    ImportField("fax", "Fax", parser=parse_text),
    ImportField("di_dong", "Di dong", parser=parse_text),
    ImportField("ma_so_thue", "Ma so thue", parser=parse_text),
    ImportField("nguoi_dai_dien", "Nguoi dai dien", parser=parse_text),
    ImportField("phan_loai", "Phan loai", parser=parse_text),
    ImportField("ma_ncc_amis", "Ma NCC AMIS", parser=parse_text),
    ImportField("ghi_chu", "Ghi chu", parser=parse_text),
    ImportField("trang_thai", "Trang thai", parser=parse_bool, default=True),
]


# ─── Schemas ─────────────────────────────────────────────────────────────────

class SupplierShort(BaseModel):
    id: int
    ma_ncc: str
    ten_viet_tat: str
    ten_don_vi: str | None = None
    dien_thoai: str | None = None
    trang_thai: bool

    class Config:
        from_attributes = True


class SupplierCreate(BaseModel):
    ma_ncc: str
    ten_viet_tat: str
    ten_don_vi: str | None = None
    dia_chi: str | None = None
    dien_thoai: str | None = None
    fax: str | None = None
    di_dong: str | None = None
    ma_so_thue: str | None = None
    nguoi_dai_dien: str | None = None
    phan_loai: str | None = None
    ma_ncc_amis: str | None = None
    ghi_chu: str | None = None


class SupplierUpdate(BaseModel):
    ma_ncc: str | None = None
    ten_viet_tat: str | None = None
    ten_don_vi: str | None = None
    dia_chi: str | None = None
    dien_thoai: str | None = None
    fax: str | None = None
    di_dong: str | None = None
    ma_so_thue: str | None = None
    nguoi_dai_dien: str | None = None
    phan_loai: str | None = None
    ma_ncc_amis: str | None = None
    ghi_chu: str | None = None
    trang_thai: bool | None = None


class SupplierResponse(BaseModel):
    id: int
    ma_ncc: str
    ten_viet_tat: str
    ten_don_vi: str | None = None
    dia_chi: str | None = None
    dien_thoai: str | None = None
    fax: str | None = None
    di_dong: str | None = None
    ma_so_thue: str | None = None
    nguoi_dai_dien: str | None = None
    phan_loai: str | None = None
    ma_ncc_amis: str | None = None
    ghi_chu: str | None = None
    trang_thai: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=PagedResponse)
def list_suppliers(
    search: str = Query(default="", description="Tìm theo tên hoặc mã"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    trang_thai: bool = Query(default=True),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Supplier).filter(Supplier.trang_thai == trang_thai)
    if search:
        like = f"%{search}%"
        q = q.filter(
            Supplier.ma_ncc.ilike(like)
            | Supplier.ten_viet_tat.ilike(like)
            | Supplier.ten_don_vi.ilike(like)
            | Supplier.ma_so_thue.ilike(like)
        )
    total = q.count()
    items = q.order_by(Supplier.ten_viet_tat).offset((page - 1) * page_size).limit(page_size).all()
    return PagedResponse(
        items=[SupplierShort.model_validate(s) for s in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/all", response_model=list[SupplierShort])
def get_all_suppliers(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    items = db.query(Supplier).filter(Supplier.trang_thai == True).order_by(Supplier.ten_viet_tat).all()
    return [SupplierShort.model_validate(s) for s in items]


@router.get("/import-template")
def download_supplier_import_template(
    _: User = Depends(get_current_user),
):
    return build_template_response("mau_import_nha_cung_cap.xlsx", SUPPLIER_IMPORT_FIELDS)


@router.post("/import")
async def import_suppliers(
    commit: bool = Query(default=False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await import_excel(
        db=db,
        file=file,
        model=Supplier,
        fields=SUPPLIER_IMPORT_FIELDS,
        key_field="ma_ncc",
        commit=commit,
        user=_,
        loai_du_lieu="nha_cung_cap",
    )


@router.get("/{id}", response_model=SupplierResponse)
def get_supplier(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(Supplier).filter(Supplier.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhà cung cấp")
    return SupplierResponse.model_validate(obj)


@router.post("", response_model=SupplierResponse, status_code=201)
def create_supplier(
    data: SupplierCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if db.query(Supplier).filter(Supplier.ma_ncc == data.ma_ncc).first():
        raise HTTPException(status_code=400, detail=f"Mã NCC '{data.ma_ncc}' đã tồn tại")
    obj = Supplier(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return SupplierResponse.model_validate(obj)


@router.put("/{id}", response_model=SupplierResponse)
def update_supplier(
    id: int,
    data: SupplierUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(Supplier).filter(Supplier.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhà cung cấp")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return SupplierResponse.model_validate(obj)
