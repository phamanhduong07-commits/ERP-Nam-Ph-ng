from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.master import BankAccount
from app.schemas.accounting import BankAccountCreate, BankAccountUpdate, BankAccountResponse
from app.services.excel_import_service import (
    ImportField, build_template_response, import_excel, parse_bool, parse_decimal, parse_text,
)

BANK_ACCOUNT_IMPORT_FIELDS = [
    ImportField("ma_tk", "Ma tai khoan", required=True, parser=parse_text, help_text="Ma tai khoan ngan hang, duy nhat"),
    ImportField("ten_ngan_hang", "Ten ngan hang", required=True, parser=parse_text),
    ImportField("so_tai_khoan", "So tai khoan", required=True, parser=parse_text),
    ImportField("chu_tai_khoan", "Chu tai khoan", parser=parse_text),
    ImportField("chi_nhanh", "Chi nhanh", parser=parse_text),
    ImportField("swift_code", "SWIFT code", parser=parse_text),
    ImportField("so_du_dau", "So du dau", parser=parse_decimal, default=0),
    ImportField("ghi_chu", "Ghi chu", parser=parse_text),
    ImportField("trang_thai", "Trang thai", parser=parse_bool, default=True),
]

router = APIRouter(prefix="/api/bank-accounts", tags=["bank-accounts"])

KE_TOAN = ("KE_TOAN", "GIAM_DOC", "ADMIN")


@router.get("/import-template")
def download_bank_account_import_template(_: User = Depends(get_current_user)):
    return build_template_response("mau_import_tai_khoan_ngan_hang.xlsx", BANK_ACCOUNT_IMPORT_FIELDS)


@router.post("/import")
async def import_bank_accounts(
    commit: bool = Query(default=False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("KE_TOAN", "GIAM_DOC", "ADMIN")),
):
    return await import_excel(db=db, file=file, model=BankAccount, fields=BANK_ACCOUNT_IMPORT_FIELDS, key_field="ma_tk", commit=commit)


@router.get("", response_model=list[BankAccountResponse])
def list_bank_accounts(
    search: str | None = Query(None),
    trang_thai: bool | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(BankAccount)
    if search:
        like = f"%{search}%"
        q = q.filter(
            BankAccount.ten_ngan_hang.ilike(like)
            | BankAccount.so_tai_khoan.ilike(like)
            | BankAccount.ma_tk.ilike(like)
        )
    if trang_thai is not None:
        q = q.filter(BankAccount.trang_thai == trang_thai)
    return q.order_by(BankAccount.ten_ngan_hang).all()


@router.post("", response_model=BankAccountResponse, status_code=201)
def create_bank_account(
    data: BankAccountCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*KE_TOAN)),
):
    if db.query(BankAccount).filter(BankAccount.ma_tk == data.ma_tk).first():
        raise HTTPException(400, f"Mã tài khoản '{data.ma_tk}' đã tồn tại")
    obj = BankAccount(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/{account_id}", response_model=BankAccountResponse)
def get_bank_account(
    account_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.get(BankAccount, account_id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy tài khoản ngân hàng")
    return obj


@router.put("/{account_id}", response_model=BankAccountResponse)
def update_bank_account(
    account_id: int,
    data: BankAccountUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*KE_TOAN)),
):
    obj = db.get(BankAccount, account_id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy tài khoản ngân hàng")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj
