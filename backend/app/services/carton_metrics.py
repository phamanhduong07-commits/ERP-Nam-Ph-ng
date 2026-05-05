from decimal import Decimal

from app.models.production import ProductionOrderItem
from app.services.price_calculator import calculate_dien_tich


TAKE_UP_FACTORS = {
    "E": Decimal("1.22"),
    "B": Decimal("1.32"),
    "C": Decimal("1.45"),
    "A": Decimal("1.56"),
}

# Standard flute thickness in millimeters. m3 = m2 * (mm / 1000).
FLUTE_THICKNESS_MM = {
    "E": Decimal("1.5"),
    "B": Decimal("3.0"),
    "C": Decimal("3.5"),
    "A": Decimal("4.5"),
}


def dec_or_zero(value) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def parse_flutes(to_hop_song: str | None) -> list[str]:
    song = (to_hop_song or "").upper()
    return [c for c in song if c in TAKE_UP_FACTORS]


def song_take_up(to_hop_song: str | None, idx: int) -> Decimal:
    flutes = parse_flutes(to_hop_song)
    if flutes:
        key = flutes[min(idx, len(flutes) - 1)]
        return TAKE_UP_FACTORS.get(key, Decimal("1.45"))
    return Decimal("1.45")


def standard_thickness_m(to_hop_song: str | None) -> Decimal:
    flutes = parse_flutes(to_hop_song)
    if not flutes:
        return Decimal("0")
    thickness_mm = sum((FLUTE_THICKNESS_MM.get(s, Decimal("0")) for s in flutes), Decimal("0"))
    return thickness_mm / Decimal("1000")


def _first_present(*values):
    for value in values:
        if value is not None and value != "":
            return value
    return None


def _area_per_unit(item: ProductionOrderItem) -> Decimal:
    current = dec_or_zero(item.dien_tich)
    if current > 0:
        return current

    product = getattr(item, "product", None)
    dai = _first_present(item.dai, getattr(product, "dai", None))
    rong = _first_present(item.rong, getattr(product, "rong", None))
    cao = _first_present(item.cao, getattr(product, "cao", None))
    so_lop = _first_present(item.so_lop, getattr(product, "so_lop", None), 3)
    loai_thung = _first_present(item.loai_thung, getattr(product, "loai", None), "A1")

    if not dai or not rong or not cao:
        return Decimal("0")

    try:
        dims = calculate_dien_tich(
            str(loai_thung),
            float(dai),
            float(rong),
            float(cao),
            int(so_lop or 3),
        )
    except Exception:
        return Decimal("0")
    return Decimal(str(dims.get("dien_tich") or 0))


def _to_hop_song(item: ProductionOrderItem) -> str | None:
    if item.to_hop_song:
        return item.to_hop_song
    so_lop = int(item.so_lop or 0)
    if so_lop == 3:
        return "B"
    if so_lop == 5:
        return "BC"
    if so_lop == 7:
        return "BCB"
    return None


def production_item_metrics(item: ProductionOrderItem | None, qty: Decimal) -> dict[str, Decimal]:
    if not item:
        return {"dien_tich": Decimal("0"), "trong_luong": Decimal("0"), "the_tich": Decimal("0")}

    to_hop_song = _to_hop_song(item)
    area_per_unit = _area_per_unit(item)
    total_area = area_per_unit * qty

    gsm_total = Decimal("0")
    for field in ("mat_dl", "mat_1_dl", "mat_2_dl", "mat_3_dl"):
        gsm_total += dec_or_zero(getattr(item, field, None))
    for idx, field in enumerate(("song_1_dl", "song_2_dl", "song_3_dl")):
        gsm_total += dec_or_zero(getattr(item, field, None)) * song_take_up(to_hop_song, idx)

    return {
        "dien_tich": total_area,
        "trong_luong": total_area * gsm_total / Decimal("1000"),
        "the_tich": total_area * standard_thickness_m(to_hop_song),
    }
