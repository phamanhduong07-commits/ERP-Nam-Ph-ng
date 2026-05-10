from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import MaterialGroup, PaperMaterial, Supplier
from app.services.excel_import_service import (
    ImportField,
    build_template_response,
    import_excel,
    parse_bool,
    parse_decimal,
    parse_text,
)

router = APIRouter(prefix="/api/paper-materials", tags=["paper-materials"])


class PaperMaterialCreate(BaseModel):
    ma_chinh: str
    ma_amis: str | None = None
    ma_nhom_id: int
    ten: str
    ten_viet_tat: str | None = None
    dvt: str = "Kg"
    kho: Decimal | None = None
    ma_ky_hieu: str | None = None
    ma_dong_cap: str | None = None
    dinh_luong: Decimal | None = None
    ma_nsx_id: int | None = None
    gia_mua: Decimal | None = Decimal("0")
    gia_ban: Decimal | None = Decimal("0")
    gia_dinh_muc: Decimal | None = Decimal("0")
    ton_toi_thieu: Decimal | None = Decimal("0")
    ton_toi_da: Decimal | None = None
    la_cuon: bool = True
    su_dung: bool = True


class PaperMaterialUpdate(BaseModel):
    ma_amis: str | None = None
    ma_nhom_id: int | None = None
    ten: str | None = None
    ten_viet_tat: str | None = None
    dvt: str | None = None
    kho: Decimal | None = None
    ma_ky_hieu: str | None = None
    ma_dong_cap: str | None = None
    dinh_luong: Decimal | None = None
    ma_nsx_id: int | None = None
    gia_mua: Decimal | None = None
    gia_ban: Decimal | None = None
    gia_dinh_muc: Decimal | None = None
    do_buc_tb: Decimal | None = None
    do_nen_vong_tb: Decimal | None = None
    ton_toi_thieu: Decimal | None = None
    ton_toi_da: Decimal | None = None
    la_cuon: bool | None = None
    su_dung: bool | None = None


class PaperMaterialResponse(BaseModel):
    id: int
    ma_chinh: str
    ma_amis: str | None = None
    ma_nhom_id: int
    ten: str
    ten_viet_tat: str | None = None
    dvt: str
    kho: Decimal | None = None
    ma_ky_hieu: str | None = None
    ma_dong_cap: str | None = None
    dinh_luong: Decimal | None = None
    ma_nsx_id: int | None = None
    gia_mua: Decimal | None = None
    gia_ban: Decimal | None = None
    gia_dinh_muc: Decimal | None = None
    do_buc_tb: Decimal | None = None
    do_nen_vong_tb: Decimal | None = None
    ton_toi_thieu: Decimal | None = None
    ton_toi_da: Decimal | None = None
    la_cuon: bool
    su_dung: bool
    ten_nhom: str | None = None
    ten_nsx: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


PAPER_MATERIAL_IMPORT_FIELDS = [
    ImportField("ma_chinh", "Ma chinh", required=True, parser=parse_text, help_text="Ma giay duy nhat"),
    ImportField("ma_amis", "Ma AMIS", parser=parse_text),
    ImportField("ma_nhom", "Ma nhom", required=True, parser=parse_text, help_text="Ma nhom phai ton tai"),
    ImportField("ten", "Ten giay", required=True, parser=parse_text),
    ImportField("ten_viet_tat", "Ten viet tat", parser=parse_text),
    ImportField("dvt", "DVT", parser=parse_text, default="Kg"),
    ImportField("kho", "Kho", parser=parse_decimal),
    ImportField("ma_ky_hieu", "Ma ky hieu", parser=parse_text),
    ImportField("ma_dong_cap", "KyHieu", parser=parse_text),
    ImportField("dinh_luong", "Dinh luong", parser=parse_decimal),
    ImportField("tieu_chuan_dinh_luong", "DL_TC", parser=parse_decimal),
    ImportField("ma_nsx", "Ma NSX", parser=parse_text, help_text="Neu co, phai ton tai trong danh muc NCC"),
    ImportField("gia_mua", "Gia mua", parser=parse_decimal, default=0),
    ImportField("gia_ban", "Gia ban", parser=parse_decimal, default=0),
    ImportField("gia_dinh_muc", "Gia dinh muc", parser=parse_decimal, default=0),
    ImportField("ton_toi_thieu", "Ton toi thieu", parser=parse_decimal, default=0),
    ImportField("ton_toi_da", "Ton toi da", parser=parse_decimal),
    ImportField("la_cuon", "La cuon", parser=parse_bool, default=True),
    ImportField("su_dung", "Su dung", parser=parse_bool, default=True),
]


def _to_response(obj: PaperMaterial) -> PaperMaterialResponse:
    data = PaperMaterialResponse.model_validate(obj)
    data.ten_nhom = obj.nhom.ten_nhom if obj.nhom else None
    data.ten_nsx = obj.nsx.ten_viet_tat if obj.nsx else None
    return data


def _resolve_paper_material_import_row(db: Session, values: dict) -> tuple[dict, list[str]]:
    errors: list[str] = []
    ma_nhom = values.pop("ma_nhom", None)
    ma_nsx = values.pop("ma_nsx", None)

    if ma_nhom:
        group = db.query(MaterialGroup).filter(MaterialGroup.ma_nhom == ma_nhom).first()
        if not group:
            errors.append(f"Ma nhom: khong ton tai '{ma_nhom}'")
        else:
            values["ma_nhom_id"] = group.id

    if ma_nsx:
        supplier = db.query(Supplier).filter(Supplier.ma_ncc == ma_nsx).first()
        if not supplier:
            errors.append(f"Ma NSX: khong ton tai '{ma_nsx}'")
        else:
            values["ma_nsx_id"] = supplier.id

    return values, errors


