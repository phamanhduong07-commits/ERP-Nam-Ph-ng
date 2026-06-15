from collections import defaultdict
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user, get_admin_user
from app.models.auth import User
from app.models.master import TieuChuanKyThuat, PaperMaterial, OtherMaterial, Supplier, MaterialGroup
from app.models.media import ErpMedia
from app.schemas.sales import PagedResponse

router = APIRouter(prefix="/api/tieu-chuan-ky-thuat", tags=["tieu-chuan-ky-thuat"])


def _sync_papers_for_tc(tc: TieuChuanKyThuat, db: Session) -> int:
    """Đồng bộ các trường TC từ TieuChuanKyThuat sang PaperMaterial linked.
    Chỉ ghi đè khi TC có giá trị. Trả về số paper được cập nhật.
    """
    if not tc.ncc_id:
        return 0
    q = db.query(PaperMaterial).filter(PaperMaterial.ma_nsx_id == tc.ncc_id)
    if tc.nhom_id:
        q = q.filter(PaperMaterial.ma_nhom_id == tc.nhom_id)
    if tc.loai_giay:
        q = q.filter(PaperMaterial.loai_giay == tc.loai_giay)
    papers = q.all()
    for p in papers:
        p.tieu_chuan_id = tc.id
        if tc.tc_dinh_luong is not None:
            p.tieu_chuan_dinh_luong = tc.tc_dinh_luong
        if tc.tc_sai_so_pct is not None:
            p.sai_so_pct = tc.tc_sai_so_pct
        if tc.tc_do_buc is not None:
            p.do_buc_tieu_chuan = tc.tc_do_buc
        if tc.tc_do_nen_vong is not None:
            p.do_nen_vong_tc = tc.tc_do_nen_vong
    return len(papers)


class TieuChuanCreate(BaseModel):
    ma_tc: str
    ten: str
    mo_ta: str | None = None
    ap_dung_cho: str = "tat_ca"  # giay | nvl | tat_ca
    chi_tieu_list: list | None = None
    # Tiêu chuẩn giấy cuộn — NCC + nhóm + loại
    ncc_id: int | None = None
    nhom_id: int | None = None  # nhóm giấy (MaterialGroup); None = tất cả nhóm
    loai_giay: str | None = None  # nau | trang | xeo | vang | khac | None = tất cả loại
    tc_dinh_luong: float | None = None
    tc_sai_so_pct: float | None = None
    tc_do_buc: float | None = None
    tc_do_nen_vong: float | None = None


class TieuChuanUpdate(BaseModel):
    ten: str | None = None
    mo_ta: str | None = None
    ap_dung_cho: str | None = None
    chi_tieu_list: list | None = None
    ncc_id: Optional[int] = None
    nhom_id: Optional[int] = None
    loai_giay: Optional[str] = None
    tc_dinh_luong: Optional[float] = None
    tc_sai_so_pct: Optional[float] = None
    tc_do_buc: Optional[float] = None
    tc_do_nen_vong: Optional[float] = None


class TieuChuanResponse(BaseModel):
    id: int
    ma_tc: str
    ten: str
    mo_ta: str | None = None
    ap_dung_cho: str
    chi_tieu_list: list | None = None
    ncc_id: int | None = None
    ncc_ten: str | None = None
    nhom_id: int | None = None
    nhom_ten: str | None = None
    loai_giay: str | None = None
    tc_dinh_luong: float | None = None
    tc_sai_so_pct: float | None = None
    tc_do_buc: float | None = None
    tc_do_nen_vong: float | None = None
    file_count: int = 0
    files: list[dict] = []
    papers_synced: int | None = None
    created_at: datetime

    class Config:
        from_attributes = True


