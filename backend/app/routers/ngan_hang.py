from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user, get_admin_user
from app.models.ngan_hang import NganHang

router = APIRouter(prefix="/api/ngan-hang", tags=["Ngân hàng"])

BANKS_SEED = [
    ("ABBank", "Ngân hàng TMCP An Bình"),
    ("ACB", "Ngân hàng TMCP Á Châu"),
    ("Agribank", "Ngân hàng Nông nghiệp và Phát triển nông thôn Việt Nam"),
    ("ANZVL", "Ngân hàng TNHH một thành viên ANZ (Việt Nam)"),
    ("BIDV", "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam"),
    ("BVBANK", "Ngân hàng TMCP Bản Việt"),
    ("CB", "Ngân hàng Thương mại TNHH một thành viên Xây dựng Việt Nam"),
    ("DongABank", "Ngân hàng TMCP Đông Á"),
    ("Eximbank", "Ngân hàng TMCP Xuất nhập khẩu Việt Nam"),
    ("HDBank", "Ngân hàng TMCP phát triển Tp. Hồ Chí Minh"),
    ("IVB", "Ngân hàng TNHH Indovina"),
    ("LPBank", "Ngân hàng Lộc Phát Việt Nam"),
    ("MB", "Ngân hàng TMCP Quân đội"),
    ("MHB", "Ngân hàng Phát triển nhà ĐBSCL"),
    ("MSB", "Ngân hàng TMCP Hàng hải Việt Nam"),
    ("NamABank", "Ngân hàng TMCP NAM Á"),
    ("OCB", "Ngân hàng TMCP Phương Đông"),
    ("Ocean Bank", "Ngân hàng Thương mại TNHH một thành viên Đại Dương"),
    ("PG Bank", "Ngân hàng TMCP Thịnh Vượng và Phát triển"),
    ("PNB", "Ngân hàng TMCP Phương Nam"),
    ("Sacombank", "Ngân hàng TMCP Sài Gòn Thương tín"),
    ("Saigonbank", "Ngân hàng TMCP Sài Gòn Công Thương"),
    ("SeABank", "Ngân hàng TMCP Đông Nam Á"),
    ("SHB", "Ngân hàng TMCP Sài Gòn – Hà Nội"),
    ("ShinhanBank", "Ngân hàng TNHH MTV Shinhan Việt Nam"),
    ("Techcombank", "Ngân hàng TMCP Kỹ thương Việt Nam"),
    ("TPBank", "Ngân hàng Thương mại Cổ phần Tiên Phong"),
    ("VIB", "Ngân hàng TMCP Quốc Tế Việt Nam"),
    ("VID Public Bank", "Ngân hàng VID public"),
    ("Vietcombank", "Ngân hàng TMCP Ngoại thương Việt Nam"),
    ("VPBank", "Ngân hàng Việt Nam Thịnh Vượng"),
    ("VTB", "Ngân hàng TMCP Công Thương Việt Nam"),
]


class NganHangCreate(BaseModel):
    ma_ngan_hang: str
    ten_day_du: str
    trang_thai: bool = True


class NganHangUpdate(BaseModel):
    ten_day_du: Optional[str] = None
    trang_thai: Optional[bool] = None


class NganHangOut(BaseModel):
    id: int
    ma_ngan_hang: str
    ten_day_du: str
    trang_thai: bool
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=list[NganHangOut])
def list_ngan_hang(
    trang_thai: Optional[bool] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(NganHang)
    if trang_thai is not None:
        q = q.filter(NganHang.trang_thai == trang_thai)
    return q.order_by(NganHang.ma_ngan_hang).all()


@router.post("", response_model=NganHangOut, status_code=201)
def create_ngan_hang(
    body: NganHangCreate,
    db: Session = Depends(get_db),
    _=Depends(get_admin_user),
):
    if db.query(NganHang).filter(NganHang.ma_ngan_hang == body.ma_ngan_hang).first():
        raise HTTPException(status_code=400, detail="Mã ngân hàng đã tồn tại")
    obj = NganHang(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=NganHangOut)
def update_ngan_hang(
    id: int,
    body: NganHangUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_admin_user),
):
    obj = db.get(NganHang, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy ngân hàng")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{id}", status_code=204)
def delete_ngan_hang(
    id: int,
    db: Session = Depends(get_db),
    _=Depends(get_admin_user),
):
    obj = db.get(NganHang, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy ngân hàng")
    db.delete(obj)
    db.commit()


@router.post("/seed", status_code=201)
def seed_ngan_hang(
    db: Session = Depends(get_db),
    _=Depends(get_admin_user),
):
    added = 0
    for ma, ten in BANKS_SEED:
        if not db.query(NganHang).filter(NganHang.ma_ngan_hang == ma).first():
            db.add(NganHang(ma_ngan_hang=ma, ten_day_du=ten, trang_thai=True))
            added += 1
    db.commit()
    return {"added": added, "total": len(BANKS_SEED)}
