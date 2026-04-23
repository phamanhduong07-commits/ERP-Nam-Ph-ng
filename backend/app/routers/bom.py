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

from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.bom import ProductionBOM, ProductionBOMItem
from app.models.master import PaperMaterial
from app.models.production import ProductionOrderItem
from app.schemas.bom import (
    BomCalculateRequest,
    BomCalculateResponse,
    BomSaveRequest,
    BomResponse,
    BomItemResponse,
    DimensionResult,
    AddonDetail,
    BomLayerResult,
)
from app.services.price_calculator import calculate_price

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
    )


def _load_bom(bom_id: int, db: Session) -> ProductionBOM:
    bom = (
        db.query(ProductionBOM)
        .options(joinedload(ProductionBOM.items))
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
        result = calculate_price(calc_input)
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
        result = calculate_price(calc_input)
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

    db.commit()
    db.refresh(bom)
    return _bom_to_response(_load_bom(bom.id, db))


@router.get("/by-item/{production_order_item_id}", response_model=BomResponse)
def get_bom_by_item(
    production_order_item_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lấy BOM mới nhất của một dòng lệnh sản xuất."""
    bom = (
        db.query(ProductionBOM)
        .options(joinedload(ProductionBOM.items))
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
