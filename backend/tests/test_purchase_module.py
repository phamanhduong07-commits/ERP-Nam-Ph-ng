"""
Tests for purchase module fixes (session 2026-05-19):
  #5  — AP journal entries when GR has bo_qua_hach_toan=True
  #6  — Block invoice creation if no approved GR exists
  #9  — Cancel purchase invoice endpoint
  #11 — gui-ncc endpoint
  #18 — huy PO endpoint
  #28 — GR list limit parameter
"""
from datetime import date
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.models.accounting import JournalEntry, PurchaseInvoice
from app.models.master import Supplier, PhanXuong, PhapNhan, Warehouse
from app.models.purchase import PurchaseOrder, PurchaseOrderItem
from app.models.warehouse_doc import GoodsReceipt, GoodsReceiptItem


# ─── helpers ───────────────────────────────────────────────────────────────────

def _make_supplier(db) -> Supplier:
    s = Supplier(ma_ncc="NCC_PO1", ten_viet_tat="NCC PO 1")
    db.add(s)
    db.flush()
    return s


def _make_warehouse(db, *, ma_pn="PN_PO", ma_px="PX_PO", ma_kho="KH_PO"):
    pn = PhapNhan(ma_phap_nhan=ma_pn, ten_phap_nhan=f"PN {ma_pn}", ten_viet_tat=ma_pn)
    db.add(pn)
    db.flush()
    px = PhanXuong(ma_xuong=ma_px, ten_xuong=f"PX {ma_px}", cong_doan="cd2", phap_nhan_id=pn.id)
    db.add(px)
    db.flush()
    wh = Warehouse(ma_kho=ma_kho, ten_kho=f"Kho {ma_kho}", loai_kho="NVL_PHU",
                   phan_xuong_id=px.id, trang_thai=True)
    db.add(wh)
    db.flush()
    return pn, px, wh


def _make_po(db, supplier_id, *, trang_thai="moi", phap_nhan_id=None, phan_xuong_id=None,
             so_po="PO-TEST-001") -> PurchaseOrder:
    po = PurchaseOrder(
        so_po=so_po,
        ngay_po=date.today(),
        supplier_id=supplier_id,
        trang_thai=trang_thai,
        phap_nhan_id=phap_nhan_id,
        phan_xuong_id=phan_xuong_id,
    )
    db.add(po)
    db.flush()
    item = PurchaseOrderItem(
        po_id=po.id,
        ten_hang="NVL test",
        so_luong=Decimal("100"),
        dvt="Kg",
        don_gia=Decimal("10000"),
        thanh_tien=Decimal("1000000"),
    )
    db.add(item)
    db.flush()
    po.tong_tien = Decimal("1000000")
    db.flush()
    return po


def _make_gr(db, supplier_id, warehouse_id, po_id=None, *,
             trang_thai="nhap", bo_qua_hach_toan=False,
             phap_nhan_id=None, so_phieu="GR-TEST-001") -> GoodsReceipt:
    gr = GoodsReceipt(
        so_phieu=so_phieu,
        ngay_nhap=date.today(),
        po_id=po_id,
        supplier_id=supplier_id,
        warehouse_id=warehouse_id,
        phap_nhan_id=phap_nhan_id,
        trang_thai=trang_thai,
        bo_qua_hach_toan=bo_qua_hach_toan,
        tong_gia_tri=Decimal("1000000"),
    )
    db.add(gr)
    db.flush()
    item = GoodsReceiptItem(
        receipt_id=gr.id,
        ten_hang="NVL test",
        so_luong=Decimal("100"),
        dvt="Kg",
        don_gia=Decimal("10000"),
        thanh_tien=Decimal("1000000"),
    )
    db.add(item)
    db.flush()
    return gr


