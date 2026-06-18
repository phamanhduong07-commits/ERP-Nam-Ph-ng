import difflib
import email
from email.header import decode_header
import imaplib
import json
import logging
from datetime import date, datetime, timezone
from typing import Any, List, Optional
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import Supplier, PaperMaterial, OtherMaterial, PhapNhan, Warehouse, PhanXuong
from app.models.accounting import IncomingInvoice, IncomingInvoiceMappingRule, PurchaseInvoice, DebtLedgerEntry
from app.models.warehouse_doc import GoodsReceipt, GoodsReceiptItem
from app.services.xml_invoice_parser import parse_xml_invoice
from app.services.accounting_service import AccountingService
from app.config import settings

logger = logging.getLogger("erp")
router = APIRouter(prefix="/api/incoming-invoices", tags=["Hóa đơn đầu vào"])


# Pydantic schemas
class IncomingInvoiceItemMapping(BaseModel):
    stt: int
    material_type: str  # "paper" | "other"
    material_id: int


class ProcessIncomingInvoicePayload(BaseModel):
    phap_nhan_id: int
    supplier_id: int
    warehouse_id: Optional[int] = None
    create_goods_receipt: bool = True
    items_mapping: List[IncomingInvoiceItemMapping]


# Helper logic for email IMAP scanning
def scan_emails_for_invoices(db: Session) -> int:
    """
    Quét hòm thư email qua IMAP, bóc tách các file đính kèm XML hóa đơn
    và lưu vào bảng incoming_invoices ở trạng thái chờ xử lý.
    """
    if not settings.EMAIL_IMAP_SERVER or not settings.EMAIL_IMAP_USER or not settings.EMAIL_IMAP_PASSWORD:
        logger.info("IMAP Email configuration is incomplete. Skipping background email scan.")
        return 0

    count = 0
    mail = None
    try:
        # Kết nối tới IMAP server
        mail = imaplib.IMAP4_SSL(settings.EMAIL_IMAP_SERVER, settings.EMAIL_IMAP_PORT)
        mail.login(settings.EMAIL_IMAP_USER, settings.EMAIL_IMAP_PASSWORD)
        mail.select("inbox")

        # Tìm các email chưa đọc
        status, messages = mail.search(None, 'UNSEEN')
        if status != 'OK' or not messages[0]:
            return 0

        for msg_num in messages[0].split():
            try:
                # Tải nội dung email
                status, msg_data = mail.fetch(msg_num, '(RFC822)')
                if status != 'OK':
                    continue

                raw_email = msg_data[0][1]
                msg = email.message_from_bytes(raw_email)

                # Duyệt các phần của email để tìm file đính kèm XML
                for part in msg.walk():
                    if part.get_content_maintype() == 'multipart':
                        continue
                    if part.get('Content-Disposition') is None:
                        continue

                    filename, encoding = decode_header(part.get_filename() or "")[0]
                    if isinstance(filename, bytes):
                        filename = filename.decode(encoding or "utf-8")

                    if filename and filename.lower().endswith('.xml'):
                        xml_data = part.get_payload(decode=True)
                        if not xml_data:
                            continue

                        # Thử decode với utf-8-sig (để loại bỏ BOM nếu có) hoặc utf-8
                        try:
                            xml_str = xml_data.decode("utf-8-sig")
                        except UnicodeDecodeError:
                            xml_str = xml_data.decode("utf-8", errors="ignore")

                        # Parse XML hóa đơn
                        parsed_data = parse_xml_invoice(xml_str)
                        if parsed_data:
                            # Đảm bảo hóa đơn này chưa được lưu trước đó
                            existing = db.query(IncomingInvoice).filter(
                                IncomingInvoice.so_hoa_don == parsed_data["so_hoa_don"],
                                IncomingInvoice.ky_hieu == parsed_data["ky_hieu"],
                                IncomingInvoice.supplier_tax_code == parsed_data["supplier_tax_code"],
                                IncomingInvoice.trang_thai != "huy"
                            ).first()

                            if not existing:
                                invoice = IncomingInvoice(
                                    so_hoa_don=parsed_data["so_hoa_don"],
                                    mau_so=parsed_data["mau_so"],
                                    ky_hieu=parsed_data["ky_hieu"],
                                    ngay_hoa_don=parsed_data["ngay_hoa_don"],
                                    supplier_tax_code=parsed_data["supplier_tax_code"],
                                    supplier_name=parsed_data["supplier_name"],
                                    buyer_tax_code=parsed_data["buyer_tax_code"],
                                    buyer_name=parsed_data["buyer_name"],
                                    tong_tien_hang=parsed_data["tong_tien_hang"],
                                    tien_thue=parsed_data["tien_thue"],
                                    tong_thanh_toan=parsed_data["tong_thanh_toan"],
                                    xml_content=xml_str,
                                    items=parsed_data["items"],
                                    trang_thai="cho_xu_ly",
                                )
                                db.add(invoice)
                                count += 1

                # Đánh dấu email đã đọc sau khi xử lý xong các đính kèm
                mail.store(msg_num, '+FLAGS', '\\Seen')

            except Exception as msg_err:
                logger.error("Lỗi khi xử lý email số %s: %s", msg_num, msg_err, exc_info=True)

        if count > 0:
            db.commit()
            logger.info("Đã quét và tải thành công %s hóa đơn đầu vào từ email.", count)

    except Exception as imap_err:
        logger.error("Lỗi kết nối IMAP Email: %s", imap_err, exc_info=True)
    finally:
        if mail:
            try:
                mail.close()
                mail.logout()
            except Exception:
                pass

    return count


