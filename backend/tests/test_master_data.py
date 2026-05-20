"""
Smoke tests — Master Data module
Covers: Products, Suppliers, Customers, Paper Materials, Other Materials, Warehouses
"""

from app.models.master import Customer, Supplier, Product, MaterialGroup, PhapNhan, PhanXuong


# ─── Helpers ────────────────────────────────────────────────────────────────

def _make_material_group(db) -> MaterialGroup:
    """Create a MaterialGroup needed as FK for PaperMaterial / OtherMaterial."""
    mg = MaterialGroup(ma_nhom="MG_TEST", ten_nhom="Nhóm Test", la_nhom_giay=True)
    db.add(mg)
    db.flush()
    return mg


# ─── Products ───────────────────────────────────────────────────────────────

def test_create_product(client, db_session):
    res = client.post("/api/products", json={
        "ma_amis": "AMIS_MD1", "ma_hang": "SP_MD1",
        "ten_hang": "Sản phẩm MD 1", "dvt": "Thùng",
    })
    assert res.status_code in (200, 201), res.text
    assert res.json()["ma_hang"] == "SP_MD1"


def test_list_products(client, db_session):
    client.post("/api/products", json={
        "ma_amis": "AMIS_LIST1", "ten_hang": "SP List 1", "dvt": "Thùng",
    })
    res = client.get("/api/products")
    assert res.status_code == 200
    data = res.json()
    # Endpoint trả về PagedResponse có key "items"
    assert "items" in data or isinstance(data, list)


def test_get_product_by_id(client, db_session):
    create = client.post("/api/products", json={
        "ma_amis": "AMIS_MD2", "ma_hang": "SP_MD2", "ten_hang": "SP MD 2", "dvt": "Thùng",
    })
    assert create.status_code in (200, 201), create.text
    pid = create.json()["id"]
    res = client.get(f"/api/products/{pid}")
    assert res.status_code == 200
    assert res.json()["id"] == pid
    assert res.json()["ma_amis"] == "AMIS_MD2"


def test_update_product(client, db_session):
    create = client.post("/api/products", json={
        "ma_amis": "AMIS_UPD1", "ma_hang": "SP_UPD1", "ten_hang": "SP Update 1", "dvt": "Thùng",
    })
    assert create.status_code in (200, 201), create.text
    pid = create.json()["id"]
    res = client.put(f"/api/products/{pid}", json={"ten_hang": "SP Updated Name"})
    assert res.status_code == 200
    assert res.json()["ten_hang"] == "SP Updated Name"


def test_delete_product_not_found(client, db_session):
    """Products router không có endpoint DELETE → 405 Method Not Allowed."""
    res = client.delete("/api/products/99999")
    assert res.status_code in (404, 405, 422)


def test_product_required_fields(client, db_session):
    """Thiếu field bắt buộc (ten_hang) → 422 Unprocessable Entity."""
    res = client.post("/api/products", json={"ma_amis": "AMIS_BAD"})
    assert res.status_code == 422


def test_product_duplicate_ma_amis(client, db_session):
    """Trùng ma_amis → 400."""
    payload = {"ma_amis": "AMIS_DUP", "ten_hang": "SP Dup", "dvt": "Thùng"}
    r1 = client.post("/api/products", json=payload)
    assert r1.status_code in (200, 201)
    r2 = client.post("/api/products", json=payload)
    assert r2.status_code == 400


# ─── Suppliers ──────────────────────────────────────────────────────────────

def test_create_supplier(client, db_session):
    res = client.post("/api/suppliers", json={"ma_ncc": "NCC_MD1", "ten_viet_tat": "NCC MD 1"})
    assert res.status_code in (200, 201), res.text
    assert res.json()["ma_ncc"] == "NCC_MD1"


def test_list_suppliers(client, db_session):
    client.post("/api/suppliers", json={"ma_ncc": "NCC_LIST1", "ten_viet_tat": "NCC List 1"})
    res = client.get("/api/suppliers")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data or isinstance(data, list)


