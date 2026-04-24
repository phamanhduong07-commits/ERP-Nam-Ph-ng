from datetime import date, datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import Customer
from app.models.sales import Quote, QuoteItem, SalesOrder, SalesOrderItem
from app.schemas.master import CustomerShort
from app.schemas.quotes import (
    QuoteCreate, QuoteUpdate,
    QuoteResponse, QuoteListItem, QuoteItemResponse,
)
from app.schemas.sales import PagedResponse

router = APIRouter(prefix="/api/quotes", tags=["quotes"])


def _generate_so_bao_gia(db: Session) -> str:
    today = date.today()
    prefix = f"BG{today.strftime('%Y%m%d')}"
    last = (
        db.query(Quote)
        .filter(Quote.so_bao_gia.like(f"{prefix}%"))
        .order_by(Quote.so_bao_gia.desc())
        .first()
    )
    seq = int(last.so_bao_gia[-3:]) + 1 if last else 1
    return f"{prefix}{seq:03d}"


def _build_response(quote: Quote) -> QuoteResponse:
    return QuoteResponse(
        id=quote.id,
        so_bao_gia=quote.so_bao_gia,
        so_bg_copy=quote.so_bg_copy,
        ngay_bao_gia=quote.ngay_bao_gia,
        customer_id=quote.customer_id,
        customer=CustomerShort.model_validate(quote.customer) if quote.customer else None,
        nv_phu_trach_id=quote.nv_phu_trach_id,
        nguoi_duyet_id=quote.nguoi_duyet_id,
        ngay_het_han=quote.ngay_het_han,
        chi_phi_bang_in=quote.chi_phi_bang_in,
        chi_phi_khuon=quote.chi_phi_khuon,
        chi_phi_van_chuyen=quote.chi_phi_van_chuyen,
        tong_tien_hang=quote.tong_tien_hang,
        ty_le_vat=quote.ty_le_vat,
        tien_vat=quote.tien_vat,
        chi_phi_hang_hoa_dv=quote.chi_phi_hang_hoa_dv,
        tong_cong=quote.tong_cong,
        chi_phi_khac_1_ten=quote.chi_phi_khac_1_ten,
        chi_phi_khac_1=quote.chi_phi_khac_1,
        chi_phi_khac_2_ten=quote.chi_phi_khac_2_ten,
        chi_phi_khac_2=quote.chi_phi_khac_2,
        chiet_khau=quote.chiet_khau,
        gia_ban=quote.gia_ban,
        gia_xuat_phoi_vsp=quote.gia_xuat_phoi_vsp,
        ghi_chu=quote.ghi_chu,
        dieu_khoan=quote.dieu_khoan,
        trang_thai=quote.trang_thai,
        created_at=quote.created_at,
        updated_at=quote.updated_at,
        items=[QuoteItemResponse.model_validate(i) for i in quote.items],
    )


def _load_quote(quote_id: int, db: Session) -> Quote:
    quote = (
        db.query(Quote)
        .options(joinedload(Quote.customer), joinedload(Quote.items))
        .filter(Quote.id == quote_id)
        .first()
    )
    if not quote:
        raise HTTPException(status_code=404, detail="Không tìm thấy báo giá")
    return quote


