from datetime import date, datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import cast, Date, text
from sqlalchemy.orm import Session, joinedload
from app.database import get_db

# SQL backfill cho admin endpoint /admin/backfill-spec
_BACKFILL_QI_PG = """
    UPDATE sales_order_items soi
    SET quote_item_id = qi.id
    FROM quote_items qi
    JOIN quotes q ON q.id = qi.quote_id
    JOIN sales_orders so ON so.customer_id = q.customer_id
    WHERE soi.order_id = so.id
      AND soi.product_id = qi.product_id
      AND soi.quote_item_id IS NULL
      AND qi.product_id IS NOT NULL
"""

_BACKFILL_SPEC_PG = """
    UPDATE sales_order_items soi
    SET
        loai_thung   = qi.loai_thung,
        dai          = qi.dai,
        rong         = qi.rong,
        cao          = qi.cao,
        so_lop       = qi.so_lop,
        to_hop_song  = qi.to_hop_song,
        mat          = qi.mat,   mat_dl   = qi.mat_dl,
        song_1       = qi.song_1, song_1_dl = qi.song_1_dl,
        mat_1        = qi.mat_1,  mat_1_dl  = qi.mat_1_dl,
        song_2       = qi.song_2, song_2_dl = qi.song_2_dl,
        mat_2        = qi.mat_2,  mat_2_dl  = qi.mat_2_dl,
        song_3       = qi.song_3, song_3_dl = qi.song_3_dl,
        mat_3        = qi.mat_3,  mat_3_dl  = qi.mat_3_dl,
        loai_in      = qi.loai_in,
        so_mau       = qi.so_mau,
        loai_lan     = qi.loai_lan,
        kho_tt       = qi.kho_tt,
        dai_tt       = qi.dai_tt,
        dien_tich    = qi.dien_tich,
        c_tham       = qi.c_tham,
        can_man      = qi.can_man
    FROM quote_items qi
    WHERE soi.quote_item_id = qi.id
"""
from app.deps import get_current_user, get_admin_user, require_permissions
from app.models.auth import User
from app.models.master import Customer, Product
from app.models.sales import SalesOrder, SalesOrderItem, QuoteItem
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.production_plan import ProductionPlanLine
from app.services.sales_order_service import SalesOrderService
from app.schemas.master import CustomerShort, ProductShort
from app.schemas.sales import (
    SalesOrderCreate, SalesOrderUpdate,
    SalesOrderResponse, SalesOrderListItem,
    SalesOrderItemResponse, PagedResponse,
)
from fastapi import File, UploadFile
from app.services.sales_order_import_service import import_sales_orders_excel
from app.services.excel_import_service import build_template_response, ImportField, parse_text, parse_decimal
from app.utils.log import get_logger

logger = get_logger(__name__)

SALES_ORDER_IMPORT_FIELDS = [
    ImportField("so_don", "So don hang", required=True, help_text="VD: DH2405-001"),
    ImportField("ngay_don", "Ngay don", required=True, help_text="DD/MM/YYYY"),
    ImportField("ma_kh", "Ma KH", required=True, help_text="Phai ton tai trong danh muc"),
    ImportField("ma_amis", "Ma AMIS", required=True, help_text="Ma san pham"),
    ImportField("ten_hang", "Ten hang", help_text="De trong neu lay theo ma AMIS"),
    ImportField("so_luong", "So luong", required=True),
    ImportField("don_gia", "Don gia", required=True),
    ImportField("dvt", "DVT"),
    ImportField("ngay_giao", "Ngay giao", help_text="DD/MM/YYYY"),
    ImportField("dia_chi_giao", "Dia chi giao"),
    ImportField("bo_qua_hach_toan", "Bo qua hach toan", help_text="1=bo qua, 0=binh thuong"),
]


router = APIRouter(prefix="/api/sales-orders", tags=["sales-orders"])


@router.get("", response_model=PagedResponse)
def list_orders(
    search: str = Query(default=""),
    trang_thai: str | None = Query(default=None),
    customer_id: int | None = Query(default=None),
    phap_nhan_id: int | None = Query(default=None),
    tu_ngay: date | None = Query(default=None),
    den_ngay: date | None = Query(default=None),
    created_by: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=1000),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    service = SalesOrderService(db)
    return service.get_sales_orders_paginated(
        search=search,
        trang_thai=trang_thai,
        customer_id=customer_id,
        phap_nhan_id=phap_nhan_id,
        tu_ngay=tu_ngay,
        den_ngay=den_ngay,
        created_by=created_by,
        page=page,
        page_size=page_size,
    )


@router.get("/counts")
def get_counts(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from app.models.sales import SalesOrder as SO
    moi = db.query(SO).filter(SO.trang_thai == "moi").count()
    da_duyet = db.query(SO).filter(SO.trang_thai == "da_duyet").count()
    return {"moi": moi, "da_duyet": da_duyet}


@router.get("/{order_id}", response_model=SalesOrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    service = SalesOrderService(db)
    return service.get_sales_order_by_id(order_id)


@router.post("", response_model=SalesOrderResponse, status_code=201)
def create_order(
    data: SalesOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    customer = db.query(Customer).filter(Customer.id == data.customer_id, Customer.trang_thai == True).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")

    so_don = SalesOrderService(db)._generate_so_don()

    order = SalesOrder(
        so_don=so_don,
        ngay_don=data.ngay_don,
        customer_id=data.customer_id,
        phap_nhan_id=data.phap_nhan_id,
        phap_nhan_sx_id=data.phap_nhan_sx_id,
        phan_xuong_id=data.phan_xuong_id,
        ngay_giao_hang=data.ngay_giao_hang,
        dia_chi_giao=data.dia_chi_giao or customer.dia_chi_giao_hang,
        ghi_chu=data.ghi_chu,
        ty_le_giam_gia=data.ty_le_giam_gia,
        so_tien_giam_gia=data.so_tien_giam_gia,
        trang_thai="moi",
        created_by=current_user.id,
        nv_kinh_doanh_id=data.nv_kinh_doanh_id or current_user.id,
    )

    tong_tien = 0
    for item_data in data.items:
        product = db.query(Product).filter(Product.id == item_data.product_id, Product.trang_thai == True).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Sản phẩm ID {item_data.product_id} không tồn tại")

        item = SalesOrderItem(
            product_id=item_data.product_id,
            ten_hang=item_data.ten_hang or product.ten_hang,
            so_luong=item_data.so_luong,
            dvt=item_data.dvt or product.dvt,
            don_gia=item_data.don_gia,
            ty_le_giam_gia=item_data.ty_le_giam_gia,
            so_tien_giam_gia=item_data.so_tien_giam_gia,
            ngay_giao_hang=item_data.ngay_giao_hang,
            ghi_chu_san_pham=item_data.ghi_chu_san_pham,
            yeu_cau_in=item_data.yeu_cau_in,
            phan_xuong_id=item_data.phan_xuong_id,
        )
        order.items.append(item)
        tong_tien += float(item.thanh_tien)

    order.tong_tien = round(tong_tien, 2)

    # Tính tổng tiền sau giảm giá đơn hàng
    if order.ty_le_giam_gia > 0:
        order.tong_tien_sau_giam = order.tong_tien * (1 - order.ty_le_giam_gia / 100)
    elif order.so_tien_giam_gia > 0:
        order.tong_tien_sau_giam = max(0, order.tong_tien - order.so_tien_giam_gia)
    else:
        order.tong_tien_sau_giam = order.tong_tien
    db.add(order)
    db.commit()
    db.refresh(order)
    logger.info("created sales_order id=%s so_don=%s by user=%s", order.id, order.so_don, current_user.id)
    return get_order(order.id, db, current_user)


@router.put("/{order_id}", response_model=SalesOrderResponse)
def update_order(
    order_id: int,
    data: SalesOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(SalesOrder).filter(SalesOrder.id == order_id).first()
    if not order:
        logger.warning("sales_order id=%s not found", order_id)
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    if order.trang_thai not in ("moi",):
        raise HTTPException(status_code=400, detail="Chỉ có thể sửa đơn hàng ở trạng thái 'Mới'")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(order, field, value)
    db.commit()
    logger.info("updated sales_order id=%s", order_id)
    return get_order(order_id, db, current_user)


@router.patch("/{order_id}/approve", response_model=SalesOrderResponse)
def approve_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("sales_order.approve")),
):
    order = db.query(SalesOrder).filter(SalesOrder.id == order_id).first()
    if not order:
        logger.warning("sales_order id=%s not found", order_id)
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    if order.trang_thai != "moi":
        raise HTTPException(status_code=400, detail=f"Đơn hàng đang ở trạng thái '{order.trang_thai}', không thể duyệt")

    order.trang_thai = "da_duyet"
    order.approved_by = current_user.id
    order.approved_at = datetime.now(timezone.utc)
    db.commit()
    logger.info("approved sales_order id=%s by user=%s", order_id, current_user.id)
    return get_order(order_id, db, current_user)


@router.patch("/{order_id}/unapprove", response_model=SalesOrderResponse)
def unapprove_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("sales_order.approve")),
):
    order = db.query(SalesOrder).filter(SalesOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    if order.trang_thai != "da_duyet":
        raise HTTPException(status_code=400, detail=f"Chỉ có thể bỏ duyệt đơn hàng ở trạng thái 'Đã duyệt'. Hiện tại: '{order.trang_thai}'")

    order.trang_thai = "moi"
    order.approved_by = None
    order.approved_at = None
    db.commit()
    logger.info("unapproved sales_order id=%s by user=%s", order_id, current_user.id)
    return get_order(order_id, db, current_user)


@router.patch("/{order_id}/cancel")
def cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("sales_order.cancel")),
):
    order = db.query(SalesOrder).filter(SalesOrder.id == order_id).first()
    if not order:
        logger.warning("sales_order id=%s not found", order_id)
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    if order.trang_thai in ("hoan_thanh", "huy"):
        raise HTTPException(status_code=400, detail="Không thể huỷ đơn hàng này")

    order.trang_thai = "huy"
    db.commit()
    logger.info("cancelled sales_order id=%s so_don=%s by user=%s", order_id, order.so_don, current_user.id)
    return {"message": f"Đã huỷ đơn hàng {order.so_don}"}


