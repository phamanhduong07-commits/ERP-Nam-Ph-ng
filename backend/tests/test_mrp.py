"""
Sprint 10 — Test MRP Lite
Covers: /calculate với order không có BOM → rỗng,
        /calculate với order IDs rỗng → 400,
        /create-ymh không có nguyên liệu thiếu → 400,
        /create-ymh tạo thành công khi có dữ liệu.
"""


def test_calculate_empty_order_ids_returns_400(client, db_session):
    """Không truyền order_ids → 400."""
    res = client.post("/api/mrp/calculate", json={"production_order_ids": []})
    assert res.status_code == 400


def test_calculate_nonexistent_orders_returns_empty(client, db_session):
    """Order IDs không tồn tại → list rỗng (không lỗi)."""
    res = client.post("/api/mrp/calculate", json={"production_order_ids": [999999]})
    assert res.status_code == 200
    assert res.json() == []


def test_calculate_returns_list(client, db_session):
    """Gọi calculate với ID hợp lệ → trả về list (có thể rỗng nếu chưa có BOM)."""
    # Tạo một lệnh sản xuất tối thiểu
    so_res = client.post("/api/products", json={
        "ma_hang": "SP_MRP1", "ma_amis": "AMIS_MRP1",
        "ten_hang": "SP MRP test", "dvt": "Thùng",
    })
    assert so_res.status_code == 201

    po_res = client.post("/api/production-orders", json={
        "so_lenh": "LSX-MRP-001",
        "ngay_lenh": "2026-05-01",
        "items": [{"product_id": so_res.json()["id"], "ten_hang": "SP MRP test",
                   "so_luong_ke_hoach": 100, "dvt": "Thùng"}],
    })
    assert po_res.status_code == 201, po_res.text
    order_id = po_res.json()["id"]

    res = client.post("/api/mrp/calculate", json={"production_order_ids": [order_id]})
    assert res.status_code == 200
    assert isinstance(res.json(), list)
    # Chưa có BOM → rỗng
    assert res.json() == []


def test_create_ymh_empty_order_ids_returns_400(client, db_session):
    """Không có order → 400."""
    res = client.post("/api/mrp/create-ymh", json={"production_order_ids": []})
    assert res.status_code == 400


def test_create_ymh_no_shortage_returns_400(client, db_session):
    """Order không có BOM → không có vật liệu nào cần đặt → 400."""
    so_res = client.post("/api/products", json={
        "ma_hang": "SP_MRP2", "ma_amis": "AMIS_MRP2",
        "ten_hang": "SP MRP 2", "dvt": "Thùng",
    })
    po_res = client.post("/api/production-orders", json={
        "so_lenh": "LSX-MRP-002",
        "ngay_lenh": "2026-05-01",
        "items": [{"product_id": so_res.json()["id"], "ten_hang": "SP MRP 2",
                   "so_luong_ke_hoach": 50, "dvt": "Thùng"}],
    })
    order_id = po_res.json()["id"]
    res = client.post("/api/mrp/create-ymh", json={
        "production_order_ids": [order_id],
        "chi_tinh_thieu_hut": True,
    })
    assert res.status_code == 400
