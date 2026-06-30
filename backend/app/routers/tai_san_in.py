from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import Customer, Product
from app.models.purchase import PurchaseOrder
from app.models.sales import SalesOrder, SalesOrderItem
from app.models.accounting import CashPayment
from app.models.tai_san_in import TaiSanIn, TaiSanInSanPham
from app.schemas.tai_san_in import (
    TaiSanInCreate, TaiSanInUpdate, TaiSanInResponse, TaiSanInListResponse,
    SanPhamLinkCreate, SanPhamLinkResponse,
)

router = APIRouter(prefix="/api/tai-san-in", tags=["Tài sản in ấn"])


def _next_ma_tai_san(db: Session, loai: str) -> str:
    prefix_map = {"ban_in": "BSI", "khuon_be": "KBE"}
    prefix = prefix_map.get(loai, "TSI")
    year = date.today().year
    like_pat = f"{prefix}-{year}-%"
    last = (
        db.query(TaiSanIn)
        .filter(TaiSanIn.ma_tai_san.like(like_pat))
        .order_by(TaiSanIn.id.desc())
        .first()
    )
    if last:
        seq = int(last.ma_tai_san.split("-")[-1]) + 1
    else:
        seq = 1
    return f"{prefix}-{year}-{seq:03d}"


def _compute_san_luong_thuc_te(db: Session, tai_san_id: int) -> Decimal:
    """Tổng so_luong_da_xuat của các SalesOrderItem thuộc sản phẩm liên kết."""
    sp_ids = [
        row.san_pham_id
        for row in db.query(TaiSanInSanPham.san_pham_id)
        .filter(TaiSanInSanPham.tai_san_id == tai_san_id)
        .all()
    ]
    if not sp_ids:
        return Decimal("0")
    total = (
        db.query(func.coalesce(func.sum(SalesOrderItem.so_luong_da_xuat), 0))
        .filter(SalesOrderItem.product_id.in_(sp_ids))
        .scalar()
    )
    return Decimal(str(total or 0))


def _build_response(db: Session, obj: TaiSanIn) -> dict:
    san_luong = _compute_san_luong_thuc_te(db, obj.id)
    links = []
    for lnk in obj.san_pham_links:
        sp = lnk.san_pham
        links.append({
            "id": lnk.id,
            "san_pham_id": lnk.san_pham_id,
            "ghi_chu": lnk.ghi_chu,
            "created_at": lnk.created_at,
            "ma_amis": sp.ma_amis if sp else None,
            "ma_hang": sp.ma_hang if sp else None,
            "ten_hang": sp.ten_hang if sp else None,
        })
    return {
        **{c.name: getattr(obj, c.name) for c in obj.__table__.columns},
        "ten_khach": obj.customer.ten_viet_tat if obj.customer else None,
        "so_po": obj.purchase_order.so_po if obj.purchase_order else None,
        "so_don_thu": obj.sales_order_thu.so_don if obj.sales_order_thu else None,
        "san_luong_thuc_te": san_luong,
        "san_pham_links": links,
    }


