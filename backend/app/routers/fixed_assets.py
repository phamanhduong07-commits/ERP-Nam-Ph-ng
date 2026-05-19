from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.accounting import FixedAsset
from app.models.fixed_asset import DepreciationEntry
from app.schemas.fixed_asset import (
    FixedAssetCreate, FixedAssetUpdate, FixedAssetResponse,
    DepreciationEntryResponse, RunDepreciationRequest, RunDepreciationResponse,
)

router = APIRouter(prefix="/api/fixed-assets", tags=["TSCĐ"])


# ─── Assets ───────────────────────────────────────────────────────────────────

@router.get("", response_model=list[FixedAssetResponse])
def list_assets(
    trang_thai: str | None = Query(None),
    phap_nhan_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(FixedAsset).order_by(FixedAsset.ma_ts)
    if trang_thai:
        q = q.filter(FixedAsset.trang_thai == trang_thai)
    if phap_nhan_id:
        q = q.filter(FixedAsset.phap_nhan_id == phap_nhan_id)
    return q.all()


@router.post("", response_model=FixedAssetResponse, status_code=201)
def create_asset(
    data: FixedAssetCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    asset = FixedAsset(**data.model_dump())
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.get("/{asset_id}", response_model=FixedAssetResponse)
def get_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    a = db.get(FixedAsset, asset_id)
    if not a:
        raise HTTPException(404, "Không tìm thấy tài sản")
    return a


@router.patch("/{asset_id}", response_model=FixedAssetResponse)
def update_asset(
    asset_id: int,
    data: FixedAssetUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    a = db.get(FixedAsset, asset_id)
    if not a:
        raise HTTPException(404, "Không tìm thấy tài sản")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(a, k, v)
    db.commit()
    db.refresh(a)
    return a


# ─── Depreciation entries ─────────────────────────────────────────────────────

@router.get("/{asset_id}/depreciation", response_model=list[DepreciationEntryResponse])
def list_depreciation(
    asset_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not db.get(FixedAsset, asset_id):
        raise HTTPException(404, "Không tìm thấy tài sản")
    return (
        db.query(DepreciationEntry)
        .filter(DepreciationEntry.asset_id == asset_id)
        .order_by(DepreciationEntry.ky)
        .all()
    )


# ─── Run depreciation batch ───────────────────────────────────────────────────

@router.post("/run-depreciation", response_model=RunDepreciationResponse)
def run_depreciation(
    data: RunDepreciationRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Chạy khấu hao tháng cho toàn bộ TSCĐ đang dùng, bỏ qua đã KH kỳ này."""
    assets = db.query(FixedAsset).filter(
        FixedAsset.trang_thai == "dang_su_dung",
        FixedAsset.bo_qua_hach_toan == False,
        FixedAsset.da_khau_hao_thang < FixedAsset.so_thang_khau_hao,
    ).all()

    total = Decimal("0")
    count = 0

    for a in assets:
        exists = db.query(DepreciationEntry).filter(
            DepreciationEntry.asset_id == a.id,
            DepreciationEntry.ky == data.ky,
        ).first()
        if exists:
            continue

        kh_thang = (a.nguyen_gia / a.so_thang_khau_hao).quantize(Decimal("1"))
        con_lai = a.nguyen_gia - a.gia_tri_da_khau_hao
        so_tien = min(kh_thang, con_lai)
        if so_tien <= 0:
            continue

        entry = DepreciationEntry(
            asset_id=a.id,
            ky=data.ky,
            so_tien_kh=so_tien,
            gia_tri_da_kh_sau=a.gia_tri_da_khau_hao + so_tien,
        )
        db.add(entry)
        a.da_khau_hao_thang += 1
        a.gia_tri_da_khau_hao += so_tien
        if a.da_khau_hao_thang >= a.so_thang_khau_hao:
            a.trang_thai = "da_kh_het"

        total += so_tien
        count += 1

    db.commit()
    return RunDepreciationResponse(ky=data.ky, so_tscd_da_kh=count, tong_so_tien_kh=total)
