"""MRP Lite service — tính nhu cầu nguyên liệu từ lệnh sản xuất."""
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.production import ProductionOrder
from app.models.bom import ProductionBOM
from app.models.inventory import InventoryBalance
from app.models.master import PaperMaterial


def calculate_mrp(order_ids: list[int], db: Session) -> list[dict]:
    """
    Tính nhu cầu nguyên liệu từ danh sách lệnh sản xuất.
    Trả về list: {paper_material_id, ten_nguyen_lieu, ma_ky_hieu,
                  can_thiet_kg, ton_kho_kg, thieu_hut_kg}
    """
    need: dict[int, Decimal] = {}   # paper_material_id → kg cần
    names: dict[int, str] = {}
    codes: dict[int, str] = {}

    for order_id in order_ids:
        order = db.get(ProductionOrder, order_id)
        if not order:
            continue
        for item in order.items:
            bom = (
                db.query(ProductionBOM)
                .filter(ProductionBOM.production_order_item_id == item.id)
                .first()
            )
            if not bom:
                continue
            for bi in bom.items:
                if not bi.paper_material_id or not bi.trong_luong_can_tong:
                    continue
                mid = bi.paper_material_id
                need[mid] = need.get(mid, Decimal("0")) + (bi.trong_luong_can_tong or Decimal("0"))

    # Tồn kho giấy
    stock: dict[int, Decimal] = {}
    if need:
        balances = (
            db.query(InventoryBalance)
            .filter(InventoryBalance.paper_material_id.in_(list(need.keys())))
            .all()
        )
        for b in balances:
            mid = b.paper_material_id
            stock[mid] = stock.get(mid, Decimal("0")) + b.ton_luong

    # Tên nguyên liệu
    if need:
        mats = db.query(PaperMaterial).filter(PaperMaterial.id.in_(list(need.keys()))).all()
        for m in mats:
            names[m.id] = m.ten or m.ma_chinh or str(m.id)
            codes[m.id] = m.ma_ky_hieu or m.ma_chinh or ""

    result = []
    for mid, can_thiet in need.items():
        ton_kho = stock.get(mid, Decimal("0"))
        thieu_hut = max(Decimal("0"), can_thiet - ton_kho)
        result.append({
            "paper_material_id": mid,
            "ten_nguyen_lieu": names.get(mid, f"ID:{mid}"),
            "ma_ky_hieu": codes.get(mid, ""),
            "can_thiet_kg": float(can_thiet),
            "ton_kho_kg": float(ton_kho),
            "thieu_hut_kg": float(thieu_hut),
        })

    result.sort(key=lambda x: x["thieu_hut_kg"], reverse=True)
    return result
