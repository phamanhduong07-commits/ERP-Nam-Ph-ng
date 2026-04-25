"""
routers/bom.py
==============
BOM + Price Calculator API endpoints.

POST /api/bom/calculate                      — tính toán, không lưu
POST /api/bom/save                           — tính toán và lưu
GET  /api/bom/{bom_id}                       — lấy BOM đã lưu
GET  /api/bom/by-item/{production_order_item_id} — lấy BOM của dòng LSX
PATCH /api/bom/{bom_id}/confirm              — xác nhận BOM (draft → confirmed)
"""

import math
import re
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text as sql_text
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.bom import ProductionBOM, ProductionBOMItem, ProductionBOMIndirectCostItem
from app.models.master import PaperMaterial, CauTrucThongDung
from app.models.production import ProductionOrderItem
from app.models.sales import SalesOrder, SalesOrderItem, Quote, QuoteItem
from app.schemas.bom import (
    BomCalculateRequest,
    BomCalculateResponse,
    BomSaveRequest,
    BomResponse,
    BomItemResponse,
    BomIndirectItemResponse,
    BomSummaryItem,
    DimensionResult,
    AddonDetail,
    BomLayerResult,
    IndirectCostItem,
)
from app.services.price_calculator import (
    calculate_price, calculate_dien_tich,
    get_spoilage_rate, _default_profit_rate, _INDIRECT_COST,
)
from app.routers.indirect_costs import get_indirect_breakdown_from_db
from app.routers.addon_rates import get_addon_rates_from_db

