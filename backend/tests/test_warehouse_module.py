from datetime import date
from decimal import Decimal

from app.models.accounting import JournalEntry
from app.models.inventory import InventoryBalance
from app.models.master import PhanXuong, PhapNhan, Warehouse


def _make_warehouse(db, *, ma_pn: str, ma_px: str, ma_kho: str, loai_kho: str = "NVL_PHU"):
    pn = PhapNhan(ma_phap_nhan=ma_pn, ten_phap_nhan=f"Phap nhan {ma_pn}", ten_viet_tat=ma_pn)
    db.add(pn)
    db.flush()
    px = PhanXuong(ma_xuong=ma_px, ten_xuong=f"Xuong {ma_px}", cong_doan="cd2", phap_nhan_id=pn.id)
    db.add(px)
    db.flush()
    wh = Warehouse(ma_kho=ma_kho, ten_kho=f"Kho {ma_kho}", loai_kho=loai_kho, phan_xuong_id=px.id, trang_thai=True)
    db.add(wh)
    db.flush()
    return pn, px, wh


def test_stock_adjustment_posts_balanced_inventory_journal(client, db_session):
    pn, px, wh = _make_warehouse(db_session, ma_pn="PN1", ma_px="PX1", ma_kho="K1")
    bal = InventoryBalance(
        warehouse_id=wh.id,
        ten_hang="Vat tu test",
        don_vi="Kg",
        ton_luong=Decimal("10"),
        don_gia_binh_quan=Decimal("5000"),
        gia_tri_ton=Decimal("50000"),
    )
    db_session.add(bal)
    db_session.commit()

    res = client.post("/api/warehouse/stock-adjustments", json={
        "warehouse_id": wh.id,
        "ngay": date.today().isoformat(),
        "ly_do": "Kiem ke test",
        "items": [{"inventory_balance_id": bal.id, "so_luong_thuc_te": 12}],
    })

    assert res.status_code == 201, res.text
    data = res.json()
    assert data["phap_nhan_id"] == pn.id
    assert data["items"][0]["chenhlech"] == 2.0

    journal = db_session.query(JournalEntry).filter(
        JournalEntry.chung_tu_loai == "stock_adjustment",
        JournalEntry.chung_tu_id == data["id"],
    ).one()
    assert journal.phap_nhan_id == pn.id
    assert journal.phan_xuong_id == px.id
    assert journal.tong_no == journal.tong_co


def test_inventory_can_filter_by_legal_entity(client, db_session):
    pn1, _, wh1 = _make_warehouse(db_session, ma_pn="PN1", ma_px="PX1", ma_kho="K1")
    pn2, _, wh2 = _make_warehouse(db_session, ma_pn="PN2", ma_px="PX2", ma_kho="K2")
    db_session.add_all([
        InventoryBalance(warehouse_id=wh1.id, ten_hang="Hang PN1", don_vi="Kg", ton_luong=Decimal("5")),
        InventoryBalance(warehouse_id=wh2.id, ten_hang="Hang PN2", don_vi="Kg", ton_luong=Decimal("7")),
    ])
    db_session.commit()

    res = client.get(f"/api/warehouse/ton-kho?phap_nhan_id={pn1.id}")

    assert res.status_code == 200, res.text
    rows = res.json()
    assert [r["ten_hang"] for r in rows] == ["Hang PN1"]
    assert rows[0]["phap_nhan_id"] == pn1.id
    assert rows[0]["phap_nhan_id"] != pn2.id
