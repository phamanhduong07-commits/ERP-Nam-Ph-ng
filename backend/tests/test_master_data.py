"""
Sprint 5 — Smoke test master data (Tier C)
Covers: Customers, Suppliers, Products, Warehouses — CRUD cơ bản.
"""
from datetime import date

from app.models.master import Customer, Supplier, Product, PhapNhan, PhanXuong, Warehouse


# ─── Customers ──────────────────────────────────────────────────────────────

def test_create_customer(client, db_session):
    res = client.post("/api/customers", json={"ma_kh": "KH_MD1", "ten_viet_tat": "KH MD 1"})
    assert res.status_code in (200, 201), res.text
    assert res.json()["ma_kh"] == "KH_MD1"


def test_list_customers(client, db_session):
    client.post("/api/customers", json={"ma_kh": "KH_MD2", "ten_viet_tat": "KH MD 2"})
    res = client.get("/api/customers")
    assert res.status_code == 200


def test_get_customer_by_id(client, db_session):
    create = client.post("/api/customers", json={"ma_kh": "KH_MD3", "ten_viet_tat": "KH MD 3"})
    cid = create.json()["id"]
    res = client.get(f"/api/customers/{cid}")
    assert res.status_code == 200
    assert res.json()["id"] == cid


def test_update_customer(client, db_session):
    create = client.post("/api/customers", json={"ma_kh": "KH_MD4", "ten_viet_tat": "KH MD 4"})
    cid = create.json()["id"]
    res = client.put(f"/api/customers/{cid}", json={"ten_viet_tat": "KH MD 4 Updated"})
    assert res.status_code == 200
    assert res.json()["ten_viet_tat"] == "KH MD 4 Updated"


# ─── Suppliers ──────────────────────────────────────────────────────────────

def test_create_supplier(client, db_session):
    res = client.post("/api/suppliers", json={"ma_ncc": "NCC_MD1", "ten_viet_tat": "NCC MD 1"})
    assert res.status_code in (200, 201), res.text
    assert res.json()["ma_ncc"] == "NCC_MD1"


def test_list_suppliers(client, db_session):
    res = client.get("/api/suppliers")
    assert res.status_code == 200


def test_get_supplier_by_id(client, db_session):
    create = client.post("/api/suppliers", json={"ma_ncc": "NCC_MD2", "ten_viet_tat": "NCC MD 2"})
    sid = create.json()["id"]
    res = client.get(f"/api/suppliers/{sid}")
    assert res.status_code == 200
    assert res.json()["id"] == sid


# ─── Products ───────────────────────────────────────────────────────────────

def test_create_product(client, db_session):
    res = client.post("/api/products", json={
        "ma_amis": "AMIS_MD1", "ma_hang": "SP_MD1", "ten_hang": "Sản phẩm MD 1", "dvt": "Thùng"
    })
    assert res.status_code in (200, 201), res.text
    assert res.json()["ma_hang"] == "SP_MD1"


def test_list_products(client, db_session):
    res = client.get("/api/products")
    assert res.status_code == 200


def test_get_product_by_id(client, db_session):
    create = client.post("/api/products", json={
        "ma_amis": "AMIS_MD2", "ma_hang": "SP_MD2", "ten_hang": "SP MD 2", "dvt": "Thùng"
    })
    pid = create.json()["id"]
    res = client.get(f"/api/products/{pid}")
    assert res.status_code == 200
    assert res.json()["id"] == pid


# ─── Warehouses ─────────────────────────────────────────────────────────────

def test_list_warehouses(client, db_session):
    res = client.get("/api/warehouses")
    assert res.status_code == 200
    assert isinstance(res.json(), list) or "items" in res.json()


def test_create_warehouse(client, db_session):
    pn = PhapNhan(ma_phap_nhan="PN_WH1", ten_phap_nhan="PN WH 1", ten_viet_tat="PNWH1")
    db_session.add(pn)
    db_session.flush()
    px = PhanXuong(ma_xuong="PX_WH1", ten_xuong="PX WH 1", cong_doan="cd2", phap_nhan_id=pn.id)
    db_session.add(px)
    db_session.commit()

    res = client.post("/api/warehouses", json={
        "ma_kho": "KHO_MD1",
        "ten_kho": "Kho MD 1",
        "loai_kho": "NVL_PHU",
        "phan_xuong_id": px.id,
        "trang_thai": True,
    })
    assert res.status_code in (200, 201), res.text
    assert res.json()["ma_kho"] == "KHO_MD1"
