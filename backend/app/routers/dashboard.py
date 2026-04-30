from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.sales import SalesOrder, Quote
from app.models.production import ProductionOrder
from app.models.master import Customer

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_stats(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    today = date.today()

    don_hang_moi_hom_nay = (
        db.query(SalesOrder)
        .filter(SalesOrder.ngay_don == today)
        .count()
    )

    cho_duyet = (
        db.query(SalesOrder)
        .filter(SalesOrder.trang_thai == "moi")
        .count()
    ) + (
        db.query(Quote)
        .filter(Quote.trang_thai == "moi")
        .count()
    )

    dang_san_xuat = (
        db.query(ProductionOrder)
        .filter(ProductionOrder.trang_thai == "dang_sx")
        .count()
    )

    tong_khach_hang = db.query(Customer).count()

    return {
        "don_hang_moi_hom_nay": don_hang_moi_hom_nay,
        "cho_duyet": cho_duyet,
        "dang_san_xuat": dang_san_xuat,
        "tong_khach_hang": tong_khach_hang,
    }