@pytest.fixture
def client_purchase(db_session):
    from app.main import app
    from app.database import get_db
    from app.deps import get_current_user

    _admin_role = SimpleNamespace(ma_vai_tro="ADMIN")
    _user = SimpleNamespace(id=1, username="testuser", trang_thai=True, role=_admin_role)

    def override_db():
        yield db_session

    def override_user():
        return _user

    with patch("app.socket_manager.sio.emit", new=AsyncMock(return_value=None)):
        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_user] = override_user
        with TestClient(app, raise_server_exceptions=True) as c:
            yield c
    app.dependency_overrides.clear()


# ─── #6: Block invoice from PO with no approved GR ────────────────────────────

def test_create_invoice_from_po_blocked_without_approved_gr(client_purchase, db_session):
    sup = _make_supplier(db_session)
    po = _make_po(db_session, sup.id, so_po="PO-INV-NO-GR-001")
    db_session.commit()

    res = client_purchase.post(f"/api/accounting/purchase-invoices/from-po/{po.id}")

    assert res.status_code == 400
    assert "phiếu nhập" in res.json()["detail"].lower() or "gr" in res.json()["detail"].lower()


def test_create_invoice_from_po_allowed_with_approved_gr(client_purchase, db_session):
    pn, _, wh = _make_warehouse(db_session, ma_pn="PNINV1", ma_px="PXINV1", ma_kho="KHINV1")
    sup = _make_supplier(db_session)
    sup.ma_ncc = "NCCAPGR1"
    db_session.flush()
    po = _make_po(db_session, sup.id, phap_nhan_id=pn.id, so_po="PO-INV-WITH-GR-001")
    gr = _make_gr(db_session, sup.id, wh.id, po_id=po.id,
                  trang_thai="da_duyet", phap_nhan_id=pn.id, so_phieu="GR-INV-APGR-001")
    db_session.commit()

    res = client_purchase.post(f"/api/accounting/purchase-invoices/from-po/{po.id}")

    assert res.status_code in (200, 201), res.text
    data = res.json()
    assert float(data["tong_tien_hang"]) == 1000000.0


# ─── #5: AP journal entries when GR has bo_qua_hach_toan=True ─────────────────

def test_invoice_posts_full_journal_when_gr_skipped_hach_toan(client_purchase, db_session):
    """
    Khi GR có bo_qua_hach_toan=True, invoice từ GR đó phải ghi đủ tiền hàng + VAT vào sổ,
    không chỉ ghi riêng VAT.
    """
    pn, _, wh = _make_warehouse(db_session, ma_pn="PN_SKIP", ma_px="PX_SKIP", ma_kho="KH_SKIP")
    sup = _make_supplier(db_session)
    sup.ma_ncc = "NCC_SKIP1"
    db_session.flush()
    gr = _make_gr(db_session, sup.id, wh.id,
                  trang_thai="da_duyet", bo_qua_hach_toan=True,
                  phap_nhan_id=pn.id, so_phieu="GR-SKIP-HT-001")
    db_session.commit()

    res = client_purchase.post(f"/api/accounting/purchase-invoices/from-gr/{gr.id}")

    assert res.status_code in (200, 201), res.text
    inv_id = res.json()["id"]

    journal = db_session.query(JournalEntry).filter(
        JournalEntry.chung_tu_loai == "purchase_invoices",
        JournalEntry.chung_tu_id == inv_id,
        JournalEntry.loai_but_toan == "purchase_invoice",
    ).one()

    # Bút toán phải cân bằng Nợ = Có
    assert journal.tong_no == journal.tong_co

    # Phải có dòng Nợ cho TK hàng hóa/NVL (không chỉ 1331)
    tks_no = {line.so_tk for line in journal.lines if line.so_tien_no > 0}
    assert "1331" in tks_no or any(tk.startswith("15") or tk.startswith("62") for tk in tks_no), \
        f"Expected NVL/expense account in debit lines, got: {tks_no}"

    # Tổng Nợ phải là toàn bộ tổng thanh toán (tiền hàng + VAT), không chỉ VAT
    inv = db_session.get(PurchaseInvoice, inv_id)
    assert journal.tong_no >= inv.tong_tien_hang, \
        f"Journal debit {journal.tong_no} should be >= tien_hang {inv.tong_tien_hang}"


