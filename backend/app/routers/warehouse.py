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
from app.models.master import PhanXuong, Warehouse, PaperMaterial, OtherMaterial, Supplier
from app.models.inventory import InventoryBalance, InventoryTransaction
from app.models.warehouse_doc import (
    PhieuNhapKho, PhieuNhapKhoItem,
    PhieuXuatKho, PhieuXuatKhoItem,
    PhieuChuyenKho, PhieuChuyenKhoItem,
)

router = APIRouter(prefix="/api/warehouse", tags=["warehouse"])

# ── Schemas ───────────────────────────────────────────────────────────────────

class ItemCreate(BaseModel):
    paper_material_id: Optional[int] = None
    other_material_id: Optional[int] = None
    ten_hang: str
    don_vi: str = "Kg"
    so_luong: Decimal
    don_gia: Decimal = Decimal("0")
    ghi_chu: Optional[str] = None

class PhieuNhapCreate(BaseModel):
    warehouse_id: int
    ngay: date
    loai_nhap: str = "mua_hang"
    nha_cung_cap_id: Optional[int] = None
    ghi_chu: Optional[str] = None
    items: list[ItemCreate]

class PhieuXuatCreate(BaseModel):
    warehouse_id: int
    ngay: date
    loai_xuat: str = "san_xuat"
    ghi_chu: Optional[str] = None
    items: list[ItemCreate]

class PhieuChuyenCreate(BaseModel):
    warehouse_xuat_id: int
    warehouse_nhap_id: int
    ngay: date
    ghi_chu: Optional[str] = None
    items: list[ItemCreate]

class PhanXuongCreate(BaseModel):
    ma_xuong: str
    ten_xuong: str
    dia_chi: Optional[str] = None
    cong_doan: str = "cd2"
    trang_thai: bool = True

# ── Helpers ───────────────────────────────────────────────────────────────────