@router.get("")
def list_incoming_invoices(
    trang_thai: Optional[str] = Query(None),
    supplier_tax_code: Optional[str] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(IncomingInvoice)
    if trang_thai:
        q = q.filter(IncomingInvoice.trang_thai == trang_thai)
    if supplier_tax_code:
        q = q.filter(IncomingInvoice.supplier_tax_code == supplier_tax_code)
    if tu_ngay:
        q = q.filter(IncomingInvoice.ngay_hoa_don >= tu_ngay)
    if den_ngay:
        q = q.filter(IncomingInvoice.ngay_hoa_don <= den_ngay)

    total = q.count()
    rows = (
        q.order_by(IncomingInvoice.ngay_hoa_don.desc(), IncomingInvoice.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = []
    for r in rows:
        # Check if mapped Supplier exists
        internal_supplier = None
        if r.supplier_tax_code:
            internal_supplier = db.query(Supplier).filter(Supplier.ma_so_thue == r.supplier_tax_code, Supplier.trang_thai == True).first()

        # Check if mapped PhapNhan exists
        internal_phap_nhan = None
        if r.buyer_tax_code:
            internal_phap_nhan = db.query(PhapNhan).filter(PhapNhan.ma_so_thue == r.buyer_tax_code, PhapNhan.trang_thai == True).first()

        items.append({
            "id": r.id,
            "so_hoa_don": r.so_hoa_don,
            "mau_so": r.mau_so,
            "ky_hieu": r.ky_hieu,
            "ngay_hoa_don": r.ngay_hoa_don.isoformat() if r.ngay_hoa_don else None,
            "supplier_tax_code": r.supplier_tax_code,
            "supplier_name": r.supplier_name,
            "buyer_tax_code": r.buyer_tax_code,
            "buyer_name": r.buyer_name,
            "tong_tien_hang": float(r.tong_tien_hang or 0),
            "tien_thue": float(r.tien_thue or 0),
            "tong_thanh_toan": float(r.tong_thanh_toan or 0),
            "trang_thai": r.trang_thai,
            "purchase_invoice_id": r.purchase_invoice_id,
            "goods_receipt_id": r.goods_receipt_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "internal_supplier_id": internal_supplier.id if internal_supplier else None,
            "internal_supplier_name": (internal_supplier.ten_viet_tat or internal_supplier.ten_don_vi) if internal_supplier else None,
            "internal_phap_nhan_id": internal_phap_nhan.id if internal_phap_nhan else None,
            "internal_phap_nhan_name": internal_phap_nhan.ten_phap_nhan if internal_phap_nhan else None,
        })

    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.get("/suggestions")
def get_material_suggestions(
    q: str = Query(..., min_length=2),
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Gợi ý tìm kiếm mờ (Fuzzy matching) mã vật tư dựa trên tên mặt hàng đầu vào."""
    query_str = q.strip().lower()
    
    # Lấy danh sách các vật tư hoạt động
    papers = db.query(PaperMaterial).filter(PaperMaterial.su_dung == True).all()
    others = db.query(OtherMaterial).filter(OtherMaterial.trang_thai == True).all()
    
    suggestions = []
    
    # So khớp với danh mục giấy cuộn (PaperMaterial)
    for p in papers:
        score_ten = difflib.SequenceMatcher(None, query_str, p.ten.lower()).ratio()
        score_code = difflib.SequenceMatcher(None, query_str, p.ma_chinh.lower()).ratio()
        score = max(score_ten, score_code)
        if score > 0.15:
            suggestions.append({
                "material_type": "paper",
                "id": p.id,
                "ma_chinh": p.ma_chinh,
                "ten": p.ten,
                "dvt": p.dvt,
                "loai_giay": p.loai_giay,
                "dinh_luong": float(p.dinh_luong or 0),
                "score": score
            })

    # So khớp với danh mục nguyên vật liệu khác (OtherMaterial)
    for o in others:
        score_ten = difflib.SequenceMatcher(None, query_str, o.ten.lower()).ratio()
        score_code = difflib.SequenceMatcher(None, query_str, o.ma_chinh.lower()).ratio()
        score = max(score_ten, score_code)
        if score > 0.15:
            suggestions.append({
                "material_type": "other",
                "id": o.id,
                "ma_chinh": o.ma_chinh,
                "ten": o.ten,
                "dvt": o.dvt,
                "score": score
            })

    # Sắp xếp kết quả gợi ý theo score giảm dần
    suggestions.sort(key=lambda x: x["score"], reverse=True)
    return suggestions[:limit]


@router.get("/{id}")
def get_incoming_invoice(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    inv = db.get(IncomingInvoice, id)
    if not inv:
        raise HTTPException(404, "Hóa đơn đầu vào không tồn tại")

    # Tải các luật mapping rules trước đó cho nhà cung cấp này
    rules_map = {}
    if inv.supplier_tax_code:
        rules = db.query(IncomingInvoiceMappingRule).filter(
            IncomingInvoiceMappingRule.supplier_tax_code == inv.supplier_tax_code
        ).all()
        for r in rules:
            rules_map[r.supplier_item_name.strip().lower()] = {
                "paper_material_id": r.paper_material_id,
                "other_material_id": r.other_material_id,
            }

    # Bổ sung thông tin mapping hiện tại vào danh sách items
    enriched_items = []
    for it in (inv.items or []):
        it_copy = dict(it)
        name_key = it_copy.get("ten_hang", "").strip().lower()
        rule = rules_map.get(name_key)
        
        it_copy["mapped_material"] = None
        if rule:
            if rule["paper_material_id"]:
                pm = db.get(PaperMaterial, rule["paper_material_id"])
                if pm:
                    it_copy["mapped_material"] = {
                        "material_type": "paper",
                        "id": pm.id,
                        "ma_chinh": pm.ma_chinh,
                        "ten": pm.ten,
                        "dvt": pm.dvt
                    }
            elif rule["other_material_id"]:
                om = db.get(OtherMaterial, rule["other_material_id"])
                if om:
                    it_copy["mapped_material"] = {
                        "material_type": "other",
                        "id": om.id,
                        "ma_chinh": om.ma_chinh,
                        "ten": om.ten,
                        "dvt": om.dvt
                    }
        enriched_items.append(it_copy)

    # Khớp nhanh Supplier nội bộ
    internal_supplier = None
    if inv.supplier_tax_code:
        internal_supplier = db.query(Supplier).filter(Supplier.ma_so_thue == inv.supplier_tax_code, Supplier.trang_thai == True).first()

    # Khớp nhanh PhapNhan nội bộ
    internal_phap_nhan = None
    if inv.buyer_tax_code:
        internal_phap_nhan = db.query(PhapNhan).filter(PhapNhan.ma_so_thue == inv.buyer_tax_code, PhapNhan.trang_thai == True).first()

    return {
        "id": inv.id,
        "so_hoa_don": inv.so_hoa_don,
        "mau_so": inv.mau_so,
        "ky_hieu": inv.ky_hieu,
        "ngay_hoa_don": inv.ngay_hoa_don.isoformat() if inv.ngay_hoa_don else None,
        "supplier_tax_code": inv.supplier_tax_code,
        "supplier_name": inv.supplier_name,
        "buyer_tax_code": inv.buyer_tax_code,
        "buyer_name": inv.buyer_name,
        "tong_tien_hang": float(inv.tong_tien_hang or 0),
        "tien_thue": float(inv.tien_thue or 0),
        "tong_thanh_toan": float(inv.tong_thanh_toan or 0),
        "trang_thai": inv.trang_thai,
        "items": enriched_items,
        "xml_content": inv.xml_content,
        "purchase_invoice_id": inv.purchase_invoice_id,
        "goods_receipt_id": inv.goods_receipt_id,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
        "internal_supplier_id": internal_supplier.id if internal_supplier else None,
        "internal_supplier_name": (internal_supplier.ten_viet_tat or internal_supplier.ten_don_vi) if internal_supplier else None,
        "internal_phap_nhan_id": internal_phap_nhan.id if internal_phap_nhan else None,
        "internal_phap_nhan_name": internal_phap_nhan.ten_phap_nhan if internal_phap_nhan else None,
    }


@router.post("/upload", status_code=201)
async def upload_xml_invoice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not file.filename.lower().endswith('.xml'):
        raise HTTPException(400, "Chỉ chấp nhận file đính kèm dạng XML")

    content = await file.read()
    try:
        xml_str = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        xml_str = content.decode("utf-8", errors="ignore")

    parsed = parse_xml_invoice(xml_str)
    if not parsed:
        raise HTTPException(400, "Đọc file XML hóa đơn thất bại hoặc sai cấu trúc chuẩn")

    # Tránh trùng lặp hóa đơn trùng lặp
    existing = db.query(IncomingInvoice).filter(
        IncomingInvoice.so_hoa_don == parsed["so_hoa_don"],
        IncomingInvoice.ky_hieu == parsed["ky_hieu"],
        IncomingInvoice.supplier_tax_code == parsed["supplier_tax_code"],
        IncomingInvoice.trang_thai != "huy"
    ).first()

    if existing:
        return {"detail": "Hóa đơn này đã được tải lên trước đó", "id": existing.id}

    invoice = IncomingInvoice(
        so_hoa_don=parsed["so_hoa_don"],
        mau_so=parsed["mau_so"],
        ky_hieu=parsed["ky_hieu"],
        ngay_hoa_don=parsed["ngay_hoa_don"],
        supplier_tax_code=parsed["supplier_tax_code"],
        supplier_name=parsed["supplier_name"],
        buyer_tax_code=parsed["buyer_tax_code"],
        buyer_name=parsed["buyer_name"],
        tong_tien_hang=parsed["tong_tien_hang"],
        tien_thue=parsed["tien_thue"],
        tong_thanh_toan=parsed["tong_thanh_toan"],
        xml_content=xml_str,
        items=parsed["items"],
        trang_thai="cho_xu_ly",
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return {"id": invoice.id, "so_hoa_don": invoice.so_hoa_don, "detail": "Tải lên hóa đơn thành công"}


@router.post("/sync-email")
def manual_email_sync(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Kích hoạt quét hòm thư email thủ công để tải hóa đơn."""
    count = scan_emails_for_invoices(db)
    return {"status": "success", "count": count, "detail": f"Đã đồng bộ thành công {count} hóa đơn đầu vào mới từ email."}


@router.post("/{id}/ignore")
def ignore_incoming_invoice(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    inv = db.get(IncomingInvoice, id)
    if not inv:
        raise HTTPException(404, "Hóa đơn đầu vào không tồn tại")
    if inv.trang_thai != "cho_xu_ly":
        raise HTTPException(400, f"Hóa đơn đang ở trạng thái '{inv.trang_thai}', không thể bỏ qua")

    inv.trang_thai = "bo_qua"
    db.commit()
    return {"status": "success", "detail": f"Đã bỏ qua hóa đơn số {inv.so_hoa_don}"}


@router.post("/{id}/process")
def process_incoming_invoice(
    id: int,
    payload: ProcessIncomingInvoicePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Xác nhận liên kết vật tư, lưu luật ánh xạ và tự động tạo chứng từ:
    - Lưu luật ánh xạ vào incoming_invoice_mapping_rules.
    - Tạo GoodsReceipt nháp (nếu create_goods_receipt = True).
    - Tạo PurchaseInvoice nháp tự động từ GoodsReceipt (hoặc trực tiếp nếu không tạo GR).
    """
    inv = db.get(IncomingInvoice, id)
    if not inv:
        raise HTTPException(404, "Hóa đơn đầu vào không tồn tại")
    if inv.trang_thai != "cho_xu_ly":
        raise HTTPException(400, "Hóa đơn này đã được xử lý hoặc bỏ qua")

    # 1. Lưu các quy tắc mapping rule mới phục vụ cho các lần khớp sau
    for mapping in payload.items_mapping:
        # Tìm item tương ứng trong XML bằng STT
        xml_item = next((it for it in (inv.items or []) if it.get("stt") == mapping.stt), None)
        if not xml_item:
            continue

        item_name = xml_item.get("ten_hang", "").strip()
        if not item_name or not inv.supplier_tax_code:
            continue

        # Tìm luật ánh xạ cũ hoặc tạo mới
        rule = db.query(IncomingInvoiceMappingRule).filter(
            IncomingInvoiceMappingRule.supplier_tax_code == inv.supplier_tax_code,
            IncomingInvoiceMappingRule.supplier_item_name == item_name
        ).first()

        paper_id = mapping.material_id if mapping.material_type == "paper" else None
        other_id = mapping.material_id if mapping.material_type == "other" else None

        if rule:
            rule.paper_material_id = paper_id
            rule.other_material_id = other_id
        else:
            rule = IncomingInvoiceMappingRule(
                supplier_tax_code=inv.supplier_tax_code,
                supplier_item_name=item_name,
                paper_material_id=paper_id,
                other_material_id=other_id
            )
            db.add(rule)

    db.flush()

    # 2. Xử lý tạo Goods Receipt (Phiếu nhập kho nháp)
    goods_receipt_id = None
    if payload.create_goods_receipt:
        if not payload.warehouse_id:
            raise HTTPException(400, "Cần chọn kho nhập để tạo Phiếu nhập kho")
        
        wh = db.get(Warehouse, payload.warehouse_id)
        if not wh:
            raise HTTPException(404, "Kho nhập không tồn tại")

        # Sinh mã phiếu nhập kho
        from app.routers.warehouse import _gen_so
        gr_so_phieu = _gen_so(db, "GR", GoodsReceipt)

        gr = GoodsReceipt(
            so_phieu=gr_so_phieu,
            ngay_nhap=inv.ngay_hoa_don or date.today(),
            supplier_id=payload.supplier_id,
            warehouse_id=payload.warehouse_id,
            phan_xuong_id=wh.phan_xuong_id,
            loai_nhap="MUA_HANG",
            phap_nhan_id=payload.phap_nhan_id,
            trang_thai="nhap",  # Tạo ở dạng Nháp
            ghi_chu=f"Tạo tự động từ Hóa đơn XML số {inv.so_hoa_don}",
            created_by=current_user.id,
            tong_gia_tri=Decimal(str(inv.tong_tien_hang or 0)),
        )
        db.add(gr)
        db.flush()

        # Tạo các dòng chi tiết hàng nhập
        for mapping in payload.items_mapping:
            xml_item = next((it for it in (inv.items or []) if it.get("stt") == mapping.stt), None)
            if not xml_item:
                continue

            paper_id = mapping.material_id if mapping.material_type == "paper" else None
            other_id = mapping.material_id if mapping.material_type == "other" else None
            
            dvt = xml_item.get("dvt", "Kg")
            so_luong = Decimal(str(xml_item.get("so_luong", 0)))
            don_gia = Decimal(str(xml_item.get("don_gia", 0)))
            thanh_tien = Decimal(str(xml_item.get("thanh_tien", 0)))

            db.add(GoodsReceiptItem(
                receipt_id=gr.id,
                paper_material_id=paper_id,
                other_material_id=other_id,
                ten_hang=xml_item.get("ten_hang", ""),
                so_luong=so_luong,
                dvt=dvt,
                don_gia=don_gia,
                thanh_tien=thanh_tien,
            ))

        db.flush()
        goods_receipt_id = gr.id

    # 3. Tạo Purchase Invoice (Hóa đơn mua hàng nháp)
    # Lấy hoặc tính toán thuế suất trung bình
    vat_rate = Decimal("10")  # Default
    for it in (inv.items or []):
        ts_str = str(it.get("thue_suat", "10%")).replace("%", "")
        if ts_str.isdigit():
            vat_rate = Decimal(ts_str)
            break

    # Gọi hàm khởi tạo của AccountingService
    acct_svc = AccountingService(db)
    
    # Định nghĩa payload đầu vào cho create_purchase_invoice
    from app.schemas.accounting import PurchaseInvoiceCreate
    pi_data = PurchaseInvoiceCreate(
        supplier_id=payload.supplier_id,
        gr_id=goods_receipt_id,
        so_hoa_don=inv.so_hoa_don,
        mau_so=inv.mau_so,
        ky_hieu=inv.ky_hieu,
        ngay_lap=date.today(),
        ngay_hoa_don=inv.ngay_hoa_don or date.today(),
        co_vat=True if inv.tien_thue and inv.tien_thue > 0 else False,
        thue_suat=vat_rate,
        tong_tien_hang=Decimal(str(inv.tong_tien_hang or 0)),
        tien_thue=Decimal(str(inv.tien_thue or 0)),
        tong_thanh_toan=Decimal(str(inv.tong_thanh_toan or 0)),
        phap_nhan_id=payload.phap_nhan_id,
        ghi_chu=f"Nhập tự động từ hóa đơn điện tử XML gốc số {inv.so_hoa_don}",
    )
    
    pi = acct_svc.create_purchase_invoice(pi_data, current_user.id)

    # 4. Cập nhật trạng thái hóa đơn đầu vào đã xử lý xong
    inv.trang_thai = "da_xu_ly"
    inv.purchase_invoice_id = pi.id
    if goods_receipt_id:
        inv.goods_receipt_id = goods_receipt_id

    db.commit()
    logger.info("Processed IncomingInvoice id=%s to PurchaseInvoice id=%s", inv.id, pi.id)

    return {
        "status": "success",
        "purchase_invoice_id": pi.id,
        "goods_receipt_id": goods_receipt_id,
        "detail": f"Đã sinh thành công hóa đơn mua hàng nháp và liên kết quy tắc."
    }
