from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, get_admin_user
from app.models.auth import User
from app.models.tai_khoan_ngam_dinh import TaiKhoanNgamDinh

router = APIRouter(prefix="/api/tai-khoan-ngam-dinh", tags=["tai-khoan-ngam-dinh"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class TaiKhoanNgamDinhUpdate(BaseModel):
    so_tk: str | None = None
    ghi_chu: str | None = None
    # ma_loai và ten_loai là dữ liệu hệ thống, người dùng không được đổi


class TaiKhoanNgamDinhBulkItem(BaseModel):
    id: int
    so_tk: str | None = None


class TaiKhoanNgamDinhResponse(BaseModel):
    id: int
    ma_loai: str
    ten_loai: str
    nhom: str
    so_tk: str | None
    ghi_chu: str | None

    class Config:
        from_attributes = True


# ─── Seed data ───────────────────────────────────────────────────────────────
# (nhom, ma_loai, ten_loai, so_tk_default)
DEFAULT_ACCOUNTS: list[tuple[str, str, str, str]] = [
    ("ban_hang", "doanh_thu_ban_hang", "Doanh thu bán hàng", "511"),
    ("ban_hang", "doanh_thu_hang_bi_tra_lai", "Doanh thu hàng bị trả lại", "5211"),
    ("ban_hang", "chiet_khau_thuong_mai", "Chiết khấu thương mại", "5212"),
    ("ban_hang", "giam_gia_hang_ban", "Giảm giá hàng bán", "5213"),
    ("ban_hang", "gia_von_hang_ban", "Giá vốn hàng bán", "632"),
    ("ban_hang", "phai_thu_khach_hang", "Phải thu khách hàng", "131"),
    ("mua_hang", "hang_ton_kho_nvl", "Hàng tồn kho — Nguyên vật liệu", "152"),
    ("mua_hang", "hang_ton_kho_tp", "Hàng tồn kho — Thành phẩm", "155"),
    ("mua_hang", "hang_ton_kho_ccdc", "Công cụ dụng cụ", "153"),
    ("mua_hang", "phai_tra_nha_cung_cap", "Phải trả nhà cung cấp", "331"),
    ("tien_te", "tien_mat", "Tiền mặt", "111"),
    ("tien_te", "tien_gui_ngan_hang", "Tiền gửi ngân hàng", "112"),
    ("thue", "thue_gtgt_dau_ra", "Thuế GTGT đầu ra", "33311"),
    ("thue", "thue_gtgt_dau_vao", "Thuế GTGT đầu vào được khấu trừ", "13311"),
    ("thue", "thue_tncn_phai_nop", "Thuế TNCN phải nộp", "3335"),
    ("chi_phi", "chi_phi_ban_hang", "Chi phí bán hàng", "641"),
    ("chi_phi", "chi_phi_quan_ly", "Chi phí quản lý doanh nghiệp", "642"),
    ("chi_phi", "chi_phi_tai_chinh", "Chi phí tài chính", "635"),
    ("san_xuat", "chi_phi_nvl_truc_tiep", "Chi phí NVL trực tiếp", "621"),
    ("san_xuat", "chi_phi_nhan_cong", "Chi phí nhân công trực tiếp", "622"),
    ("san_xuat", "chi_phi_san_xuat_chung", "Chi phí sản xuất chung", "627"),
    ("san_xuat", "chi_phi_sx_do_dang", "Chi phí sản xuất dở dang", "154"),
]


# ─── Endpoints ───────────────────────────────────────────────────────────────
# Lưu ý thứ tự: các route literal ("/seed", "/bulk-update") phải khai báo TRƯỚC
# route "/{id}" để FastAPI không cố ép "seed"/"bulk-update" thành int → 422.

@router.get("", response_model=list[TaiKhoanNgamDinhResponse])
def list_tai_khoan_ngam_dinh(
    nhom: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(TaiKhoanNgamDinh)
    if nhom:
        query = query.filter(TaiKhoanNgamDinh.nhom == nhom)
    return query.order_by(TaiKhoanNgamDinh.nhom, TaiKhoanNgamDinh.ma_loai).all()


@router.get("/seed")
def seed_tai_khoan_ngam_dinh(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """Seed dữ liệu mặc định nếu bảng đang rỗng (chỉ admin)."""
    existing = db.query(TaiKhoanNgamDinh).count()
    if existing > 0:
        return {"skipped": True}

    for nhom, ma_loai, ten_loai, so_tk in DEFAULT_ACCOUNTS:
        db.add(
            TaiKhoanNgamDinh(
                nhom=nhom,
                ma_loai=ma_loai,
                ten_loai=ten_loai,
                so_tk=so_tk,
            )
        )
    db.commit()
    return {"seeded": len(DEFAULT_ACCOUNTS)}


@router.post("/bulk-update", response_model=list[TaiKhoanNgamDinhResponse])
def bulk_update_tai_khoan_ngam_dinh(
    items: list[TaiKhoanNgamDinhBulkItem],
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Cập nhật so_tk cho nhiều bản ghi cùng lúc (dùng cho nút 'Lưu tất cả')."""
    if not items:
        return []

    ids = [it.id for it in items]
    rows = db.query(TaiKhoanNgamDinh).filter(TaiKhoanNgamDinh.id.in_(ids)).all()
    row_by_id = {r.id: r for r in rows}

    missing = [i for i in ids if i not in row_by_id]
    if missing:
        raise HTTPException(
            status_code=404,
            detail=f"Không tìm thấy tài khoản ngầm định với id: {missing}",
        )

    for it in items:
        row_by_id[it.id].so_tk = it.so_tk

    db.commit()

    # Trả về theo đúng tập id được gửi lên, giữ thứ tự yêu cầu
    for r in rows:
        db.refresh(r)
    return [row_by_id[i] for i in ids]


@router.get("/{id}", response_model=TaiKhoanNgamDinhResponse)
def get_tai_khoan_ngam_dinh(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(TaiKhoanNgamDinh).filter(TaiKhoanNgamDinh.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản ngầm định")
    return obj


@router.put("/{id}", response_model=TaiKhoanNgamDinhResponse)
def update_tai_khoan_ngam_dinh(
    id: int,
    data: TaiKhoanNgamDinhUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(TaiKhoanNgamDinh).filter(TaiKhoanNgamDinh.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản ngầm định")

    # Chỉ cho phép sửa so_tk và ghi_chu — ma_loai/ten_loai/nhom là dữ liệu hệ thống.
    # exclude_unset: chỉ ghi đè field client thực sự gửi lên (PATCH-like semantics).
    patch = data.model_dump(exclude_unset=True)
    for k, v in patch.items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj
