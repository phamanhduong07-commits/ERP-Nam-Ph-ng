from datetime import date
from decimal import Decimal
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.accounting import HoaDonDienTu
import app.services.misa_invoice_service as misa_svc

router = APIRouter(prefix="/api/hoa-don-dien-tu", tags=["Hóa đơn điện tử"])


class HoaDonDienTuCreate(BaseModel):
    ngay_lap: date
    loai_hd: str = "1"
    ten_khach_hang: str
    tong_tien_hang: Decimal
    tong_cong: Decimal
    tien_thue_gtgt: Decimal = Decimal("0")
    customer_id: Optional[int] = None
    sales_order_id: Optional[int] = None
    sales_invoice_id: Optional[int] = None
    ky_hieu: Optional[str] = None
    mau_so: Optional[str] = None
    ma_so_thue_kh: Optional[str] = None
    dia_chi_kh: Optional[str] = None
    items: Optional[list[Any]] = None
    phap_nhan_id: Optional[int] = None
    ghi_chu: Optional[str] = None


class HoaDonDienTuUpdate(BaseModel):
    ngay_lap: Optional[date] = None
    loai_hd: Optional[str] = None
    ten_khach_hang: Optional[str] = None
    tong_tien_hang: Optional[Decimal] = None
    tong_cong: Optional[Decimal] = None
    tien_thue_gtgt: Optional[Decimal] = None
    customer_id: Optional[int] = None
    sales_order_id: Optional[int] = None
    sales_invoice_id: Optional[int] = None
    ky_hieu: Optional[str] = None
    mau_so: Optional[str] = None
    ma_so_thue_kh: Optional[str] = None
    dia_chi_kh: Optional[str] = None
    items: Optional[list[Any]] = None
    phap_nhan_id: Optional[int] = None
    ghi_chu: Optional[str] = None


def _serialize(hdt: HoaDonDienTu) -> dict:
    return {
        "id": hdt.id,
        "so_hoa_don": hdt.so_hoa_don,
        "ky_hieu": hdt.ky_hieu,
        "mau_so": hdt.mau_so,
        "ngay_lap": hdt.ngay_lap.isoformat() if hdt.ngay_lap else None,
        "loai_hd": hdt.loai_hd,
        "sales_order_id": hdt.sales_order_id,
        "sales_invoice_id": hdt.sales_invoice_id,
        "customer_id": hdt.customer_id,
        "ten_khach_hang": hdt.ten_khach_hang,
        "ma_so_thue_kh": hdt.ma_so_thue_kh,
        "dia_chi_kh": hdt.dia_chi_kh,
        "tong_tien_hang": float(hdt.tong_tien_hang) if hdt.tong_tien_hang else 0,
        "tien_thue_gtgt": float(hdt.tien_thue_gtgt) if hdt.tien_thue_gtgt else 0,
        "tong_cong": float(hdt.tong_cong) if hdt.tong_cong else 0,
        "trang_thai": hdt.trang_thai,
        "misa_id": hdt.misa_id,
        "ma_cqt": hdt.ma_cqt,
        "xml_url": hdt.xml_url,
        "pdf_url": hdt.pdf_url,
        "ly_do_huy": hdt.ly_do_huy,
        "items": hdt.items or [],
        "phap_nhan_id": hdt.phap_nhan_id,
        "ghi_chu": hdt.ghi_chu,
        "created_by": hdt.created_by,
        "created_at": hdt.created_at.isoformat() if hdt.created_at else None,
    }


