from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from io import BytesIO
import html
import unicodedata
from app.utils.template import apply_template, standard_vars
from typing import Optional, List
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, Body, File, UploadFile
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy import cast, Date
from sqlalchemy.orm import Session, joinedload, selectinload
from app.database import get_db
from app.deps import get_current_user, require_permissions
from app.models.auth import User
from app.models.master import Customer, PhanXuong, PaperMaterial
from app.models.sales import Quote, QuoteItem, SalesOrder, SalesOrderItem
from app.models.system import PrintTemplate, SystemSetting
from app.schemas.master import CustomerShort
from app.schemas.quotes import (
    QuoteCreate, QuoteUpdate,
    QuoteResponse, QuoteListItem, QuoteItemResponse,
)
from app.schemas.sales import PagedResponse
from app.services.excel_import_service import (
    ImportField,
    build_template_response,
    parse_bool,
    parse_date,
    parse_decimal,
    parse_int,
    parse_text,
)
from app.services.price_calculator import calculate_price, calculate_offset_cost
from app.routers.indirect_costs import get_indirect_breakdown_from_db
from app.routers.addon_rates import get_addon_rates_from_db

router = APIRouter(prefix="/api/quotes", tags=["quotes"])


class QuoteItemPriceRequest(BaseModel):
    item: dict


class QuoteItemPriceResponse(BaseModel):
    gia_ban: Decimal
    gia_phoi: Decimal       # a + b + e — giá chuyển kho phôi
    gia_noi_bo: Decimal     # a + b + c + d + e — giá chuyển kho thành phẩm
    warnings: List[str] = []


class TaoDonHangItemOverride(BaseModel):
    id: int
    so_luong: Decimal


class TaoDonHangRequest(BaseModel):
    item_overrides: Optional[List[TaoDonHangItemOverride]] = None


QUOTE_IMPORT_FIELDS = [
    ImportField("so_bao_gia", "Số báo giá", parser=parse_text, help_text="Để trống để tạo số mới dạng BG26-05-0001"),
    ImportField("ngay_bao_gia", "Ngày báo giá", required=True, parser=parse_date, help_text="DD/MM/YYYY"),
    ImportField("ma_kh", "Mã KH", required=True, parser=parse_text, help_text="Mã khách hàng đã có trong danh mục"),
    ImportField("ngay_het_han", "Ngày hết hạn", parser=parse_date),
    ImportField("so_bg_copy", "Số BG copy", parser=parse_text),
    ImportField("ghi_chu_bao_gia", "Ghi chú báo giá", parser=parse_text),
    ImportField("dieu_khoan", "Điều khoản", parser=parse_text),
    ImportField("ma_amis", "Mã hàng", parser=parse_text),
    ImportField("ten_hang", "Tên hàng", required=True, parser=parse_text),
    ImportField("dvt", "ĐVT", parser=parse_text, default="Thung"),
    ImportField("so_luong", "Số lượng", required=True, parser=parse_decimal),
    ImportField("gia_ban_dong", "Giá bán đồng", parser=parse_decimal, default=0),
    ImportField("don_gia_m2", "Đơn giá m2", parser=parse_decimal),
    ImportField("ma_ky_hieu", "Mã ký hiệu", parser=parse_text, help_text="Không bắt buộc, hệ thống tự sinh nếu để trống"),
    ImportField("ghi_chu", "Ghi chú", parser=parse_text),
    ImportField("so_lop", "Số lớp", parser=parse_int, default=3),
    ImportField("to_hop_song", "Tổ hợp sóng", parser=parse_text),
    ImportField("mat", "Mặt", parser=parse_text),
    ImportField("mat_dl", "Mặt ĐL", parser=parse_decimal),
    ImportField("song_1", "Sóng 1", parser=parse_text),
    ImportField("song_1_dl", "Sóng 1 ĐL", parser=parse_decimal),
    ImportField("mat_1", "Mặt 1", parser=parse_text),
    ImportField("mat_1_dl", "Mặt 1 ĐL", parser=parse_decimal),
    ImportField("song_2", "Sóng 2", parser=parse_text),
    ImportField("song_2_dl", "Sóng 2 ĐL", parser=parse_decimal),
    ImportField("mat_2", "Mặt 2", parser=parse_text),
    ImportField("mat_2_dl", "Mặt 2 ĐL", parser=parse_decimal),
    ImportField("song_3", "Sóng 3", parser=parse_text),
    ImportField("song_3_dl", "Sóng 3 ĐL", parser=parse_decimal),
    ImportField("mat_3", "Mặt 3", parser=parse_text),
    ImportField("mat_3_dl", "Mặt 3 ĐL", parser=parse_decimal),
    ImportField("loai_thung", "Loại thùng", parser=parse_text),
    ImportField("dai", "Dài", parser=parse_decimal),
    ImportField("rong", "Rộng", parser=parse_decimal),
    ImportField("cao", "Cao", parser=parse_decimal),
    ImportField("kho_tt", "Khổ TT", parser=parse_decimal),
    ImportField("dai_tt", "Dài TT", parser=parse_decimal),
    ImportField("dien_tich", "Diện tích", parser=parse_decimal),
    ImportField("loai_in", "Loại in", parser=parse_text, default="khong_in"),
    ImportField("so_mau", "Số màu", parser=parse_int, default=0),
    ImportField("do_kho", "Độ khô", parser=parse_bool, default=False),
    ImportField("ghim", "Ghim", parser=parse_bool, default=False),
    ImportField("chap_xa", "Chắp xà", parser=parse_bool, default=False),
    ImportField("do_phu", "Độ phủ", parser=parse_bool, default=False),
    ImportField("dan", "Dán", parser=parse_bool, default=False),
    ImportField("boi", "Bồi", parser=parse_bool, default=False),
    ImportField("be_lo", "Bế lỗ", parser=parse_bool, default=False),
    ImportField("so_c_be", "Số con bế", parser=parse_text),
    ImportField("gia_noi_bo", "Giá nội bộ", parser=parse_decimal, default=0),
]


def _generate_so_bao_gia(db: Session) -> str:
    today = date.today()
    prefix = f"BG{today.strftime('%y-%m')}-"
    last = (
        db.query(Quote)
        .filter(Quote.so_bao_gia.like(f"{prefix}%"))
        .order_by(Quote.so_bao_gia.desc())
        .first()
    )
    seq = int(last.so_bao_gia[-4:]) + 1 if last else 1
    return f"{prefix}{seq:04d}"


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


def _paper_code_map(db: Session) -> dict[tuple[str, str], str]:
    rows = (
        db.query(PaperMaterial)
        .filter(PaperMaterial.su_dung == True, PaperMaterial.ma_ky_hieu.isnot(None))
        .all()
    )
    result: dict[tuple[str, str], str] = {}
    for p in rows:
        base = (p.ma_ky_hieu or "").strip()
        if not base:
            continue
        dl_key = _decimal_key(p.dinh_luong)
        suffix = _paper_suffix(p.ten_viet_tat or p.ten)
        result.setdefault((base, dl_key), f"{base}-{suffix}" if suffix else base)
        result.setdefault((base, ""), f"{base}-{suffix}" if suffix else base)
    return result


def _decimal_key(value) -> str:
    if value is None:
        return ""
    dec = Decimal(str(value))
    return format(dec.normalize(), "f")


def _build_ma_ky_hieu(item: QuoteItem | dict, paper_codes: dict[tuple[str, str], str] | None = None) -> str | None:
    def get(name: str):
        return item.get(name) if isinstance(item, dict) else getattr(item, name)

    layers = [
        ("mat", "mat_dl"),
        ("song_1", "song_1_dl"),
        ("mat_1", "mat_1_dl"),
        ("song_2", "song_2_dl"),
        ("mat_2", "mat_2_dl"),
        ("song_3", "song_3_dl"),
        ("mat_3", "mat_3_dl"),
    ]
    parts: list[str] = []
    for code_field, _dl_field in layers:
        code = get(code_field)
        if not code:
            continue
        base = str(code).strip()
        parts.append(base)
    return ".".join(parts) or None


