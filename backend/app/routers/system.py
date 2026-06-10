from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.system import PrintTemplate, SystemSetting, ExcelTemplate
from app.models.auth import User

_SALES_TEMPLATE_CODES = frozenset({
    "sales_order", "sales_invoice", "sales_quote",
    "sales_order_detail", "sales_quote_list", "delivery_order",
})


def _assert_template_write(ma_mau: str, user) -> None:
    role_code = user.role.ma_vai_tro if user.role else None
    if role_code == "ADMIN":
        return
    if role_code == "TRUONG_PHONG_SALE_ADMIN" and ma_mau.lower() in _SALES_TEMPLATE_CODES:
        return
    raise HTTPException(
        status_code=403,
        detail="Bạn không có quyền chỉnh sửa mẫu in này",
    )

router = APIRouter(prefix="/api/system", tags=["system"])


class PrintTemplateIn(BaseModel):
    ma_mau: str
    ten_mau: str
    html_content: str
    phap_nhan_id: Optional[int] = None
    css_content: Optional[str] = None
    variables_meta: Optional[dict] = None


class ExcelTemplateIn(BaseModel):
    ma_mau: str
    ten_mau: str
    phap_nhan_id: Optional[int] = None
    column_config: List[dict]
    header_config: Optional[List[dict]] = None
    footer_config: Optional[dict] = None
    style_config: Optional[dict] = None


class SystemSettingIn(BaseModel):
    key: str
    value: str
    description: Optional[str] = None


@router.get("/templates", response_model=List[PrintTemplateIn])
def list_templates(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(PrintTemplate).all()


@router.get("/templates/{ma_mau}")
def get_template(ma_mau: str, phap_nhan_id: Optional[int] = None, strict: bool = False, db: Session = Depends(
        get_db), _: User = Depends(get_current_user)):
    key = ma_mau.lower()
    query = db.query(PrintTemplate).filter(func.lower(PrintTemplate.ma_mau) == key)

    if phap_nhan_id:
        tpl = query.filter(PrintTemplate.phap_nhan_id == phap_nhan_id).first()
        if tpl:
            return tpl
        if strict:
            raise HTTPException(404, f"Khong tim thay mau in {key} cho phap nhan ID {phap_nhan_id}")
        tpl = query.first()
    else:
        tpl = query.filter(PrintTemplate.phap_nhan_id.is_(None)).first()
        if not tpl:
            tpl = query.first()

    if not tpl:
        if strict:
            raise HTTPException(404, f"Khong tim thay mau in {key}")
        raise HTTPException(404, "Không tìm thấy mẫu in")
    return tpl


@router.put("/templates/{ma_mau}")
def update_template(
    ma_mau: str,
    body: PrintTemplateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    _assert_template_write(ma_mau, user)
    key = ma_mau.upper()  # normalize to uppercase to match how print endpoints query
    tpl = db.query(PrintTemplate).filter(
        func.upper(PrintTemplate.ma_mau) == key,
        PrintTemplate.phap_nhan_id == body.phap_nhan_id
    ).first()

    if not tpl:
        tpl = PrintTemplate(ma_mau=key, phap_nhan_id=body.phap_nhan_id)
        db.add(tpl)

    tpl.ten_mau = body.ten_mau
    tpl.html_content = body.html_content
    tpl.css_content = body.css_content
    tpl.variables_meta = body.variables_meta

    db.commit()
    return {"ok": True}


@router.delete("/templates/{ma_mau}")

def delete_template(
    ma_mau: str,
    phap_nhan_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN"))
):
    key = ma_mau.lower()
    tpl = db.query(PrintTemplate).filter(
        PrintTemplate.ma_mau == key,
        PrintTemplate.phap_nhan_id == phap_nhan_id
    ).first()
    if not tpl:
        raise HTTPException(404, "Không tìm thấy mẫu in")
    db.delete(tpl)
    db.commit()
    return {"ok": True}

# --- Excel Templates ---


@router.get("/excel-templates", response_model=List[ExcelTemplateIn])
def list_excel_templates(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(ExcelTemplate).all()


@router.get("/excel-templates/{ma_mau}")
def get_excel_template(ma_mau: str, phap_nhan_id: Optional[int] = None, strict: bool = False, db: Session = Depends(
        get_db), _: User = Depends(get_current_user)):
    key = ma_mau.lower()
    query = db.query(ExcelTemplate).filter(func.lower(ExcelTemplate.ma_mau) == key)

    if phap_nhan_id:
        tpl = query.filter(ExcelTemplate.phap_nhan_id == phap_nhan_id).first()
        if tpl:
            return tpl
        if strict:
            raise HTTPException(404, f"Khong tim thay mau Excel {key} cho phap nhan ID {phap_nhan_id}")
        tpl = query.first()
    else:
        tpl = query.filter(ExcelTemplate.phap_nhan_id.is_(None)).first()
        if not tpl:
            tpl = query.first()

    if not tpl:
        if strict:
            raise HTTPException(404, f"Khong tim thay mau Excel {ma_mau}")
        raise HTTPException(404, "Không tìm thấy mẫu Excel")
    return tpl


@router.put("/excel-templates/{ma_mau}")
def update_excel_template(
    ma_mau: str,
    body: ExcelTemplateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    _assert_template_write(ma_mau, user)
    key = ma_mau.lower()
    tpl = db.query(ExcelTemplate).filter(
        ExcelTemplate.ma_mau == key,
        ExcelTemplate.phap_nhan_id == body.phap_nhan_id
    ).first()

    if not tpl:
        tpl = ExcelTemplate(ma_mau=key, phap_nhan_id=body.phap_nhan_id)
        db.add(tpl)

    tpl.ten_mau = body.ten_mau
    tpl.column_config = body.column_config
    tpl.header_config = body.header_config
    tpl.footer_config = body.footer_config
    tpl.style_config = body.style_config

    db.commit()
    return {"ok": True}


@router.delete("/excel-templates/{ma_mau}")
def delete_excel_template(
    ma_mau: str,
    phap_nhan_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN"))
):
    key = ma_mau.lower()
    tpl = db.query(ExcelTemplate).filter(
        ExcelTemplate.ma_mau == key,
        ExcelTemplate.phap_nhan_id == phap_nhan_id
    ).first()
    if not tpl:
        raise HTTPException(404, "Không tìm thấy mẫu Excel")
    db.delete(tpl)
    db.commit()
    return {"ok": True}


@router.get("/settings")
def get_settings(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return {s.key: s.value for s in db.query(SystemSetting).all()}


@router.put("/settings")
def update_setting(
    body: SystemSettingIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN"))
):
    s = db.query(SystemSetting).filter(SystemSetting.key == body.key).first()
    if not s:
        s = SystemSetting(key=body.key)
        db.add(s)
    s.value = body.value
    s.description = body.description
    db.commit()
    return {"ok": True}
