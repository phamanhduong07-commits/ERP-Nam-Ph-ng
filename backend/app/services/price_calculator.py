"""
price_calculator.py
===================
BOM + Price Calculator for Vietnamese carton box (thùng carton) manufacturing.

All monetary values in VND (đồng).
Areas in m².  Weights in kg.
"""

from __future__ import annotations

import math
from typing import Any


# ---------------------------------------------------------------------------
# 1. Indirect cost (Chi phí gián tiếp) — đ/m²
# ---------------------------------------------------------------------------

_INDIRECT_COST: dict[int, float] = {
    3: 898.0,
    5: 1178.2,
    7: 1800.2,
}

_INDIRECT_BREAKDOWN: dict[int, list[dict]] = {
    3: [
        {"ten": "Bột",                         "don_gia_m2": 137},
        {"ten": "Gas / Củi",                   "don_gia_m2": 194},
        {"ten": "Xút",                         "don_gia_m2": 14},
        {"ten": "Điện",                        "don_gia_m2": 50},
        {"ten": "Lương sóng",                  "don_gia_m2": 160},
        {"ten": "Khấu hao nhà xưởng",          "don_gia_m2": 130},
        {"ten": "Khấu hao máy móc",            "don_gia_m2": 100},
        {"ten": "Chi phí gián tiếp (văn phòng)", "don_gia_m2": 113},
    ],
    5: [
        {"ten": "Bột",                         "don_gia_m2": 274},
        {"ten": "Gas / Củi",                   "don_gia_m2": 194},
        {"ten": "Xút",                         "don_gia_m2": 28},
        {"ten": "Điện",                        "don_gia_m2": 49.2},
        {"ten": "Lương sóng",                  "don_gia_m2": 200},
        {"ten": "Khấu hao nhà xưởng",          "don_gia_m2": 130},
        {"ten": "Khấu hao máy móc",            "don_gia_m2": 150},
        {"ten": "Chi phí gián tiếp (văn phòng)", "don_gia_m2": 153},
    ],
    7: [
        {"ten": "Bột",                         "don_gia_m2": 274},
        {"ten": "Gas / Củi",                   "don_gia_m2": 194},
        {"ten": "Xút",                         "don_gia_m2": 28},
        {"ten": "Điện",                        "don_gia_m2": 49.2},
        {"ten": "Lương sóng",                  "don_gia_m2": 200},
        {"ten": "Khấu hao nhà xưởng",          "don_gia_m2": 130},
        {"ten": "Khấu hao máy móc",            "don_gia_m2": 150},
        {"ten": "Chi phí gián tiếp (văn phòng)", "don_gia_m2": 775},
    ],
}


def get_indirect_cost(so_lop: int) -> float:
    """Return the indirect cost in đ/m² for the given number of layers."""
    cost = _INDIRECT_COST.get(so_lop)
    if cost is None:
        raise ValueError(f"so_lop phải là 3, 5 hoặc 7 (nhận: {so_lop})")
    return cost


# ---------------------------------------------------------------------------
# 2. Spoilage rate (Chi phí hao hụt) — decimal fraction
# ---------------------------------------------------------------------------

# Giấy tấm (tam): tỷ lệ cố định theo số lớp
_SPOILAGE_TAM: dict[int, float] = {3: 0.04, 5: 0.05, 7: 0.07}

# Giấy thùng (A1/A3/A5): bảng theo số lượng — chung cho mọi số lớp
_SPOILAGE_THUNG: list[tuple[float, float]] = [
    (200,      0.30),
    (400,      0.20),
    (600,      0.15),
    (1000,     0.10),
    (1500,     0.08),
    (2000,     0.07),
    (math.inf, 0.06),
]


def get_spoilage_rate(so_luong: float, so_lop: int, loai_thung: str = "") -> float:
    """Return spoilage rate as a decimal (e.g. 0.15 for 15%).

    Giấy tấm: fixed rate by layer count (4/5/7%).
    Giấy thùng: quantity-based table, same for all layer counts.
    """
    if so_lop not in (3, 5, 7):
        raise ValueError(f"so_lop phải là 3, 5 hoặc 7 (nhận: {so_lop})")
    if loai_thung.upper().strip() == "TAM":
        return _SPOILAGE_TAM.get(so_lop, 0.05)
    for max_qty, rate in _SPOILAGE_THUNG:
        if so_luong <= max_qty:
            return rate
    return _SPOILAGE_THUNG[-1][1]


# ---------------------------------------------------------------------------
# 3. Corrugated take-up factors (tỷ lệ sóng)
# ---------------------------------------------------------------------------

_TAKE_UP_FACTOR: dict[str, float] = {
    "E": 1.22,
    "B": 1.32,
    "C": 1.45,
    "A": 1.56,
}


def get_take_up_factor(flute_type: str) -> float:
    """Return take-up factor for the given flute type (E/B/C/A)."""
    factor = _TAKE_UP_FACTOR.get(flute_type.upper().strip())
    if factor is None:
        raise ValueError(
            f"Loại sóng không hợp lệ: '{flute_type}'. Chấp nhận: E, B, C, A"
        )
    return factor


# ---------------------------------------------------------------------------
# 4. Parse corrugated layer types from to_hop_song
# ---------------------------------------------------------------------------

def parse_song_types(to_hop_song: str, so_lop: int) -> list[str]:
    """
    Parse the 'to_hop_song' string into a list of flute types for each
    corrugated layer, ordered from outer to inner.

    Examples:
        "C-B"  → ["C", "B"]   (5 or 7-layer, song_1=C, song_2=B)
        "B"    → ["B"]         (3-layer)
        "BCE"  → ["B", "C", "E"]  (7-layer, no dash separator)
        "B-C-E"→ ["B", "C", "E"]
    """
    if not to_hop_song:
        raise ValueError("to_hop_song không được để trống")

    # Try dash-separated first
    if "-" in to_hop_song:
        parts = [p.strip().upper() for p in to_hop_song.split("-") if p.strip()]
    else:
        # Each character is a flute type
        parts = [c.upper() for c in to_hop_song.strip() if c.strip()]

    # Validate each part
    for p in parts:
        if p not in _TAKE_UP_FACTOR:
            raise ValueError(f"Loại sóng không hợp lệ trong to_hop_song: '{p}'")

    expected_song_layers = {3: 1, 5: 2, 7: 3}
    expected = expected_song_layers.get(so_lop)
    if expected is not None and len(parts) != expected:
        raise ValueError(
            f"to_hop_song '{to_hop_song}' có {len(parts)} sóng "
            f"nhưng {so_lop}-lớp cần {expected} sóng"
        )
    return parts


# ---------------------------------------------------------------------------
# 5. Box dimension / area calculation
# ---------------------------------------------------------------------------