def _item_get(item: QuoteItem | dict, name: str):
    return item.get(name) if isinstance(item, dict) else getattr(item, name)


def _parse_mat_field(value) -> int:
    text = _strip_accents(str(value or "")).strip()
    if text in ("2", "2 mat", "hai mat"):
        return 2
    if text in ("1", "1 mat", "mot mat"):
        return 1
    return 0


def _parse_so_con(value) -> int:
    if value is None:
        return 0
    text = str(value).strip()
    digits = "".join(ch for ch in text if ch.isdigit())
    num = int(digits) if digits else 0
    return num if num in (1, 2, 4, 6, 8) else 0


def _resolve_quote_layer(code, dl, loai_lop: str, vi_tri_lop: str, db: Session) -> dict:
    if not code or not dl:
        raise ValueError(f"Thieu ma giay/dinh luong lop {vi_tri_lop}")
    base = str(code).strip()
    candidates = [base]
    if "-" in base:
        candidates.append(base.split("-", 1)[0])
    query = db.query(PaperMaterial).filter(
        PaperMaterial.su_dung == True,
        PaperMaterial.ma_ky_hieu.in_(candidates),
    )
    paper = query.filter(PaperMaterial.dinh_luong == Decimal(str(dl))).first()
    if not paper:
        paper = query.order_by(PaperMaterial.dinh_luong.asc()).first()
    if not paper:
        raise ValueError(f"Khong tim thay giay {base} {dl}gsm")
    return {
        "vi_tri_lop": vi_tri_lop,
        "loai_lop": loai_lop,
        "flute_type": None,
        "ma_ky_hieu": base,
        "paper_material_id": paper.id,
        "dinh_luong": float(dl),
        "don_gia_kg": float(paper.gia_ban or paper.gia_mua or 0),
    }


def _quote_layers(item: QuoteItem | dict, db: Session) -> list[dict]:
    so_lop = int(_item_get(item, "so_lop") or 3)
    layer_defs = [
        ("Mặt", "mat", "mat", "mat_dl"),
        ("Sóng 1", "song", "song_1", "song_1_dl"),
        ("Mặt 1", "mat", "mat_1", "mat_1_dl"),
    ]
    if so_lop >= 5:
        layer_defs.extend([
            ("Sóng 2", "song", "song_2", "song_2_dl"),
            ("Mặt 2", "mat", "mat_2", "mat_2_dl"),
        ])
    if so_lop >= 7:
        layer_defs.extend([
            ("Sóng 3", "song", "song_3", "song_3_dl"),
            ("Mặt 3", "mat", "mat_3", "mat_3_dl"),
        ])
    return [
        _resolve_quote_layer(_item_get(item, code_field), _item_get(item, dl_field), loai_lop, label, db)
        for label, loai_lop, code_field, dl_field in layer_defs
    ]


def _calc_offset_addon(item: QuoteItem | dict, qty: float) -> float:
    """Tính chi phí tem offset per cái, trả về 0 nếu co_tem_offset=False."""
    if not _item_get(item, "co_tem_offset"):
        return 0.0
    result = calculate_offset_cost(
        qty=qty,
        tem_loai_giay=_item_get(item, "tem_loai_giay"),
        tem_gsm=float(_item_get(item, "tem_gsm") or 0) or None,
        tem_don_gia_kg=float(_item_get(item, "tem_don_gia_kg") or 0) or None,
        tem_dai_to=float(_item_get(item, "tem_dai_to") or 0) or None,
        tem_rong_to=float(_item_get(item, "tem_rong_to") or 0) or None,
        tem_sp_per_to=int(_item_get(item, "tem_sp_per_to") or 2),
        tem_waste_to=int(_item_get(item, "tem_waste_to") or 150),
        tem_so_mau=int(_item_get(item, "tem_so_mau") or 0),
        tem_gia_kem_mau=float(_item_get(item, "tem_gia_kem_mau") or 0) or None,
        tem_gia_in_1000to=float(_item_get(item, "tem_gia_in_1000to") or 0) or None,
        tem_co_can_mang=bool(_item_get(item, "tem_co_can_mang")),
        tem_gia_can_mang_m2=float(_item_get(item, "tem_gia_can_mang_m2") or 0) or None,
        tem_co_khuon_be=bool(_item_get(item, "tem_co_khuon_be")),
        tem_gia_khuon_be=float(_item_get(item, "tem_gia_khuon_be") or 0) or None,
        tem_khuon_be_phan_bo=int(_item_get(item, "tem_khuon_be_phan_bo") or 10000),
        tem_co_uv=bool(_item_get(item, "tem_co_uv")),
        tem_gia_uv_m2=float(_item_get(item, "tem_gia_uv_m2") or 0) or None,
        tem_co_suppo=bool(_item_get(item, "tem_co_suppo")),
        tem_gia_suppo_m2=float(_item_get(item, "tem_gia_suppo_m2") or 0) or None,
        tem_co_luoi=bool(_item_get(item, "tem_co_luoi")),
        tem_gia_luoi_m2=float(_item_get(item, "tem_gia_luoi_m2") or 0) or None,
        tem_hai_manh=bool(_item_get(item, "tem_hai_manh")),
        tem_khac_thiet_ke=bool(_item_get(item, "tem_khac_thiet_ke")),
    )
    return result["gia_ban_tem_per_cai"]


def _quote_item_price(item: QuoteItem | dict, db: Session) -> Decimal:
    _zero = {"gia_ban": Decimal("0"), "gia_phoi": Decimal("0"), "gia_noi_bo": Decimal("0")}
    so_lop = int(_item_get(item, "so_lop") or 0)
    co_tem_offset = bool(_item_get(item, "co_tem_offset"))
    so_luong = float(_item_get(item, "so_luong") or 0)
    loai_thung = (_item_get(item, "loai_thung") or "A1").upper()
    if loai_thung == "LOT":
        loai_thung = "TAM"

    # Case B: offset thuần (so_lop không phải 3/5/7, nhưng có co_tem_offset)
    if so_lop not in (3, 5, 7):
        if co_tem_offset and so_luong > 0:
            offset_per_cai = _calc_offset_addon(item, so_luong)
            gia = Decimal(str(offset_per_cai)).quantize(Decimal("1"))
            return {"gia_ban": gia, "gia_phoi": gia, "gia_noi_bo": gia}
        return _zero

    if loai_thung == "KHAC":
        return _zero
    if not (_item_get(item, "dai") and _item_get(item, "rong") and _item_get(item, "to_hop_song")):
        return _zero

    # Case A / C: corrugated (+ optional offset add-on)
    loai_in = _item_get(item, "loai_in")
    calc_input = {
        "loai_thung": loai_thung,
        "dai": float(_item_get(item, "dai") or 0),
        "rong": float(_item_get(item, "rong") or 0),
        "cao": float(_item_get(item, "cao") or 0),
        "so_lop": so_lop,
        "to_hop_song": _item_get(item, "to_hop_song"),
        "so_luong": so_luong,
        "layers": _quote_layers(item, db),
        "chong_tham": _parse_mat_field(_item_get(item, "c_tham")),
        "in_flexo_mau": int(_item_get(item, "so_mau") or 0) if loai_in == "flexo" else 0,
        "in_flexo_phu_nen": bool(_item_get(item, "do_phu")),
        "in_ky_thuat_so": loai_in == "ky_thuat_so",
        "chap_xa": bool(_item_get(item, "chap_xa")),
        "boi": bool(_item_get(item, "boi")),
        "be_so_con": _parse_so_con(_item_get(item, "so_c_be")),
        "dan": bool(_item_get(item, "dan")),
        "ghim": bool(_item_get(item, "ghim")),
        "can_mang": _parse_mat_field(_item_get(item, "can_man")),
        "san_pham_kho": bool(_item_get(item, "do_kho")),
        "ty_le_loi_nhuan": None,
        "hoa_hong_kd_pct": 0.0,
        "hoa_hong_kh_pct": 0.0,
        "chi_phi_khac": 0.0,
        "chiet_khau": 0.0,
        "don_gia_m2_override": float(_item_get(item, "don_gia_m2") or 0),
    }
    indirect_bd = get_indirect_breakdown_from_db(so_lop, db)
    addon_rates_db = get_addon_rates_from_db(db)
    result = calculate_price(calc_input, indirect_breakdown=indirect_bd, addon_rates=addon_rates_db)
    # gia_phoi   = a + b + e  — giá chuyển kho phôi (chưa có add-on in/bế/dán, chưa lợi nhuận)
    # gia_noi_bo = a + b + c + d + e = gia_ban_co_ban — giá chuyển kho thành phẩm

    offset_addon = _calc_offset_addon(item, so_luong) if co_tem_offset else 0.0

    return {
        "gia_ban":   Decimal(str(result["gia_ban_cuoi"] + offset_addon)).quantize(Decimal("1")),
        "gia_phoi":  Decimal(str(result["gia_phoi"])).quantize(Decimal("1")),
        "gia_noi_bo": Decimal(str(result["gia_ban_co_ban"])).quantize(Decimal("1")),
    }