@router.patch("/{order_id}/confirm-delivery", response_model=SalesOrderResponse)
def confirm_delivery(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("sales_order.approve")),
):
    """Xác nhận đã giao hàng — chuyển trạng thái da_duyet → da_giao."""
    order = db.query(SalesOrder).filter(SalesOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    if order.trang_thai != "da_duyet":
        raise HTTPException(
            status_code=400,
            detail=f"Chỉ có thể xác nhận giao hàng khi đơn ở trạng thái 'Đã duyệt'. Hiện tại: '{order.trang_thai}'"
        )
    order.trang_thai = "da_giao"
    order.updated_at = datetime.now(timezone.utc)
    db.commit()
    logger.info("confirm_delivery sales_order id=%s by user=%s", order_id, current_user.id)
    return get_order(order_id, db, current_user)


@router.patch("/{order_id}/complete", response_model=SalesOrderResponse)
def complete_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("sales_order.approve")),
):
    """Hoàn thành đơn hàng — chuyển trạng thái da_giao → hoan_thanh."""
    order = db.query(SalesOrder).filter(SalesOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    if order.trang_thai != "da_giao":
        raise HTTPException(
            status_code=400,
            detail=f"Chỉ có thể hoàn thành khi đơn ở trạng thái 'Đã giao'. Hiện tại: '{order.trang_thai}'"
        )
    order.trang_thai = "hoan_thanh"
    order.updated_at = datetime.now(timezone.utc)
    db.commit()
    logger.info("complete_order sales_order id=%s by user=%s", order_id, current_user.id)
    return get_order(order_id, db, current_user)


@router.patch("/{order_id}/update-discount")
def update_discount(
    order_id: int,
    ty_le_giam_gia: float | None = None,
    so_tien_giam_gia: float | None = None,
    ghi_chu: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("sales_order.approve")),
):
    """
    Cập nhật giảm giá cho đơn hàng đã duyệt/xuất kho.
    Chỉ cho phép cập nhật giảm giá, không cho phép sửa các thông tin khác.
    """
    order = db.query(SalesOrder).filter(SalesOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

    # Chỉ cho phép cập nhật giảm giá cho đơn hàng đã duyệt hoặc đã xuất kho
    if order.trang_thai not in ("da_duyet", "dang_xuat", "hoan_thanh"):
        raise HTTPException(
            status_code=400,
            detail=f"Chỉ có thể cập nhật giảm giá cho đơn hàng đã duyệt. Trạng thái hiện tại: '{order.trang_thai}'"
        )

    # Validate input
    if ty_le_giam_gia is not None and (ty_le_giam_gia < 0 or ty_le_giam_gia > 100):
        raise HTTPException(status_code=400, detail="Tỷ lệ giảm giá phải từ 0 đến 100")

    if so_tien_giam_gia is not None and so_tien_giam_gia < 0:
        raise HTTPException(status_code=400, detail="Số tiền giảm giá không được âm")

    # Cập nhật giảm giá
    if ty_le_giam_gia is not None:
        order.ty_le_giam_gia = Decimal(str(ty_le_giam_gia))
    if so_tien_giam_gia is not None:
        order.so_tien_giam_gia = Decimal(str(so_tien_giam_gia))

    # Cập nhật ghi chú nếu có
    if ghi_chu is not None:
        order.ghi_chu = ghi_chu

    # Tính lại tổng tiền
    tong_tien_hang = sum((item.so_luong * item.don_gia for item in order.items), Decimal("0"))
    order.tong_tien = tong_tien_hang

    # Áp dụng giảm giá
    if order.ty_le_giam_gia and order.ty_le_giam_gia > 0:
        tien_giam = tong_tien_hang * order.ty_le_giam_gia / Decimal("100")
    elif order.so_tien_giam_gia and order.so_tien_giam_gia > 0:
        tien_giam = order.so_tien_giam_gia
    else:
        tien_giam = Decimal("0")

    order.tong_tien_sau_giam = max(Decimal("0"), tong_tien_hang - tien_giam)

    # Cập nhật thời gian sửa đổi
    order.updated_at = datetime.now(timezone.utc)

    db.commit()
    return get_order(order_id, db, current_user)


@router.patch("/{order_id}/huy-lenh-sx")
def huy_lenh_sx(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(SalesOrder).filter(SalesOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    if order.trang_thai != "dang_sx":
        raise HTTPException(status_code=400, detail="Chỉ có thể hủy lệnh SX khi đơn hàng đang ở trạng thái Đang SX")

    lenh_list = db.query(ProductionOrder).filter(ProductionOrder.sales_order_id == order_id).all()
    non_moi = [l for l in lenh_list if l.trang_thai not in ("moi", "huy")]
    if non_moi:
        raise HTTPException(
            status_code=400,
            detail=f"Có {len(non_moi)} lệnh SX đã bắt đầu hoặc hoàn thành, không thể hủy"
        )

    for lenh in lenh_list:
        if lenh.trang_thai == "moi":
            lenh.trang_thai = "huy"
            # Xóa khỏi KHSX plan lines nếu còn đang chờ
            db.query(ProductionPlanLine).filter(
                ProductionPlanLine.production_order_item_id.in_(
                    [item.id for item in lenh.items]
                ),
                ProductionPlanLine.trang_thai == "cho",
            ).delete(synchronize_session=False)

    order.trang_thai = "da_duyet"
    db.commit()
    logger.info("huy_lenh_sx sales_order id=%s so_don=%s by user=%s", order_id, order.so_don, current_user.id)
    return {"message": f"Đã hủy lệnh SX, đơn hàng {order.so_don} về trạng thái Đã duyệt"}


@router.patch("/{order_id}/so-po-kh", response_model=SalesOrderResponse)
def update_so_po_kh(
    order_id: int,
    so_po_kh: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime, timezone
    order = db.query(SalesOrder).filter(SalesOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    order.so_po_kh = so_po_kh or None
    order.updated_at = datetime.now(timezone.utc)
    db.commit()
    return get_order(order_id, db, current_user)


@router.post("/admin/backfill-spec")
def backfill_spec(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """
    Chạy lại backfill spec từ quote_items → sales_order_items.
    Dùng khi đơn hàng cũ chưa có dữ liệu kỹ thuật từ báo giá.
    """
    try:
        r1 = db.execute(text(_BACKFILL_QI_PG))
        qi_rows = r1.rowcount
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Backfill quote_item_id thất bại: {e}")

    try:
        r2 = db.execute(text(_BACKFILL_SPEC_PG))
        spec_rows = r2.rowcount
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Backfill spec thất bại: {e}")

    db.commit()
    return {
        "message": "Backfill hoàn tất",
        "qi_rows": qi_rows,
        "spec_rows": spec_rows,
    }


@router.get("/import-template")
def download_sales_order_template(
    _: User = Depends(get_current_user),
):
    """Tải file mẫu Excel để import đơn hàng."""
    return build_template_response("mau_import_don_hang.xlsx", SALES_ORDER_IMPORT_FIELDS)


@router.post("/import")
async def import_sales_orders(
    commit: bool = Query(default=False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("sales.import")),
):
    """Import đơn hàng từ Excel. Hỗ trợ tạo mới hoặc cập nhật đơn hàng theo số đơn."""
    return await import_sales_orders_excel(db, file, current_user, commit)