@router.get("", response_model=List[dict])
def list_hdt(
    trang_thai: Optional[str] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    phap_nhan_id: Optional[int] = Query(None),
    sales_invoice_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(HoaDonDienTu)
    if trang_thai:
        q = q.filter(HoaDonDienTu.trang_thai == trang_thai)
    if tu_ngay:
        q = q.filter(HoaDonDienTu.ngay_lap >= tu_ngay)
    if den_ngay:
        q = q.filter(HoaDonDienTu.ngay_lap <= den_ngay)
    if phap_nhan_id:
        q = q.filter(HoaDonDienTu.phap_nhan_id == phap_nhan_id)
    if sales_invoice_id:
        q = q.filter(HoaDonDienTu.sales_invoice_id == sales_invoice_id)
    return [_serialize(h) for h in q.order_by(HoaDonDienTu.ngay_lap.desc()).all()]


@router.get("/{id}", response_model=dict)
def get_hdt(id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    hdt = db.get(HoaDonDienTu, id)
    if not hdt:
        raise HTTPException(404, "Hóa đơn không tồn tại")
    return _serialize(hdt)


@router.post("", response_model=dict, status_code=201)
def create_hdt(body: HoaDonDienTuCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    hdt = HoaDonDienTu(**body.model_dump())
    hdt.created_by = user.id
    hdt.trang_thai = "nhap"
    db.add(hdt)
    db.commit()
    db.refresh(hdt)
    return _serialize(hdt)


@router.put("/{id}", response_model=dict)
def update_hdt(id: int, body: HoaDonDienTuUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    hdt = db.get(HoaDonDienTu, id)
    if not hdt:
        raise HTTPException(404, "Hóa đơn không tồn tại")
    if hdt.trang_thai != "nhap":
        raise HTTPException(400, "Chỉ có thể sửa hóa đơn ở trạng thái Nháp")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(hdt, k, v)
    db.commit()
    db.refresh(hdt)
    return _serialize(hdt)


@router.delete("/{id}")
def delete_hdt(id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    hdt = db.get(HoaDonDienTu, id)
    if not hdt:
        raise HTTPException(404, "Hóa đơn không tồn tại")
    if hdt.trang_thai != "nhap":
        raise HTTPException(400, "Chỉ xóa được hóa đơn Nháp")
    db.delete(hdt)
    db.commit()
    return {"ok": True}


@router.post("/{id}/phat-hanh", response_model=dict)
def phat_hanh(id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Gửi HĐ lên MISA để ký số và phát hành."""
    hdt = db.get(HoaDonDienTu, id)
    if not hdt:
        raise HTTPException(404, "Hóa đơn không tồn tại")
    if hdt.trang_thai not in ("nhap", "cho_ky"):
        raise HTTPException(400, f"Không thể phát hành HĐ ở trạng thái {hdt.trang_thai}")

    try:
        # Bước 1: tạo HĐ trên MISA nếu chưa có misa_id
        if not hdt.misa_id:
            payload = misa_svc.build_misa_payload(hdt)
            result = misa_svc.create_invoice(payload)
            hdt.misa_id = result.get("Data", {}).get("InvoiceId") or result.get("misa_id")
            hdt.trang_thai = "cho_ky"
            db.commit()

        # Bước 2: ký số phát hành
        result2 = misa_svc.publish_invoice(hdt.misa_id)
        data2 = result2.get("Data", result2)
        hdt.so_hoa_don = data2.get("InvoiceNumber") or data2.get("so_hoa_don")
        hdt.ky_hieu = data2.get("Serial") or data2.get("ky_hieu")
        hdt.mau_so = data2.get("TemplateCode") or data2.get("mau_so")
        hdt.ma_cqt = data2.get("CQTCode") or data2.get("ma_cqt")
        hdt.pdf_url = data2.get("PdfUrl") or data2.get("pdf_url")
        hdt.xml_url = data2.get("XmlUrl") or data2.get("xml_url")
        hdt.trang_thai = "da_phat_hanh"
        db.commit()
    except Exception as e:
        raise HTTPException(502, f"MISA API lỗi: {e}")

    # Ghi nhận doanh thu vào sổ kế toán sau khi phát hành thành công
    try:
        from app.services.accounting_service import AccountingService
        svc = AccountingService(db)
        tong_tien_hang = float(hdt.tong_tien_hang or 0)
        tong_cong = float(hdt.tong_cong or 0)
        tien_thue = float(hdt.tien_thue_gtgt or 0)
        lines = [
            {"so_tk": "131", "dien_giai": f"Phải thu KH {hdt.ten_khach_hang}", "so_tien_no": tong_cong, "so_tien_co": 0},
            {"so_tk": "5111", "dien_giai": f"Doanh thu HĐDT {hdt.so_hoa_don or hdt.id}", "so_tien_no": 0, "so_tien_co": tong_tien_hang},
        ]
        if tien_thue > 0:
            lines.append({"so_tk": "3331", "dien_giai": f"Thuế GTGT HĐDT {hdt.so_hoa_don or hdt.id}", "so_tien_no": 0, "so_tien_co": tien_thue})
        svc._create_journal_entry(
            ngay=hdt.ngay_lap,
            dien_giai=f"Hóa đơn điện tử {hdt.so_hoa_don or hdt.id} — {hdt.ten_khach_hang}",
            loai_but_toan="hoa_don_dien_tu",
            chung_tu_loai="hoa_don_dien_tu",
            chung_tu_id=hdt.id,
            lines=lines,
            phap_nhan_id=hdt.phap_nhan_id,
        )
    except Exception as je:
        import logging as _log
        _log.getLogger("erp").warning("HĐDT %s journal sync failed: %s", hdt.id, je)

    db.refresh(hdt)
    return _serialize(hdt)


@router.post("/{id}/huy", response_model=dict)
def huy_hdt(
    id: int,
    body: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Hủy hóa đơn đã phát hành — cần ly_do."""
    hdt = db.get(HoaDonDienTu, id)
    if not hdt:
        raise HTTPException(404, "Hóa đơn không tồn tại")
    if hdt.trang_thai != "da_phat_hanh":
        raise HTTPException(400, "Chỉ hủy được HĐ đã phát hành")
    ly_do = body.get("ly_do", "").strip()
    if not ly_do:
        raise HTTPException(400, "Cần cung cấp lý do hủy")

    try:
        if hdt.misa_id:
            misa_svc.cancel_invoice(hdt.misa_id, ly_do)
    except Exception as e:
        raise HTTPException(502, f"MISA API lỗi khi hủy: {e}")

    hdt.trang_thai = "huy"
    hdt.ly_do_huy = ly_do
    db.commit()
    db.refresh(hdt)
    return _serialize(hdt)


@router.post("/{id}/sync-status", response_model=dict)
def sync_status(id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Đồng bộ trạng thái từ MISA."""
    hdt = db.get(HoaDonDienTu, id)
    if not hdt:
        raise HTTPException(404, "Hóa đơn không tồn tại")
    if not hdt.misa_id:
        raise HTTPException(400, "HĐ chưa gửi MISA")
    try:
        result = misa_svc.get_invoice_status(hdt.misa_id)
        data = result.get("Data", result)
        if data.get("InvoiceNumber"):
            hdt.so_hoa_don = data["InvoiceNumber"]
        if data.get("PdfUrl"):
            hdt.pdf_url = data["PdfUrl"]
        db.commit()
    except Exception as e:
        raise HTTPException(502, f"MISA sync lỗi: {e}")
    db.refresh(hdt)
    return _serialize(hdt)
