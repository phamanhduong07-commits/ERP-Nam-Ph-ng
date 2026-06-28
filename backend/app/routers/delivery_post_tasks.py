"""Hậu Giao Hàng — Post-delivery task queue.

SA tạo task → TP SA duyệt / từ chối → Kho xác nhận (trường hợp hàng về kho).
"""
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.warehouse_doc import DeliveryOrder, DeliveryOrderItem, DeliveryPostTask
from app.models.production import ProductionOrder
from app.models.master import PhanXuong, PhapNhan
from app.services.accounting_service import AccountingService
from app.services.billing_service import BillingService
from app.services.inventory_service import (
    get_or_create_balance as _get_or_create_balance,
    nhap_balance as _nhap_balance,
    xuat_balance as _xuat_balance,
    log_tx as _log_tx,
)

router = APIRouter(prefix="/api/delivery-post-tasks", tags=["Hậu Giao Hàng"])

TINH_TRANG_VALID = {"giao_thieu", "giao_du", "bu_hao", "loi_phat_hien"}
HUONG_XU_LY_VALID = {
    "giao_bu_sau", "giam_don_hang",
    "thu_hoi_ve", "tinh_tien_them", "khach_giu_mien_phi",
    "xuat_bu_hao",
    "doi_hang", "nhap_kho_hong", "hoan_tien",
}
RETURN_CASES = {"thu_hoi_ve", "nhap_kho_hong", "doi_hang", "hoan_tien"}


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class CreateDeliveryPostTaskIn(BaseModel):
    delivery_id: int
    item_id: int
    tinh_trang: str
    huong_xu_ly: str
    so_luong_moi: Decimal
    so_luong_bu_hao: Decimal = Decimal("0")
    ghi_chu_sa: Optional[str] = None


class ApproveTaskIn(BaseModel):
    ghi_chu_tp: Optional[str] = None


class TuChoiTaskIn(BaseModel):
    ghi_chu_tp: Optional[str] = None


class KhoNhanIn(BaseModel):
    kho_id: int
    ghi_chu_kho: Optional[str] = None


def _task_dict(task: DeliveryPostTask) -> dict:
    return {
        "id": task.id,
        "delivery_id": task.delivery_id,
        "item_id": task.item_id,
        "trang_thai": task.trang_thai,
        "tinh_trang": task.tinh_trang,
        "huong_xu_ly": task.huong_xu_ly,
        "so_luong_cu": float(task.so_luong_cu),
        "so_luong_moi": float(task.so_luong_moi),
        "so_luong_bu_hao": float(task.so_luong_bu_hao),
        "ghi_chu_sa": task.ghi_chu_sa,
        "ghi_chu_tp": task.ghi_chu_tp,
        "ghi_chu_kho": task.ghi_chu_kho,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "approved_at": task.approved_at.isoformat() if task.approved_at else None,
        "kho_confirmed_at": task.kho_confirmed_at.isoformat() if task.kho_confirmed_at else None,
        "created_by": {
            "id": task.created_by.id,
            "full_name": task.created_by.ho_ten or task.created_by.username,
        } if task.created_by else None,
        "approved_by": {
            "id": task.approved_by.id,
            "full_name": task.approved_by.ho_ten or task.approved_by.username,
        } if task.approved_by else None,
        "kho_confirmed_by": {
            "id": task.kho_confirmed_by.id,
            "full_name": task.kho_confirmed_by.ho_ten or task.kho_confirmed_by.username,
        } if task.kho_confirmed_by else None,
        # Joined delivery info
        "so_phieu": task.delivery.so_phieu if task.delivery else None,
        "ten_khach": (task.delivery.customer.ten_viet_tat or task.delivery.customer.ten_don_vi
                      if task.delivery and task.delivery.customer else None),
        "ten_hang": task.item.ten_hang if task.item else None,
        "dvt": task.item.dvt if task.item else None,
        "phap_nhan_id": task.phap_nhan_id,
        "ten_phap_nhan": task.phap_nhan.ten_viet_tat if task.phap_nhan else None,
        "phan_xuong_id": task.phan_xuong_id,
        "ten_phan_xuong": task.phan_xuong.ten_xuong if task.phan_xuong else None,
    }


