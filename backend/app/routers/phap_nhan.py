from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import PhapNhan, PhanXuong
from app.services.excel_import_service import (
    ImportField, build_template_response, import_excel, parse_bool, parse_text,
)

router = APIRouter(prefix="/api/phap-nhan", tags=["phap-nhan"])

PHAP_NHAN_IMPORT_FIELDS = [
    ImportField("ma_phap_nhan", "Ma phap nhan", required=True, parser=parse_text, help_text="Ma phap nhan, duy nhat"),
    ImportField("ten_phap_nhan", "Ten phap nhan", required=True, parser=parse_text),
    ImportField("ten_viet_tat", "Ten viet tat", parser=parse_text),
    ImportField("ma_so_thue", "Ma so thue", parser=parse_text),
    ImportField("dia_chi", "Dia chi", parser=parse_text),
    ImportField("so_dien_thoai", "So dien thoai", parser=parse_text),
    ImportField("tai_khoan", "So tai khoan", parser=parse_text),
    ImportField("ngan_hang", "Ngan hang", parser=parse_text),
    ImportField("ky_hieu_hd", "Ky hieu hoa don", parser=parse_text),
    ImportField("trang_thai", "Trang thai", parser=parse_bool, default=True),
]


class PhapNhanCreate(BaseModel):
    ma_phap_nhan: str
    ten_phap_nhan: str
    ten_viet_tat: Optional[str] = None
    ma_so_thue: Optional[str] = None
    dia_chi: Optional[str] = None
    so_dien_thoai: Optional[str] = None
    tai_khoan: Optional[str] = None
    ngan_hang: Optional[str] = None
    ky_hieu_hd: Optional[str] = None
    trang_thai: bool = True
    phoi_phan_xuong_id: Optional[int] = None


def _to_dict(p: PhapNhan) -> dict:
    return {
        "id": p.id,
        "ma_phap_nhan": p.ma_phap_nhan,
        "ten_phap_nhan": p.ten_phap_nhan,
        "ten_viet_tat": p.ten_viet_tat,
        "ma_so_thue": p.ma_so_thue,
        "dia_chi": p.dia_chi,
        "so_dien_thoai": p.so_dien_thoai,
        "tai_khoan": p.tai_khoan,
        "ngan_hang": p.ngan_hang,
        "ky_hieu_hd": p.ky_hieu_hd,
        "trang_thai": p.trang_thai,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "phoi_phan_xuong_id": p.phoi_phan_xuong_id,
        "ten_phoi_phan_xuong": p.phoi_phan_xuong.ten_xuong if p.phoi_phan_xuong else None,
    }


@router.get("/import-template")
def download_phap_nhan_import_template(_: User = Depends(get_current_user)):
    return build_template_response("mau_import_phap_nhan.xlsx", PHAP_NHAN_IMPORT_FIELDS)


@router.post("/import")
async def import_phap_nhan(
    commit: bool = Query(default=False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await import_excel(db=db, file=file, model=PhapNhan, fields=PHAP_NHAN_IMPORT_FIELDS, key_field="ma_phap_nhan", commit=commit)


@router.get("")
def list_phap_nhan(
    active_only: bool = False,
    search: str = Query(default=""),
    db: Session = Depends(get_db),
):
    q = db.query(PhapNhan).order_by(PhapNhan.ma_phap_nhan)
    if active_only:
        q = q.filter(PhapNhan.trang_thai == True)
    if search:
        like = f"%{search}%"
        from sqlalchemy import or_
        q = q.filter(
            or_(
                PhapNhan.ma_phap_nhan.ilike(like),
                PhapNhan.ten_phap_nhan.ilike(like),
                PhapNhan.ten_viet_tat.ilike(like),
                PhapNhan.ma_so_thue.ilike(like),
            )
        )
    return [_to_dict(p) for p in q.all()]


@router.post("")
def create_phap_nhan(body: PhapNhanCreate, db: Session = Depends(get_db)):
    if db.query(PhapNhan).filter(PhapNhan.ma_phap_nhan == body.ma_phap_nhan).first():
        raise HTTPException(400, "Mã pháp nhân đã tồn tại")
    p = PhapNhan(**body.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return _to_dict(p)


@router.put("/{id}")
def update_phap_nhan(id: int, body: PhapNhanCreate, db: Session = Depends(get_db)):
    p = db.get(PhapNhan, id)
    if not p:
        raise HTTPException(404, "Không tìm thấy")
    for k, v in body.model_dump().items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return _to_dict(p)


@router.delete("/{id}")
def delete_phap_nhan(id: int, db: Session = Depends(get_db)):
    p = db.get(PhapNhan, id)
    if not p:
        raise HTTPException(404, "Không tìm thấy")
    db.delete(p)
    db.commit()
    return {"ok": True}
