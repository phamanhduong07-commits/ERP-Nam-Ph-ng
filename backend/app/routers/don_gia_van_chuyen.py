from decimal import Decimal
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import DonGiaVanChuyen
from app.services.excel_import_service import (
    ImportField, build_template_response, import_excel, parse_bool, parse_decimal, parse_text,
)

router = APIRouter(prefix="/api/don-gia-van-chuyen", tags=["don-gia-van-chuyen"])

DGV_IMPORT_FIELDS = [
    ImportField("ten_tuyen", "Ten tuyen", required=True, parser=parse_text, help_text="Ten tuyen van chuyen, dung lam khoa upsert"),
    ImportField("khu_vuc_tu", "Khu vuc tu", parser=parse_text),
    ImportField("khu_vuc_den", "Khu vuc den", parser=parse_text),
    ImportField("don_gia", "Don gia", required=True, parser=parse_decimal, default=0),
    ImportField("dvt", "DVT", parser=parse_text, default="chuyến"),
    ImportField("ghi_chu", "Ghi chu", parser=parse_text),
    ImportField("trang_thai", "Trang thai", parser=parse_bool, default=True),
]


# ─── Schemas ─────────────────────────────────────────────────────────────────

class DonGiaVanChuyenBase(BaseModel):
    ten_tuyen: str
    khu_vuc_tu: str | None = None
    khu_vuc_den: str | None = None
    don_gia: Decimal = Decimal("0")
    dvt: str = "chuyến"
    ghi_chu: str | None = None
    trang_thai: bool = True


class DonGiaVanChuyenResponse(DonGiaVanChuyenBase):
    id: int

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/import-template")
def download_dgv_import_template(_: User = Depends(get_current_user)):
    return build_template_response("mau_import_don_gia_van_chuyen.xlsx", DGV_IMPORT_FIELDS)


@router.post("/import")
async def import_don_gia_van_chuyen(
    commit: bool = Query(default=False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await import_excel(db=db, file=file, model=DonGiaVanChuyen, fields=DGV_IMPORT_FIELDS, key_field="ten_tuyen", commit=commit)


@router.get("", response_model=list[DonGiaVanChuyenResponse])
def list_don_gia_van_chuyen(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(DonGiaVanChuyen).order_by(DonGiaVanChuyen.ten_tuyen).all()


@router.post("", response_model=DonGiaVanChuyenResponse, status_code=201)
def create_don_gia_van_chuyen(
    data: DonGiaVanChuyenBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = DonGiaVanChuyen(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=DonGiaVanChuyenResponse)
def update_don_gia_van_chuyen(
    id: int,
    data: DonGiaVanChuyenBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(DonGiaVanChuyen).filter(DonGiaVanChuyen.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn giá vận chuyển")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{id}")
def delete_don_gia_van_chuyen(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(DonGiaVanChuyen).filter(DonGiaVanChuyen.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn giá vận chuyển")
    db.delete(obj)
    db.commit()
    return {"ok": True}
