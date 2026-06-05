"""Kế hoạch sản xuất tận dụng — LSX dùng phôi sóng lỗi/thừa từ CD1."""
import math
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.sales import SalesOrder, SalesOrderItem, Quote, QuoteItem
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.warehouse_doc import ProductionOutput

router = APIRouter(prefix="/api/ke-hoach-tan-dung", tags=["ke-hoach-tan-dung"])


class TanDungItemOut(BaseModel):
    production_order_id: int
    production_order_item_id: int
    so_lenh: str
    ma_kh: str | None
    ten_khach_hang: str | None
    ten_hang: str | None
    so_don_hang: str | None
    ngay_giao_hang: date | None
    ngay_giao_kh: date | None
    loai_thung: str | None
    to_hop_song: str | None
    ket_cau: str | None
    dai: Decimal | None
    rong: Decimal | None
    cao: Decimal | None
    so_lop: int | None
    kho_tt: Decimal | None
    so_luong_ke_hoach: Decimal
    cong_doan: str | None
    loai_lan: str | None
    qccl: str | None
    ten_phan_xuong: str | None
    cat: str | None       # khổ phôi sau xẻ × dài
    so_luong_tam: int | None
    ghi_chu: str | None
    tong_nhap_phoi: int = 0   # số tấm phôi đã nhập (PhieuNhapPhoiSong)
    ton_kho_tp: float = 0.0   # số lượng TP đã nhập kho (ProductionOutput)

    class Config:
        from_attributes = True


def _ket_cau(item: ProductionOrderItem) -> str | None:
    layers = []
    so_lop = item.so_lop or 3
    if item.mat:
        layers.append(item.mat)
    if so_lop >= 3:
        if item.song_1:
            layers.append(item.song_1)
        if item.mat_1:
            layers.append(item.mat_1)
    if so_lop >= 5:
        if item.song_2:
            layers.append(item.song_2)
        if item.mat_2:
            layers.append(item.mat_2)
    if so_lop >= 7:
        if item.song_3:
            layers.append(item.song_3)
        if item.mat_3:
            layers.append(item.mat_3)
    return ".".join(layers) if layers else None


def _cong_doan_tan_dung(loai_thung: str | None, qi: "QuoteItem | None") -> str:
    """Tính công đoạn cho tận dụng: 'Không in-Bề', 'Không in-Chap', 'Không in-Chap-Dán'..."""
    ops = []
    if qi:
        if getattr(qi, "chap_xa", False):
            ops.append("Chap")
        if getattr(qi, "dan", False):
            ops.append("Dán")
        if getattr(qi, "boi", False):
            ops.append("Bồi")
    if ops:
        return "Không in-" + "-".join(ops)
    # Fallback theo loai_thung
    if loai_thung:
        lt = loai_thung.lower()
        if "bề" in lt or "be" in lt:
            return "Không in-Bề"
        if "lót" in lt or "lot" in lt:
            return "Không in-Chap"
    return "Không in"


def _cat(item: ProductionOrderItem) -> str | None:
    if not item.kho_tt or not item.dai_tt:
        return None
    kho = float(item.kho_tt)
    dai = float(item.dai_tt)
    so_lan = item.so_lan_cat or 1
    kho_sau_xe = kho / so_lan
    # Làm tròn 1 chữ số thập phân, bỏ .0 nếu là số nguyên
    def _fmt(v: float) -> str:
        r = round(v, 1)
        return str(int(r)) if r == int(r) else str(r)
    return f"{_fmt(kho_sau_xe)} × {_fmt(dai)}"


