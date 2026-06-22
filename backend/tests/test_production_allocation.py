"""
Unit tests for Production Sessions cost allocation.
Tests the 2-step paper allocation algorithm and layer-coefficient glue allocation.
"""
from datetime import date
from decimal import Decimal
import pytest
from app.models.master import PhanXuong, PhapNhan, Warehouse, PaperMaterial, OtherMaterial, MaterialGroup
from app.models.inventory import InventoryBalance
from app.models.warehouse_doc import GiayRoll
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.production import (
    ProductionSession, ProductionSessionRoll, ProductionSessionMaterial,
    ProductionSessionPaperWaste, ProductionOrder, ProductionOrderItem
)

def _setup_entities(db):
    # Setup PhapNhan, PhanXuong, Warehouse
    pn = PhapNhan(ma_phap_nhan="PN_ALLOC", ten_phap_nhan="PN Alloc", ten_viet_tat="PNA")
    db.add(pn)
    db.flush()

    px = PhanXuong(ma_xuong="PX_ALLOC", ten_xuong="PX Alloc", cong_doan="cd2", phap_nhan_id=pn.id)
    db.add(px)
    db.flush()

    wh = Warehouse(ma_kho="KH_ALLOC", ten_kho="Kho Alloc", loai_kho="KHO_PHOI", phan_xuong_id=px.id, trang_thai=True)
    db.add(wh)
    db.flush()

    # Setup MaterialGroup for Paper
    pg = MaterialGroup(ma_nhom="PG_ALLOC", ten_nhom="Nhom Giay Alloc", la_nhom_giay=True)
    db.add(pg)
    db.flush()

    # Setup MaterialGroup for Other Materials
    omg = MaterialGroup(ma_nhom="OMG_ALLOC", ten_nhom="Nhom Keo Alloc", la_nhom_giay=False)
    db.add(omg)
    db.flush()

    # Setup PaperMaterials
    pm1 = PaperMaterial(ma_chinh="PM1", ma_nhom_id=pg.id, ten="Giay PM1", dvt="Kg", su_dung=True, kho=Decimal("100"), dinh_luong=Decimal("150"))
    pm2 = PaperMaterial(ma_chinh="PM2", ma_nhom_id=pg.id, ten="Giay PM2", dvt="Kg", su_dung=True, kho=Decimal("100"), dinh_luong=Decimal("200"))
    db.add_all([pm1, pm2])
    db.flush()

    # Setup OtherMaterial (Glue)
    om = OtherMaterial(ma_chinh="GLUE1", ten="Keo dan 1", dvt="Kg", ma_nhom_id=omg.id, trang_thai=True)
    db.add(om)
    db.flush()

    # Setup Inventory balances for prices
    bal_pm1 = InventoryBalance(warehouse_id=wh.id, paper_material_id=pm1.id, ten_hang=pm1.ten, don_vi="Kg", ton_luong=Decimal("1000"), don_gia_binh_quan=Decimal("15000"))
    bal_pm2 = InventoryBalance(warehouse_id=wh.id, paper_material_id=pm2.id, ten_hang=pm2.ten, don_vi="Kg", ton_luong=Decimal("1000"), don_gia_binh_quan=Decimal("20000"))
    bal_om = InventoryBalance(warehouse_id=wh.id, other_material_id=om.id, ten_hang=om.ten, don_vi="Kg", ton_luong=Decimal("1000"), don_gia_binh_quan=Decimal("10000"))
    db.add_all([bal_pm1, bal_pm2, bal_om])
    db.flush()

    # Setup GiayRolls
    r1 = GiayRoll(barcode="ROLL1", paper_material_id=pm1.id, warehouse_id=wh.id, trong_luong_ban_dau=Decimal("500"), trong_luong_con_lai=Decimal("500"), trang_thai="trong_kho")
    r2 = GiayRoll(barcode="ROLL2", paper_material_id=pm2.id, warehouse_id=wh.id, trong_luong_ban_dau=Decimal("500"), trong_luong_con_lai=Decimal("500"), trang_thai="trong_kho")
    db.add_all([r1, r2])
    db.flush()

    return pn, px, wh, pm1, pm2, om, r1, r2

