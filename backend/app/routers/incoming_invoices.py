import difflib
import email
from email.header import decode_header
import imaplib
import json
import logging
from datetime import date, datetime, timezone
from typing import Any, Optional
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_permissions
from app.models.auth import User
from app.models.master import Supplier, PaperMaterial, OtherMaterial, PhapNhan, Warehouse, PhanXuong
from app.models.accounting import IncomingInvoice, IncomingInvoiceMappingRule, PurchaseInvoice, DebtLedgerEntry
from app.models.warehouse_doc import GoodsReceipt, GoodsReceiptItem
from app.schemas.accounting import IncomingInvoiceItemMapping, ProcessIncomingInvoicePayload
from app.services.xml_invoice_parser import parse_xml_invoice
from app.services.accounting_service import AccountingService
from app.config import settings

logger = logging.getLogger("erp")
router = APIRouter(prefix="/api/incoming-invoices", tags=["Hóa đơn đầu vào"])


# Helper: đọc danh sách IMAP configs từ settings
def get_imap_configs() -> list[dict]:
    """
    Đọc danh sách IMAP account configs.
    Ưu tiên EMAIL_IMAP_CONFIGS (JSON array).
    Fallback sang 4 biến legacy EMAIL_IMAP_SERVER/PORT/USER/PASSWORD nếu JSON rỗng.
    """
    configs_str = (settings.EMAIL_IMAP_CONFIGS or "").strip()
    if configs_str and configs_str != "[]":
        try:
            parsed = json.loads(configs_str)
            if isinstance(parsed, list) and parsed:
                return parsed
        except Exception:
            logger.error("EMAIL_IMAP_CONFIGS JSON không hợp lệ — fallback sang legacy config")

    if settings.EMAIL_IMAP_SERVER and settings.EMAIL_IMAP_USER and settings.EMAIL_IMAP_PASSWORD:
        return [{
            "phap_nhan_id": None,
            "server": settings.EMAIL_IMAP_SERVER,
            "port": settings.EMAIL_IMAP_PORT,
            "user": settings.EMAIL_IMAP_USER,
            "password": settings.EMAIL_IMAP_PASSWORD,
        }]
    return []


def scan_one_imap_account(db: Session, cfg: dict, phap_nhan_lookup: dict[str, int]) -> int:
    """
    Quét 1 hòm thư IMAP, parse XML hóa đơn, lưu vào DB.
    phap_nhan_lookup: {ma_so_thue → phap_nhan_id} để auto-detect pháp nhân từ buyer_tax_code.
    cfg.phap_nhan_id (nếu có) override auto-detect.
    """
    server = cfg.get("server", "")
    port = int(cfg.get("port", 993))
    user = cfg.get("user", "")
    password = cfg.get("password", "")
    forced_pn_id = cfg.get("phap_nhan_id")  # override nếu config chỉ định cứng

    if not server or not user or not password:
        logger.warning("IMAP config thiếu server/user/password — bỏ qua account: %s", user)
        return 0

    count = 0
    mail = None
    try:
        mail = imaplib.IMAP4_SSL(server, port)
        mail.login(user, password)
        mail.select("inbox")

        status, messages = mail.search(None, 'UNSEEN')
        if status != 'OK' or not messages[0]:
            return 0

        for msg_num in messages[0].split():
            try:
                status, msg_data = mail.fetch(msg_num, '(RFC822)')
                if status != 'OK':
                    continue

                raw_email = msg_data[0][1]
                msg = email.message_from_bytes(raw_email)

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

                        try:
                            xml_str = xml_data.decode("utf-8-sig")
                        except UnicodeDecodeError:
                            xml_str = xml_data.decode("utf-8", errors="ignore")

                        parsed_data = parse_xml_invoice(xml_str)
                        if parsed_data:
                            existing = db.query(IncomingInvoice).filter(
                                IncomingInvoice.so_hoa_don == parsed_data["so_hoa_don"],
                                IncomingInvoice.ky_hieu == parsed_data["ky_hieu"],
                                IncomingInvoice.supplier_tax_code == parsed_data["supplier_tax_code"],
                                IncomingInvoice.trang_thai != "huy"
                            ).first()

                            if not existing:
                                # Xác định phap_nhan_id: config override > auto-detect từ buyer_tax_code
                                pn_id = forced_pn_id or phap_nhan_lookup.get(parsed_data.get("buyer_tax_code", ""))
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
                                    phap_nhan_id=pn_id,
                                )
                                db.add(invoice)
                                count += 1

                mail.store(msg_num, '+FLAGS', '\\Seen')

            except Exception as msg_err:
                logger.error("Lỗi xử lý email %s từ %s: %s", msg_num, user, msg_err, exc_info=True)

        if count > 0:
            db.commit()
            logger.info("IMAP %s: đã lưu %s hóa đơn mới.", user, count)

    except Exception as imap_err:
        logger.error("Lỗi kết nối IMAP %s: %s", user, imap_err, exc_info=True)
        raise
    finally:
        if mail:
            try:
                mail.close()
                mail.logout()
            except Exception:
                pass

    return count