@router.get("", response_model=PagedResponse)
def list_quotes(
    search: str = Query(default=""),
    trang_thai: str | None = Query(default=None),
    customer_id: int | None = Query(default=None),
    tu_ngay: date | None = Query(default=None),
    den_ngay: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Quote).options(joinedload(Quote.customer))
    if search:
        like = f"%{search}%"
        q = q.join(Customer).filter(
            Quote.so_bao_gia.ilike(like) | Customer.ten_viet_tat.ilike(like)
        )
    if trang_thai:
        q = q.filter(Quote.trang_thai == trang_thai)
    if customer_id:
        q = q.filter(Quote.customer_id == customer_id)
    if tu_ngay:
        q = q.filter(Quote.ngay_bao_gia >= tu_ngay)
    if den_ngay:
        q = q.filter(Quote.ngay_bao_gia <= den_ngay)

    total = q.count()
    quotes = q.order_by(Quote.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = [
        QuoteListItem(
            id=qt.id,
            so_bao_gia=qt.so_bao_gia,
            ngay_bao_gia=qt.ngay_bao_gia,
            customer_id=qt.customer_id,
            ten_khach_hang=qt.customer.ten_viet_tat if qt.customer else None,
            trang_thai=qt.trang_thai,
            ngay_het_han=qt.ngay_het_han,
            tong_cong=qt.tong_cong,
            so_dong=len(qt.items),
        )
        for qt in quotes
    ]
    return PagedResponse(
        items=items, total=total, page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{quote_id}", response_model=QuoteResponse)
def get_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return _build_response(_load_quote(quote_id, db))


@router.post("", response_model=QuoteResponse, status_code=201)
def create_quote(
    data: QuoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    customer = db.query(Customer).filter(Customer.id == data.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")

    so_bao_gia = _generate_so_bao_gia(db)
    quote = Quote(
        so_bao_gia=so_bao_gia,
        so_bg_copy=data.so_bg_copy,
        ngay_bao_gia=data.ngay_bao_gia,
        customer_id=data.customer_id,
        nv_phu_trach_id=data.nv_phu_trach_id or current_user.id,
        ngay_het_han=data.ngay_het_han,
        chi_phi_bang_in=data.chi_phi_bang_in,
        chi_phi_khuon=data.chi_phi_khuon,
        chi_phi_van_chuyen=data.chi_phi_van_chuyen,
        tong_tien_hang=data.tong_tien_hang,
        ty_le_vat=data.ty_le_vat,
        tien_vat=data.tien_vat,
        chi_phi_hang_hoa_dv=data.chi_phi_hang_hoa_dv,
        tong_cong=data.tong_cong,
        chi_phi_khac_1_ten=data.chi_phi_khac_1_ten,
        chi_phi_khac_1=data.chi_phi_khac_1,
        chi_phi_khac_2_ten=data.chi_phi_khac_2_ten,
        chi_phi_khac_2=data.chi_phi_khac_2,
        chiet_khau=data.chiet_khau,
        gia_ban=data.gia_ban,
        gia_xuat_phoi_vsp=data.gia_xuat_phoi_vsp,
        ghi_chu=data.ghi_chu,
        dieu_khoan=data.dieu_khoan,
        trang_thai="moi",
        created_by=current_user.id,
    )
    for item_data in data.items:
        quote.items.append(QuoteItem(**item_data.model_dump()))

    db.add(quote)
    db.commit()
    db.refresh(quote)
    return _build_response(_load_quote(quote.id, db))


@router.put("/{quote_id}", response_model=QuoteResponse)
def update_quote(
    quote_id: int,
    data: QuoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quote = _load_quote(quote_id, db)
    if quote.trang_thai not in ("moi",):
        raise HTTPException(status_code=400, detail="Chỉ sửa được báo giá ở trạng thái Mới")

    update_data = data.model_dump(exclude_none=True, exclude={"items"})
    for field, value in update_data.items():
        setattr(quote, field, value)

    if data.items is not None:
        for item in quote.items:
            db.delete(item)
        db.flush()
        for item_data in data.items:
            quote.items.append(QuoteItem(**item_data.model_dump()))

    db.commit()
    return _build_response(_load_quote(quote_id, db))


@router.patch("/{quote_id}/approve", response_model=QuoteResponse)
def approve_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quote = _load_quote(quote_id, db)
    if quote.trang_thai != "moi":
        raise HTTPException(status_code=400, detail="Chỉ duyệt được báo giá ở trạng thái Mới")
    quote.trang_thai = "da_duyet"
    quote.nguoi_duyet_id = current_user.id
    quote.approved_by = current_user.id
    quote.approved_at = datetime.utcnow()
    db.commit()
    return _build_response(_load_quote(quote_id, db))


@router.patch("/{quote_id}/cancel")
def cancel_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Không tìm thấy báo giá")
    if quote.trang_thai in ("huy",):
        raise HTTPException(status_code=400, detail="Báo giá đã huỷ")
    quote.trang_thai = "huy"
    db.commit()
    return {"message": f"Đã huỷ báo giá {quote.so_bao_gia}"}


@router.post("/{quote_id}/tao-don-hang", response_model=dict)
def tao_don_hang_tu_bao_gia(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Chuyển báo giá đã duyệt thành đơn hàng."""
    from app.routers.sales_orders import _generate_so_don
    quote = _load_quote(quote_id, db)
    if quote.trang_thai != "da_duyet":
        raise HTTPException(
            status_code=400,
            detail="Chỉ lập đơn từ báo giá ở trạng thái Đã duyệt"
        )

    so_don = _generate_so_don(db)
    order = SalesOrder(
        so_don=so_don,
        ngay_don=date.today(),
        customer_id=quote.customer_id,
        nv_kinh_doanh_id=quote.nv_phu_trach_id,
        trang_thai="moi",
        ghi_chu=f"Lập từ báo giá {quote.so_bao_gia}",
        created_by=current_user.id,
    )

    tong_tien = Decimal("0")
    for qi in sorted(quote.items, key=lambda x: x.stt):
        item = SalesOrderItem(
            product_id=qi.product_id,
            quote_item_id=qi.id,
            ten_hang=qi.ten_hang,
            so_luong=qi.so_luong,
            dvt=qi.dvt,
            don_gia=qi.gia_ban,
            ghi_chu_san_pham=qi.ghi_chu,
            # Thông số kỹ thuật kế thừa từ báo giá
            loai_thung=qi.loai_thung,
            dai=qi.dai, rong=qi.rong, cao=qi.cao,
            so_lop=qi.so_lop, to_hop_song=qi.to_hop_song,
            mat=qi.mat,       mat_dl=qi.mat_dl,
            song_1=qi.song_1, song_1_dl=qi.song_1_dl,
            mat_1=qi.mat_1,   mat_1_dl=qi.mat_1_dl,
            song_2=qi.song_2, song_2_dl=qi.song_2_dl,
            mat_2=qi.mat_2,   mat_2_dl=qi.mat_2_dl,
            song_3=qi.song_3, song_3_dl=qi.song_3_dl,
            mat_3=qi.mat_3,   mat_3_dl=qi.mat_3_dl,
            loai_in=qi.loai_in, so_mau=qi.so_mau,
            kho_tt=qi.kho_tt,   dai_tt=qi.dai_tt,   dien_tich=qi.dien_tich,
        )
        order.items.append(item)
        tong_tien += qi.so_luong * qi.gia_ban

    order.tong_tien = tong_tien
    db.add(order)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        err = str(e)
        if "ten_hang" in err or "product_id" in err:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Lỗi cơ sở dữ liệu: bảng sales_order_items chưa được cập nhật. "
                    "Vui lòng chạy migrate_001.sql trên database."
                )
            )
        raise HTTPException(status_code=500, detail=f"Lỗi tạo đơn hàng: {err}")
    db.refresh(order)
    return {
        "so_don": order.so_don,
        "order_id": order.id,
        "so_dong": len(order.items),
        "message": f"Đã tạo đơn hàng {order.so_don} với {len(order.items)} mặt hàng",
    }
