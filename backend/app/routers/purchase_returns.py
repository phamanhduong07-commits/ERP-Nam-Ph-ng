"""
Module Trả hàng / Giảm giá hàng mua (PurchaseReturn)

Quy trình:
  1. Tạo phiếu (trang_thai=nhap) — lưu thông tin, chưa ảnh hưởng kế toán
  2. Duyệt phiếu → ghi sổ công nợ + bút toán kế toán
     - tra_hang : Nợ 331 / Có 152 + Có 133 (nếu có thuế)
     - giam_gia : Nợ 331 / Có 632 (hoặc 156)
  3. Huỷ phiếu (chỉ được khi còn ở nhap) — xoá khỏi luồng
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, model_validator
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.master import Supplier, PaperMaterial, OtherMaterial
from app.models.purchase import PurchaseReturn, PurchaseReturnItem
from app.models.accounting import DebtLedgerEntry, JournalEntry, JournalEntryLine
from app.models.warehouse_doc import GoodsReceipt
from app.services.inventory_service import get_or_create_balance, xuat_balance, log_tx

router = APIRouter(prefix="/api/purchase-returns", tags=["purchase-returns"])

KE_TOAN_ROLES = ("KE_TOAN", "GIAM_DOC", "ADMIN", "MUA_HANG")


# ── Schemas ───────────────────────────────────────────────────────────────────

class ReturnItemCreate(BaseModel):
    paper_material_id: Optional[int] = None
    other_material_id: Optional[int] = None
    ten_hang: str = ""
    so_luong: Decimal = Decimal("0")
    dvt: str = "Kg"
    don_gia: Decimal = Decimal("0")
    ghi_chu: Optional[str] = None


class PurchaseReturnCreate(BaseModel):
    supplier_id: int
    ngay: date
    loai: str = "tra_hang"           # tra_hang | giam_gia
    po_id: Optional[int] = None
    gr_id: Optional[int] = None
    invoice_id: Optional[int] = None
    ly_do: Optional[str] = None
    thue_suat: Decimal = Decimal("0")
    tong_tien_hang: Decimal
    tien_thue: Optional[Decimal] = None
    tong_thanh_toan: Optional[Decimal] = None
    ghi_chu: Optional[str] = None
    items: list[ReturnItemCreate] = []

    @model_validator(mode="after")
    def tinh_thue_va_tong(self) -> "PurchaseReturnCreate":
        if self.tien_thue is None:
            self.tien_thue = round(self.tong_tien_hang * self.thue_suat / 100, 0)
        if self.tong_thanh_toan is None:
            self.tong_thanh_toan = self.tong_tien_hang + self.tien_thue
        return self


# ── Helpers ───────────────────────────────────────────────────────────────────

def _gen_so_phieu(db: Session, loai: str) -> str:
    prefix = "PTH" if loai == "tra_hang" else "PGG"
    ym = datetime.today().strftime("%Y%m")
    pattern = f"{prefix}-{ym}-%"
    last = db.query(func.max(PurchaseReturn.so_phieu)).filter(
        PurchaseReturn.so_phieu.like(pattern)
    ).scalar()
    seq = 1
    if last:
        try:
            seq = int(last.rsplit("-", 1)[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    return f"{prefix}-{ym}-{seq:04d}"


def _gen_so_but_toan(db: Session) -> str:
    prefix = f"BT{datetime.today().strftime('%Y%m')}"
    last = db.query(func.max(JournalEntry.so_but_toan)).filter(
        JournalEntry.so_but_toan.like(f"{prefix}%")
    ).scalar()
    seq = int(last[-4:]) + 1 if last else 1
    return f"{prefix}-{seq:04d}"


def _resolve_ten_hang(item: ReturnItemCreate, db: Session) -> str:
    if item.ten_hang:
        return item.ten_hang
    if item.paper_material_id:
        pm = db.get(PaperMaterial, item.paper_material_id)
        return pm.ten if pm else ""
    if item.other_material_id:
        om = db.get(OtherMaterial, item.other_material_id)
        return om.ten if om else ""
    return ""


def _return_to_dict(r: PurchaseReturn, db: Session) -> dict:
    sup = db.get(Supplier, r.supplier_id)
    items = []
    for it in r.items:
        items.append({
            "id": it.id,
            "paper_material_id": it.paper_material_id,
            "other_material_id": it.other_material_id,
            "ten_hang": it.ten_hang,
            "so_luong": float(it.so_luong),
            "dvt": it.dvt,
            "don_gia": float(it.don_gia),
            "thanh_tien": float(it.thanh_tien),
            "ghi_chu": it.ghi_chu,
        })
    return {
        "id": r.id,
        "so_phieu": r.so_phieu,
        "ngay": r.ngay.isoformat(),
        "supplier_id": r.supplier_id,
        "ten_ncc": sup.ten_viet_tat if sup else None,
        "po_id": r.po_id,
        "gr_id": r.gr_id,
        "invoice_id": r.invoice_id,
        "loai": r.loai,
        "ly_do": r.ly_do,
        "thue_suat": float(r.thue_suat),
        "tong_tien_hang": float(r.tong_tien_hang),
        "tien_thue": float(r.tien_thue),
        "tong_thanh_toan": float(r.tong_thanh_toan),
        "ghi_chu": r.ghi_chu,
        "trang_thai": r.trang_thai,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "approved_at": r.approved_at.isoformat() if r.approved_at else None,
        "items": items,
    }


def _post_journal(db: Session, r: PurchaseReturn, user_id: int) -> None:
    """
    Bút toán ghi sổ kép khi duyệt phiếu trả hàng / giảm giá.

    tra_hang:
      Nợ TK 331 (Phải trả NCC)   = tong_thanh_toan
      Có TK 152/153 (NVL)         = tong_tien_hang
      Có TK 133 (Thuế GTGT đầu vào bị hoàn)  = tien_thue  [nếu có]

    giam_gia:
      Nợ TK 331 (Phải trả NCC)   = tong_thanh_toan
      Có TK 632 (Giá vốn / Giảm giá)  = tong_tien_hang
      Có TK 133 (Thuế GTGT đầu vào)   = tien_thue  [nếu có]
    """
    tk_co_hang = "152" if r.loai == "tra_hang" else "632"
    lines: list[dict] = [
        {
            "so_tk": "331",
            "dien_giai": f"Trả NCC {r.supplier_id} — {r.so_phieu}",
            "so_tien_no": float(r.tong_thanh_toan),
            "so_tien_co": 0,
        },
        {
            "so_tk": tk_co_hang,
            "dien_giai": f"Hàng trả / giảm giá — {r.so_phieu}",
            "so_tien_no": 0,
            "so_tien_co": float(r.tong_tien_hang),
        },
    ]
    if float(r.tien_thue) > 0:
        lines.append({
            "so_tk": "133",
            "dien_giai": f"Thuế GTGT đầu vào hoàn — {r.so_phieu}",
            "so_tien_no": 0,
            "so_tien_co": float(r.tien_thue),
        })

    entry = JournalEntry(
        so_but_toan=_gen_so_but_toan(db),
        ngay_but_toan=r.ngay,
        dien_giai=f"Trả hàng/giảm giá NCC — {r.so_phieu}",
        loai_but_toan="tra_hang_mua" if r.loai == "tra_hang" else "giam_gia_mua",
        tong_no=sum(l["so_tien_no"] for l in lines),
        tong_co=sum(l["so_tien_co"] for l in lines),
        chung_tu_loai="purchase_return",
        chung_tu_id=r.id,
        created_by=user_id,
    )
    db.add(entry)
    db.flush()

    for line in lines:
        db.add(JournalEntryLine(
            entry_id=entry.id,
            so_tk=line["so_tk"],
            dien_giai=line.get("dien_giai"),
            so_tien_no=line["so_tien_no"],
            so_tien_co=line["so_tien_co"],
        ))


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
def list_returns(
    supplier_id: Optional[int] = Query(None),
    loai: Optional[str] = Query(None),
    trang_thai: Optional[str] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(PurchaseReturn)
    if supplier_id:
        q = q.filter(PurchaseReturn.supplier_id == supplier_id)
    if loai:
        q = q.filter(PurchaseReturn.loai == loai)
    if trang_thai:
        q = q.filter(PurchaseReturn.trang_thai == trang_thai)
    if tu_ngay:
        q = q.filter(PurchaseReturn.ngay >= tu_ngay)
    if den_ngay:
        q = q.filter(PurchaseReturn.ngay <= den_ngay)

    total = q.count()
    rows = q.order_by(desc(PurchaseReturn.ngay), desc(PurchaseReturn.id)) \
             .offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for r in rows:
        sup = db.get(Supplier, r.supplier_id)
        items.append({
            "id": r.id,
            "so_phieu": r.so_phieu,
            "ngay": r.ngay.isoformat(),
            "supplier_id": r.supplier_id,
            "ten_ncc": sup.ten_viet_tat if sup else None,
            "loai": r.loai,
            "tong_thanh_toan": float(r.tong_thanh_toan),
            "trang_thai": r.trang_thai,
            "po_id": r.po_id,
            "gr_id": r.gr_id,
            "invoice_id": r.invoice_id,
            "ly_do": r.ly_do,
        })

    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.post("", status_code=201)
def create_return(
    body: PurchaseReturnCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    if body.loai not in ("tra_hang", "giam_gia"):
        raise HTTPException(400, "Loại phải là tra_hang hoặc giam_gia")
    if not db.get(Supplier, body.supplier_id):
        raise HTTPException(404, "Không tìm thấy nhà cung cấp")

    r = PurchaseReturn(
        so_phieu=_gen_so_phieu(db, body.loai),
        ngay=body.ngay,
        supplier_id=body.supplier_id,
        po_id=body.po_id,
        gr_id=body.gr_id,
        invoice_id=body.invoice_id,
        loai=body.loai,
        ly_do=body.ly_do,
        thue_suat=body.thue_suat,
        tong_tien_hang=body.tong_tien_hang,
        tien_thue=body.tien_thue or Decimal("0"),
        tong_thanh_toan=body.tong_thanh_toan or body.tong_tien_hang,
        ghi_chu=body.ghi_chu,
        trang_thai="nhap",
        created_by=current_user.id,
    )
    db.add(r)
    db.flush()

    for it in body.items:
        ten = _resolve_ten_hang(it, db)
        thanh_tien = round(it.so_luong * it.don_gia, 2)
        db.add(PurchaseReturnItem(
            return_id=r.id,
            paper_material_id=it.paper_material_id,
            other_material_id=it.other_material_id,
            ten_hang=ten,
            so_luong=it.so_luong,
            dvt=it.dvt,
            don_gia=it.don_gia,
            thanh_tien=thanh_tien,
            ghi_chu=it.ghi_chu,
        ))

    db.commit()
    db.refresh(r)
    return _return_to_dict(r, db)


@router.get("/{return_id}")
def get_return(
    return_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    r = db.query(PurchaseReturn).filter(PurchaseReturn.id == return_id).first()
    if not r:
        raise HTTPException(404, "Không tìm thấy phiếu trả hàng")
    return _return_to_dict(r, db)


@router.post("/{return_id}/duyet")
def approve_return(
    return_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    r = db.query(PurchaseReturn).filter(PurchaseReturn.id == return_id).first()
    if not r:
        raise HTTPException(404, "Không tìm thấy phiếu trả hàng")
    if r.trang_thai != "nhap":
        raise HTTPException(400, f"Phiếu đang ở trạng thái '{r.trang_thai}', không thể duyệt")

    r.trang_thai = "da_duyet"
    r.approved_by = current_user.id
    r.approved_at = datetime.utcnow()

    # Ghi sổ công nợ phải trả (giam_no — giảm số tiền phải trả NCC)
    db.add(DebtLedgerEntry(
        ngay=r.ngay,
        loai="giam_no",
        doi_tuong="nha_cung_cap",
        supplier_id=r.supplier_id,
        chung_tu_loai="purchase_return",
        chung_tu_id=r.id,
        so_tien=r.tong_thanh_toan,
        ghi_chu=f"Trả hàng/giảm giá NCC — {r.so_phieu}",
    ))

    # Bút toán ghi sổ kép
    _post_journal(db, r, current_user.id)

    # Giảm tồn kho khi trả hàng vật chất (loai=tra_hang)
    if r.loai == "tra_hang":
        warehouse_id = None
        if r.gr_id:
            gr = db.get(GoodsReceipt, r.gr_id)
            if gr:
                warehouse_id = gr.warehouse_id
        if warehouse_id:
            for item in r.items:
                ten_hang = item.ten_hang or ""
                bal = get_or_create_balance(
                    db, warehouse_id,
                    paper_material_id=item.paper_material_id,
                    other_material_id=item.other_material_id,
                    ten_hang=ten_hang,
                    don_vi=item.dvt,
                )
                don_gia_xuat = bal.don_gia_binh_quan
                xuat_balance(bal, item.so_luong, ten_hang)
                log_tx(
                    db, warehouse_id, "XUAT_TRA_HANG_NCC",
                    item.so_luong, don_gia_xuat, bal.ton_luong,
                    "purchase_returns", r.id, current_user.id,
                    paper_material_id=item.paper_material_id,
                    other_material_id=item.other_material_id,
                    ghi_chu=r.so_phieu,
                )

    db.commit()
    db.refresh(r)
    return _return_to_dict(r, db)


@router.post("/{return_id}/huy")
def cancel_return(
    return_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    r = db.query(PurchaseReturn).filter(PurchaseReturn.id == return_id).first()
    if not r:
        raise HTTPException(404, "Không tìm thấy phiếu trả hàng")
    if r.trang_thai == "da_duyet":
        raise HTTPException(400, "Phiếu đã duyệt, không thể huỷ. Liên hệ kế toán trưởng.")
    if r.trang_thai == "huy":
        return _return_to_dict(r, db)

    r.trang_thai = "huy"
    db.commit()
    db.refresh(r)
    return _return_to_dict(r, db)


@router.delete("/{return_id}", status_code=204)
def delete_return(
    return_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    r = db.query(PurchaseReturn).filter(PurchaseReturn.id == return_id).first()
    if not r:
        raise HTTPException(404, "Không tìm thấy phiếu trả hàng")
    if r.trang_thai == "da_duyet":
        raise HTTPException(400, "Không thể xoá phiếu đã duyệt")
    db.delete(r)
    db.commit()