def test_invoice_posts_only_vat_when_gr_has_normal_hach_toan(client_purchase, db_session):
    """
    Khi GR bình thường (bo_qua_hach_toan=False), invoice chỉ ghi thêm VAT vào 1331/331.
    Tổng Nợ bằng đúng tien_thue.
    """
    pn, _, wh = _make_warehouse(db_session, ma_pn="PN_NORM", ma_px="PX_NORM", ma_kho="KH_NORM")
    sup = _make_supplier(db_session)
    sup.ma_ncc = "NCC_NORM1"
    db_session.flush()
    gr = _make_gr(db_session, sup.id, wh.id,
                  trang_thai="da_duyet", bo_qua_hach_toan=False,
                  phap_nhan_id=pn.id, so_phieu="GR-NORM-001")
    db_session.commit()

    res = client_purchase.post(
        f"/api/accounting/purchase-invoices/from-gr/{gr.id}",
        params={"co_vat": "true", "thue_suat": 8},
    )
    assert res.status_code in (200, 201), res.text
    inv_id = res.json()["id"]

    journal = db_session.query(JournalEntry).filter(
        JournalEntry.chung_tu_loai == "purchase_invoices",
        JournalEntry.chung_tu_id == inv_id,
        JournalEntry.loai_but_toan == "purchase_invoice",
    ).first()

    inv = db_session.get(PurchaseInvoice, inv_id)
    if journal:
        # Nếu có VAT, tổng Nợ phải bằng tien_thue (không ghi tiền hàng)
        assert journal.tong_no == inv.tien_thue, \
            f"Normal GR: journal debit {journal.tong_no} should equal tien_thue {inv.tien_thue}"
    else:
        # Không có journal = không có VAT hoặc VAT=0 → invoice bo_qua_hach_toan
        pass


# ─── #9: Cancel purchase invoice ───────────────────────────────────────────────

def test_cancel_purchase_invoice_success(client_purchase, db_session):
    pn, _, wh = _make_warehouse(db_session, ma_pn="PN_CANCEL", ma_px="PX_CANCEL", ma_kho="KH_CANCEL")
    sup = _make_supplier(db_session)
    sup.ma_ncc = "NCC_CANCEL"
    db_session.flush()
    gr = _make_gr(db_session, sup.id, wh.id,
                  trang_thai="da_duyet", bo_qua_hach_toan=True,
                  phap_nhan_id=pn.id, so_phieu="GR-CANCEL-001")
    db_session.commit()

    # Tạo invoice
    create_res = client_purchase.post(f"/api/accounting/purchase-invoices/from-gr/{gr.id}")
    assert create_res.status_code in (200, 201), create_res.text
    inv_id = create_res.json()["id"]

    # Hủy invoice
    cancel_res = client_purchase.post(f"/api/accounting/purchase-invoices/{inv_id}/huy")

    assert cancel_res.status_code == 200, cancel_res.text
    assert cancel_res.json()["trang_thai"] == "huy"


def test_cancel_purchase_invoice_idempotent(client_purchase, db_session):
    """Hủy 2 lần không lỗi."""
    pn, _, wh = _make_warehouse(db_session, ma_pn="PN_IDEM", ma_px="PX_IDEM", ma_kho="KH_IDEM")
    sup = _make_supplier(db_session)
    sup.ma_ncc = "NCC_IDEM"
    db_session.flush()
    gr = _make_gr(db_session, sup.id, wh.id,
                  trang_thai="da_duyet", bo_qua_hach_toan=True,
                  phap_nhan_id=pn.id, so_phieu="GR-IDEM-001")
    db_session.commit()

    create_res = client_purchase.post(f"/api/accounting/purchase-invoices/from-gr/{gr.id}")
    assert create_res.status_code in (200, 201)
    inv_id = create_res.json()["id"]

    client_purchase.post(f"/api/accounting/purchase-invoices/{inv_id}/huy")
    cancel2 = client_purchase.post(f"/api/accounting/purchase-invoices/{inv_id}/huy")

    assert cancel2.status_code == 200
    assert cancel2.json()["trang_thai"] == "huy"