def test_production_session_crud(client, db_session):
    pn, px, wh, pm1, pm2, om, r1, r2 = _setup_entities(db_session)
    db_session.commit()

    # 1. Create session
    res = client.post("/api/warehouse/production-sessions", json={
        "ten_phien": "Phien Test 1",
        "phan_xuong_id": px.id
    })
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["ten_phien"] == "Phien Test 1"
    assert data["trang_thai"] == "dang_chay"
    session_id = data["id"]

    # 2. Get list and details
    list_res = client.get("/api/warehouse/production-sessions")
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1

    detail_res = client.get(f"/api/warehouse/production-sessions/{session_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["ten_phien"] == "Phien Test 1"
    assert len(detail["rolls"]) == 0
    assert len(detail["materials"]) == 0

    # 3. Update wastes
    waste_res = client.patch(f"/api/warehouse/production-sessions/{session_id}/wastes", json={
        "wastes": [
            {"flute_type": "B", "so_kg_hao_hut": 10.5},
            {"flute_type": "C", "so_kg_hao_hut": 15.0}
        ]
    })
    assert waste_res.status_code == 200

    # 4. Update materials
    mat_res = client.patch(f"/api/warehouse/production-sessions/{session_id}/materials", json={
        "materials": [
            {"other_material_id": om.id, "so_luong": 50.0}
        ]
    })
    assert mat_res.status_code == 200

    # Verify updates in details
    detail_res = client.get(f"/api/warehouse/production-sessions/{session_id}")
    detail = detail_res.json()
    assert len(detail["paper_wastes"]) == 2
    assert len(detail["materials"]) == 1
    assert detail["materials"][0]["other_material_id"] == om.id
    assert detail["materials"][0]["so_luong"] == 50.0
    assert detail["materials"][0]["don_gia"] == 10000.0
    assert detail["materials"][0]["thanh_tien"] == 500000.0

def test_auto_detect_session_on_can_roll(client, db_session):
    pn, px, wh, pm1, pm2, om, r1, r2 = _setup_entities(db_session)
    # Create active session
    session = ProductionSession(ten_phien="Active Phien", trang_thai="dang_chay", phan_xuong_id=px.id)
    db_session.add(session)
    db_session.commit()

    # Can roll
    res = client.patch(f"/api/warehouse/giay-rolls/{r1.id}/can", json={
        "kg_con_lai": 450.0
    })
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["trang_thai"] == "dang_dung"
    assert data["trong_luong_con_lai"] == 450.0
    assert data["session_id"] == session.id

    # Verify session roll is created
    s_roll = db_session.query(ProductionSessionRoll).filter_by(session_id=session.id, giay_roll_id=r1.id).first()
    assert s_roll is not None
    assert s_roll.trong_luong_dau == Decimal("500")
    assert s_roll.trong_luong_cuoi == Decimal("450")
    assert s_roll.trong_luong_tieu_hao == Decimal("50")

def test_compute_allocation_algorithm(client, db_session):
    pn, px, wh, pm1, pm2, om, r1, r2 = _setup_entities(db_session)
    
    # 1. Create Session
    session = ProductionSession(ten_phien="Phien Alloc Alg", trang_thai="dang_chay", phan_xuong_id=px.id)
    db_session.add(session)
    db_session.flush()

    # 2. Add rolls consumed: PM1 consumes 100kg, PM2 consumes 200kg
    sr1 = ProductionSessionRoll(session_id=session.id, giay_roll_id=r1.id, trong_luong_dau=Decimal("500"), trong_luong_cuoi=Decimal("400"), trong_luong_tieu_hao=Decimal("100"))
    sr2 = ProductionSessionRoll(session_id=session.id, giay_roll_id=r2.id, trong_luong_dau=Decimal("500"), trong_luong_cuoi=Decimal("300"), trong_luong_tieu_hao=Decimal("200"))
    
    # 3. Add paper wastes: 10kg B and 20kg C (total 30kg waste)
    w1 = ProductionSessionPaperWaste(session_id=session.id, flute_type="B", so_kg_hao_hut=Decimal("10"))
    w2 = ProductionSessionPaperWaste(session_id=session.id, flute_type="C", so_kg_hao_hut=Decimal("20"))
    
    # 4. Add other materials: 50kg Glue @ 10000 = 500,000 VND
    sm = ProductionSessionMaterial(session_id=session.id, other_material_id=om.id, so_luong=Decimal("50"), don_gia=Decimal("10000"), thanh_tien=Decimal("500000"))
    
    db_session.add_all([sr1, sr2, w1, w2, sm])
    db_session.flush()

    # 5. Create ProductionOrder & items representing 3, 5, 7 layers
    porder = ProductionOrder(so_lenh="LSX-ALLOC", ngay_lenh=date.today(), phan_xuong_id=px.id, phap_nhan_id=pn.id)
    db_session.add(porder)
    db_session.flush()

    # Item 1: 3-layer. Area = 100 * (100 * 100 / 10000) = 100 m2. Coefficient = 1.0. Area QD = 100 m2.
    poi1 = ProductionOrderItem(production_order_id=porder.id, ten_hang="Thung 3L", so_lop=3, so_luong_ke_hoach=100, dvt="Thung")
    # Item 2: 5-layer. Area = 200 * (100 * 100 / 10000) = 200 m2. Coefficient = 2.0. Area QD = 400 m2.
    poi2 = ProductionOrderItem(production_order_id=porder.id, ten_hang="Thung 5L", so_lop=5, so_luong_ke_hoach=200, dvt="Thung")
    # Item 3: 7-layer. Area = 100 * (100 * 100 / 10000) = 100 m2. Coefficient = 3.0. Area QD = 300 m2.
    poi3 = ProductionOrderItem(production_order_id=porder.id, ten_hang="Thung 7L", so_lop=7, so_luong_ke_hoach=100, dvt="Thung")

    db_session.add_all([poi1, poi2, poi3])
    db_session.flush()

    # 6. Create PhieuNhapPhoiSong and assign items with dimensions
    phieu = PhieuNhapPhoiSong(so_phieu="PNS-ALLOC", ngay=date.today(), production_order_id=porder.id, session_id=session.id)
    db_session.add(phieu)
    db_session.flush()

    pi1 = PhieuNhapPhoiSongItem(phieu_id=phieu.id, production_order_item_id=poi1.id, so_luong_ke_hoach=Decimal("100"), so_luong_thuc_te=Decimal("100"), chieu_kho=Decimal("100"), chieu_cat=Decimal("100"))
    pi2 = PhieuNhapPhoiSongItem(phieu_id=phieu.id, production_order_item_id=poi2.id, so_luong_ke_hoach=Decimal("200"), so_luong_thuc_te=Decimal("200"), chieu_kho=Decimal("100"), chieu_cat=Decimal("100"))
    pi3 = PhieuNhapPhoiSongItem(phieu_id=phieu.id, production_order_item_id=poi3.id, so_luong_ke_hoach=Decimal("100"), so_luong_thuc_te=Decimal("100"), chieu_kho=Decimal("100"), chieu_cat=Decimal("100"))

    db_session.add_all([pi1, pi2, pi3])
    db_session.commit()

    # 7. Call preview allocate API
    res = client.get(f"/api/warehouse/production-sessions/{session.id}/preview-allocate")
    assert res.status_code == 200, res.text
    data = res.json()

    # Total paper consumption (excludes waste in the raw total) = 100 + 200 = 300 kg
    assert data["total_tieu_hao_giay_kg"] == 300.0
    assert data["total_hao_hut_kg"] == 30.0

    # PM1 allocated waste = 30 * (100/300) = 10kg -> total PM1 = 110kg. Cost = 110 * 15000 = 1,650,000
    # PM2 allocated waste = 30 * (200/300) = 20kg -> total PM2 = 220kg. Cost = 220 * 20000 = 4,400,000
    # Total paper cost = 1,650,000 + 4,400,000 = 6,050,000 VND
    assert data["total_chi_phi_giay"] == 6050000.0
    assert data["total_chi_phi_nvl_phu"] == 500000.0
    assert data["total_chi_phi_phien"] == 6550000.0

    # Total area = 100 + 200 + 100 = 400 m2.
    # Total area qd = 100*1 + 200*2 + 100*3 = 800 m2.
    # Check paper cost allocation:
    # Item 1 (100 m2): 6,050,000 * 100 / 400 = 1,512,500.0
    # Item 2 (200 m2): 6,050,000 * 200 / 400 = 3,025,000.0
    # Item 3 (100 m2): 6,050,000 * 100 / 400 = 1,512,500.0
    alloc_items = {it["production_order_item_id"]: it for it in data["allocation_by_lsx"]}
    assert alloc_items[poi1.id]["chi_phi_giay"] == 1512500.0
    assert alloc_items[poi2.id]["chi_phi_giay"] == 3025000.0
    assert alloc_items[poi3.id]["chi_phi_giay"] == 1512500.0

    # Check glue (other material) cost allocation by area qd:
    # Item 1 (100 m2 qd): 500,000 * 100 / 800 = 62,500.0
    # Item 2 (400 m2 qd): 500,000 * 400 / 800 = 250,000.0
    # Item 3 (300 m2 qd): 500,000 * 300 / 800 = 187,500.0
    assert alloc_items[poi1.id]["chi_phi_nvl_phu"] == 62500.0
    assert alloc_items[poi2.id]["chi_phi_nvl_phu"] == 250000.0
    assert alloc_items[poi3.id]["chi_phi_nvl_phu"] == 187500.0

    # 8. Close session
    close_res = client.post(f"/api/warehouse/production-sessions/{session.id}/close")
    assert close_res.status_code == 200, close_res.text
    assert close_res.json()["ok"] is True

    # Check status transitioned to da_chot
    db_session.refresh(session)
    assert session.trang_thai == "da_chot"
