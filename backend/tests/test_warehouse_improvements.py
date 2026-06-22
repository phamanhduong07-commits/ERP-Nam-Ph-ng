"""Tests for warehouse improvements (draft isolation, security gating, and GR reversal)."""

import pytest
from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.models.accounting import JournalEntry
from app.models.inventory import InventoryBalance
from app.models.master import Supplier, PhanXuong, PhapNhan, Warehouse, PaperMaterial
from app.models.purchase import PurchaseOrder, PurchaseOrderItem
from app.models.warehouse_doc import (
    MaterialIssue, MaterialIssueItem,
    PhieuChuyenKho, PhieuChuyenKhoItem,
    StockAdjustment, StockAdjustmentItem,
    GoodsReceipt, GoodsReceiptItem,
    GiayRoll,
)
from app.models.production import ProductionOrder


# ─── fixtures & helpers ────────────────────────────────────────────────────────

@pytest.fixture
def make_client_for_role(db_session):
    from app.main import app
    from app.database import get_db
    from app.deps import get_current_user

    def _factory(role_name: str):
        _role = SimpleNamespace(ma_vai_tro=role_name)
        _user = SimpleNamespace(id=1, username="testuser", trang_thai=True, role=_role)

        def override_db():
            yield db_session

        def override_user():
            return _user

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_user] = override_user
        return TestClient(app, raise_server_exceptions=True)

    yield _factory
    app.dependency_overrides.clear()


def _make_warehouse(db, *, ma_pn="PN_TEST", ma_px="PX_TEST", ma_kho="KH_TEST", loai_kho="NVL_PHU"):
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


def _make_paper_material(db, *, ma_chinh="GIAY_TEST") -> PaperMaterial:
    from app.models.master import MaterialGroup
    g = MaterialGroup(ma_nhom=f"G_{ma_chinh}", ten_nhom="Nhom test", la_nhom_giay=True)
    db.add(g)
    db.flush()
    m = PaperMaterial(ma_chinh=ma_chinh, ma_nhom_id=g.id, ten=f"Giay {ma_chinh}", dvt="Kg", su_dung=True)
    db.add(m)
    db.flush()
    return m


def _make_production_order(db, phan_xuong_id, phap_nhan_id, *, so_lenh="LSX-TEST-001") -> ProductionOrder:
    po = ProductionOrder(
        so_lenh=so_lenh,
        ngay_lenh=date.today(),
        phan_xuong_id=phan_xuong_id,
        phap_nhan_id=phap_nhan_id,
    )
    db.add(po)
    db.flush()
    return po


# ─── 1. MaterialIssue Tests ───────────────────────────────────────────────────

def test_material_issue_security_gating(make_client_for_role, db_session):
    pn, px, wh = _make_warehouse(db_session, ma_pn="PN_MI1", ma_px="PX_MI1", ma_kho="KH_MI1")
    mat = _make_paper_material(db_session, ma_chinh="MAT_MI1")
    porder = _make_production_order(db_session, px.id, pn.id, so_lenh="LSX-MI1")
    db_session.commit()

    # Worker KHO_NHAN_VIEN can create MaterialIssue
    client_worker = make_client_for_role("KHO_NHAN_VIEN")
    res = client_worker.post("/api/warehouse/material-issues", json={
        "ngay_xuat": date.today().isoformat(),
        "production_order_id": porder.id,
        "warehouse_id": wh.id,
        "items": [{
            "paper_material_id": mat.id,
            "ten_hang": mat.ten,
            "so_luong_ke_hoach": 10,
            "so_luong_thuc_xuat": 10,
            "dvt": "Kg",
            "don_gia": 5000,
        }]
    })
    assert res.status_code == 201, res.text

    # Unauthorized role (e.g. KINH_DOANH) gets 403
    client_sales = make_client_for_role("KINH_DOANH")
    res = client_sales.post("/api/warehouse/material-issues", json={
        "ngay_xuat": date.today().isoformat(),
        "production_order_id": porder.id,
        "warehouse_id": wh.id,
        "items": []
    })
    assert res.status_code == 403


