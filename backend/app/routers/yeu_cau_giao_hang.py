from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import Customer, Warehouse, Product
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.sales import SalesOrder, SalesOrderItem
from app.models.yeu_cau_giao_hang import YeuCauGiaoHang, YeuCauGiaoHangItem
from app.services.carton_metrics import production_item_metrics

router = APIRouter(prefix="/api/yeu-cau-giao-hang", tags=["yeu-cau-giao-hang"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class YeuCauItemIn(BaseModel):
    production_order_id: int
    warehouse_id: int
    so_luong: Decimal
    dvt: str = "Thùng"
    dien_tich: Optional[Decimal] = None
    trong_luong: Optional[Decimal] = None
    ghi_chu: Optional[str] = None


class YeuCauGiaoHangIn(BaseModel):
    ngay_yeu_cau: date
    ngay_giao_yeu_cau: Optional[date] = None
    customer_id: Optional[int] = None
    dia_chi_giao: Optional[str] = None
    nguoi_nhan: Optional[str] = None
    ghi_chu: Optional[str] = None
    items: list[YeuCauItemIn]


class YeuCauPatchIn(BaseModel):
    trang_thai: Optional[str] = None
    ngay_giao_yeu_cau: Optional[date] = None
    dia_chi_giao: Optional[str] = None
    nguoi_nhan: Optional[str] = None
    ghi_chu: Optional[str] = None


# ── Helper ────────────────────────────────────────────────────────────────────

def _gen_yc_so(db: Session) -> str:
    ym = datetime.today().strftime("%Y%m")
    pattern = f"YC-{ym}-%"
    last = db.query(func.max(YeuCauGiaoHang.so_yeu_cau)).filter(
        YeuCauGiaoHang.so_yeu_cau.like(pattern)
    ).scalar()
    seq = 1
    if last:
        try:
            seq = int(last.rsplit("-", 1)[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    return f"YC-{ym}-{seq:04d}"


def _yc_to_dict(yc: YeuCauGiaoHang, db: Session) -> dict:
    cus = db.get(Customer, yc.customer_id) if yc.customer_id else None
    items_out = []
    ten_phap_nhan_set: list[str] = []
    ten_kho_tp_set: list[str] = []
    tong_dien_tich = 0.0
    tong_trong_luong = 0.0
    for it in yc.items:
        po = db.get(ProductionOrder, it.production_order_id)
        wh = db.get(Warehouse, it.warehouse_id)
        ten_kho = wh.ten_kho if wh else None
        ten_phap_nhan = None
        if po and po.phap_nhan_sx_id:
            from app.models.master import PhapNhan
            pn = db.get(PhapNhan, po.phap_nhan_sx_id)
            ten_phap_nhan = pn.ten_phap_nhan if pn else None
        if ten_phap_nhan and ten_phap_nhan not in ten_phap_nhan_set:
            ten_phap_nhan_set.append(ten_phap_nhan)
        if ten_kho and ten_kho not in ten_kho_tp_set:
            ten_kho_tp_set.append(ten_kho)
        first_item = po.items[0] if po and po.items else None
        dien_tich = it.dien_tich
        trong_luong = it.trong_luong
        if first_item and (
            dien_tich is None or dien_tich <= 0 or
            trong_luong is None or trong_luong <= 0
        ):
            metrics = production_item_metrics(first_item, it.so_luong)
            if dien_tich is None or dien_tich <= 0:
                dien_tich = metrics["dien_tich"]
            if trong_luong is None or trong_luong <= 0:
                trong_luong = metrics["trong_luong"]
        dien_tich_float = float(dien_tich or 0)
        trong_luong_float = float(trong_luong or 0)
        tong_dien_tich += dien_tich_float
        tong_trong_luong += trong_luong_float
        items_out.append({
            "id": it.id,
            "production_order_id": it.production_order_id,
            "so_lenh": po.so_lenh if po else None,
            "warehouse_id": it.warehouse_id,
            "ten_kho": ten_kho,
            "ten_phap_nhan": ten_phap_nhan,
            "product_id": it.product_id,
            "sales_order_item_id": it.sales_order_item_id,
            "ten_hang": it.ten_hang,
            "so_luong": float(it.so_luong),
            "dvt": it.dvt,
            "dien_tich": dien_tich_float,
            "trong_luong": trong_luong_float,
            "ghi_chu": it.ghi_chu,
        })
    return {
        "id": yc.id,
        "so_yeu_cau": yc.so_yeu_cau,
        "ngay_yeu_cau": str(yc.ngay_yeu_cau),
        "ngay_giao_yeu_cau": str(yc.ngay_giao_yeu_cau) if yc.ngay_giao_yeu_cau else None,
        "customer_id": yc.customer_id,
        "ten_khach_hang": cus.ten_viet_tat if cus else None,
        "ten_phap_nhan": ", ".join(ten_phap_nhan_set) if ten_phap_nhan_set else None,
        "ten_kho_tp": ", ".join(ten_kho_tp_set) if ten_kho_tp_set else None,
        "dia_chi_giao": yc.dia_chi_giao,
        "nguoi_nhan": yc.nguoi_nhan,
        "trang_thai": yc.trang_thai,
        "ghi_chu": yc.ghi_chu,
        "tong_dien_tich": tong_dien_tich,
        "tong_trong_luong": tong_trong_luong,
        "items": items_out,
        "created_at": yc.created_at.isoformat() if yc.created_at else None,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
def list_yeu_cau(
    trang_thai: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    ten_khach: Optional[str] = Query(None),
    nv_theo_doi_id: Optional[int] = Query(None),
    so_lenh: Optional[str] = Query(None),
    so_don: Optional[str] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(YeuCauGiaoHang).options(joinedload(YeuCauGiaoHang.items))
    if trang_thai:
        q = q.filter(YeuCauGiaoHang.trang_thai == trang_thai)
    if customer_id:
        q = q.filter(YeuCauGiaoHang.customer_id == customer_id)
    if ten_khach:
        q = q.join(Customer, Customer.id == YeuCauGiaoHang.customer_id).filter(
            Customer.ten_viet_tat.ilike(f"%{ten_khach}%")
        )
    if tu_ngay:
        q = q.filter(YeuCauGiaoHang.ngay_yeu_cau >= tu_ngay)
    if den_ngay:
        q = q.filter(YeuCauGiaoHang.ngay_yeu_cau <= den_ngay)

    # Lọc qua items → ProductionOrder (→ SalesOrder)
    if so_lenh or so_don or nv_theo_doi_id:
        sub = (
            db.query(YeuCauGiaoHangItem.yeu_cau_id)
            .join(ProductionOrder, ProductionOrder.id == YeuCauGiaoHangItem.production_order_id)
        )
        if nv_theo_doi_id:
            sub = sub.filter(ProductionOrder.nv_theo_doi_id == nv_theo_doi_id)
        if so_lenh:
            sub = sub.filter(ProductionOrder.so_lenh.ilike(f"%{so_lenh}%"))
        if so_don:
            sub = sub.join(SalesOrder, SalesOrder.id == ProductionOrder.sales_order_id).filter(
                SalesOrder.so_don.ilike(f"%{so_don}%")
            )
        q = q.filter(YeuCauGiaoHang.id.in_(sub))

    rows = q.order_by(YeuCauGiaoHang.created_at.desc()).limit(200).all()
    return [_yc_to_dict(r, db) for r in rows]


@router.get("/{yc_id}")
def get_yeu_cau(yc_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    yc = db.query(YeuCauGiaoHang).options(joinedload(YeuCauGiaoHang.items)).filter(
        YeuCauGiaoHang.id == yc_id
    ).first()
    if not yc:
        raise HTTPException(404, "Không tìm thấy yêu cầu giao hàng")
    return _yc_to_dict(yc, db)


@router.post("", status_code=201)
def create_yeu_cau(
    body: YeuCauGiaoHangIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.items:
        raise HTTPException(400, "Yêu cầu giao hàng phải có ít nhất 1 dòng hàng")

    # Suy customer_id từ PO nếu không truyền
    customer_id = body.customer_id
    if not customer_id:
        for it in body.items:
            po = db.get(ProductionOrder, it.production_order_id)
            if po and po.sales_order_id:
                from app.models.sales import SalesOrder
                so = db.get(SalesOrder, po.sales_order_id)
                if so and so.customer_id:
                    customer_id = so.customer_id
                    break

    yc = YeuCauGiaoHang(
        so_yeu_cau=_gen_yc_so(db),
        ngay_yeu_cau=body.ngay_yeu_cau,
        ngay_giao_yeu_cau=body.ngay_giao_yeu_cau,
        customer_id=customer_id,
        dia_chi_giao=body.dia_chi_giao,
        nguoi_nhan=body.nguoi_nhan,
        ghi_chu=body.ghi_chu,
        trang_thai="moi",
        created_by=current_user.id,
    )
    db.add(yc)
    db.flush()

    for it in body.items:
        po = db.get(ProductionOrder, it.production_order_id)
        if not po:
            raise HTTPException(404, f"Không tìm thấy lệnh SX id={it.production_order_id}")
        if not db.get(Warehouse, it.warehouse_id):
            raise HTTPException(404, f"Không tìm thấy kho id={it.warehouse_id}")

        # Xác định ten_hang, product_id, sales_order_item_id từ PO
        ten_hang = it.ten_hang if hasattr(it, "ten_hang") and getattr(it, "ten_hang", None) else ""
        product_id = None
        soi_id = None
        first_item = po.items[0] if po.items else None
        if first_item:
            ten_hang = ten_hang or (first_item.ten_hang or "")
            product_id = first_item.product_id
            soi_id = first_item.sales_order_item_id

        # Auto metrics from ProductionOrderItem when the UI leaves them empty.
        dien_tich = it.dien_tich
        trong_luong = it.trong_luong
        if first_item and (
            dien_tich is None or dien_tich <= 0 or
            trong_luong is None or trong_luong <= 0
        ):
            metrics = production_item_metrics(first_item, it.so_luong)
            if dien_tich is None or dien_tich <= 0:
                dien_tich = metrics["dien_tich"]
            if trong_luong is None or trong_luong <= 0:
                trong_luong = metrics["trong_luong"]

        db.add(YeuCauGiaoHangItem(
            yeu_cau_id=yc.id,
            production_order_id=it.production_order_id,
            warehouse_id=it.warehouse_id,
            product_id=product_id,
            sales_order_item_id=soi_id,
            ten_hang=ten_hang,
            so_luong=it.so_luong,
            dvt=it.dvt,
            dien_tich=dien_tich,
            trong_luong=trong_luong,
            ghi_chu=it.ghi_chu,
        ))

    db.commit()
    yc = db.query(YeuCauGiaoHang).options(joinedload(YeuCauGiaoHang.items)).filter(
        YeuCauGiaoHang.id == yc.id
    ).first()
    return _yc_to_dict(yc, db)


@router.patch("/{yc_id}")
def update_yeu_cau(
    yc_id: int,
    body: YeuCauPatchIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    yc = db.get(YeuCauGiaoHang, yc_id)
    if not yc:
        raise HTTPException(404, "Không tìm thấy yêu cầu giao hàng")
    if yc.trang_thai == "da_tao_phieu" and body.trang_thai != "huy":
        raise HTTPException(400, "Yêu cầu đã tạo phiếu, không thể sửa")

    if body.trang_thai is not None:
        yc.trang_thai = body.trang_thai
    if body.ngay_giao_yeu_cau is not None:
        yc.ngay_giao_yeu_cau = body.ngay_giao_yeu_cau
    if body.dia_chi_giao is not None:
        yc.dia_chi_giao = body.dia_chi_giao
    if body.nguoi_nhan is not None:
        yc.nguoi_nhan = body.nguoi_nhan
    if body.ghi_chu is not None:
        yc.ghi_chu = body.ghi_chu

    db.commit()
    yc = db.query(YeuCauGiaoHang).options(joinedload(YeuCauGiaoHang.items)).filter(
        YeuCauGiaoHang.id == yc_id
    ).first()
    return _yc_to_dict(yc, db)


@router.delete("/{yc_id}")
def delete_yeu_cau(
    yc_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    yc = db.get(YeuCauGiaoHang, yc_id)
    if not yc:
        raise HTTPException(404, "Không tìm thấy yêu cầu giao hàng")
    if yc.trang_thai not in ("moi", "huy"):
        raise HTTPException(400, "Chỉ xoá được yêu cầu ở trạng thái 'Mới'")
    db.delete(yc)
    db.commit()
    return {"ok": True}
