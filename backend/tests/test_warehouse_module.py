from datetime import date
from decimal import Decimal

from app.models.accounting import JournalEntry
from app.models.inventory import InventoryBalance
from app.models.master import Customer, PhanXuong, PhapNhan, Supplier, Warehouse
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.warehouse_doc import DeliveryOrder, DeliveryOrderItem, ProductionOutput


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


def test_approve_goods_receipt_persists_status_and_journal(client, db_session):
    pn, _, wh = _make_warehouse(db_session, ma_pn="PN3", ma_px="PX3", ma_kho="K3")
    supplier = Supplier(ma_ncc="NCC1", ten_viet_tat="NCC 1")
    db_session.add(supplier)
    db_session.commit()

    create_res = client.post("/api/warehouse/goods-receipts", json={
        "ngay_nhap": date.today().isoformat(),
        "supplier_id": supplier.id,
        "warehouse_id": wh.id,
        "loai_nhap": "MUA_HANG",
        "items": [{
            "ten_hang": "NVL test",
            "so_luong": 3,
            "dvt": "Kg",
            "don_gia": 10000,
        }],
    })
    assert create_res.status_code == 201, create_res.text
    gr_id = create_res.json()["id"]

    approve_res = client.patch(f"/api/warehouse/goods-receipts/{gr_id}/approve")

    assert approve_res.status_code == 200, approve_res.text
    detail = client.get(f"/api/warehouse/goods-receipts/{gr_id}").json()
    assert detail["trang_thai"] == "da_duyet"
    journal = db_session.query(JournalEntry).filter(
        JournalEntry.chung_tu_loai == "goods_receipt",
        JournalEntry.chung_tu_id == gr_id,
        JournalEntry.loai_but_toan == "goods_receipt",
    ).one()
    assert journal.phap_nhan_id == pn.id
    assert journal.tong_no == journal.tong_co


def test_delete_production_output_creates_reversal_journal(client, db_session):
    pn, px, wh = _make_warehouse(db_session, ma_pn="PN4", ma_px="PX4", ma_kho="K4", loai_kho="THANH_PHAM")
    order = ProductionOrder(
        so_lenh="LSX-REV-1",
        ngay_lenh=date.today(),
        phan_xuong_id=px.id,
        phap_nhan_id=pn.id,
    )
    db_session.add(order)
    db_session.commit()

    create_res = client.post("/api/warehouse/production-outputs", json={
        "ngay_nhap": date.today().isoformat(),
        "production_order_id": order.id,
        "warehouse_id": wh.id,
        "ten_hang": "Thanh pham test",
        "so_luong_nhap": 5,
        "dvt": "Thung",
        "don_gia_xuat_xuong": 20000,
    })
    assert create_res.status_code == 201, create_res.text
    out_id = create_res.json()["id"]

    delete_res = client.delete(f"/api/warehouse/production-outputs/{out_id}")

    assert delete_res.status_code == 200, delete_res.text
    journals = db_session.query(JournalEntry).filter(
        JournalEntry.chung_tu_loai == "phieu_nhap_tp",
        JournalEntry.chung_tu_id == out_id,
    ).all()
    assert {j.loai_but_toan for j in journals} == {"nhap_tp", "dao_nguoc"}
    assert all(j.tong_no == j.tong_co for j in journals)


def test_delete_stock_adjustment_creates_reversal_journal(client, db_session):
    _, _, wh = _make_warehouse(db_session, ma_pn="PN5", ma_px="PX5", ma_kho="K5")
    bal = InventoryBalance(
        warehouse_id=wh.id,
        ten_hang="Vat tu dao nguoc",
        don_vi="Kg",
        ton_luong=Decimal("10"),
        don_gia_binh_quan=Decimal("1000"),
        gia_tri_ton=Decimal("10000"),
    )
    db_session.add(bal)
    db_session.commit()

    create_res = client.post("/api/warehouse/stock-adjustments", json={
        "warehouse_id": wh.id,
        "ngay": date.today().isoformat(),
        "ly_do": "Kiem ke dao nguoc",
        "items": [{"inventory_balance_id": bal.id, "so_luong_thuc_te": 8}],
    })
    assert create_res.status_code == 201, create_res.text
    adj_id = create_res.json()["id"]

    delete_res = client.delete(f"/api/warehouse/stock-adjustments/{adj_id}")

    assert delete_res.status_code == 200, delete_res.text
    journals = db_session.query(JournalEntry).filter(
        JournalEntry.chung_tu_loai == "stock_adjustment",
        JournalEntry.chung_tu_id == adj_id,
    ).all()
    assert {j.loai_but_toan for j in journals} == {"dieu_chinh", "dao_nguoc"}
    assert all(j.tong_no == j.tong_co for j in journals)


def test_delivery_rejects_nvl_warehouse(client, db_session):
    _, _, wh = _make_warehouse(db_session, ma_pn="PN6", ma_px="PX6", ma_kho="K6", loai_kho="NVL_PHU")
    customer = Customer(ma_kh="KH1", ten_viet_tat="Khach 1")
    db_session.add(customer)
    db_session.commit()

    res = client.post("/api/warehouse/deliveries", json={
        "ngay_xuat": date.today().isoformat(),
        "customer_id": customer.id,
        "warehouse_id": wh.id,
        "items": [{
            "ten_hang": "NVL khong duoc ban",
            "so_luong": 1,
            "dvt": "Kg",
            "don_gia": 10000,
        }],
    })

    assert res.status_code == 400, res.text


