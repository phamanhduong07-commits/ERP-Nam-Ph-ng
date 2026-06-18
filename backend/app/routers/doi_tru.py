"""
Đối trừ chứng từ — Tiện ích mua hàng
5 features: doi_tru_1, doi_tru_nhieu, bo_doi_tru_1, bo_doi_tru_nhieu, bu_tru_cong_no
"""
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.deps import get_current_user
from app.models.accounting import CashPayment, DoiTruChungTu, DoiTruItem, PurchaseInvoice
from app.models.auth import User

router = APIRouter(prefix="/doi-tru", tags=["Đối trừ chứng từ"])


# ─── Schemas ────────────────────────────────────────────────────────────────

class DoiTruItemIn(BaseModel):
    purchase_invoice_id: int
    cash_payment_id: int
    so_tien_doi_tru: float


class DoiTruCreate(BaseModel):
    supplier_id: int
    ngay_doi_tru: date
    ghi_chu: str | None = None
    phap_nhan_id: int | None = None
    loai: str = "doi_tru"
    items: list[DoiTruItemIn]


class BuTruItemIn(BaseModel):
    purchase_invoice_id: int
    sales_invoice_id: int
    so_tien_doi_tru: float


class BuTruCreate(BaseModel):
    supplier_id: int
    ngay_doi_tru: date
    ghi_chu: str | None = None
    phap_nhan_id: int | None = None
    items: list[BuTruItemIn]


class NhieuDoiTuongIn(BaseModel):
    supplier_ids: list[int]
    ngay_doi_tru: date
    phap_nhan_id: int | None = None
    ghi_chu: str | None = None


# ─── Helpers ────────────────────────────────────────────────────────────────

def _next_ma_doi_tru(db: Session) -> str:
    today = date.today().strftime("%Y%m%d")
    prefix = f"DT-{today}-"
    last = (
        db.query(DoiTruChungTu)
        .filter(DoiTruChungTu.ma_doi_tru.like(f"{prefix}%"))
        .order_by(DoiTruChungTu.id.desc())
        .first()
    )
    seq = int(last.ma_doi_tru.split("-")[-1]) + 1 if last else 1
    return f"{prefix}{seq:03d}"


def _invoice_out(inv: PurchaseInvoice) -> dict:
    return {
        "id": inv.id,
        "so_hoa_don": inv.so_hoa_don,
        "ngay_lap": inv.ngay_lap.isoformat() if inv.ngay_lap else None,
        "tong_thanh_toan": float(inv.tong_thanh_toan),
        "da_thanh_toan": float(inv.da_thanh_toan),
        "con_lai": float(inv.con_lai),
        "trang_thai": inv.trang_thai,
    }


def _payment_out(p: CashPayment) -> dict:
    con_lai_doi_tru = float(p.so_tien) - float(p.da_doi_tru)
    return {
        "id": p.id,
        "so_phieu": p.so_phieu,
        "ngay_phieu": p.ngay_phieu.isoformat() if p.ngay_phieu else None,
        "so_tien": float(p.so_tien),
        "da_doi_tru": float(p.da_doi_tru),
        "con_lai_doi_tru": con_lai_doi_tru,
    }


def _doi_tru_out(dt: DoiTruChungTu) -> dict:
    supplier = dt.supplier
    return {
        "id": dt.id,
        "ma_doi_tru": dt.ma_doi_tru,
        "ngay_doi_tru": dt.ngay_doi_tru.isoformat() if dt.ngay_doi_tru else None,
        "supplier_id": dt.supplier_id,
        "ten_ncc": (supplier.ten_viet_tat or supplier.ten_don_vi or supplier.ma_ncc) if supplier else None,
        "loai": dt.loai,
        "trang_thai": dt.trang_thai,
        "tong_tien_doi_tru": float(dt.tong_tien_doi_tru),
        "ghi_chu": dt.ghi_chu,
        "phap_nhan_id": dt.phap_nhan_id,
        "ngay_xac_nhan": dt.ngay_xac_nhan.isoformat() if dt.ngay_xac_nhan else None,
        "created_at": dt.created_at.isoformat() if dt.created_at else None,
        "items": [
            {
                "id": item.id,
                "purchase_invoice_id": item.purchase_invoice_id,
                "so_hoa_don": item.purchase_invoice.so_hoa_don if item.purchase_invoice else None,
                "cash_payment_id": item.cash_payment_id,
                "so_phieu_chi": item.cash_payment.so_phieu if item.cash_payment else None,
                "sales_invoice_id": item.sales_invoice_id,
                "so_tien_doi_tru": float(item.so_tien_doi_tru),
            }
            for item in (dt.items or [])
        ],
    }