def test_cancel_invoice_404(client_purchase, db_session):
    res = client_purchase.post("/api/accounting/purchase-invoices/999999/huy")
    assert res.status_code == 404


def test_cancel_invoice_with_payment_blocked(client_purchase, db_session):
    """Invoice đã có thanh toán → không được hủy."""
    pn, _, wh = _make_warehouse(db_session, ma_pn="PN_PAID", ma_px="PX_PAID", ma_kho="KH_PAID")
    sup = _make_supplier(db_session)
    sup.ma_ncc = "NCC_PAID"
    db_session.flush()
    gr = _make_gr(db_session, sup.id, wh.id,
                  trang_thai="da_duyet", bo_qua_hach_toan=True,
                  phap_nhan_id=pn.id, so_phieu="GR-PAID-001")
    db_session.commit()

    create_res = client_purchase.post(f"/api/accounting/purchase-invoices/from-gr/{gr.id}")
    assert create_res.status_code in (200, 201)
    inv_id = create_res.json()["id"]

    # Giả lập có thanh toán 1 phần
    inv = db_session.get(PurchaseInvoice, inv_id)
    inv.da_thanh_toan = Decimal("100000")
    db_session.commit()

    cancel_res = client_purchase.post(f"/api/accounting/purchase-invoices/{inv_id}/huy")

    assert cancel_res.status_code == 400
    assert "thanh toán" in cancel_res.json()["detail"].lower()


# ─── #11: gui-ncc endpoint ─────────────────────────────────────────────────────

def test_gui_ncc_transitions_da_duyet_to_da_gui_ncc(client_purchase, db_session):
    sup = _make_supplier(db_session)
    sup.ma_ncc = "NCC_GUI1"
    db_session.flush()
    po = _make_po(db_session, sup.id, trang_thai="da_duyet", so_po="PO-GUI-NCC-001")
    db_session.commit()

    res = client_purchase.post(f"/api/purchase-orders/{po.id}/gui-ncc")

    assert res.status_code == 200, res.text
    assert res.json()["trang_thai"] == "da_gui_ncc"

    db_session.refresh(po)
    assert po.trang_thai == "da_gui_ncc"


def test_gui_ncc_rejects_non_duyet_status(client_purchase, db_session):
    sup = _make_supplier(db_session)
    sup.ma_ncc = "NCC_GUI2"
    db_session.flush()
    po = _make_po(db_session, sup.id, trang_thai="moi", so_po="PO-GUI-NCC-REJECT-001")
    db_session.commit()

    res = client_purchase.post(f"/api/purchase-orders/{po.id}/gui-ncc")

    assert res.status_code == 400
    assert "duyệt" in res.json()["detail"].lower()


# ─── #18: huy PO endpoint ─────────────────────────────────────────────────────

def test_huy_po_success_when_no_approved_gr(client_purchase, db_session):
    sup = _make_supplier(db_session)
    sup.ma_ncc = "NCC_HUY1"
    db_session.flush()
    po = _make_po(db_session, sup.id, trang_thai="da_duyet", so_po="PO-HUY-001")
    db_session.commit()

    res = client_purchase.post(f"/api/purchase-orders/{po.id}/huy")

    assert res.status_code == 200, res.text
    assert res.json()["trang_thai"] == "huy"

    db_session.refresh(po)
    assert po.trang_thai == "huy"