# ── CREATE ────────────────────────────────────────────────────────────────────

@router.post("", status_code=201)
def create_task(
    body: CreateDeliveryPostTaskIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.tinh_trang not in TINH_TRANG_VALID:
        raise HTTPException(400, f"tinh_trang không hợp lệ: {body.tinh_trang}")
    if body.huong_xu_ly not in HUONG_XU_LY_VALID:
        raise HTTPException(400, f"huong_xu_ly không hợp lệ: {body.huong_xu_ly}")

    do = db.get(DeliveryOrder, body.delivery_id)
    if not do:
        raise HTTPException(404, "Không tìm thấy phiếu giao hàng")
    if do.trang_thai not in ("da_xuat", "da_giao"):
        raise HTTPException(400, "Chỉ tạo task cho phiếu đã xuất hoặc đã giao")
    if do.da_dieu_chinh:
        raise HTTPException(400, "Phiếu đang có yêu cầu điều chỉnh. Chờ xử lý xong mới tạo mới.")

    item = db.get(DeliveryOrderItem, body.item_id)
    if not item or item.delivery_id != body.delivery_id:
        raise HTTPException(404, "Không tìm thấy dòng hàng trong phiếu")

    if body.so_luong_moi < 0:
        raise HTTPException(400, "Số lượng không được âm")

    # bu_hao: so_luong_moi phải bằng so_luong hiện tại (hóa đơn không đổi)
    if body.tinh_trang == "bu_hao" and body.so_luong_bu_hao <= 0:
        raise HTTPException(400, "Bù hao cần điền số lượng bù hao > 0")

    # Resolve phan_xuong_id từ LSX của dòng hàng
    phan_xuong_id = None
    if item.production_order_id:
        po = db.get(ProductionOrder, item.production_order_id)
        if po:
            phan_xuong_id = po.phan_xuong_id

    task = DeliveryPostTask(
        delivery_id=body.delivery_id,
        item_id=body.item_id,
        trang_thai="cho_duyet",
        tinh_trang=body.tinh_trang,
        huong_xu_ly=body.huong_xu_ly,
        so_luong_cu=item.so_luong,
        so_luong_moi=body.so_luong_moi,
        so_luong_bu_hao=body.so_luong_bu_hao,
        ghi_chu_sa=body.ghi_chu_sa,
        created_by_id=current_user.id,
        phap_nhan_id=do.phap_nhan_id,
        phan_xuong_id=phan_xuong_id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(task)

    # Khóa phiếu không cho submit thêm
    do.da_dieu_chinh = True
    db.commit()
    db.refresh(task)

    task = (
        db.query(DeliveryPostTask)
        .options(
            selectinload(DeliveryPostTask.created_by),
            selectinload(DeliveryPostTask.approved_by),
            selectinload(DeliveryPostTask.kho_confirmed_by),
            selectinload(DeliveryPostTask.delivery).selectinload(DeliveryOrder.customer),
            selectinload(DeliveryPostTask.item),
            selectinload(DeliveryPostTask.phap_nhan),
            selectinload(DeliveryPostTask.phan_xuong),
        )
        .filter(DeliveryPostTask.id == task.id)
        .first()
    )
    return _task_dict(task)


# ── LIST ──────────────────────────────────────────────────────────────────────

@router.get("")
def list_tasks(
    trang_thai: Optional[str] = Query(None),
    delivery_id: Optional[int] = Query(None),
    phap_nhan_id: Optional[int] = Query(None),
    phan_xuong_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (
        db.query(DeliveryPostTask)
        .options(
            selectinload(DeliveryPostTask.created_by),
            selectinload(DeliveryPostTask.approved_by),
            selectinload(DeliveryPostTask.kho_confirmed_by),
            selectinload(DeliveryPostTask.delivery).selectinload(DeliveryOrder.customer),
            selectinload(DeliveryPostTask.item),
            selectinload(DeliveryPostTask.phap_nhan),
            selectinload(DeliveryPostTask.phan_xuong),
            selectinload(DeliveryPostTask.phap_nhan),
            selectinload(DeliveryPostTask.phan_xuong),
        )
    )
    if trang_thai:
        q = q.filter(DeliveryPostTask.trang_thai == trang_thai)
    if delivery_id:
        q = q.filter(DeliveryPostTask.delivery_id == delivery_id)
    if phap_nhan_id is not None:
        q = q.filter(DeliveryPostTask.phap_nhan_id == phap_nhan_id)
    if phan_xuong_id is not None:
        q = q.filter(DeliveryPostTask.phan_xuong_id == phan_xuong_id)

    total = q.count()
    items = q.order_by(DeliveryPostTask.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "items": [_task_dict(t) for t in items]}


# ── DETAIL ────────────────────────────────────────────────────────────────────

@router.get("/{task_id}")
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = (
        db.query(DeliveryPostTask)
        .options(
            selectinload(DeliveryPostTask.created_by),
            selectinload(DeliveryPostTask.approved_by),
            selectinload(DeliveryPostTask.kho_confirmed_by),
            selectinload(DeliveryPostTask.delivery).selectinload(DeliveryOrder.customer),
            selectinload(DeliveryPostTask.item),
            selectinload(DeliveryPostTask.phap_nhan),
            selectinload(DeliveryPostTask.phan_xuong),
        )
        .filter(DeliveryPostTask.id == task_id)
        .first()
    )
    if not task:
        raise HTTPException(404, "Không tìm thấy task")
    return _task_dict(task)


# ── DUYET (TP SA approve) ─────────────────────────────────────────────────────

@router.put("/{task_id}/duyet")
def duyet_task(
    task_id: int,
    body: ApproveTaskIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "TRUONG_PHONG_SALE_ADMIN")),
):
    task = (
        db.query(DeliveryPostTask)
        .options(
            selectinload(DeliveryPostTask.delivery).selectinload(DeliveryOrder.customer),
            selectinload(DeliveryPostTask.item),
            selectinload(DeliveryPostTask.phap_nhan),
            selectinload(DeliveryPostTask.phan_xuong),
            selectinload(DeliveryPostTask.created_by),
            selectinload(DeliveryPostTask.approved_by),
            selectinload(DeliveryPostTask.kho_confirmed_by),
        )
        .filter(DeliveryPostTask.id == task_id)
        .with_for_update()
        .first()
    )
    if not task:
        raise HTTPException(404, "Không tìm thấy task")
    if task.trang_thai != "cho_duyet":
        raise HTTPException(400, f"Task đang ở trạng thái '{task.trang_thai}', không thể duyệt")

    do = task.delivery
    it = task.item
    now = datetime.now(timezone.utc)

    # ── Return cases: chuyển sang cho_kho_nhan, không update inventory ngay ──
    if task.huong_xu_ly in RETURN_CASES:
        task.trang_thai = "cho_kho_nhan"
        task.approved_by_id = current_user.id
        task.approved_at = now
        task.ghi_chu_tp = body.ghi_chu_tp
        db.commit()
        db.refresh(task)
        return _task_dict(task)

    # ── giao_bu_sau: nhập lại số thiếu vào kho + sync invoice ──────────────────
    if task.huong_xu_ly == "giao_bu_sau":
        delta = task.so_luong_cu - task.so_luong_moi
        if delta <= 0:
            raise HTTPException(status_code=400, detail="so_luong_moi phải nhỏ hơn so_luong_cu khi giao thiếu")
        if do.warehouse_id:
            bal = _get_or_create_balance(
                db, do.warehouse_id,
                product_id=it.product_id,
                ten_hang=it.ten_hang or "", don_vi=it.dvt or "Thùng",
                lock=True,
            )
            _nhap_balance(bal, delta, it.don_gia or Decimal("0"))
            _log_tx(
                db, do.warehouse_id, "NHAP_GIAO_THIEU",
                delta, it.don_gia or Decimal("0"), bal.ton_luong,
                "delivery_post_tasks", task.id, current_user.id,
                product_id=it.product_id,
                ghi_chu=f"Hậu giao {do.so_phieu}: giao thiếu, nhập lại {it.ten_hang}",
            )
        _ratio = Decimal(str(task.so_luong_moi)) / Decimal(str(task.so_luong_cu))
        it.so_luong = task.so_luong_moi
        it.thanh_tien = task.so_luong_moi * (it.don_gia or Decimal("0"))
        if it.dien_tich is not None:
            it.dien_tich = round(it.dien_tich * _ratio, 4)
        if it.trong_luong is not None:
            it.trong_luong = round(it.trong_luong * _ratio, 3)
        if it.the_tich is not None:
            it.the_tich = round(it.the_tich * _ratio, 4)
        it.tinh_trang_dieu_chinh = task.tinh_trang
        it.huong_xu_ly_dieu_chinh = task.huong_xu_ly
        do.tong_tien_hang = sum((i.thanh_tien or Decimal("0")) for i in do.items)
        do.tong_thanh_toan = (do.tong_tien_hang or Decimal("0")) + (do.tien_van_chuyen or Decimal("0"))
        db.flush()
        BillingService(db).sync_invoice_to_delivery(
            do.id, ghi_chu=f"Hậu giao {do.so_phieu}: giao thiếu {it.ten_hang}"
        )

    # ── khach_giu_mien_phi: xuất thêm kho dư + JE 641/155 ───────────────────
    elif task.huong_xu_ly == "khach_giu_mien_phi":
        delta = task.so_luong_moi - task.so_luong_cu
        if delta > 0 and do.warehouse_id:
            bal = _get_or_create_balance(
                db, do.warehouse_id,
                product_id=it.product_id,
                ten_hang=it.ten_hang or "", don_vi=it.dvt or "Thùng",
                lock=True,
            )
            gia_von = bal.don_gia_binh_quan * delta
            _xuat_balance(bal, delta, it.ten_hang or "")
            _log_tx(
                db, do.warehouse_id, "XUAT_TANG_DU_MIEN_PHI",
                delta, bal.don_gia_binh_quan, bal.ton_luong,
                "delivery_post_tasks", task.id, current_user.id,
                product_id=it.product_id,
                ghi_chu=f"Hậu giao {do.so_phieu}: giao dư miễn phí {it.ten_hang}",
            )
            if gia_von > 0:
                acct = AccountingService(db)
                acct._create_journal_entry(
                    ngay=date.today(),
                    dien_giai=f"Giao dư miễn phí {float(delta):g} {it.dvt or ''} {it.ten_hang} - Phiếu {do.so_phieu}",
                    loai_but_toan="xuat_tang_du_mien_phi",
                    chung_tu_loai="delivery_post_tasks",
                    chung_tu_id=task.id,
                    lines=[
                        {"so_tk": "641", "so_tien_no": gia_von, "so_tien_co": Decimal("0"),
                         "dien_giai": f"CP hàng tặng dư: {it.ten_hang} x{float(delta):g}"},
                        {"so_tk": "155", "so_tien_no": Decimal("0"), "so_tien_co": gia_von,
                         "dien_giai": f"Xuất TP tặng dư: {it.ten_hang} x{float(delta):g}"},
                    ],
                    phap_nhan_id=do.phap_nhan_id,
                    user_id=current_user.id,
                )
        it.tinh_trang_dieu_chinh = task.tinh_trang
        it.huong_xu_ly_dieu_chinh = task.huong_xu_ly

    # ── giam_don_hang: giảm so_luong + trả inventory về kho ─────────────────
    elif task.huong_xu_ly == "giam_don_hang":
        delta = task.so_luong_cu - task.so_luong_moi
        if delta <= 0:
            raise HTTPException(400, "so_luong_moi phải nhỏ hơn so_luong_cu khi giảm đơn")
        if do.warehouse_id:
            bal = _get_or_create_balance(
                db, do.warehouse_id,
                product_id=it.product_id,
                ten_hang=it.ten_hang or "", don_vi=it.dvt or "Thùng",
            )
            _nhap_balance(bal, delta, it.don_gia or Decimal("0"))
            _log_tx(
                db, do.warehouse_id, "DIEU_CHINH_GIAM_XUAT",
                delta, bal.don_gia_binh_quan, bal.ton_luong,
                "delivery_post_tasks", task.id, current_user.id,
                product_id=it.product_id,
                ghi_chu=f"Hậu giao {do.so_phieu}: giảm {it.ten_hang}",
            )
        _ratio = Decimal(str(task.so_luong_moi)) / Decimal(str(task.so_luong_cu))
        it.so_luong = task.so_luong_moi
        it.thanh_tien = task.so_luong_moi * (it.don_gia or Decimal("0"))
        if it.dien_tich is not None:
            it.dien_tich = round(it.dien_tich * _ratio, 4)
        if it.trong_luong is not None:
            it.trong_luong = round(it.trong_luong * _ratio, 3)
        if it.the_tich is not None:
            it.the_tich = round(it.the_tich * _ratio, 4)
        it.tinh_trang_dieu_chinh = task.tinh_trang
        it.huong_xu_ly_dieu_chinh = task.huong_xu_ly
        # Cập nhật tổng phiếu
        do.tong_tien_hang = sum((i.thanh_tien or Decimal("0")) for i in do.items)
        do.tong_thanh_toan = (do.tong_tien_hang or Decimal("0")) + (do.tien_van_chuyen or Decimal("0"))
        db.flush()
        BillingService(db).sync_invoice_to_delivery(
            do.id, ghi_chu=f"Hậu giao {do.so_phieu}: giảm đơn {it.ten_hang}"
        )

    # ── tinh_tien_them: tăng so_luong + xuất thêm inventory ─────────────────
    elif task.huong_xu_ly == "tinh_tien_them":
        delta = task.so_luong_moi - task.so_luong_cu
        if delta <= 0:
            raise HTTPException(400, "so_luong_moi phải lớn hơn so_luong_cu khi tính thêm tiền")
        if do.warehouse_id:
            bal = _get_or_create_balance(
                db, do.warehouse_id,
                product_id=it.product_id,
                ten_hang=it.ten_hang or "", don_vi=it.dvt or "Thùng",
                lock=True,
            )
            if bal.ton_luong < delta:
                raise HTTPException(
                    400,
                    f"Không đủ tồn kho để xuất thêm: {it.ten_hang} — "
                    f"cần {float(delta):g}, còn {float(bal.ton_luong):g}",
                )
            _xuat_balance(bal, delta, it.ten_hang or "")
            _log_tx(
                db, do.warehouse_id, "DIEU_CHINH_TANG_XUAT",
                delta, bal.don_gia_binh_quan, bal.ton_luong,
                "delivery_post_tasks", task.id, current_user.id,
                product_id=it.product_id,
                ghi_chu=f"Hậu giao {do.so_phieu}: tăng {it.ten_hang}",
            )
        it.so_luong = task.so_luong_moi
        it.thanh_tien = task.so_luong_moi * (it.don_gia or Decimal("0"))
        it.tinh_trang_dieu_chinh = task.tinh_trang
        it.huong_xu_ly_dieu_chinh = task.huong_xu_ly
        do.tong_tien_hang = sum((i.thanh_tien or Decimal("0")) for i in do.items)
        do.tong_thanh_toan = (do.tong_tien_hang or Decimal("0")) + (do.tien_van_chuyen or Decimal("0"))
        db.flush()
        BillingService(db).sync_invoice_to_delivery(
            do.id, ghi_chu=f"Hậu giao {do.so_phieu}: tính thêm tiền {it.ten_hang}"
        )

    # ── xuat_bu_hao: giảm billing sl_bh + dòng 0đ trên phiếu ───────────────
    # sl_bh thùng bù hao đã nằm trong sl giao rồi — chỉ giảm billing, không xuất thêm kho
    elif task.huong_xu_ly == "xuat_bu_hao":
        sl_bh = task.so_luong_bu_hao
        if sl_bh <= 0:
            raise HTTPException(400, "so_luong_bu_hao phải > 0")
        if sl_bh >= task.so_luong_cu:
            raise HTTPException(
                400,
                f"Bù hao ({float(sl_bh):g}) không được lớn hơn hoặc bằng "
                f"số lượng giao ({float(task.so_luong_cu):g})",
            )

        _ratio = Decimal(str(task.so_luong_cu - sl_bh)) / Decimal(str(task.so_luong_cu))
        it.so_luong = task.so_luong_cu - sl_bh
        it.thanh_tien = it.so_luong * (it.don_gia or Decimal("0"))
        if it.dien_tich is not None:
            it.dien_tich = round(it.dien_tich * _ratio, 4)
        if it.trong_luong is not None:
            it.trong_luong = round(it.trong_luong * _ratio, 3)
        if it.the_tich is not None:
            it.the_tich = round(it.the_tich * _ratio, 4)
        it.tinh_trang_dieu_chinh = task.tinh_trang
        it.huong_xu_ly_dieu_chinh = task.huong_xu_ly

        # Dòng 0đ trên phiếu (sl_bh thùng — ghi nhận vật lý giao cho KH miễn phí)
        db.add(DeliveryOrderItem(
            delivery_id=do.id,
            product_id=it.product_id,
            sales_order_item_id=it.sales_order_item_id,
            ten_hang=f"{it.ten_hang} (Bù hao)",
            so_luong=sl_bh,
            dvt=it.dvt,
            don_gia=Decimal("0"),
            thanh_tien=Decimal("0"),
            tinh_trang_dieu_chinh="bu_hao",
            huong_xu_ly_dieu_chinh="xuat_bu_hao",
            ghi_chu=f"Bù hao từ task #{task.id}",
        ))

        do.tong_tien_hang = sum((i.thanh_tien or Decimal("0")) for i in do.items)
        do.tong_thanh_toan = (do.tong_tien_hang or Decimal("0")) + (do.tien_van_chuyen or Decimal("0"))
        db.flush()
        BillingService(db).sync_invoice_to_delivery(
            do.id,
            ghi_chu=f"Hậu giao {do.so_phieu}: bù hao {float(sl_bh):g} {it.dvt or ''} {it.ten_hang}",
        )

    task.trang_thai = "hoan_thanh"
    task.approved_by_id = current_user.id
    task.approved_at = now
    task.ghi_chu_tp = body.ghi_chu_tp
    db.commit()
    db.refresh(task)
    return _task_dict(task)


# ── TU_CHOI (TP SA reject) ────────────────────────────────────────────────────

@router.put("/{task_id}/tu-choi")
def tu_choi_task(
    task_id: int,
    body: TuChoiTaskIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "TRUONG_PHONG_SALE_ADMIN")),
):
    task = db.get(DeliveryPostTask, task_id)
    if not task:
        raise HTTPException(404, "Không tìm thấy task")
    if task.trang_thai != "cho_duyet":
        raise HTTPException(400, f"Task đang ở trạng thái '{task.trang_thai}', không thể từ chối")

    task.trang_thai = "tu_choi"
    task.approved_by_id = current_user.id
    task.approved_at = datetime.now(timezone.utc)
    task.ghi_chu_tp = body.ghi_chu_tp

    # Unlock delivery
    do = db.get(DeliveryOrder, task.delivery_id)
    if do:
        do.da_dieu_chinh = False

    db.commit()
    db.refresh(task)
    return {"id": task.id, "trang_thai": task.trang_thai, "message": "Đã từ chối yêu cầu điều chỉnh"}