def _gen_so_phieu(db: Session, prefix: str) -> str:
    ym = datetime.today().strftime("%Y%m")
    pattern = f"{prefix}-{ym}-%"
    model = PhieuNhapKho if prefix == "NK" else PhieuXuatKho if prefix == "XK" else PhieuChuyenKho
    last = db.query(func.max(model.so_phieu)).filter(model.so_phieu.like(pattern)).scalar()
    seq = 1
    if last:
        try:
            seq = int(last.rsplit("-", 1)[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    return f"{prefix}-{ym}-{seq:04d}"


def _get_or_create_balance(
    db: Session,
    warehouse_id: int,
    paper_material_id: Optional[int],
    other_material_id: Optional[int],
    ten_hang: str = "",
    don_vi: str = "Kg",
) -> InventoryBalance:
    q = db.query(InventoryBalance).filter(InventoryBalance.warehouse_id == warehouse_id)

    if paper_material_id:
        q = q.filter(InventoryBalance.paper_material_id == paper_material_id)
        balance = q.first()
    elif other_material_id:
        q = q.filter(InventoryBalance.other_material_id == other_material_id)
        balance = q.first()
    else:
        # Hàng tự do: dùng ten_hang làm key phụ (cả 2 material ID đều null)
        q = q.filter(
            InventoryBalance.paper_material_id.is_(None),
            InventoryBalance.other_material_id.is_(None),
            InventoryBalance.ten_hang == ten_hang,
        )
        balance = q.first()

    if not balance:
        balance = InventoryBalance(
            warehouse_id=warehouse_id,
            paper_material_id=paper_material_id,
            other_material_id=other_material_id,
            ten_hang=ten_hang or None,
            don_vi=don_vi,
            ton_luong=Decimal("0"),
            gia_tri_ton=Decimal("0"),
            don_gia_binh_quan=Decimal("0"),
        )
        db.add(balance)
        db.flush()
    else:
        # Cập nhật ten_hang/don_vi nếu bản ghi cũ chưa có (backward compat)
        if ten_hang and not balance.ten_hang:
            balance.ten_hang = ten_hang
        if don_vi and not balance.don_vi:
            balance.don_vi = don_vi

    return balance


def _nhap_balance(balance: InventoryBalance, so_luong: Decimal, don_gia: Decimal):
    thanh_tien = so_luong * don_gia
    gia_tri_cu = balance.ton_luong * balance.don_gia_binh_quan
    balance.ton_luong += so_luong
    if balance.ton_luong > 0:
        balance.don_gia_binh_quan = (gia_tri_cu + thanh_tien) / balance.ton_luong
    balance.gia_tri_ton = balance.ton_luong * balance.don_gia_binh_quan
    balance.cap_nhat_luc = datetime.utcnow()


def _xuat_balance(balance: InventoryBalance, so_luong: Decimal, ten_hang: str):
    if balance.ton_luong < so_luong:
        raise HTTPException(
            status_code=400,
            detail=f"Không đủ tồn kho: {ten_hang} — cần {float(so_luong):g}, còn {float(balance.ton_luong):g}"
        )
    balance.ton_luong -= so_luong
    balance.gia_tri_ton = balance.ton_luong * balance.don_gia_binh_quan
    balance.cap_nhat_luc = datetime.utcnow()


def _ghi_transaction(db: Session, warehouse_id: int, loai: str,
                     paper_material_id: Optional[int], other_material_id: Optional[int],
                     so_luong: Decimal, don_gia: Decimal, ton_sau: Decimal,
                     chung_tu_loai: str, chung_tu_id: int, created_by: Optional[int],
                     ghi_chu: Optional[str] = None):
    tx = InventoryTransaction(
        warehouse_id=warehouse_id,
        paper_material_id=paper_material_id,
        other_material_id=other_material_id,
        loai_giao_dich=loai,
        so_luong=so_luong,
        don_gia=don_gia,
        gia_tri=so_luong * don_gia,
        ton_sau_giao_dich=ton_sau,
        chung_tu_loai=chung_tu_loai,
        chung_tu_id=chung_tu_id,
        ghi_chu=ghi_chu,
        created_by=created_by,
    )
    db.add(tx)


def _resolve_material_info(db: Session, paper_material_id: Optional[int], other_material_id: Optional[int]):
    """Tra cứu ten_hang, don_vi, ton_toi_thieu từ bảng vật tư master."""
    if paper_material_id:
        mat = db.get(PaperMaterial, paper_material_id)
        if mat:
            return mat.ten, mat.dvt, float(mat.ton_toi_thieu)
    elif other_material_id:
        mat = db.get(OtherMaterial, other_material_id)
        if mat:
            return mat.ten, mat.dvt, float(mat.ton_toi_thieu)
    return None, None, 0


def _item_to_dict(item) -> dict:
    return {
        "id": item.id,
        "paper_material_id": item.paper_material_id,
        "other_material_id": item.other_material_id,
        "ten_hang": item.ten_hang,
        "don_vi": item.don_vi,
        "so_luong": float(item.so_luong),
        "don_gia": float(item.don_gia),
        "thanh_tien": float(getattr(item, "thanh_tien", item.so_luong * item.don_gia)),
        "ghi_chu": item.ghi_chu,
    }


# ── Phân xưởng ────────────────────────────────────────────────────────────────

@router.get("/phan-xuong")
def list_phan_xuong(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(PhanXuong).order_by(PhanXuong.id).all()
    return [_px_to_dict(r) for r in rows]


@router.post("/phan-xuong", status_code=201)
def create_phan_xuong(body: PhanXuongCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if db.query(PhanXuong).filter(PhanXuong.ma_xuong == body.ma_xuong).first():
        raise HTTPException(400, f"Mã xưởng '{body.ma_xuong}' đã tồn tại")
    obj = PhanXuong(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _px_to_dict(obj)


@router.put("/phan-xuong/{px_id}")
def update_phan_xuong(px_id: int, body: PhanXuongCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    obj = db.get(PhanXuong, px_id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy phân xưởng")
    for k, v in body.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return _px_to_dict(obj)


@router.delete("/phan-xuong/{px_id}")
def delete_phan_xuong(px_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    obj = db.get(PhanXuong, px_id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy phân xưởng")
    if db.query(Warehouse).filter(Warehouse.phan_xuong_id == px_id).first():
        raise HTTPException(400, "Phân xưởng đang được dùng bởi kho, không thể xoá")
    db.delete(obj)
    db.commit()
    return {"ok": True}


def _px_to_dict(r: PhanXuong) -> dict:
    return {"id": r.id, "ma_xuong": r.ma_xuong, "ten_xuong": r.ten_xuong,
            "dia_chi": r.dia_chi, "cong_doan": r.cong_doan, "trang_thai": r.trang_thai}


# ── Tồn kho ───────────────────────────────────────────────────────────────────

@router.get("/ton-kho")
def get_ton_kho(
    warehouse_id: Optional[int] = Query(None),
    phan_xuong_id: Optional[int] = Query(None),
    loai: Optional[str] = Query(None),  # "giay" | "khac"
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = (db.query(InventoryBalance)
         .join(Warehouse, Warehouse.id == InventoryBalance.warehouse_id)
         .filter(InventoryBalance.ton_luong > 0))

    if warehouse_id:
        q = q.filter(InventoryBalance.warehouse_id == warehouse_id)
    if phan_xuong_id:
        q = q.filter(Warehouse.phan_xuong_id == phan_xuong_id)
    if loai == "giay":
        q = q.filter(InventoryBalance.paper_material_id.isnot(None))
    elif loai == "khac":
        q = q.filter(InventoryBalance.other_material_id.isnot(None))

    rows = q.all()
    result = []
    for r in rows:
        # Ưu tiên: tra cứu từ material master; fallback dùng ten_hang trong balance
        ten_hang = r.ten_hang or ""
        don_vi = r.don_vi or ""
        ton_toi_thieu = 0

        if r.paper_material_id:
            mat = db.get(PaperMaterial, r.paper_material_id)
            if mat:
                ten_hang = mat.ten
                don_vi = mat.dvt
                ton_toi_thieu = float(mat.ton_toi_thieu)
        elif r.other_material_id:
            mat = db.get(OtherMaterial, r.other_material_id)
            if mat:
                ten_hang = mat.ten
                don_vi = mat.dvt
                ton_toi_thieu = float(mat.ton_toi_thieu)

        if not ten_hang:
            continue  # bỏ qua bản ghi không có tên

        if search and search.lower() not in ten_hang.lower():
            continue

        wh = db.get(Warehouse, r.warehouse_id)
        result.append({
            "id": r.id,
            "warehouse_id": r.warehouse_id,
            "ten_kho": wh.ten_kho if wh else "",
            "phan_xuong_id": wh.phan_xuong_id if wh else None,
            "paper_material_id": r.paper_material_id,
            "other_material_id": r.other_material_id,
            "ten_hang": ten_hang,
            "don_vi": don_vi,
            "ton_luong": float(r.ton_luong),
            "don_gia_binh_quan": float(r.don_gia_binh_quan),
            "gia_tri_ton": float(r.gia_tri_ton),
            "ton_toi_thieu": ton_toi_thieu,
            "cap_nhat_luc": r.cap_nhat_luc.isoformat() if r.cap_nhat_luc else None,
        })
    return result


# ── Phiếu nhập kho ────────────────────────────────────────────────────────────

@router.get("/phieu-nhap")
def list_phieu_nhap(
    warehouse_id: Optional[int] = Query(None),
    phan_xuong_id: Optional[int] = Query(None),
    loai_nhap: Optional[str] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(PhieuNhapKho).join(Warehouse, Warehouse.id == PhieuNhapKho.warehouse_id)
    if warehouse_id:
        q = q.filter(PhieuNhapKho.warehouse_id == warehouse_id)
    if phan_xuong_id:
        q = q.filter(Warehouse.phan_xuong_id == phan_xuong_id)
    if loai_nhap:
        q = q.filter(PhieuNhapKho.loai_nhap == loai_nhap)
    if tu_ngay:
        q = q.filter(PhieuNhapKho.ngay >= tu_ngay)
    if den_ngay:
        q = q.filter(PhieuNhapKho.ngay <= den_ngay)
    rows = q.options(joinedload(PhieuNhapKho.items)).order_by(PhieuNhapKho.created_at.desc()).all()
    return [_phieu_nhap_to_dict(r, db) for r in rows]


@router.get("/phieu-nhap/{phieu_id}")
def get_phieu_nhap(phieu_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    p = db.query(PhieuNhapKho).options(joinedload(PhieuNhapKho.items)).filter(PhieuNhapKho.id == phieu_id).first()
    if not p:
        raise HTTPException(404, "Không tìm thấy phiếu nhập")
    return _phieu_nhap_to_dict(p, db)


@router.post("/phieu-nhap")
def create_phieu_nhap(
    body: PhieuNhapCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.items:
        raise HTTPException(400, "Phiếu nhập phải có ít nhất 1 dòng hàng")
    wh = db.get(Warehouse, body.warehouse_id)
    if not wh:
        raise HTTPException(404, "Không tìm thấy kho")

    phieu = PhieuNhapKho(
        so_phieu=_gen_so_phieu(db, "NK"),
        warehouse_id=body.warehouse_id,
        ngay=body.ngay,
        loai_nhap=body.loai_nhap,
        nha_cung_cap_id=body.nha_cung_cap_id,
        ghi_chu=body.ghi_chu,
        created_by=current_user.id,
    )
    db.add(phieu)
    db.flush()

    for it in body.items:
        # Nếu có material ID, lấy tên chuẩn từ master
        ten_hang = it.ten_hang
        don_vi = it.don_vi
        if it.paper_material_id:
            mat = db.get(PaperMaterial, it.paper_material_id)
            if mat:
                ten_hang = mat.ten
                don_vi = mat.dvt
        elif it.other_material_id:
            mat = db.get(OtherMaterial, it.other_material_id)
            if mat:
                ten_hang = mat.ten
                don_vi = mat.dvt

        thanh_tien = it.so_luong * it.don_gia
        item = PhieuNhapKhoItem(
            phieu_nhap_kho_id=phieu.id,
            paper_material_id=it.paper_material_id,
            other_material_id=it.other_material_id,
            ten_hang=ten_hang,
            don_vi=don_vi,
            so_luong=it.so_luong,
            don_gia=it.don_gia,
            thanh_tien=thanh_tien,
            ghi_chu=it.ghi_chu,
        )
        db.add(item)
        balance = _get_or_create_balance(db, body.warehouse_id, it.paper_material_id, it.other_material_id, ten_hang, don_vi)
        _nhap_balance(balance, it.so_luong, it.don_gia)
        _ghi_transaction(db, body.warehouse_id, "nhap_kho",
                         it.paper_material_id, it.other_material_id,
                         it.so_luong, it.don_gia, balance.ton_luong,
                         "phieu_nhap_kho", phieu.id, current_user.id, it.ghi_chu)

    db.commit()
    db.refresh(phieu)
    return _phieu_nhap_to_dict(phieu, db)


@router.delete("/phieu-nhap/{phieu_id}")
def delete_phieu_nhap(phieu_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    p = db.query(PhieuNhapKho).options(joinedload(PhieuNhapKho.items)).filter(PhieuNhapKho.id == phieu_id).first()
    if not p:
        raise HTTPException(404, "Không tìm thấy phiếu nhập")
    if p.trang_thai != "nhap":
        raise HTTPException(400, "Chỉ được xoá phiếu ở trạng thái Nhập")
    for it in p.items:
        balance = _get_or_create_balance(db, p.warehouse_id, it.paper_material_id, it.other_material_id, it.ten_hang, it.don_vi)
        balance.ton_luong = max(Decimal("0"), balance.ton_luong - it.so_luong)
        balance.gia_tri_ton = balance.ton_luong * balance.don_gia_binh_quan
        balance.cap_nhat_luc = datetime.utcnow()
    db.delete(p)
    db.commit()
    return {"ok": True}


def _phieu_nhap_to_dict(p: PhieuNhapKho, db: Session) -> dict:
    wh = db.get(Warehouse, p.warehouse_id)
    ncc = db.get(Supplier, p.nha_cung_cap_id) if p.nha_cung_cap_id else None
    tong_tien = sum(float(i.thanh_tien) for i in p.items)
    return {
        "id": p.id,
        "so_phieu": p.so_phieu,
        "warehouse_id": p.warehouse_id,
        "ten_kho": wh.ten_kho if wh else "",
        "ngay": str(p.ngay),
        "loai_nhap": p.loai_nhap,
        "nha_cung_cap_id": p.nha_cung_cap_id,
        "ten_ncc": ncc.ten_viet_tat if ncc else None,
        "tong_tien": tong_tien,
        "ghi_chu": p.ghi_chu,
        "trang_thai": p.trang_thai,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "items": [_item_to_dict(i) for i in p.items],
    }


# ── Phiếu xuất kho ────────────────────────────────────────────────────────────

@router.get("/phieu-xuat")
def list_phieu_xuat(
    warehouse_id: Optional[int] = Query(None),
    phan_xuong_id: Optional[int] = Query(None),
    loai_xuat: Optional[str] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(PhieuXuatKho).join(Warehouse, Warehouse.id == PhieuXuatKho.warehouse_id)
    if warehouse_id:
        q = q.filter(PhieuXuatKho.warehouse_id == warehouse_id)
    if phan_xuong_id:
        q = q.filter(Warehouse.phan_xuong_id == phan_xuong_id)
    if loai_xuat:
        q = q.filter(PhieuXuatKho.loai_xuat == loai_xuat)
    if tu_ngay:
        q = q.filter(PhieuXuatKho.ngay >= tu_ngay)
    if den_ngay:
        q = q.filter(PhieuXuatKho.ngay <= den_ngay)
    rows = q.options(joinedload(PhieuXuatKho.items)).order_by(PhieuXuatKho.created_at.desc()).all()
    return [_phieu_xuat_to_dict(r, db) for r in rows]


@router.get("/phieu-xuat/{phieu_id}")
def get_phieu_xuat(phieu_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    p = db.query(PhieuXuatKho).options(joinedload(PhieuXuatKho.items)).filter(PhieuXuatKho.id == phieu_id).first()
    if not p:
        raise HTTPException(404, "Không tìm thấy phiếu xuất")
    return _phieu_xuat_to_dict(p, db)


@router.post("/phieu-xuat")
def create_phieu_xuat(
    body: PhieuXuatCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.items:
        raise HTTPException(400, "Phiếu xuất phải có ít nhất 1 dòng hàng")
    wh = db.get(Warehouse, body.warehouse_id)
    if not wh:
        raise HTTPException(404, "Không tìm thấy kho")

    # Validate tồn trước khi tạo phiếu
    for it in body.items:
        balance = _get_or_create_balance(db, body.warehouse_id, it.paper_material_id, it.other_material_id, it.ten_hang, it.don_vi)
        if balance.ton_luong < it.so_luong:
            raise HTTPException(400, f"Không đủ tồn: {it.ten_hang} — cần {float(it.so_luong):g}, còn {float(balance.ton_luong):g}")

    phieu = PhieuXuatKho(
        so_phieu=_gen_so_phieu(db, "XK"),
        warehouse_id=body.warehouse_id,
        ngay=body.ngay,
        loai_xuat=body.loai_xuat,
        ghi_chu=body.ghi_chu,
        created_by=current_user.id,
    )
    db.add(phieu)
    db.flush()

    for it in body.items:
        ten_hang = it.ten_hang
        don_vi = it.don_vi
        if it.paper_material_id:
            mat = db.get(PaperMaterial, it.paper_material_id)
            if mat:
                ten_hang = mat.ten
                don_vi = mat.dvt
        elif it.other_material_id:
            mat = db.get(OtherMaterial, it.other_material_id)
            if mat:
                ten_hang = mat.ten
                don_vi = mat.dvt

        thanh_tien = it.so_luong * it.don_gia
        item = PhieuXuatKhoItem(
            phieu_xuat_kho_id=phieu.id,
            paper_material_id=it.paper_material_id,
            other_material_id=it.other_material_id,
            ten_hang=ten_hang,
            don_vi=don_vi,
            so_luong=it.so_luong,
            don_gia=it.don_gia,
            thanh_tien=thanh_tien,
            ghi_chu=it.ghi_chu,
        )
        db.add(item)
        balance = _get_or_create_balance(db, body.warehouse_id, it.paper_material_id, it.other_material_id, ten_hang, don_vi)
        _xuat_balance(balance, it.so_luong, ten_hang)
        _ghi_transaction(db, body.warehouse_id, "xuat_kho",
                         it.paper_material_id, it.other_material_id,
                         it.so_luong, balance.don_gia_binh_quan, balance.ton_luong,
                         "phieu_xuat_kho", phieu.id, current_user.id, it.ghi_chu)

    db.commit()
    db.refresh(phieu)
    return _phieu_xuat_to_dict(phieu, db)


@router.delete("/phieu-xuat/{phieu_id}")
def delete_phieu_xuat(phieu_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    p = db.query(PhieuXuatKho).options(joinedload(PhieuXuatKho.items)).filter(PhieuXuatKho.id == phieu_id).first()
    if not p:
        raise HTTPException(404, "Không tìm thấy phiếu xuất")
    if p.trang_thai != "nhap":
        raise HTTPException(400, "Chỉ được xoá phiếu ở trạng thái Nhập")
    for it in p.items:
        balance = _get_or_create_balance(db, p.warehouse_id, it.paper_material_id, it.other_material_id, it.ten_hang, it.don_vi)
        balance.ton_luong += it.so_luong
        balance.gia_tri_ton = balance.ton_luong * balance.don_gia_binh_quan
        balance.cap_nhat_luc = datetime.utcnow()
    db.delete(p)
    db.commit()
    return {"ok": True}


def _phieu_xuat_to_dict(p: PhieuXuatKho, db: Session) -> dict:
    wh = db.get(Warehouse, p.warehouse_id)
    tong_tien = sum(float(i.thanh_tien) for i in p.items)
    return {
        "id": p.id,
        "so_phieu": p.so_phieu,
        "warehouse_id": p.warehouse_id,
        "ten_kho": wh.ten_kho if wh else "",
        "ngay": str(p.ngay),
        "loai_xuat": p.loai_xuat,
        "tong_tien": tong_tien,
        "ghi_chu": p.ghi_chu,
        "trang_thai": p.trang_thai,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "items": [_item_to_dict(i) for i in p.items],
    }


# ── Phiếu chuyển kho ──────────────────────────────────────────────────────────

@router.get("/phieu-chuyen")
def list_phieu_chuyen(
    warehouse_xuat_id: Optional[int] = Query(None),
    warehouse_nhap_id: Optional[int] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(PhieuChuyenKho)
    if warehouse_xuat_id:
        q = q.filter(PhieuChuyenKho.warehouse_xuat_id == warehouse_xuat_id)
    if warehouse_nhap_id:
        q = q.filter(PhieuChuyenKho.warehouse_nhap_id == warehouse_nhap_id)
    if tu_ngay:
        q = q.filter(PhieuChuyenKho.ngay >= tu_ngay)
    if den_ngay:
        q = q.filter(PhieuChuyenKho.ngay <= den_ngay)
    rows = q.options(joinedload(PhieuChuyenKho.items)).order_by(PhieuChuyenKho.created_at.desc()).all()
    return [_phieu_chuyen_to_dict(r, db) for r in rows]


@router.get("/phieu-chuyen/{phieu_id}")
def get_phieu_chuyen(phieu_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    p = db.query(PhieuChuyenKho).options(joinedload(PhieuChuyenKho.items)).filter(PhieuChuyenKho.id == phieu_id).first()
    if not p:
        raise HTTPException(404, "Không tìm thấy phiếu chuyển")
    return _phieu_chuyen_to_dict(p, db)


@router.post("/phieu-chuyen")
def create_phieu_chuyen(
    body: PhieuChuyenCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.items:
        raise HTTPException(400, "Phiếu chuyển phải có ít nhất 1 dòng hàng")
    if body.warehouse_xuat_id == body.warehouse_nhap_id:
        raise HTTPException(400, "Kho xuất và kho nhận phải khác nhau")

    wh_xuat = db.get(Warehouse, body.warehouse_xuat_id)
    wh_nhap = db.get(Warehouse, body.warehouse_nhap_id)
    if not wh_xuat or not wh_nhap:
        raise HTTPException(404, "Không tìm thấy kho")

    # Validate tồn tại kho xuất
    for it in body.items:
        balance = _get_or_create_balance(db, body.warehouse_xuat_id, it.paper_material_id, it.other_material_id, it.ten_hang, it.don_vi)
        if balance.ton_luong < it.so_luong:
            raise HTTPException(400, f"Không đủ tồn tại kho xuất: {it.ten_hang} — cần {float(it.so_luong):g}, còn {float(balance.ton_luong):g}")

    phieu = PhieuChuyenKho(
        so_phieu=_gen_so_phieu(db, "CK"),
        warehouse_xuat_id=body.warehouse_xuat_id,
        warehouse_nhap_id=body.warehouse_nhap_id,
        ngay=body.ngay,
        ghi_chu=body.ghi_chu,
        created_by=current_user.id,
    )
    db.add(phieu)
    db.flush()

    for it in body.items:
        ten_hang = it.ten_hang
        don_vi = it.don_vi
        if it.paper_material_id:
            mat = db.get(PaperMaterial, it.paper_material_id)
            if mat:
                ten_hang = mat.ten
                don_vi = mat.dvt
        elif it.other_material_id:
            mat = db.get(OtherMaterial, it.other_material_id)
            if mat:
                ten_hang = mat.ten
                don_vi = mat.dvt

        item = PhieuChuyenKhoItem(
            phieu_chuyen_kho_id=phieu.id,
            paper_material_id=it.paper_material_id,
            other_material_id=it.other_material_id,
            ten_hang=ten_hang,
            don_vi=don_vi,
            so_luong=it.so_luong,
            don_gia=it.don_gia,
            ghi_chu=it.ghi_chu,
        )
        db.add(item)

        # Atomic: xuất kho nguồn + nhập kho đích
        bal_xuat = _get_or_create_balance(db, body.warehouse_xuat_id, it.paper_material_id, it.other_material_id, ten_hang, don_vi)
        don_gia_xuat = bal_xuat.don_gia_binh_quan
        _xuat_balance(bal_xuat, it.so_luong, ten_hang)
        _ghi_transaction(db, body.warehouse_xuat_id, "chuyen_xuat",
                         it.paper_material_id, it.other_material_id,
                         it.so_luong, don_gia_xuat, bal_xuat.ton_luong,
                         "phieu_chuyen_kho", phieu.id, current_user.id, it.ghi_chu)

        bal_nhap = _get_or_create_balance(db, body.warehouse_nhap_id, it.paper_material_id, it.other_material_id, ten_hang, don_vi)
        _nhap_balance(bal_nhap, it.so_luong, don_gia_xuat)
        _ghi_transaction(db, body.warehouse_nhap_id, "chuyen_nhap",
                         it.paper_material_id, it.other_material_id,
                         it.so_luong, don_gia_xuat, bal_nhap.ton_luong,
                         "phieu_chuyen_kho", phieu.id, current_user.id, it.ghi_chu)

    db.commit()
    db.refresh(phieu)
    return _phieu_chuyen_to_dict(phieu, db)


@router.delete("/phieu-chuyen/{phieu_id}")
def delete_phieu_chuyen(phieu_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    p = db.query(PhieuChuyenKho).options(joinedload(PhieuChuyenKho.items)).filter(PhieuChuyenKho.id == phieu_id).first()
    if not p:
        raise HTTPException(404, "Không tìm thấy phiếu chuyển")
    if p.trang_thai != "nhap":
        raise HTTPException(400, "Chỉ được xoá phiếu ở trạng thái Nhập")
    for it in p.items:
        bal_xuat = _get_or_create_balance(db, p.warehouse_xuat_id, it.paper_material_id, it.other_material_id, it.ten_hang, it.don_vi)
        bal_xuat.ton_luong += it.so_luong
        bal_xuat.gia_tri_ton = bal_xuat.ton_luong * bal_xuat.don_gia_binh_quan
        bal_xuat.cap_nhat_luc = datetime.utcnow()

        bal_nhap = _get_or_create_balance(db, p.warehouse_nhap_id, it.paper_material_id, it.other_material_id, it.ten_hang, it.don_vi)
        bal_nhap.ton_luong = max(Decimal("0"), bal_nhap.ton_luong - it.so_luong)
        bal_nhap.gia_tri_ton = bal_nhap.ton_luong * bal_nhap.don_gia_binh_quan
        bal_nhap.cap_nhat_luc = datetime.utcnow()
    db.delete(p)
    db.commit()
    return {"ok": True}


def _phieu_chuyen_to_dict(p: PhieuChuyenKho, db: Session) -> dict:
    wh_x = db.get(Warehouse, p.warehouse_xuat_id)
    wh_n = db.get(Warehouse, p.warehouse_nhap_id)
    return {
        "id": p.id,
        "so_phieu": p.so_phieu,
        "warehouse_xuat_id": p.warehouse_xuat_id,
        "ten_kho_xuat": wh_x.ten_kho if wh_x else "",
        "warehouse_nhap_id": p.warehouse_nhap_id,
        "ten_kho_nhap": wh_n.ten_kho if wh_n else "",
        "ngay": str(p.ngay),
        "ghi_chu": p.ghi_chu,
        "trang_thai": p.trang_thai,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "items": [_item_to_dict(i) for i in p.items],
    }


# ── Lịch sử giao dịch ─────────────────────────────────────────────────────────

@router.get("/giao-dich")
def get_giao_dich(
    warehouse_id: Optional[int] = Query(None),
    paper_material_id: Optional[int] = Query(None),
    other_material_id: Optional[int] = Query(None),
    loai_giao_dich: Optional[str] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(InventoryTransaction)
    if warehouse_id:
        q = q.filter(InventoryTransaction.warehouse_id == warehouse_id)
    if paper_material_id:
        q = q.filter(InventoryTransaction.paper_material_id == paper_material_id)
    if other_material_id:
        q = q.filter(InventoryTransaction.other_material_id == other_material_id)
    if loai_giao_dich:
        q = q.filter(InventoryTransaction.loai_giao_dich == loai_giao_dich)
    if tu_ngay:
        q = q.filter(InventoryTransaction.ngay_giao_dich >= tu_ngay)
    if den_ngay:
        q = q.filter(InventoryTransaction.ngay_giao_dich <= den_ngay)
    rows = q.order_by(InventoryTransaction.ngay_giao_dich.desc()).limit(limit).all()
    return [{
        "id": r.id,
        "ngay_giao_dich": r.ngay_giao_dich.isoformat() if r.ngay_giao_dich else None,
        "warehouse_id": r.warehouse_id,
        "paper_material_id": r.paper_material_id,
        "other_material_id": r.other_material_id,
        "loai_giao_dich": r.loai_giao_dich,
        "so_luong": float(r.so_luong),
        "don_gia": float(r.don_gia),
        "gia_tri": float(r.gia_tri),
        "ton_sau_giao_dich": float(r.ton_sau_giao_dich),
        "chung_tu_loai": r.chung_tu_loai,
        "chung_tu_id": r.chung_tu_id,
        "ghi_chu": r.ghi_chu,
    } for r in rows]