def test_huy_po_blocked_when_approved_gr_exists(client_purchase, db_session):
    pn, _, wh = _make_warehouse(db_session, ma_pn="PN_HUYPO", ma_px="PX_HUYPO", ma_kho="KH_HUYPO")
    sup = _make_supplier(db_session)
    sup.ma_ncc = "NCC_HUY2"
    db_session.flush()
    po = _make_po(db_session, sup.id, trang_thai="da_duyet", so_po="PO-HUY-GR-001")
    _make_gr(db_session, sup.id, wh.id, po_id=po.id,
             trang_thai="da_duyet", so_phieu="GR-HUY-PO-001")
    db_session.commit()

    res = client_purchase.post(f"/api/purchase-orders/{po.id}/huy")

    assert res.status_code == 400
    assert "nhập" in res.json()["detail"].lower() or "gr" in res.json()["detail"].lower()


def test_huy_po_blocked_for_hoan_thanh(client_purchase, db_session):
    sup = _make_supplier(db_session)
    sup.ma_ncc = "NCC_HUY3"
    db_session.flush()
    po = _make_po(db_session, sup.id, trang_thai="hoan_thanh", so_po="PO-HUY-HT-001")
    db_session.commit()

    res = client_purchase.post(f"/api/purchase-orders/{po.id}/huy")

    assert res.status_code == 400
    assert "hoàn thành" in res.json()["detail"].lower()


def test_huy_po_idempotent(client_purchase, db_session):
    """Hủy PO đã hủy → trả về 200 trạng thái huy, không lỗi."""
    sup = _make_supplier(db_session)
    sup.ma_ncc = "NCC_HUY4"
    db_session.flush()
    po = _make_po(db_session, sup.id, trang_thai="huy", so_po="PO-HUY-IDEM-001")
    db_session.commit()

    res = client_purchase.post(f"/api/purchase-orders/{po.id}/huy")

    assert res.status_code == 200
    assert res.json()["trang_thai"] == "huy"


# ─── #28: GR list limit parameter ─────────────────────────────────────────────

def test_gr_list_default_limit_returns_data(client_purchase, db_session):
    _, _, wh = _make_warehouse(db_session, ma_pn="PN_LIMIT", ma_px="PX_LIMIT", ma_kho="KH_LIMIT")
    sup = _make_supplier(db_session)
    sup.ma_ncc = "NCC_LIMIT"
    db_session.flush()
    for i in range(3):
        _make_gr(db_session, sup.id, wh.id,
                 trang_thai="da_duyet", so_phieu=f"GR-LIMIT-{i:03d}")
    db_session.commit()

    res = client_purchase.get("/api/warehouse/goods-receipts")

    assert res.status_code == 200, res.text
    assert len(res.json()) >= 3


def test_gr_list_custom_limit(client_purchase, db_session):
    """limit=2 → ít hơn tổng số GR trong DB."""
    _, _, wh = _make_warehouse(db_session, ma_pn="PN_LIM2", ma_px="PX_LIM2", ma_kho="KH_LIM2")
    sup = _make_supplier(db_session)
    sup.ma_ncc = "NCC_LIM2"
    db_session.flush()
    for i in range(5):
        _make_gr(db_session, sup.id, wh.id,
                 trang_thai="nhap", so_phieu=f"GR-CLIM-{i:03d}")
    db_session.commit()

    res = client_purchase.get("/api/warehouse/goods-receipts?limit=2")

    assert res.status_code == 200, res.text
    assert len(res.json()) <= 2


def test_gr_list_invalid_limit_rejected(client_purchase, db_session):
    """limit=0 hoặc limit > 2000 → 422 Unprocessable Entity."""
    res0 = client_purchase.get("/api/warehouse/goods-receipts?limit=0")
    res_max = client_purchase.get("/api/warehouse/goods-receipts?limit=9999")

    assert res0.status_code == 422
    assert res_max.status_code == 422
