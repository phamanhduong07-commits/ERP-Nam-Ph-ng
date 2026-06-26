from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, exists
from app.database import get_db
from app.deps import get_current_user, get_sale_visible_nv_ids
from app.models.auth import User
from app.models.master import PhanXuong
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.production_plan import ProductionPlanLine
from app.models.sales import SalesOrder
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.phieu_xuat_phoi import PhieuXuatPhoiItem
from app.models.cd2 import PhieuIn
from app.models.warehouse_doc import PhieuChuyenKho, PhieuChuyenKhoItem, ProductionOutput, DeliveryOrder, DeliveryOrderItem
from app.services.carton_metrics import production_item_metrics

router = APIRouter(prefix="/api/theo-doi", tags=["theo-doi"])

STAGE_LABELS = {
    "moi": "Đơn mới",
    "da_duyet": "Đã duyệt",
    "lap_lenh": "Lập lệnh SX",
    "cho_sx": "Chờ SX",
    "chua_nhap": "Chưa nhập phôi",
    "co_phoi": "Nhập phôi",
    "cho_in": "Chờ in",
    "ke_hoach": "Kế hoạch",
    "dang_in": "Đang in",
    "cho_dinh_hinh": "Chờ định hình",
    "sau_in": "Sau in",
    "dang_sau_in": "Đang sau in",
    "hoan_thanh": "Hoàn thành",
    "huy": "Huỷ",
    # Tận dụng + Mua ngoài
    "cho_phoi_td": "Chờ phôi tận dụng",
    "nhap_tp_td": "Đã nhập TP",
    "cho_mua_phoi": "Chờ mua phôi",
}


def _build_row(po, nhap_map, xuat_map, pi_map, plan_set, chuyen_map=None, ton_tp_map=None):
    nhap = nhap_map.get(po.id)
    tong_nhap = float(nhap.tong_tam or 0) if nhap else 0.0
    ton_kho = tong_nhap - xuat_map.get(po.id, 0.0)
    pi = pi_map.get(po.id)

    ton_kho_tp_val = float(((ton_tp_map or {}).get(po.id) or {}).get("ton", 0))

    if pi:
        stage = pi.trang_thai
    elif ton_kho_tp_val > 0 and getattr(po, "tan_dung", False):
        stage = "nhap_tp_td"        # tận dụng đã nhập kho TP
    elif tong_nhap > 0:
        stage = "co_phoi"           # đã có phôi sóng
    elif getattr(po, "tan_dung", False):
        stage = "cho_phoi_td"       # tận dụng chưa xử lý
    elif po.trang_thai == "mua_ngoai":
        stage = "cho_mua_phoi"      # mua ngoài chưa có giấy về
    elif po.id in plan_set:
        stage = "cho_sx"
    else:
        stage = "lap_lenh"

    first_item = po.items[0] if po.items else None
    so = po.sales_order
    kh = so.customer if so else None

    so_luong_ke_hoach = float(first_item.so_luong_ke_hoach) if first_item else 0
    metrics = production_item_metrics(first_item, first_item.so_luong_ke_hoach if first_item else 0)
    so_khoi = float(metrics["the_tich"])

    return {
        "production_order_id": po.id,
        "so_lenh": po.so_lenh,
        "ngay_lenh": str(po.ngay_lenh) if po.ngay_lenh else None,
        "trang_thai_po": po.trang_thai,
        "tan_dung": getattr(po, "tan_dung", False),
        "phan_xuong_id": po.phan_xuong_id,
        "ten_phan_xuong": po.phan_xuong.ten_xuong if po.phan_xuong else None,
        "phap_nhan_id": po.phap_nhan_id,
        "ten_phap_nhan": po.phap_nhan.ten_viet_tat if po.phap_nhan else None,
        "ten_kho_sx": po.kho_sx.ten_kho if po.kho_sx else None,
        "sales_order_id": po.sales_order_id,
        "so_don": so.so_don if so else None,
        "customer_id": kh.id if kh else None,
        "ten_khach_hang": kh.ten_viet_tat if kh else None,
        "ngay_giao_hang": str(po.ngay_hoan_thanh_ke_hoach) if po.ngay_hoan_thanh_ke_hoach else None,
        "ten_hang": first_item.ten_hang if first_item else None,
        "so_luong_ke_hoach": so_luong_ke_hoach,
        "nv_theo_doi_id": po.nv_theo_doi_id,
        "ten_nv_theo_doi": po.nv_theo_doi.ho_ten if po.nv_theo_doi else None,
        "tong_nhap_phoi": tong_nhap,
        "ngay_nhap_cuoi": str(nhap.ngay_cuoi) if nhap and nhap.ngay_cuoi else None,
        "ton_kho_phoi": ton_kho,
        "tong_chuyen_phoi": float(((chuyen_map or {}).get(po.id) or {}).get("tong_chuyen", 0)),
        "ngay_chuyen_cuoi": ((chuyen_map or {}).get(po.id) or {}).get("ngay_cuoi"),
        "phieu_in_id": pi.id if pi else None,
        "so_phieu_in": pi.so_phieu if pi else None,
        "trang_thai_in": pi.trang_thai if pi else None,
        "ten_may_in": (pi.may_in_obj.ten_may if pi.may_in_obj else None) if pi else None,
        "ngay_in": str(pi.ngay_in) if pi and pi.ngay_in else None,
        "so_luong_in_ok": float(pi.so_luong_in_ok or 0) if pi else None,
        "so_khoi": so_khoi,
        "ton_kho_tp": float(((ton_tp_map or {}).get(po.id) or {}).get("ton", 0)),
        "ngay_nhap_tp_cuoi": ((ton_tp_map or {}).get(po.id) or {}).get("ngay_cuoi"),
        "stage": stage,
        "stage_label": STAGE_LABELS.get(stage, stage),
    }