def test_material_issue_draft_isolation_and_flow(make_client_for_role, db_session):
    pn, px, wh = _make_warehouse(db_session, ma_pn="PN_MI2", ma_px="PX_MI2", ma_kho="KH_MI2")
    mat = _make_paper_material(db_session, ma_chinh="MAT_MI2")
    porder = _make_production_order(db_session, px.id, pn.id, so_lenh="LSX-MI2")

    # Seed initial inventory balance
    bal = InventoryBalance(
        warehouse_id=wh.id,
        paper_material_id=mat.id,
        ten_hang=mat.ten,
        don_vi="Kg",
        ton_luong=Decimal("50"),
        don_gia_binh_quan=Decimal("5000"),
        gia_tri_ton=Decimal("250000"),
    )
    db_session.add(bal)
    db_session.commit()

    client_worker = make_client_for_role("KHO_NHAN_VIEN")
    client_manager = make_client_for_role("KHO_TO_TRUONG")

    # A. Create Draft MaterialIssue
    res = client_worker.post("/api/warehouse/material-issues", json={
        "ngay_xuat": date.today().isoformat(),
        "production_order_id": porder.id,
        "warehouse_id": wh.id,
        "items": [{
            "paper_material_id": mat.id,
            "ten_hang": mat.ten,
            "so_luong_ke_hoach": 10,
            "so_luong_thuc_xuat": 10,
            "dvt": "Kg",
            "don_gia": 5000,
        }]
    })
    assert res.status_code == 201
    mi_id = res.json()["id"]

    # Verify status is "nhap", inventory is untouched, no journal entry
    db_session.refresh(bal)
    assert bal.ton_luong == Decimal("50")  # untouched
    
    mi = db_session.get(MaterialIssue, mi_id)
    assert mi.trang_thai == "nhap"
    
    je = db_session.query(JournalEntry).filter(
        JournalEntry.chung_tu_loai == "material_issues",
        JournalEntry.chung_tu_id == mi_id,
    ).first()
    assert je is None

    # B. Approve MaterialIssue
    approve_res = client_manager.patch(f"/api/warehouse/material-issues/{mi_id}/approve")
    assert approve_res.status_code == 200, approve_res.text
    assert approve_res.json()["trang_thai"] == "da_xuat"

    # Verify inventory is deducted, journal entry is posted
    db_session.refresh(bal)
    assert bal.ton_luong == Decimal("40")  # 50 - 10

    je = db_session.query(JournalEntry).filter(
        JournalEntry.chung_tu_loai == "material_issues",
        JournalEntry.chung_tu_id == mi_id,
    ).one()
    assert je.tong_no == Decimal("50000")  # 10 * 5000

    # C. Cancel Approved MaterialIssue
    cancel_res = client_manager.post(f"/api/warehouse/material-issues/{mi_id}/cancel")
    assert cancel_res.status_code == 200, cancel_res.text
    assert cancel_res.json()["trang_thai"] == "huy"

    # Verify inventory is restored, journal entries are reversed
    db_session.refresh(bal)
    assert bal.ton_luong == Decimal("50")  # restored

    reversed_je = db_session.query(JournalEntry).filter(
        JournalEntry.chung_tu_loai == "material_issues",
        JournalEntry.chung_tu_id == mi_id,
        JournalEntry.loai_but_toan == "dao_nguoc",
    ).first()
    assert reversed_je is not None
    assert reversed_je.tong_no == Decimal("50000")


def test_material_issue_delete_rules(make_client_for_role, db_session):
    pn, px, wh = _make_warehouse(db_session, ma_pn="PN_MI3", ma_px="PX_MI3", ma_kho="KH_MI3")
    mat = _make_paper_material(db_session, ma_chinh="MAT_MI3")
    porder = _make_production_order(db_session, px.id, pn.id, so_lenh="LSX-MI3")
    
    # Seed initial inventory balance
    bal = InventoryBalance(
        warehouse_id=wh.id,
        paper_material_id=mat.id,
        ten_hang=mat.ten,
        don_vi="Kg",
        ton_luong=Decimal("50"),
        don_gia_binh_quan=Decimal("5000"),
        gia_tri_ton=Decimal("250000"),
    )
    db_session.add(bal)
    db_session.commit()

    client_manager = make_client_for_role("KHO_TO_TRUONG")

    # Create Draft 1
    res1 = client_manager.post("/api/warehouse/material-issues", json={
        "ngay_xuat": date.today().isoformat(),
        "production_order_id": porder.id,
        "warehouse_id": wh.id,
        "items": [{
            "paper_material_id": mat.id,
            "ten_hang": mat.ten,
            "so_luong_ke_hoach": 10,
            "so_luong_thuc_xuat": 10,
            "dvt": "Kg",
            "don_gia": 5000,
        }]
    })
    mi_id1 = res1.json()["id"]

    # Delete Draft 1 -> Success
    del_res = client_manager.delete(f"/api/warehouse/material-issues/{mi_id1}")
    assert del_res.status_code == 200
    assert db_session.get(MaterialIssue, mi_id1) is None

    # Create Draft 2 and approve
    res2 = client_manager.post("/api/warehouse/material-issues", json={
        "ngay_xuat": date.today().isoformat(),
        "production_order_id": porder.id,
        "warehouse_id": wh.id,
        "items": [{
            "paper_material_id": mat.id,
            "ten_hang": mat.ten,
            "so_luong_ke_hoach": 10,
            "so_luong_thuc_xuat": 10,
            "dvt": "Kg",
            "don_gia": 5000,
        }]
    })
    mi_id2 = res2.json()["id"]
    client_manager.patch(f"/api/warehouse/material-issues/{mi_id2}/approve")

    # Delete Approved -> Blocked (400)
    del_res = client_manager.delete(f"/api/warehouse/material-issues/{mi_id2}")
    assert del_res.status_code == 400


# ─── 2. PhieuChuyenKho (Stock Transfer) Tests ──────────────────────────────────

def test_stock_transfer_flow(make_client_for_role, db_session):
    pn, px, wh_src = _make_warehouse(db_session, ma_pn="PN_CK", ma_px="PX_CK", ma_kho="KH_SRC")
    wh_dst = Warehouse(ma_kho="KH_DST", ten_kho="Kho Den", loai_kho="NVL_PHU", phan_xuong_id=px.id, trang_thai=True)
    db_session.add(wh_dst)
    mat = _make_paper_material(db_session, ma_chinh="MAT_CK")

    # Seed source balance
    bal_src = InventoryBalance(
        warehouse_id=wh_src.id,
        paper_material_id=mat.id,
        ten_hang=mat.ten,
        don_vi="Kg",
        ton_luong=Decimal("30"),
        don_gia_binh_quan=Decimal("5000"),
        gia_tri_ton=Decimal("150000"),
    )
    db_session.add(bal_src)
    db_session.commit()

    client = make_client_for_role("ADMIN")

    # A. Create Draft transfer
    res = client.post("/api/warehouse/phieu-chuyen", json={
        "warehouse_xuat_id": wh_src.id,
        "warehouse_nhap_id": wh_dst.id,
        "ngay": date.today().isoformat(),
        "items": [{
            "paper_material_id": mat.id,
            "ten_hang": mat.ten,
            "so_luong": 10,
            "don_gia": 5000,
            "dvt": "Kg",
        }]
    })
    assert res.status_code == 201, res.text
    ck_id = res.json()["id"]

    # Verify status is "nhap", no balance moves
    db_session.refresh(bal_src)
    assert bal_src.ton_luong == Decimal("30")

    # B. Approve transfer
    app_res = client.patch(f"/api/warehouse/phieu-chuyen/{ck_id}/approve")
    assert app_res.status_code == 200, app_res.text

    # Verify balances
    db_session.refresh(bal_src)
    assert bal_src.ton_luong == Decimal("20")

    bal_dst = db_session.query(InventoryBalance).filter_by(warehouse_id=wh_dst.id, paper_material_id=mat.id).one()
    assert bal_dst.ton_luong == Decimal("10")

    # C. Cancel transfer
    cancel_res = client.post(f"/api/warehouse/phieu-chuyen/{ck_id}/cancel")
    assert cancel_res.status_code == 200

    db_session.refresh(bal_src)
    db_session.refresh(bal_dst)
    assert bal_src.ton_luong == Decimal("30")
    assert bal_dst.ton_luong == Decimal("0")


