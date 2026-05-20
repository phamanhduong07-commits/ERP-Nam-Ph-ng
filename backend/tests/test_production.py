"""
Sprint 3.1 — Test production module
Covers: ProductionOrder (create, list, get, filter), status transitions (start, finish, cancel),
        ProductionPlan (create, list), BOM (save, get), invalid items validation.
"""
from datetime import date
from decimal import Decimal

from app.models.master import PhanXuong, PhapNhan, Warehouse
from app.models.production import ProductionOrder, ProductionOrderItem


# ─── helpers ────────────────────────────────────────────────────────────────

def _make_setup(db, *, ma_pn="PN_SX", ma_px="PX_SX", ma_kho="KHO_SX"):
    pn = PhapNhan(ma_phap_nhan=ma_pn, ten_phap_nhan=f"PN {ma_pn}", ten_viet_tat=ma_pn)
    db.add(pn)
    db.flush()
    px = PhanXuong(ma_xuong=ma_px, ten_xuong=f"PX {ma_px}", cong_doan="cd2", phap_nhan_id=pn.id)
    db.add(px)
    db.flush()
    kho = Warehouse(
        ma_kho=ma_kho, ten_kho=f"Kho {ma_kho}",
        loai_kho="THANH_PHAM", phan_xuong_id=px.id, trang_thai=True,
    )
    db.add(kho)
    db.flush()
    return pn, px, kho


def _lsx_payload(phan_xuong_id=None, **kwargs):
    payload = {
        "ngay_lenh": date.today().isoformat(),
        "items": [{"ten_hang": "Thùng test", "so_luong_ke_hoach": 500, "dvt": "Thùng"}],
    }
    if phan_xuong_id:
        payload["phan_xuong_id"] = phan_xuong_id
    payload.update(kwargs)
    return payload


# ─── Tạo lệnh sản xuất ──────────────────────────────────────────────────────

def test_create_production_order_success(client, db_session):
    """Tạo LSX hợp lệ → status 201, so_lenh bắt đầu bằng LSX, trang_thai=moi."""
    pn, px, kho = _make_setup(db_session, ma_pn="PN_SX1", ma_px="PX_SX1", ma_kho="KHO_SX1")
    db_session.commit()

    res = client.post("/api/production-orders", json=_lsx_payload(phan_xuong_id=px.id))

    assert res.status_code == 201, res.text
    data = res.json()
    assert data["so_lenh"].startswith("LSX")
    assert data["trang_thai"] == "moi"
    assert len(data["items"]) == 1


def test_create_production_order_empty_items_rejected(client, db_session):
    """items=[] → 422 validation error."""
    res = client.post("/api/production-orders", json={
        "ngay_lenh": date.today().isoformat(),
        "items": [],
    })
    assert res.status_code == 422


def test_create_production_order_negative_quantity_rejected(client, db_session):
    """so_luong_ke_hoach <= 0 → 422."""
    res = client.post("/api/production-orders", json={
        "ngay_lenh": date.today().isoformat(),
        "items": [{"ten_hang": "Test", "so_luong_ke_hoach": -1}],
    })
    assert res.status_code == 422


# ─── List & Get ─────────────────────────────────────────────────────────────

def test_list_production_orders_returns_list(client, db_session):
    """GET /production-orders → trả về list (có thể rỗng), không crash."""
    res = client.get("/api/production-orders")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data or isinstance(data, list)


