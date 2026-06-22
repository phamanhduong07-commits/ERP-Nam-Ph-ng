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

    # ── 1. Thu thập tiêu hao giấy theo paper_material_id ───────────────────
    rolls_by_pm: dict[int, dict] = {}   # pm_id → {ten, tieu_hao_kg, don_gia, flute_types_used}
    for sr in session.rolls:
        roll: GiayRoll = sr.giay_roll
        if not roll or not roll.paper_material_id:
            continue
        pm_id = roll.paper_material_id
        tieu_hao = float(sr.trong_luong_tieu_hao or 0)
        if tieu_hao <= 0:
            continue
        if pm_id not in rolls_by_pm:
            pm: PaperMaterial = roll.paper_material
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

    # ── 2. Phân bổ hao hụt giấy theo loại sóng vào từng loại giấy ─────────
    #   Hiện tại: hao hụt CHUNG được chia tỷ lệ theo trọng lượng tiêu hao
    #   Hao hụt theo sóng (B/C/E...) cũng chia tỷ lệ vì không biết rõ PM nào dùng sóng nào
    #   (tương lai: nếu có mapping flute_type → paper_material thì sẽ chính xác hơn)
    total_tieu_hao = sum(v["tieu_hao_kg"] for v in rolls_by_pm.values())
    total_hao_hut = sum(float(w.so_kg_hao_hut) for w in session.paper_wastes)

    if total_tieu_hao > 0 and total_hao_hut > 0:
        for pm_id, info in rolls_by_pm.items():
            ty_le = info["tieu_hao_kg"] / total_tieu_hao
            info["tieu_hao_kg"] += total_hao_hut * ty_le   # cộng hao hụt phân bổ

    # Tính chi phí giấy cho mỗi loại PM
    for info in rolls_by_pm.values():
        info["chi_phi"] = info["tieu_hao_kg"] * info["don_gia"]

    # ── 3. Thu thập sản lượng phôi thực tế từ phiếu nhập phôi sóng ─────────
    # Tính diện tích giấy thực tế của từng LSX item trong phiên
    # Key: production_order_item_id → {ten_hang, so_lop, dien_tich_m2, dien_tich_quy_doi}
    lsx_items: dict[int, dict] = {}

    # Cần biết mỗi LSX item dùng paper_material nào → phân bổ chi phí giấy đúng loại
    # Lấy qua ProductionOrderItem.song_1, song_2... (sẽ dùng tên vật liệu để match)
    # Để đơn giản + bền vững: phân bổ chi phí giấy theo tỷ lệ diện tích TỔNG HỢP
    # (vì cùng một phiên chạy chủ yếu một loại giấy)

    for phieu in session.phieu_nhap_phoi_songs:
        for it in phieu.items:
            poi: ProductionOrderItem = it.production_order_item
            if not poi:
                continue
            sl = float(it.so_luong_thuc_te or it.so_luong_ke_hoach or 0)
            kho = float(it.chieu_kho or 0)
            cat = float(it.chieu_cat or 0)
            if sl <= 0 or kho <= 0 or cat <= 0:
                continue

            dien_tich = sl * (kho * cat / 10000)      # m²
            k = _layer_coeff(poi.so_lop)
            dien_tich_quy_doi = dien_tich * k          # m² quy đổi 3-lớp

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
                }
            lsx_items[poi_id]["so_luong"] += sl
            lsx_items[poi_id]["dien_tich_m2"] += dien_tich
            lsx_items[poi_id]["dien_tich_quy_doi"] += dien_tich_quy_doi

    # ── 4. Phân bổ chi phí giấy (tổng tất cả PM) theo diện tích m² thực tế ─
    total_dien_tich = sum(v["dien_tich_m2"] for v in lsx_items.values())
    total_chi_phi_giay = sum(v["chi_phi"] for v in rolls_by_pm.values())

    if total_dien_tich > 0:
        for info in lsx_items.values():
            ty_le = info["dien_tich_m2"] / total_dien_tich
            info["chi_phi_giay"] = total_chi_phi_giay * ty_le
    elif lsx_items:
        errors.append("Không có dữ liệu sản lượng thực tế — không thể phân bổ chi phí giấy")

    # ── 5. Phân bổ chi phí NVL phụ theo diện tích quy đổi 3 lớp ───────────
    total_dien_tich_qd = sum(v["dien_tich_quy_doi"] for v in lsx_items.values())
    total_chi_phi_nvl = sum(float(m.thanh_tien) for m in session.materials)

    if total_dien_tich_qd > 0:
        for info in lsx_items.values():
            ty_le = info["dien_tich_quy_doi"] / total_dien_tich_qd
            info["chi_phi_nvl_phu"] = total_chi_phi_nvl * ty_le
    elif lsx_items and total_chi_phi_nvl > 0:
        errors.append("Không có dữ liệu diện tích quy đổi — NVL phụ chưa được phân bổ")

    # Tổng chi phí cho mỗi LSX
    for info in lsx_items.values():
        info["chi_phi_tong"] = info["chi_phi_giay"] + info["chi_phi_nvl_phu"]

    # Làm tròn 2 chữ số thập phân
    for info in lsx_items.values():
        info["chi_phi_giay"] = round(info["chi_phi_giay"], 2)
        info["chi_phi_nvl_phu"] = round(info["chi_phi_nvl_phu"], 2)
        info["chi_phi_tong"] = round(info["chi_phi_tong"], 2)
        info["dien_tich_m2"] = round(info["dien_tich_m2"], 4)
        info["dien_tich_quy_doi"] = round(info["dien_tich_quy_doi"], 4)

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

    # Cập nhật trạng thái phiên
    session.trang_thai = "da_chot"
    session.closed_by = current_user.id
    session.closed_at = datetime.now(timezone.utc)

    db.commit()

    return {
        "ok": True,
        "session_id": session_id,
        "message": "Phiên đã được chốt thành công",
        "allocation": allocation,
    }
