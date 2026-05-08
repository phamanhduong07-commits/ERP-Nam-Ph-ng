from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import ViTri
from app.services.excel_import_service import (
    ImportField, build_template_response, import_excel, parse_bool, parse_text,
)

router = APIRouter(prefix="/api/vi-tri", tags=["vi-tri"])

VI_TRI_IMPORT_FIELDS = [
    ImportField("ma_vi_tri", "Ma vi tri", required=True, parser=parse_text, help_text="Ma vi tri, duy nhat"),
    ImportField("ten_vi_tri", "Ten vi tri", required=True, parser=parse_text),
    ImportField("loai", "Loai", parser=parse_text, help_text="nhan_vien | kho | san_xuat"),
    ImportField("ghi_chu", "Ghi chu", parser=parse_text),
    ImportField("trang_thai", "Trang thai", parser=parse_bool, default=True),
]


# ─── Schemas ─────────────────────────────────────────────────────────────────

class ViTriBase(BaseModel):
    ma_vi_tri: str
    ten_vi_tri: str
    loai: str | None = None
    ghi_chu: str | None = None
    trang_thai: bool = True


class ViTriResponse(ViTriBase):
    id: int

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/import-template")
def download_vi_tri_import_template(_: User = Depends(get_current_user)):
    return build_template_response("mau_import_vi_tri.xlsx", VI_TRI_IMPORT_FIELDS)


@router.post("/import")
async def import_vi_tri(
    commit: bool = Query(default=False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await import_excel(db=db, file=file, model=ViTri, fields=VI_TRI_IMPORT_FIELDS, key_field="ma_vi_tri", commit=commit)


@router.get("", response_model=list[ViTriResponse])
def list_vi_tri(
    loai: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(ViTri)
    if loai:
        q = q.filter(ViTri.loai == loai)
    return q.order_by(ViTri.ma_vi_tri).all()


@router.post("", response_model=ViTriResponse, status_code=201)
def create_vi_tri(
    data: ViTriBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if db.query(ViTri).filter(ViTri.ma_vi_tri == data.ma_vi_tri).first():
        raise HTTPException(status_code=400, detail=f"Mã vị trí '{data.ma_vi_tri}' đã tồn tại")
    obj = ViTri(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=ViTriResponse)
def update_vi_tri(
    id: int,
    data: ViTriBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(ViTri).filter(ViTri.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy vị trí")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{id}")
def delete_vi_tri(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(ViTri).filter(ViTri.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy vị trí")
    db.delete(obj)
    db.commit()
    return {"ok": True}