def _to_response(obj: TieuChuanKyThuat, db: Session, include_files: bool = False) -> TieuChuanResponse:
    files = []
    if include_files:
        media_rows = (
            db.query(ErpMedia)
            .filter(ErpMedia.module == "tieu_chuan", ErpMedia.record_id == str(obj.id))
            .order_by(ErpMedia.created_at.asc())
            .all()
        )
        files = [
            {
                "id": m.id,
                "url": f"/uploads/{m.filepath}",
                "filename": m.filename,
                "mime_type": m.mime_type,
                "size_bytes": m.size_bytes,
                "note": m.note,
            }
            for m in media_rows
        ]

    file_count_q = db.query(ErpMedia).filter(
        ErpMedia.module == "tieu_chuan", ErpMedia.record_id == str(obj.id)
    ).count()

    data = TieuChuanResponse.model_validate(obj)
    data.file_count = file_count_q
    data.files = files
    if obj.ncc:
        data.ncc_ten = obj.ncc.ten_viet_tat
    if obj.nhom:
        data.nhom_ten = obj.nhom.ten_nhom
    if obj.tc_dinh_luong is not None:
        data.tc_dinh_luong = float(obj.tc_dinh_luong)
    if obj.tc_sai_so_pct is not None:
        data.tc_sai_so_pct = float(obj.tc_sai_so_pct)
    if obj.tc_do_buc is not None:
        data.tc_do_buc = float(obj.tc_do_buc)
    if obj.tc_do_nen_vong is not None:
        data.tc_do_nen_vong = float(obj.tc_do_nen_vong)
    return data


