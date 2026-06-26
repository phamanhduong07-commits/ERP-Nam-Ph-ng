from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import exists, func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.crm import CustomerInteraction
from app.models.master import Customer, CustomerNhanVien
from app.models.accounting import DebtLedgerEntry
from app.schemas.crm import (
    InteractionCreate, InteractionUpdate, InteractionResponse,
    CreditAlertResponse,
)

router = APIRouter(prefix="/api/crm", tags=["CRM"])


# ─── Interactions ─────────────────────────────────────────────────────────────

@router.get("/interactions", response_model=list[InteractionResponse])
def list_interactions(
    customer_id: int | None = Query(None),
    loai: str | None = Query(None),
    ket_qua: str | None = Query(None),
    ngay_tu: date | None = Query(None),
    ngay_den: date | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _SALE_STAFF_ROLES = {"SALE_ADMIN", "SALE_ADMIN_NHAN_VIEN", "KINH_DOANH_NHAN_VIEN"}
    role_code = current_user.role.ma_vai_tro if current_user.role else None

    q = db.query(CustomerInteraction).order_by(CustomerInteraction.ngay.desc())
    if customer_id:
        q = q.filter(CustomerInteraction.customer_id == customer_id)
    if loai:
        q = q.filter(CustomerInteraction.loai == loai)
    if ket_qua:
        q = q.filter(CustomerInteraction.ket_qua == ket_qua)
    if ngay_tu:
        q = q.filter(CustomerInteraction.ngay >= ngay_tu)
    if ngay_den:
        q = q.filter(CustomerInteraction.ngay <= ngay_den)

    if role_code in _SALE_STAFF_ROLES:
        scoped_ids = (
            db.query(Customer.id).filter(
                or_(
                    Customer.nv_phu_trach_id == current_user.id,
                    exists().where(
                        (CustomerNhanVien.customer_id == Customer.id)
                        & (CustomerNhanVien.user_id == current_user.id)
                    ),
                )
            )
        )
        q = q.filter(CustomerInteraction.customer_id.in_(scoped_ids))

    return q.all()


@router.post("/interactions", response_model=InteractionResponse, status_code=201)
def create_interaction(
    data: InteractionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not db.get(Customer, data.customer_id):
        raise HTTPException(404, "Không tìm thấy khách hàng")
    obj = CustomerInteraction(**data.model_dump(), created_by=current_user.id)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/interactions/{interaction_id}", response_model=InteractionResponse)
def get_interaction(
    interaction_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.get(CustomerInteraction, interaction_id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy tương tác")
    return obj


@router.patch("/interactions/{interaction_id}", response_model=InteractionResponse)
def update_interaction(
    interaction_id: int,
    data: InteractionUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.get(CustomerInteraction, interaction_id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy tương tác")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/interactions/{interaction_id}", status_code=204)
def delete_interaction(
    interaction_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.get(CustomerInteraction, interaction_id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy tương tác")
    db.delete(obj)
    db.commit()


# ─── Credit alerts ────────────────────────────────────────────────────────────

@router.get("/credit-alerts", response_model=list[CreditAlertResponse])
def get_credit_alerts(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Danh sách khách hàng có dư nợ vượt hạn mức (no_tran)."""
    # tổng nợ phát sinh theo customer_id từ DebtLedgerEntry
    tang = (
        db.query(DebtLedgerEntry.customer_id, func.sum(DebtLedgerEntry.so_tien).label("s"))
        .filter(DebtLedgerEntry.doi_tuong == "khach_hang", DebtLedgerEntry.loai == "tang_no",
                DebtLedgerEntry.customer_id.isnot(None))
        .group_by(DebtLedgerEntry.customer_id)
        .all()
    )
    giam = (
        db.query(DebtLedgerEntry.customer_id, func.sum(DebtLedgerEntry.so_tien).label("s"))
        .filter(DebtLedgerEntry.doi_tuong == "khach_hang", DebtLedgerEntry.loai == "giam_no",
                DebtLedgerEntry.customer_id.isnot(None))
        .group_by(DebtLedgerEntry.customer_id)
        .all()
    )

    tang_map = {r.customer_id: float(r.s) for r in tang}
    giam_map = {r.customer_id: float(r.s) for r in giam}

    customers = db.query(Customer).filter(Customer.no_tran > 0, Customer.trang_thai.is_(True)).all()

    alerts = []
    for c in customers:
        du_no = tang_map.get(c.id, 0.0) - giam_map.get(c.id, 0.0)
        if du_no > float(c.no_tran):
            alerts.append(CreditAlertResponse(
                customer_id=c.id,
                ten_viet_tat=c.ten_viet_tat,
                ten_don_vi=c.ten_don_vi,
                credit_limit=float(c.no_tran),
                du_no_hien_tai=du_no,
                vuot_han_muc=du_no - float(c.no_tran),
            ))

    alerts.sort(key=lambda x: x.vuot_han_muc, reverse=True)
    return alerts