def scan_all_emails_for_invoices(db: Session) -> int:
    """Quét tất cả IMAP accounts đã cấu hình, mỗi account lỗi không ảnh hưởng account khác."""
    configs = get_imap_configs()
    if not configs:
        logger.info("Không có IMAP config nào — bỏ qua quét email.")
        return 0

    # Build lookup dict ma_so_thue → phap_nhan_id cho auto-detect
    phap_nhan_lookup: dict[str, int] = {
        pn.ma_so_thue: pn.id
        for pn in db.query(PhapNhan).filter(PhapNhan.ma_so_thue.isnot(None)).all()
    }

    total = 0
    for cfg in configs:
        try:
            count = scan_one_imap_account(db, cfg, phap_nhan_lookup)
            total += count
        except Exception as e:
            logger.error("Bỏ qua IMAP account %s do lỗi: %s", cfg.get("user"), e)
    return total


@router.get("")
def list_incoming_invoices(
    trang_thai: Optional[str] = Query(None),
    so_hoa_don: Optional[str] = Query(None),
    supplier_tax_code: Optional[str] = Query(None),
    supplier_name: Optional[str] = Query(None),
    phap_nhan_id: Optional[int] = Query(None),
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
    if so_hoa_don:
        q = q.filter(IncomingInvoice.so_hoa_don.ilike(f"%{so_hoa_don}%"))
    if supplier_tax_code:
        q = q.filter(IncomingInvoice.supplier_tax_code == supplier_tax_code)
    if supplier_name:
        q = q.filter(IncomingInvoice.supplier_name.ilike(f"%{supplier_name}%"))
    if phap_nhan_id:
        q = q.filter(IncomingInvoice.phap_nhan_id == phap_nhan_id)
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

    # Bulk lookup Supplier + PhapNhan để tránh N+1 queries
    supplier_tax_codes = list({r.supplier_tax_code for r in rows if r.supplier_tax_code})
    buyer_tax_codes = list({r.buyer_tax_code for r in rows if r.buyer_tax_code})

    supplier_map: dict[str, Any] = {}
    if supplier_tax_codes:
        for s in db.query(Supplier).filter(Supplier.ma_so_thue.in_(supplier_tax_codes), Supplier.trang_thai == True).all():
            supplier_map[s.ma_so_thue] = s

    phap_nhan_map: dict[str, Any] = {}
    if buyer_tax_codes:
        for pn in db.query(PhapNhan).filter(PhapNhan.ma_so_thue.in_(buyer_tax_codes), PhapNhan.trang_thai == True).all():
            phap_nhan_map[pn.ma_so_thue] = pn

    items = []
    for r in rows:
        s = supplier_map.get(r.supplier_tax_code) if r.supplier_tax_code else None
        pn = phap_nhan_map.get(r.buyer_tax_code) if r.buyer_tax_code else None
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
            "internal_supplier_id": s.id if s else None,
            "internal_supplier_name": (s.ten_viet_tat or s.ten_don_vi) if s else None,
            "phap_nhan_id": r.phap_nhan_id,
            "internal_phap_nhan_id": pn.id if pn else None,
            "internal_phap_nhan_name": pn.ten_phap_nhan if pn else None,
        })

    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.get("/stats")