@router.get("")
def list_paper_materials(
    search: str = Query(default=""),
    ma_nhom_id: int | None = Query(default=None),
    ma_nsx_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=5000),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(PaperMaterial).filter(PaperMaterial.su_dung == True)
    if search:
        like = f"%{search}%"
        q = q.filter(
            PaperMaterial.ma_chinh.ilike(like)
            | PaperMaterial.ten.ilike(like)
            | PaperMaterial.ma_ky_hieu.ilike(like)
        )
    if ma_nhom_id is not None:
        q = q.filter(PaperMaterial.ma_nhom_id == ma_nhom_id)
    if ma_nsx_id is not None:
        q = q.filter(PaperMaterial.ma_nsx_id == ma_nsx_id)
    total = q.count()
    items = q.order_by(PaperMaterial.ma_chinh).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [
            {
                "id": p.id,
                "ma_chinh": p.ma_chinh,
                "ma_amis": p.ma_amis,
                "ma_nhom_id": p.ma_nhom_id,
                "ten": p.ten,
                "ten_viet_tat": p.ten_viet_tat,
                "dvt": p.dvt,
                "kho": p.kho,
                "ma_ky_hieu": p.ma_ky_hieu,
                "ma_dong_cap": p.ma_dong_cap,
                "dinh_luong": p.dinh_luong,
                "ma_nsx_id": p.ma_nsx_id,
                "gia_mua": p.gia_mua,
                "gia_ban": p.gia_ban,
                "gia_dinh_muc": p.gia_dinh_muc,
                "do_buc_tb": p.do_buc_tb,
                "do_nen_vong_tb": p.do_nen_vong_tb,
                "ton_toi_thieu": p.ton_toi_thieu,
                "ton_toi_da": p.ton_toi_da,
                "la_cuon": p.la_cuon,
                "su_dung": p.su_dung,
                "ten_nhom": p.nhom.ten_nhom if p.nhom else None,
                "ten_nsx": p.nsx.ten_viet_tat if p.nsx else None,
            }
            for p in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/import-template")
def download_paper_material_import_template(
    _: User = Depends(get_current_user),
):
    return build_template_response("mau_import_nguyen_lieu_giay.xlsx", PAPER_MATERIAL_IMPORT_FIELDS)


@router.post("/import")
async def import_paper_materials(
    commit: bool = Query(default=False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await import_excel(
        db=db,
        file=file,
        model=PaperMaterial,
        fields=PAPER_MATERIAL_IMPORT_FIELDS,
        key_field="ma_chinh",
        commit=commit,
        resolver=_resolve_paper_material_import_row,
        user=_,
        loai_du_lieu="vat_tu_giay",
    )


@router.post("", response_model=PaperMaterialResponse, status_code=201)
def create_paper_material(
    data: PaperMaterialCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if db.query(PaperMaterial).filter(PaperMaterial.ma_chinh == data.ma_chinh).first():
        raise HTTPException(status_code=400, detail=f"Mã '{data.ma_chinh}' đã tồn tại")
    obj = PaperMaterial(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _to_response(obj)


@router.put("/{id}", response_model=PaperMaterialResponse)
def update_paper_material(
    id: int,
    data: PaperMaterialUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(PaperMaterial).filter(PaperMaterial.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy nguyên liệu giấy")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return _to_response(obj)


@router.get("/options")
def get_paper_options(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Trả về danh sách mã ký hiệu đồng cấp và định lượng để chọn lớp giấy.
    by_mk: { "VB": [120, 125, 150], "GB": [150, 185, 200], ... }
    """
    from sqlalchemy import distinct, func
    rows = (
        db.query(PaperMaterial.ma_ky_hieu, PaperMaterial.dinh_luong)
        .filter(
            PaperMaterial.su_dung == True,
            PaperMaterial.ma_ky_hieu.isnot(None),
            PaperMaterial.dinh_luong.isnot(None),
        )
        .distinct()
        .order_by(PaperMaterial.ma_ky_hieu, PaperMaterial.dinh_luong)
        .all()
    )
    by_mk: dict[str, list[float]] = {}
    for mk, dl in rows:
        by_mk.setdefault(mk, []).append(float(dl))
    return {
        "ma_ky_hieu": sorted(by_mk.keys()),
        "by_mk": by_mk,
    }


@router.get("/search")
def search_paper_materials(
    q: str = Query(default=""),
    limit: int = Query(default=20, le=50),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Quick search for autocomplete."""
    like = f"%{q}%"
    items = (
        db.query(PaperMaterial)
        .filter(
            PaperMaterial.su_dung == True,
            (PaperMaterial.ma_chinh.ilike(like) | PaperMaterial.ten.ilike(like) | PaperMaterial.ma_ky_hieu.ilike(like))
        )
        .order_by(PaperMaterial.ma_chinh)
        .limit(limit)
        .all()
    )
    return [
        {
            "value": p.ma_chinh,
            "label": f"{p.ma_chinh} – {p.ten}",
            "ma_ky_hieu": p.ma_ky_hieu,
            "ma_dong_cap": p.ma_dong_cap,
            "dinh_luong": float(p.dinh_luong) if p.dinh_luong else None,
        }
        for p in items
    ]