def test_get_supplier_by_id(client, db_session):
    create = client.post("/api/suppliers", json={"ma_ncc": "NCC_MD2", "ten_viet_tat": "NCC MD 2"})
    assert create.status_code in (200, 201), create.text
    sid = create.json()["id"]
    res = client.get(f"/api/suppliers/{sid}")
    assert res.status_code == 200
    assert res.json()["id"] == sid


def test_update_supplier(client, db_session):
    create = client.post("/api/suppliers", json={"ma_ncc": "NCC_UPD1", "ten_viet_tat": "NCC Upd 1"})
    assert create.status_code in (200, 201), create.text
    sid = create.json()["id"]
    res = client.put(f"/api/suppliers/{sid}", json={"ten_don_vi": "Công ty Updated"})
    assert res.status_code == 200
    assert res.json()["ten_don_vi"] == "Công ty Updated"


def test_supplier_required_fields(client, db_session):
    """Thiếu ten_viet_tat → 422."""
    res = client.post("/api/suppliers", json={"ma_ncc": "NCC_NONAME"})
    assert res.status_code == 422


# ─── Customers ──────────────────────────────────────────────────────────────

def test_create_customer(client, db_session):
    res = client.post("/api/customers", json={"ma_kh": "KH_MD1", "ten_viet_tat": "KH MD 1"})
    assert res.status_code in (200, 201), res.text
    assert res.json()["ma_kh"] == "KH_MD1"


def test_list_customers(client, db_session):
    client.post("/api/customers", json={"ma_kh": "KH_MD2", "ten_viet_tat": "KH MD 2"})
    res = client.get("/api/customers")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data or isinstance(data, list)


def test_get_customer_by_id(client, db_session):
    create = client.post("/api/customers", json={"ma_kh": "KH_MD3", "ten_viet_tat": "KH MD 3"})
    assert create.status_code in (200, 201), create.text
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


def test_customer_required_fields(client, db_session):
    """Thiếu ten_viet_tat → 422."""
    res = client.post("/api/customers", json={"ma_kh": "KH_NONAME"})
    assert res.status_code == 422


# ─── Paper Materials (Vật tư giấy) ──────────────────────────────────────────

def test_list_paper_materials(client, db_session):
    """GET /api/paper-materials → 200 và có key items."""
    res = client.get("/api/paper-materials")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data or isinstance(data, list)


def test_create_paper_material(client, db_session):
    """Tạo MaterialGroup trước rồi tạo PaperMaterial → 201."""
    mg = _make_material_group(db_session)
    db_session.commit()
    res = client.post("/api/paper-materials", json={
        "ma_chinh": "GIAY_TEST1",
        "ten": "Giấy Test 1",
        "ma_nhom_id": mg.id,
        "dvt": "Kg",
    })
    assert res.status_code in (200, 201), res.text
    data = res.json()
    assert data["ma_chinh"] == "GIAY_TEST1"


def test_create_paper_material_required_fields(client, db_session):
    """Thiếu ma_nhom_id (FK bắt buộc) → 422."""
    res = client.post("/api/paper-materials", json={
        "ma_chinh": "GIAY_BAD",
        "ten": "Giấy Bad",
    })
    assert res.status_code == 422


# ─── Other Materials (NVL khác) ──────────────────────────────────────────────

def test_list_other_materials(client, db_session):
    res = client.get("/api/other-materials")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data or isinstance(data, list)


def test_create_other_material(client, db_session):
    """Tạo MaterialGroup trước rồi tạo OtherMaterial → 201."""
    mg = MaterialGroup(ma_nhom="MG_NVL1", ten_nhom="Nhóm NVL 1", la_nhom_giay=False)
    db_session.add(mg)
    db_session.commit()
    res = client.post("/api/other-materials", json={
        "ma_chinh": "NVL_TEST1",
        "ten": "NVL Test 1",
        "ma_nhom_id": mg.id,
        "dvt": "Kg",
    })
    assert res.status_code in (200, 201), res.text
    assert res.json()["ma_chinh"] == "NVL_TEST1"


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