def _build_so_row(so: SalesOrder) -> dict:
    kh = so.customer
    first_item = so.items[0] if so.items else None
    ngay_giao = None
    if so.ngay_giao_hang:
        ngay_giao = str(so.ngay_giao_hang)
    elif first_item and first_item.ngay_giao_hang:
        ngay_giao = str(first_item.ngay_giao_hang)
    return {
        "production_order_id": None,
        "so_lenh": None,
        "ngay_lenh": str(so.ngay_don),
        "trang_thai_po": "da_duyet",
        "phan_xuong_id": None,
        "ten_phan_xuong": None,
        "sales_order_id": so.id,
        "so_don": so.so_don,
        "customer_id": kh.id if kh else None,
        "ten_khach_hang": kh.ten_viet_tat if kh else None,
        "ngay_giao_hang": ngay_giao,
        "ten_hang": first_item.ten_hang if first_item else None,
        "so_luong_ke_hoach": float(first_item.so_luong) if first_item else 0,
        "nv_theo_doi_id": None,
        "ten_nv_theo_doi": None,
        "tong_nhap_phoi": 0,
        "ngay_nhap_cuoi": None,
        "ton_kho_phoi": 0,
        "tong_chuyen_phoi": 0,
        "ngay_chuyen_cuoi": None,
        "phieu_in_id": None,
        "so_phieu_in": None,
        "trang_thai_in": None,
        "ten_may_in": None,
        "ngay_in": None,
        "so_luong_in_ok": None,
        "so_khoi": 0.0,
        "ton_kho_tp": 0.0,
        "ngay_nhap_tp_cuoi": None,
        "stage": so.trang_thai,
        "stage_label": STAGE_LABELS.get(so.trang_thai, so.trang_thai),
    }