def _update_invoice_status(inv: PurchaseInvoice) -> None:
    if inv.da_thanh_toan <= 0:
        inv.trang_thai = "nhap"
    elif inv.da_thanh_toan >= inv.tong_thanh_toan:
        inv.trang_thai = "da_tt_du"
    else:
        inv.trang_thai = "da_tt_mot_phan"


# ─── GET pending (invoices + payments chưa đối trừ hết) ─────────────────────

@router.get("/pending/{supplier_id}")
def get_pending(
    supplier_id: int,
    phap_nhan_id: int | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> Any:
    inv_q = (
        db.query(PurchaseInvoice)
        .filter(
            PurchaseInvoice.supplier_id == supplier_id,
            PurchaseInvoice.con_lai > 0,
            PurchaseInvoice.trang_thai != "huy",
        )
        .order_by(PurchaseInvoice.ngay_lap)
    )
    if phap_nhan_id:
        inv_q = inv_q.filter(PurchaseInvoice.phap_nhan_id == phap_nhan_id)
    invoices = inv_q.all()

    pay_q = (
        db.query(CashPayment)
        .filter(
            CashPayment.supplier_id == supplier_id,
            CashPayment.trang_thai.in_(["da_chot", "da_duyet"]),
            CashPayment.loai_chi.is_(None),
        )
        .order_by(CashPayment.ngay_phieu)
    )
    if phap_nhan_id:
        pay_q = pay_q.filter(CashPayment.phap_nhan_id == phap_nhan_id)
    payments = [p for p in pay_q.all() if float(p.so_tien) - float(p.da_doi_tru) > 0]

    return {
        "invoices": [_invoice_out(i) for i in invoices],
        "payments": [_payment_out(p) for p in payments],
    }


# ─── GET pending sales invoices cho bù trừ công nợ ──────────────────────────

@router.get("/pending-ar/{supplier_id}")
def get_pending_ar(
    supplier_id: int,
    phap_nhan_id: int | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> Any:
    from app.models.billing import SalesInvoice
    from app.models.master import Supplier

    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier or not supplier.customer_id:
        return {"sales_invoices": [], "message": "NCC này không phải là khách hàng"}

    from app.models.customers import Customer
    q = (
        db.query(SalesInvoice)
        .filter(
            SalesInvoice.customer_id == supplier.customer_id,
            SalesInvoice.con_lai > 0,
            SalesInvoice.trang_thai != "huy",
        )
        .order_by(SalesInvoice.ngay_hoa_don)
    )
    if phap_nhan_id:
        q = q.filter(SalesInvoice.phap_nhan_id == phap_nhan_id)

    return {
        "sales_invoices": [
            {
                "id": si.id,
                "so_hoa_don": si.so_hoa_don,
                "ngay_hoa_don": si.ngay_hoa_don.isoformat() if si.ngay_hoa_don else None,
                "tong_cong": float(si.tong_cong),
                "da_thanh_toan": float(si.da_thanh_toan),
                "con_lai": float(si.con_lai),
            }
            for si in q.all()
        ]
    }


# ─── GET suppliers có chứng từ chưa đối trừ ─────────────────────────────────

@router.get("/suppliers-pending")
def get_suppliers_pending(
    phap_nhan_id: int | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> Any:
    from app.models.master import Supplier

    pay_q = (
        db.query(
            CashPayment.supplier_id,
            func.sum(CashPayment.so_tien - CashPayment.da_doi_tru).label("tong_chua_doi_tru"),
        )
        .filter(
            CashPayment.trang_thai.in_(["da_chot", "da_duyet"]),
            CashPayment.loai_chi.is_(None),
        )
        .group_by(CashPayment.supplier_id)
    )
    if phap_nhan_id:
        pay_q = pay_q.filter(CashPayment.phap_nhan_id == phap_nhan_id)

    pay_map: dict[int, float] = {}
    for r in pay_q.all():
        val = float(r.tong_chua_doi_tru)
        if val > 0:
            pay_map[r.supplier_id] = val

    if not pay_map:
        return []

    suppliers = (
        db.query(Supplier)
        .filter(Supplier.id.in_(pay_map.keys()))
        .order_by(Supplier.ten_viet_tat)
        .all()
    )

    return [
        {
            "id": s.id,
            "ma_ncc": s.ma_ncc,
            "ten_ncc": s.ten_viet_tat or s.ten_don_vi or s.ma_ncc,
            "ma_so_thue": s.ma_so_thue,
            "dia_chi": s.dia_chi,
            "so_thanh_toan_chua_doi_tru": pay_map.get(s.id, 0),
        }
        for s in suppliers
    ]


# ─── LIST ────────────────────────────────────────────────────────────────────

@router.get("/")
def list_doi_tru(
    supplier_id: int | None = None,
    trang_thai: str | None = None,
    loai: str | None = None,
    phap_nhan_id: int | None = None,
    tu_ngay: date | None = None,
    den_ngay: date | None = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> Any:
    q = db.query(DoiTruChungTu).options(
        selectinload(DoiTruChungTu.supplier),
        selectinload(DoiTruChungTu.items).selectinload(DoiTruItem.purchase_invoice),
        selectinload(DoiTruChungTu.items).selectinload(DoiTruItem.cash_payment),
    )
    if supplier_id:
        q = q.filter(DoiTruChungTu.supplier_id == supplier_id)
    if trang_thai:
        q = q.filter(DoiTruChungTu.trang_thai == trang_thai)
    if loai:
        q = q.filter(DoiTruChungTu.loai == loai)
    if phap_nhan_id:
        q = q.filter(DoiTruChungTu.phap_nhan_id == phap_nhan_id)
    if tu_ngay:
        q = q.filter(DoiTruChungTu.ngay_doi_tru >= tu_ngay)
    if den_ngay:
        q = q.filter(DoiTruChungTu.ngay_doi_tru <= den_ngay)
    total = q.count()
    rows = q.order_by(DoiTruChungTu.ngay_doi_tru.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": [_doi_tru_out(r) for r in rows]}


# ─── GET detail ──────────────────────────────────────────────────────────────

@router.get("/{doi_tru_id}")
def get_doi_tru(
    doi_tru_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> Any:
    dt = (
        db.query(DoiTruChungTu)
        .options(
            selectinload(DoiTruChungTu.supplier),
            selectinload(DoiTruChungTu.items).selectinload(DoiTruItem.purchase_invoice),
            selectinload(DoiTruChungTu.items).selectinload(DoiTruItem.cash_payment),
        )
        .filter(DoiTruChungTu.id == doi_tru_id)
        .first()
    )
    if not dt:
        raise HTTPException(404, "Không tìm thấy đối trừ")
    return _doi_tru_out(dt)


# ─── CREATE + auto XAC NHAN ──────────────────────────────────────────────────

def _create_and_confirm(db: Session, data: DoiTruCreate | BuTruCreate, user_id: int) -> DoiTruChungTu:
    now = datetime.now(timezone.utc)
    is_bu_tru = isinstance(data, BuTruCreate)

    dt = DoiTruChungTu(
        ma_doi_tru=_next_ma_doi_tru(db),
        ngay_doi_tru=data.ngay_doi_tru,
        supplier_id=data.supplier_id,
        loai="bu_tru_cong_no" if is_bu_tru else data.loai,
        trang_thai="da_xac_nhan",
        ghi_chu=data.ghi_chu,
        phap_nhan_id=data.phap_nhan_id,
        nguoi_xac_nhan_id=user_id,
        ngay_xac_nhan=now,
        created_by=user_id,
    )
    db.add(dt)
    db.flush()

    tong = Decimal("0")
    for item_in in data.items:
        so_tien = Decimal(str(item_in.so_tien_doi_tru))

        if is_bu_tru:
            inv = db.query(PurchaseInvoice).filter(PurchaseInvoice.id == item_in.purchase_invoice_id).first()
            if not inv:
                raise HTTPException(400, f"Hóa đơn mua {item_in.purchase_invoice_id} không tồn tại")
            if so_tien > inv.con_lai:
                raise HTTPException(400, f"Số tiền đối trừ vượt quá số còn lại của HĐ {inv.so_hoa_don}")
            inv.da_thanh_toan += so_tien
            _update_invoice_status(inv)

            from app.models.billing import SalesInvoice
            si = db.query(SalesInvoice).filter(SalesInvoice.id == item_in.sales_invoice_id).first()
            if not si:
                raise HTTPException(400, f"Hóa đơn bán {item_in.sales_invoice_id} không tồn tại")
            si.da_thanh_toan += so_tien

            db_item = DoiTruItem(
                doi_tru_id=dt.id,
                purchase_invoice_id=item_in.purchase_invoice_id,
                sales_invoice_id=item_in.sales_invoice_id,
                so_tien_doi_tru=so_tien,
            )
        else:
            inv = db.query(PurchaseInvoice).filter(PurchaseInvoice.id == item_in.purchase_invoice_id).first()
            if not inv:
                raise HTTPException(400, f"Hóa đơn mua {item_in.purchase_invoice_id} không tồn tại")
            if so_tien > inv.con_lai:
                raise HTTPException(400, f"Số tiền đối trừ vượt quá số còn lại của HĐ {inv.so_hoa_don}")

            pay = db.query(CashPayment).filter(CashPayment.id == item_in.cash_payment_id).first()
            if not pay:
                raise HTTPException(400, f"Phiếu chi {item_in.cash_payment_id} không tồn tại")
            con_lai_pay = float(pay.so_tien) - float(pay.da_doi_tru)
            if float(so_tien) > con_lai_pay + 0.01:
                raise HTTPException(400, f"Số tiền đối trừ vượt quá phần còn lại của PC {pay.so_phieu}")

            inv.da_thanh_toan += so_tien
            _update_invoice_status(inv)
            pay.da_doi_tru += so_tien

            db_item = DoiTruItem(
                doi_tru_id=dt.id,
                purchase_invoice_id=item_in.purchase_invoice_id,
                cash_payment_id=item_in.cash_payment_id,
                so_tien_doi_tru=so_tien,
            )

        db.add(db_item)
        tong += so_tien

    dt.tong_tien_doi_tru = tong
    db.commit()
    db.refresh(dt)
    return dt


@router.post("/")
def create_doi_tru(
    data: DoiTruCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Any:
    dt = _create_and_confirm(db, data, user.id)
    return {"id": dt.id, "ma_doi_tru": dt.ma_doi_tru, "tong_tien_doi_tru": float(dt.tong_tien_doi_tru)}


# ─── HỦY ─────────────────────────────────────────────────────────────────────

@router.post("/{doi_tru_id}/huy")
def huy_doi_tru(
    doi_tru_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Any:
    dt = (
        db.query(DoiTruChungTu)
        .options(
            selectinload(DoiTruChungTu.items).selectinload(DoiTruItem.purchase_invoice),
            selectinload(DoiTruChungTu.items).selectinload(DoiTruItem.cash_payment),
        )
        .filter(DoiTruChungTu.id == doi_tru_id)
        .first()
    )
    if not dt:
        raise HTTPException(404, "Không tìm thấy đối trừ")
    if dt.trang_thai == "da_huy":
        raise HTTPException(400, "Đối trừ này đã bị hủy")

    for item in dt.items:
        so_tien = item.so_tien_doi_tru
        if item.purchase_invoice:
            item.purchase_invoice.da_thanh_toan -= so_tien
            if item.purchase_invoice.da_thanh_toan < 0:
                item.purchase_invoice.da_thanh_toan = Decimal("0")
            _update_invoice_status(item.purchase_invoice)
        if item.cash_payment:
            item.cash_payment.da_doi_tru -= so_tien
            if item.cash_payment.da_doi_tru < 0:
                item.cash_payment.da_doi_tru = Decimal("0")
        if item.sales_invoice_id:
            from app.models.billing import SalesInvoice
            si = db.query(SalesInvoice).filter(SalesInvoice.id == item.sales_invoice_id).first()
            if si:
                si.da_thanh_toan -= so_tien
                if si.da_thanh_toan < 0:
                    si.da_thanh_toan = Decimal("0")

    dt.trang_thai = "da_huy"
    db.commit()
    return {"ok": True, "ma_doi_tru": dt.ma_doi_tru}


# ─── NHIỀU ĐỐI TƯỢNG — preview FIFO ─────────────────────────────────────────

def _fifo_match_supplier(
    db: Session, supplier_id: int, phap_nhan_id: int | None = None
) -> list[dict]:
    inv_q = (
        db.query(PurchaseInvoice)
        .filter(
            PurchaseInvoice.supplier_id == supplier_id,
            PurchaseInvoice.con_lai > 0,
            PurchaseInvoice.trang_thai != "huy",
        )
        .order_by(PurchaseInvoice.ngay_lap)
    )
    if phap_nhan_id:
        inv_q = inv_q.filter(PurchaseInvoice.phap_nhan_id == phap_nhan_id)

    pay_q = (
        db.query(CashPayment)
        .filter(
            CashPayment.supplier_id == supplier_id,
            CashPayment.trang_thai.in_(["da_chot", "da_duyet"]),
            CashPayment.loai_chi.is_(None),
        )
        .order_by(CashPayment.ngay_phieu)
    )
    if phap_nhan_id:
        pay_q = pay_q.filter(CashPayment.phap_nhan_id == phap_nhan_id)

    invoices = [(i.id, i.so_hoa_don, float(i.con_lai)) for i in inv_q.all()]
    payments = [
        (p.id, p.so_phieu, float(p.so_tien) - float(p.da_doi_tru))
        for p in pay_q.all()
        if float(p.so_tien) - float(p.da_doi_tru) > 0
    ]

    if not invoices or not payments:
        return []

    items: list[dict] = []
    inv_idx, pay_idx = 0, 0
    inv_remaining = invoices[0][2]
    pay_remaining = payments[0][2]

    while inv_idx < len(invoices) and pay_idx < len(payments):
        amount = min(inv_remaining, pay_remaining)
        items.append({
            "purchase_invoice_id": invoices[inv_idx][0],
            "so_hoa_don": invoices[inv_idx][1],
            "cash_payment_id": payments[pay_idx][0],
            "so_phieu_chi": payments[pay_idx][1],
            "so_tien_doi_tru": round(amount, 2),
        })
        inv_remaining -= amount
        pay_remaining -= amount
        if inv_remaining < 0.01:
            inv_idx += 1
            if inv_idx < len(invoices):
                inv_remaining = invoices[inv_idx][2]
        if pay_remaining < 0.01:
            pay_idx += 1
            if pay_idx < len(payments):
                pay_remaining = payments[pay_idx][2]

    return items


@router.post("/nhieu-doi-tuong/preview")
def preview_nhieu_doi_tuong(
    data: NhieuDoiTuongIn,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> Any:
    from app.models.master import Supplier
    result = []
    for sid in data.supplier_ids:
        supplier = db.query(Supplier).filter(Supplier.id == sid).first()
        items = _fifo_match_supplier(db, sid, data.phap_nhan_id)
        tong = sum(i["so_tien_doi_tru"] for i in items)
        result.append({
            "supplier_id": sid,
            "ten_ncc": (supplier.ten_viet_tat or supplier.ten_don_vi or supplier.ma_ncc) if supplier else str(sid),
            "so_items": len(items),
            "tong_tien_doi_tru": tong,
            "items": items,
        })
    return result


@router.post("/nhieu-doi-tuong")
def doi_tru_nhieu_doi_tuong(
    data: NhieuDoiTuongIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Any:
    results = []
    for sid in data.supplier_ids:
        fifo_items = _fifo_match_supplier(db, sid, data.phap_nhan_id)
        if not fifo_items:
            results.append({"supplier_id": sid, "skipped": True, "reason": "Không có HĐ hoặc phiếu chi phù hợp"})
            continue
        payload = DoiTruCreate(
            supplier_id=sid,
            ngay_doi_tru=data.ngay_doi_tru,
            ghi_chu=data.ghi_chu,
            phap_nhan_id=data.phap_nhan_id,
            items=[DoiTruItemIn(**i) for i in fifo_items],
        )
        dt = _create_and_confirm(db, payload, user.id)
        results.append({"supplier_id": sid, "id": dt.id, "ma_doi_tru": dt.ma_doi_tru, "tong": float(dt.tong_tien_doi_tru)})
    return results


# ─── BỎ ĐỐI TRỪ NHIỀU ĐỐI TƯỢNG ─────────────────────────────────────────────

class HuyNhieuIn(BaseModel):
    supplier_ids: list[int]
    tu_ngay: date | None = None
    den_ngay: date | None = None
    phap_nhan_id: int | None = None


class SupplierConfirmIn(BaseModel):
    supplier_id: int
    items: list[DoiTruItemIn]


class ConfirmNhieuIn(BaseModel):
    ngay_doi_tru: date
    ghi_chu: str | None = None
    phap_nhan_id: int | None = None
    suppliers: list[SupplierConfirmIn]


@router.post("/nhieu-doi-tuong/huy")
def huy_nhieu_doi_tuong(
    data: HuyNhieuIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Any:
    results = []
    for sid in data.supplier_ids:
        q = db.query(DoiTruChungTu).filter(
            DoiTruChungTu.supplier_id == sid,
            DoiTruChungTu.trang_thai == "da_xac_nhan",
        )
        if data.tu_ngay:
            q = q.filter(DoiTruChungTu.ngay_doi_tru >= data.tu_ngay)
        if data.den_ngay:
            q = q.filter(DoiTruChungTu.ngay_doi_tru <= data.den_ngay)
        if data.phap_nhan_id:
            q = q.filter(DoiTruChungTu.phap_nhan_id == data.phap_nhan_id)
        rows = q.all()
        for dt in rows:
            # load items
            db.refresh(dt)
        count = 0
        for dt in rows:
            items = db.query(DoiTruItem).filter(DoiTruItem.doi_tru_id == dt.id).all()
            for item in items:
                if item.purchase_invoice_id:
                    inv = db.query(PurchaseInvoice).filter(PurchaseInvoice.id == item.purchase_invoice_id).first()
                    if inv:
                        inv.da_thanh_toan -= item.so_tien_doi_tru
                        if inv.da_thanh_toan < 0:
                            inv.da_thanh_toan = Decimal("0")
                        _update_invoice_status(inv)
                if item.cash_payment_id:
                    pay = db.query(CashPayment).filter(CashPayment.id == item.cash_payment_id).first()
                    if pay:
                        pay.da_doi_tru -= item.so_tien_doi_tru
                        if pay.da_doi_tru < 0:
                            pay.da_doi_tru = Decimal("0")
            dt.trang_thai = "da_huy"
            count += 1
        db.commit()
        results.append({"supplier_id": sid, "so_bao_doi_tru_huy": count})
    return results


# ─── NHIỀU ĐỐI TƯỢNG — confirm với pairs đã tính sẵn (user có thể sửa) ──────

@router.post("/nhieu-doi-tuong/confirm-with-items")
def confirm_nhieu_with_items(
    data: ConfirmNhieuIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Any:
    results = []
    for sup in data.suppliers:
        if not sup.items:
            results.append({"supplier_id": sup.supplier_id, "skipped": True, "reason": "Không có cặp đối trừ"})
            continue
        payload = DoiTruCreate(
            supplier_id=sup.supplier_id,
            ngay_doi_tru=data.ngay_doi_tru,
            ghi_chu=data.ghi_chu,
            phap_nhan_id=data.phap_nhan_id,
            items=sup.items,
        )
        try:
            dt = _create_and_confirm(db, payload, user.id)
            results.append({
                "supplier_id": sup.supplier_id,
                "id": dt.id,
                "ma_doi_tru": dt.ma_doi_tru,
                "tong": float(dt.tong_tien_doi_tru),
            })
        except HTTPException as e:
            db.rollback()
            results.append({"supplier_id": sup.supplier_id, "skipped": True, "reason": e.detail})
    return results


# ─── BÙ TRỪ CÔNG NỢ ──────────────────────────────────────────────────────────

@router.post("/bu-tru-cong-no")
def tao_bu_tru_cong_no(
    data: BuTruCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Any:
    dt = _create_and_confirm(db, data, user.id)
    return {"id": dt.id, "ma_doi_tru": dt.ma_doi_tru, "tong_tien_doi_tru": float(dt.tong_tien_doi_tru)}