# ─── LIST ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[TaiSanInListResponse])
def list_tai_san_in(
    loai: str | None = Query(None),
    customer_id: int | None = Query(None),
    trang_thai: str | None = Query(None),
    nguoi_chi_tra: str | None = Query(None),
    chua_thu_tien: bool | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = (
        db.query(TaiSanIn)
        .options(selectinload(TaiSanIn.customer), selectinload(TaiSanIn.san_pham_links))
        .order_by(TaiSanIn.id.desc())
    )
    if loai:
        q = q.filter(TaiSanIn.loai == loai)
    if customer_id:
        q = q.filter(TaiSanIn.customer_id == customer_id)
    if trang_thai:
        q = q.filter(TaiSanIn.trang_thai == trang_thai)
    if nguoi_chi_tra:
        q = q.filter(TaiSanIn.nguoi_chi_tra == nguoi_chi_tra)
    if chua_thu_tien is True:
        q = q.filter(TaiSanIn.nguoi_chi_tra == "khach_hang", TaiSanIn.da_thu_tien == False)

    rows = q.all()
    result = []
    for obj in rows:
        san_luong = _compute_san_luong_thuc_te(db, obj.id)
        result.append(TaiSanInListResponse(
            id=obj.id,
            ma_tai_san=obj.ma_tai_san,
            loai=obj.loai,
            mo_ta=obj.mo_ta,
            customer_id=obj.customer_id,
            ten_khach=obj.customer.ten_viet_tat if obj.customer else None,
            nguoi_chi_tra=obj.nguoi_chi_tra,
            gia_tri=obj.gia_tri,
            trang_thai=obj.trang_thai,
            da_thu_tien=obj.da_thu_tien,
            da_hoan_tien=obj.da_hoan_tien,
            san_luong_dinh_muc_hoan=obj.san_luong_dinh_muc_hoan,
            san_luong_thuc_te=san_luong,
            ngay_tao=obj.ngay_tao,
            so_san_pham=len(obj.san_pham_links),
        ))
    return result


# ─── CREATE ────────────────────────────────────────────────────────────────────

@router.post("", response_model=TaiSanInResponse, status_code=201)
def create_tai_san_in(
    data: TaiSanInCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not db.get(Customer, data.customer_id):
        raise HTTPException(404, "Không tìm thấy khách hàng")
    if data.purchase_order_id and not db.get(PurchaseOrder, data.purchase_order_id):
        raise HTTPException(404, "Không tìm thấy đơn mua hàng")
    if data.sales_order_thu_id and not db.get(SalesOrder, data.sales_order_thu_id):
        raise HTTPException(404, "Không tìm thấy đơn hàng")

    ma = data.ma_tai_san or _next_ma_tai_san(db, data.loai)
    if db.query(TaiSanIn).filter(TaiSanIn.ma_tai_san == ma).first():
        raise HTTPException(409, f"Mã tài sản '{ma}' đã tồn tại")

    payload = data.model_dump()
    payload.pop("ma_tai_san")
    obj = TaiSanIn(**payload, ma_tai_san=ma, user_id=current_user.id)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    db.refresh(obj, attribute_names=["customer", "purchase_order", "sales_order_thu", "san_pham_links"])
    return TaiSanInResponse(**_build_response(db, obj))


# ─── DETAIL ────────────────────────────────────────────────────────────────────

@router.get("/{tai_san_id}", response_model=TaiSanInResponse)
def get_tai_san_in(
    tai_san_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = (
        db.query(TaiSanIn)
        .options(
            selectinload(TaiSanIn.customer),
            selectinload(TaiSanIn.purchase_order),
            selectinload(TaiSanIn.sales_order_thu),
            selectinload(TaiSanIn.cash_payment_hoan),
            selectinload(TaiSanIn.san_pham_links).selectinload(TaiSanInSanPham.san_pham),
        )
        .filter(TaiSanIn.id == tai_san_id)
        .first()
    )
    if not obj:
        raise HTTPException(404, "Không tìm thấy tài sản")
    return TaiSanInResponse(**_build_response(db, obj))


# ─── UPDATE ────────────────────────────────────────────────────────────────────

@router.put("/{tai_san_id}", response_model=TaiSanInResponse)
def update_tai_san_in(
    tai_san_id: int,
    data: TaiSanInUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.get(TaiSanIn, tai_san_id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy tài sản")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)

    db.commit()
    db.refresh(obj)
    db.refresh(obj, attribute_names=["customer", "purchase_order", "sales_order_thu", "san_pham_links"])
    return TaiSanInResponse(**_build_response(db, obj))


# ─── DELETE ────────────────────────────────────────────────────────────────────

@router.delete("/{tai_san_id}", status_code=204)
def delete_tai_san_in(
    tai_san_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.get(TaiSanIn, tai_san_id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy tài sản")
    db.delete(obj)
    db.commit()


# ─── PRODUCT LINKAGE ───────────────────────────────────────────────────────────

@router.post("/{tai_san_id}/san-pham", response_model=SanPhamLinkResponse, status_code=201)
def add_san_pham_link(
    tai_san_id: int,
    data: SanPhamLinkCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.get(TaiSanIn, tai_san_id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy tài sản")

    sp = db.get(Product, data.san_pham_id)
    if not sp:
        raise HTTPException(404, "Không tìm thấy sản phẩm")

    # Bản in chỉ được liên kết với tối đa 1 sản phẩm
    if obj.loai == "ban_in":
        existing_count = (
            db.query(TaiSanInSanPham)
            .filter(TaiSanInSanPham.tai_san_id == tai_san_id)
            .count()
        )
        if existing_count >= 1:
            raise HTTPException(400, "Bản in chỉ được liên kết với 1 sản phẩm")

    # Kiểm tra trùng
    existing = (
        db.query(TaiSanInSanPham)
        .filter(TaiSanInSanPham.tai_san_id == tai_san_id, TaiSanInSanPham.san_pham_id == data.san_pham_id)
        .first()
    )
    if existing:
        raise HTTPException(409, "Sản phẩm đã được liên kết")

    link = TaiSanInSanPham(tai_san_id=tai_san_id, san_pham_id=data.san_pham_id, ghi_chu=data.ghi_chu)
    db.add(link)
    db.commit()
    db.refresh(link)
    return SanPhamLinkResponse(
        id=link.id,
        san_pham_id=link.san_pham_id,
        ghi_chu=link.ghi_chu,
        created_at=link.created_at,
        ma_amis=sp.ma_amis,
        ma_hang=sp.ma_hang,
        ten_hang=sp.ten_hang,
    )


@router.delete("/{tai_san_id}/san-pham/{san_pham_id}", status_code=204)
def remove_san_pham_link(
    tai_san_id: int,
    san_pham_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    link = (
        db.query(TaiSanInSanPham)
        .filter(TaiSanInSanPham.tai_san_id == tai_san_id, TaiSanInSanPham.san_pham_id == san_pham_id)
        .first()
    )
    if not link:
        raise HTTPException(404, "Không tìm thấy liên kết")
    db.delete(link)
    db.commit()


# ─── BY PRODUCT / BY CUSTOMER ──────────────────────────────────────────────────

@router.get("/by-san-pham/{san_pham_id}", response_model=list[TaiSanInListResponse])
def list_by_san_pham(
    san_pham_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    tai_san_ids = [
        row.tai_san_id
        for row in db.query(TaiSanInSanPham.tai_san_id)
        .filter(TaiSanInSanPham.san_pham_id == san_pham_id)
        .all()
    ]
    if not tai_san_ids:
        return []
    objs = (
        db.query(TaiSanIn)
        .options(selectinload(TaiSanIn.customer), selectinload(TaiSanIn.san_pham_links))
        .filter(TaiSanIn.id.in_(tai_san_ids))
        .order_by(TaiSanIn.id.desc())
        .all()
    )
    result = []
    for obj in objs:
        san_luong = _compute_san_luong_thuc_te(db, obj.id)
        result.append(TaiSanInListResponse(
            id=obj.id,
            ma_tai_san=obj.ma_tai_san,
            loai=obj.loai,
            mo_ta=obj.mo_ta,
            customer_id=obj.customer_id,
            ten_khach=obj.customer.ten_viet_tat if obj.customer else None,
            nguoi_chi_tra=obj.nguoi_chi_tra,
            gia_tri=obj.gia_tri,
            trang_thai=obj.trang_thai,
            da_thu_tien=obj.da_thu_tien,
            da_hoan_tien=obj.da_hoan_tien,
            san_luong_dinh_muc_hoan=obj.san_luong_dinh_muc_hoan,
            san_luong_thuc_te=san_luong,
            ngay_tao=obj.ngay_tao,
            so_san_pham=len(obj.san_pham_links),
        ))
    return result