# ─── 3. StockAdjustment (Kiểm kê) Tests ────────────────────────────────────────

def test_stock_adjustment_flow(make_client_for_role, db_session):
    pn, px, wh = _make_warehouse(db_session, ma_pn="PN_KK", ma_px="PX_KK", ma_kho="KH_KK")
    mat = _make_paper_material(db_session, ma_chinh="MAT_KK")

    # Seed balance
    bal = InventoryBalance(
        warehouse_id=wh.id,
        paper_material_id=mat.id,
        ten_hang=mat.ten,
        don_vi="Kg",
        ton_luong=Decimal("20"),
        don_gia_binh_quan=Decimal("1000"),
        gia_tri_ton=Decimal("20000"),
    )
    db_session.add(bal)
    db_session.commit()

    client = make_client_for_role("KHO_TO_TRUONG")

    # A. Create Draft adjustment
    res = client.post("/api/warehouse/stock-adjustments", json={
        "warehouse_id": wh.id,
        "ngay": date.today().isoformat(),
        "ly_do": "Kiểm kê",
        "items": [{
            "inventory_balance_id": bal.id,
            "so_luong_thuc_te": 25,
        }]
    })
    assert res.status_code == 201
    adj_id = res.json()["id"]

    # Verify status is "nhap", no balance change
    db_session.refresh(bal)
    assert bal.ton_luong == Decimal("20")

    # B. Confirm adjustment
    conf_res = client.post(f"/api/warehouse/stock-adjustments/{adj_id}/confirm")
    assert conf_res.status_code == 200, conf_res.text

    # Verify balance is updated to 25
    db_session.refresh(bal)
    assert bal.ton_luong == Decimal("25")

    # C. Cancel adjustment
    cancel_res = client.post(f"/api/warehouse/stock-adjustments/{adj_id}/cancel")
    assert cancel_res.status_code == 200

    # Verify balance restored back to 20
    db_session.refresh(bal)
    assert bal.ton_luong == Decimal("20")


# ─── 4. GoodsReceipt Cancel & Reversal Tests ────────────────────────────────────

def test_goods_receipt_cancel_blocks_on_used_rolls(make_client_for_role, db_session):
    pn, px, wh = _make_warehouse(db_session, ma_pn="PN_GR", ma_px="PX_GR", ma_kho="KH_GR", loai_kho="GIAY_CUON")
    sup = Supplier(ma_ncc="NCC_GR", ten_viet_tat="NCC GR")
    db_session.add(sup)
    db_session.commit()

    client_acct = make_client_for_role("KE_TOAN_TRUONG")

    # Create & Approve GR
    gr = GoodsReceipt(
        so_phieu="GR-001",
        ngay_nhap=date.today(),
        supplier_id=sup.id,
        warehouse_id=wh.id,
        trang_thai="da_duyet",
        tong_gia_tri=Decimal("100000"),
    )
    db_session.add(gr)
    db_session.flush()

    item = GoodsReceiptItem(
        receipt_id=gr.id,
        ten_hang="Giay test",
        so_luong=Decimal("10"),
        dvt="Kg",
        don_gia=Decimal("10000"),
        thanh_tien=Decimal("100000"),
    )
    db_session.add(item)
    db_session.flush()

    # Generate a roll from this GR
    roll = GiayRoll(
        barcode="ROLL-001",
        goods_receipt_id=gr.id,
        goods_receipt_item_id=item.id,
        trong_luong_ban_dau=10.0,
        trong_luong_con_lai=10.0,
        trang_thai="dang_dung",  # Used in production!
    )
    db_session.add(roll)

    # Seed balance
    bal = InventoryBalance(
        warehouse_id=wh.id,
        ten_hang="Giay test",
        don_vi="Kg",
        ton_luong=Decimal("20"),
    )
    db_session.add(bal)
    db_session.commit()

    # Try to cancel -> Should fail (400) because roll is "dang_dung"
    cancel_res = client_acct.post(f"/api/warehouse/goods-receipts/{gr.id}/cancel")
    assert cancel_res.status_code == 400
    assert "đã/đang được sử dụng" in cancel_res.json()["detail"]


