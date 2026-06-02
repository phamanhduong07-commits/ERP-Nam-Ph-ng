from datetime import datetime
from decimal import Decimal
import unicodedata

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel as _BaseModel
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user, require_permissions
from app.models.auth import User
from app.models.master import MaterialGroup, PaperMaterial, Supplier
from app.services.excel_import_service import (
    ImportField,
    build_template_response,
    import_excel,
    parse_bool,
    parse_decimal,
    parse_text,
)

router = APIRouter(prefix="/api/paper-materials", tags=["paper-materials"])


class PaperMaterialCreate(BaseModel):
    ma_chinh: str
    ma_amis: str | None = None
    ma_nhom_id: int
    ten: str
    ten_viet_tat: str | None = None
    dvt: str = "Kg"
    kho: Decimal | None = None
    ma_ky_hieu: str | None = None
    loai_giay: str | None = None  # nau | trang | xeo | vang | khac
    ma_dong_cap: str | None = None
    dinh_luong: Decimal | None = None
    ma_nsx_id: int | None = None
    gia_mua: Decimal | None = Decimal("0")
    gia_ban: Decimal | None = Decimal("0")
    gia_dinh_muc: Decimal | None = Decimal("0")
    ton_toi_thieu: Decimal | None = Decimal("0")
    ton_toi_da: Decimal | None = None
    la_cuon: bool = True
    su_dung: bool = True


class PaperMaterialUpdate(BaseModel):
    ma_amis: str | None = None
    ma_nhom_id: int | None = None
    ten: str | None = None
    ten_viet_tat: str | None = None
    dvt: str | None = None
    kho: Decimal | None = None
    ma_ky_hieu: str | None = None
    loai_giay: str | None = None  # nau | trang | xeo | vang | khac
    ma_dong_cap: str | None = None
    dinh_luong: Decimal | None = None
    ma_nsx_id: int | None = None
    gia_mua: Decimal | None = None
    gia_ban: Decimal | None = None
    gia_dinh_muc: Decimal | None = None
    do_buc_tb: Decimal | None = None
    do_nen_vong_tb: Decimal | None = None
    ton_toi_thieu: Decimal | None = None
    ton_toi_da: Decimal | None = None
    la_cuon: bool | None = None
    su_dung: bool | None = None


class PaperMaterialResponse(BaseModel):
    id: int
    ma_chinh: str
    ma_amis: str | None = None
    ma_nhom_id: int
    ten: str
    ten_viet_tat: str | None = None
    dvt: str
    kho: Decimal | None = None
    ma_ky_hieu: str | None = None
    loai_giay: str | None = None
    ma_dong_cap: str | None = None
    dinh_luong: Decimal | None = None
    ma_nsx_id: int | None = None
    gia_mua: Decimal | None = None
    gia_ban: Decimal | None = None
    gia_dinh_muc: Decimal | None = None
    do_buc_tb: Decimal | None = None
    do_nen_vong_tb: Decimal | None = None
    ton_toi_thieu: Decimal | None = None
    ton_toi_da: Decimal | None = None
    la_cuon: bool
    su_dung: bool
    ten_nhom: str | None = None
    ten_nsx: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


PAPER_MATERIAL_IMPORT_FIELDS = [
    ImportField("ma_chinh", "Ma chinh", required=True, parser=parse_text, help_text="Ma giay duy nhat"),
    ImportField("ma_amis", "Ma AMIS", parser=parse_text),
    ImportField("ma_nhom", "Ma nhom", required=True, parser=parse_text, help_text="Ma nhom phai ton tai"),
    ImportField("ten", "Ten giay", required=True, parser=parse_text),
    ImportField("ten_viet_tat", "Ten viet tat", parser=parse_text),
    ImportField("dvt", "DVT", parser=parse_text, default="Kg"),
    ImportField("kho", "Kho", parser=parse_decimal),
    ImportField("ma_ky_hieu", "Ma ky hieu", parser=parse_text),
    ImportField("ma_dong_cap", "KyHieu", parser=parse_text),
    ImportField("dinh_luong", "Dinh luong", parser=parse_decimal),
    ImportField("tieu_chuan_dinh_luong", "DL_TC", parser=parse_decimal),
    ImportField("ma_nsx", "Ma NSX", parser=parse_text, help_text="Neu co, phai ton tai trong danh muc NCC"),
    ImportField("gia_mua", "Gia mua", parser=parse_decimal, default=0),
    ImportField("gia_ban", "Gia ban", parser=parse_decimal, default=0),
    ImportField("gia_dinh_muc", "Gia dinh muc", parser=parse_decimal, default=0),
    ImportField("ton_toi_thieu", "Ton toi thieu", parser=parse_decimal, default=0),
    ImportField("ton_toi_da", "Ton toi da", parser=parse_decimal),
    ImportField("la_cuon", "La cuon", parser=parse_bool, default=True),
    ImportField("su_dung", "Su dung", parser=parse_bool, default=True),
]


