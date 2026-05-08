from datetime import date, datetime
from decimal import Decimal
import io
import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.ccdc import NhomCCDC, CongCuDungCu, PhieuXuatCCDC, PhieuXuatCCDCItem
from app.schemas.accounting import (
    NhomCCDCCreate, NhomCCDCResponse,
    CCDCCreate, CCDCUpdate, CCDCResponse,
    PhieuXuatCCDCCreate, PhieuXuatCCDCResponse,
    PhieuXuatCCDCItemResponse,
)
from app.services.excel_import_service import build_template_response, ImportField, parse_text, parse_decimal, parse_bool

router = APIRouter(prefix="/api/ccdc", tags=["ccdc"])

KE_TOAN = ("KE_TOAN", "GIAM_DOC", "ADMIN")

_CCDC_IMPORT_FIELDS = [
    ImportField("ma_ccdc",          "Ma CCDC",          required=True,  parser=parse_text,    help_text="Ma cong cu dung cu, duy nhat (upsert key)"),
    ImportField("ten_ccdc",         "Ten CCDC",          required=True,  parser=parse_text),
    ImportField("ma_nhom",          "Ma nhom",           parser=parse_text,    help_text="Ma nhom CCDC (phai ton tai trong he thong)"),
    ImportField("don_vi_tinh",      "Don vi tinh",       parser=parse_text),
    ImportField("so_luong",         "So luong",          parser=parse_decimal, default=1,    help_text="So luong (mac dinh 1)"),
    ImportField("nguyen_gia",       "Nguyen gia",        parser=parse_decimal, default=0),
    ImportField("gia_tri_con_lai",  "Gia tri con lai",   parser=parse_decimal, default=0),
    ImportField("ngay_mua",         "Ngay mua",          parser=parse_text,    help_text="YYYY-MM-DD"),
    ImportField("thoi_gian_phan_bo","Thoi gian phan bo", parser=parse_decimal, default=0,    help_text="So thang phan bo"),
    ImportField("bo_phan_su_dung",  "Bo phan su dung",   parser=parse_text),
    ImportField("trang_thai",       "Trang thai",        parser=parse_text,    default="dang_su_dung", help_text="dang_su_dung|bao_hanh|mat|da_thanh_ly"),
    ImportField("ghi_chu",          "Ghi chu",           parser=parse_text),
]


@router.get("/import-template")
def download_ccdc_import_template(_: User = Depends(get_current_user)):
    return build_template_response("mau_import_ccdc.xlsx", _CCDC_IMPORT_FIELDS)


@router.post("/import")
async def import_ccdc(
    commit: bool = Query(default=False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*KE_TOAN)),
):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Chi chap nhan file Excel .xlsx/.xls")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "File rong")
    df = pd.read_excel(io.BytesIO(raw), dtype=object)
    # Build nhom lookup
    nhom_map: dict[str, int] = {n.ma_nhom: n.id for n in db.query(NhomCCDC).all()}

    rows, created, updated, errors_count = [], 0, 0, 0
    objects_to_save: list[tuple] = []
    for idx, src in df.iterrows():
        row_no = int(idx) + 2
        errs = []
        ma_ccdc    = parse_text(src.get("Ma CCDC"))
        ten_ccdc   = parse_text(src.get("Ten CCDC"))
        ma_nhom    = parse_text(src.get("Ma nhom"))
        don_vi     = parse_text(src.get("Don vi tinh"))
        so_luong   = parse_decimal(src.get("So luong")) or Decimal("1")
        nguyen_gia = parse_decimal(src.get("Nguyen gia")) or Decimal("0")
        gia_tri_cl = parse_decimal(src.get("Gia tri con lai")) or Decimal("0")
        ngay_mua_s = parse_text(src.get("Ngay mua"))
        thoi_gian  = int(parse_decimal(src.get("Thoi gian phan bo")) or 0)
        bo_phan    = parse_text(src.get("Bo phan su dung"))
        trang_thai = parse_text(src.get("Trang thai")) or "dang_su_dung"
        ghi_chu    = parse_text(src.get("Ghi chu"))

        if not ma_ccdc:
            errs.append("Ma CCDC: bat buoc")
        if not ten_ccdc:
            errs.append("Ten CCDC: bat buoc")
        nhom_id = nhom_map.get(ma_nhom) if ma_nhom else None
        if ma_nhom and nhom_id is None:
            errs.append(f"Ma nhom: khong ton tai '{ma_nhom}'")

        ngay_mua = None
        if ngay_mua_s:
            try:
                ngay_mua = date.fromisoformat(ngay_mua_s[:10])
            except Exception:
                errs.append("Ngay mua: sai dinh dang (YYYY-MM-DD)")

        if errs:
            errors_count += 1
            rows.append({"row": row_no, "status": "error", "errors": errs, "data": {}})
            continue

        existing = db.query(CongCuDungCu).filter(CongCuDungCu.ma_ccdc == ma_ccdc).first()
        status = "update" if existing else "create"
        vals = {
            "ma_ccdc": ma_ccdc, "ten_ccdc": ten_ccdc, "nhom_id": nhom_id,
            "don_vi_tinh": don_vi, "so_luong": so_luong, "nguyen_gia": nguyen_gia,
            "gia_tri_con_lai": gia_tri_cl, "ngay_mua": ngay_mua,
            "thoi_gian_phan_bo": thoi_gian, "bo_phan_su_dung": bo_phan,
            "trang_thai": trang_thai, "ghi_chu": ghi_chu,
        }
        objects_to_save.append((existing, vals))
        if status == "update":
            updated += 1
        else:
            created += 1
        rows.append({"row": row_no, "status": status, "errors": [], "data": {"ma_ccdc": ma_ccdc, "ten_ccdc": ten_ccdc}})

    if commit and errors_count == 0:
        for existing, vals in objects_to_save:
            if existing:
                for k, v in vals.items():
                    setattr(existing, k, v)
            else:
                db.add(CongCuDungCu(**vals))
        db.commit()
    return {"commit": commit, "total": len(rows), "created": created, "updated": updated, "skipped": 0, "errors": errors_count, "rows": rows[:200]}