def _query_rows(
    db: Session,
    phan_xuong_id: Optional[int],
    nv_theo_doi_id: Optional[int],
    phap_nhan_id: Optional[int],
    tu_ngay: Optional[str],
    den_ngay: Optional[str],
    include_hoan_thanh: bool,
    so_lenh: Optional[str],
    so_don: Optional[str],
):
    q = db.query(ProductionOrder).options(
        joinedload(ProductionOrder.sales_order).joinedload(SalesOrder.customer),
        joinedload(ProductionOrder.items),
        joinedload(ProductionOrder.phan_xuong),
        joinedload(ProductionOrder.nv_theo_doi),
        joinedload(ProductionOrder.phap_nhan),
        joinedload(ProductionOrder.kho_sx),
    )

    if not include_hoan_thanh:
        q = q.filter(ProductionOrder.trang_thai.notin_(["hoan_thanh", "huy"]))
    if phan_xuong_id:
        q = q.filter(ProductionOrder.phan_xuong_id == phan_xuong_id)
    if nv_theo_doi_id:
        q = q.filter(ProductionOrder.nv_theo_doi_id == nv_theo_doi_id)
    if phap_nhan_id:
        q = q.filter(ProductionOrder.phap_nhan_id == phap_nhan_id)
    if tu_ngay:
        q = q.filter(ProductionOrder.ngay_lenh >= tu_ngay)
    if den_ngay:
        q = q.filter(ProductionOrder.ngay_lenh <= den_ngay)
    if so_lenh:
        q = q.filter(ProductionOrder.so_lenh.ilike(f"%{so_lenh}%"))
    if so_don:
        q = q.join(SalesOrder, SalesOrder.id == ProductionOrder.sales_order_id).filter(
            SalesOrder.so_don.ilike(f"%{so_don}%")
        )

    orders = q.order_by(ProductionOrder.ngay_hoan_thanh_ke_hoach.asc().nullslast()).all()

    po_ids = [o.id for o in orders]

    nhap_map: dict = {}
    xuat_map: dict = {}
    pi_map: dict = {}
    plan_set: set = set()
    chuyen_map: dict = {}

    if po_ids:
        nhap_agg = (
            db.query(
                PhieuNhapPhoiSong.production_order_id,
                func.sum(PhieuNhapPhoiSongItem.so_tam).label("tong_tam"),
                func.max(PhieuNhapPhoiSong.ngay).label("ngay_cuoi"),
            )
            .join(PhieuNhapPhoiSongItem, PhieuNhapPhoiSong.id == PhieuNhapPhoiSongItem.phieu_id)
            .filter(PhieuNhapPhoiSong.production_order_id.in_(po_ids))
            .group_by(PhieuNhapPhoiSong.production_order_id)
            .all()
        )
        nhap_map = {r.production_order_id: r for r in nhap_agg}

        xuat_agg = (
            db.query(
                ProductionOrderItem.production_order_id,
                func.sum(PhieuXuatPhoiItem.so_luong).label("tong_xuat"),
            )
            .join(PhieuXuatPhoiItem, PhieuXuatPhoiItem.production_order_item_id == ProductionOrderItem.id)
            .filter(ProductionOrderItem.production_order_id.in_(po_ids))
            .group_by(ProductionOrderItem.production_order_id)
            .all()
        )
        xuat_map = {r.production_order_id: float(r.tong_xuat or 0) for r in xuat_agg}

        phieu_ins = (
            db.query(PhieuIn)
            .options(joinedload(PhieuIn.may_in_obj))
            .filter(
                PhieuIn.production_order_id.in_(po_ids),
                PhieuIn.trang_thai != "huy",
            )
            .order_by(PhieuIn.production_order_id, PhieuIn.id.desc())
            .all()
        )
        for pi in phieu_ins:
            if pi.production_order_id not in pi_map:
                pi_map[pi.production_order_id] = pi

        plan_rows = (
            db.query(ProductionOrderItem.production_order_id)
            .join(ProductionPlanLine, ProductionPlanLine.production_order_item_id == ProductionOrderItem.id)
            .filter(ProductionOrderItem.production_order_id.in_(po_ids))
            .distinct()
            .all()
        )
        plan_set = {r.production_order_id for r in plan_rows}

        chuyen_agg = (
            db.query(
                PhieuChuyenKhoItem.production_order_id,
                func.sum(PhieuChuyenKhoItem.so_luong).label("tong_chuyen"),
                func.max(PhieuChuyenKho.ngay).label("ngay_cuoi"),
            )
            .join(PhieuChuyenKho, PhieuChuyenKho.id == PhieuChuyenKhoItem.phieu_chuyen_kho_id)
            .filter(PhieuChuyenKhoItem.production_order_id.in_(po_ids))
            .group_by(PhieuChuyenKhoItem.production_order_id)
            .all()
        )
        chuyen_map = {
            r.production_order_id: {
                "tong_chuyen": float(r.tong_chuyen or 0),
                "ngay_cuoi": str(r.ngay_cuoi) if r.ngay_cuoi else None,
            }
            for r in chuyen_agg
        }

        nhap_tp_agg = (
            db.query(
                ProductionOutput.production_order_id,
                func.coalesce(func.sum(ProductionOutput.so_luong_nhap), 0).label("tong_nhap_tp"),
                func.max(ProductionOutput.ngay_nhap).label("ngay_cuoi"),
            )
            .filter(ProductionOutput.production_order_id.in_(po_ids))
            .group_by(ProductionOutput.production_order_id)
            .all()
        )
        nhap_tp_map = {
            r.production_order_id: {
                "tong_nhap": float(r.tong_nhap_tp),
                "ngay_cuoi": str(r.ngay_cuoi) if r.ngay_cuoi else None,
            }
            for r in nhap_tp_agg
        }

        xuat_tp_agg = (
            db.query(
                DeliveryOrderItem.production_order_id,
                func.coalesce(func.sum(DeliveryOrderItem.so_luong), 0).label("tong_xuat_tp"),
            )
            .join(DeliveryOrder, DeliveryOrder.id == DeliveryOrderItem.delivery_id)
            .filter(
                DeliveryOrderItem.production_order_id.in_(po_ids),
                DeliveryOrder.trang_thai != "huy",
            )
            .group_by(DeliveryOrderItem.production_order_id)
            .all()
        )
        xuat_tp_map = {r.production_order_id: float(r.tong_xuat_tp) for r in xuat_tp_agg}

        ton_tp_map = {
            po_id: {
                "ton": nhap_tp_map.get(po_id, {}).get("tong_nhap", 0.0) - xuat_tp_map.get(po_id, 0.0),
                "ngay_cuoi": nhap_tp_map.get(po_id, {}).get("ngay_cuoi"),
            }
            for po_id in po_ids
        }

    result = [_build_row(o, nhap_map, xuat_map, pi_map, plan_set, chuyen_map, ton_tp_map) for o in orders]

    # SOs chưa có lệnh SX — chỉ hiển thị khi không filter theo xưởng/NV/pháp nhân
    if not phan_xuong_id and not nv_theo_doi_id and not phap_nhan_id:
        so_q = (
            db.query(SalesOrder)
            .options(
                joinedload(SalesOrder.customer),
                joinedload(SalesOrder.items),
            )
            .filter(
                SalesOrder.trang_thai.in_(["moi", "da_duyet"]),
                ~exists().where(ProductionOrder.sales_order_id == SalesOrder.id),
            )
        )
        if so_don:
            so_q = so_q.filter(SalesOrder.so_don.ilike(f"%{so_don}%"))
        for so in so_q.all():
            result.append(_build_so_row(so))

    return result