def _to_response(obj: PaperMaterial) -> PaperMaterialResponse:
    data = PaperMaterialResponse.model_validate(obj)
    data.ten_nhom = obj.nhom.ten_nhom if obj.nhom else None
    data.ten_nsx = obj.nsx.ten_viet_tat if obj.nsx else None
    return data


def _resolve_paper_material_import_row(db: Session, values: dict) -> tuple[dict, list[str]]:
    errors: list[str] = []
    ma_nhom = values.pop("ma_nhom", None)
    ma_nsx = values.pop("ma_nsx", None)

    if ma_nhom:
        group = db.query(MaterialGroup).filter(MaterialGroup.ma_nhom == ma_nhom).first()
        if not group:
            errors.append(f"Ma nhom: khong ton tai '{ma_nhom}'")
        else:
            values["ma_nhom_id"] = group.id

    if ma_nsx:
        supplier = db.query(Supplier).filter(Supplier.ma_ncc == ma_nsx).first()
        if not supplier:
            errors.append(f"Ma NSX: khong ton tai '{ma_nsx}'")
        else:
            values["ma_nsx_id"] = supplier.id

    return values, errors


def _strip_accents(value: str) -> str:
    return "".join(
        ch for ch in unicodedata.normalize("NFD", value.lower())
        if unicodedata.category(ch) != "Mn"
    )


def _paper_suffix(name: str | None) -> str | None:
    text = _strip_accents(name or "")
    if "trang" in text:
        return "W"
    if "nau" in text:
        return "N"
    if "xeo" in text:
        return "X"
    if "vang" in text:
        return "V"
    return None


