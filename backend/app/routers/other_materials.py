from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import MaterialGroup, OtherMaterial, Supplier
from app.services.excel_import_service import (
    ImportField,
    build_template_response,
    import_excel,
    parse_bool,
    parse_decimal,
    parse_text,
)
from app.schemas.sales import PagedResponse

router = APIRouter(prefix="/api/other-materials", tags=["other-materials"])


OTHER_MATERIAL_IMPORT_FIELDS = [
    ImportField("ma_chinh", "Ma chinh", required=True, parser=parse_text, help_text="Ma vat tu duy nhat"),
    ImportField("ma_amis", "Ma AMIS", parser=parse_text),
    ImportField("ten", "Ten vat tu", required=True, parser=parse_text),
    ImportField("dvt", "DVT", parser=parse_text, default="Kg"),
    ImportField("ma_nhom", "Ma nhom", required=True, parser=parse_text, help_text="Ma nhom phai ton tai"),
    ImportField("gia_mua", "Gia mua", parser=parse_decimal, default=0),
    ImportField("ton_toi_thieu", "Ton toi thieu", parser=parse_decimal, default=0),
    ImportField("ton_toi_da", "Ton toi da", parser=parse_decimal),
    ImportField("phan_xuong", "Phan xuong", parser=parse_text),
    ImportField("ma_ncc", "Ma NCC", parser=parse_text, help_text="Neu co, phai ton tai trong danh muc NCC"),
    ImportField("ghi_chu", "Ghi chu", parser=parse_text),
    ImportField("trang_thai", "Trang thai", parser=parse_bool, default=True),
]


def _resolve_other_material_import_row(db: Session, values: dict) -> tuple[dict, list[str]]:
    errors: list[str] = []
    ma_nhom = values.pop("ma_nhom", None)
    ma_ncc = values.pop("ma_ncc", None)

    if ma_nhom:
        group = db.query(MaterialGroup).filter(MaterialGroup.ma_nhom == ma_nhom).first()
        if not group:
            errors.append(f"Ma nhom: khong ton tai '{ma_nhom}'")
        else:
            values["ma_nhom_id"] = group.id

    if ma_ncc:
        supplier = db.query(Supplier).filter(Supplier.ma_ncc == ma_ncc).first()
        if not supplier:
            errors.append(f"Ma NCC: khong ton tai '{ma_ncc}'")
        else:
            values["ma_ncc_id"] = supplier.id

    return values, errors


class OtherMaterialCreate(BaseModel):
    ma_chinh: str
    ma_amis: str | None = None
    ten: str
    dvt: str = "Kg"
    ma_nhom_id: int
    gia_mua: Decimal | None = Decimal("0")
    ton_toi_thieu: Decimal | None = Decimal("0")
    ton_toi_da: Decimal | None = None
    phan_xuong: str | None = None
    ma_ncc_id: int | None = None
    ghi_chu: str | None = None
    trang_thai: bool = True


class OtherMaterialUpdate(BaseModel):
    ma_chinh: str | None = None
    ma_amis: str | None = None
    ten: str | None = None
    dvt: str | None = None
    ma_nhom_id: int | None = None
    gia_mua: Decimal | None = None
    ton_toi_thieu: Decimal | None = None
    ton_toi_da: Decimal | None = None
    phan_xuong: str | None = None
    ma_ncc_id: int | None = None
    ghi_chu: str | None = None
    trang_thai: bool | None = None


class OtherMaterialResponse(BaseModel):
    id: int
    ma_chinh: str
    ma_amis: str | None = None
    ten: str
    dvt: str
    ma_nhom_id: int
    ten_nhom: str | None = None
    gia_mua: Decimal | None = None
    ton_toi_thieu: Decimal | None = None
    ton_toi_da: Decimal | None = None
    phan_xuong: str | None = None
    ma_ncc_id: int | None = None
    ten_ncc: str | None = None
    ghi_chu: str | None = None
    trang_thai: bool
    created_at: datetime

    class Config:
        from_attributes = True


def _to_response(obj: OtherMaterial) -> OtherMaterialResponse:
    data = OtherMaterialResponse.model_validate(obj)
    data.ten_nhom = obj.nhom.ten_nhom if obj.nhom else None
    data.ten_ncc = obj.ncc.ten_viet_tat if obj.ncc else None
    return data


@router.get("", response_model=PagedResponse)
def list_other_materials(
    search: str = Query(default=""),
    ma_nhom_id: int | None = Query(default=None),
    ma_ncc_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=2000),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(OtherMaterial)
    if search:
        like = f"%{search}%"
        q = q.filter(
            OtherMaterial.ma_chinh.ilike(like)
            | OtherMaterial.ten.ilike(like)
        )
    if ma_nhom_id is not None:
        q = q.filter(OtherMaterial.ma_nhom_id == ma_nhom_id)
    if ma_ncc_id is not None:
        q = q.filter(OtherMaterial.ma_ncc_id == ma_ncc_id)
    total = q.count()
    items = q.order_by(OtherMaterial.ten).offset((page - 1) * page_size).limit(page_size).all()
    return PagedResponse(
        items=[_to_response(o) for o in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/import-template")
def download_other_material_import_template(
    _: User = Depends(get_current_user),
):
    return build_template_response("mau_import_vat_tu_phu.xlsx", OTHER_MATERIAL_IMPORT_FIELDS)


@router.post("/import")
async def import_other_materials(
    commit: bool = Query(default=False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await import_excel(
        db=db,
        file=file,
        model=OtherMaterial,
        fields=OTHER_MATERIAL_IMPORT_FIELDS,
        key_field="ma_chinh",
        commit=commit,
        resolver=_resolve_other_material_import_row,
    )


@router.post("", response_model=OtherMaterialResponse, status_code=201)
def create_other_material(
    data: OtherMaterialCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if db.query(OtherMaterial).filter(OtherMaterial.ma_chinh == data.ma_chinh).first():
        raise HTTPException(status_code=400, detail=f"Mã '{data.ma_chinh}' đã tồn tại")
    obj = OtherMaterial(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _to_response(obj)


@router.put("/{id}", response_model=OtherMaterialResponse)
def update_other_material(
    id: int,
    data: OtherMaterialUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(OtherMaterial).filter(OtherMaterial.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy vật tư")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return _to_response(obj)


@router.get("/search")
def search_other_materials(
    q: str = Query(default=""),
    limit: int = Query(default=20, le=50),
    ma_nhom_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Quick search for autocomplete trong form mua NVL."""
    query = db.query(OtherMaterial).filter(OtherMaterial.trang_thai == True)  # noqa: E712
    if q:
        like = f"%{q}%"
        query = query.filter(OtherMaterial.ma_chinh.ilike(like) | OtherMaterial.ten.ilike(like))
    if ma_nhom_id is not None:
        query = query.filter(OtherMaterial.ma_nhom_id == ma_nhom_id)
    items = query.order_by(OtherMaterial.ma_chinh).limit(limit).all()
    return [
        {
            "value": m.ma_chinh,
            "label": f"{m.ma_chinh} – {m.ten}",
            "id": m.id,
            "ten": m.ten,
            "dvt": m.dvt,
            "gia_mua": float(m.gia_mua) if m.gia_mua else 0,
            "ma_nhom_id": m.ma_nhom_id,
        }
        for m in items
    ]