def get_incoming_invoice_stats(
    phap_nhan_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Thống kê số lượng và tổng giá trị hóa đơn đầu vào theo trạng thái."""
    from sqlalchemy import func
    q = db.query(IncomingInvoice.trang_thai, func.count().label("count"), func.sum(IncomingInvoice.tong_thanh_toan).label("tong_gia_tri"))
    if phap_nhan_id:
        q = q.filter(IncomingInvoice.phap_nhan_id == phap_nhan_id)
    rows = q.group_by(IncomingInvoice.trang_thai).all()
    result: dict[str, Any] = {
        "cho_xu_ly": {"count": 0, "tong_gia_tri": 0},
        "da_xu_ly": {"count": 0, "tong_gia_tri": 0},
        "bo_qua": {"count": 0, "tong_gia_tri": 0},
    }
    for trang_thai, count, tong_gia_tri in rows:
        if trang_thai in result:
            result[trang_thai] = {"count": count, "tong_gia_tri": float(tong_gia_tri or 0)}
    return result


@router.get("/suggestions")
def get_material_suggestions(
    q: str = Query(..., min_length=2),
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Gợi ý tìm kiếm vật tư: DB-side ILIKE trước, fuzzy score sau để rank."""
    from sqlalchemy import or_
    query_str = q.strip().lower()
    like_pat = f"%{query_str}%"

    # DB-side filter: chỉ load rows khớp ILIKE (tên hoặc mã), giới hạn 100 rows
    papers = (
        db.query(PaperMaterial)
        .filter(PaperMaterial.su_dung == True)
        .filter(or_(PaperMaterial.ten.ilike(like_pat), PaperMaterial.ma_chinh.ilike(like_pat)))
        .limit(100)
        .all()
    )
    others = (
        db.query(OtherMaterial)
        .filter(OtherMaterial.trang_thai == True)
        .filter(or_(OtherMaterial.ten.ilike(like_pat), OtherMaterial.ma_chinh.ilike(like_pat)))
        .limit(100)
        .all()
    )

    suggestions = []
    for p in papers:
        score = max(
            difflib.SequenceMatcher(None, query_str, p.ten.lower()).ratio(),
            difflib.SequenceMatcher(None, query_str, p.ma_chinh.lower()).ratio(),
        )
        suggestions.append({
            "material_type": "paper",
            "id": p.id,
            "ma_chinh": p.ma_chinh,
            "ten": p.ten,
            "dvt": p.dvt,
            "loai_giay": p.loai_giay,
            "dinh_luong": float(p.dinh_luong or 0),
            "score": score,
        })
    for o in others:
        score = max(
            difflib.SequenceMatcher(None, query_str, o.ten.lower()).ratio(),
            difflib.SequenceMatcher(None, query_str, o.ma_chinh.lower()).ratio(),
        )
        suggestions.append({
            "material_type": "other",
            "id": o.id,
            "ma_chinh": o.ma_chinh,
            "ten": o.ten,
            "dvt": o.dvt,
            "score": score,
        })

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
        it_copy["from_saved_rule"] = False
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
                    it_copy["from_saved_rule"] = True
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
                    it_copy["from_saved_rule"] = True
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
        "phap_nhan_id": inv.phap_nhan_id,
        "internal_phap_nhan_id": internal_phap_nhan.id if internal_phap_nhan else None,
        "internal_phap_nhan_name": internal_phap_nhan.ten_phap_nhan if internal_phap_nhan else None,
    }


@router.post("/upload", status_code=201)
async def upload_xml_invoice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("accounting.incoming_invoice")),
):
    if not file.filename.lower().endswith('.xml'):
        raise HTTPException(400, "Chỉ chấp nhận file đính kèm dạng XML")

    content = await file.read()
    if len(content) > 5_000_000:
        raise HTTPException(413, "File quá lớn — tối đa 5MB cho file XML hóa đơn")
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

    # Auto-detect phap_nhan từ buyer_tax_code
    pn_id = None
    if parsed.get("buyer_tax_code"):
        pn_row = db.query(PhapNhan).filter(PhapNhan.ma_so_thue == parsed["buyer_tax_code"]).first()
        pn_id = pn_row.id if pn_row else None

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
        phap_nhan_id=pn_id,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return {"id": invoice.id, "so_hoa_don": invoice.so_hoa_don, "detail": "Tải lên hóa đơn thành công"}