def _build_response(quote: Quote) -> QuoteResponse:
    return QuoteResponse(
        id=quote.id,
        so_bao_gia=quote.so_bao_gia,
        so_bg_copy=quote.so_bg_copy,
        ngay_bao_gia=quote.ngay_bao_gia,
        customer_id=quote.customer_id,
        customer=CustomerShort.model_validate(quote.customer) if quote.customer else None,
        phap_nhan_id=quote.phap_nhan_id,
        ten_phap_nhan=quote.phap_nhan.ten_phap_nhan if quote.phap_nhan else None,
        phap_nhan_sx_id=quote.phap_nhan_sx_id,
        ten_phap_nhan_sx=quote.phap_nhan_sx.ten_phap_nhan if quote.phap_nhan_sx else None,
        phan_xuong_id=quote.phan_xuong_id,
        ten_phan_xuong=quote.phan_xuong.ten_xuong if quote.phan_xuong else None,
        nv_phu_trach_id=quote.nv_phu_trach_id,
        ten_nv_phu_trach=quote.nv_phu_trach.ho_ten if quote.nv_phu_trach else None,
        nv_theo_doi_id=quote.nv_theo_doi_id,
        ten_nv_theo_doi=quote.nv_theo_doi.ho_ten if quote.nv_theo_doi else None,
        nguoi_duyet_id=quote.approved_by,
        ten_nguoi_duyet=quote.approver.ho_ten if quote.approver else None,
        approved_at=quote.approved_at,
        created_by=quote.created_by,
        created_by_name=quote.creator.ho_ten if quote.creator else None,
        ngay_het_han=quote.ngay_het_han,
        chi_phi_bang_in=quote.chi_phi_bang_in,
        chi_phi_khuon=quote.chi_phi_khuon,
        chi_phi_van_chuyen=quote.chi_phi_van_chuyen,
        tong_tien_hang=quote.tong_tien_hang,
        ty_le_vat=quote.ty_le_vat,
        tien_vat=quote.tien_vat,
        chi_phi_hang_hoa_dv=quote.chi_phi_hang_hoa_dv,
        tong_cong=quote.tong_cong,
        chi_phi_khac_1_ten=quote.chi_phi_khac_1_ten,
        chi_phi_khac_1=quote.chi_phi_khac_1,
        chi_phi_khac_2_ten=quote.chi_phi_khac_2_ten,
        chi_phi_khac_2=quote.chi_phi_khac_2,
        chiet_khau=quote.chiet_khau,
        gia_ban=quote.gia_ban,
        gia_xuat_phoi_vsp=quote.gia_xuat_phoi_vsp,
        ghi_chu=quote.ghi_chu,
        dieu_khoan=quote.dieu_khoan,
        trang_thai=quote.trang_thai,
        created_at=quote.created_at,
        updated_at=quote.updated_at,
        items=[QuoteItemResponse.model_validate(i) for i in quote.items],
    )


def _load_quote(quote_id: int, db: Session) -> Quote:
    quote = (
        db.query(Quote)
        .options(
            joinedload(Quote.customer),
            joinedload(Quote.items).joinedload(QuoteItem.phan_xuong),
            joinedload(Quote.phap_nhan),
            joinedload(Quote.phap_nhan_sx),
            joinedload(Quote.phan_xuong),
            joinedload(Quote.nv_phu_trach),
            joinedload(Quote.nv_theo_doi),
            joinedload(Quote.approver),
            joinedload(Quote.creator),
        )
        .filter(Quote.id == quote_id)
        .first()
    )
    if not quote:
        raise HTTPException(status_code=404, detail="Không tìm thấy báo giá")
    return quote


def _recalc_totals(quote: Quote) -> None:
    """Tính lại tổng tiền hàng, tiền VAT và tổng cộng từ các dòng hàng (in-place)."""
    tong_tien = sum(
        (
            Decimal(str(item.gia_ban or 0)) * Decimal(str(item.so_luong or 0))
            for item in quote.items
        ),
        Decimal("0"),
    )
    ty_le = Decimal(str(quote.ty_le_vat or 8))
    tien_vat = (tong_tien * ty_le / 100).quantize(Decimal("1"))
    chi_phi_hh_dv = tong_tien + tien_vat
    tong_cong = (
        chi_phi_hh_dv
        + Decimal(str(quote.chi_phi_bang_in or 0))
        + Decimal(str(quote.chi_phi_khuon or 0))
        + Decimal(str(quote.chi_phi_van_chuyen or 0))
        + Decimal(str(quote.chi_phi_khac_1 or 0))
        + Decimal(str(quote.chi_phi_khac_2 or 0))
        - Decimal(str(quote.chiet_khau or 0))
    )
    quote.tong_tien_hang = tong_tien.quantize(Decimal("1"))
    quote.tien_vat = tien_vat
    quote.chi_phi_hang_hoa_dv = chi_phi_hh_dv.quantize(Decimal("1"))
    quote.tong_cong = tong_cong.quantize(Decimal("1"))


def _auto_expire_quotes(db: Session) -> None:
    """Chuyển BG quá ngày hết hạn sang trạng thái het_han (lazy, gọi khi list)."""
    try:
        today = date.today()
        (
            db.query(Quote)
            .filter(
                Quote.trang_thai.in_(["moi", "cho_duyet", "da_duyet"]),
                Quote.ngay_het_han < today,
                Quote.ngay_het_han.isnot(None),
            )
            .update({"trang_thai": "het_han"}, synchronize_session=False)
        )
        db.commit()
    except Exception:
        db.rollback()


_MANAGER_ROLES = {"ADMIN", "GIAM_DOC", "TRUONG_PHONG_SALE_ADMIN"}


def _check_quote_owner_or_manager(quote: Quote, user: User) -> None:
    role_code = user.role.ma_vai_tro if user.role else None
    if quote.created_by != user.id and role_code not in _MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Không có quyền thao tác báo giá này")