@router.get("", response_model=PagedResponse)
def list_tieu_chuan(
    search: str = Query(default=""),
    ap_dung_cho: str | None = Query(default=None),
    ncc_id: int | None = Query(default=None),
    nhom_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(TieuChuanKyThuat)
    if search:
        like = f"%{search}%"
        q = q.filter(
            TieuChuanKyThuat.ma_tc.ilike(like) | TieuChuanKyThuat.ten.ilike(like)
        )
    if ap_dung_cho:
        q = q.filter(
            (TieuChuanKyThuat.ap_dung_cho == ap_dung_cho) | (TieuChuanKyThuat.ap_dung_cho == "tat_ca")
        )
    if ncc_id:
        q = q.filter(TieuChuanKyThuat.ncc_id == ncc_id)
    if nhom_id:
        q = q.filter(TieuChuanKyThuat.nhom_id == nhom_id)
    total = q.count()
    items = q.order_by(TieuChuanKyThuat.ma_tc).offset((page - 1) * page_size).limit(page_size).all()
    return PagedResponse(
        items=[_to_response(o, db, include_files=True) for o in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/search")
def search_tieu_chuan(
    q: str = Query(default=""),
    ap_dung_cho: str | None = Query(default=None),
    limit: int = Query(default=30, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Quick search cho autocomplete trong form sản phẩm."""
    query = db.query(TieuChuanKyThuat)
    if q:
        like = f"%{q}%"
        query = query.filter(TieuChuanKyThuat.ma_tc.ilike(like) | TieuChuanKyThuat.ten.ilike(like))
    if ap_dung_cho:
        query = query.filter(
            (TieuChuanKyThuat.ap_dung_cho == ap_dung_cho) | (TieuChuanKyThuat.ap_dung_cho == "tat_ca")
        )
    items = query.order_by(TieuChuanKyThuat.ma_tc).limit(limit).all()
    return [{"value": o.id, "label": f"{o.ma_tc} — {o.ten}", "id": o.id, "ma_tc": o.ma_tc, "ten": o.ten} for o in items]


@router.get("/{id}/preview-giay")
def preview_giay_matching(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Xem trước danh sách giấy sẽ được áp dụng tiêu chuẩn này (theo NCC + loại giấy)."""
    tc = db.get(TieuChuanKyThuat, id)
    if not tc:
        raise HTTPException(404, "Không tìm thấy tiêu chuẩn")
    if not tc.ncc_id:
        return {"count": 0, "papers": [], "note": "Chưa chọn NCC — không thể preview"}
    q = db.query(PaperMaterial).filter(PaperMaterial.ma_nsx_id == tc.ncc_id)
    if tc.nhom_id:
        q = q.filter(PaperMaterial.ma_nhom_id == tc.nhom_id)
    if tc.loai_giay:
        q = q.filter(PaperMaterial.loai_giay == tc.loai_giay)
    papers = q.order_by(PaperMaterial.ma_chinh).all()
    return {
        "count": len(papers),
        "papers": [{"id": p.id, "ma_chinh": p.ma_chinh, "ten": p.ten[:60], "loai_giay": p.loai_giay} for p in papers[:20]],
    }


@router.post("/{id}/ap-dung-cho-giay")
def ap_dung_cho_giay(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Bulk-apply tiêu chuẩn này lên tất cả giấy phù hợp (cùng NCC + loại giấy).
    Chỉ ghi đè các trường đã có giá trị trong tiêu chuẩn. Gán tieu_chuan_id cho giấy.
    """
    tc = db.get(TieuChuanKyThuat, id)
    if not tc:
        raise HTTPException(404, "Không tìm thấy tiêu chuẩn")
    if not tc.ncc_id:
        raise HTTPException(400, "Tiêu chuẩn chưa chọn NCC — không thể áp dụng hàng loạt")

    q = db.query(PaperMaterial).filter(PaperMaterial.ma_nsx_id == tc.ncc_id)
    if tc.nhom_id:
        q = q.filter(PaperMaterial.ma_nhom_id == tc.nhom_id)
    if tc.loai_giay:
        q = q.filter(PaperMaterial.loai_giay == tc.loai_giay)
    updated = _sync_papers_for_tc(tc, db)
    db.commit()
    return {"updated": updated, "ncc_id": tc.ncc_id, "nhom_id": tc.nhom_id, "loai_giay": tc.loai_giay}


@router.get("/{id}/preview-nvl")
def preview_nvl_matching(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Xem trước danh sách NVL khác sẽ được áp dụng tiêu chuẩn này (theo NCC + nhóm)."""
    tc = db.get(TieuChuanKyThuat, id)
    if not tc:
        raise HTTPException(404, "Không tìm thấy tiêu chuẩn")
    if not tc.ncc_id and not tc.nhom_id:
        return {"count": 0, "nvls": [], "note": "Chưa chọn NCC hoặc nhóm — không thể preview"}
    q = db.query(OtherMaterial)
    if tc.ncc_id:
        q = q.filter(OtherMaterial.ma_ncc_id == tc.ncc_id)
    if tc.nhom_id:
        q = q.filter(OtherMaterial.ma_nhom_id == tc.nhom_id)
    nvls = q.order_by(OtherMaterial.ma_chinh).all()
    return {
        "count": len(nvls),
        "nvls": [{"id": n.id, "ma_chinh": n.ma_chinh, "ten": n.ten[:60]} for n in nvls[:20]],
    }


@router.post("/{id}/ap-dung-cho-nvl")
def ap_dung_cho_nvl(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Bulk-apply tiêu chuẩn này lên NVL khác phù hợp (cùng NCC + nhóm). Gán tieu_chuan_id."""
    tc = db.get(TieuChuanKyThuat, id)
    if not tc:
        raise HTTPException(404, "Không tìm thấy tiêu chuẩn")
    if not tc.ncc_id and not tc.nhom_id:
        raise HTTPException(400, "Tiêu chuẩn chưa chọn NCC hoặc nhóm — không thể áp dụng hàng loạt")
    q = db.query(OtherMaterial)
    if tc.ncc_id:
        q = q.filter(OtherMaterial.ma_ncc_id == tc.ncc_id)
    if tc.nhom_id:
        q = q.filter(OtherMaterial.ma_nhom_id == tc.nhom_id)
    nvls = q.all()
    for n in nvls:
        n.tieu_chuan_id = id
    db.commit()
    return {"updated": len(nvls), "ncc_id": tc.ncc_id, "nhom_id": tc.nhom_id}


@router.post("/apply-all-to-papers")
def apply_all_tc_to_papers(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """Áp dụng tất cả TieuChuanKyThuat loại 'giay' lên các PaperMaterial phù hợp.
    Ghi đè tieu_chuan_id, sai_so_pct, do_buc_tieu_chuan, do_nen_vong_tc.
    """
    tcs = db.query(TieuChuanKyThuat).filter(
        TieuChuanKyThuat.ap_dung_cho.in_(["giay", "tat_ca"]),
        TieuChuanKyThuat.ncc_id.isnot(None),
    ).all()

    total_updated = 0
    results = []
    for tc in tcs:
        n = _sync_papers_for_tc(tc, db)
        total_updated += n
        results.append({"tc_id": tc.id, "ma_tc": tc.ma_tc, "papers": n})

    db.commit()
    return {"tc_processed": len(tcs), "papers_updated": total_updated, "detail": results}


@router.post("/migrate-from-papers")
def migrate_tc_from_papers(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """One-time migration: tạo TieuChuanKyThuat từ data TC sẵn có trong PaperMaterial.
    Group by NCC + nhóm + loại giấy. Idempotent — gọi nhiều lần cũng an toàn.
    """
    papers = db.query(PaperMaterial).filter(
        (PaperMaterial.sai_so_pct.isnot(None))
        | (PaperMaterial.do_buc_tieu_chuan.isnot(None))
        | (PaperMaterial.do_nen_vong_tc.isnot(None))
        | (PaperMaterial.tieu_chuan_dinh_luong.isnot(None))
    ).all()

    groups: dict = defaultdict(list)
    for p in papers:
        key = (p.ma_nsx_id, p.ma_nhom_id, p.loai_giay)
        groups[key].append(p)

    created = 0
    linked = 0

    for (nsx_id, nhom_id, loai_giay), group in groups.items():
        # Tìm TC đã tồn tại cho combo này
        q = db.query(TieuChuanKyThuat).filter(
            TieuChuanKyThuat.ap_dung_cho == "giay"
        )
        if nsx_id is not None:
            q = q.filter(TieuChuanKyThuat.ncc_id == nsx_id)
        else:
            q = q.filter(TieuChuanKyThuat.ncc_id.is_(None))
        if nhom_id is not None:
            q = q.filter(TieuChuanKyThuat.nhom_id == nhom_id)
        else:
            q = q.filter(TieuChuanKyThuat.nhom_id.is_(None))
        if loai_giay is not None:
            q = q.filter(TieuChuanKyThuat.loai_giay == loai_giay)
        else:
            q = q.filter(TieuChuanKyThuat.loai_giay.is_(None))
        existing = q.first()

        if not existing:
            ncc = db.get(Supplier, nsx_id) if nsx_id else None
            nhom = db.get(MaterialGroup, nhom_id) if nhom_id else None
            sample = group[0]

            # Build ma_tc từ NCC + nhóm + loại
            parts = []
            if ncc:
                parts.append((ncc.ten_viet_tat or "NCC")[:8].upper().replace(" ", ""))
            if nhom:
                parts.append((nhom.ten_nhom or "NHOM")[:8].upper().replace(" ", ""))
            if loai_giay:
                parts.append(loai_giay[:4].upper())
            base_ma = "-".join(parts) if parts else "TC-AUTO"

            ma_tc = base_ma
            counter = 1
            while db.query(TieuChuanKyThuat).filter(TieuChuanKyThuat.ma_tc == ma_tc).first():
                ma_tc = f"{base_ma}-{counter}"
                counter += 1

            ten_parts = []
            if ncc:
                ten_parts.append(ncc.ten_viet_tat or "")
            if nhom:
                ten_parts.append(nhom.ten_nhom or "")
            if loai_giay:
                ten_parts.append(loai_giay)
            ten = " / ".join(p for p in ten_parts if p) or "Tiêu chuẩn tự động"

            tc = TieuChuanKyThuat(
                ma_tc=ma_tc,
                ten=ten,
                ap_dung_cho="giay",
                ncc_id=nsx_id,
                nhom_id=nhom_id,
                loai_giay=loai_giay,
                tc_sai_so_pct=sample.sai_so_pct,
                tc_do_buc=sample.do_buc_tieu_chuan,
                tc_do_nen_vong=sample.do_nen_vong_tc,
            )
            db.add(tc)
            db.flush()
            existing = tc
            created += 1

        # Link papers chưa có tieu_chuan_id
        for p in group:
            if p.tieu_chuan_id is None:
                p.tieu_chuan_id = existing.id
                linked += 1

    db.commit()
    return {
        "groups": len(groups),
        "papers_with_tc_data": len(papers),
        "tc_created": created,
        "papers_linked": linked,
    }


@router.post("/migrate-paper-tc-to-chi-tieu-list")
def migrate_paper_tc_to_chi_tieu_list(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """One-time migration: chuyển tc_dinh_luong / tc_sai_so_pct / tc_do_buc / tc_do_nen_vong
    sang chi_tieu_list cho TCKT giấy cuộn chưa có chi_tieu_list.
    Idempotent — bỏ qua TC đã có chi_tieu_list.
    """
    tcs = db.query(TieuChuanKyThuat).filter(
        TieuChuanKyThuat.ap_dung_cho.in_(["giay", "tat_ca"]),
    ).all()

    migrated = 0
    skipped = 0

    for tc in tcs:
        if tc.chi_tieu_list:
            skipped += 1
            continue

        has_any = any([tc.tc_dinh_luong, tc.tc_do_buc, tc.tc_do_nen_vong])
        if not has_any:
            skipped += 1
            continue

        items = []
        stt = 1

        if tc.tc_dinh_luong is not None:
            items.append({
                "stt": stt,
                "ten_chi_tieu": "Định lượng",
                "don_vi": "g/m²",
                "yeu_cau_text": None,
                "kieu_kiem_tra": "average_range",
                "gia_tri_min": float(tc.tc_dinh_luong),
                "gia_tri_max": None,
                "tolerance_pct": float(tc.tc_sai_so_pct) if tc.tc_sai_so_pct else 5.0,
                "so_lan_do": 2,
                "bat_buoc": True,
            })
            stt += 1

        if tc.tc_do_buc is not None:
            items.append({
                "stt": stt,
                "ten_chi_tieu": "Độ bục",
                "don_vi": "kPa",
                "yeu_cau_text": None,
                "kieu_kiem_tra": "average_min",
                "gia_tri_min": float(tc.tc_do_buc),
                "gia_tri_max": None,
                "tolerance_pct": None,
                "so_lan_do": 4,
                "bat_buoc": True,
            })
            stt += 1

        if tc.tc_do_nen_vong is not None:
            items.append({
                "stt": stt,
                "ten_chi_tieu": "Độ nén vòng",
                "don_vi": "N",
                "yeu_cau_text": None,
                "kieu_kiem_tra": "average_min",
                "gia_tri_min": float(tc.tc_do_nen_vong),
                "gia_tri_max": None,
                "tolerance_pct": None,
                "so_lan_do": 3,
                "bat_buoc": True,
            })
            stt += 1

        if items:
            tc.chi_tieu_list = items
            migrated += 1

    db.commit()
    return {"migrated": migrated, "skipped": skipped}


@router.get("/{id}", response_model=TieuChuanResponse)
def get_tieu_chuan(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(TieuChuanKyThuat).filter(TieuChuanKyThuat.id == id).first()
    if not obj:
        raise HTTPException(404, "Không tìm thấy tiêu chuẩn")
    return _to_response(obj, db, include_files=True)


@router.post("", response_model=TieuChuanResponse, status_code=201)
def create_tieu_chuan(
    data: TieuChuanCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if db.query(TieuChuanKyThuat).filter(TieuChuanKyThuat.ma_tc == data.ma_tc).first():
        raise HTTPException(400, f"Mã '{data.ma_tc}' đã tồn tại")
    obj = TieuChuanKyThuat(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _to_response(obj, db)


@router.put("/{id}", response_model=TieuChuanResponse)
def update_tieu_chuan(
    id: int,
    data: TieuChuanUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(TieuChuanKyThuat).filter(TieuChuanKyThuat.id == id).first()
    if not obj:
        raise HTTPException(404, "Không tìm thấy tiêu chuẩn")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    # Auto-sync: khi TC giấy thay đổi → cập nhật tất cả paper linked
    papers_synced = 0
    if obj.ap_dung_cho in ("giay", "tat_ca"):
        papers_synced = _sync_papers_for_tc(obj, db)
    db.commit()
    db.refresh(obj)
    resp = _to_response(obj, db, include_files=True)
    resp.papers_synced = papers_synced  # type: ignore[attr-defined]
    return resp


@router.delete("/{id}")
def delete_tieu_chuan(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(TieuChuanKyThuat).filter(TieuChuanKyThuat.id == id).first()
    if not obj:
        raise HTTPException(404, "Không tìm thấy tiêu chuẩn")
    db.delete(obj)
    db.commit()
    return {"ok": True}