def test_get_production_order_by_id(client, db_session):
    """GET /production-orders/{id} → trả đúng LSX."""
    pn, px, kho = _make_setup(db_session, ma_pn="PN_SXG", ma_px="PX_SXG", ma_kho="KHO_SXG")
    db_session.commit()

    create_res = client.post("/api/production-orders", json=_lsx_payload(phan_xuong_id=px.id))
    assert create_res.status_code == 201
    order_id = create_res.json()["id"]

    get_res = client.get(f"/api/production-orders/{order_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == order_id


def test_get_nonexistent_production_order_returns_404(client, db_session):
    """GET /production-orders/999999 → 404."""
    res = client.get("/api/production-orders/999999")
    assert res.status_code == 404


# ─── Direct DB: verify model tạo đúng ───────────────────────────────────────

def test_production_order_item_stored_correctly(client, db_session):
    """Items được lưu vào DB với đúng so_luong_ke_hoach."""
    pn, px, kho = _make_setup(db_session, ma_pn="PN_SXD", ma_px="PX_SXD", ma_kho="KHO_SXD")
    db_session.commit()

    res = client.post("/api/production-orders", json={
        "ngay_lenh": date.today().isoformat(),
        "phan_xuong_id": px.id,
        "items": [
            {"ten_hang": "Thùng A", "so_luong_ke_hoach": 200, "dvt": "Thùng"},
            {"ten_hang": "Thùng B", "so_luong_ke_hoach": 300, "dvt": "Thùng"},
        ],
    })
    assert res.status_code == 201
    order_id = res.json()["id"]

    items = db_session.query(ProductionOrderItem).filter(
        ProductionOrderItem.production_order_id == order_id
    ).all()
    assert len(items) == 2
    total = sum(i.so_luong_ke_hoach for i in items)
    assert total == Decimal("500")


# ─── Status Transitions ──────────────────────────────────────────────────────

def test_production_order_status_transition_start(client, db_session):
    """Chuyển trạng thái moi → dang_chay qua PATCH /{id}/start."""
    pn, px, kho = _make_setup(db_session, ma_pn="PN_START", ma_px="PX_START", ma_kho="KHO_START")
    db_session.commit()

    create_res = client.post("/api/production-orders", json=_lsx_payload(phan_xuong_id=px.id))
    assert create_res.status_code == 201
    order_id = create_res.json()["id"]
    assert create_res.json()["trang_thai"] == "moi"

    start_res = client.patch(f"/api/production-orders/{order_id}/start")
    assert start_res.status_code == 200, start_res.text
    data = start_res.json()
    assert data["trang_thai"] == "dang_chay"
    assert data["ngay_bat_dau_thuc_te"] is not None


def test_production_order_status_transition_complete(client, db_session):
    """Chuyển trạng thái moi → hoan_thanh qua PATCH /{id}/complete."""
    pn, px, kho = _make_setup(db_session, ma_pn="PN_COMP", ma_px="PX_COMP", ma_kho="KHO_COMP")
    db_session.commit()

    create_res = client.post("/api/production-orders", json=_lsx_payload(phan_xuong_id=px.id))
    assert create_res.status_code == 201
    order_id = create_res.json()["id"]

    comp_res = client.patch(f"/api/production-orders/{order_id}/complete")
    assert comp_res.status_code == 200, comp_res.text
    data = comp_res.json()
    assert data["trang_thai"] == "hoan_thanh"
    assert data["ngay_hoan_thanh_thuc_te"] is not None


def test_production_order_start_invalid_state_returns_400(client, db_session):
    """Bắt đầu lệnh đã 'hoan_thanh' → 400."""
    pn, px, kho = _make_setup(db_session, ma_pn="PN_INV", ma_px="PX_INV", ma_kho="KHO_INV")
    db_session.commit()

    create_res = client.post("/api/production-orders", json=_lsx_payload(phan_xuong_id=px.id))
    order_id = create_res.json()["id"]

    # Hoàn thành trước
    client.patch(f"/api/production-orders/{order_id}/complete")

    # Thử start lại → 400
    res = client.patch(f"/api/production-orders/{order_id}/start")
    assert res.status_code == 400


def test_filter_production_orders_by_status(client, db_session):
    """Filter ?trang_thai=moi → chỉ trả về lệnh trạng thái moi."""
    pn, px, kho = _make_setup(db_session, ma_pn="PN_FLT", ma_px="PX_FLT", ma_kho="KHO_FLT")
    db_session.commit()

    # Tạo 2 lệnh, cancel một cái
    r1 = client.post("/api/production-orders", json=_lsx_payload(phan_xuong_id=px.id))
    r2 = client.post("/api/production-orders", json=_lsx_payload(phan_xuong_id=px.id))
    assert r1.status_code == 201
    assert r2.status_code == 201
    o1_id = r1.json()["id"]
    o2_id = r2.json()["id"]

    client.patch(f"/api/production-orders/{o2_id}/cancel")

    # Filter moi → o1 có, o2 không
    res = client.get("/api/production-orders?trang_thai=moi")
    assert res.status_code == 200
    ids = [item["id"] for item in res.json()["items"]]
    assert o1_id in ids
    assert o2_id not in ids

    # Filter huy → o2 có
    res2 = client.get("/api/production-orders?trang_thai=huy")
    assert res2.status_code == 200
    ids2 = [item["id"] for item in res2.json()["items"]]
    assert o2_id in ids2


def test_production_order_items_in_response(client, db_session):
    """LSX tạo với 2 items → response trả đủ items với đúng thông tin."""
    pn, px, kho = _make_setup(db_session, ma_pn="PN_ITEM", ma_px="PX_ITEM", ma_kho="KHO_ITEM")
    db_session.commit()

    res = client.post("/api/production-orders", json={
        "ngay_lenh": date.today().isoformat(),
        "phan_xuong_id": px.id,
        "items": [
            {"ten_hang": "Mặt hàng A", "so_luong_ke_hoach": 100, "dvt": "Thùng"},
            {"ten_hang": "Mặt hàng B", "so_luong_ke_hoach": 200, "dvt": "Cái"},
        ],
    })
    assert res.status_code == 201, res.text
    data = res.json()
    assert len(data["items"]) == 2
    ten_hang_list = [i["ten_hang"] for i in data["items"]]
    assert "Mặt hàng A" in ten_hang_list
    assert "Mặt hàng B" in ten_hang_list


# ─── ProductionPlan Tests ─────────────────────────────────────────────────────

def test_create_production_plan(client, db_session):
    """Tạo kế hoạch sản xuất → 201, trang_thai='nhap'."""
    res = client.post("/api/production-plans", json={
        "ngay_ke_hoach": "2026-05-10",
        "ghi_chu": "KHSX test tạo",
        "lines": [],
    })
    assert res.status_code == 201, res.text
    data = res.json()
    assert "id" in data
    assert "so_ke_hoach" in data
    assert data["so_ke_hoach"].startswith("KH")
    assert data["trang_thai"] == "nhap"


def test_list_production_plans(client, db_session):
    """GET /api/production-plans → 200, paged response với trường items và total."""
    # Tạo ít nhất 1 kế hoạch
    client.post("/api/production-plans", json={
        "ngay_ke_hoach": "2026-05-20",
        "ghi_chu": "KHSX list test",
        "lines": [],
    })

    res = client.get("/api/production-plans")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert isinstance(data["items"], list)
    assert data["total"] >= 1


# ─── BOM Tests ────────────────────────────────────────────────────────────────

def _bom_layers_3lop():
    """3 lớp giấy chuẩn cho test BOM."""
    return [
        {
            "vi_tri_lop": "Mặt ngoài", "loai_lop": "mat", "flute_type": None,
            "ma_ky_hieu": "K150", "paper_material_id": None,
            "dinh_luong": 150, "don_gia_kg": 15000,
        },
        {
            "vi_tri_lop": "Sóng B", "loai_lop": "song", "flute_type": "B",
            "ma_ky_hieu": "S100", "paper_material_id": None,
            "dinh_luong": 100, "don_gia_kg": 14000,
        },
        {
            "vi_tri_lop": "Mặt trong", "loai_lop": "mat", "flute_type": None,
            "ma_ky_hieu": "K120", "paper_material_id": None,
            "dinh_luong": 120, "don_gia_kg": 14500,
        },
    ]


def _bom_base_payload(item_id: int, sl: float = 500) -> dict:
    return {
        "production_order_item_id": item_id,
        "loai_thung": "A1",
        "dai": 400, "rong": 300, "cao": 250,
        "so_lop": 3, "to_hop_song": "B",
        "so_luong": sl,
        "layers": _bom_layers_3lop(),
        "chong_tham": 0, "in_flexo_mau": 0, "in_flexo_phu_nen": False,
        "in_ky_thuat_so": False, "chap_xa": False, "boi": False,
        "be_so_con": 0, "dan": False, "ghim": False, "can_mang": 0,
        "san_pham_kho": False, "ty_le_loi_nhuan": None,
        "hoa_hong_kd_pct": 0.0, "hoa_hong_kh_pct": 0.0,
        "chi_phi_khac": 0.0, "chiet_khau": 0.0,
    }


def test_create_bom(client, db_session):
    """POST /api/bom/save → 201, BOM được lưu với trang_thai='draft'."""
    pn, px, kho = _make_setup(db_session, ma_pn="PN_BOM1", ma_px="PX_BOM1", ma_kho="KHO_BOM1")
    db_session.commit()

    create_res = client.post("/api/production-orders", json=_lsx_payload(phan_xuong_id=px.id))
    assert create_res.status_code == 201
    item_id = create_res.json()["items"][0]["id"]

    bom_res = client.post("/api/bom/save", json=_bom_base_payload(item_id, sl=500))
    assert bom_res.status_code == 201, bom_res.text
    data = bom_res.json()
    assert data["id"] > 0
    assert data["loai_thung"] == "A1"
    assert data["trang_thai"] == "draft"
    assert data["production_order_item_id"] == item_id
    assert len(data["items"]) == 3  # 3 lớp giấy


def test_list_bom(client, db_session):
    """GET /api/bom → 200, list các BOM đã lưu."""
    pn, px, kho = _make_setup(db_session, ma_pn="PN_BOM2", ma_px="PX_BOM2", ma_kho="KHO_BOM2")
    db_session.commit()

    create_res = client.post("/api/production-orders", json=_lsx_payload(phan_xuong_id=px.id))
    item_id = create_res.json()["items"][0]["id"]
    client.post("/api/bom/save", json=_bom_base_payload(item_id, sl=300))

    res = client.get("/api/bom")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