@router.post("/sync-email")
def manual_email_sync(
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("accounting.incoming_invoice")),
):
    """Kích hoạt quét tất cả hòm thư email đã cấu hình để tải hóa đơn."""
    count = scan_all_emails_for_invoices(db)
    return {"status": "success", "count": count, "detail": f"Đã đồng bộ thành công {count} hóa đơn đầu vào mới từ email."}


@router.post("/{id}/ignore")
def ignore_incoming_invoice(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("accounting.incoming_invoice")),
):
    inv = db.get(IncomingInvoice, id)
    if not inv:
        raise HTTPException(404, "Hóa đơn đầu vào không tồn tại")
    if inv.trang_thai != "cho_xu_ly":
        raise HTTPException(400, f"Hóa đơn đang ở trạng thái '{inv.trang_thai}', không thể bỏ qua")

    inv.trang_thai = "bo_qua"
    db.commit()
    return {"status": "success", "detail": f"Đã bỏ qua hóa đơn số {inv.so_hoa_don}"}


@router.post("/{id}/revert")
def revert_incoming_invoice(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("accounting.incoming_invoice")),
):
    """Hoàn tác bỏ qua: đưa hóa đơn từ trạng thái 'bo_qua' về 'cho_xu_ly'."""
    inv = db.get(IncomingInvoice, id)
    if not inv:
        raise HTTPException(404, "Hóa đơn đầu vào không tồn tại")
    if inv.trang_thai != "bo_qua":
        raise HTTPException(400, f"Chỉ có thể hoàn tác hóa đơn ở trạng thái 'Đã bỏ qua' (hiện tại: '{inv.trang_thai}')")

    inv.trang_thai = "cho_xu_ly"
    db.commit()
    return {"status": "success", "detail": f"Đã mở lại hóa đơn số {inv.so_hoa_don} để xử lý"}


@router.post("/{id}/unprocess")
def unprocess_incoming_invoice(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("accounting.incoming_invoice")),
):
    """Hoàn tác xử lý: xóa GR nháp + PI nháp được tạo từ hóa đơn này, đưa về cho_xu_ly.
    Chỉ cho phép khi GoodsReceipt còn trang_thai='nhap' VÀ PurchaseInvoice còn trang_thai='nhap'.
    """
    inv = db.get(IncomingInvoice, id)
    if not inv:
        raise HTTPException(404, "Hóa đơn đầu vào không tồn tại")
    if inv.trang_thai != "da_xu_ly":
        raise HTTPException(400, "Chỉ có thể hoàn tác hóa đơn ở trạng thái 'Đã xử lý'")

    # Kiểm tra PI còn nháp không
    pi = db.get(PurchaseInvoice, inv.purchase_invoice_id) if inv.purchase_invoice_id else None
    if pi and pi.trang_thai != "nhap":
        raise HTTPException(400, f"Hóa đơn mua hàng #{pi.id} đã được duyệt — không thể hoàn tác")

    # Kiểm tra GR còn nháp không
    gr = db.get(GoodsReceipt, inv.goods_receipt_id) if inv.goods_receipt_id else None
    if gr and gr.trang_thai != "nhap":
        raise HTTPException(400, f"Phiếu nhập kho #{gr.id} đã được xác nhận — không thể hoàn tác")

    # Xóa GoodsReceipt items + GoodsReceipt
    if gr:
        db.query(GoodsReceiptItem).filter(GoodsReceiptItem.receipt_id == gr.id).delete()
        db.delete(gr)

    # Xóa PurchaseInvoice
    if pi:
        db.delete(pi)

    # Đưa hóa đơn về trạng thái ban đầu
    inv.trang_thai = "cho_xu_ly"
    inv.purchase_invoice_id = None
    inv.goods_receipt_id = None

    db.commit()
    logger.info("Unprocessed IncomingInvoice id=%s — deleted GR %s and PI %s", id,
                gr.id if gr else None, pi.id if pi else None)
    return {"status": "success", "detail": f"Đã hoàn tác xử lý hóa đơn số {inv.so_hoa_don}"}


@router.post("/{id}/process")
def process_incoming_invoice(
    id: int,
    payload: ProcessIncomingInvoicePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("accounting.incoming_invoice")),
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
