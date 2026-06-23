"""Router quản lý Phiên sản xuất (Production Session).

Cung cấp đầy đủ các API theo kế hoạch:
  POST   /api/warehouse/production-sessions                 — Tạo phiên mới
  GET    /api/warehouse/production-sessions                 — Danh sách phiên
  GET    /api/warehouse/production-sessions/{id}            — Chi tiết phiên
  POST   /api/warehouse/production-sessions/{id}/assign-phieu-song — Gán phiếu phôi sóng vào phiên
  POST   /api/warehouse/production-sessions/{id}/unassign-phieu-song — Bỏ gán phiếu phôi sóng
  PATCH  /api/warehouse/production-sessions/{id}/wastes     — Cập nhật hao hụt giấy theo sóng
  PATCH  /api/warehouse/production-sessions/{id}/materials  — Cập nhật NVL phụ tiêu hao
  GET    /api/warehouse/production-sessions/{id}/preview-allocate — Xem trước phân bổ chi phí
  POST   /api/warehouse/production-sessions/{id}/close      — Chốt phiên
  GET    /api/warehouse/production-sessions/active          — Phiên đang hoạt động theo phân xưởng
"""
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import OtherMaterial, PhanXuong
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.production import (
    ProductionSession,
    ProductionSessionMaterial,
    ProductionSessionPaperWaste,
    ProductionSessionRoll,
    ProductionOrderItem,
)
from app.models.warehouse_doc import GiayRoll
from app.models.master import PaperMaterial
from app.models.inventory import InventoryBalance

router = APIRouter(prefix="/api/warehouse/production-sessions", tags=["production-sessions"])


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic Schemas
# ─────────────────────────────────────────────────────────────────────────────

class SessionCreateIn(BaseModel):
    ten_phien: str
    ngay_tao: Optional[date] = None
    phan_xuong_id: Optional[int] = None
    ghi_chu: Optional[str] = None


class AssignPhieuSongIn(BaseModel):
    phieu_ids: list[int]


class WasteItemIn(BaseModel):
    flute_type: str          # B | C | E | A | CHUNG
    so_kg_hao_hut: float


class WastesUpdateIn(BaseModel):
    wastes: list[WasteItemIn]


class MaterialItemIn(BaseModel):
    other_material_id: int
    so_luong: float
    don_gia: float = 0.0     # 0 = tự động tìm giá bình quân


class MaterialsUpdateIn(BaseModel):
    materials: list[MaterialItemIn]


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _session_summary(s: ProductionSession) -> dict:
    """Trả về dict tóm tắt của một phiên — dùng trong list view."""
    return {
        "id": s.id,
        "ten_phien": s.ten_phien,
        "ngay_tao": s.ngay_tao.isoformat() if s.ngay_tao else None,
        "trang_thai": s.trang_thai,
        "phan_xuong_id": s.phan_xuong_id,
        "phan_xuong_ten": s.phan_xuong.ten_xuong if s.phan_xuong else None,
        "so_cuon": len(s.rolls),
        "so_phieu": len(s.phieu_nhap_phoi_songs),
        "created_by": s.created_by,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "closed_at": s.closed_at.isoformat() if s.closed_at else None,
    }


def _roll_detail(r: ProductionSessionRoll) -> dict:
    roll = r.giay_roll
    pm = roll.paper_material if roll else None
    return {
        "id": r.id,
        "giay_roll_id": r.giay_roll_id,
        "barcode": roll.barcode if roll else None,
        "paper_material_id": pm.id if pm else None,
        "ten_nvl": pm.ten_viet_tat or pm.ten if pm else None,
        "kho": float(pm.kho) if pm and pm.kho else None,
        "dinh_luong": float(pm.dinh_luong) if pm and pm.dinh_luong else None,
        "trong_luong_dau": float(r.trong_luong_dau),
        "trong_luong_cuoi": float(r.trong_luong_cuoi) if r.trong_luong_cuoi is not None else None,
        "trong_luong_tieu_hao": float(r.trong_luong_tieu_hao) if r.trong_luong_tieu_hao is not None else None,
        "ngay_can": r.ngay_can.isoformat() if r.ngay_can else None,
    }


def _phieu_detail(p: PhieuNhapPhoiSong) -> dict:
    items = []
    for it in p.items:
        poi: ProductionOrderItem = it.production_order_item
        items.append({
            "id": it.id,
            "production_order_item_id": it.production_order_item_id,
            "ten_hang": poi.ten_hang if poi else None,
            "so_lop": poi.so_lop if poi else None,
            "chieu_kho": float(it.chieu_kho) if it.chieu_kho else None,
            "chieu_cat": float(it.chieu_cat) if it.chieu_cat else None,
            "so_luong_ke_hoach": float(it.so_luong_ke_hoach),
            "so_luong_thuc_te": float(it.so_luong_thuc_te) if it.so_luong_thuc_te else None,
        })
    return {
        "id": p.id,
        "so_phieu": p.so_phieu,
        "ngay": p.ngay.isoformat() if p.ngay else None,
        "ca": p.ca,
        "production_order_id": p.production_order_id,
        "items": items,
    }