# ── KHO_NHAN (Kho confirm received goods) ────────────────────────────────────

@router.put("/{task_id}/kho-nhan")
def kho_nhan_task(
    task_id: int,
    body: KhoNhanIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = (
        db.query(DeliveryPostTask)
        .options(
            selectinload(DeliveryPostTask.delivery).selectinload(DeliveryOrder.customer),
            selectinload(DeliveryPostTask.item),
            selectinload(DeliveryPostTask.phap_nhan),
            selectinload(DeliveryPostTask.phan_xuong),
            selectinload(DeliveryPostTask.created_by),
            selectinload(DeliveryPostTask.approved_by),
            selectinload(DeliveryPostTask.kho_confirmed_by),
        )
        .filter(DeliveryPostTask.id == task_id)
        .with_for_update()
        .first()
    )
    if not task:
        raise HTTPException(404, "Không tìm thấy task")
    if task.trang_thai != "cho_kho_nhan":
        raise HTTPException(400, f"Task đang ở trạng thái '{task.trang_thai}', không phải chờ kho xác nhận")

    do = task.delivery
    it = task.item
    delta = task.so_luong_cu - task.so_luong_moi  # số lượng hàng về kho

    if delta <= 0:
        raise HTTPException(400, "Không có hàng nào cần nhập về kho")

    # Nhập kho hàng về
    bal = _get_or_create_balance(
        db, body.kho_id,
        product_id=it.product_id,
        ten_hang=it.ten_hang or "", don_vi=it.dvt or "Thùng",
    )
    _nhap_balance(bal, delta, it.don_gia or Decimal("0"))
    _log_tx(
        db, body.kho_id, "NHAP_TRA_HANG",
        delta, it.don_gia or Decimal("0"), bal.ton_luong,
        "delivery_post_tasks", task.id, current_user.id,
        product_id=it.product_id,
        ghi_chu=f"Hàng về từ {do.so_phieu}: {it.ten_hang} ({task.huong_xu_ly})",
    )

    # Cập nhật số lượng item + metadata
    _ratio = Decimal(str(task.so_luong_moi)) / Decimal(str(task.so_luong_cu))
    it.so_luong = task.so_luong_moi
    it.thanh_tien = task.so_luong_moi * (it.don_gia or Decimal("0"))
    if it.dien_tich is not None:
        it.dien_tich = round(it.dien_tich * _ratio, 4)
    if it.trong_luong is not None:
        it.trong_luong = round(it.trong_luong * _ratio, 3)
    if it.the_tich is not None:
        it.the_tich = round(it.the_tich * _ratio, 4)
    it.tinh_trang_dieu_chinh = task.tinh_trang
    it.huong_xu_ly_dieu_chinh = task.huong_xu_ly

    do.tong_tien_hang = sum((i.thanh_tien or Decimal("0")) for i in do.items)
    do.tong_thanh_toan = (do.tong_tien_hang or Decimal("0")) + (do.tien_van_chuyen or Decimal("0"))
    db.flush()
    BillingService(db).sync_invoice_to_delivery(
        do.id, ghi_chu=f"Hậu giao {do.so_phieu}: hàng về kho ({task.huong_xu_ly})"
    )

    task.trang_thai = "hoan_thanh"
    task.kho_confirmed_by_id = current_user.id
    task.kho_confirmed_at = datetime.now(timezone.utc)
    task.ghi_chu_kho = body.ghi_chu_kho

    db.commit()
    db.refresh(task)
    return _task_dict(task)