def test_goods_receipt_cancel_success(make_client_for_role, db_session):
    pn, px, wh = _make_warehouse(db_session, ma_pn="PN_GR2", ma_px="PX_GR2", ma_kho="KH_GR2", loai_kho="GIAY_CUON")
    sup = Supplier(ma_ncc="NCC_GR2", ten_viet_tat="NCC GR 2")
    db_session.add(sup)
    db_session.flush()

    po = PurchaseOrder(
        so_po="PO-001",
        ngay_po=date.today(),
        supplier_id=sup.id,
        trang_thai="da_duyet",
    )
    db_session.add(po)
    db_session.flush()

    poi = PurchaseOrderItem(
        po_id=po.id,
        ten_hang="Giay cuon test",
        so_luong=Decimal("10"),
        dvt="Kg",
        don_gia=Decimal("10000"),
        thanh_tien=Decimal("100000"),
        so_luong_da_nhan=Decimal("10"),  # Fully received
    )
    db_session.add(poi)
    db_session.flush()

    client_acct = make_client_for_role("KE_TOAN_TRUONG")

    # Create & Approve GR
    gr = GoodsReceipt(
        so_phieu="GR-002",
        ngay_nhap=date.today(),
        po_id=po.id,
        supplier_id=sup.id,
        warehouse_id=wh.id,
        trang_thai="da_duyet",
        tong_gia_tri=Decimal("100000"),
    )
    db_session.add(gr)
    db_session.flush()

    item = GoodsReceiptItem(
        receipt_id=gr.id,
        po_item_id=poi.id,
        ten_hang="Giay cuon test",
        so_luong=Decimal("10"),
        dvt="Kg",
        don_gia=Decimal("10000"),
        thanh_tien=Decimal("100000"),
    )
    db_session.add(item)
    db_session.flush()

    # Generate a roll from this GR (clean / unused)
    roll = GiayRoll(
        barcode="ROLL-002",
        goods_receipt_id=gr.id,
        goods_receipt_item_id=item.id,
        trong_luong_ban_dau=10.0,
        trong_luong_con_lai=10.0,
        trang_thai="trong_kho",
    )
    db_session.add(roll)

    # Seed balance
    bal = InventoryBalance(
        warehouse_id=wh.id,
        ten_hang="Giay cuon test",
        don_vi="Kg",
        ton_luong=Decimal("20"),
    )
    db_session.add(bal)
    db_session.commit()

    # Cancel GR -> Success
    cancel_res = client_acct.post(f"/api/warehouse/goods-receipts/{gr.id}/cancel")
    assert cancel_res.status_code == 200, cancel_res.text
    assert cancel_res.json()["trang_thai"] == "huy"

    # Verify inventory is decremented
    db_session.refresh(bal)
    assert bal.ton_luong == Decimal("10")  # 20 - 10

    # Verify PO quantity is decremented
    db_session.refresh(poi)
    assert poi.so_luong_da_nhan == Decimal("0")

    # Verify roll is canceled
    db_session.refresh(roll)
    assert roll.trang_thai == "da_huy"