def _get_don_gia_binh_quan(db: Session, other_material_id: int) -> Decimal:
    """Lấy giá bình quân của NVL phụ từ bảng inventory_balances."""
    row = db.query(InventoryBalance).filter(
        InventoryBalance.other_material_id == other_material_id,
    ).order_by(InventoryBalance.id.desc()).first()
    if row and row.don_gia_binh_quan:
        return row.don_gia_binh_quan
    return Decimal("0")


def _layer_coeff(so_lop: int | None) -> int:
    """Hệ số quy đổi lớp: 3L→1, 5L→2, 7L→3."""
    if so_lop in (5,):
        return 2
    if so_lop in (7,):
        return 3
    return 1  # mặc định 3 lớp hoặc không rõ


# ─────────────────────────────────────────────────────────────────────────────
# API: Tạo phiên mới
# ─────────────────────────────────────────────────────────────────────────────

@router.post("", status_code=201)
def create_session(
    body: SessionCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tạo một Phiên sản xuất mới."""
    session = ProductionSession(
        ten_phien=body.ten_phien,
        ngay_tao=body.ngay_tao or date.today(),
        trang_thai="dang_chay",
        phan_xuong_id=body.phan_xuong_id,
        created_by=current_user.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"id": session.id, "ten_phien": session.ten_phien, "trang_thai": session.trang_thai}


# ─────────────────────────────────────────────────────────────────────────────
# API: Danh sách phiên
# ─────────────────────────────────────────────────────────────────────────────

@router.get("")
def list_sessions(
    trang_thai: Optional[str] = Query(None, description="dang_chay | cho_phan_bo | da_chot"),
    phan_xuong_id: Optional[int] = Query(None),
    ngay_tu: Optional[date] = Query(None),
    ngay_den: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(ProductionSession).options(
        joinedload(ProductionSession.phan_xuong),
        selectinload(ProductionSession.rolls),
        selectinload(ProductionSession.phieu_nhap_phoi_songs),
    )
    if trang_thai:
        q = q.filter(ProductionSession.trang_thai == trang_thai)
    if phan_xuong_id:
        q = q.filter(ProductionSession.phan_xuong_id == phan_xuong_id)
    if ngay_tu:
        q = q.filter(ProductionSession.ngay_tao >= ngay_tu)
    if ngay_den:
        q = q.filter(ProductionSession.ngay_tao <= ngay_den)

    total = q.count()
    items = q.order_by(ProductionSession.ngay_tao.desc(), ProductionSession.id.desc()) \
             .offset((page - 1) * page_size).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_session_summary(s) for s in items],
    }


# ─────────────────────────────────────────────────────────────────────────────
# API: Phiên đang hoạt động theo phân xưởng
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/active")
def get_active_sessions(
    phan_xuong_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy danh sách phiên đang chạy (trang_thai='dang_chay'), có thể lọc theo phân xưởng."""
    q = db.query(ProductionSession).options(
        joinedload(ProductionSession.phan_xuong),
        selectinload(ProductionSession.rolls),
        selectinload(ProductionSession.phieu_nhap_phoi_songs),
    ).filter(ProductionSession.trang_thai == "dang_chay")
    if phan_xuong_id:
        q = q.filter(ProductionSession.phan_xuong_id == phan_xuong_id)
    sessions = q.order_by(ProductionSession.ngay_tao.desc()).all()
    return [_session_summary(s) for s in sessions]


# ─────────────────────────────────────────────────────────────────────────────
# API: Chi tiết phiên
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{session_id}")
def get_session_detail(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy chi tiết đầy đủ một phiên sản xuất."""
    session = db.query(ProductionSession).options(
        joinedload(ProductionSession.phan_xuong),
        selectinload(ProductionSession.rolls).options(
            joinedload(ProductionSessionRoll.giay_roll).options(
                joinedload(GiayRoll.paper_material)
            )
        ),
        selectinload(ProductionSession.materials).options(
            joinedload(ProductionSessionMaterial.other_material)
        ),
        selectinload(ProductionSession.paper_wastes),
        selectinload(ProductionSession.phieu_nhap_phoi_songs).options(
            selectinload(PhieuNhapPhoiSong.items).options(
                joinedload(PhieuNhapPhoiSongItem.production_order_item)
            )
        ),
    ).filter(ProductionSession.id == session_id).first()

    if not session:
        raise HTTPException(404, "Không tìm thấy phiên sản xuất")

    import json
    allocation_detail = None
    if session.allocation_detail:
        try:
            allocation_detail = json.loads(session.allocation_detail)
        except Exception:
            allocation_detail = None

    return {
        **_session_summary(session),
        "rolls": [_roll_detail(r) for r in session.rolls],
        "materials": [
            {
                "id": m.id,
                "other_material_id": m.other_material_id,
                "ten_nvl": m.other_material.ten if m.other_material else None,
                "so_luong": float(m.so_luong),
                "don_gia": float(m.don_gia),
                "thanh_tien": float(m.thanh_tien),
            }
            for m in session.materials
        ],
        "paper_wastes": [
            {
                "id": w.id,
                "flute_type": w.flute_type,
                "so_kg_hao_hut": float(w.so_kg_hao_hut),
            }
            for w in session.paper_wastes
        ],
        "phieu_nhap_phoi_songs": [_phieu_detail(p) for p in session.phieu_nhap_phoi_songs],
        "allocation_detail": allocation_detail,
    }


# ─────────────────────────────────────────────────────────────────────────────
# API: Gán phiếu nhập phôi sóng vào phiên
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{session_id}/assign-phieu-song")
def assign_phieu_song(
    session_id: int,
    body: AssignPhieuSongIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Gán (hoặc re-assign) một danh sách phiếu nhập phôi sóng vào phiên này."""
    session = db.get(ProductionSession, session_id)
    if not session:
        raise HTTPException(404, "Không tìm thấy phiên sản xuất")
    if session.trang_thai == "da_chot":
        raise HTTPException(400, "Phiên đã chốt, không thể thay đổi")

    assigned = []
    for phieu_id in body.phieu_ids:
        phieu = db.get(PhieuNhapPhoiSong, phieu_id)
        if not phieu:
            continue
        # Kiểm tra phiếu chưa bị chốt bởi phiên khác
        if phieu.session_id and phieu.session_id != session_id:
            other = db.get(ProductionSession, phieu.session_id)
            if other and other.trang_thai == "da_chot":
                raise HTTPException(
                    400,
                    f"Phiếu {phieu.so_phieu} đã được chốt trong phiên #{phieu.session_id}",
                )
        phieu.session_id = session_id
        assigned.append(phieu_id)

    db.commit()
    return {"assigned": assigned, "session_id": session_id}


# ─────────────────────────────────────────────────────────────────────────────
# API: Bỏ gán phiếu nhập phôi sóng
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{session_id}/unassign-phieu-song")
def unassign_phieu_song(
    session_id: int,
    body: AssignPhieuSongIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bỏ gán phiếu nhập phôi sóng khỏi phiên (chuyển session_id về NULL)."""
    session = db.get(ProductionSession, session_id)
    if not session:
        raise HTTPException(404, "Không tìm thấy phiên sản xuất")
    if session.trang_thai == "da_chot":
        raise HTTPException(400, "Phiên đã chốt, không thể thay đổi")

    removed = []
    for phieu_id in body.phieu_ids:
        phieu = db.get(PhieuNhapPhoiSong, phieu_id)
        if phieu and phieu.session_id == session_id:
            phieu.session_id = None
            removed.append(phieu_id)

    db.commit()
    return {"removed": removed}


# ─────────────────────────────────────────────────────────────────────────────
# API: Cập nhật hao hụt giấy theo loại sóng
# ─────────────────────────────────────────────────────────────────────────────

@router.patch("/{session_id}/wastes")
def update_wastes(
    session_id: int,
    body: WastesUpdateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cập nhật bảng hao hụt giấy chi tiết theo loại sóng cho phiên."""
    session = db.get(ProductionSession, session_id)
    if not session:
        raise HTTPException(404, "Không tìm thấy phiên sản xuất")
    if session.trang_thai == "da_chot":
        raise HTTPException(400, "Phiên đã chốt, không thể thay đổi")

    # Xóa dữ liệu cũ rồi insert lại (upsert đơn giản)
    db.query(ProductionSessionPaperWaste).filter(
        ProductionSessionPaperWaste.session_id == session_id
    ).delete()

    for item in body.wastes:
        w = ProductionSessionPaperWaste(
            session_id=session_id,
            flute_type=item.flute_type.upper(),
            so_kg_hao_hut=Decimal(str(item.so_kg_hao_hut)),
        )
        db.add(w)

    db.commit()
    return {"ok": True, "session_id": session_id, "waste_count": len(body.wastes)}


# ─────────────────────────────────────────────────────────────────────────────
# API: Cập nhật NVL phụ tiêu hao
# ─────────────────────────────────────────────────────────────────────────────

@router.patch("/{session_id}/materials")
def update_materials(
    session_id: int,
    body: MaterialsUpdateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cập nhật danh sách NVL phụ tiêu hao (keo, bột mỳ, sút...) trong phiên."""
    session = db.get(ProductionSession, session_id)
    if not session:
        raise HTTPException(404, "Không tìm thấy phiên sản xuất")
    if session.trang_thai == "da_chot":
        raise HTTPException(400, "Phiên đã chốt, không thể thay đổi")

    db.query(ProductionSessionMaterial).filter(
        ProductionSessionMaterial.session_id == session_id
    ).delete()

    for item in body.materials:
        don_gia = Decimal(str(item.don_gia))
        if don_gia == 0:
            don_gia = _get_don_gia_binh_quan(db, item.other_material_id)
        so_luong = Decimal(str(item.so_luong))
        thanh_tien = so_luong * don_gia
        m = ProductionSessionMaterial(
            session_id=session_id,
            other_material_id=item.other_material_id,
            so_luong=so_luong,
            don_gia=don_gia,
            thanh_tien=thanh_tien,
        )
        db.add(m)

    db.commit()
    return {"ok": True, "session_id": session_id, "material_count": len(body.materials)}


# ─────────────────────────────────────────────────────────────────────────────
# Thuật toán Phân bổ (dùng nội bộ cho cả preview và close)
# ─────────────────────────────────────────────────────────────────────────────

def _compute_allocation(session: ProductionSession, db: Session) -> dict:
    """
    Tính phân bổ chi phí giấy + NVL phụ cho phiên sản xuất.

    Trả về dict chứa:
      - rolls_by_material: tổng tiêu hao giấy theo loại vật liệu
      - allocation_by_lsx: chi phí phân bổ về từng LSX item (production_order_item_id)
      - total_material_cost: tổng chi phí NVL phụ
      - nvl_by_lsx: chi phí NVL phụ phân bổ về từng LSX
      - errors: danh sách cảnh báo
    """
    errors = []
    from app.models.bom import ProductionBOM, ProductionBOMItem
    from app.models.layer_allocation_coefficient import LayerAllocationCoefficient

    # ── 1. Gom tất cả LSX tham gia phiên và load BOM (Ràng buộc kiểm tra BOM - Phương án A) ──
    lsx_list: list[ProductionOrderItem] = []
    for p in session.phieu_nhap_phoi_songs:
        for it in p.items:
            poi = it.production_order_item
            if poi and poi not in lsx_list:
                lsx_list.append(poi)

    lsx_bom_map: dict[int, list[ProductionBOMItem]] = {}
    for lsx in lsx_list:
        bom = db.query(ProductionBOM).filter(
            ProductionBOM.production_order_item_id == lsx.id,
            ProductionBOM.trang_thai == "confirmed"
        ).order_by(ProductionBOM.id.desc()).first()
        if bom:
            bom_items = db.query(ProductionBOMItem).filter(ProductionBOMItem.bom_id == bom.id).all()
            lsx_bom_map[lsx.id] = bom_items
        else:
            errors.append(f"Lệnh sản xuất '{lsx.ten_hang}' (ID {lsx.id}) chưa có định mức BOM được duyệt")

    # Tạo map ma_ky_hieu -> pm_id từ các cuộn giấy trong phiên
    ma_ky_hieu_to_pm_id: dict[str, int] = {}
    for sr in session.rolls:
        roll = sr.giay_roll
        if roll and roll.paper_material_id:
            pm = roll.paper_material
            if pm and pm.ma_ky_hieu:
                ma_ky_hieu_to_pm_id[pm.ma_ky_hieu.strip().upper()] = roll.paper_material_id

    # Kiểm tra cuộn giấy tiêu hao có khớp với BOM không
    for sr in session.rolls:
        roll = sr.giay_roll
        if not roll or not roll.paper_material_id:
            continue
        pm = roll.paper_material
        if not pm or not pm.ma_ky_hieu:
            errors.append(f"Cuộn giấy {roll.barcode} chưa có thông tin mã ký hiệu vật liệu")
            continue
        ma_ky_hieu = pm.ma_ky_hieu.strip().upper()
        
        found = False
        for bom_items in lsx_bom_map.values():
            for bi in bom_items:
                if bi.ma_ky_hieu and bi.ma_ky_hieu.strip().upper() == ma_ky_hieu:
                    found = True
                    break
            if found:
                break
        if not found:
            errors.append(f"Cuộn giấy {roll.barcode} (loại {pm.ten_viet_tat or pm.ten}) không có trong định mức BOM của các LSX thuộc phiên này")

    # Load hệ số sóng từ DB
    coeffs = db.query(LayerAllocationCoefficient).all()
    coeff_map: dict[tuple[str, str | None], Decimal] = {
        (c.loai_lop, c.flute_type): c.he_so for c in coeffs
    }

    def _he_so(loai_lop: str, flute_type: str | None) -> float:
        return float(coeff_map.get((loai_lop, flute_type), Decimal("1.0")))

    # ── 2. Thu thập tiêu hao giấy theo paper_material_id ───────────────────
    rolls_by_pm: dict[int, dict] = {}   # pm_id → {ten, tieu_hao_kg, don_gia, flute_types_used}
    for sr in session.rolls:
        roll = sr.giay_roll
        if not roll or not roll.paper_material_id:
            continue
        pm_id = roll.paper_material_id
        tieu_hao = float(sr.trong_luong_tieu_hao or 0)
        if tieu_hao <= 0:
            continue
        if pm_id not in rolls_by_pm:
            pm = roll.paper_material
            # Lấy đơn giá bình quân từ inventory_balance
            bal = db.query(InventoryBalance).filter(
                InventoryBalance.paper_material_id == pm_id,
            ).order_by(InventoryBalance.id.desc()).first()
            don_gia = float(bal.don_gia_binh_quan or 0) if bal else 0
            rolls_by_pm[pm_id] = {
                "pm_id": pm_id,
                "ten": pm.ten_viet_tat or pm.ten if pm else f"PM#{pm_id}",
                "tieu_hao_kg": 0.0,
                "don_gia": don_gia,
                "chi_phi": 0.0,
            }
        rolls_by_pm[pm_id]["tieu_hao_kg"] += tieu_hao

    # ── 3. Phân bổ hao hụt giấy cộng gộp (chia đều theo tỷ lệ tiêu hao) ───
    total_tieu_hao = sum(v["tieu_hao_kg"] for v in rolls_by_pm.values())
    total_hao_hut = sum(float(w.so_kg_hao_hut) for w in session.paper_wastes)
    total_hao_hut += float(session.so_kg_hao_hut_chung or 0)

    if total_tieu_hao > 0 and total_hao_hut > 0:
        for pm_id, info in rolls_by_pm.items():
            ty_le = info["tieu_hao_kg"] / total_tieu_hao
            info["tieu_hao_kg"] += total_hao_hut * ty_le   # cộng hao hụt phân bổ

    # Tính chi phí giấy cho mỗi loại PM
    for info in rolls_by_pm.values():
        info["chi_phi"] = info["tieu_hao_kg"] * info["don_gia"]

    # ── 4. Thu thập sản lượng phôi thực tế từ phiếu nhập phôi sóng ─────────
    # Tính diện tích giấy thực tế của từng LSX item trong phiên
    # Key: production_order_item_id → {ten_hang, so_lop, dien_tich_m2, dien_tich_quy_doi}
    lsx_items: dict[int, dict] = {}
    
    for phieu in session.phieu_nhap_phoi_songs:
        for it in phieu.items:
            poi = it.production_order_item
            if not poi:
                continue
            sl = float(it.so_luong_thuc_te or it.so_luong_ke_hoach or 0)
            kho = float(it.chieu_kho or 0)
            cat = float(it.chieu_cat or 0)
            if sl <= 0 or kho <= 0 or cat <= 0:
                continue

            dien_tich = sl * (kho * cat / 10000)      # m²
            
            # Tính hệ số quy đổi keo từ các lớp sóng trong BOM
            glue_factor = 0.0
            bom_items = lsx_bom_map.get(poi.id, [])
            for bi in bom_items:
                if bi.loai_lop == "song":
                    glue_factor += _he_so(bi.loai_lop, bi.flute_type)
            if glue_factor == 0.0:
                glue_factor = float(_layer_coeff(poi.so_lop))
            
            dien_tich_quy_doi = dien_tich * glue_factor

            poi_id = it.production_order_item_id
            if poi_id not in lsx_items:
                lsx_items[poi_id] = {
                    "production_order_item_id": poi_id,
                    "production_order_id": poi.production_order_id,
                    "ten_hang": poi.ten_hang,
                    "so_lop": poi.so_lop,
                    "so_luong": 0.0,
                    "dien_tich_m2": 0.0,
                    "dien_tich_quy_doi": 0.0,
                    "chi_phi_giay": 0.0,
                    "chi_phi_nvl_phu": 0.0,
                    "chi_phi_tong": 0.0,
                    "papers": [],  # Chi tiết giấy phân bổ
                }
            lsx_items[poi_id]["so_luong"] += sl
            lsx_items[poi_id]["dien_tich_m2"] += dien_tich
            lsx_items[poi_id]["dien_tich_quy_doi"] += dien_tich_quy_doi

    # ── 5. Tính trọng số phân bổ giấy lý thuyết (diện tích lý thuyết của từng loại giấy) ──
    # planned_weight: (lsx_id, pm_id) -> trọng số diện tích giấy tiêu hao lý thuyết
    planned_weight: dict[tuple[int, int], float] = {}
    for lsx in lsx_list:
        bom_items = lsx_bom_map.get(lsx.id, [])
        for bi in bom_items:
            ma = (bi.ma_ky_hieu or "").strip().upper()
            if ma in ma_ky_hieu_to_pm_id:
                pm_id = ma_ky_hieu_to_pm_id[ma]
                actual_qty = lsx_items.get(lsx.id, {}).get("so_luong", 0.0)
                area_1con = float(bi.dien_tich_1con or 0)
                if actual_qty > 0 and area_1con > 0:
                    he_so = _he_so(bi.loai_lop, bi.flute_type)
                    w = actual_qty * area_1con * he_so
                    key = (lsx.id, pm_id)
                    planned_weight[key] = planned_weight.get(key, 0.0) + w

    total_weight_by_pm: dict[int, float] = {}
    for (lsx_id, pm_id), w in planned_weight.items():
        total_weight_by_pm[pm_id] = total_weight_by_pm.get(pm_id, 0.0) + w

    # ── 6. Phân bổ chi tiết chi phí của từng loại giấy về các LSX ──
    for pm_id, info in rolls_by_pm.items():
        total_w = total_weight_by_pm.get(pm_id, 0.0)
        pm_chi_phi = info["chi_phi"]
        if total_w > 0:
            for lsx_id in lsx_items:
                w = planned_weight.get((lsx_id, pm_id), 0.0)
                share = w / total_w
                allocated_val = pm_chi_phi * share
                lsx_items[lsx_id]["chi_phi_giay"] += allocated_val
                
                # Lưu chi tiết phân bổ của loại giấy này
                kg_phan_bo = info["tieu_hao_kg"] * share
                lsx_items[lsx_id]["papers"].append({
                    "paper_material_id": pm_id,
                    "ten_nvl": info["ten"],
                    "kg_phan_bo": round(kg_phan_bo, 3),
                    "chi_phi": round(allocated_val, 2),
                })

    # ── 7. Phân bổ chi phí NVL phụ theo diện tích quy đổi ─────────────────
    total_dien_tich_qd = sum(v["dien_tich_quy_doi"] for v in lsx_items.values())
    total_chi_phi_nvl = sum(float(m.thanh_tien) for m in session.materials)

    if total_dien_tich_qd > 0:
        for info in lsx_items.values():
            ty_le = info["dien_tich_quy_doi"] / total_dien_tich_qd
            info["chi_phi_nvl_phu"] = total_chi_phi_nvl * ty_le
    elif lsx_items and total_chi_phi_nvl > 0:
        errors.append("Không có dữ liệu diện tích quy đổi — NVL phụ chưa được phân bổ")

    # Tổng chi phí cho mỗi LSX và làm tròn
    total_chi_phi_giay = 0.0
    for info in lsx_items.values():
        info["chi_phi_tong"] = info["chi_phi_giay"] + info["chi_phi_nvl_phu"]
        info["chi_phi_giay"] = round(info["chi_phi_giay"], 2)
        info["chi_phi_nvl_phu"] = round(info["chi_phi_nvl_phu"], 2)
        info["chi_phi_tong"] = round(info["chi_phi_tong"], 2)
        info["dien_tich_m2"] = round(info["dien_tich_m2"], 4)
        info["dien_tich_quy_doi"] = round(info["dien_tich_quy_doi"], 4)
        total_chi_phi_giay += info["chi_phi_giay"]

    return {
        "rolls_by_material": list(rolls_by_pm.values()),
        "allocation_by_lsx": list(lsx_items.values()),
        "total_tieu_hao_giay_kg": round(total_tieu_hao, 3),
        "total_hao_hut_kg": round(total_hao_hut, 3),
        "total_chi_phi_giay": round(total_chi_phi_giay, 2),
        "total_chi_phi_nvl_phu": round(total_chi_phi_nvl, 2),
        "total_chi_phi_phien": round(total_chi_phi_giay + total_chi_phi_nvl, 2),
        "errors": errors,
    }


# ─────────────────────────────────────────────────────────────────────────────
# API: Xem trước phân bổ
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{session_id}/preview-allocate")
def preview_allocate(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tính toán và trả về bảng phân bổ chi phí dự kiến — không ghi sổ."""
    session = db.query(ProductionSession).options(
        selectinload(ProductionSession.rolls).options(
            joinedload(ProductionSessionRoll.giay_roll).options(
                joinedload(GiayRoll.paper_material)
            )
        ),
        selectinload(ProductionSession.materials).options(
            joinedload(ProductionSessionMaterial.other_material)
        ),
        selectinload(ProductionSession.paper_wastes),
        selectinload(ProductionSession.phieu_nhap_phoi_songs).options(
            selectinload(PhieuNhapPhoiSong.items).options(
                joinedload(PhieuNhapPhoiSongItem.production_order_item)
            )
        ),
    ).filter(ProductionSession.id == session_id).first()

    if not session:
        raise HTTPException(404, "Không tìm thấy phiên sản xuất")

    result = _compute_allocation(session, db)
    return {
        "session_id": session_id,
        "ten_phien": session.ten_phien,
        "trang_thai": session.trang_thai,
        **result,
    }


# ─────────────────────────────────────────────────────────────────────────────
# API: Chốt phiên
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{session_id}/close")
def close_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Chốt phiên sản xuất:
      - Tính phân bổ chi phí lần cuối
      - Cập nhật trang_thai = 'da_chot'
      - Khóa tất cả phiếu nhập phôi sóng liên kết
      - Trả về bảng phân bổ cuối cùng
    Ghi chú: Việc sinh bút toán hạch toán Nợ 154 / Có 152 sẽ được thêm vào ở phase tiếp theo.
    """
    session = db.query(ProductionSession).options(
        selectinload(ProductionSession.rolls).options(
            joinedload(ProductionSessionRoll.giay_roll).options(
                joinedload(GiayRoll.paper_material)
            )
        ),
        selectinload(ProductionSession.materials).options(
            joinedload(ProductionSessionMaterial.other_material)
        ),
        selectinload(ProductionSession.paper_wastes),
        selectinload(ProductionSession.phieu_nhap_phoi_songs).options(
            selectinload(PhieuNhapPhoiSong.items).options(
                joinedload(PhieuNhapPhoiSongItem.production_order_item)
            )
        ),
    ).filter(ProductionSession.id == session_id).first()

    if not session:
        raise HTTPException(404, "Không tìm thấy phiên sản xuất")
    if session.trang_thai == "da_chot":
        raise HTTPException(400, "Phiên này đã được chốt trước đó")

    # Tính phân bổ
    allocation = _compute_allocation(session, db)
    if allocation["errors"]:
        raise HTTPException(400, f"Không thể chốt phiên: {'; '.join(allocation['errors'])}")

    # Cập nhật trạng thái phiên và lưu allocation_detail
    import json
    session.allocation_detail = json.dumps(allocation["allocation_by_lsx"], ensure_ascii=False)
    session.trang_thai = "da_chot"
    session.closed_by = current_user.id
    session.closed_at = datetime.now(timezone.utc)

    # ── Hạch toán Kế toán Hướng 1 ──
    from app.services.accounting_service import AccountingService
    phap_nhan_id = session.phan_xuong.phap_nhan_id if session.phan_xuong else None

    journal_items = []
    for info in allocation["allocation_by_lsx"]:
        chi_phi_tong = float(info["chi_phi_tong"] or 0)
        if chi_phi_tong <= 0:
            continue
        journal_items.append({
            "ten_hang": f"K/C chi phí Phiên #{session.id} về LSX #{info['production_order_id']} - {info['ten_hang']}",
            "so_luong": 1.0,
            "don_gia": chi_phi_tong,
            "tk_no": "154",
            "tk_co": "154",
            "phan_xuong_id_no": None,
            "phan_xuong_id_co": session.phan_xuong_id,
            "phap_nhan_id_no": phap_nhan_id,
            "phap_nhan_id_co": phap_nhan_id,
        })

    if journal_items:
        acc_service = AccountingService(db)
        acc_service.post_inventory_journal(
            ngay=session.ngay_tao,
            loai="XUAT_SX",  # Dùng XUAT_SX để hạch toán sản xuất
            chung_tu_loai="production_sessions",
            chung_tu_id=session.id,
            items=journal_items,
            phap_nhan_id=phap_nhan_id,
            phan_xuong_id=session.phan_xuong_id,
        )

    db.commit()

    return {
        "ok": True,
        "session_id": session_id,
        "message": "Phiên đã được chốt thành công",
        "allocation": allocation,
    }


# ─────────────────────────────────────────────────────────────────────────────
# API: Gợi ý loại sóng từ BOM của các phiếu trong phiên (D1)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{session_id}/suggested-flutes")
def get_suggested_flutes(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trả về danh sách loại sóng (B/C/E/A) từ BOM của các LSX trong phiên."""
    from app.models.bom import ProductionBOM, ProductionBOMItem
    session = db.get(ProductionSession, session_id)
    if not session:
        raise HTTPException(404, "Không tìm thấy phiên sản xuất")

    # Lấy tất cả production_order_item_id từ các phiếu trong phiên
    poi_ids = (
        db.query(PhieuNhapPhoiSongItem.production_order_item_id)
        .join(PhieuNhapPhoiSong, PhieuNhapPhoiSong.id == PhieuNhapPhoiSongItem.phieu_id)
        .filter(PhieuNhapPhoiSong.session_id == session_id)
        .distinct()
        .all()
    )
    poi_id_list = [r[0] for r in poi_ids if r[0]]
    if not poi_id_list:
        return {"flute_types": []}

    # Tìm BOM đã confirm cho các LSX này
    bom_ids = (
        db.query(ProductionBOM.id)
        .filter(
            ProductionBOM.production_order_item_id.in_(poi_id_list),
            ProductionBOM.trang_thai == "confirmed",
        )
        .all()
    )
    bom_id_list = [r[0] for r in bom_ids]
    if not bom_id_list:
        return {"flute_types": []}

    # Lấy flute_type duy nhất từ BOM items là lớp sóng
    rows = (
        db.query(ProductionBOMItem.flute_type)
        .filter(
            ProductionBOMItem.bom_id.in_(bom_id_list),
            ProductionBOMItem.loai_lop == "song",
            ProductionBOMItem.flute_type.isnot(None),
        )
        .distinct()
        .all()
    )
    flute_types = sorted({r[0] for r in rows if r[0]})
    return {"flute_types": flute_types}


# ─────────────────────────────────────────────────────────────────────────────
# API: Vật tư phụ mặc định pha keo (D2)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{session_id}/default-materials")
def get_default_materials(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trả về danh sách vật tư phụ được đánh dấu là mặc định pha keo."""
    from app.models.master import OtherMaterial
    session = db.get(ProductionSession, session_id)
    if not session:
        raise HTTPException(404, "Không tìm thấy phiên sản xuất")

    materials = (
        db.query(OtherMaterial)
        .filter(OtherMaterial.la_mac_dinh_pha_keo == True, OtherMaterial.trang_thai == True)
        .order_by(OtherMaterial.ten)
        .all()
    )
    return {
        "materials": [
            {"id": m.id, "ten": m.ten, "dvt": m.dvt}
            for m in materials
        ]
    }


# ─────────────────────────────────────────────────────────────────────────────
# API: Đảm bảo tồn tại phiên cho ca hiện tại (D4)
# ─────────────────────────────────────────────────────────────────────────────

class EnsureShiftIn(BaseModel):
    phan_xuong_id: Optional[int] = None


@router.post("/ensure-for-shift", status_code=200)
def ensure_session_for_shift(
    body: EnsureShiftIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tạo hoặc trả về phiên sản xuất cho ca hiện tại (VN UTC+7).
    Ca 1: 06:00–14:00 | Ca 2: 14:00–22:00 | Ca 3: 22:00–06:00.
    """
    import datetime as _dt
    VN_OFFSET = _dt.timezone(_dt.timedelta(hours=7))
    now_vn = _dt.datetime.now(VN_OFFSET)
    hour = now_vn.hour

    if 6 <= hour < 14:
        ca = "Ca 1"
    elif 14 <= hour < 22:
        ca = "Ca 2"
    else:
        ca = "Ca 3"

    today_vn = now_vn.date()

    # Kiểm tra phiên đang active cùng ca/ngày/phan_xuong
    q = db.query(ProductionSession).filter(
        ProductionSession.trang_thai.in_(["dang_chay", "cho_phan_bo"]),
        ProductionSession.ngay_tao == today_vn,
        ProductionSession.ten_phien.like(f"{ca} - %"),
    )
    if body.phan_xuong_id:
        q = q.filter(ProductionSession.phan_xuong_id == body.phan_xuong_id)

    existing = q.first()
    if existing:
        return {"created": False, "session": _session_summary(existing)}

    # Tạo phiên mới
    ten_phien = f"{ca} - {today_vn.strftime('%d/%m/%Y')}"
    new_session = ProductionSession(
        ten_phien=ten_phien,
        ngay_tao=today_vn,
        trang_thai="dang_chay",
        phan_xuong_id=body.phan_xuong_id,
        created_by=current_user.id,
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return {"created": True, "session": _session_summary(new_session)}


# ─────────────────────────────────────────────────────────────────────────────
# API: Gộp hai phiên sản xuất (Merge) (D5)
# ─────────────────────────────────────────────────────────────────────────────

class MergeSessionIn(BaseModel):
    source_session_id: int


@router.post("/{session_id}/merge")
def merge_sessions(
    session_id: int,
    body: MergeSessionIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Gộp source_session vào target session (session_id).
    Di chuyển toàn bộ rolls, phiếu phôi, cộng gộp wastes cùng flute_type.
    """
    target = db.get(ProductionSession, session_id)
    source = db.get(ProductionSession, body.source_session_id)

    if not target:
        raise HTTPException(404, "Không tìm thấy phiên đích")
    if not source:
        raise HTTPException(404, "Không tìm thấy phiên nguồn")
    if target.trang_thai == "da_chot":
        raise HTTPException(400, "Phiên đích đã chốt, không thể gộp")
    if source.trang_thai == "da_chot":
        raise HTTPException(400, "Phiên nguồn đã chốt, không thể gộp")
    if session_id == body.source_session_id:
        raise HTTPException(400, "Không thể gộp phiên với chính nó")

    # Di chuyển rolls
    db.query(ProductionSessionRoll).filter(
        ProductionSessionRoll.session_id == source.id
    ).update({"session_id": target.id})

    # Di chuyển phiếu phôi sóng
    db.query(PhieuNhapPhoiSong).filter(
        PhieuNhapPhoiSong.session_id == source.id
    ).update({"session_id": target.id})

    # Di chuyển materials (cộng gộp nếu trùng other_material_id)
    for src_mat in db.query(ProductionSessionMaterial).filter(
        ProductionSessionMaterial.session_id == source.id
    ).all():
        existing = db.query(ProductionSessionMaterial).filter(
            ProductionSessionMaterial.session_id == target.id,
            ProductionSessionMaterial.other_material_id == src_mat.other_material_id,
        ).first()
        if existing:
            existing.so_luong = Decimal(str(existing.so_luong)) + Decimal(str(src_mat.so_luong))
            existing.thanh_tien = Decimal(str(existing.thanh_tien)) + Decimal(str(src_mat.thanh_tien))
            db.delete(src_mat)
        else:
            src_mat.session_id = target.id

    # Cộng gộp wastes cùng flute_type
    for src_w in db.query(ProductionSessionPaperWaste).filter(
        ProductionSessionPaperWaste.session_id == source.id
    ).all():
        existing_w = db.query(ProductionSessionPaperWaste).filter(
            ProductionSessionPaperWaste.session_id == target.id,
            ProductionSessionPaperWaste.flute_type == src_w.flute_type,
        ).first()
        if existing_w:
            existing_w.so_kg_hao_hut = Decimal(str(existing_w.so_kg_hao_hut)) + Decimal(str(src_w.so_kg_hao_hut))
            db.delete(src_w)
        else:
            src_w.session_id = target.id

    db.delete(source)
    db.commit()
    db.refresh(target)
    return {"ok": True, "message": "Đã gộp phiên thành công", "session_id": target.id}


# ─────────────────────────────────────────────────────────────────────────────
# API: Tách phiên sản xuất (Split) (D6)
# ─────────────────────────────────────────────────────────────────────────────

class SplitSessionIn(BaseModel):
    ten_phien_moi: str
    phieu_ids: list[int] = []
    roll_ids: list[int] = []


@router.post("/{session_id}/split", status_code=201)
def split_session(
    session_id: int,
    body: SplitSessionIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tách một phần phiếu/cuộn sang phiên mới. Phiên mới có wastes/materials rỗng."""
    session = db.get(ProductionSession, session_id)
    if not session:
        raise HTTPException(404, "Không tìm thấy phiên sản xuất")
    if session.trang_thai == "da_chot":
        raise HTTPException(400, "Phiên đã chốt, không thể tách")
    if not body.phieu_ids and not body.roll_ids:
        raise HTTPException(400, "Phải chọn ít nhất 1 phiếu hoặc 1 cuộn để tách")

    import datetime as _dt
    new_session = ProductionSession(
        ten_phien=body.ten_phien_moi,
        ngay_tao=session.ngay_tao,
        trang_thai="dang_chay",
        phan_xuong_id=session.phan_xuong_id,
        created_by=current_user.id,
    )
    db.add(new_session)
    db.flush()  # để có new_session.id

    # Di chuyển phiếu phôi được chọn
    if body.phieu_ids:
        db.query(PhieuNhapPhoiSong).filter(
            PhieuNhapPhoiSong.id.in_(body.phieu_ids),
            PhieuNhapPhoiSong.session_id == session_id,
        ).update({"session_id": new_session.id})

    # Di chuyển cuộn giấy được chọn
    if body.roll_ids:
        db.query(ProductionSessionRoll).filter(
            ProductionSessionRoll.id.in_(body.roll_ids),
            ProductionSessionRoll.session_id == session_id,
        ).update({"session_id": new_session.id})

    db.commit()
    db.refresh(new_session)
    return {
        "ok": True,
        "message": "Đã tách phiên thành công",
        "new_session_id": new_session.id,
        "new_session": _session_summary(new_session),
    }