def _gen_so_phieu(db: Session) -> str:
    prefix = f"PXCCDC{date.today().strftime('%Y%m')}"
    last = (
        db.query(PhieuXuatCCDC)
        .filter(PhieuXuatCCDC.so_phieu.like(f"{prefix}%"))
        .order_by(desc(PhieuXuatCCDC.so_phieu))
        .first()
    )
    seq = int(last.so_phieu[-4:]) + 1 if last else 1
    return f"{prefix}-{seq:04d}"


# ─── Nhóm CCDC ───────────────────────────────────────────────────────────────

@router.get("/nhom", response_model=list[NhomCCDCResponse])
def list_nhom(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(NhomCCDC).filter(NhomCCDC.trang_thai == True).order_by(NhomCCDC.ten_nhom).all()  # noqa: E712


@router.post("/nhom", response_model=NhomCCDCResponse, status_code=201)
def create_nhom(
    data: NhomCCDCCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*KE_TOAN)),
):
    if db.query(NhomCCDC).filter(NhomCCDC.ma_nhom == data.ma_nhom).first():
        raise HTTPException(400, f"Mã nhóm '{data.ma_nhom}' đã tồn tại")
    obj = NhomCCDC(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/nhom/{nhom_id}", response_model=NhomCCDCResponse)
def update_nhom(
    nhom_id: int,
    data: NhomCCDCCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*KE_TOAN)),
):
    obj = db.get(NhomCCDC, nhom_id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy nhóm CCDC")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


# ─── Danh mục CCDC ───────────────────────────────────────────────────────────

@router.get("", response_model=list[CCDCResponse])
def list_ccdc(
    search: str | None = Query(None),
    nhom_id: int | None = Query(None),
    trang_thai: str | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(CongCuDungCu)
    if search:
        like = f"%{search}%"
        q = q.filter(
            CongCuDungCu.ten_ccdc.ilike(like) | CongCuDungCu.ma_ccdc.ilike(like)
        )
    if nhom_id:
        q = q.filter(CongCuDungCu.nhom_id == nhom_id)
    if trang_thai:
        q = q.filter(CongCuDungCu.trang_thai == trang_thai)
    items = q.order_by(CongCuDungCu.ma_ccdc).all()
    result = []
    for item in items:
        r = CCDCResponse.model_validate(item)
        r.ten_nhom = item.nhom.ten_nhom if item.nhom else None
        result.append(r)
    return result


@router.post("", response_model=CCDCResponse, status_code=201)
def create_ccdc(
    data: CCDCCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*KE_TOAN)),
):
    if db.query(CongCuDungCu).filter(CongCuDungCu.ma_ccdc == data.ma_ccdc).first():
        raise HTTPException(400, f"Mã CCDC '{data.ma_ccdc}' đã tồn tại")
    payload = data.model_dump()
    if payload.get("gia_tri_con_lai") is None:
        payload["gia_tri_con_lai"] = payload["nguyen_gia"]
    obj = CongCuDungCu(**payload)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    r = CCDCResponse.model_validate(obj)
    r.ten_nhom = obj.nhom.ten_nhom if obj.nhom else None
    return r


# ─── Phiếu xuất CCDC (đặt TRƯỚC /{ccdc_id} để tránh route conflict) ──────────

