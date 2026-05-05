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
from app.models.cd2 import MayIn, MaySauIn, PhieuIn, MayScan, ScanLog, ShiftCa, ShiftConfig, PrinterUser
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.phieu_xuat_phoi import PhieuXuatPhoi, PhieuXuatPhoiItem
from app.models.inventory import InventoryBalance, InventoryTransaction
from app.models.warehouse_doc import ProductionOutput
from app.models.master import Warehouse
from app.services.inventory_service import (
    get_or_create_balance as _get_or_create_balance,
    nhap_balance as _nhap_balance,
    log_tx as _log_tx,
    get_workshop_warehouse as _get_workshop_warehouse,
)

router = APIRouter(prefix="/api/cd2", tags=["cd2"])

VALID_STATES = {"cho_in", "ke_hoach", "dang_in", "cho_dinh_hinh", "sau_in", "dang_sau_in", "hoan_thanh"}

# ── Schemas ────────────────────────────────────────────────────────────────────

class MayInCreate(BaseModel):
    ten_may: str
    sort_order: int = 0
    phan_xuong_id: Optional[int] = None


class MayInUpdate(BaseModel):
    ten_may: Optional[str] = None
    sort_order: Optional[int] = None
    active: Optional[bool] = None
    capacity: Optional[Decimal] = None
    phan_xuong_id: Optional[int] = None


class PhieuInCreate(BaseModel):
    production_order_id: Optional[int] = None
    ten_hang: Optional[str] = None
    ma_kh: Optional[str] = None
    ten_khach_hang: Optional[str] = None
    quy_cach: Optional[str] = None
    so_luong_phoi: Optional[Decimal] = None
    ngay_lenh: Optional[date] = None
    loai_in: Optional[str] = None
    loai: Optional[str] = None
    ths: Optional[str] = None
    pp_ghep: Optional[str] = None
    ghi_chu_printer: Optional[str] = None
    ghi_chu_prepare: Optional[str] = None
    so_don: Optional[str] = None
    ngay_giao_hang: Optional[date] = None
    ghi_chu: Optional[str] = None
    phan_xuong_id: Optional[int] = None


class PhieuInUpdate(BaseModel):
    ten_hang: Optional[str] = None
    ma_kh: Optional[str] = None
    ten_khach_hang: Optional[str] = None
    quy_cach: Optional[str] = None
    so_luong_phoi: Optional[Decimal] = None
    ngay_lenh: Optional[date] = None
    loai_in: Optional[str] = None
    loai: Optional[str] = None
    ths: Optional[str] = None
    pp_ghep: Optional[str] = None
    ghi_chu_printer: Optional[str] = None
    ghi_chu_prepare: Optional[str] = None
    so_don: Optional[str] = None
    ngay_giao_hang: Optional[date] = None
    ghi_chu: Optional[str] = None


class MoveBody(BaseModel):
    trang_thai: str
    may_in_id: Optional[int] = None
    sort_order: int = 0


class CompleteBody(BaseModel):
    ngay_in: Optional[date] = None
    ca: Optional[str] = None
    so_luong_in_ok: Optional[Decimal] = None
    so_luong_loi: Optional[Decimal] = None
    so_luong_setup: Optional[Decimal] = None
    so_lan_setup: Optional[int] = None
    ghi_chu_ket_qua: Optional[str] = None


