from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import PaperMaterial

router = APIRouter(prefix="/api/paper-materials", tags=["paper-materials"])


@router.get("")
def list_paper_materials(
    search: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
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
    total = q.count()
    items = q.order_by(PaperMaterial.ma_chinh).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [
            {
                "id": p.id,
                "ma_chinh": p.ma_chinh,
                "ma_amis": p.ma_amis,
                "ten": p.ten,
                "dvt": p.dvt,
                "kho": float(p.kho) if p.kho else None,
                "dinh_luong": float(p.dinh_luong) if p.dinh_luong else None,
                "ma_ky_hieu": p.ma_ky_hieu,
                "gia_mua": float(p.gia_mua),
            }
            for p in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


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
            "dinh_luong": float(p.dinh_luong) if p.dinh_luong else None,
        }
        for p in items
    ]