@router.get("/don-hang")
def theo_doi_don_hang(
    phan_xuong_id: Optional[int] = Query(default=None),
    nv_theo_doi_id: Optional[int] = Query(default=None),
    phap_nhan_id: Optional[int] = Query(default=None),
    tu_ngay: Optional[str] = Query(default=None),
    den_ngay: Optional[str] = Query(default=None),
    include_hoan_thanh: bool = Query(default=False),
    so_lenh: Optional[str] = Query(default=None),
    so_don: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = _query_rows(
        db, phan_xuong_id, nv_theo_doi_id, phap_nhan_id,
        tu_ngay, den_ngay, include_hoan_thanh,
        so_lenh, so_don,
    )

    scope_nv_ids = get_sale_visible_nv_ids(current_user)
    if scope_nv_ids is not None:
        from sqlalchemy import exists, or_
        from app.models.master import Customer, CustomerNhanVien
        visible_cids = {r.id for r in db.query(Customer.id).filter(
            or_(
                Customer.nv_phu_trach_id.in_(scope_nv_ids),
                exists().where(
                    (CustomerNhanVien.customer_id == Customer.id)
                    & (CustomerNhanVien.user_id.in_(scope_nv_ids))
                ),
            )
        ).all()}
        result = [r for r in result if r.get("customer_id") in visible_cids]

    return result


@router.get("/bot-query")
def bot_query(
    so_lenh: Optional[str] = Query(default=None),
    so_don: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Endpoint gọn cho bot — query theo so_lenh hoặc so_don."""
    if not so_lenh and not so_don:
        return {"error": "Cần cung cấp so_lenh hoặc so_don"}
    return _query_rows(
        db,
        phan_xuong_id=None, nv_theo_doi_id=None, phap_nhan_id=None,
        tu_ngay=None, den_ngay=None,
        include_hoan_thanh=True,
        so_lenh=so_lenh, so_don=so_don,
    )


@router.get("/phan-xuong")
def list_phan_xuong(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = db.query(PhanXuong).filter(PhanXuong.trang_thai == True).order_by(PhanXuong.ma_xuong).all()  # noqa: E712
    return [
        {
            "id": r.id,
            "ma_xuong": r.ma_xuong,
            "ten_xuong": r.ten_xuong,
            "phoi_tu_phan_xuong_id": r.phoi_tu_phan_xuong_id,
        }
        for r in rows
    ]