@router.get("", response_model=list[TanDungItemOut])
def list_tan_dung(
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    phan_xuong_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = (
        db.query(ProductionOrder)
        .filter(ProductionOrder.tan_dung == True)  # noqa: E712
        .options(
            selectinload(ProductionOrder.items).selectinload(ProductionOrderItem.sales_order_item).selectinload(
                SalesOrderItem.quote_item
            ),
            selectinload(ProductionOrder.sales_order).selectinload(SalesOrder.customer),
            selectinload(ProductionOrder.phan_xuong),
        )
    )

    if phan_xuong_id:
        q = q.filter(ProductionOrder.phan_xuong_id == phan_xuong_id)

    orders = q.order_by(ProductionOrder.ngay_lenh.desc()).all()

    # Aggregate receipt data per production_order_id
    po_ids = [o.id for o in orders]
    nhap_phoi_map: dict[int, int] = {}
    tp_map: dict[int, float] = {}
    if po_ids:
        nhap_agg = (
            db.query(
                PhieuNhapPhoiSong.production_order_id,
                func.coalesce(func.sum(PhieuNhapPhoiSongItem.so_tam), 0).label("tong_tam"),
            )
            .join(PhieuNhapPhoiSongItem, PhieuNhapPhoiSong.id == PhieuNhapPhoiSongItem.phieu_id)
            .filter(PhieuNhapPhoiSong.production_order_id.in_(po_ids))
            .group_by(PhieuNhapPhoiSong.production_order_id)
            .all()
        )
        nhap_phoi_map = {r.production_order_id: int(r.tong_tam) for r in nhap_agg}
        tp_agg = (
            db.query(
                ProductionOutput.production_order_id,
                func.coalesce(func.sum(ProductionOutput.so_luong_nhap), 0).label("tong_nhap"),
            )
            .filter(ProductionOutput.production_order_id.in_(po_ids))
            .group_by(ProductionOutput.production_order_id)
            .all()
        )
        tp_map = {r.production_order_id: float(r.tong_nhap) for r in tp_agg}

    result: list[TanDungItemOut] = []
    for order in orders:
        kh = order.sales_order.customer if order.sales_order else None
        ma_kh = kh.ma_kh if kh else None
        ten_px = order.phan_xuong.ten_xuong if order.phan_xuong else None

        for item in order.items:
            # Lọc theo ngày giao hàng nếu có filter
            if from_date and item.ngay_giao_hang and item.ngay_giao_hang < from_date:
                continue
            if to_date and item.ngay_giao_hang and item.ngay_giao_hang > to_date:
                continue

            soi = item.sales_order_item
            qi = soi.quote_item if soi else None

            result.append(TanDungItemOut(
                production_order_id=order.id,
                production_order_item_id=item.id,
                so_lenh=order.so_lenh,
                ma_kh=ma_kh,
                ten_khach_hang=kh.ten_viet_tat if kh else None,
                ten_hang=item.ten_hang,
                so_don_hang=order.sales_order.so_don if order.sales_order else None,
                ngay_giao_hang=item.ngay_giao_hang,
                ngay_giao_kh=order.ngay_hoan_thanh_ke_hoach,
                loai_thung=item.loai_thung,
                to_hop_song=item.to_hop_song,
                ket_cau=_ket_cau(item),
                dai=item.dai,
                rong=item.rong,
                cao=item.cao,
                so_lop=item.so_lop,
                kho_tt=item.kho_tt,
                so_luong_ke_hoach=item.so_luong_ke_hoach,
                cong_doan=_cong_doan_tan_dung(item.loai_thung, qi),
                loai_lan=item.loai_lan,
                qccl=item.qccl,
                ten_phan_xuong=ten_px,
                cat=_cat(item),
                so_luong_tam=math.ceil(float(item.so_luong_ke_hoach) / (item.be_so_con or 1)),
                ghi_chu=item.ghi_chu or order.ghi_chu,
                tong_nhap_phoi=nhap_phoi_map.get(order.id, 0),
                ton_kho_tp=tp_map.get(order.id, 0.0),
            ))

    # Sắp xếp theo ngày giao hàng
    result.sort(key=lambda x: (x.ngay_giao_hang or date.min))
    return result