@router.get("/phieu-xuat", response_model=list[PhieuXuatCCDCResponse])
def list_phieu_xuat(
    tu_ngay: date | None = Query(None),
    den_ngay: date | None = Query(None),
    trang_thai: str | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(PhieuXuatCCDC)
    if tu_ngay:
        q = q.filter(PhieuXuatCCDC.ngay_xuat >= tu_ngay)
    if den_ngay:
        q = q.filter(PhieuXuatCCDC.ngay_xuat <= den_ngay)
    if trang_thai:
        q = q.filter(PhieuXuatCCDC.trang_thai == trang_thai)
    phieus = q.order_by(desc(PhieuXuatCCDC.ngay_xuat)).all()
    result = []
    for p in phieus:
        resp = PhieuXuatCCDCResponse.model_validate(p)
        resp.items = [
            PhieuXuatCCDCItemResponse(
                id=it.id,
                ccdc_id=it.ccdc_id,
                ten_ccdc=it.ccdc.ten_ccdc if it.ccdc else None,
                so_luong=it.so_luong,
                ghi_chu=it.ghi_chu,
            )
            for it in p.items
        ]
        result.append(resp)
    return result


@router.post("/phieu-xuat", response_model=PhieuXuatCCDCResponse, status_code=201)
def create_phieu_xuat(
    data: PhieuXuatCCDCCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN)),
):
    if not data.items:
        raise HTTPException(400, "Phiếu xuất phải có ít nhất 1 dòng CCDC")
    phieu = PhieuXuatCCDC(
        so_phieu=_gen_so_phieu(db),
        ngay_xuat=data.ngay_xuat,
        nguoi_nhan=data.nguoi_nhan,
        bo_phan=data.bo_phan,
        ly_do=data.ly_do,
        created_by=current_user.id,
    )
    db.add(phieu)
    db.flush()
    for item in data.items:
        ccdc = db.get(CongCuDungCu, item.ccdc_id)
        if not ccdc:
            raise HTTPException(404, f"Không tìm thấy CCDC id={item.ccdc_id}")
        db.add(PhieuXuatCCDCItem(
            phieu_id=phieu.id,
            ccdc_id=item.ccdc_id,
            so_luong=item.so_luong,
            ghi_chu=item.ghi_chu,
        ))
    db.commit()
    db.refresh(phieu)
    resp = PhieuXuatCCDCResponse.model_validate(phieu)
    resp.items = [
        PhieuXuatCCDCItemResponse(
            id=it.id,
            ccdc_id=it.ccdc_id,
            ten_ccdc=it.ccdc.ten_ccdc if it.ccdc else None,
            so_luong=it.so_luong,
            ghi_chu=it.ghi_chu,
        )
        for it in phieu.items
    ]
    return resp


@router.patch("/phieu-xuat/{phieu_id}/approve")
def approve_phieu_xuat(
    phieu_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN)),
):
    phieu = db.get(PhieuXuatCCDC, phieu_id)
    if not phieu:
        raise HTTPException(404, "Không tìm thấy phiếu xuất CCDC")
    if phieu.trang_thai != "cho_duyet":
        raise HTTPException(400, "Chỉ duyệt được phiếu đang chờ duyệt")

    # Trừ tồn kho CCDC — validate trước rồi mới trừ
    for item in phieu.items:
        ccdc = db.get(CongCuDungCu, item.ccdc_id)
        if not ccdc:
            raise HTTPException(404, f"Không tìm thấy CCDC id={item.ccdc_id}")
        if Decimal(str(ccdc.so_luong)) < Decimal(str(item.so_luong)):
            raise HTTPException(
                400,
                f"CCDC '{ccdc.ma_ccdc}' không đủ số lượng "
                f"(tồn: {ccdc.so_luong}, cần xuất: {item.so_luong})",
            )
    for item in phieu.items:
        ccdc = db.get(CongCuDungCu, item.ccdc_id)
        ccdc.so_luong = Decimal(str(ccdc.so_luong)) - Decimal(str(item.so_luong))

    phieu.trang_thai = "da_duyet"
    phieu.nguoi_duyet_id = current_user.id
    db.commit()
    return {"id": phieu_id, "trang_thai": "da_duyet"}


@router.patch("/phieu-xuat/{phieu_id}/cancel")
def cancel_phieu_xuat(
    phieu_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*KE_TOAN)),
):
    phieu = db.get(PhieuXuatCCDC, phieu_id)
    if not phieu:
        raise HTTPException(404, "Không tìm thấy phiếu xuất CCDC")
    if phieu.trang_thai == "da_duyet":
        raise HTTPException(400, "Không thể hủy phiếu đã duyệt")
    phieu.trang_thai = "huy"
    db.commit()
    return {"id": phieu_id, "trang_thai": "huy"}


# ─── CCDC detail / update (đặt SAU /phieu-xuat) ──────────────────────────────

@router.get("/{ccdc_id}", response_model=CCDCResponse)
def get_ccdc(
    ccdc_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.get(CongCuDungCu, ccdc_id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy CCDC")
    r = CCDCResponse.model_validate(obj)
    r.ten_nhom = obj.nhom.ten_nhom if obj.nhom else None
    return r


@router.put("/{ccdc_id}", response_model=CCDCResponse)
def update_ccdc(
    ccdc_id: int,
    data: CCDCUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*KE_TOAN)),
):
    obj = db.get(CongCuDungCu, ccdc_id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy CCDC")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    obj.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(obj)
    r = CCDCResponse.model_validate(obj)
    r.ten_nhom = obj.nhom.ten_nhom if obj.nhom else None
    return r