class SauInBody(BaseModel):
    ngay_sau_in: Optional[date] = None
    ca_sau_in: Optional[str] = None
    so_luong_sau_in_ok: Optional[Decimal] = None
    so_luong_sau_in_loi: Optional[Decimal] = None
    ghi_chu_sau_in: Optional[str] = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _to_dict(p: PhieuIn) -> dict:
    return {
        "id": p.id,
        "so_phieu": p.so_phieu,
        "production_order_id": p.production_order_id,
        "may_in_id": p.may_in_id,
        "ten_may": p.may_in_obj.ten_may if p.may_in_obj else None,
        "trang_thai": p.trang_thai,
        "sort_order": p.sort_order,
        "ten_hang": p.ten_hang,
        "ma_kh": p.ma_kh,
        "ten_khach_hang": p.ten_khach_hang,
        "quy_cach": p.quy_cach,
        "so_luong_phoi": float(p.so_luong_phoi) if p.so_luong_phoi is not None else None,
        "ngay_lenh": str(p.ngay_lenh) if p.ngay_lenh else None,
        "loai_in": p.loai_in,
        "loai": p.loai,
        "ths": p.ths,
        "pp_ghep": p.pp_ghep,
        "ghi_chu_printer": p.ghi_chu_printer,
        "ghi_chu_prepare": p.ghi_chu_prepare,
        "so_don": p.so_don,
        "ngay_giao_hang": str(p.ngay_giao_hang) if p.ngay_giao_hang else None,
        "ghi_chu": p.ghi_chu,
        "ngay_in": str(p.ngay_in) if p.ngay_in else None,
        "ca": p.ca,
        "so_luong_in_ok": float(p.so_luong_in_ok) if p.so_luong_in_ok is not None else None,
        "so_luong_loi": float(p.so_luong_loi) if p.so_luong_loi is not None else None,
        "so_luong_setup": float(p.so_luong_setup) if p.so_luong_setup is not None else None,
        "so_lan_setup": p.so_lan_setup,
        "ghi_chu_ket_qua": p.ghi_chu_ket_qua,
        "ngay_sau_in": str(p.ngay_sau_in) if p.ngay_sau_in else None,
        "ca_sau_in": p.ca_sau_in,
        "so_luong_sau_in_ok": float(p.so_luong_sau_in_ok) if p.so_luong_sau_in_ok is not None else None,
        "so_luong_sau_in_loi": float(p.so_luong_sau_in_loi) if p.so_luong_sau_in_loi is not None else None,
        "ghi_chu_sau_in": p.ghi_chu_sau_in,
        "may_sau_in_id": p.may_sau_in_id,
        "ten_may_sau_in": p.may_sau_in_obj.ten_may if p.may_sau_in_obj else None,
        "gio_bat_dau_in": p.gio_bat_dau_in.isoformat() if p.gio_bat_dau_in else None,
        "gio_hoan_thanh": p.gio_hoan_thanh.isoformat() if p.gio_hoan_thanh else None,
        "gio_bat_dau_dinh_hinh": p.gio_bat_dau_dinh_hinh.isoformat() if p.gio_bat_dau_dinh_hinh else None,
        "gio_hoan_thanh_dinh_hinh": p.gio_hoan_thanh_dinh_hinh.isoformat() if p.gio_hoan_thanh_dinh_hinh else None,
        "phan_xuong_id": p.phan_xuong_id,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _auto_nhap_thanh_pham(db: Session, p: PhieuIn, user_id: Optional[int]) -> Optional[ProductionOutput]:
    """Tự động tạo phiếu nhập thành phẩm khi hoàn thành định hình.
    Trả về ProductionOutput nếu tạo thành công."""
    import logging
    _log = logging.getLogger("erp")

    if not p.production_order_id:
        raise HTTPException(400, "Phiếu in chưa gắn LSX nên không thể nhập kho thành phẩm")

    existing = db.query(ProductionOutput).filter(
        ProductionOutput.production_order_id == p.production_order_id,
        ProductionOutput.ghi_chu.ilike(f"%{p.so_phieu}%"),
    ).first()
    if existing:
        return existing

    # Resolve phan_xuong_id: ưu tiên xưởng của PhieuIn (nơi định hình),
    # fallback sang ProductionOrder nếu PhieuIn không có xưởng
    po: Optional[ProductionOrder] = None
    phan_xuong_id: Optional[int] = p.phan_xuong_id
    don_gia = Decimal("0")

    if p.production_order_id:
        po = db.query(ProductionOrder).filter(ProductionOrder.id == p.production_order_id).first()
        if po:
            if not phan_xuong_id:
                phan_xuong_id = po.phan_xuong_id
            # Lấy giá bán mục tiêu từ item đầu tiên của LSX
            first_item = db.query(ProductionOrderItem).filter(
                ProductionOrderItem.production_order_id == po.id
            ).order_by(ProductionOrderItem.id).first()
            if first_item and first_item.gia_ban_muc_tieu:
                don_gia = Decimal(str(first_item.gia_ban_muc_tieu))

    if not phan_xuong_id:
        raise HTTPException(400, "Không xác định được xưởng sản xuất nên không thể nhập kho thành phẩm")

    kho = _get_workshop_warehouse(db, phan_xuong_id, "THANH_PHAM")
    if not kho:
        raise HTTPException(400, "Xưởng sản xuất chưa có kho THÀNH PHẨM. Vui lòng khởi tạo kho cho xưởng trước.")

    so_luong = p.so_luong_sau_in_ok or p.so_luong_in_ok or p.so_luong_phoi
    if not so_luong:
        raise HTTPException(400, "Chưa có số lượng đạt để nhập kho thành phẩm")

    ym = date.today().strftime("%Y%m")
    pattern = f"TP-{ym}-%"
    last_so = db.query(func.max(ProductionOutput.so_phieu)).filter(
        ProductionOutput.so_phieu.like(pattern)
    ).scalar()
    seq = 1
    if last_so:
        try:
            seq = int(last_so.rsplit("-", 1)[-1]) + 1
        except (ValueError, IndexError):
            seq = 1

    product_id = None
    if po:
        first_item = db.query(ProductionOrderItem).filter(
            ProductionOrderItem.production_order_id == po.id
        ).order_by(ProductionOrderItem.id).first()
        if first_item:
            product_id = first_item.product_id

    ten_hang = p.ten_hang or ""
    sl = Decimal(str(so_luong))
    out = ProductionOutput(
        so_phieu=f"TP-{ym}-{seq:04d}",
        ngay_nhap=date.today(),
        production_order_id=p.production_order_id,
        warehouse_id=kho.id,
        product_id=product_id,
        ten_hang=ten_hang,
        so_luong_nhap=sl,
        so_luong_loi=Decimal(str(p.so_luong_sau_in_loi or 0)),
        dvt="Thùng",
        don_gia_xuat_xuong=don_gia,
        ghi_chu=f"Tự động từ phiếu in {p.so_phieu}",
        created_by=user_id,
    )
    db.add(out)
    db.flush()

    bal = _get_or_create_balance(db, kho.id, product_id=product_id, ten_hang=ten_hang, don_vi="Thùng")
    _nhap_balance(bal, sl, don_gia)
    _log_tx(
        db, kho.id, "NHAP_SX", sl, don_gia, bal.ton_luong,
        "production_outputs", out.id, user_id,
        product_id=product_id,
        ghi_chu=f"Hoàn thành định hình — {p.so_phieu}",
    )
    return out


def _gen_so_phieu(db: Session) -> str:
    today = date.today()
    prefix = f"PIN-{today.strftime('%Y%m')}-"
    last = (
        db.query(PhieuIn)
        .filter(PhieuIn.so_phieu.like(f"{prefix}%"))
        .order_by(PhieuIn.so_phieu.desc())
        .first()
    )
    seq = (int(last.so_phieu[-4:]) + 1) if last else 1
    return f"{prefix}{seq:04d}"


def _load(phieu_id: int, db: Session) -> PhieuIn:
    p = (
        db.query(PhieuIn)
        .options(joinedload(PhieuIn.may_in_obj), joinedload(PhieuIn.may_sau_in_obj))
        .filter(PhieuIn.id == phieu_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu in")
    return p


# ── Máy in CRUD ────────────────────────────────────────────────────────────────

@router.get("/may-in")
def list_may_in(
    phan_xuong_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(MayIn)
    if phan_xuong_id is not None:
        q = q.filter(MayIn.phan_xuong_id == phan_xuong_id)
    return q.order_by(MayIn.sort_order).all()


@router.post("/may-in", status_code=201)
def create_may_in(data: MayInCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    m = MayIn(**data.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@router.put("/may-in/{may_id}")
def update_may_in(may_id: int, data: MayInUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    m = db.query(MayIn).filter(MayIn.id == may_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Không tìm thấy máy in")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(m, k, v)
    db.commit()
    db.refresh(m)
    return m


@router.delete("/may-in/{may_id}")
def delete_may_in(may_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    m = db.query(MayIn).filter(MayIn.id == may_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Không tìm thấy máy in")
    db.delete(m)
    db.commit()
    return {"ok": True}


# ── Máy sau in CRUD ────────────────────────────────────────────────────────────

class MaySauInCreate(BaseModel):
    ten_may: str
    sort_order: int = 0
    phan_xuong_id: Optional[int] = None


class MaySauInUpdate(BaseModel):
    ten_may: Optional[str] = None
    sort_order: Optional[int] = None
    active: Optional[bool] = None
    phan_xuong_id: Optional[int] = None


@router.get("/may-sau-in")
def list_may_sau_in(
    phan_xuong_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(MaySauIn)
    if phan_xuong_id is not None:
        q = q.filter(MaySauIn.phan_xuong_id == phan_xuong_id)
    return q.order_by(MaySauIn.sort_order).all()


@router.post("/may-sau-in", status_code=201)
def create_may_sau_in(data: MaySauInCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    m = MaySauIn(**data.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@router.put("/may-sau-in/{may_id}")
def update_may_sau_in(may_id: int, data: MaySauInUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    m = db.query(MaySauIn).filter(MaySauIn.id == may_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Không tìm thấy máy sau in")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(m, k, v)
    db.commit()
    db.refresh(m)
    return m


@router.delete("/may-sau-in/{may_id}")
def delete_may_sau_in(may_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    m = db.query(MaySauIn).filter(MaySauIn.id == may_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Không tìm thấy máy sau in")
    db.delete(m)
    db.commit()
    return {"ok": True}


# ── Sau in kanban ──────────────────────────────────────────────────────────────

@router.get("/sauin/kanban")
def get_sauin_kanban(
    phan_xuong_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q_may = db.query(MaySauIn).filter(MaySauIn.active == True)
    if phan_xuong_id is not None:
        q_may = q_may.filter(MaySauIn.phan_xuong_id == phan_xuong_id)
    may_sau_ins = q_may.order_by(MaySauIn.sort_order).all()

    q_phieu = (
        db.query(PhieuIn)
        .options(joinedload(PhieuIn.may_sau_in_obj))
        .filter(PhieuIn.trang_thai.in_(["sau_in", "dang_sau_in"]))
    )
    if phan_xuong_id is not None:
        q_phieu = q_phieu.filter(PhieuIn.phan_xuong_id == phan_xuong_id)
    phieus = q_phieu.order_by(PhieuIn.sort_order, PhieuIn.created_at).all()

    cho_gang_may: list = []
    machines: dict[str, list] = {str(m.id): [] for m in may_sau_ins}

    for p in phieus:
        d = _to_dict(p)
        if not p.may_sau_in_id:
            cho_gang_may.append(d)
        else:
            key = str(p.may_sau_in_id)
            if key in machines:
                machines[key].append(d)

    return {
        "may_sau_ins": [{"id": m.id, "ten_may": m.ten_may} for m in may_sau_ins],
        "cho_gang_may": cho_gang_may,
        "machines": machines,
    }


# ── Kanban endpoint ────────────────────────────────────────────────────────────

@router.get("/kanban")
def get_kanban(
    phan_xuong_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q_may = db.query(MayIn).filter(MayIn.active == True)
    if phan_xuong_id is not None:
        q_may = q_may.filter(MayIn.phan_xuong_id == phan_xuong_id)
    may_ins = q_may.order_by(MayIn.sort_order).all()

    q_phieu = (
        db.query(PhieuIn)
        .options(joinedload(PhieuIn.may_in_obj), joinedload(PhieuIn.may_sau_in_obj))
        .filter(PhieuIn.trang_thai != "huy")
    )
    if phan_xuong_id is not None:
        q_phieu = q_phieu.filter(PhieuIn.phan_xuong_id == phan_xuong_id)
    phieus = q_phieu.order_by(PhieuIn.sort_order, PhieuIn.created_at).all()

    columns: dict[str, list] = {
        "cho_in": [],
        "ke_hoach": [],
        "cho_dinh_hinh": [],
        "sau_in": [],
        "hoan_thanh": [],
    }
    for m in may_ins:
        columns[f"may_{m.id}"] = []

    for p in phieus:
        d = _to_dict(p)
        if p.trang_thai == "cho_in":
            columns["cho_in"].append(d)
        elif p.trang_thai == "ke_hoach" and not p.may_in_id:
            columns["ke_hoach"].append(d)
        elif p.trang_thai in ("ke_hoach", "dang_in") and p.may_in_id:
            key = f"may_{p.may_in_id}"
            if key in columns:
                columns[key].append(d)
        elif p.trang_thai == "cho_dinh_hinh":
            columns["cho_dinh_hinh"].append(d)
        elif p.trang_thai in ("sau_in", "dang_sau_in"):
            columns["sau_in"].append(d)
        elif p.trang_thai == "hoan_thanh":
            columns["hoan_thanh"].append(d)

    return {
        "may_ins": [{"id": m.id, "ten_may": m.ten_may, "sort_order": m.sort_order} for m in may_ins],
        "columns": columns,
    }


# ── Phiếu in CRUD ──────────────────────────────────────────────────────────────

@router.get("/phieu-in")
def list_phieu_in(
    search: str = Query(default=""),
    trang_thai: Optional[str] = Query(default=None),
    phan_xuong_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(PhieuIn).options(joinedload(PhieuIn.may_in_obj), joinedload(PhieuIn.may_sau_in_obj))
    if search:
        like = f"%{search}%"
        q = q.filter(
            PhieuIn.so_phieu.ilike(like) | PhieuIn.ten_hang.ilike(like) | PhieuIn.ma_kh.ilike(like)
        )
    if trang_thai:
        q = q.filter(PhieuIn.trang_thai == trang_thai)
    if phan_xuong_id is not None:
        q = q.filter(PhieuIn.phan_xuong_id == phan_xuong_id)
    return [_to_dict(p) for p in q.order_by(PhieuIn.created_at.desc()).limit(200).all()]


@router.post("/phieu-in", status_code=201)
def create_phieu_in(
    data: PhieuInCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fields = data.model_dump(exclude_none=True)
    # Auto-populate phan_xuong_id từ production_order nếu chưa có
    if not fields.get("phan_xuong_id") and fields.get("production_order_id"):
        po = db.query(ProductionOrder).filter(ProductionOrder.id == fields["production_order_id"]).first()
        if po and po.phan_xuong_id:
            fields["phan_xuong_id"] = po.phan_xuong_id
    p = PhieuIn(
        so_phieu=_gen_so_phieu(db),
        trang_thai="cho_in",
        sort_order=0,
        created_by=current_user.id,
        **fields,
    )
    db.add(p)
    db.commit()
    return _to_dict(_load(p.id, db))


@router.post("/phieu-in/tu-lenh-sx/{order_id}", status_code=201)
def create_from_lenh_sx(
    order_id: int,
    target: str = Query(default="auto"),  # auto | in | sau_in
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tạo phiếu in từ LSX. target=auto → tự phát hiện theo loai_in."""
    order = (
        db.query(ProductionOrder)
        .options(
            joinedload(ProductionOrder.items),
            joinedload(ProductionOrder.sales_order),
        )
        .filter(ProductionOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy lệnh SX")

    # Chặn trùng: LSX đã có phiếu in đang active
    existing = (
        db.query(PhieuIn)
        .filter(
            PhieuIn.production_order_id == order_id,
            PhieuIn.trang_thai.notin_(["huy", "hoan_thanh"]),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"LSX đã có phiếu in {existing.so_phieu} (trạng thái: {existing.trang_thai})",
        )

    # Lấy phiếu nhập phôi + items (để tính số lượng và warehouse_id)
    phieus_nhap = (
        db.query(PhieuNhapPhoiSong)
        .filter(PhieuNhapPhoiSong.production_order_id == order_id)
        .options(joinedload(PhieuNhapPhoiSong.items))
        .all()
    )

    # Tính tổng nhập per production_order_item_id
    item_luong: dict[int, float] = {}
    warehouse_id_phoi: int | None = None
    for ph in phieus_nhap:
        if ph.warehouse_id and not warehouse_id_phoi:
            warehouse_id_phoi = ph.warehouse_id
        for it in ph.items:
            net = float(it.so_luong_thuc_te or 0) - float(it.so_luong_loi or 0)
            if it.production_order_item_id and net > 0:
                item_luong[it.production_order_item_id] = (
                    item_luong.get(it.production_order_item_id, 0) + net
                )
    so_luong_phoi = sum(item_luong.values())
    if so_luong_phoi == 0 and order.items:
        so_luong_phoi = float(order.items[0].so_luong_ke_hoach)

    # Auto-detect target từ loai_in
    if target == "auto":
        co_in = any(it.loai_in in ("flexo", "ky_thuat_so") for it in order.items)
        target = "in" if co_in else "sau_in"

    trang_thai_phieu = "cho_in" if target == "in" else "cho_dinh_hinh"

    first = order.items[0] if order.items else None
    kh = getattr(order.sales_order, "customer", None) if order.sales_order else None

    quy_cach = None
    if first and first.kho_tt and first.dai_tt:
        quy_cach = f"{int(first.kho_tt)}x{int(first.dai_tt)}"
    elif first and first.rong and first.dai:
        quy_cach = f"{int(first.rong)}x{int(first.dai)}"

    # Tạo PhieuIn
    phieu_in = PhieuIn(
        so_phieu=_gen_so_phieu(db),
        production_order_id=order_id,
        phan_xuong_id=order.phan_xuong_id,
        trang_thai=trang_thai_phieu,
        sort_order=0,
        ten_hang=first.ten_hang if first else None,
        ma_kh=kh.ma_kh if kh else None,
        ten_khach_hang=kh.ten_viet_tat if kh else None,
        quy_cach=quy_cach,
        so_luong_phoi=Decimal(str(so_luong_phoi)),
        ngay_lenh=order.ngay_lenh,
        loai_in=first.loai_in if first else None,
        so_don=order.sales_order.so_don if order.sales_order else None,
        ngay_giao_hang=first.ngay_giao_hang if first else None,
        created_by=current_user.id,
    )
    db.add(phieu_in)
    db.flush()  # cần phieu_in.id trước khi tạo xuất

    # Tạo PhieuXuatPhoi tự động
    today = date.today()
    prefix = f"PXPS-{today.strftime('%Y%m')}-"
    last_xuat = (
        db.query(PhieuXuatPhoi)
        .filter(PhieuXuatPhoi.so_phieu.like(f"{prefix}%"))
        .order_by(PhieuXuatPhoi.so_phieu.desc())
        .first()
    )
    seq = (int(last_xuat.so_phieu[-4:]) + 1) if last_xuat else 1
    phieu_xuat = PhieuXuatPhoi(
        so_phieu=f"{prefix}{seq:04d}",
        ngay=today,
        ghi_chu=f"Xuất phôi → {phieu_in.so_phieu}",
        created_by=current_user.id,
    )

    # Map poi_id → ten_hang từ order.items
    poi_ten_hang: dict[int, str] = {it.id: it.ten_hang for it in order.items}

    if item_luong:
        for poi_id, sl in item_luong.items():
            phieu_xuat.items.append(
                PhieuXuatPhoiItem(
                    production_order_item_id=poi_id,
                    ten_hang=poi_ten_hang.get(poi_id) or "Phôi sóng",
                    so_luong=Decimal(str(round(sl, 3))),
                    ghi_chu=f"→ {phieu_in.so_phieu}",
                )
            )
    else:
        phieu_xuat.items.append(
            PhieuXuatPhoiItem(
                production_order_item_id=first.id if first else None,
                ten_hang=first.ten_hang if first else "Phôi sóng",
                so_luong=Decimal(str(round(so_luong_phoi, 3))),
                ghi_chu=f"→ {phieu_in.so_phieu}",
            )
        )
    db.add(phieu_xuat)

    # Trừ InventoryBalance nếu có warehouse phôi
    if warehouse_id_phoi and item_luong:
        from app.routers.warehouse import _log_tx
        for poi_id, sl in item_luong.items():
            ten_hang = poi_ten_hang.get(poi_id) or "Phôi sóng"
            balance = (
                db.query(InventoryBalance)
                .filter(
                    InventoryBalance.warehouse_id == warehouse_id_phoi,
                    InventoryBalance.ten_hang == ten_hang,
                )
                .first()
            )
            if balance and balance.ton_luong >= Decimal(str(sl)):
                sl_dec = Decimal(str(round(sl, 3)))
                balance.ton_luong -= sl_dec
                balance.gia_tri_ton = balance.ton_luong * balance.don_gia_binh_quan
                _log_tx(
                    db, warehouse_id_phoi, "XUAT_SX",
                    sl_dec, balance.don_gia_binh_quan,
                    balance.ton_luong, "phieu_in", phieu_in.id, current_user.id,
                )

    db.commit()
    return _to_dict(_load(phieu_in.id, db))


@router.get("/phieu-in/{phieu_id}")
def get_phieu_in(phieu_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return _to_dict(_load(phieu_id, db))


@router.put("/phieu-in/{phieu_id}")
def update_phieu_in(
    phieu_id: int,
    data: PhieuInUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = _load(phieu_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit()
    return _to_dict(_load(phieu_id, db))


@router.delete("/phieu-in/{phieu_id}")
def delete_phieu_in(phieu_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    p = db.query(PhieuIn).filter(PhieuIn.id == phieu_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu in")
    db.delete(p)
    db.commit()
    return {"ok": True}


@router.patch("/phieu-in/{phieu_id}/move")
def move_phieu(
    phieu_id: int,
    body: MoveBody,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Drag-drop: cập nhật cột (trang_thai + may_in_id) và sort_order."""
    if body.trang_thai not in VALID_STATES:
        raise HTTPException(status_code=400, detail=f"Trạng thái không hợp lệ: {body.trang_thai}")

    p = db.query(PhieuIn).filter(PhieuIn.id == phieu_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu in")

    prev_state = p.trang_thai
    p.trang_thai = body.trang_thai
    p.may_in_id = body.may_in_id
    p.sort_order = body.sort_order
    if body.trang_thai == 'dang_in' and prev_state != 'dang_in' and not p.gio_bat_dau_in:
        p.gio_bat_dau_in = datetime.utcnow()
    if body.trang_thai == 'hoan_thanh' and prev_state != 'hoan_thanh':
        p.gio_hoan_thanh = datetime.utcnow()
    db.commit()
    return _to_dict(_load(phieu_id, db))


@router.patch("/phieu-in/{phieu_id}/start")
def start_printing(phieu_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    p = db.query(PhieuIn).filter(PhieuIn.id == phieu_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu in")
    if not p.gio_bat_dau_in:
        p.gio_bat_dau_in = datetime.utcnow()
    p.trang_thai = "dang_in"
    p.ngay_in = date.today()
    db.commit()
    return _to_dict(_load(phieu_id, db))


@router.patch("/phieu-in/{phieu_id}/complete")
def complete_printing(
    phieu_id: int,
    body: CompleteBody,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Kết thúc in → chuyển sang Chờ định hình."""
    p = db.query(PhieuIn).filter(PhieuIn.id == phieu_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu in")
    p.trang_thai = "cho_dinh_hinh"
    p.may_in_id = None
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit()
    return _to_dict(_load(phieu_id, db))


@router.patch("/phieu-in/{phieu_id}/sau-in")
def start_sau_in(
    phieu_id: int,
    body: SauInBody,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Bắt đầu định hình → trạng thái sau_in, ghi giờ bắt đầu."""
    p = db.query(PhieuIn).filter(PhieuIn.id == phieu_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu in")
    p.trang_thai = "sau_in"
    if not p.gio_bat_dau_dinh_hinh:
        p.gio_bat_dau_dinh_hinh = datetime.utcnow()
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit()
    return _to_dict(_load(phieu_id, db))


@router.patch("/phieu-in/{phieu_id}/hoan-thanh")
def finish_sau_in(phieu_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = db.query(PhieuIn).filter(PhieuIn.id == phieu_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu in")
    p.trang_thai = "hoan_thanh"
    p.gio_hoan_thanh = datetime.utcnow()
    p.gio_hoan_thanh_dinh_hinh = datetime.utcnow()
    _auto_nhap_thanh_pham(db, p, current_user.id)
    db.commit()
    return _to_dict(_load(phieu_id, db))


class AssignSauInBody(BaseModel):
    may_sau_in_id: Optional[int] = None


@router.patch("/phieu-in/{phieu_id}/assign-sauin")
def assign_sau_in(phieu_id: int, body: AssignSauInBody, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Gán máy sau in (hoặc bỏ gán nếu may_sau_in_id=null)."""
    p = db.query(PhieuIn).filter(PhieuIn.id == phieu_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu in")
    p.may_sau_in_id = body.may_sau_in_id
    db.commit()
    return _to_dict(_load(phieu_id, db))


@router.patch("/phieu-in/{phieu_id}/bat-dau-sauin")
def bat_dau_sau_in(phieu_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Bắt đầu sau in → dang_sau_in."""
    p = db.query(PhieuIn).filter(PhieuIn.id == phieu_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu in")
    p.trang_thai = "dang_sau_in"
    db.commit()
    return _to_dict(_load(phieu_id, db))


@router.patch("/phieu-in/{phieu_id}/tra-ve-sauin")
def tra_ve_sau_in(phieu_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Trả về chờ gán máy — xoá may_sau_in_id và reset về sau_in."""
    p = db.query(PhieuIn).filter(PhieuIn.id == phieu_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu in")
    p.may_sau_in_id = None
    p.trang_thai = "sau_in"
    db.commit()
    return _to_dict(_load(phieu_id, db))


@router.patch("/phieu-in/{phieu_id}/huy")
def huy_phieu(phieu_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Trả phiếu về máy in: ke_hoach (nếu đang trên máy) hoặc cho_in (nếu chưa gán máy).
    Reset tiến độ thời gian. Không thể hoàn tác nếu đã hoàn thành."""
    p = db.query(PhieuIn).filter(PhieuIn.id == phieu_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu in")
    if p.trang_thai == "hoan_thanh":
        raise HTTPException(status_code=400, detail="Không thể huỷ phiếu đã hoàn thành")
    # Nếu đang gán cho máy in → trả về ke_hoach trên cùng máy
    # Nếu chưa gán máy → trả về cho_in
    if p.may_in_id:
        p.trang_thai = "ke_hoach"
    else:
        p.trang_thai = "cho_in"
    p.may_sau_in_id = None
    p.gio_bat_dau_in = None
    p.gio_hoan_thanh = None
    db.commit()
    return _to_dict(_load(phieu_id, db))


# ── Máy Scan CRUD ──────────────────────────────────────────────────────────────

class MayScanCreate(BaseModel):
    ten_may: str
    sort_order: int = 0
    don_gia: Optional[Decimal] = None
    phan_xuong_id: Optional[int] = None


class MayScanUpdate(BaseModel):
    ten_may: Optional[str] = None
    sort_order: Optional[int] = None
    active: Optional[bool] = None
    don_gia: Optional[Decimal] = None
    phan_xuong_id: Optional[int] = None


class ScanLogCreate(BaseModel):
    may_scan_id: int
    so_lsx: str
    ten_hang: Optional[str] = None
    dai: Optional[Decimal] = None
    rong: Optional[Decimal] = None
    cao: Optional[Decimal] = None
    kho_tt: Optional[Decimal] = None
    dien_tich: Optional[Decimal] = None     # tổng m² (frontend tính: dt_per_unit * SL)
    so_luong_tp: Decimal
    don_gia: Optional[Decimal] = None
    nguoi_sx: Optional[str] = None
    ghi_chu: Optional[str] = None


def _scan_log_to_dict(s: ScanLog) -> dict:
    return {
        "id": s.id,
        "may_scan_id": s.may_scan_id,
        "ten_may": s.may_scan_obj.ten_may if s.may_scan_obj else None,
        "so_lsx": s.so_lsx,
        "ten_hang": s.ten_hang,
        "dai": float(s.dai) if s.dai is not None else None,
        "rong": float(s.rong) if s.rong is not None else None,
        "cao": float(s.cao) if s.cao is not None else None,
        "kho_tt": float(s.kho_tt) if s.kho_tt is not None else None,
        "dien_tich": float(s.dien_tich) if s.dien_tich is not None else None,
        "so_luong_tp": float(s.so_luong_tp),
        "don_gia": float(s.don_gia) if s.don_gia is not None else None,
        "tien_luong": float(s.tien_luong) if s.tien_luong is not None else None,
        "nguoi_sx": s.nguoi_sx,
        "ghi_chu": s.ghi_chu,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


@router.get("/may-scan")
def list_may_scan(
    phan_xuong_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(MayScan)
    if phan_xuong_id is not None:
        q = q.filter(MayScan.phan_xuong_id == phan_xuong_id)
    return q.order_by(MayScan.sort_order).all()


@router.post("/may-scan", status_code=201)
def create_may_scan(data: MayScanCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    m = MayScan(**data.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@router.put("/may-scan/{may_id}")
def update_may_scan(may_id: int, data: MayScanUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    m = db.query(MayScan).filter(MayScan.id == may_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Không tìm thấy máy scan")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(m, k, v)
    db.commit()
    db.refresh(m)
    return m


@router.delete("/may-scan/{may_id}")
def delete_may_scan(may_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    m = db.query(MayScan).filter(MayScan.id == may_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Không tìm thấy máy scan")
    db.delete(m)
    db.commit()
    return {"ok": True}


# ── Scan lookup + log ──────────────────────────────────────────────────────────

@router.get("/scan/lookup/{so_lsx}")
def scan_lookup(so_lsx: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Tra cứu thông tin LSX để điền tự động vào form scan."""
    order = (
        db.query(ProductionOrder)
        .options(joinedload(ProductionOrder.items))
        .filter(ProductionOrder.so_lenh == so_lsx)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy lệnh sản xuất")
    first = order.items[0] if order.items else None
    return {
        "so_lsx": so_lsx,
        "ten_hang": first.ten_hang if first else None,
        "dai": float(first.dai) if first and first.dai is not None else None,
        "rong": float(first.rong) if first and first.rong is not None else None,
        "cao": float(first.cao) if first and first.cao is not None else None,
        "kho_tt": float(first.kho_tt) if first and first.kho_tt is not None else None,
        "dai_tt": float(first.dai_tt) if first and first.dai_tt is not None else None,
        "dien_tich_don_vi": float(first.dien_tich) if first and first.dien_tich is not None else None,
    }


@router.post("/scan/log", status_code=201)
def create_scan_log(
    data: ScanLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tien_luong = None
    if data.don_gia is not None and data.dien_tich is not None:
        tien_luong = Decimal(str(data.don_gia)) * Decimal(str(data.dien_tich))

    log = ScanLog(
        **data.model_dump(exclude_none=True),
        tien_luong=tien_luong,
        created_by=current_user.id,
    )
    db.add(log)
    db.commit()
    log = db.query(ScanLog).options(joinedload(ScanLog.may_scan_obj)).filter(ScanLog.id == log.id).first()
    return _scan_log_to_dict(log)


@router.get("/scan/history")
def scan_history(
    may_scan_id: Optional[int] = Query(default=None),
    days: int = Query(default=30),
    so_lsx: Optional[str] = Query(default=None),
    phan_xuong_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(days=days)
    q = (
        db.query(ScanLog)
        .options(joinedload(ScanLog.may_scan_obj))
        .join(MayScan, ScanLog.may_scan_id == MayScan.id)
        .filter(ScanLog.created_at >= cutoff)
    )
    if may_scan_id:
        q = q.filter(ScanLog.may_scan_id == may_scan_id)
    if so_lsx:
        q = q.filter(ScanLog.so_lsx.ilike(f"%{so_lsx}%"))
    if phan_xuong_id is not None:
        q = q.filter(MayScan.phan_xuong_id == phan_xuong_id)
    logs = q.order_by(ScanLog.created_at.desc()).limit(500).all()
    return [_scan_log_to_dict(s) for s in logs]


@router.delete("/scan/log/{log_id}")
def delete_scan_log(log_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    s = db.query(ScanLog).filter(ScanLog.id == log_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi")
    db.delete(s)
    db.commit()
    return {"ok": True}


# ── Dashboard ──────────────────────────────────────────────────────────────────

@router.get("/dashboard")
def get_dashboard(
    phan_xuong_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from datetime import timedelta, date as date_type
    today = date_type.today()

    # Đếm phiếu in theo trạng thái (bỏ 'huy')
    states = ["cho_in", "ke_hoach", "dang_in", "cho_dinh_hinh", "sau_in", "hoan_thanh"]
    counts: dict[str, int] = {}
    for s in states:
        q_cnt = db.query(func.count(PhieuIn.id)).filter(PhieuIn.trang_thai == s)
        if phan_xuong_id is not None:
            q_cnt = q_cnt.filter(PhieuIn.phan_xuong_id == phan_xuong_id)
        counts[s] = q_cnt.scalar() or 0

    # Scan trong 24 giờ qua
    cutoff_24h = datetime.utcnow() - timedelta(hours=24)
    q_scan = db.query(
        func.count(ScanLog.id),
        func.coalesce(func.sum(ScanLog.so_luong_tp), 0),
        func.coalesce(func.sum(ScanLog.dien_tich), 0),
        func.coalesce(func.sum(ScanLog.tien_luong), 0),
    ).filter(ScanLog.created_at >= cutoff_24h)
    if phan_xuong_id is not None:
        q_scan = q_scan.join(MayScan, ScanLog.may_scan_id == MayScan.id).filter(MayScan.phan_xuong_id == phan_xuong_id)
    scan_row = q_scan.one()

    # Phiếu in hoàn thành hôm nay (ngay_in = today)
    q_today = db.query(func.count(PhieuIn.id)).filter(
        PhieuIn.trang_thai == "hoan_thanh",
        PhieuIn.ngay_in == today,
    )
    if phan_xuong_id is not None:
        q_today = q_today.filter(PhieuIn.phan_xuong_id == phan_xuong_id)
    in_today = q_today.scalar() or 0

    # Scan theo từng máy hôm nay
    q_may_scan = (
        db.query(
            MayScan.id,
            MayScan.ten_may,
            func.count(ScanLog.id).label("so_lan"),
            func.coalesce(func.sum(ScanLog.so_luong_tp), 0).label("sl_tp"),
            func.coalesce(func.sum(ScanLog.tien_luong), 0).label("tien_luong"),
        )
        .outerjoin(ScanLog, (ScanLog.may_scan_id == MayScan.id) & (ScanLog.created_at >= cutoff_24h))
        .filter(MayScan.active == True)
    )
    if phan_xuong_id is not None:
        q_may_scan = q_may_scan.filter(MayScan.phan_xuong_id == phan_xuong_id)
    may_scan_stats = q_may_scan.group_by(MayScan.id, MayScan.ten_may).order_by(MayScan.sort_order).all()

    return {
        "phieu_in_counts": counts,
        "scan_24h": {
            "so_lan": int(scan_row[0]),
            "so_luong_tp": float(scan_row[1]),
            "dien_tich": float(scan_row[2]),
            "tien_luong": float(scan_row[3]),
        },
        "in_hoan_thanh_hom_nay": in_today,
        "may_scan_stats": [
            {
                "may_scan_id": r.id,
                "ten_may": r.ten_may,
                "so_lan": int(r.so_lan),
                "sl_tp": float(r.sl_tp),
                "tien_luong": float(r.tien_luong),
            }
            for r in may_scan_stats
        ],
    }


# ── Lịch sử phiếu in ──────────────────────────────────────────────────────────

@router.get("/history/phieu-in")
def history_phieu_in(
    days: int = Query(default=30),
    search: str = Query(default=""),
    trang_thai: Optional[str] = Query(default=None),
    phan_xuong_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(days=days)
    q = (
        db.query(PhieuIn)
        .options(joinedload(PhieuIn.may_in_obj), joinedload(PhieuIn.may_sau_in_obj))
        .filter(PhieuIn.created_at >= cutoff)
    )
    if trang_thai:
        q = q.filter(PhieuIn.trang_thai == trang_thai)
    else:
        q = q.filter(PhieuIn.trang_thai != "huy")
    if search:
        like = f"%{search}%"
        q = q.filter(
            PhieuIn.so_phieu.ilike(like) | PhieuIn.ten_hang.ilike(like) | PhieuIn.ma_kh.ilike(like)
        )
    if phan_xuong_id is not None:
        q = q.filter(PhieuIn.phan_xuong_id == phan_xuong_id)
    return [_to_dict(p) for p in q.order_by(PhieuIn.created_at.desc()).limit(500).all()]


# ── Shift: Ca làm việc ────────────────────────────────────────────────────────

class ShiftCaCreate(BaseModel):
    name: str
    leader: Optional[str] = None
    phan_xuong_id: Optional[int] = None


class ShiftCaUpdate(BaseModel):
    name: Optional[str] = None
    leader: Optional[str] = None
    active: Optional[bool] = None
    phan_xuong_id: Optional[int] = None


@router.get("/shift/ca")
def list_shift_ca(
    phan_xuong_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(ShiftCa)
    if phan_xuong_id is not None:
        q = q.filter(ShiftCa.phan_xuong_id == phan_xuong_id)
    return q.order_by(ShiftCa.id).all()


@router.post("/shift/ca", status_code=201)
def create_shift_ca(data: ShiftCaCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    c = ShiftCa(**data.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.put("/shift/ca/{shift_id}")
def update_shift_ca(shift_id: int, data: ShiftCaUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    c = db.query(ShiftCa).filter(ShiftCa.id == shift_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Không tìm thấy ca")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/shift/ca/{shift_id}")
def delete_shift_ca(shift_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    c = db.query(ShiftCa).filter(ShiftCa.id == shift_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Không tìm thấy ca")
    db.delete(c)
    db.commit()
    return {"ok": True}


# ── Shift: Lịch ca ────────────────────────────────────────────────────────────

class ShiftConfigCreate(BaseModel):
    may_in_id: int
    shift_ca_id: int
    ngay: date
    gio_lam: Optional[Decimal] = None
    gio_bat_dau: Optional[str] = None
    gio_ket_thuc: Optional[str] = None
    nghi_1: Optional[int] = None
    nghi_2: Optional[int] = None


def _shift_config_to_dict(c: ShiftConfig) -> dict:
    return {
        "id": c.id,
        "may_in_id": c.may_in_id,
        "ten_may": c.may_in_obj.ten_may if c.may_in_obj else None,
        "shift_ca_id": c.shift_ca_id,
        "ten_ca": c.shift_ca_obj.name if c.shift_ca_obj else None,
        "ngay": str(c.ngay),
        "gio_lam": float(c.gio_lam) if c.gio_lam is not None else None,
        "gio_bat_dau": c.gio_bat_dau,
        "gio_ket_thuc": c.gio_ket_thuc,
        "nghi_1": c.nghi_1,
        "nghi_2": c.nghi_2,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("/shift/config")
def list_shift_config(
    may_in_id: Optional[int] = Query(default=None),
    shift_ca_id: Optional[int] = Query(default=None),
    days: int = Query(default=30),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from datetime import timedelta, date as date_type
    cutoff = date_type.today() - timedelta(days=days)
    q = (
        db.query(ShiftConfig)
        .options(joinedload(ShiftConfig.may_in_obj), joinedload(ShiftConfig.shift_ca_obj))
        .filter(ShiftConfig.ngay >= cutoff)
    )
    if may_in_id:
        q = q.filter(ShiftConfig.may_in_id == may_in_id)
    if shift_ca_id:
        q = q.filter(ShiftConfig.shift_ca_id == shift_ca_id)
    return [_shift_config_to_dict(c) for c in q.order_by(ShiftConfig.ngay.desc()).limit(300).all()]


@router.post("/shift/config", status_code=201)
def create_shift_config(data: ShiftConfigCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    c = ShiftConfig(**data.model_dump())
    db.add(c)
    db.commit()
    c = (
        db.query(ShiftConfig)
        .options(joinedload(ShiftConfig.may_in_obj), joinedload(ShiftConfig.shift_ca_obj))
        .filter(ShiftConfig.id == c.id)
        .first()
    )
    return _shift_config_to_dict(c)


@router.delete("/shift/config/{config_id}")
def delete_shift_config(config_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    c = db.query(ShiftConfig).filter(ShiftConfig.id == config_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch ca")
    db.delete(c)
    db.commit()
    return {"ok": True}


# ── Config: Printer User ──────────────────────────────────────────────────────

class PrinterUserCreate(BaseModel):
    token_user: str
    token_password: str
    rfid_key: Optional[str] = None
    shift: Optional[int] = None


class PrinterUserUpdate(BaseModel):
    token_user: Optional[str] = None
    token_password: Optional[str] = None
    rfid_key: Optional[str] = None
    shift: Optional[int] = None
    active: Optional[bool] = None


def _printer_user_to_dict(u: PrinterUser) -> dict:
    return {
        "id": u.id,
        "rfid_key": u.rfid_key,
        "token_user": u.token_user,
        "shift": u.shift,
        "active": u.active,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


@router.get("/config/printer-user")
def list_printer_user(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return [_printer_user_to_dict(u) for u in db.query(PrinterUser).order_by(PrinterUser.id).all()]


@router.post("/config/printer-user", status_code=201)
def create_printer_user(data: PrinterUserCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    u = PrinterUser(**data.model_dump())
    db.add(u)
    db.commit()
    db.refresh(u)
    return _printer_user_to_dict(u)


@router.put("/config/printer-user/{user_id}")
def update_printer_user(user_id: int, data: PrinterUserUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    u = db.query(PrinterUser).filter(PrinterUser.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Không tìm thấy")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(u, k, v)
    db.commit()
    db.refresh(u)
    return _printer_user_to_dict(u)


@router.delete("/config/printer-user/{user_id}")
def delete_printer_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    u = db.query(PrinterUser).filter(PrinterUser.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Không tìm thấy")
    db.delete(u)
    db.commit()
    return {"ok": True}
