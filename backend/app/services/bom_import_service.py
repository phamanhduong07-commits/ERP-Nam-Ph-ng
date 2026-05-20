from decimal import Decimal
from io import BytesIO
from typing import Any
import pandas as pd
from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.models.auth import User
from app.models.master import Product, PaperMaterial
from app.models.bom import ProductionBOM, ProductionBOMItem
from app.models.import_log import ImportLog
from app.services.price_calculator import calculate_price
from app.routers.indirect_costs import get_indirect_breakdown_from_db
from app.routers.addon_rates import get_addon_rates_from_db
from app.services.excel_import_service import parse_decimal, parse_int


async def import_bom_excel(
    db: Session,
    file: UploadFile,
    user: User,
    commit: bool = False
) -> dict[str, Any]:
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Chi chap nhan file Excel")

    raw = await file.read()
    df = pd.read_excel(BytesIO(raw), dtype=object)
    if df.empty:
        raise HTTPException(status_code=400, detail="File khong co du lieu")

    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]

    required_cols = ["ma_hang", "loai_thung", "dai", "rong", "cao", "so_lop"]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Thieu cot: {', '.join(missing)}")

    errors = []
    objects_to_save = []

    indirect_breakdowns = {3: get_indirect_breakdown_from_db(3, db),
                           5: get_indirect_breakdown_from_db(5, db),
                           7: get_indirect_breakdown_from_db(7, db)}
    addon_rates = get_addon_rates_from_db(db)

    for idx, row in df.iterrows():
        row_num = idx + 2
        ma_hang = str(row["ma_hang"]).strip()
        product = db.query(Product).filter(Product.ma_amis == ma_hang).first()
        if not product:
            errors.append(f"Dong {row_num}: San pham '{ma_hang}' khong ton tai")
            continue

        try:
            so_lop = int(row["so_lop"])
            to_hop_song = str(row.get("to_hop_song", "")) or ("B" if so_lop == 3 else "BC" if so_lop == 5 else "BCB")

            # Map layers
            layers_input = []
            layer_configs = [
                ("Mat ngoai", "mat", "mat_dl"),
                ("Song 1", "song_1", "song_1_dl"),
                ("Mat giua", "mat_1", "mat_1_dl"),
                ("Song 2", "song_2", "song_2_dl"),
                ("Mat 2", "mat_2", "mat_2_dl"),
                ("Song 3", "song_3", "song_3_dl"),
                ("Mat trong", "mat_3", "mat_3_dl"),
            ]

            for i, (pos, code_col, dl_col) in enumerate(layer_configs):
                if i >= so_lop:
                    break
                ma_ky_hieu = str(row.get(code_col, "")) if not pd.isna(row.get(code_col)) else ""
                dl = parse_decimal(row.get(dl_col, 0))

                # Resolve price
                don_gia_kg = 0
                pm_id = None
                if ma_ky_hieu:
                    pm = db.query(PaperMaterial).filter(PaperMaterial.ma_ky_hieu == ma_ky_hieu).first()
                    if pm:
                        don_gia_kg = float(pm.gia_mua)
                        pm_id = pm.id

                layers_input.append({
                    "vi_tri_lop": pos,
                    "loai_lop": "song" if "Song" in pos else "mat",
                    "flute_type": to_hop_song[i // 2] if "Song" in pos else None,
                    "ma_ky_hieu": ma_ky_hieu,
                    "paper_material_id": pm_id,
                    "dinh_luong": float(dl),
                    "don_gia_kg": don_gia_kg,
                    "take_up_factor": 1.0  # Default
                })

            calc_input = {
                "loai_thung": str(row["loai_thung"]),
                "dai": float(row["dai"]),
                "rong": float(row["rong"]),
                "cao": float(row["cao"]),
                "so_lop": so_lop,
                "to_hop_song": to_hop_song,
                "so_luong": 1000.0,  # Default for calculation
                "layers": layers_input,
                "chong_tham": parse_int(row.get("chong_tham", 0)),
                "in_flexo_mau": parse_int(row.get("in_flexo_mau", 0)),
                "be_so_con": parse_int(row.get("be_so_con", 0)),
                # Others default to False/0
            }

            # Calculate
            res = calculate_price(
                calc_input,
                indirect_breakdown=indirect_breakdowns.get(so_lop),
                addon_rates=addon_rates)

            # Prepare BOM object
            bom = ProductionBOM(
                production_order_item_id=None,  # Independent BOM
                loai_thung=calc_input["loai_thung"],
                dai=Decimal(str(calc_input["dai"])),
                rong=Decimal(str(calc_input["rong"])),
                cao=Decimal(str(calc_input["cao"])),
                so_lop=so_lop,
                to_hop_song=to_hop_song,
                kho_tt=Decimal(str(res["dimensions"]["kho_tt"])),
                dai_tt=Decimal(str(res["dimensions"]["dai_tt"])),
                kho_kh=Decimal(str(res["dimensions"]["kho_kh"])),
                dai_kh=Decimal(str(res["dimensions"]["dai_kh"])),
                dien_tich=Decimal(str(res["dimensions"]["dien_tich"])),
                so_luong_sx=Decimal("1000"),
                ty_le_hao_hut=Decimal(str(res["ty_le_hao_hut"])),
                chi_phi_giay=Decimal(str(res["chi_phi_giay"])),
                chi_phi_gian_tiep=Decimal(str(res["chi_phi_gian_tiep"])),
                chi_phi_hao_hut=Decimal(str(res["chi_phi_hao_hut"])),
                loi_nhuan=Decimal(str(res["loi_nhuan"])),
                chi_phi_addon=Decimal(str(res["chi_phi_addon"])),
                gia_ban_co_ban=Decimal(str(res["gia_ban_co_ban"])),
                gia_ban_cuoi=Decimal(str(res["gia_ban_cuoi"])),
                trang_thai="confirmed",
                ghi_chu=str(row.get("ghi_chu", "")),
                created_by=user.id
            )

            bom_items = []
            for bl in res["bom_layers"]:
                bom_items.append(ProductionBOMItem(
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
                ))

            objects_to_save.append((bom, bom_items))

        except Exception as e:
            errors.append(f"Dong {row_num}: Loi xử lý dữ liệu - {e}")

    if commit and not errors:
        for bom, items in objects_to_save:
            db.add(bom)
            db.flush()
            for it in items:
                it.bom_id = bom.id
                db.add(it)

        db.commit()
        # Log
        log = ImportLog(
            user_id=user.id,
            ten_nguoi_import=user.full_name or user.username,
            loai_du_lieu="bom",
            ten_file=file.filename,
            so_dong_thanh_cong=len(objects_to_save),
            so_dong_loi=0,
            trang_thai='success'
        )
        db.add(log)
        db.commit()

    return {
        "total": len(df),
        "processed": len(objects_to_save),
        "errors": errors,
        "commit": commit
    }