router = APIRouter(prefix="/api/bom", tags=["bom"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resolve_paper_prices(
    layers_input: list,
    db: Session,
) -> list[dict]:
    """
    Convert BomLayerInput list to dicts for price_calculator.calculate_price.
    If paper_material_id is given, fetch don_gia_kg from DB (overrides input).
    If ma_ky_hieu is given without id, try to look up by ma_ky_hieu.
    """
    result = []
    for layer in layers_input:
        d = layer.model_dump()
        don_gia_kg = float(d["don_gia_kg"])

        # Priority 1: explicit paper_material_id
        if d.get("paper_material_id"):
            pm = db.query(PaperMaterial).filter(
                PaperMaterial.id == d["paper_material_id"]
            ).first()
            if pm:
                don_gia_kg = float(pm.gia_mua)
                d["paper_material_id"] = pm.id
                if not d.get("ma_ky_hieu"):
                    d["ma_ky_hieu"] = pm.ma_ky_hieu

        # Priority 2: look up by ma_ky_hieu if no id provided
        elif d.get("ma_ky_hieu") and d["don_gia_kg"] == 0:
            pm = db.query(PaperMaterial).filter(
                PaperMaterial.ma_ky_hieu == d["ma_ky_hieu"]
            ).first()
            if pm:
                don_gia_kg = float(pm.gia_mua)
                d["paper_material_id"] = pm.id

        d["don_gia_kg"] = don_gia_kg
        result.append(d)
    return result


def _build_calc_input(req: BomCalculateRequest, resolved_layers: list[dict]) -> dict:
    return {
        "loai_thung": req.loai_thung,
        "dai": float(req.dai),
        "rong": float(req.rong),
        "cao": float(req.cao),
        "so_lop": req.so_lop,
        "to_hop_song": req.to_hop_song,
        "so_luong": float(req.so_luong),
        "layers": resolved_layers,
        # add-ons
        "chong_tham": req.chong_tham,
        "in_flexo_mau": req.in_flexo_mau,
        "in_flexo_phu_nen": req.in_flexo_phu_nen,
        "in_ky_thuat_so": req.in_ky_thuat_so,
        "chap_xa": req.chap_xa,
        "boi": req.boi,
        "be_so_con": req.be_so_con,
        "can_mang": req.can_mang,
        "san_pham_kho": req.san_pham_kho,
        # pricing
        "ty_le_loi_nhuan": float(req.ty_le_loi_nhuan) if req.ty_le_loi_nhuan is not None else None,
        "hoa_hong_kd_pct": float(req.hoa_hong_kd_pct),
        "hoa_hong_kh_pct": float(req.hoa_hong_kh_pct),
        "chi_phi_khac": float(req.chi_phi_khac),
        "chiet_khau": float(req.chiet_khau),
    }


def _result_to_response(result: dict) -> BomCalculateResponse:
    dims = result["dimensions"]
    return BomCalculateResponse(
        dimensions=DimensionResult(**dims),
        chi_phi_giay=result["chi_phi_giay"],
        chi_phi_gian_tiep=result["chi_phi_gian_tiep"],
        ty_le_hao_hut=result["ty_le_hao_hut"],
        chi_phi_hao_hut=result["chi_phi_hao_hut"],
        ty_le_loi_nhuan=result["ty_le_loi_nhuan"],
        loi_nhuan=result["loi_nhuan"],
        addon_detail=AddonDetail(**result["addon_detail"]),
        chi_phi_addon=result["chi_phi_addon"],
        gia_ban_co_ban=result["gia_ban_co_ban"],
        hoa_hong_kd=result["hoa_hong_kd"],
        hoa_hong_kh=result["hoa_hong_kh"],
        chi_phi_khac=result["chi_phi_khac"],
        chiet_khau=result["chiet_khau"],
        gia_ban_cuoi=result["gia_ban_cuoi"],
        bom_layers=[BomLayerResult(**bl) for bl in result["bom_layers"]],
        gian_tiep_breakdown=[
            IndirectCostItem(**item) for item in result.get("gian_tiep_breakdown", [])
        ],
    )


def _load_bom(bom_id: int, db: Session) -> ProductionBOM:
    bom = (
        db.query(ProductionBOM)
        .options(
            joinedload(ProductionBOM.items),
            joinedload(ProductionBOM.indirect_items),
        )
        .filter(ProductionBOM.id == bom_id)
        .first()
    )
    if not bom:
        raise HTTPException(status_code=404, detail="Không tìm thấy BOM")
    return bom


def _bom_to_response(bom: ProductionBOM) -> BomResponse:
    items = [
        BomItemResponse(
            id=item.id,
            bom_id=item.bom_id,
            vi_tri_lop=item.vi_tri_lop,
            loai_lop=item.loai_lop,
            flute_type=item.flute_type,
            ma_ky_hieu=item.ma_ky_hieu,
            paper_material_id=item.paper_material_id,
            dinh_luong=item.dinh_luong,
            take_up_factor=item.take_up_factor,
            dien_tich_1con=item.dien_tich_1con,
            trong_luong_1con=item.trong_luong_1con,
            so_luong_sx=item.so_luong_sx,
            ty_le_hao_hut=item.ty_le_hao_hut,
            trong_luong_can_tong=item.trong_luong_can_tong,
            don_gia_kg=item.don_gia_kg,
            thanh_tien=item.thanh_tien,
        )
        for item in bom.items
    ]
    return BomResponse(
        id=bom.id,
        production_order_item_id=bom.production_order_item_id,
        loai_thung=bom.loai_thung,
        dai=bom.dai,
        rong=bom.rong,
        cao=bom.cao,
        so_lop=bom.so_lop,
        to_hop_song=bom.to_hop_song,
        kho_tt=bom.kho_tt,
        dai_tt=bom.dai_tt,
        kho_kh=bom.kho_kh,
        dai_kh=bom.dai_kh,
        dien_tich=bom.dien_tich,
        so_luong_sx=bom.so_luong_sx,
        ty_le_hao_hut=bom.ty_le_hao_hut,
        chi_phi_giay=bom.chi_phi_giay,
        chi_phi_gian_tiep=bom.chi_phi_gian_tiep,
        chi_phi_hao_hut=bom.chi_phi_hao_hut,
        loi_nhuan=bom.loi_nhuan,
        chi_phi_addon=bom.chi_phi_addon,
        gia_ban_co_ban=bom.gia_ban_co_ban,
        gia_ban_cuoi=bom.gia_ban_cuoi,
        chong_tham=bom.chong_tham,
        in_flexo_mau=bom.in_flexo_mau,
        in_flexo_phu_nen=bom.in_flexo_phu_nen,
        in_ky_thuat_so=bom.in_ky_thuat_so,
        chap_xa=bom.chap_xa,
        boi=bom.boi,
        be_so_con=bom.be_so_con,
        can_mang=bom.can_mang,
        san_pham_kho=bom.san_pham_kho,
        ty_le_loi_nhuan=bom.ty_le_loi_nhuan,
        hoa_hong_kd_pct=bom.hoa_hong_kd_pct,
        hoa_hong_kh_pct=bom.hoa_hong_kh_pct,
        chi_phi_khac=bom.chi_phi_khac,
        chiet_khau=bom.chiet_khau,
        hoa_hong_kd=bom.hoa_hong_kd,
        hoa_hong_kh=bom.hoa_hong_kh,
        trang_thai=bom.trang_thai,
        ghi_chu=bom.ghi_chu,
        created_by=bom.created_by,
        created_at=bom.created_at,
        updated_at=bom.updated_at,
        items=items,
        indirect_items=[
            BomIndirectItemResponse(
                id=ii.id,
                bom_id=ii.bom_id,
                ten=ii.ten,
                don_gia_m2=ii.don_gia_m2,
                dien_tich=ii.dien_tich,
                thanh_tien=ii.thanh_tien,
            )
            for ii in bom.indirect_items
        ],
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/calculate", response_model=BomCalculateResponse)
def calculate_bom(
    req: BomCalculateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Tính BOM + giá mà không lưu vào database.
    Trả về đầy đủ breakdown chi phí và danh sách nguyên liệu.
    """
    try:
        resolved = _resolve_paper_prices(req.layers, db)
        calc_input = _build_calc_input(req, resolved)
        indirect_bd = get_indirect_breakdown_from_db(req.so_lop, db)
        addon_rates_db = get_addon_rates_from_db(db)
        result = calculate_price(calc_input, indirect_breakdown=indirect_bd, addon_rates=addon_rates_db)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return _result_to_response(result)


@router.post("/save", response_model=BomResponse, status_code=201)
def save_bom(
    req: BomSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Tính BOM + giá và lưu vào database.
    Nếu production_order_item_id đã có BOM (draft), sẽ xoá BOM cũ và tạo mới.
    """
    # Validate production_order_item_id if given
    if req.production_order_item_id:
        poi = db.query(ProductionOrderItem).filter(
            ProductionOrderItem.id == req.production_order_item_id
        ).first()
        if not poi:
            raise HTTPException(
                status_code=404, detail="Không tìm thấy dòng lệnh sản xuất"
            )
        # Remove existing draft BOM for this item
        existing = db.query(ProductionBOM).filter(
            ProductionBOM.production_order_item_id == req.production_order_item_id,
            ProductionBOM.trang_thai == "draft",
        ).first()
        if existing:
            db.delete(existing)
            db.flush()

    try:
        resolved = _resolve_paper_prices(req.layers, db)
        calc_input = _build_calc_input(req, resolved)
        indirect_bd = get_indirect_breakdown_from_db(req.so_lop, db)
        addon_rates_db = get_addon_rates_from_db(db)
        result = calculate_price(calc_input, indirect_breakdown=indirect_bd, addon_rates=addon_rates_db)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    dims = result["dimensions"]

    # --- Build layer fields for ProductionBOM (summary columns) ---
    layer_field_map = [
        ("mat", "mat_dl", "mat_gia"),
        ("song_1", "song_1_dl", "song_1_gia"),
        ("mat_1", "mat_1_dl", "mat_1_gia"),
        ("song_2", "song_2_dl", "song_2_gia"),
        ("mat_2", "mat_2_dl", "mat_2_gia"),
        ("song_3", "song_3_dl", "song_3_gia"),
        ("mat_3", "mat_3_dl", "mat_3_gia"),
    ]
    bom_layer_data: dict[str, object] = {}
    bom_layers_result = result["bom_layers"]
    for idx, (fn_code, fn_dl, fn_gia) in enumerate(layer_field_map):
        if idx < len(resolved):
            layer = resolved[idx]
            bom_layer_data[fn_code] = layer.get("ma_ky_hieu")
            bom_layer_data[fn_dl] = Decimal(str(layer["dinh_luong"]))
            bom_layer_data[fn_gia] = Decimal(str(layer["don_gia_kg"]))
        else:
            bom_layer_data[fn_code] = None
            bom_layer_data[fn_dl] = None
            bom_layer_data[fn_gia] = None

    bom = ProductionBOM(
        production_order_item_id=req.production_order_item_id,
        loai_thung=req.loai_thung,
        dai=req.dai,
        rong=req.rong,
        cao=req.cao,
        so_lop=req.so_lop,
        to_hop_song=req.to_hop_song,
        # Layer summary
        **bom_layer_data,
        # Dimensions
        kho_tt=Decimal(str(dims["kho_tt"])),
        dai_tt=Decimal(str(dims["dai_tt"])),
        kho_kh=Decimal(str(dims["kho_kh"])),
        dai_kh=Decimal(str(dims["dai_kh"])),
        dien_tich=Decimal(str(dims["dien_tich"])),
        # Production
        so_luong_sx=req.so_luong,
        ty_le_hao_hut=Decimal(str(result["ty_le_hao_hut"])),
        # Costs
        chi_phi_giay=Decimal(str(result["chi_phi_giay"])),
        chi_phi_gian_tiep=Decimal(str(result["chi_phi_gian_tiep"])),
        chi_phi_hao_hut=Decimal(str(result["chi_phi_hao_hut"])),
        loi_nhuan=Decimal(str(result["loi_nhuan"])),
        chi_phi_addon=Decimal(str(result["chi_phi_addon"])),
        gia_ban_co_ban=Decimal(str(result["gia_ban_co_ban"])),
        gia_ban_cuoi=Decimal(str(result["gia_ban_cuoi"])),
        # Add-on config
        chong_tham=req.chong_tham,
        in_flexo_mau=req.in_flexo_mau,
        in_flexo_phu_nen=req.in_flexo_phu_nen,
        in_ky_thuat_so=req.in_ky_thuat_so,
        chap_xa=req.chap_xa,
        boi=req.boi,
        be_so_con=req.be_so_con,
        can_mang=req.can_mang,
        san_pham_kho=req.san_pham_kho,
        # Pricing
        ty_le_loi_nhuan=Decimal(str(result["ty_le_loi_nhuan"])),
        hoa_hong_kd_pct=req.hoa_hong_kd_pct,
        hoa_hong_kh_pct=req.hoa_hong_kh_pct,
        chi_phi_khac=req.chi_phi_khac,
        chiet_khau=req.chiet_khau,
        hoa_hong_kd=Decimal(str(result["hoa_hong_kd"])),
        hoa_hong_kh=Decimal(str(result["hoa_hong_kh"])),
        # Meta
        trang_thai="draft",
        ghi_chu=req.ghi_chu if hasattr(req, "ghi_chu") else None,
        created_by=current_user.id,
    )
    db.add(bom)
    db.flush()  # get bom.id

    # --- Create BOMItem rows ---
    for bl in bom_layers_result:
        bom_item = ProductionBOMItem(
            bom_id=bom.id,
            vi_tri_lop=bl["vi_tri_lop"],
            loai_lop=bl["loai_lop"],
            flute_type=bl.get("flute_type"),
            ma_ky_hieu=bl.get("ma_ky_hieu"),
            paper_material_id=bl.get("paper_material_id"),
            dinh_luong=Decimal(str(bl["dinh_luong"])),
            take_up_factor=Decimal(str(bl["take_up_factor"])),
            dien_tich_1con=Decimal(str(bl["dien_tich_1con"])),
            trong_luong_1con=Decimal(str(bl["trong_luong_1con"])),
            so_luong_sx=Decimal(str(bl["so_luong_sx"])),
            ty_le_hao_hut=Decimal(str(bl["ty_le_hao_hut"])),
            trong_luong_can_tong=Decimal(str(bl["trong_luong_can_tong"])),
            don_gia_kg=Decimal(str(bl["don_gia_kg"])),
            thanh_tien=Decimal(str(bl["thanh_tien"])),
        )
        db.add(bom_item)

    # --- Create indirect cost breakdown rows (dữ liệu hoạch toán) ---
    dien_tich_val = Decimal(str(dims["dien_tich"]))
    for item in result.get("gian_tiep_breakdown", []):
        indirect = ProductionBOMIndirectCostItem(
            bom_id=bom.id,
            ten=item["ten"],
            don_gia_m2=Decimal(str(item["don_gia_m2"])),
            dien_tich=dien_tich_val,
            thanh_tien=Decimal(str(item["thanh_tien"])),
        )
        db.add(indirect)

    db.commit()
    db.refresh(bom)
    return _bom_to_response(_load_bom(bom.id, db))


class BomFromProductionItemResponse(BomCalculateResponse):
    source: str                   # "quote" | "cau_truc" | "product"
    loai_thung: str
    dai: float
    rong: float
    cao: float
    so_lop: int
    to_hop_song: str
    so_luong: float
    bien_phi: float               # tổng biến phí (giấy + gián tiếp + hao hụt + gia công)
    gia_ban_bao_gia: float        # giá báo trong báo giá
    lai_gop: float                # gia_ban_bao_gia - bien_phi
    ty_le_lai: float              # %


def _spec_from_soi(soi_id: int, db: Session):
    """
    Đọc thông số kỹ thuật từ SalesOrderItem qua raw SQL.
    Trả về SimpleNamespace với đầy đủ fields nếu có spec (mat_dl hoặc song_1_dl),
    hoặc None nếu chưa có spec / cột chưa tồn tại.
    """
    import types
    _SPEC_COLS = (
        "order_id, product_id, quote_item_id, don_gia, "
        "loai_thung, dai, rong, cao, so_lop, to_hop_song, "
        "mat, mat_dl, song_1, song_1_dl, mat_1, mat_1_dl, "
        "song_2, song_2_dl, mat_2, mat_2_dl, "
        "song_3, song_3_dl, mat_3, mat_3_dl, "
        "loai_in, so_mau"
    )
    try:
        row = db.execute(
            sql_text(f"SELECT {_SPEC_COLS} FROM sales_order_items WHERE id = :id"),
            {"id": soi_id}
        ).first()
    except Exception:
        # Cột spec chưa tồn tại (migrate_004 chưa chạy), fallback minimal
        try:
            row = db.execute(
                sql_text("SELECT order_id, product_id, quote_item_id "
                         "FROM sales_order_items WHERE id = :id"),
                {"id": soi_id}
            ).first()
        except Exception:
            return None
        if row:
            ns = types.SimpleNamespace(
                order_id=row.order_id,
                product_id=row.product_id,
                quote_item_id=getattr(row, 'quote_item_id', None),
                has_spec=False,
                gia_ban=None,
            )
            return ns
        return None

    if not row:
        return None

    ns = types.SimpleNamespace(**dict(row._mapping))
    ns.has_spec = bool(getattr(row, 'mat_dl', None) or getattr(row, 'song_1_dl', None))
    ns.gia_ban = getattr(row, 'don_gia', None)   # alias: gia_ban = don_gia trên SOItem
    return ns


def _find_quote_item(poi: "ProductionOrderItem", db: Session):
    """
    Tìm nguồn spec cho dòng lệnh SX theo thứ tự ưu tiên:

    Đường -1: POItem tự có spec (sau tao_lenh_tu_don_hang) — nhanh nhất
    Đường 0:  SOItem có spec trực tiếp (migrate_004)
    Đường 1:  SOItem.quote_item_id → QuoteItem
    Đường 2:  SOItem → SalesOrder.ghi_chu → số BG → QuoteItem
    Đường 3:  QuoteItem.product_id khớp poi.product_id (BG gần nhất)
    Đường 4:  QuoteItem.ten_hang khớp poi.ten_hang
    """
    # ── Đường -1: POItem có spec trực tiếp ───────────────────────────────────
    if _has_paper_data(poi):
        return poi

    product_id = poi.product_id
    ten_hang   = poi.ten_hang

    soi_ns = None
    if poi.sales_order_item_id:
        soi_ns = _spec_from_soi(poi.sales_order_item_id, db)

    # ── Đường 0: SOItem có spec đầy đủ (migrate_004 đã chạy) ─────────────────
    if soi_ns and soi_ns.has_spec:
        return soi_ns   # namespace dùng được với _has_paper_data / _raw_pairs_from_object

    # ── Đường 1: quote_item_id trực tiếp ─────────────────────────────────────
    qi_id = getattr(soi_ns, 'quote_item_id', None) if soi_ns else None
    if qi_id:
        qi = db.query(QuoteItem).filter(QuoteItem.id == qi_id).first()
        if qi:
            return qi

    # ── Đường 2: SalesOrder.ghi_chu → số báo giá → QuoteItem ─────────────────
    order_id = getattr(soi_ns, 'order_id', None) if soi_ns else None
    soi_product_id = getattr(soi_ns, 'product_id', None) if soi_ns else None
    if order_id:
        so = db.query(SalesOrder).filter(SalesOrder.id == order_id).first()
        if so and so.ghi_chu:
            m = re.search(r'BG[A-Z0-9]+', so.ghi_chu)
            if m:
                quote = db.query(Quote).filter(Quote.so_bao_gia == m.group()).first()
                if quote:
                    pid = soi_product_id or product_id
                    if pid:
                        qi = (
                            db.query(QuoteItem)
                            .filter(QuoteItem.quote_id == quote.id,
                                    QuoteItem.product_id == pid)
                            .order_by(QuoteItem.stt)
                            .first()
                        )
                        if qi:
                            return qi
                    if ten_hang:
                        qi = (
                            db.query(QuoteItem)
                            .filter(QuoteItem.quote_id == quote.id,
                                    QuoteItem.ten_hang == ten_hang)
                            .order_by(QuoteItem.stt)
                            .first()
                        )
                        if qi:
                            return qi

    # ── Đường 3: QuoteItem gần nhất theo product_id ───────────────────────────
    pid = product_id or soi_product_id
    if pid:
        qi = (
            db.query(QuoteItem)
            .join(Quote, QuoteItem.quote_id == Quote.id)
            .filter(
                QuoteItem.product_id == pid,
                Quote.trang_thai.in_(["da_duyet", "moi"]),
            )
            .order_by(Quote.ngay_bao_gia.desc(), Quote.id.desc())
            .first()
        )
        if qi:
            return qi

    # ── Đường 4: QuoteItem theo ten_hang ─────────────────────────────────────
    if ten_hang:
        qi = (
            db.query(QuoteItem)
            .join(Quote, QuoteItem.quote_id == Quote.id)
            .filter(
                QuoteItem.ten_hang == ten_hang,
                Quote.trang_thai.in_(["da_duyet", "moi"]),
            )
            .order_by(Quote.ngay_bao_gia.desc(), Quote.id.desc())
            .first()
        )
        if qi:
            return qi

    return None


@router.get("/from-production-item/{production_order_item_id}",
            response_model=BomFromProductionItemResponse)
def bom_from_production_item(
    production_order_item_id: int,
    so_luong: float | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Tính BOM + biến phí từ dữ liệu báo giá liên kết với dòng lệnh SX.
    Tự động tra cứu qua chuỗi POItem → SOItem → Quote → QuoteItem.
    """
    from decimal import Decimal as D

    poi = (
        db.query(ProductionOrderItem)
        .options(joinedload(ProductionOrderItem.product))
        .filter(ProductionOrderItem.id == production_order_item_id)
        .first()
    )
    if not poi:
        raise HTTPException(status_code=404, detail="Không tìm thấy dòng lệnh sản xuất")

    product = poi.product

    # ── Tìm QuoteItem ─────────────────────────────────────────────────────────
    qi = _find_quote_item(poi, db)

    if not qi:
        name = poi.ten_hang or f"ID={production_order_item_id}"
        raise HTTPException(
            status_code=422,
            detail=(
                f"Không tìm thấy báo giá cho mã hàng '{name}'. "
                f"Kiểm tra: (1) Sản phẩm đã được liên kết với mã hàng trong danh mục chưa? "
                f"(2) Có báo giá nào ở trạng thái Mới/Đã duyệt chứa mã hàng này không?"
            ),
        )

    if not _has_paper_data(qi):
        raise HTTPException(
            status_code=422,
            detail=(
                f"Dòng báo giá chưa có thông tin kết cấu giấy (định lượng trống). "
                f"Vui lòng cập nhật báo giá tương ứng."
            ),
        )

    source = "quote"

    # ── Số lớp & tổ hợp sóng ────────────────────────────────────────────────
    so_lop_prod = (product.so_lop if product else None) or 3
    so_lop = qi.so_lop or so_lop_prod
    to_hop_song_default = "C" if so_lop == 3 else "CB" if so_lop == 5 else "CBC"
    to_hop_song = qi.to_hop_song or to_hop_song_default

    # ── Build layers từ QuoteItem ────────────────────────────────────────────
    raw_pairs = _raw_pairs_from_object(qi)
    layers_dicts = _build_layers(so_lop, to_hop_song, raw_pairs)
    layers_dicts = [l for l in layers_dicts if l['dinh_luong'] > 0]

    if len(layers_dicts) < so_lop:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Kết cấu giấy trong báo giá thiếu định lượng "
                f"({len(layers_dicts)}/{so_lop} lớp có dữ liệu). "
                f"Vui lòng cập nhật báo giá."
            ),
        )

    from app.schemas.bom import BomLayerInput as BLI
    layer_objs = [
        BLI(
            vi_tri_lop=l['vi_tri_lop'],
            loai_lop=l['loai_lop'],
            flute_type=l['flute_type'],
            ma_ky_hieu=l['ma_ky_hieu'] or '',
            paper_material_id=None,
            dinh_luong=D(str(l['dinh_luong'])),
            don_gia_kg=D('0'),
        )
        for l in layers_dicts
    ]
    resolved = _resolve_paper_prices(layer_objs, db)

    # ── Kích thước ────────────────────────────────────────────────────────────
    loai_thung = qi.loai_thung or "A1"
    dai_val  = float(qi.dai  or (product.dai  if product else None) or 0)
    rong_val = float(qi.rong or (product.rong if product else None) or 0)
    cao_val  = float(qi.cao  or (product.cao  if product else None) or 0)

    if not (dai_val and rong_val):
        raise HTTPException(
            status_code=422,
            detail=(
                "Thiếu kích thước thùng (Dài/Rộng) trong báo giá. "
                "Vui lòng cập nhật kích thước trên dòng báo giá."
            ),
        )

    qty = so_luong or float(poi.so_luong_ke_hoach)

    # ── Gia công từ QuoteItem ─────────────────────────────────────────────────
    in_flexo_mau = 0
    in_ky_thuat_so = False
    if qi:
        if qi.loai_in == 'flexo':
            in_flexo_mau = qi.so_mau or 0
        elif qi.loai_in == 'ky_thuat_so':
            in_ky_thuat_so = True

    calc_input = {
        "loai_thung": loai_thung,
        "dai": dai_val, "rong": rong_val, "cao": cao_val,
        "so_lop": so_lop, "to_hop_song": to_hop_song,
        "so_luong": qty,
        "layers": resolved,
        # add-ons
        "chong_tham": _parse_int_field(getattr(qi, 'c_tham', None), [0, 1, 2]) if qi else 0,
        "in_flexo_mau": in_flexo_mau,
        "in_flexo_phu_nen": False,
        "in_ky_thuat_so": in_ky_thuat_so,
        "chap_xa": bool(getattr(qi, 'chap_xa', False)) if qi else False,
        "boi": bool(getattr(qi, 'boi', False)) if qi else False,
        "be_so_con": _parse_int_field(getattr(qi, 'so_c_be', None), [0, 1, 2, 4, 6, 8]) if qi else 0,
        "can_mang": _parse_int_field(getattr(qi, 'can_man', None), [0, 1, 2]) if qi else 0,
        "san_pham_kho": bool(getattr(qi, 'do_kho', False)) if qi else False,
        # pricing: dùng 0 để tính thuần biến phí
        "ty_le_loi_nhuan": 0.0,
        "hoa_hong_kd_pct": 0.0,
        "hoa_hong_kh_pct": 0.0,
        "chi_phi_khac": 0.0,
        "chiet_khau": 0.0,
    }

    try:
        indirect_bd = get_indirect_breakdown_from_db(so_lop, db)
        addon_rates_db = get_addon_rates_from_db(db)
        result = calculate_price(calc_input, indirect_breakdown=indirect_bd, addon_rates=addon_rates_db)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    bien_phi = (
        result["chi_phi_giay"] +
        result["chi_phi_gian_tiep"] +
        result["chi_phi_hao_hut"] +
        result["chi_phi_addon"]
    )
    gia_ban_bao_gia = float(getattr(qi, 'gia_ban', None) or 0)
    lai_gop = gia_ban_bao_gia - bien_phi
    ty_le_lai = round(lai_gop / gia_ban_bao_gia * 100, 1) if gia_ban_bao_gia > 0 else 0.0

    base = _result_to_response(result).model_dump()
    return BomFromProductionItemResponse(
        **base,
        source=source,
        loai_thung=loai_thung,
        dai=dai_val, rong=rong_val, cao=cao_val,
        so_lop=so_lop, to_hop_song=to_hop_song,
        so_luong=qty,
        bien_phi=round(bien_phi, 2),
        gia_ban_bao_gia=gia_ban_bao_gia,
        lai_gop=round(lai_gop, 2),
        ty_le_lai=ty_le_lai,
    )


@router.get("/by-item/{production_order_item_id}", response_model=BomResponse)
def get_bom_by_item(
    production_order_item_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lấy BOM mới nhất của một dòng lệnh sản xuất."""
    bom = (
        db.query(ProductionBOM)
        .options(
            joinedload(ProductionBOM.items),
            joinedload(ProductionBOM.indirect_items),
        )
        .filter(ProductionBOM.production_order_item_id == production_order_item_id)
        .order_by(ProductionBOM.created_at.desc())
        .first()
    )
    if not bom:
        raise HTTPException(
            status_code=404,
            detail=f"Không tìm thấy BOM cho dòng LSX id={production_order_item_id}",
        )
    return _bom_to_response(bom)


def _parse_int_field(val: str | None, allowed: list[int], default: int = 0) -> int:
    if val is None:
        return default
    try:
        v = int(str(val).strip())
        return v if v in allowed else default
    except (ValueError, TypeError):
        return default


def _build_layers(so_lop: int, to_hop_song: str | None, raw_pairs: list[tuple]) -> list[dict]:
    """
    Chuyển danh sách (code, dinh_luong) theo thứ tự lớp thành layers array cho BOM.
    raw_pairs: [(mat_code, mat_dl), (song1_code, song1_dl), (mat1_code, mat1_dl), ...]
    """
    songs = list(to_hop_song) if to_hop_song else []
    n = so_lop or 3
    n_mats = (n + 1) // 2
    result = []
    song_idx = 0
    for i in range(n):
        if i >= len(raw_pairs):
            break
        code, dl = raw_pairs[i]
        if i % 2 == 1:  # wave layer
            flute = songs[song_idx] if song_idx < len(songs) else 'C'
            song_idx += 1
            result.append({
                'vi_tri_lop': f'Sóng {flute}',
                'loai_lop': 'song',
                'flute_type': flute,
                'ma_ky_hieu': code or '',
                'paper_material_id': None,
                'dinh_luong': float(dl) if dl else 0.0,
                'don_gia_kg': 0.0,
            })
        else:  # face layer
            mat_idx = i // 2
            if mat_idx == 0:
                vi_tri = 'Mặt ngoài'
            elif mat_idx == n_mats - 1:
                vi_tri = 'Mặt trong'
            else:
                vi_tri = 'Mặt giữa' if n_mats == 3 else f'Mặt giữa {mat_idx}'
            result.append({
                'vi_tri_lop': vi_tri,
                'loai_lop': 'mat',
                'flute_type': None,
                'ma_ky_hieu': code or '',
                'paper_material_id': None,
                'dinh_luong': float(dl) if dl else 0.0,
                'don_gia_kg': 0.0,
            })
    return result


def _raw_pairs_from_object(obj) -> list[tuple]:
    """Lấy danh sách (code, dl) từ QuoteItem hoặc CauTrucThongDung."""
    return [
        (getattr(obj, 'mat', None),    getattr(obj, 'mat_dl', None)),
        (getattr(obj, 'song_1', None), getattr(obj, 'song_1_dl', None)),
        (getattr(obj, 'mat_1', None),  getattr(obj, 'mat_1_dl', None)),
        (getattr(obj, 'song_2', None), getattr(obj, 'song_2_dl', None)),
        (getattr(obj, 'mat_2', None),  getattr(obj, 'mat_2_dl', None)),
        (getattr(obj, 'song_3', None), getattr(obj, 'song_3_dl', None)),
        (getattr(obj, 'mat_3', None),  getattr(obj, 'mat_3_dl', None)),
    ]


def _has_paper_data(obj) -> bool:
    return bool(getattr(obj, 'mat_dl', None) or getattr(obj, 'song_1_dl', None))


@router.get("/quote-spec/{production_order_item_id}")
def get_quote_spec(
    production_order_item_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Lấy quy cách sản phẩm cho một dòng lệnh sản xuất để auto-fill BomCalculatorPanel.

    Ưu tiên nguồn dữ liệu:
      1. QuoteItem liên kết (qua chuỗi POItem → SOItem → QuoteItem)
      2. CauTrucThongDung khớp so_lop
      3. Chỉ trả kích thước từ Product (không có kết cấu giấy)

    Không bao giờ trả 404 cho poi_id hợp lệ — luôn trả về spec tốt nhất có thể.
    """
    poi = (
        db.query(ProductionOrderItem)
        .options(joinedload(ProductionOrderItem.product))
        .filter(ProductionOrderItem.id == production_order_item_id)
        .first()
    )
    if not poi:
        raise HTTPException(status_code=404, detail="Không tìm thấy dòng lệnh sản xuất")

    product = poi.product
    so_lop = (product.so_lop if product else None) or 3

    # ── Nguồn 1: QuoteItem qua chuỗi POItem → SOItem → QuoteItem ──────────────
    qi = _find_quote_item(poi, db)

    if qi and _has_paper_data(qi):
        # Có kết cấu đầy đủ từ báo giá / POItem / SOItem
        loai_in = getattr(qi, 'loai_in', None)
        so_mau_qi = getattr(qi, 'so_mau', None)
        in_flexo_mau = 0
        in_ky_thuat_so = False
        if loai_in == 'flexo':
            in_flexo_mau = so_mau_qi or 0
        elif loai_in == 'ky_thuat_so':
            in_ky_thuat_so = True

        qi_so_lop = getattr(qi, 'so_lop', None) or so_lop
        qi_to_hop_song = getattr(qi, 'to_hop_song', None)
        # quote_item_id chỉ hợp lệ khi qi là QuoteItem thật sự
        qi_quote_item_id = qi.id if isinstance(qi, QuoteItem) else None

        return {
            "source": "quote",
            "quote_item_id": qi_quote_item_id,
            "loai_thung": getattr(qi, 'loai_thung', None) or "A1",
            "dai": float(qi.dai) if qi.dai else (float(product.dai) if product and product.dai else None),
            "rong": float(qi.rong) if qi.rong else (float(product.rong) if product and product.rong else None),
            "cao": float(qi.cao) if qi.cao else (float(product.cao) if product and product.cao else None),
            "so_lop": qi_so_lop,
            "to_hop_song": qi_to_hop_song or "C",
            "so_luong": float(poi.so_luong_ke_hoach),
            "layers": _build_layers(qi_so_lop, qi_to_hop_song, _raw_pairs_from_object(qi)),
            "chong_tham": _parse_int_field(getattr(qi, 'c_tham', None), [0, 1, 2], 0),
            "in_flexo_mau": in_flexo_mau,
            "in_flexo_phu_nen": False,
            "in_ky_thuat_so": in_ky_thuat_so,
            "chap_xa": bool(getattr(qi, 'chap_xa', False)),
            "boi": bool(getattr(qi, 'boi', False)),
            "be_so_con": _parse_int_field(getattr(qi, 'so_c_be', None), [0, 1, 2, 4, 6, 8], 0),
            "can_mang": _parse_int_field(getattr(qi, 'can_man', None), [0, 1, 2], 0),
            "san_pham_kho": bool(getattr(qi, 'do_kho', False)),
        }

    # ── Nguồn 2: CauTrucThongDung khớp so_lop ─────────────────────────────────
    cau_truc: CauTrucThongDung | None = (
        db.query(CauTrucThongDung)
        .filter(
            CauTrucThongDung.so_lop == so_lop,
            CauTrucThongDung.trang_thai == True,
        )
        .order_by(CauTrucThongDung.thu_tu)
        .first()
    )

    to_hop_song = (cau_truc.to_hop_song if cau_truc else None) or ("C" if so_lop == 3 else "CB" if so_lop == 5 else "CBC")
    layers = (
        _build_layers(so_lop, to_hop_song, _raw_pairs_from_object(cau_truc))
        if cau_truc and _has_paper_data(cau_truc)
        else []
    )

    return {
        "source": "cau_truc" if (cau_truc and _has_paper_data(cau_truc)) else "product",
        "quote_item_id": None,
        "loai_thung": "A1",
        "dai": float(product.dai) if product and product.dai else None,
        "rong": float(product.rong) if product and product.rong else None,
        "cao": float(product.cao) if product and product.cao else None,
        "so_lop": so_lop,
        "to_hop_song": to_hop_song,
        "so_luong": float(poi.so_luong_ke_hoach),
        "layers": layers,
        "chong_tham": 0,
        "in_flexo_mau": (product.so_mau if product else 0) or 0,
        "in_flexo_phu_nen": False,
        "in_ky_thuat_so": False,
        "chap_xa": False,
        "boi": False,
        "be_so_con": 0,
        "can_mang": 0,
        "san_pham_kho": False,
    }


@router.get("/summary", response_model=list[BomSummaryItem])
def list_bom_summary(
    trang_thai: str | None = None,
    search: str | None = None,
    limit: int = Query(default=200, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Danh sách BOM đã lưu kèm thông tin lệnh sản xuất — dùng cho trang Định mức BOM."""
    from app.models.production import ProductionOrder
    from app.models.sales import SalesOrder
    from app.models.master import Customer
    q = (
        db.query(ProductionBOM)
        .options(
            joinedload(ProductionBOM.production_order_item).joinedload(
                ProductionOrderItem.production_order
            ).joinedload(ProductionOrder.sales_order).joinedload(SalesOrder.customer)
        )
    )
    if trang_thai:
        q = q.filter(ProductionBOM.trang_thai == trang_thai)
    boms = q.order_by(ProductionBOM.updated_at.desc()).limit(limit).all()

    result = []
    for bom in boms:
        poi = bom.production_order_item
        po  = poi.production_order if poi else None
        so  = po.sales_order if po else None
        kh  = so.customer if so else None
        ten_khach_hang = kh.ten_viet_tat if kh else None
        ma_khach_hang  = kh.ma_kh if kh else None
        if search:
            s = search.lower()
            hang = (poi.ten_hang if poi else '') or ''
            lenh = (po.so_lenh if po else '') or ''
            khach = (ten_khach_hang or '')
            if not (s in hang.lower() or s in lenh.lower() or s in khach.lower()):
                continue
        result.append(BomSummaryItem(
            id=bom.id,
            production_order_item_id=bom.production_order_item_id,
            ten_hang=poi.ten_hang if poi else None,
            so_lenh=po.so_lenh if po else None,
            ten_khach_hang=ten_khach_hang,
            ma_khach_hang=ma_khach_hang,
            loai_thung=bom.loai_thung,
            dai=bom.dai,
            rong=bom.rong,
            cao=bom.cao,
            so_lop=bom.so_lop,
            to_hop_song=bom.to_hop_song,
            so_luong_sx=bom.so_luong_sx,
            chi_phi_giay=bom.chi_phi_giay,
            chi_phi_gian_tiep=bom.chi_phi_gian_tiep,
            chi_phi_hao_hut=bom.chi_phi_hao_hut,
            chi_phi_addon=bom.chi_phi_addon,
            gia_ban_cuoi=bom.gia_ban_cuoi,
            trang_thai=bom.trang_thai,
            created_at=bom.created_at,
            updated_at=bom.updated_at,
        ))
    return result


@router.get("/{bom_id}", response_model=BomResponse)
def get_bom(
    bom_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lấy BOM theo ID."""
    return _bom_to_response(_load_bom(bom_id, db))


@router.patch("/{bom_id}/confirm", response_model=BomResponse)
def confirm_bom(
    bom_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Xác nhận BOM (draft → confirmed)."""
    bom = db.query(ProductionBOM).filter(ProductionBOM.id == bom_id).first()
    if not bom:
        raise HTTPException(status_code=404, detail="Không tìm thấy BOM")
    if bom.trang_thai != "draft":
        raise HTTPException(
            status_code=400,
            detail=f"BOM đang ở trạng thái '{bom.trang_thai}', không thể xác nhận",
        )
    bom.trang_thai = "confirmed"
    db.commit()
    return _bom_to_response(_load_bom(bom_id, db))


# ─── Reverse calculation ──────────────────────────────────────────────────────

class BomReverseRequest(BaseModel):
    """Tính ngược: cho giá bán mục tiêu → ngân sách giấy tối đa."""
    gia_muc_tieu: float          # giá bán cuối mục tiêu (đ/thùng)
    loai_thung: str              # A1/A3/A5/A7/GOI_GIUA/GOI_SUON/TAM
    dai: float
    rong: float
    cao: float
    so_lop: int                  # 3 | 5 | 7
    so_luong: float = 1000.0
    ty_le_loi_nhuan: float | None = None
    d_total: float = 0.0        # chi phí dịch vụ gia công (nếu đã tính được)
    hoa_hong_kd_pct: float = 0.0
    hoa_hong_kh_pct: float = 0.0
    chi_phi_khac: float = 0.0
    chiet_khau: float = 0.0


class BomReverseResponse(BaseModel):
    gia_muc_tieu: float
    p_co_ban: float              # giá cơ bản (p) ngược từ gia_muc_tieu
    b_per_m2: float              # đơn giá gián tiếp (đ/m²)
    b: float                     # chi phí gián tiếp (đ/thùng)
    c_pct: float                 # tỷ lệ lợi nhuận
    e_pct: float                 # tỷ lệ hao hụt
    d: float                     # chi phí dịch vụ
    a_max: float                 # ngân sách giấy tối đa (đ/thùng)
    a_max_per_m2: float          # ngân sách giấy tối đa (đ/m²)
    dien_tich: float             # diện tích (m²/thùng)
    kha_thi: bool                # True nếu a_max > 0


@router.post("/reverse-calculate", response_model=BomReverseResponse)
def reverse_calculate(
    data: BomReverseRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Tính ngược: cho giá bán mục tiêu + thông số → ngân sách giấy tối đa.

    Công thức:
      gia_ban_cuoi = p × (1 + kd + kh) + h - i
      → p = (gia_ban_cuoi - h + i) / (1 + kd + kh)

      p = (a+b) × (1 + ln + hh) + d
      → a+b = (p - d) / (1 + ln + hh)
      → a_max = a+b - b
    """
    try:
        dims = calculate_dien_tich(data.loai_thung, data.dai, data.rong, data.cao, data.so_lop)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    dien_tich = dims["dien_tich"]

    # Chi phí gián tiếp từ DB
    indirect_bd = get_indirect_breakdown_from_db(data.so_lop, db)
    if indirect_bd:
        b_per_m2 = sum(item["don_gia_m2"] for item in indirect_bd)
    else:
        b_per_m2 = _INDIRECT_COST.get(data.so_lop, 898.0)
    b = b_per_m2 * dien_tich

    # Tỷ lệ hao hụt và lợi nhuận
    hh = get_spoilage_rate(data.so_luong, data.so_lop, data.loai_thung)
    ln = data.ty_le_loi_nhuan if data.ty_le_loi_nhuan is not None else _default_profit_rate(data.loai_thung, data.so_lop)

    kd = data.hoa_hong_kd_pct
    kh = data.hoa_hong_kh_pct
    h = data.chi_phi_khac
    i = data.chiet_khau
    d = data.d_total

    # Tính ngược
    denominator_hh = 1 + kd + kh
    if denominator_hh <= 0:
        raise HTTPException(status_code=422, detail="Tổng hoa hồng không hợp lệ")
    p = (data.gia_muc_tieu - h + i) / denominator_hh

    denominator_ab = 1 + ln + hh
    ab = (p - d) / denominator_ab if denominator_ab > 0 else 0
    a_max = ab - b
    a_max_per_m2 = a_max / dien_tich if dien_tich > 0 else 0

    return BomReverseResponse(
        gia_muc_tieu=round(data.gia_muc_tieu, 2),
        p_co_ban=round(p, 2),
        b_per_m2=round(b_per_m2, 2),
        b=round(b, 2),
        c_pct=round(ln, 4),
        e_pct=round(hh, 4),
        d=round(d, 2),
        a_max=round(a_max, 2),
        a_max_per_m2=round(a_max_per_m2, 2),
        dien_tich=round(dien_tich, 6),
        kha_thi=a_max > 0,
    )


@router.get("", response_model=list[BomResponse])
def list_boms(
    production_order_item_id: int | None = None,
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lấy danh sách BOM đã lưu."""
    q = db.query(ProductionBOM).options(
        joinedload(ProductionBOM.items),
        joinedload(ProductionBOM.indirect_items),
    )
    if production_order_item_id:
        q = q.filter(ProductionBOM.production_order_item_id == production_order_item_id)
    boms = q.order_by(ProductionBOM.created_at.desc()).limit(limit).all()
    return [_bom_to_response(b) for b in boms]