def calculate_dien_tich(
    loai_thung: str,
    dai: float,
    rong: float,
    cao: float,
    so_lop: int,
) -> dict[str, Any]:
    """
    Calculate all dimensions and area for the box.

    loai_thung:
        "A1"       — Thùng thường
        "A3"       — Nắp chồm
        "A5"       — Âm dương (Nắp/Đáy)
        "A7"       — Thùng 1 nắp
        "GOI_GIUA" — Gói giữa
        "GOI_SUON" — Gói sườn
        "TAM"      — Giấy tấm (tấm phẳng)

    Returns a dict with:
        kho1, dai1, so_dao, kho_tt, dai_tt,
        kho_kh, dai_kh, dien_tich  (m²/unit)
    """
    loai = loai_thung.upper().strip()

    # dai_tt standard: 3/5-layer = (D+R)*2+4, 7-layer = (D+R)*2+5
    dai_tt_std = (dai + rong) * 2 + (5 if so_lop == 7 else 4)

    # kho_kh offset for A1-style boxes (replaces the raw +3 tolerance in kho1)
    kho_offset_a1 = {3: 0.2, 5: 0.4, 7: 0.8}.get(so_lop, 0.2)
    # A7 uses half the A1 offset (kho1 uses Rộng/2)
    kho_offset_a7 = {3: 0.1, 5: 0.2, 7: 0.4}.get(so_lop, 0.1)

    if loai == "TAM":
        kho1 = rong + cao + 3
        dai1 = (dai + rong) * 2 + 5
        so_dao = math.floor(180 / kho1) if kho1 > 0 else 1
        kho_tt = kho1 * so_dao + 1.8
        dai_tt = dai_tt_std
        kho_kh = kho_tt
        dai_kh = dai_tt
        dien_tich = kho_tt * dai_tt / 10000

    elif loai == "A1":
        kho1 = rong + cao + 3
        dai1 = (dai + rong) * 2 + 5
        so_dao = math.floor(180 / kho1) if kho1 > 0 else 1
        kho_tt = kho1 * so_dao + 1.8
        dai_tt = dai_tt_std
        kho_kh = rong + cao + kho_offset_a1
        dai_kh = (dai + rong) * 2 + 3
        dien_tich = kho_kh * dai_kh / 10000

    elif loai == "A3":
        kho1 = 2 * rong + cao + 3
        dai1 = (dai + rong) * 2 + 5
        so_dao = math.floor(180 / kho1) if kho1 > 0 else 1
        kho_tt = kho1 * so_dao + 1.8
        dai_tt = dai_tt_std
        kho_kh = 2 * rong + cao        # KH: (Rộng×2)+Cao — no layer offset
        dai_kh = (dai + rong) * 2 + 3
        dien_tich = kho_kh * dai_kh / 10000

    elif loai == "A5":
        kho1 = 2 * cao + rong + 2
        dai1 = 2 * cao + dai + 2
        so_dao = math.floor(180 / kho1) if kho1 > 0 else 1
        kho_tt = kho1 * so_dao + 1.8
        dai_tt = dai1                  # same for all layers: (2×Cao)+Dài+2
        kho_kh = 2 * cao + rong        # KH: (Cao×2)+Rộng
        dai_kh = 2 * cao + dai         # KH: (Cao×2)+Dài
        dien_tich = kho_kh * dai_kh / 10000

    elif loai == "A7":
        # Thùng 1 nắp
        kho1 = rong / 2 + cao + 3
        dai1 = (dai + rong) * 2 + 5
        so_dao = math.floor(180 / kho1) if kho1 > 0 else 1
        kho_tt = kho1 * so_dao + 1.8
        dai_tt = dai_tt_std
        kho_kh = rong / 2 + cao + kho_offset_a7
        dai_kh = (dai + rong) * 2 + 3
        dien_tich = kho_kh * dai_kh / 10000

    elif loai == "GOI_GIUA":
        kho1 = 2 * cao + rong + 3
        dai1 = (dai + rong) * 2 + 5
        so_dao = math.floor(180 / kho1) if kho1 > 0 else 1
        kho_tt = kho1 * so_dao + 1.8
        dai_tt = dai_tt_std
        kho_kh = 2 * rong + cao        # KH: (Rộng×2)+Cao
        dai_kh = (dai + rong) * 2      # KH: (Dài+Rộng)×2
        dien_tich = kho_kh * dai_kh / 10000

    elif loai == "GOI_SUON":
        kho1 = 2 * rong + 3 * cao + 3
        dai1 = dai + 2 * cao + 5
        so_dao = math.floor(180 / kho1) if kho1 > 0 else 1
        kho_tt = kho1 * so_dao + 1.8
        dai_tt = dai + 2 * cao + 3     # same for all layers
        kho_kh = 2 * rong + cao        # KH: (Rộng×2)+Cao
        dai_kh = 2 * dai + 3 * rong   # KH: (2×Dài)+(3×Rộng)
        dien_tich = kho_kh * dai_kh / 10000

    else:
        raise ValueError(
            f"loai_thung không hợp lệ: '{loai_thung}'. "
            "Chấp nhận: A1, A3, A5, A7, GOI_GIUA, GOI_SUON, TAM"
        )

    return {
        "kho1": round(kho1, 4),
        "dai1": round(dai1, 4),
        "so_dao": so_dao,
        "kho_tt": round(kho_tt, 4),
        "dai_tt": round(dai_tt, 4),
        "kho_kh": round(kho_kh, 4),
        "dai_kh": round(dai_kh, 4),
        "dien_tich": round(dien_tich, 6),
    }


# ---------------------------------------------------------------------------
# 6. Default profit margins
# ---------------------------------------------------------------------------

# Giấy tấm: phân biệt theo số lớp
# Giấy thùng (A1/A3/A5): 6% đồng nhất
_DEFAULT_PROFIT_TAM: dict[int, float] = {3: 0.07, 5: 0.08, 7: 0.10}
_DEFAULT_PROFIT_THUNG = 0.06