def test_delivery_cogs_uses_inventory_average_cost_not_sale_price(client, db_session):
    _, _, wh = _make_warehouse(db_session, ma_pn="PN7", ma_px="PX7", ma_kho="K7", loai_kho="THANH_PHAM")
    customer = Customer(ma_kh="KH2", ten_viet_tat="Khach 2")
    bal = InventoryBalance(
        warehouse_id=wh.id,
        ten_hang="Thanh pham gia von",
        don_vi="Thung",
        ton_luong=Decimal("5"),
        don_gia_binh_quan=Decimal("4000"),
        gia_tri_ton=Decimal("20000"),
    )
    db_session.add_all([customer, bal])
    db_session.commit()

    res = client.post("/api/warehouse/deliveries", json={
        "ngay_xuat": date.today().isoformat(),
        "customer_id": customer.id,
        "warehouse_id": wh.id,
        "items": [{
            "ten_hang": "Thanh pham gia von",
            "so_luong": 2,
            "dvt": "Thung",
            "don_gia": 10000,
        }],
    })

    assert res.status_code == 201, res.text
    delivery_id = res.json()["id"]
    journal = db_session.query(JournalEntry).filter(
        JournalEntry.chung_tu_loai == "delivery_orders",
        JournalEntry.chung_tu_id == delivery_id,
        JournalEntry.loai_but_toan == "xuat_ban",
    ).one()
    assert journal.tong_no == Decimal("8000.00")
    assert journal.tong_co == Decimal("8000.00")


def test_delete_delivery_creates_reversal_journal(client, db_session):
    _, _, wh = _make_warehouse(db_session, ma_pn="PN8", ma_px="PX8", ma_kho="K8", loai_kho="THANH_PHAM")
    customer = Customer(ma_kh="KH3", ten_viet_tat="Khach 3")
    bal = InventoryBalance(
        warehouse_id=wh.id,
        ten_hang="Thanh pham xoa",
        don_vi="Thung",
        ton_luong=Decimal("4"),
        don_gia_binh_quan=Decimal("3000"),
        gia_tri_ton=Decimal("12000"),
    )
    db_session.add_all([customer, bal])
    db_session.commit()

    create_res = client.post("/api/warehouse/deliveries", json={
        "ngay_xuat": date.today().isoformat(),
        "customer_id": customer.id,
        "warehouse_id": wh.id,
        "items": [{
            "ten_hang": "Thanh pham xoa",
            "so_luong": 1,
            "dvt": "Thung",
            "don_gia": 9000,
        }],
    })
    assert create_res.status_code == 201, create_res.text
    delivery_id = create_res.json()["id"]

    delete_res = client.delete(f"/api/warehouse/deliveries/{delivery_id}")

    assert delete_res.status_code == 200, delete_res.text
    journals = db_session.query(JournalEntry).filter(
        JournalEntry.chung_tu_loai == "delivery_orders",
        JournalEntry.chung_tu_id == delivery_id,
    ).all()
    assert {j.loai_but_toan for j in journals} == {"xuat_ban", "dao_nguoc"}
    db_session.refresh(bal)
    assert bal.ton_luong == Decimal("4.000")


def test_tp_lsx_inventory_ignores_cancelled_delivery(client, db_session):
    pn, px, wh = _make_warehouse(db_session, ma_pn="PN9", ma_px="PX9", ma_kho="K9", loai_kho="THANH_PHAM")
    customer = Customer(ma_kh="KH4", ten_viet_tat="Khach 4")
    order = ProductionOrder(
        so_lenh="LSX-HUY-1",
        ngay_lenh=date.today(),
        phan_xuong_id=px.id,
        phap_nhan_id=pn.id,
    )
    db_session.add_all([customer, order])
    db_session.flush()
    db_session.add_all([
        ProductionOrderItem(
            production_order_id=order.id,
            ten_hang="TP bo phieu huy",
            so_luong_ke_hoach=Decimal("10"),
            dvt="Thung",
        ),
        ProductionOutput(
            so_phieu="TP-HUY-1",
            ngay_nhap=date.today(),
            production_order_id=order.id,
            warehouse_id=wh.id,
            ten_hang="TP bo phieu huy",
            so_luong_nhap=Decimal("10"),
            dvt="Thung",
            don_gia_xuat_xuong=Decimal("1000"),
        ),
    ])
    db_session.flush()
    delivery = DeliveryOrder(
        so_phieu="DO-HUY-1",
        ngay_xuat=date.today(),
        customer_id=customer.id,
        warehouse_id=wh.id,
        trang_thai="huy",
    )
    db_session.add(delivery)
    db_session.flush()
    db_session.add(DeliveryOrderItem(
        delivery_id=delivery.id,
        production_order_id=order.id,
        ten_hang="TP bo phieu huy",
        so_luong=Decimal("4"),
        dvt="Thung",
    ))
    db_session.commit()

    res = client.get("/api/warehouse/ton-kho-tp-lsx")

    assert res.status_code == 200, res.text
    row = next(r for r in res.json() if r["production_order_id"] == order.id)
    assert row["tong_nhap"] == 10.0
    assert row["tong_xuat"] == 0.0
    assert row["ton_kho"] == 10.0
