from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.system import PrintTemplate, SystemSetting, ExcelTemplate
from app.models.auth import User

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

class SystemSettingIn(BaseModel):
    key: str
    value: str
    description: Optional[str] = None

@router.get("/templates", response_model=List[PrintTemplateIn])
def list_templates(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(PrintTemplate).all()

@router.get("/templates/{ma_mau}")
def get_template(ma_mau: str, phap_nhan_id: Optional[int] = None, strict: bool = False, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    # Tìm theo pháp nhân cụ thể trước
    query = db.query(PrintTemplate).filter(PrintTemplate.ma_mau == ma_mau)
    if phap_nhan_id:
        tpl = query.filter(PrintTemplate.phap_nhan_id == phap_nhan_id).first()
        if tpl: return tpl
        if strict:
            raise HTTPException(404, f"Khong tim thay mau in {ma_mau} cho phap nhan ID {phap_nhan_id}")
    
    # Nếu không thấy theo pháp nhân, tìm cái mặc định (NULL)
    tpl = query.filter(PrintTemplate.phap_nhan_id == None).first()
    if strict:
        if not tpl:
            raise HTTPException(404, f"Khong tim thay mau in {ma_mau}")
        return tpl
    if not tpl:
        # Nếu vẫn không thấy, lấy cái đầu tiên có cùng mã
        tpl = query.first()
        
    if not tpl:
        raise HTTPException(404, "Không tìm thấy mẫu in")
    return tpl

@router.put("/templates/{ma_mau}")
def update_template(
    ma_mau: str, 
    body: PrintTemplateIn, 
    db: Session = Depends(get_db), 
    _: User = Depends(require_roles("ADMIN"))
):
    # Tìm đúng mẫu của pháp nhân này
    tpl = db.query(PrintTemplate).filter(
        PrintTemplate.ma_mau == ma_mau,
        PrintTemplate.phap_nhan_id == body.phap_nhan_id
    ).first()
    
    if not tpl:
        tpl = PrintTemplate(ma_mau=ma_mau, phap_nhan_id=body.phap_nhan_id)
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
    tpl = db.query(PrintTemplate).filter(
        PrintTemplate.ma_mau == ma_mau,
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
def get_excel_template(ma_mau: str, phap_nhan_id: Optional[int] = None, strict: bool = False, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    query = db.query(ExcelTemplate).filter(ExcelTemplate.ma_mau == ma_mau)
    if phap_nhan_id:
        tpl = query.filter(ExcelTemplate.phap_nhan_id == phap_nhan_id).first()
        if tpl: return tpl
        if strict:
            raise HTTPException(404, f"Khong tim thay mau Excel {ma_mau} cho phap nhan ID {phap_nhan_id}")
    
    tpl = query.filter(ExcelTemplate.phap_nhan_id == None).first()
    if strict:
        if not tpl:
            raise HTTPException(404, f"Khong tim thay mau Excel {ma_mau}")
        return tpl
    if not tpl:
        tpl = query.first()
    if not tpl:
        raise HTTPException(404, "Không tìm thấy mẫu Excel")
    return tpl

@router.put("/excel-templates/{ma_mau}")
def update_excel_template(
    ma_mau: str, 
    body: ExcelTemplateIn, 
    db: Session = Depends(get_db), 
    _: User = Depends(require_roles("ADMIN"))
):
    tpl = db.query(ExcelTemplate).filter(
        ExcelTemplate.ma_mau == ma_mau,
        ExcelTemplate.phap_nhan_id == body.phap_nhan_id
    ).first()
    
    if not tpl:
        tpl = ExcelTemplate(ma_mau=ma_mau, phap_nhan_id=body.phap_nhan_id)
        db.add(tpl)
    
    tpl.ten_mau = body.ten_mau
    tpl.column_config = body.column_config
    
    db.commit()
    return {"ok": True}

@router.delete("/excel-templates/{ma_mau}")
def delete_excel_template(
    ma_mau: str,
    phap_nhan_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN"))
):
    tpl = db.query(ExcelTemplate).filter(
        ExcelTemplate.ma_mau == ma_mau,
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