def _default_profit_rate(loai_thung: str, so_lop: int) -> float:
    if loai_thung.upper().strip() == "TAM":
        return _DEFAULT_PROFIT_TAM.get(so_lop, 0.07)
    return _DEFAULT_PROFIT_THUNG  # A1/A3/A5: 6%


# ---------------------------------------------------------------------------
# 7. Add-on cost helpers
# ---------------------------------------------------------------------------

def _calc_chong_tham(mat: int, dien_tich: float) -> float:
    """mat: 0=none, 1=one side, 2=two sides."""
    rate_map = {0: 0, 1: 500, 2: 1000}
    return rate_map.get(mat, 0) * dien_tich


def _calc_in_flexo(so_mau: int, phu_nen: bool, dien_tich: float) -> float:
    """so_mau: 0=no print, 1+=colors."""
    if so_mau <= 0:
        return 0.0
    base_rate = 300  # 1 màu = 300 đ/m²
    extra_per_color = 50  # mỗi màu thêm = +50 đ/m²
    phu_nen_rate = 100  # phủ nền = +100 đ/m²
    rate = base_rate + (so_mau - 1) * extra_per_color
    if phu_nen:
        rate += phu_nen_rate
    return rate * dien_tich


def _calc_in_ky_thuat_so(co_in: bool) -> float:
    """Digital print: 2233 đ/pcs if active."""
    return 2233.0 if co_in else 0.0


def _calc_chap_xa(co_chap: bool) -> float:
    return 150.0 if co_chap else 0.0


def _calc_boi(co_boi: bool, dien_tich: float) -> float:
    return 187.0 * dien_tich if co_boi else 0.0


def _calc_be(so_con: int) -> float:
    """Die-cut cost per piece based on number of pieces per die."""
    be_map = {0: 0, 1: 400, 2: 300, 4: 200, 6: 150, 8: 100}
    return float(be_map.get(so_con, 0))


def _calc_can_mang(mat: int, dien_tich: float) -> float:
    """mat: 0=none, 1=one side 1800đ/m², 2=two sides 3600đ/m²."""
    rate_map = {0: 0, 1: 1800, 2: 3600}
    return rate_map.get(mat, 0) * dien_tich


# ---------------------------------------------------------------------------
# 8. Main price + BOM calculation
# ---------------------------------------------------------------------------

def calculate_price(inp: dict, indirect_breakdown: list[dict] | None = None) -> dict:
    """
    Full price and BOM calculation.

    Required keys in `inp`:
        loai_thung (str): "A1" | "A3" | "A5" | "tam"
        dai (float): cm
        rong (float): cm
        cao (float): cm
        so_lop (int): 3 | 5 | 7
        to_hop_song (str): e.g. "C-B", "B", "BCE"
        so_luong (float): production quantity

        layers (list[dict]): one dict per paper layer, in order:
            mat, song_1, mat_1[, song_2, mat_2[, song_3, mat_3]]
            Each dict:
                vi_tri_lop (str)       — display name
                loai_lop (str)         — "mat" | "song"
                flute_type (str|None)  — E/B/C/A for song layers
                ma_ky_hieu (str)       — paper symbol code
                paper_material_id (int|None)
                dinh_luong (float)     — g/m²
                don_gia_kg (float)     — đ/kg (from PaperMaterial.gia_mua)

    Optional keys in `inp` (add-ons):
        chong_tham (int):        0=no, 1=1 side, 2=2 sides
        in_flexo_mau (int):      0=no print, 1+=num colors
        in_flexo_phu_nen (bool): add 100đ/m²
        in_ky_thuat_so (bool):   2233đ/pcs
        chap_xa (bool):          150đ/pcs
        boi (bool):              187đ/m²
        be_so_con (int):         0/1/2/4/6/8
        can_mang (int):          0/1/2 sides
        san_pham_kho (bool):     2% of (a+b+e)

        ty_le_loi_nhuan (float|None): override default profit margin
        hoa_hong_kd_pct (float):  default 0
        hoa_hong_kh_pct (float):  default 0
        chi_phi_khac (float):     default 0  (flat add-on)
        chiet_khau (float):       default 0  (flat discount)

    Returns a dict with:
        dimensions (dict)       — from calculate_dien_tich
        chi_phi_giay (float)    — a
        chi_phi_gian_tiep (float) — b
        chi_phi_hao_hut (float) — e
        loi_nhuan (float)       — c
        chi_phi_addon (float)   — d total
        addon_detail (dict)     — breakdown of each addon
        gia_ban_co_ban (float)  — p = a+b+c+d+e
        hoa_hong_kd (float)     — f
        hoa_hong_kh (float)     — g
        chi_phi_khac (float)    — h
        chiet_khau (float)      — i
        gia_ban_cuoi (float)
        ty_le_hao_hut (float)
        bom_layers (list[dict]) — per-layer BOM material data
    """

    # ---- Unpack inputs ----
    loai_thung: str = inp["loai_thung"]
    dai: float = float(inp["dai"])
    rong: float = float(inp["rong"])
    cao: float = float(inp["cao"])
    so_lop: int = int(inp["so_lop"])
    to_hop_song: str = inp["to_hop_song"]
    so_luong: float = float(inp["so_luong"])
    layers: list[dict] = inp["layers"]

    # Add-ons
    chong_tham: int = int(inp.get("chong_tham", 0))
    in_flexo_mau: int = int(inp.get("in_flexo_mau", 0))
    in_flexo_phu_nen: bool = bool(inp.get("in_flexo_phu_nen", False))
    in_ky_thuat_so: bool = bool(inp.get("in_ky_thuat_so", False))
    chap_xa: bool = bool(inp.get("chap_xa", False))
    boi: bool = bool(inp.get("boi", False))
    be_so_con: int = int(inp.get("be_so_con", 0))
    can_mang: int = int(inp.get("can_mang", 0))
    san_pham_kho: bool = bool(inp.get("san_pham_kho", False))

    # Pricing params
    ty_le_loi_nhuan: float | None = inp.get("ty_le_loi_nhuan")
    hoa_hong_kd_pct: float = float(inp.get("hoa_hong_kd_pct", 0))
    hoa_hong_kh_pct: float = float(inp.get("hoa_hong_kh_pct", 0))
    chi_phi_khac: float = float(inp.get("chi_phi_khac", 0))
    chiet_khau: float = float(inp.get("chiet_khau", 0))

    # ---- Dimensions ----
    dims = calculate_dien_tich(loai_thung, dai, rong, cao, so_lop)
    dien_tich = dims["dien_tich"]  # m²/unit

    # ---- Parse corrugated layers ----
    song_types = parse_song_types(to_hop_song, so_lop)

    # ---- Paper cost (a) ----
    song_idx = 0
    bom_layers: list[dict] = []
    a = 0.0

    for layer in layers:
        loai_lop: str = layer["loai_lop"]  # "mat" | "song"
        dinh_luong: float = float(layer["dinh_luong"])  # g/m²
        don_gia_kg: float = float(layer["don_gia_kg"])  # đ/kg

        if loai_lop == "mat":
            take_up = 1.0
            flute_type = None
            weight_per_unit = dien_tich * dinh_luong / 1000  # kg
        else:
            # song layer
            if song_idx >= len(song_types):
                raise ValueError(
                    f"Số lớp sóng trong 'layers' vượt quá số sóng của {so_lop}-lớp"
                )
            flute_type = song_types[song_idx]
            song_idx += 1
            take_up = get_take_up_factor(flute_type)
            weight_per_unit = dien_tich * take_up * dinh_luong / 1000  # kg

        cost_per_unit = weight_per_unit * don_gia_kg
        a += cost_per_unit

        bom_layers.append({
            "vi_tri_lop": layer.get("vi_tri_lop", ""),
            "loai_lop": loai_lop,
            "flute_type": flute_type,
            "ma_ky_hieu": layer.get("ma_ky_hieu", ""),
            "paper_material_id": layer.get("paper_material_id"),
            "dinh_luong": dinh_luong,
            "take_up_factor": take_up,
            "dien_tich_1con": round(dien_tich * take_up, 6),
            "trong_luong_1con": round(weight_per_unit, 6),
            "don_gia_kg": don_gia_kg,
            "chi_phi_1con": round(cost_per_unit, 2),
        })

    # ---- Indirect cost (b) ----
    # Dùng bảng từ DB nếu được truyền vào, ngược lại dùng giá trị hardcode
    if indirect_breakdown is not None:
        breakdown_src = indirect_breakdown
        b = sum(float(item["don_gia_m2"]) for item in breakdown_src) * dien_tich
    else:
        b = get_indirect_cost(so_lop) * dien_tich
        breakdown_src = _INDIRECT_BREAKDOWN.get(so_lop, [])
    gian_tiep_breakdown = [
        {"ten": item["ten"], "don_gia_m2": float(item["don_gia_m2"]),
         "thanh_tien": round(float(item["don_gia_m2"]) * dien_tich, 2)}
        for item in breakdown_src
    ]

    # ---- Spoilage (e) ----
    hao_hut_pct = get_spoilage_rate(so_luong, so_lop, loai_thung)
    e = (a + b) * hao_hut_pct

    # ---- BOM material quantities (with spoilage) ----
    qty_with_spoilage = so_luong * (1 + hao_hut_pct)
    for bl in bom_layers:
        if bl["loai_lop"] == "mat":
            area_needed = dien_tich * qty_with_spoilage
        else:
            area_needed = dien_tich * bl["take_up_factor"] * qty_with_spoilage
        weight_needed = area_needed * bl["dinh_luong"] / 1000
        bl["so_luong_sx"] = round(so_luong, 3)
        bl["ty_le_hao_hut"] = round(hao_hut_pct, 4)
        bl["trong_luong_can_tong"] = round(weight_needed, 3)
        bl["thanh_tien"] = round(weight_needed * bl["don_gia_kg"], 2)

    # ---- Profit (c) ----
    if ty_le_loi_nhuan is None:
        ty_le_loi_nhuan = _default_profit_rate(loai_thung, so_lop)
    c = (a + b) * ty_le_loi_nhuan

    # ---- Add-ons (d) ----
    d1 = _calc_chong_tham(chong_tham, dien_tich)
    d2 = _calc_in_flexo(in_flexo_mau, in_flexo_phu_nen, dien_tich)
    d3 = _calc_in_ky_thuat_so(in_ky_thuat_so)
    d4 = _calc_chap_xa(chap_xa)
    d5 = _calc_boi(boi, dien_tich)
    d6 = _calc_be(be_so_con)
    d8 = _calc_can_mang(can_mang, dien_tich)
    d9 = (a + b + e) * 0.02 if san_pham_kho else 0.0

    d = d1 + d2 + d3 + d4 + d5 + d6 + d8 + d9

    # ---- Base price (p) ----
    p = a + b + c + d + e

    # ---- Final price ----
    f = p * hoa_hong_kd_pct
    g = p * hoa_hong_kh_pct
    h = chi_phi_khac
    i = chiet_khau

    gia_ban_cuoi = p + f + g + h - i

    return {
        "dimensions": dims,
        "chi_phi_giay": round(a, 2),
        "chi_phi_gian_tiep": round(b, 2),
        "ty_le_hao_hut": round(hao_hut_pct, 4),
        "chi_phi_hao_hut": round(e, 2),
        "ty_le_loi_nhuan": round(ty_le_loi_nhuan, 4),
        "loi_nhuan": round(c, 2),
        "addon_detail": {
            "d1_chong_tham": round(d1, 2),
            "d2_in_flexo": round(d2, 2),
            "d3_in_ky_thuat_so": round(d3, 2),
            "d4_chap_xa": round(d4, 2),
            "d5_boi": round(d5, 2),
            "d6_be": round(d6, 2),
            "d8_can_mang": round(d8, 2),
            "d9_san_pham_kho": round(d9, 2),
        },
        "chi_phi_addon": round(d, 2),
        "gia_ban_co_ban": round(p, 2),
        "hoa_hong_kd": round(f, 2),
        "hoa_hong_kh": round(g, 2),
        "chi_phi_khac": round(h, 2),
        "chiet_khau": round(i, 2),
        "gia_ban_cuoi": round(gia_ban_cuoi, 2),
        "bom_layers": bom_layers,
        "gian_tiep_breakdown": gian_tiep_breakdown,
    }