def _log_quote_history(
    quote: Quote,
    action: str,
    user: "User | None",
    db: Session,
    old_status: str | None = None,
    new_status: str | None = None,
    old_tong_cong=None,
    new_tong_cong=None,
    note: str | None = None,
) -> None:
    from app.models.sales import QuoteHistory
    entry = QuoteHistory(
        quote_id=quote.id,
        changed_by=user.id if user else None,
        action=action,
        old_status=old_status,
        new_status=new_status,
        old_tong_cong=old_tong_cong,
        new_tong_cong=new_tong_cong,
        note=note,
    )
    db.add(entry)


@router.get("", response_model=PagedResponse)
def list_quotes(
    search: str = Query(default=""),
    trang_thai: str | None = Query(default=None),
    customer_id: int | None = Query(default=None),
    created_by: int | None = Query(default=None),
    phap_nhan_id: int | None = Query(default=None),
    tu_ngay: date | None = Query(default=None),
    den_ngay: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _auto_expire_quotes(db)
    q = db.query(Quote).options(
        joinedload(Quote.customer),
        joinedload(Quote.creator),
        joinedload(Quote.phap_nhan),
        selectinload(Quote.items),
    )
    if search:
        like = f"%{search}%"
        q = q.join(Customer).filter(
            Quote.so_bao_gia.ilike(like) | Customer.ten_viet_tat.ilike(like)
        )
    if trang_thai:
        q = q.filter(Quote.trang_thai == trang_thai)
    if customer_id:
        q = q.filter(Quote.customer_id == customer_id)
    if created_by:
        q = q.filter(Quote.created_by == created_by)
    if phap_nhan_id:
        q = q.filter(Quote.phap_nhan_id == phap_nhan_id)
    if tu_ngay:
        q = q.filter(Quote.ngay_bao_gia >= tu_ngay)
    if den_ngay:
        q = q.filter(Quote.ngay_bao_gia <= den_ngay)

    total = q.count()
    quotes = q.order_by(Quote.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = [
        QuoteListItem(
            id=qt.id,
            so_bao_gia=qt.so_bao_gia,
            ngay_bao_gia=qt.ngay_bao_gia,
            customer_id=qt.customer_id,
            ten_khach_hang=qt.customer.ten_viet_tat if qt.customer else None,
            trang_thai=qt.trang_thai,
            ngay_het_han=qt.ngay_het_han,
            tong_cong=qt.tong_cong,
            so_dong=len(qt.items),
            created_at=qt.created_at,
            created_by_name=qt.creator.ho_ten if qt.creator else None,
            phap_nhan_id=qt.phap_nhan_id,
            ten_phap_nhan=qt.phap_nhan.ten_phap_nhan if qt.phap_nhan else None,
        )
        for qt in quotes
    ]
    return PagedResponse(
        items=items, total=total, page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.post("/calculate-item-price", response_model=QuoteItemPriceResponse)
def calculate_quote_item_price(
    payload: QuoteItemPriceRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    try:
        result = _quote_item_price(payload.item, db)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    warnings: List[str] = []
    if result["gia_ban"] == Decimal("0"):
        item = payload.item
        missing = [
            field
            for field in ("dai", "rong", "to_hop_song", "so_lop")
            if not item.get(field)
        ]
        if missing:
            warnings.append(f"Thiếu thông số: {', '.join(missing)} — giá = 0")
        else:
            warnings.append("Không tìm thấy giấy phù hợp — giá = 0")

    return QuoteItemPriceResponse(**result, warnings=warnings)


@router.get("/counts")
def get_quote_counts(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from sqlalchemy import func
    rows = (
        db.query(Quote.trang_thai, func.count(Quote.id))
        .group_by(Quote.trang_thai)
        .all()
    )
    return {trang_thai: count for trang_thai, count in rows}


@router.get("/import-template")
def download_quote_import_template(_: User = Depends(get_current_user)):
    return build_template_response("mau_import_bao_gia.xlsx", QUOTE_IMPORT_FIELDS)


def _column_map(columns) -> dict[str, str]:
    normalized = {str(col).strip().lower().replace(" ", "_"): col for col in columns}
    result: dict[str, str] = {}
    for field in QUOTE_IMPORT_FIELDS:
        for candidate in (field.label, field.name, *field.aliases):
            key = str(candidate).strip().lower().replace(" ", "_")
            if key in normalized:
                result[field.name] = normalized[key]
                break
    return result


def _parse_quote_import_row(source, column_map: dict[str, str]) -> tuple[dict, list[str]]:
    values: dict = {}
    errors: list[str] = []
    for field in QUOTE_IMPORT_FIELDS:
        raw_value = source[column_map[field.name]] if field.name in column_map else None
        try:
            parsed = field.parser(raw_value) if field.parser else parse_text(raw_value)
        except ValueError as exc:
            errors.append(f"{field.label}: {exc}")
            parsed = None
        if parsed is None and field.default is not None:
            parsed = field.default() if callable(field.default) else field.default
        if field.required and (parsed is None or parsed == ""):
            errors.append(f"{field.label}: bat buoc")
        if parsed is not None:
            values[field.name] = parsed
    return values, errors


def _quote_item_from_import(values: dict, stt: int, paper_codes: dict[tuple[str, str], str], db: Session) -> dict:
    item = {
        "stt": stt,
        "ma_amis": values.get("ma_amis"),
        "ten_hang": values.get("ten_hang") or "",
        "dvt": values.get("dvt") or "Thung",
        "so_luong": values.get("so_luong") or Decimal("0"),
        "don_gia_m2": values.get("don_gia_m2"),
        "gia_ban": values.get("gia_ban_dong") or Decimal("0"),
        "ma_ky_hieu": values.get("ma_ky_hieu"),
        "ghi_chu": values.get("ghi_chu"),
        "so_lop": values.get("so_lop") or 3,
        "to_hop_song": values.get("to_hop_song"),
        "mat": values.get("mat"),
        "mat_dl": values.get("mat_dl"),
        "song_1": values.get("song_1"),
        "song_1_dl": values.get("song_1_dl"),
        "mat_1": values.get("mat_1"),
        "mat_1_dl": values.get("mat_1_dl"),
        "song_2": values.get("song_2"),
        "song_2_dl": values.get("song_2_dl"),
        "mat_2": values.get("mat_2"),
        "mat_2_dl": values.get("mat_2_dl"),
        "song_3": values.get("song_3"),
        "song_3_dl": values.get("song_3_dl"),
        "mat_3": values.get("mat_3"),
        "mat_3_dl": values.get("mat_3_dl"),
        "loai_thung": values.get("loai_thung"),
        "dai": values.get("dai"),
        "rong": values.get("rong"),
        "cao": values.get("cao"),
        "kho_tt": values.get("kho_tt"),
        "dai_tt": values.get("dai_tt"),
        "dien_tich": values.get("dien_tich"),
        "loai_in": values.get("loai_in") or "khong_in",
        "so_mau": values.get("so_mau") or 0,
        "do_kho": bool(values.get("do_kho") or False),
        "ghim": bool(values.get("ghim") or False),
        "chap_xa": bool(values.get("chap_xa") or False),
        "do_phu": bool(values.get("do_phu") or False),
        "dan": bool(values.get("dan") or False),
        "boi": bool(values.get("boi") or False),
        "be_lo": bool(values.get("be_lo") or False),
        "so_c_be": values.get("so_c_be"),
    }
    item["ma_ky_hieu"] = item["ma_ky_hieu"] or _build_ma_ky_hieu(item, paper_codes)
    if not item["gia_ban"]:
        try:
            item["gia_ban"] = _quote_item_price(item, db)["gia_ban"]
        except Exception:
            item["gia_ban"] = Decimal("0")
    return item


@router.post("/import")
async def import_quotes(
    commit: bool = Query(default=False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("sales.import")),
):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Chi chap nhan file Excel .xlsx/.xls")
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="File rong")
    try:
        df = pd.read_excel(BytesIO(raw), dtype=object)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Khong doc duoc file Excel: {exc}") from exc
    if df.empty:
        raise HTTPException(status_code=400, detail="File khong co du lieu")

    column_map = _column_map(df.columns)
    missing = [field.label for field in QUOTE_IMPORT_FIELDS if field.required and field.name not in column_map]
    if missing:
        raise HTTPException(status_code=400, detail=f"Thieu cot bat buoc: {', '.join(missing)}")

    paper_codes = _paper_code_map(db)
    groups: dict[str, dict] = {}
    rows = []
    errors_count = skipped = 0

    for idx, source in df.iterrows():
        row_number = int(idx) + 2
        if all(value is None or pd.isna(value) or str(value).strip() == "" for value in source.values):
            skipped += 1
            rows.append({"row": row_number, "status": "skip", "errors": [], "data": {}})
            continue
        values, row_errors = _parse_quote_import_row(source, column_map)
        customer = None
        if values.get("ma_kh"):
            customer = db.query(Customer).filter(Customer.ma_kh == values["ma_kh"]).first()
            if not customer:
                row_errors.append(f"Ma KH: khong ton tai '{values['ma_kh']}'")
        if values.get("so_luong") is not None and values["so_luong"] <= 0:
            row_errors.append("So luong: phai lon hon 0")

        key = values.get("so_bao_gia") or f"__new_{row_number}"
        status = "error" if row_errors else ("update" if values.get("so_bao_gia") and db.query(Quote).filter(Quote.so_bao_gia == values["so_bao_gia"]).first() else "create")
        if row_errors:
            errors_count += 1
        else:
            group = groups.setdefault(key, {"header": values, "customer": customer, "items": []})
            group["items"].append(_quote_item_from_import(values, len(group["items"]) + 1, paper_codes, db))
        rows.append({"row": row_number, "status": status, "errors": row_errors, "data": {k: str(v) for k, v in values.items()}})

    if commit:
        if errors_count:
            raise HTTPException(status_code=400, detail="File con loi, chua import. Hay sua loi va thu lai.")
        for group in groups.values():
            header = group["header"]
            quote = db.query(Quote).filter(Quote.so_bao_gia == header.get("so_bao_gia")).first() if header.get("so_bao_gia") else None
            if quote and quote.trang_thai != "moi":
                raise HTTPException(status_code=400, detail=f"Bao gia {quote.so_bao_gia} khong o trang thai moi")
            if not quote:
                quote = Quote(
                    so_bao_gia=header.get("so_bao_gia") or _generate_so_bao_gia(db),
                    ngay_bao_gia=header["ngay_bao_gia"],
                    customer_id=group["customer"].id,
                    nv_phu_trach_id=current_user.id,
                    created_by=current_user.id,
                    trang_thai="moi",
                )
                db.add(quote)
            quote.ngay_bao_gia = header["ngay_bao_gia"]
            quote.customer_id = group["customer"].id
            quote.ngay_het_han = header.get("ngay_het_han") or (header["ngay_bao_gia"] + timedelta(days=30))
            quote.so_bg_copy = header.get("so_bg_copy")
            quote.ghi_chu = header.get("ghi_chu_bao_gia")
            quote.dieu_khoan = header.get("dieu_khoan")
            quote.gia_xuat_phoi_vsp = header.get("gia_noi_bo") or Decimal("0")
            for old in quote.items:
                db.delete(old)
            db.flush()
            tong_tien = Decimal("0")
            tong_so_luong = Decimal("0")
            for item in group["items"]:
                quote.items.append(QuoteItem(**item))
                tong_tien += item["so_luong"] * item["gia_ban"]
                tong_so_luong += item["so_luong"]
            quote.tong_tien_hang = tong_tien
            quote.chi_phi_hang_hoa_dv = tong_tien + (tong_tien * (quote.ty_le_vat or Decimal("0")) / Decimal("100"))
            quote.tien_vat = quote.chi_phi_hang_hoa_dv - tong_tien
            quote.tong_cong = quote.chi_phi_hang_hoa_dv
            quote.gia_ban = (tong_tien / tong_so_luong).quantize(Decimal("1")) if tong_so_luong else Decimal("0")
        db.commit()

    created = sum(1 for row in rows if row["status"] == "create")
    updated = sum(1 for row in rows if row["status"] == "update")
    return {
        "commit": commit,
        "total": len(rows),
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "errors": errors_count,
        "rows": rows[:200],
    }


@router.get("/{quote_id}", response_model=QuoteResponse)
def get_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return _build_response(_load_quote(quote_id, db))


@router.post("", response_model=QuoteResponse, status_code=201)
def create_quote(
    data: QuoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    customer = db.query(Customer).filter(Customer.id == data.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")

    so_bao_gia = _generate_so_bao_gia(db)
    paper_codes = _paper_code_map(db)
    quote = Quote(
        so_bao_gia=so_bao_gia,
        so_bg_copy=data.so_bg_copy,
        ngay_bao_gia=data.ngay_bao_gia,
        customer_id=data.customer_id,
        phap_nhan_id=data.phap_nhan_id,
        phap_nhan_sx_id=data.phap_nhan_sx_id,
        phan_xuong_id=data.phan_xuong_id,
        nv_phu_trach_id=data.nv_phu_trach_id or current_user.id,
        nv_theo_doi_id=data.nv_theo_doi_id,
        ngay_het_han=data.ngay_het_han,
        chi_phi_bang_in=data.chi_phi_bang_in,
        chi_phi_khuon=data.chi_phi_khuon,
        chi_phi_van_chuyen=data.chi_phi_van_chuyen,
        tong_tien_hang=data.tong_tien_hang,
        ty_le_vat=data.ty_le_vat,
        tien_vat=data.tien_vat,
        chi_phi_hang_hoa_dv=data.chi_phi_hang_hoa_dv,
        tong_cong=data.tong_cong,
        chi_phi_khac_1_ten=data.chi_phi_khac_1_ten,
        chi_phi_khac_1=data.chi_phi_khac_1,
        chi_phi_khac_2_ten=data.chi_phi_khac_2_ten,
        chi_phi_khac_2=data.chi_phi_khac_2,
        chiet_khau=data.chiet_khau,
        gia_ban=data.gia_ban,
        gia_xuat_phoi_vsp=data.gia_xuat_phoi_vsp,
        ghi_chu=data.ghi_chu,
        dieu_khoan=data.dieu_khoan,
        trang_thai="moi",
        created_by=current_user.id,
    )
    for item_data in data.items:
        item_values = item_data.model_dump()
        item_values["ma_ky_hieu"] = item_values.get("ma_ky_hieu") or _build_ma_ky_hieu(item_values, paper_codes)
        if not item_values.get("gia_ban"):
            try:
                prices = _quote_item_price(item_values, db)
                item_values["gia_ban"]   = prices["gia_ban"]
                item_values["gia_phoi"]  = prices["gia_phoi"]
                item_values["gia_noi_bo"] = prices["gia_noi_bo"]
            except Exception:
                import traceback; traceback.print_exc()
                item_values["gia_ban"] = Decimal("0")
        quote.items.append(QuoteItem(**item_values))

    _recalc_totals(quote)
    db.add(quote)
    db.commit()
    db.refresh(quote)
    _log_quote_history(quote, "created", current_user, db, new_status="moi"); db.commit()
    return _build_response(_load_quote(quote.id, db))


@router.put("/{quote_id}", response_model=QuoteResponse)
def update_quote(
    quote_id: int,
    data: QuoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quote = _load_quote(quote_id, db)
    _check_quote_owner_or_manager(quote, current_user)
    if quote.trang_thai not in ("moi", "cho_duyet"):
        raise HTTPException(status_code=400, detail="Chỉ sửa được báo giá ở trạng thái Mới hoặc Chờ duyệt")

    update_data = data.model_dump(exclude_none=True, exclude={"items"})
    for field, value in update_data.items():
        setattr(quote, field, value)

    if data.items is not None:
        paper_codes = _paper_code_map(db)
        for item in quote.items:
            db.delete(item)
        db.flush()
        for item_data in data.items:
            item_values = item_data.model_dump()
            item_values["ma_ky_hieu"] = item_values.get("ma_ky_hieu") or _build_ma_ky_hieu(item_values, paper_codes)
            if not item_values.get("gia_ban"):
                try:
                    item_values["gia_ban"] = _quote_item_price(item_values, db)["gia_ban"]
                except Exception:
                    import traceback; traceback.print_exc()
                    item_values["gia_ban"] = Decimal("0")
            quote.items.append(QuoteItem(**item_values))

    _recalc_totals(quote)
    db.commit()
    return _build_response(_load_quote(quote_id, db))


@router.patch("/{quote_id}/submit", response_model=QuoteResponse)
def submit_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Gửi báo giá để duyệt — SALE_ADMIN hoặc người tạo BG."""
    quote = _load_quote(quote_id, db)
    if quote.trang_thai != "moi":
        raise HTTPException(status_code=400, detail="Chỉ gửi duyệt được báo giá ở trạng thái Mới")
    if not quote.items:
        raise HTTPException(status_code=400, detail="Báo giá cần có ít nhất 1 mặt hàng")
    quote.trang_thai = "cho_duyet"
    _log_quote_history(quote, "submitted", current_user, db, old_status="moi", new_status="cho_duyet")
    db.commit()
    return _build_response(_load_quote(quote_id, db))


@router.patch("/{quote_id}/approve", response_model=QuoteResponse)
def approve_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role_code = current_user.role.ma_vai_tro if current_user.role else None
    if role_code not in ("ADMIN", "GIAM_DOC", "TRUONG_PHONG_SALE_ADMIN"):
        raise HTTPException(status_code=403, detail="Ban khong co quyen duyet bao gia")
    quote = _load_quote(quote_id, db)
    if quote.trang_thai not in ("moi", "cho_duyet"):
        raise HTTPException(status_code=400, detail="Chỉ duyệt được báo giá ở trạng thái Mới hoặc Chờ duyệt")
    old_status = quote.trang_thai
    quote.trang_thai = "da_duyet"
    quote.approved_by = current_user.id
    quote.approved_at = datetime.now(timezone.utc)
    _log_quote_history(quote, "approved", current_user, db, old_status=old_status, new_status="da_duyet")
    db.commit()
    # Fire-and-forget webhook → Zalo Bot
    import os as _os, threading as _threading
    _webhook_url = _os.getenv("ZALO_BOT_WEBHOOK_URL")
    if _webhook_url:
        import urllib.request as _urllib_req, json as _json
        def _fire_webhook():
            try:
                _req = _urllib_req.Request(
                    _webhook_url,
                    data=_json.dumps({
                        "event": "quote_approved",
                        "quote_id": quote.id,
                        "so_bao_gia": quote.so_bao_gia,
                        "customer_id": quote.customer_id,
                    }).encode(),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                _urllib_req.urlopen(_req, timeout=5)
            except Exception:
                pass
        _threading.Thread(target=_fire_webhook, daemon=True).start()
    return _build_response(_load_quote(quote_id, db))


@router.patch("/{quote_id}/cancel")
def cancel_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Không tìm thấy báo giá")
    _check_quote_owner_or_manager(quote, current_user)
    if quote.trang_thai in ("huy",):
        raise HTTPException(status_code=400, detail="Báo giá đã huỷ")
    old_status = quote.trang_thai
    quote.trang_thai = "huy"
    _log_quote_history(quote, "cancelled", current_user, db, old_status=old_status, new_status="huy")
    db.commit()
    return {"message": f"Đã huỷ báo giá {quote.so_bao_gia}"}


class BulkCancelBody(BaseModel):
    ids: list[int]


@router.post("/bulk-cancel")
def bulk_cancel_quotes(
    body: BulkCancelBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.ids:
        raise HTTPException(status_code=400, detail="Danh sách ID không được rỗng")
    role_code = current_user.role.ma_vai_tro if current_user.role else None
    is_manager = role_code in _MANAGER_ROLES

    quotes_to_cancel = db.query(Quote).filter(Quote.id.in_(body.ids)).all()
    cancelled = []
    errors = []
    for qt in quotes_to_cancel:
        if qt.trang_thai == "huy":
            errors.append(f"{qt.so_bao_gia}: đã huỷ")
            continue
        if not is_manager and qt.created_by != current_user.id:
            errors.append(f"{qt.so_bao_gia}: không có quyền")
            continue
        qt.trang_thai = "huy"
        cancelled.append(qt.so_bao_gia)
    db.commit()
    return {"cancelled": len(cancelled), "errors": errors}


class GiaHanBody(BaseModel):
    ngay_het_han: date


@router.patch("/{quote_id}/gia-han", response_model=QuoteResponse)
def gia_han_quote(
    quote_id: int,
    body: GiaHanBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Gia hạn báo giá hết hạn — đặt ngày mới và trả về trạng thái 'moi'."""
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Không tìm thấy báo giá")
    if quote.trang_thai != "het_han":
        raise HTTPException(status_code=400, detail="Chỉ gia hạn được báo giá ở trạng thái Hết hạn")
    if body.ngay_het_han < date.today():
        raise HTTPException(status_code=400, detail="Ngày hết hạn mới phải sau hôm nay")
    quote.ngay_het_han = body.ngay_het_han
    quote.trang_thai = "da_duyet" if quote.approved_by else "moi"
    _log_quote_history(quote, "extended", current_user, db, note=f"Ngày hết hạn mới: {body.ngay_het_han}")
    db.commit()
    return _build_response(_load_quote(quote_id, db))


@router.post("/{quote_id}/copy", response_model=QuoteResponse, status_code=201)
def copy_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    source = _load_quote(quote_id, db)
    if source.trang_thai != "da_duyet":
        raise HTTPException(status_code=400, detail="Chi copy bao gia da duyet")

    quote = Quote(
        so_bao_gia=_generate_so_bao_gia(db),
        so_bg_copy=source.so_bao_gia,
        ngay_bao_gia=date.today(),
        customer_id=source.customer_id,
        phap_nhan_id=source.phap_nhan_id,
        phap_nhan_sx_id=source.phap_nhan_sx_id,
        phan_xuong_id=source.phan_xuong_id,
        nv_phu_trach_id=current_user.id,
        nv_theo_doi_id=source.nv_theo_doi_id,
        ngay_het_han=date.today() + timedelta(days=30),
        chi_phi_bang_in=source.chi_phi_bang_in,
        chi_phi_khuon=source.chi_phi_khuon,
        chi_phi_van_chuyen=source.chi_phi_van_chuyen,
        tong_tien_hang=source.tong_tien_hang,
        ty_le_vat=source.ty_le_vat,
        tien_vat=source.tien_vat,
        chi_phi_hang_hoa_dv=source.chi_phi_hang_hoa_dv,
        tong_cong=source.tong_cong,
        chi_phi_khac_1_ten=source.chi_phi_khac_1_ten,
        chi_phi_khac_1=source.chi_phi_khac_1,
        chi_phi_khac_2_ten=source.chi_phi_khac_2_ten,
        chi_phi_khac_2=source.chi_phi_khac_2,
        chiet_khau=source.chiet_khau,
        gia_ban=source.gia_ban,
        gia_xuat_phoi_vsp=source.gia_xuat_phoi_vsp,
        ghi_chu=source.ghi_chu,
        dieu_khoan=source.dieu_khoan,
        trang_thai="moi",
        created_by=current_user.id,
    )
    try:
        for src in sorted(source.items, key=lambda x: x.stt):
            data = {
                c.name: getattr(src, c.name)
                for c in QuoteItem.__table__.columns
                if c.name not in ("id", "quote_id")
            }
            quote.items.append(QuoteItem(**data))
        db.add(quote)
        db.commit()
        db.refresh(quote)
        return _build_response(_load_quote(quote.id, db))
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Lỗi khi sao chép báo giá")


@router.post("/{quote_id}/tao-don-hang", response_model=dict)
def tao_don_hang_tu_bao_gia(
    quote_id: int,
    body: TaoDonHangRequest = Body(default=TaoDonHangRequest()),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Chuyển báo giá đã duyệt thành đơn hàng.
    item_overrides=None → lấy tất cả items với SL từ BG.
    item_overrides=[{id, so_luong}] → chỉ lấy items có id trong list, dùng so_luong từ override.
    """
    from app.services.sales_order_service import SalesOrderService
    quote = _load_quote(quote_id, db)
    if quote.trang_thai != "da_duyet":
        raise HTTPException(
            status_code=400,
            detail="Chỉ lập đơn từ báo giá ở trạng thái Đã duyệt"
        )

    override_map: dict[int, Decimal] = {}
    if body.item_overrides is not None:
        override_map = {ov.id: ov.so_luong for ov in body.item_overrides}

    selected_items = [
        qi for qi in sorted(quote.items, key=lambda x: x.stt)
        if body.item_overrides is None or qi.id in override_map
    ]
    if not selected_items:
        raise HTTPException(status_code=400, detail="Cần chọn ít nhất 1 mặt hàng")

    so_don = SalesOrderService(db)._generate_so_don()
    order = SalesOrder(
        so_don=so_don,
        ngay_don=date.today(),
        customer_id=quote.customer_id,
        phap_nhan_id=quote.phap_nhan_id,
        phap_nhan_sx_id=quote.phap_nhan_sx_id,
        phan_xuong_id=quote.phan_xuong_id,
        nv_kinh_doanh_id=quote.nv_phu_trach_id,
        trang_thai="moi",
        ghi_chu=f"Lập từ báo giá {quote.so_bao_gia}",
        created_by=current_user.id,
    )

    try:
        tong_tien = Decimal("0")
        for qi in selected_items:
            so_luong = override_map.get(qi.id, qi.so_luong)
            item = SalesOrderItem(
                product_id=qi.product_id,
                quote_item_id=qi.id,
                ten_hang=qi.ten_hang,
                so_luong=so_luong,
                dvt=qi.dvt,
                don_gia=qi.gia_ban,
                ghi_chu_san_pham=qi.ghi_chu,
                # Thông số kỹ thuật kế thừa từ báo giá
                loai_thung=qi.loai_thung,
                dai=qi.dai, rong=qi.rong, cao=qi.cao,
                so_lop=qi.so_lop, to_hop_song=qi.to_hop_song,
                mat=qi.mat,       mat_dl=qi.mat_dl,
                song_1=qi.song_1, song_1_dl=qi.song_1_dl,
                mat_1=qi.mat_1,   mat_1_dl=qi.mat_1_dl,
                song_2=qi.song_2, song_2_dl=qi.song_2_dl,
                mat_2=qi.mat_2,   mat_2_dl=qi.mat_2_dl,
                song_3=qi.song_3, song_3_dl=qi.song_3_dl,
                mat_3=qi.mat_3,   mat_3_dl=qi.mat_3_dl,
                loai_in=qi.loai_in, so_mau=qi.so_mau, loai_lan=qi.loai_lan,
                c_tham=qi.c_tham,   can_man=qi.can_man,
                kho_tt=qi.kho_tt,   dai_tt=qi.dai_tt,   dien_tich=qi.dien_tich,
                phan_xuong_id=qi.phan_xuong_id,
            )
            order.items.append(item)
            tong_tien += so_luong * qi.gia_ban

        order.tong_tien = tong_tien
        db.add(order)
        db.commit()
    except Exception as e:
        db.rollback()
        err = str(e)
        raise HTTPException(status_code=500, detail=f"Lỗi tạo đơn hàng: {err}")
    db.refresh(order)
    return {
        "so_don": order.so_don,
        "order_id": order.id,
        "so_dong": len(order.items),
        "message": f"Đã tạo đơn hàng {order.so_don} với {len(order.items)} mặt hàng",
    }


@router.get("/export-excel")
def export_quotes_excel(
    search: str = Query(default=""),
    trang_thai: str | None = Query(default=None),
    customer_id: int | None = Query(default=None),
    created_by: int | None = Query(default=None),
    phap_nhan_id: int | None = Query(default=None),
    tu_ngay: date | None = Query(default=None),
    den_ngay: date | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from fastapi.responses import StreamingResponse
    from app.services.excel_export_service import build_xlsx
    from app.models.system import ExcelTemplate

    tpl_q = db.query(ExcelTemplate).filter(ExcelTemplate.ma_mau == "SALES_QUOTE_LIST")
    tpl = tpl_q.first()
    if not tpl:
        raise HTTPException(404, "Chưa cấu hình mẫu Excel SALES_QUOTE_LIST")

    _auto_expire_quotes(db)
    q = db.query(Quote).options(
        joinedload(Quote.customer),
        joinedload(Quote.creator),
        joinedload(Quote.phap_nhan),
        selectinload(Quote.items),
    )
    if search:
        like = f"%{search}%"
        q = q.join(Customer).filter(
            Quote.so_bao_gia.ilike(like) | Customer.ten_viet_tat.ilike(like)
        )
    if trang_thai:
        q = q.filter(Quote.trang_thai == trang_thai)
    if customer_id:
        q = q.filter(Quote.customer_id == customer_id)
    if created_by:
        q = q.filter(Quote.created_by == created_by)
    if phap_nhan_id:
        q = q.filter(Quote.phap_nhan_id == phap_nhan_id)
    if tu_ngay:
        q = q.filter(Quote.ngay_bao_gia >= tu_ngay)
    if den_ngay:
        q = q.filter(Quote.ngay_bao_gia <= den_ngay)

    quotes_data = q.order_by(Quote.created_at.desc()).all()

    STATUS_MAP = {
        "moi": "Mới", "cho_duyet": "Chờ duyệt", "da_duyet": "Đã duyệt",
        "het_han": "Hết hạn", "huy": "Huỷ"
    }
    items_data = [
        {
            "stt": idx,
            "so_bao_gia": qt.so_bao_gia,
            "ngay_bao_gia": qt.ngay_bao_gia.strftime("%d/%m/%Y") if qt.ngay_bao_gia else "",
            "ten_khach_hang": qt.customer.ten_viet_tat if qt.customer else "",
            "trang_thai": STATUS_MAP.get(qt.trang_thai, qt.trang_thai),
            "ngay_het_han": qt.ngay_het_han.strftime("%d/%m/%Y") if qt.ngay_het_han else "",
            "tong_cong": int(qt.tong_cong or 0),
            "so_dong": len(qt.items),
            "nguoi_lap": qt.creator.ho_ten if qt.creator else "",
        }
        for idx, qt in enumerate(quotes_data, 1)
    ]

    meta = {"document_number": "Danh sách báo giá"}
    xlsx_bytes = build_xlsx(tpl, items_data, meta, {})
    return StreamingResponse(
        iter([xlsx_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=danh_sach_bao_gia.xlsx"},
    )


@router.get("/{quote_id}/print", response_class=HTMLResponse)
def print_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    quote = _load_quote(quote_id, db)
    pn = quote.phap_nhan if quote.phap_nhan_id else None
    tpl_q = db.query(PrintTemplate).filter(PrintTemplate.ma_mau == "SALES_QUOTE")
    tpl = tpl_q.filter(PrintTemplate.phap_nhan_id == pn.id).first() if pn else None
    if not tpl:
        tpl = tpl_q.filter(PrintTemplate.phap_nhan_id.is_(None)).first() or tpl_q.first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Không tìm thấy mẫu in SALES_QUOTE")

    settings = {s.key: s.value for s in db.query(SystemSetting).all()}
    logo_src = (
        f"/api/phap-nhan/logo/{pn.ma_phap_nhan}" if pn and pn.ma_phap_nhan
        else settings.get("logo_url") or ""
    )
    logo_img = f'<img src="{logo_src}" style="max-height:50px;max-width:100%;object-fit:contain"/>' if logo_src else ""
    company_name = (pn.ten_phap_nhan if pn else None) or settings.get("company_name") or "CÔNG TY TNHH NAM PHƯƠNG BAO BÌ"
    company_details = (pn.dia_chi if pn else None) or settings.get("company_details") or ""

    rows = ""
    for i, item in enumerate(quote.items, 1):
        gia_ban = Decimal(str(item.gia_ban or 0))
        so_luong = Decimal(str(item.so_luong or 0))
        thanh_tien = (gia_ban * so_luong).quantize(Decimal("1"))
        kich_thuoc = ""
        if item.dai and item.rong:
            kich_thuoc = f"{item.dai}×{item.rong}"
            if item.cao:
                kich_thuoc += f"×{item.cao}"
        rows += (
            f"<tr>"
            f"<td style='text-align:center'>{i}</td>"
            f"<td>{html.escape(item.ma_amis or '')}</td>"
            f"<td>{html.escape(item.ten_hang or '')}</td>"
            f"<td style='text-align:center'>{kich_thuoc}</td>"
            f"<td style='text-align:center'>{item.so_lop or ''}</td>"
            f"<td style='text-align:center'>{html.escape(item.to_hop_song or '')}</td>"
            f"<td style='text-align:center'>{html.escape(item.ma_ky_hieu or '')}</td>"
            f"<td style='text-align:right'>{int(so_luong):,}</td>"
            f"<td style='text-align:center'>{html.escape(item.dvt or 'Thùng')}</td>"
            f"<td style='text-align:right'>{int(gia_ban):,}</td>"
            f"<td style='text-align:right'>{int(thanh_tien):,}</td>"
            f"<td>{html.escape(item.ghi_chu or '')}</td>"
            f"</tr>"
        )

    def _fmt(val) -> str:
        try:
            return f"{int(Decimal(str(val or 0))):,}"
        except Exception:
            return "0"

    def _vis(val) -> str:
        try:
            return "table-row" if val and Decimal(str(val)) != 0 else "none"
        except Exception:
            return "none"

    customer = quote.customer
    customer_name = customer.ten_khach_hang if customer else ""
    ngay_bao_gia = quote.ngay_bao_gia.strftime("%d/%m/%Y") if quote.ngay_bao_gia else ""
    ngay_het_han = quote.ngay_het_han.strftime("%d/%m/%Y") if quote.ngay_het_han else ""
    nguoi_lap = quote.creator.ho_ten if quote.creator else ""

    replacements = {
        **standard_vars(subtitle="BÁO GIÁ"),
        "{{logo_img}}": logo_img,
        "{{company_name}}": html.escape(company_name),
        "{{company_details}}": html.escape(company_details),
        "{{document_number}}": html.escape(quote.so_bao_gia or ""),
        "{{document_date}}": ngay_bao_gia,
        "{{customer_name}}": html.escape(customer_name),
        "{{delivery_address}}": ngay_het_han,
        "{{ngay_het_han}}": ngay_het_han,
        "{{body_html}}": rows,
        "{{tong_tien_hang}}": _fmt(quote.tong_tien_hang),
        "{{chi_phi_bang_in}}": _fmt(quote.chi_phi_bang_in),
        "{{chi_phi_bang_in_vis}}": _vis(quote.chi_phi_bang_in),
        "{{chi_phi_khuon}}": _fmt(quote.chi_phi_khuon),
        "{{chi_phi_khuon_vis}}": _vis(quote.chi_phi_khuon),
        "{{chi_phi_van_chuyen}}": _fmt(quote.chi_phi_van_chuyen),
        "{{chi_phi_van_chuyen_vis}}": _vis(quote.chi_phi_van_chuyen),
        "{{chi_phi_khac_1_ten}}": quote.chi_phi_khac_1_ten or "",
        "{{chi_phi_khac_1}}": _fmt(quote.chi_phi_khac_1),
        "{{chi_phi_khac_1_vis}}": _vis(quote.chi_phi_khac_1),
        "{{chi_phi_khac_2_ten}}": quote.chi_phi_khac_2_ten or "",
        "{{chi_phi_khac_2}}": _fmt(quote.chi_phi_khac_2),
        "{{chi_phi_khac_2_vis}}": _vis(quote.chi_phi_khac_2),
        "{{ty_le_vat}}": str(quote.ty_le_vat or 8),
        "{{tien_vat}}": _fmt(quote.tien_vat),
        "{{tong_cong}}": _fmt(quote.tong_cong),
        "{{dieu_khoan}}": quote.dieu_khoan or "",
        "{{nguoi_lap}}": html.escape(nguoi_lap),
    }
    html = apply_template(tpl.html_content, replacements)

    so_bao_gia = quote.so_bao_gia or ""
    page = (
        "<!DOCTYPE html>\n"
        '<html lang="vi">\n'
        "<head>\n"
        '  <meta charset="UTF-8">\n'
        '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        f"  <title>Báo Giá {so_bao_gia}</title>\n"
        "  <style>\n"
        "    body { margin: 0; padding: 0; }\n"
        "    @media print { .no-print { display: none !important; } }\n"
        "  </style>\n"
        "</head>\n"
        "<body>\n"
        '  <div class="no-print" style="padding:12px;background:#f0f0f0;display:flex;gap:12px;align-items:center">\n'
        "    <button onclick=\"window.print()\" style=\"padding:8px 20px;background:#E65100;color:white;border:none;border-radius:4px;cursor:pointer;font-size:14px\">🖨️ In / Xuất PDF</button>\n"
        "    <button onclick=\"window.close()\" style=\"padding:8px 16px;border:1px solid #ccc;border-radius:4px;cursor:pointer\">Đóng</button>\n"
        '    <span style="font-size:12px;color:#666">Tip: Ctrl+P → Save as PDF</span>\n'
        "  </div>\n"
        f"  {html}\n"
        "</body>\n"
        "</html>"
    )
    return HTMLResponse(content=page)


@router.get("/{quote_id}/history")
def get_quote_history(
    quote_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from app.models.sales import QuoteHistory
    entries = (
        db.query(QuoteHistory)
        .filter(QuoteHistory.quote_id == quote_id)
        .order_by(QuoteHistory.changed_at.desc())
        .all()
    )
    return [
        {
            "id": e.id,
            "action": e.action,
            "old_status": e.old_status,
            "new_status": e.new_status,
            "old_tong_cong": float(e.old_tong_cong) if e.old_tong_cong else None,
            "new_tong_cong": float(e.new_tong_cong) if e.new_tong_cong else None,
            "note": e.note,
            "changed_at": e.changed_at.isoformat() if e.changed_at else None,
            "changed_by_name": e.changed_by_user.ho_ten if e.changed_by_user else None,
        }
        for e in entries
    ]
