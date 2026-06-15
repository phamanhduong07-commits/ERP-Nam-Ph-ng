from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.deps import get_current_user, require_any_permission
from app.models.auth import User
from app.models.danhmuc_hr import BieuThueThuNhap, BieuThueThuNhapBac, KyHieuChamCong  # noqa: F401

router = APIRouter(
    prefix="/api/bieu-thue-thu-nhap",
    dependencies=[Depends(require_any_permission("hr.payroll_config"))],
    tags=["bieu-thue-thu-nhap"],
)


# ─── Schemas ─────────────────────────────────────────────────────────────────

class BacThueBase(BaseModel):
    bac: int
    thu_nhap_tu: float
    thu_nhap_den: float | None = None
    ty_le_thue: float
    so_tien_giam_tru: float = 0


class BieuThueThuNhapBase(BaseModel):
    ten_bieu: str
    nam_ap_dung: int
    loai: str  # "ca_nhan_cu_tru" | "ca_nhan_khong_cu_tru"
    ghi_chu: str | None = None
    trang_thai: bool = True


class BieuThueThuNhapCreate(BieuThueThuNhapBase):
    bac_thue: list[BacThueBase] = []


class BacThueResponse(BacThueBase):
    id: int
    bieu_id: int

    class Config:
        from_attributes = True


class BieuThueThuNhapResponse(BieuThueThuNhapBase):
    id: int
    bac_thue: list[BacThueResponse] = []

    class Config:
        from_attributes = True


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_bieu_or_404(db: Session, id: int) -> BieuThueThuNhap:
    obj = (
        db.query(BieuThueThuNhap)
        .options(selectinload(BieuThueThuNhap.bac_thue))
        .filter(BieuThueThuNhap.id == id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy biểu thuế thu nhập")
    return obj


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[BieuThueThuNhapResponse])
def list_bieu_thue_thu_nhap(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return (
        db.query(BieuThueThuNhap)
        .options(selectinload(BieuThueThuNhap.bac_thue))
        .order_by(BieuThueThuNhap.nam_ap_dung.desc(), BieuThueThuNhap.id.desc())
        .all()
    )


@router.get("/{id}", response_model=BieuThueThuNhapResponse)
def get_bieu_thue_thu_nhap(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return _get_bieu_or_404(db, id)


@router.post("", response_model=BieuThueThuNhapResponse, status_code=201)
def create_bieu_thue_thu_nhap(
    data: BieuThueThuNhapCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    payload = data.model_dump()
    bac_thue = payload.pop("bac_thue", [])
    obj = BieuThueThuNhap(**payload)
    obj.bac_thue = [BieuThueThuNhapBac(**bac) for bac in bac_thue]
    db.add(obj)
    db.commit()
    return _get_bieu_or_404(db, obj.id)


@router.put("/{id}", response_model=BieuThueThuNhapResponse)
def update_bieu_thue_thu_nhap(
    id: int,
    data: BieuThueThuNhapCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(BieuThueThuNhap).filter(BieuThueThuNhap.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy biểu thuế thu nhập")

    payload = data.model_dump()
    bac_thue = payload.pop("bac_thue", [])
    for k, v in payload.items():
        setattr(obj, k, v)

    # Thay toàn bộ danh sách bậc thuế: xoá hết bậc cũ, chèn lại từ request.
    # Gán list mới kích hoạt cascade delete-orphan với các bậc cũ.
    obj.bac_thue = [BieuThueThuNhapBac(**bac) for bac in bac_thue]

    db.commit()
    return _get_bieu_or_404(db, obj.id)


@router.delete("/{id}")
def delete_bieu_thue_thu_nhap(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(BieuThueThuNhap).filter(BieuThueThuNhap.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy biểu thuế thu nhập")
    # cascade all, delete-orphan trên quan hệ bac_thue tự xoá các bậc con
    db.delete(obj)
    db.commit()
    return {"ok": True}