@router.get("")
def list_paper_materials(
    search: str = Query(default=""),
    ma_nhom_id: int | None = Query(default=None),
    ma_nsx_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=5000),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(PaperMaterial).filter(PaperMaterial.su_dung.is_(True))
    if search:
        like = f"%{search}%"
        q = q.filter(
            PaperMaterial.ma_chinh.ilike(like)
            | PaperMaterial.ten.ilike(like)
            | PaperMaterial.ma_ky_hieu.ilike(like)
        )
    if ma_nhom_id is not None:
        q = q.filter(PaperMaterial.ma_nhom_id == ma_nhom_id)
    if ma_nsx_id is not None:
        q = q.filter(PaperMaterial.ma_nsx_id == ma_nsx_id)
    total = q.count()
    items = q.order_by(PaperMaterial.ma_chinh).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [
            {
                "id": p.id,
                "ma_chinh": p.ma_chinh,
                "ma_amis": p.ma_amis,
                "ma_nhom_id": p.ma_nhom_id,
                "ten": p.ten,
                "ten_viet_tat": p.ten_viet_tat,
                "dvt": p.dvt,
                "kho": p.kho,
                "ma_ky_hieu": p.ma_ky_hieu,
                "loai_giay": p.loai_giay,
                "ma_dong_cap": p.ma_dong_cap,
                "dinh_luong": p.dinh_luong,
                "ma_nsx_id": p.ma_nsx_id,
                "gia_mua": p.gia_mua,
                "gia_ban": p.gia_ban,
                "gia_dinh_muc": p.gia_dinh_muc,
                "do_buc_tb": p.do_buc_tb,
                "do_nen_vong_tb": p.do_nen_vong_tb,
                "ton_toi_thieu": p.ton_toi_thieu,
                "ton_toi_da": p.ton_toi_da,
                "la_cuon": p.la_cuon,
                "su_dung": p.su_dung,
                "ten_nhom": p.nhom.ten_nhom if p.nhom else None,
                "ten_nsx": p.nsx.ten_viet_tat if p.nsx else None,
            }
            for p in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/import-template")
def download_paper_material_import_template(
    _: User = Depends(get_current_user),
):
    return build_template_response("mau_import_nguyen_lieu_giay.xlsx", PAPER_MATERIAL_IMPORT_FIELDS)


@router.post("/import")
async def import_paper_materials(
    commit: bool = Query(default=False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("master.import")),
):
    return await import_excel(
        db=db,
        file=file,
        model=PaperMaterial,
        fields=PAPER_MATERIAL_IMPORT_FIELDS,
        key_field="ma_chinh",
        commit=commit,
        resolver=_resolve_paper_material_import_row,
        user=current_user,
        loai_du_lieu="vat_tu_giay",
    )


@router.post("", response_model=PaperMaterialResponse, status_code=201)
def create_paper_material(
    data: PaperMaterialCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if db.query(PaperMaterial).filter(PaperMaterial.ma_chinh == data.ma_chinh).first():
        raise HTTPException(status_code=400, detail=f"Mã '{data.ma_chinh}' đã tồn tại")
    obj = PaperMaterial(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _to_response(obj)


@router.put("/{id}", response_model=PaperMaterialResponse)
def update_paper_material(
    id: int,
    data: PaperMaterialUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(PaperMaterial).filter(PaperMaterial.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy nguyên liệu giấy")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return _to_response(obj)


@router.get("/options")
def get_paper_options(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Trả về danh sách mã ký hiệu đồng cấp và định lượng để chọn lớp giấy.
    by_mk: { "VB": [120, 125, 150], "GB": [150, 185, 200], ... }
    """
    rows = (
        db.query(PaperMaterial.ma_ky_hieu, PaperMaterial.dinh_luong)
        .filter(
            PaperMaterial.su_dung.is_(True),
            PaperMaterial.ma_ky_hieu.isnot(None),
            PaperMaterial.dinh_luong.isnot(None),
        )
        .distinct()
        .order_by(PaperMaterial.ma_ky_hieu, PaperMaterial.dinh_luong)
        .all()
    )
    by_mk: dict[str, list[float]] = {}
    for mk, dl in rows:
        by_mk.setdefault(mk, []).append(float(dl))
    papers = (
        db.query(PaperMaterial)
        .filter(
            PaperMaterial.su_dung.is_(True),
            PaperMaterial.ma_ky_hieu.isnot(None),
        )
        .order_by(PaperMaterial.ma_ky_hieu, PaperMaterial.dinh_luong)
        .all()
    )
    paper_codes: dict[str, str] = {}
    raw_to_mk: dict[str, str] = {}
    gia_ban_map: dict[str, float] = {}
    for p in papers:
        mk = (p.ma_ky_hieu or "").strip()
        if not mk:
            continue
        dl_key = "" if p.dinh_luong is None else format(Decimal(str(p.dinh_luong)).normalize(), "f")
        suffix = _paper_suffix(p.ten_viet_tat or p.ten)
        code = f"{mk}-{suffix}" if suffix else mk
        paper_codes.setdefault(f"{mk}|{dl_key}", code)
        paper_codes.setdefault(f"{mk}|", code)
        if p.ma_chinh:
            raw_to_mk[p.ma_chinh] = mk
        # gia_ban_map: "GC|175" → gia_ban (đ/kg), dùng để tính don_gia_m2 tự động
        if p.dinh_luong is not None and float(p.gia_ban or 0) > 0:
            key = f"{mk}|{dl_key}"
            # Ưu tiên gia_ban cao hơn nếu có nhiều record cùng (mk, dl)
            existing = gia_ban_map.get(key, 0)
            gia_ban_val = float(p.gia_ban)
            if gia_ban_val > existing:
                gia_ban_map[key] = gia_ban_val
    return {
        "ma_ky_hieu": sorted(by_mk.keys()),
        "by_mk": by_mk,
        "paper_codes": paper_codes,
        "raw_to_mk": raw_to_mk,
        "gia_ban_map": gia_ban_map,
    }


@router.get("/search")
def search_paper_materials(
    q: str = Query(default=""),
    limit: int = Query(default=20, le=50),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Quick search for autocomplete."""
    like = f"%{q}%"
    items = (
        db.query(PaperMaterial)
        .filter(
            PaperMaterial.su_dung.is_(True),
            (PaperMaterial.ma_chinh.ilike(like) | PaperMaterial.ten.ilike(like) | PaperMaterial.ma_ky_hieu.ilike(like))
        )
        .order_by(PaperMaterial.ma_chinh)
        .limit(limit)
        .all()
    )
    return [
        {
            "value": p.ma_chinh,
            "label": f"{p.ma_chinh} – {p.ten}",
            "ma_ky_hieu": p.ma_ky_hieu,
            "ma_ky_hieu_mau": (
                f"{p.ma_ky_hieu}-{_paper_suffix(p.ten_viet_tat or p.ten)}"
                if p.ma_ky_hieu and _paper_suffix(p.ten_viet_tat or p.ten)
                else p.ma_ky_hieu
            ),
            "ma_dong_cap": p.ma_dong_cap,
            "dinh_luong": float(p.dinh_luong) if p.dinh_luong else None,
        }
        for p in items
    ]


# ---------------------------------------------------------------------------
# Sync giá NVL từ SQL Server HTCPH
# ---------------------------------------------------------------------------

class SyncGiaMuaResult(_BaseModel):
    total_htcph: int
    matched: int
    updated: int
    not_found: list[dict]
    preview: list[dict]


@router.post("/sync-gia-mua-htcph", response_model=SyncGiaMuaResult)
def sync_gia_mua_from_htcph(
    dry_run: bool = Query(default=True, description="True=preview, False=áp dụng"),
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("admin.paper_materials")),
):
    """
    Lấy đơn giá mua mới nhất từ DT42 (phiếu nhập kho) trong SQL Server HTCPH,
    khớp theo DMNL.KyHieu + DMNL.DL với PaperMaterial.ma_ky_hieu + dinh_luong,
    rồi cập nhật gia_mua.

    dry_run=True (default): chỉ preview, không ghi DB.
    dry_run=False: áp dụng thực sự.
    """
    try:
        import pymssql
    except ImportError:
        raise HTTPException(status_code=500, detail="pymssql chưa được cài. Chạy: pip install pymssql")

    from app.config import settings

    try:
        conn = pymssql.connect(
            server=settings.HTCPH_HOST,
            port=settings.HTCPH_PORT,
            user=settings.HTCPH_USER,
            password=settings.HTCPH_PASSWORD,
            database=settings.HTCPH_DB,
            timeout=20,
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Không kết nối được SQL Server HTCPH: {exc}")

    try:
        cur = conn.cursor(as_dict=True)
        # Lấy giá nhập kho mới nhất per (KyHieu, DL) từ DT42 + MT42 + DMNL
        cur.execute("""
            WITH ranked AS (
                SELECT
                    nl.KyHieu,
                    nl.DL,
                    d.DonGia,
                    m.NgayCT,
                    ROW_NUMBER() OVER (
                        PARTITION BY nl.KyHieu, nl.DL
                        ORDER BY m.NgayCT DESC, m.MT42ID DESC
                    ) AS rn
                FROM DT42 d
                JOIN MT42 m ON d.MT42ID = m.MT42ID
                JOIN DMNL nl ON d.MaNL = nl.Ma
                WHERE d.DonGia > 0
                  AND nl.KyHieu IS NOT NULL
                  AND nl.KyHieu <> ''
                  AND nl.DL IS NOT NULL
                  AND nl.Cuon = 1
            )
            SELECT KyHieu, DL, DonGia, NgayCT
            FROM ranked
            WHERE rn = 1
        """)
        htcph_prices = cur.fetchall()
    finally:
        conn.close()

    preview = []
    not_found = []
    updated_count = 0

    for row in htcph_prices:
        ky_hieu = (row["KyHieu"] or "").strip()
        dl = row["DL"]
        don_gia = row["DonGia"]
        ngay_ct = row["NgayCT"]

        if not ky_hieu or dl is None or not don_gia:
            continue

        dl_dec = Decimal(str(dl))
        don_gia_dec = Decimal(str(don_gia)).quantize(Decimal("1"))

        papers = (
            db.query(PaperMaterial)
            .filter(
                PaperMaterial.ma_ky_hieu == ky_hieu,
                PaperMaterial.dinh_luong == dl_dec,
                PaperMaterial.su_dung == True,
            )
            .all()
        )

        if not papers:
            not_found.append({"ky_hieu": ky_hieu, "dl": float(dl), "don_gia": float(don_gia), "ngay_ct": str(ngay_ct)})
            continue

        for p in papers:
            gia_cu = float(p.gia_mua or 0)
            preview.append({
                "ma_chinh": p.ma_chinh,
                "ma_ky_hieu": ky_hieu,
                "dinh_luong": float(dl),
                "gia_mua_cu": gia_cu,
                "gia_mua_moi": float(don_gia_dec),
                "ngay_ct_htcph": str(ngay_ct),
                "thay_doi": gia_cu != float(don_gia_dec),
            })
            if not dry_run and gia_cu != float(don_gia_dec):
                p.gia_mua = don_gia_dec
                updated_count += 1

    if not dry_run and updated_count:
        db.commit()

    matched = len([x for x in preview])
    return SyncGiaMuaResult(
        total_htcph=len(htcph_prices),
        matched=matched,
        updated=updated_count if not dry_run else 0,
        not_found=not_found,
        preview=preview,
    )


# ---------------------------------------------------------------------------
# Tính giá bán giấy = max(gia_mua) trong cùng (ma_ky_hieu, dinh_luong) × 1.05
# ---------------------------------------------------------------------------

class UpdateGiaBanResult(_BaseModel):
    groups: int
    updated: int
    preview: list[dict]


@router.post("/update-gia-ban", response_model=UpdateGiaBanResult)
def update_gia_ban(
    dry_run: bool = Query(default=True, description="True=preview, False=áp dụng"),
    markup_pct: float = Query(default=5.0, description="% tăng trên giá mua cao nhất, mặc định 5%"),
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("admin.paper_materials")),
):
    """
    Tính gia_ban cho từng loại giấy:
      gia_ban = max(gia_mua trong cùng ma_ky_hieu + dinh_luong) × (1 + markup_pct/100)

    dry_run=True (default): chỉ preview, không ghi DB.
    dry_run=False: áp dụng thực sự.
    """
    from sqlalchemy import func

    # Tính max(gia_mua) per (ma_ky_hieu, dinh_luong)
    max_per_group = (
        db.query(
            PaperMaterial.ma_ky_hieu,
            PaperMaterial.dinh_luong,
            func.max(PaperMaterial.gia_mua).label("max_gia_mua"),
        )
        .filter(
            PaperMaterial.ma_ky_hieu.isnot(None),
            PaperMaterial.dinh_luong.isnot(None),
            PaperMaterial.gia_mua > 0,
        )
        .group_by(PaperMaterial.ma_ky_hieu, PaperMaterial.dinh_luong)
        .all()
    )

    multiplier = Decimal(str(1 + markup_pct / 100))
    preview: list[dict] = []
    updated_count = 0

    for mk, dl, max_gia in max_per_group:
        gia_ban_moi = (Decimal(str(max_gia)) * multiplier).quantize(Decimal("1"))
        preview.append({
            "ma_ky_hieu": mk,
            "dinh_luong": float(dl),
            "max_gia_mua": float(max_gia),
            "gia_ban_moi": float(gia_ban_moi),
        })
        if not dry_run:
            papers = (
                db.query(PaperMaterial)
                .filter(
                    PaperMaterial.ma_ky_hieu == mk,
                    PaperMaterial.dinh_luong == dl,
                )
                .all()
            )
            for p in papers:
                p.gia_ban = gia_ban_moi
                updated_count += 1

    if not dry_run and updated_count:
        db.commit()

    return UpdateGiaBanResult(
        groups=len(max_per_group),
        updated=updated_count if not dry_run else 0,
        preview=preview,
    )
