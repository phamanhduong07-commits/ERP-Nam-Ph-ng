import calendar
from datetime import date, datetime
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import desc, func, and_, or_
from sqlalchemy.orm import Session, joinedload

from app.models.billing import SalesInvoice
from app.models.accounting import (
    ChartOfAccounts, JournalEntry, JournalEntryLine,
    PurchaseInvoice, CashReceipt, CashPayment,
    DebtLedgerEntry, OpeningBalance, JournalEntry, JournalEntryLine,
    CustomerRefundVoucher, WorkshopPayroll, FixedAsset,
)
from app.models.master import Customer, Supplier
from app.models.purchase import PurchaseOrder
from app.models.warehouse_doc import GoodsReceipt, DeliveryOrder
from app.schemas.accounting import (
    PurchaseInvoiceCreate,
    CashReceiptCreate,
    CashPaymentCreate,
    ARLedgerRow, ARAgingRow,
    APLedgerRow, APAgingRow,
    BalanceByPeriod,
    OpeningBalanceCreate,
    CustomerRefundVoucherUpdate,
    WorkshopPayrollCreate,
    FixedAssetCreate,
)


class AccountingService:
    def __init__(self, db: Session):
        self.db = db

    # ─────────────────────────────────────────────
    # Sinh số phiếu: PREFIX-YYYYMM-XXXX
    # ─────────────────────────────────────────────
    def _gen_so_phieu(self, prefix: str, model) -> str:
        full_prefix = f"{prefix}{date.today().strftime('%Y%m')}"
        last = (
            self.db.query(model)
            .filter(model.so_phieu.like(f"{full_prefix}%"))
            .order_by(desc(model.so_phieu))
            .first()
        )
        seq = int(last.so_phieu[-4:]) + 1 if last else 1
        return f"{full_prefix}-{seq:04d}"

    # ─────────────────────────────────────────────
    # PHIẾU THU
    # ─────────────────────────────────────────────
    def create_cash_receipt(self, data: CashReceiptCreate, user_id: int) -> CashReceipt:
        # Validate số tiền không vượt con_lai
        if data.sales_invoice_id:
            invoice = self.db.query(SalesInvoice).get(data.sales_invoice_id)
            if not invoice:
                raise HTTPException(404, "Không tìm thấy hóa đơn")
            if invoice.trang_thai == "huy":
                raise HTTPException(400, "Hóa đơn đã bị hủy")
            remaining = float(invoice.tong_cong) - float(invoice.da_thanh_toan)
            if float(data.so_tien) > remaining + 0.001:
                raise HTTPException(
                    400, f"Số tiền ({data.so_tien:,.0f}) vượt quá còn lại ({remaining:,.0f})"
                )

        receipt = CashReceipt(
            so_phieu=self._gen_so_phieu("PT", CashReceipt),
            ngay_phieu=data.ngay_phieu,
            customer_id=data.customer_id,
            sales_invoice_id=data.sales_invoice_id,
            hinh_thuc_tt=data.hinh_thuc_tt,
            so_tai_khoan=data.so_tai_khoan,
            so_tham_chieu=data.so_tham_chieu,
            dien_giai=data.dien_giai,
            so_tien=data.so_tien,
            tk_no=data.tk_no,
            tk_co=data.tk_co,
            phap_nhan_id=data.phap_nhan_id,
            phan_xuong_id=data.phan_xuong_id,
            created_by=user_id,
        )
        self.db.add(receipt)
        self.db.flush()

        # Cập nhật hóa đơn
        if data.sales_invoice_id:
            invoice = self.db.query(SalesInvoice).get(data.sales_invoice_id)
            new_da_tt = float(invoice.da_thanh_toan) + float(data.so_tien)
            new_remaining = float(invoice.tong_cong) - new_da_tt
            invoice.da_thanh_toan = Decimal(str(round(new_da_tt, 2)))
            if new_remaining <= 0.001:
                invoice.trang_thai = "da_tt_du"
            elif new_da_tt > 0:
                invoice.trang_thai = "da_tt_mot_phan"
            invoice.updated_at = datetime.utcnow()

            # Sync DeliveryOrder.trang_thai_cong_no
            if invoice.delivery_id:
                delivery = self.db.query(DeliveryOrder).get(invoice.delivery_id)
                if delivery:
                    if invoice.trang_thai == "da_tt_du":
                        delivery.trang_thai_cong_no = "da_thu_du"
                    else:
                        delivery.trang_thai_cong_no = "da_thu_mot_phan"

        # Ghi sổ công nợ
        entry = DebtLedgerEntry(
            ngay=data.ngay_phieu,
            loai="giam_no",
            doi_tuong="khach_hang",
            customer_id=data.customer_id,
            chung_tu_loai="phieu_thu",
            chung_tu_id=receipt.id,
            so_tien=data.so_tien,
            ghi_chu=data.dien_giai or f"Phiếu thu {receipt.so_phieu}",
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(receipt)
        return receipt

    def _gen_so_but_toan(self, prefix: str) -> str:
        full_prefix = f"{prefix}{date.today().strftime('%Y%m')}"
        last = (
            self.db.query(JournalEntry)
            .filter(JournalEntry.so_but_toan.like(f"{full_prefix}%"))
            .order_by(desc(JournalEntry.so_but_toan))
            .first()
        )
        seq = int(last.so_but_toan[-4:]) + 1 if last else 1
        return f"{full_prefix}-{seq:04d}"

    def _create_journal_entry(
        self,
        ngay: date,
        dien_giai: str,
        loai_but_toan: str,
        chung_tu_loai: str | None,
        chung_tu_id: int | None,
        lines: list[dict[str, object]],
        phap_nhan_id: int | None = None,
        phan_xuong_id: int | None = None,
    ) -> JournalEntry:
        entry = JournalEntry(
            so_but_toan=self._gen_so_but_toan('BT'),
            ngay_but_toan=ngay,
            dien_giai=dien_giai,
            loai_but_toan=loai_but_toan,
            tong_no=sum(float(l['so_tien_no']) for l in lines),
            tong_co=sum(float(l['so_tien_co']) for l in lines),
            chung_tu_loai=chung_tu_loai,
            chung_tu_id=chung_tu_id,
            phap_nhan_id=phap_nhan_id,
            phan_xuong_id=phan_xuong_id,
        )
        self.db.add(entry)
        self.db.flush()
        for line in lines:
            entry_line = JournalEntryLine(
                entry_id=entry.id,
                so_tk=line['so_tk'],
                dien_giai=line.get('dien_giai'),
                so_tien_no=Decimal(str(line.get('so_tien_no', 0))),
                so_tien_co=Decimal(str(line.get('so_tien_co', 0))),
                phap_nhan_id=line.get('phap_nhan_id', phap_nhan_id),
                phan_xuong_id=line.get('phan_xuong_id', phan_xuong_id),
            )
            self.db.add(entry_line)
        self.db.flush()
        return entry

    def _post_cash_receipt_journal(self, receipt: CashReceipt) -> None:
        lines = [
            {
                'so_tk': receipt.tk_no,
                'dien_giai': f"Thu tiền HĐ {receipt.sales_invoice_id or ''}",
                'so_tien_no': float(receipt.so_tien),
                'so_tien_co': 0,
            },
            {
                'so_tk': receipt.tk_co,
                'dien_giai': f"Giảm công nợ KH {receipt.customer_id}",
                'so_tien_no': 0,
                'so_tien_co': float(receipt.so_tien),
            },
        ]
        self._create_journal_entry(
            ngay=receipt.ngay_phieu,
            dien_giai=f"Phiếu thu {receipt.so_phieu}",
            loai_but_toan='phieu_thu',
            chung_tu_loai='phieu_thu',
            chung_tu_id=receipt.id,
            lines=lines,
            phap_nhan_id=receipt.phap_nhan_id,
        )

    def _post_cash_payment_journal(self, payment: CashPayment) -> None:
        lines = [
            {
                'so_tk': payment.tk_no,
                'dien_giai': f"Trả nợ NCC {payment.supplier_id} HĐ {payment.purchase_invoice_id or ''}",
                'so_tien_no': float(payment.so_tien),
                'so_tien_co': 0,
            },
            {
                'so_tk': payment.tk_co,
                'dien_giai': f"Chi tiền {payment.dien_giai or payment.so_phieu}",
                'so_tien_no': 0,
                'so_tien_co': float(payment.so_tien),
            },
        ]
        self._create_journal_entry(
            ngay=payment.ngay_phieu,
            dien_giai=f"Phiếu chi {payment.so_phieu}",
            loai_but_toan='phieu_chi',
            chung_tu_loai='phieu_chi',
            chung_tu_id=payment.id,
            lines=lines,
            phap_nhan_id=payment.phap_nhan_id,
        )

    def _post_purchase_invoice_journal(self, inv: PurchaseInvoice) -> None:
        if inv.bo_qua_hach_toan:
            return
        if inv.tien_thue > 0:
            # Nếu có GR, tiền hàng đã hạch toán ở GR (Nợ 152 / Có 331)
            # Hóa đơn chỉ hạch toán bổ sung Thuế: Nợ 1331 / Có 331
            if inv.gr_id:
                lines = [
                    {"so_tk": "1331", "dien_giai": f"Thuế GTGT đầu vào - {inv.so_hoa_don}", "so_tien_no": float(inv.tien_thue), "so_tien_co": 0},
                    {"so_tk": "331", "dien_giai": f"Thuế GTGT đầu vào - {inv.so_hoa_don}", "so_tien_no": 0, "so_tien_co": float(inv.tien_thue)},
                ]
            else:
                # Nếu không có GR, hạch toán cả tiền hàng và thuế
                lines = [
                    {"so_tk": "154", "dien_giai": f"Mua hàng dịch vụ - {inv.so_hoa_don}", "so_tien_no": float(inv.tong_tien_hang), "so_tien_co": 0},
                    {"so_tk": "1331", "dien_giai": f"Thuế GTGT đầu vào - {inv.so_hoa_don}", "so_tien_no": float(inv.tien_thue), "so_tien_co": 0},
                    {"so_tk": "331", "dien_giai": f"Phải trả NCC - {inv.so_hoa_don}", "so_tien_no": 0, "so_tien_co": float(inv.tong_thanh_toan)},
                ]

            self._create_journal_entry(
                ngay=inv.ngay_lap,
                dien_giai=f"Hóa đơn mua hàng: {inv.so_hoa_don}",
                loai_but_toan="purchase_invoice",
                chung_tu_loai="purchase_invoices",
                chung_tu_id=inv.id,
                lines=lines,
                phap_nhan_id=inv.phap_nhan_id,
                phan_xuong_id=inv.phan_xuong_id
            )

    def _reverse_journal_entries(self, chung_tu_loai: str, chung_tu_id: int) -> None:
        originals = (
            self.db.query(JournalEntry)
            .filter(
                JournalEntry.chung_tu_loai == chung_tu_loai,
                JournalEntry.chung_tu_id == chung_tu_id,
                JournalEntry.loai_but_toan != 'dao_nguoc',
            )
            .all()
        )
        for orig in originals:
            reversed_lines = [
                {
                    'so_tk': line.so_tk,
                    'dien_giai': f"Đảo ngược: {line.dien_giai or ''}",
                    'so_tien_no': float(line.so_tien_co),
                    'so_tien_co': float(line.so_tien_no),
                }
                for line in orig.lines
            ]
            self._create_journal_entry(
                ngay=date.today(),
                dien_giai=f"Đảo ngược {orig.dien_giai}",
                loai_but_toan='dao_nguoc',
                chung_tu_loai=chung_tu_loai,
                chung_tu_id=chung_tu_id,
                lines=reversed_lines,
                phap_nhan_id=orig.phap_nhan_id,
                phan_xuong_id=orig.phan_xuong_id,
            )

    def post_inventory_journal(
        self,
        ngay: date,
        loai: str,
        chung_tu_loai: str,
        chung_tu_id: int,
        items: list[dict],
        phap_nhan_id: int | None = None,
        phan_xuong_id: int | None = None,
    ) -> JournalEntry | None:
        """
        Ghi sổ kế toán cho các giao dịch kho.
        loai: 'XUAT_SX', 'NHAP_TP', 'CHUYEN_KHO'
        items: list of { 
            'ten_hang', 'so_luong', 'don_gia', 
            'tk_no', 'tk_co',
            'phan_xuong_id_no', 'phan_xuong_id_co',
            'phap_nhan_id_no', 'phap_nhan_id_co'
        }
        """
        if not items:
            return None

        lines = []
        tong_tien = 0
        for it in items:
            thanh_tien = float(it['so_luong'] or 0) * float(it['don_gia'] or 0)
            if thanh_tien <= 0:
                continue
            
            tong_tien += thanh_tien
            # Line Nợ
            lines.append({
                'so_tk': it['tk_no'],
                'dien_giai': f"{it.get('ten_hang', '')} ({it['so_luong']})",
                'so_tien_no': thanh_tien,
                'so_tien_co': 0,
                'phan_xuong_id': it.get('phan_xuong_id_no', phan_xuong_id),
                'phap_nhan_id': it.get('phap_nhan_id_no', phap_nhan_id),
            })
            # Line Có
            lines.append({
                'so_tk': it['tk_co'],
                'dien_giai': f"{it.get('ten_hang', '')} ({it['so_luong']})",
                'so_tien_no': 0,
                'so_tien_co': thanh_tien,
                'phan_xuong_id': it.get('phan_xuong_id_co', phan_xuong_id),
                'phap_nhan_id': it.get('phap_nhan_id_co', phap_nhan_id),
            })

        if not lines:
            return None

        return self._create_journal_entry(
            ngay=ngay,
            dien_giai=f"Ghi sổ kho: {loai} - {chung_tu_loai} #{chung_tu_id}",
            loai_but_toan=loai.lower(),
            chung_tu_loai=chung_tu_loai,
            chung_tu_id=chung_tu_id,
            lines=lines,
            phap_nhan_id=phap_nhan_id,
            phan_xuong_id=phan_xuong_id,
        )

    def approve_receipt(self, receipt_id: int, user_id: int) -> CashReceipt:
        receipt = self.db.query(CashReceipt).get(receipt_id)
        if not receipt:
            raise HTTPException(404, "Không tìm thấy phiếu thu")
        if receipt.trang_thai != "cho_duyet":
            raise HTTPException(400, "Phiếu thu không ở trạng thái Chờ duyệt")
        receipt.trang_thai = "da_duyet"
        receipt.nguoi_duyet_id = user_id
        receipt.ngay_duyet = datetime.utcnow()
        self._post_cash_receipt_journal(receipt)
        self.db.commit()
        self.db.refresh(receipt)
        return receipt

    def cancel_receipt(self, receipt_id: int) -> CashReceipt:
        receipt = self.db.query(CashReceipt).get(receipt_id)
        if not receipt:
            raise HTTPException(404, "Không tìm thấy phiếu thu")
        if receipt.trang_thai == "huy":
            return receipt

        # Đảo ngược bút toán nếu đã duyệt
        was_approved = receipt.trang_thai == "da_duyet"
        if was_approved:
            self._reverse_journal_entries("phieu_thu", receipt.id)

        # Hoàn lại da_thanh_toan trên HĐ
        if receipt.sales_invoice_id:
            invoice = self.db.query(SalesInvoice).get(receipt.sales_invoice_id)
            if invoice:
                new_da_tt = max(Decimal("0"), invoice.da_thanh_toan - receipt.so_tien)
                invoice.da_thanh_toan = new_da_tt
                invoice.trang_thai = "da_phat_hanh" if new_da_tt == 0 else "da_tt_mot_phan"
                invoice.updated_at = datetime.utcnow()
                if invoice.delivery_id:
                    delivery = self.db.query(DeliveryOrder).get(invoice.delivery_id)
                    if delivery:
                        delivery.trang_thai_cong_no = (
                            "chua_thu" if new_da_tt == 0 else "da_thu_mot_phan"
                        )

        receipt.trang_thai = "huy"
        entry = DebtLedgerEntry(
            ngay=date.today(),
            loai="tang_no",
            doi_tuong="khach_hang",
            customer_id=receipt.customer_id,
            chung_tu_loai="huy_phieu_thu",
            chung_tu_id=receipt.id,
            so_tien=receipt.so_tien,
            ghi_chu=f"Huy phieu thu {receipt.so_phieu}",
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(receipt)
        return receipt

    def list_receipts(
        self,
        customer_id: int | None = None,
        trang_thai: str | None = None,
        tu_ngay: date | None = None,
        den_ngay: date | None = None,
        page: int = 1,
        page_size: int = 20,
    ):
        q = self.db.query(CashReceipt)
        if customer_id:
            q = q.filter(CashReceipt.customer_id == customer_id)
        if trang_thai:
            q = q.filter(CashReceipt.trang_thai == trang_thai)
        if tu_ngay:
            q = q.filter(CashReceipt.ngay_phieu >= tu_ngay)
        if den_ngay:
            q = q.filter(CashReceipt.ngay_phieu <= den_ngay)

        total = q.count()
        items = q.order_by(desc(CashReceipt.ngay_phieu)).offset((page - 1) * page_size).limit(page_size).all()
        return {"total": total, "page": page, "page_size": page_size, "items": items}

    def get_receipt(self, receipt_id: int) -> CashReceipt:
        r = self.db.query(CashReceipt).filter(CashReceipt.id == receipt_id).first()
        if not r:
            raise HTTPException(404, "Không tìm thấy phiếu thu")
        return r

    # ─────────────────────────────────────────────
    # HÓA ĐƠN MUA HÀNG
    # ─────────────────────────────────────────────
    def create_purchase_invoice(self, data: PurchaseInvoiceCreate, user_id: int) -> PurchaseInvoice:
        supplier = self.db.query(Supplier).get(data.supplier_id)
        if not supplier:
            raise HTTPException(404, "Không tìm thấy nhà cung cấp")

        existing_q = self.db.query(PurchaseInvoice).filter(PurchaseInvoice.trang_thai != "huy")
        existing = None
        if data.gr_id:
            existing = existing_q.filter(PurchaseInvoice.gr_id == data.gr_id).first()
        elif data.po_id:
            existing = existing_q.filter(
                PurchaseInvoice.po_id == data.po_id,
                PurchaseInvoice.gr_id.is_(None),
            ).first()
        if existing:
            return existing

        ten_don_vi = data.ten_don_vi or getattr(supplier, "ten_don_vi", supplier.ten_viet_tat)
        ma_so_thue = data.ma_so_thue or getattr(supplier, "ma_so_thue", None)

        inv = PurchaseInvoice(
            so_hoa_don=data.so_hoa_don,
            mau_so=data.mau_so,
            ky_hieu=data.ky_hieu,
            ngay_lap=data.ngay_lap,
            ngay_hoa_don=data.ngay_hoa_don,
            han_tt=data.han_tt,
            supplier_id=data.supplier_id,
            po_id=data.po_id,
            gr_id=data.gr_id,
            ten_don_vi=ten_don_vi,
            ma_so_thue=ma_so_thue,
            thue_suat=data.thue_suat,
            tong_tien_hang=data.tong_tien_hang,
            tien_thue=data.tien_thue,
            tong_thanh_toan=data.tong_thanh_toan,
            da_thanh_toan=Decimal("0"),
            ghi_chu=data.ghi_chu,
            phap_nhan_id=data.phap_nhan_id,
            phan_xuong_id=data.phan_xuong_id,
            created_by=user_id,
        )
        self.db.add(inv)
        self.db.flush()

        # Ghi sổ công nợ phải trả
        entry = DebtLedgerEntry(
            ngay=data.ngay_lap,
            loai="tang_no",
            doi_tuong="nha_cung_cap",
            supplier_id=data.supplier_id,
            chung_tu_loai="hoa_don_mua",
            chung_tu_id=inv.id,
            so_tien=data.tong_thanh_toan,
            ghi_chu=f"HĐ mua hàng {data.so_hoa_don or ''}",
        )
        self.db.add(entry)
        
        # Bút toán kế toán (GL)
        self._post_purchase_invoice_journal(inv)
        
        self.db.commit()
        self.db.refresh(inv)
        return inv

    def create_purchase_invoice_from_po(self, po_id: int, user_id: int, thue_suat: Decimal = Decimal("8")) -> PurchaseInvoice:
        po = self.db.query(PurchaseOrder).options(joinedload(PurchaseOrder.items)).get(po_id)
        if not po:
            raise HTTPException(404, "Không tìm thấy đơn mua hàng")

        tong_tien_hang = sum(
            (item.thanh_tien for item in po.items if item.thanh_tien), Decimal("0")
        )
        ts = Decimal(str(thue_suat))
        tien_thue = round(tong_tien_hang * ts / 100, 0)

        data = PurchaseInvoiceCreate(
            supplier_id=po.supplier_id,
            po_id=po.id,
            ngay_lap=date.today(),
            thue_suat=ts,
            tong_tien_hang=tong_tien_hang,
            tien_thue=tien_thue,
            tong_thanh_toan=tong_tien_hang + tien_thue,
            phap_nhan_id=po.phap_nhan_id,
            phan_xuong_id=po.phan_xuong_id,
        )
        return self.create_purchase_invoice(data, user_id)

    def create_purchase_invoice_from_gr(self, gr_id: int, user_id: int, thue_suat: Decimal = Decimal("8")) -> PurchaseInvoice:
        gr = self.db.query(GoodsReceipt).options(joinedload(GoodsReceipt.items)).get(gr_id)
        if not gr:
            raise HTTPException(404, "Không tìm thấy phiếu nhập")

        tong_tien_hang = gr.tong_gia_tri or Decimal("0")
        ts = Decimal(str(thue_suat))
        tien_thue = round(tong_tien_hang * ts / 100, 0)

        data = PurchaseInvoiceCreate(
            supplier_id=gr.supplier_id,
            po_id=gr.po_id,
            gr_id=gr.id,
            ngay_lap=date.today(),
            thue_suat=ts,
            tong_tien_hang=tong_tien_hang,
            tien_thue=tien_thue,
            tong_thanh_toan=tong_tien_hang + tien_thue,
            phap_nhan_id=gr.phap_nhan_id,
            phan_xuong_id=gr.phan_xuong_id,
        )
        return self.create_purchase_invoice(data, user_id)

    def list_purchase_invoices(
        self,
        supplier_id: int | None = None,
        trang_thai: str | None = None,
        tu_ngay: date | None = None,
        den_ngay: date | None = None,
        qua_han_only: bool = False,
        page: int = 1,
        page_size: int = 20,
    ):
        self._mark_overdue_ap()
        q = self.db.query(PurchaseInvoice)
        if supplier_id:
            q = q.filter(PurchaseInvoice.supplier_id == supplier_id)
        if trang_thai:
            q = q.filter(PurchaseInvoice.trang_thai == trang_thai)
        if tu_ngay:
            q = q.filter(PurchaseInvoice.ngay_lap >= tu_ngay)
        if den_ngay:
            q = q.filter(PurchaseInvoice.ngay_lap <= den_ngay)
        if qua_han_only:
            q = q.filter(PurchaseInvoice.trang_thai == "qua_han")

        total = q.count()
        items = q.order_by(desc(PurchaseInvoice.ngay_lap)).offset((page - 1) * page_size).limit(page_size).all()
        return {"total": total, "page": page, "page_size": page_size, "items": items}

    def get_purchase_invoice(self, inv_id: int) -> PurchaseInvoice:
        inv = (
            self.db.query(PurchaseInvoice)
            .options(joinedload(PurchaseInvoice.payments))
            .filter(PurchaseInvoice.id == inv_id)
            .first()
        )
        if not inv:
            raise HTTPException(404, "Không tìm thấy hóa đơn mua")
        return inv

    # ─────────────────────────────────────────────
    # PHIẾU CHI
    # ─────────────────────────────────────────────
    def create_cash_payment(self, data: CashPaymentCreate, user_id: int) -> CashPayment:
        if data.purchase_invoice_id:
            inv = self.db.query(PurchaseInvoice).get(data.purchase_invoice_id)
            if not inv:
                raise HTTPException(404, "Không tìm thấy hóa đơn mua")
            remaining = float(inv.tong_thanh_toan) - float(inv.da_thanh_toan)
            if float(data.so_tien) > remaining + 0.001:
                raise HTTPException(400, f"Số tiền vượt quá còn lại ({remaining:,.0f})")

        payment = CashPayment(
            so_phieu=self._gen_so_phieu("PC", CashPayment),
            ngay_phieu=data.ngay_phieu,
            supplier_id=data.supplier_id,
            purchase_invoice_id=data.purchase_invoice_id,
            hinh_thuc_tt=data.hinh_thuc_tt,
            so_tai_khoan=data.so_tai_khoan,
            so_tham_chieu=data.so_tham_chieu,
            dien_giai=data.dien_giai,
            so_tien=data.so_tien,
            tk_no=data.tk_no,
            tk_co=data.tk_co,
            phap_nhan_id=data.phap_nhan_id,
            phan_xuong_id=data.phan_xuong_id,
            created_by=user_id,
        )
        self.db.add(payment)
        self.db.flush()

        # Cập nhật hóa đơn mua
        if data.purchase_invoice_id:
            inv = self.db.query(PurchaseInvoice).get(data.purchase_invoice_id)
            new_da_tt = float(inv.da_thanh_toan) + float(data.so_tien)
            new_remaining = float(inv.tong_thanh_toan) - new_da_tt
            inv.da_thanh_toan = Decimal(str(round(new_da_tt, 2)))
            if new_remaining <= 0.001:
                inv.trang_thai = "da_tt_du"
            elif new_da_tt > 0:
                inv.trang_thai = "da_tt_mot_phan"
            inv.updated_at = datetime.utcnow()

        # Ghi sổ công nợ
        entry = DebtLedgerEntry(
            ngay=data.ngay_phieu,
            loai="giam_no",
            doi_tuong="nha_cung_cap",
            supplier_id=data.supplier_id,
            chung_tu_loai="phieu_chi",
            chung_tu_id=payment.id,
            so_tien=data.so_tien,
            ghi_chu=data.dien_giai or f"Phiếu chi {payment.so_phieu}",
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(payment)
        return payment

    def approve_payment(self, payment_id: int, user_id: int) -> CashPayment:
        p = self.db.query(CashPayment).get(payment_id)
        if not p:
            raise HTTPException(404, "Không tìm thấy phiếu chi")
        transitions = {"cho_chot": "da_chot", "da_chot": "da_duyet"}
        next_state = transitions.get(p.trang_thai)
        if not next_state:
            raise HTTPException(400, f"Không thể chuyển trạng thái từ {p.trang_thai}")
        p.trang_thai = next_state
        if next_state == "da_duyet":
            p.nguoi_duyet_id = user_id
            p.ngay_duyet = datetime.utcnow()
            self._post_cash_payment_journal(p)
        self.db.commit()
        self.db.refresh(p)
        return p

    def cancel_payment(self, payment_id: int) -> CashPayment:
        p = self.db.query(CashPayment).get(payment_id)
        if not p:
            raise HTTPException(404, "Không tìm thấy phiếu chi")
        if p.trang_thai == "da_duyet":
            raise HTTPException(400, "Không thể hủy phiếu chi đã duyệt")
        if p.purchase_invoice_id:
            inv = self.db.query(PurchaseInvoice).get(p.purchase_invoice_id)
            if inv:
                inv.da_thanh_toan = max(Decimal("0"), inv.da_thanh_toan - p.so_tien)
                inv.trang_thai = "nhap" if inv.da_thanh_toan == 0 else "da_tt_mot_phan"
                inv.updated_at = datetime.utcnow()
        self.db.query(DebtLedgerEntry).filter(
            DebtLedgerEntry.chung_tu_loai == "phieu_chi",
            DebtLedgerEntry.chung_tu_id == payment_id,
        ).delete(synchronize_session=False)
        p.trang_thai = "huy"
        self.db.commit()
        self.db.refresh(p)
        return p

    def list_payments(
        self,
        supplier_id: int | None = None,
        trang_thai: str | None = None,
        tu_ngay: date | None = None,
        den_ngay: date | None = None,
        page: int = 1,
        page_size: int = 20,
    ):
        q = self.db.query(CashPayment)
        if supplier_id:
            q = q.filter(CashPayment.supplier_id == supplier_id)
        if trang_thai:
            q = q.filter(CashPayment.trang_thai == trang_thai)
        if tu_ngay:
            q = q.filter(CashPayment.ngay_phieu >= tu_ngay)
        if den_ngay:
            q = q.filter(CashPayment.ngay_phieu <= den_ngay)
        total = q.count()
        items = q.order_by(desc(CashPayment.ngay_phieu)).offset((page - 1) * page_size).limit(page_size).all()
        return {"total": total, "page": page, "page_size": page_size, "items": items}

    def get_payment(self, payment_id: int) -> CashPayment:
        p = self.db.query(CashPayment).filter(CashPayment.id == payment_id).first()
        if not p:
            raise HTTPException(404, "Không tìm thấy phiếu chi")
        return p

    # ─────────────────────────────────────────────
    # SỔ CÔNG NỢ PHẢI THU (AR)
    # ─────────────────────────────────────────────
    def get_ar_ledger(
        self,
        customer_id: int | None = None,
        tu_ngay: date | None = None,
        den_ngay: date | None = None,
        trang_thai: str | None = None,
        qua_han_only: bool = False,
    ) -> list[ARLedgerRow]:
        self._mark_overdue_ar()
        today = date.today()
        q = self.db.query(SalesInvoice).filter(SalesInvoice.trang_thai != "huy")
        if customer_id:
            q = q.filter(SalesInvoice.customer_id == customer_id)
        if tu_ngay:
            q = q.filter(SalesInvoice.ngay_hoa_don >= tu_ngay)
        if den_ngay:
            q = q.filter(SalesInvoice.ngay_hoa_don <= den_ngay)
        if trang_thai:
            q = q.filter(SalesInvoice.trang_thai == trang_thai)
        if qua_han_only:
            q = q.filter(SalesInvoice.han_tt < today, SalesInvoice.trang_thai != "da_tt_du")

        rows = []
        for inv in q.order_by(SalesInvoice.ngay_hoa_don).all():
            so_ngay_qua_han = 0
            if inv.han_tt and inv.han_tt < today and inv.trang_thai != "da_tt_du":
                so_ngay_qua_han = (today - inv.han_tt).days
            rows.append(ARLedgerRow(
                invoice_id=inv.id,
                so_hoa_don=inv.so_hoa_don,
                ngay_hoa_don=inv.ngay_hoa_don,
                han_tt=inv.han_tt,
                customer_id=inv.customer_id,
                ten_don_vi=inv.ten_don_vi,
                tong_cong=inv.tong_cong,
                da_thanh_toan=inv.da_thanh_toan,
                con_lai=inv.con_lai,
                so_ngay_qua_han=so_ngay_qua_han,
                trang_thai=inv.trang_thai,
            ))
        return rows

    def get_ar_balance(
        self,
        customer_id: int | None,
        tu_ngay: date,
        den_ngay: date
    ) -> dict:
        """Tính số dư công nợ khách hàng trong một khoảng thời gian"""
        so_du_dau = self._calc_balance_before("131", tu_ngay, customer_id=customer_id)
        
        q = self.db.query(
            func.sum(JournalEntryLine.so_tien_no).label("tang"),
            func.sum(JournalEntryLine.so_tien_co).label("giam")
        ).join(JournalEntry).filter(
            JournalEntryLine.so_tk.like("131%"),
            JournalEntry.ngay >= tu_ngay,
            JournalEntry.ngay <= den_ngay
        )
        if customer_id:
            q = q.filter(JournalEntryLine.doi_tuong_id == customer_id)
            
        res = q.one()
        tang = float(res.tang or 0)
        giam = float(res.giam or 0)
        
        return {
            "so_du_dau_ky": so_du_dau,
            "phat_sinh_tang": tang,
            "phat_sinh_giam": giam,
            "so_du_cuoi_ky": so_du_dau + tang - giam
        }

    def get_ar_aging(self, as_of_date: date | None = None) -> list[ARAgingRow]:
        today = as_of_date or date.today()
        self._mark_overdue_ar()

        invoices = (
            self.db.query(SalesInvoice)
            .filter(
                SalesInvoice.trang_thai != "huy",
                SalesInvoice.ngay_hoa_don <= today,
            )
            .order_by(SalesInvoice.customer_id, SalesInvoice.han_tt, SalesInvoice.ngay_hoa_don, SalesInvoice.id)
            .all()
        )

        credits = (
            self.db.query(
                DebtLedgerEntry.customer_id,
                func.coalesce(func.sum(DebtLedgerEntry.so_tien), 0),
            )
            .filter(
                DebtLedgerEntry.doi_tuong == "khach_hang",
                DebtLedgerEntry.loai == "giam_no",
                DebtLedgerEntry.chung_tu_loai == "phieu_thu",
                DebtLedgerEntry.ngay <= today,
            )
            .group_by(DebtLedgerEntry.customer_id)
            .all()
        )
        reversals = (
            self.db.query(
                DebtLedgerEntry.customer_id,
                func.coalesce(func.sum(DebtLedgerEntry.so_tien), 0),
            )
            .filter(
                DebtLedgerEntry.doi_tuong == "khach_hang",
                DebtLedgerEntry.loai == "tang_no",
                DebtLedgerEntry.chung_tu_loai == "huy_phieu_thu",
                DebtLedgerEntry.ngay <= today,
            )
            .group_by(DebtLedgerEntry.customer_id)
            .all()
        )
        credit_by_customer: dict[int, Decimal] = {
            cid: Decimal(str(amount or 0)) for cid, amount in credits if cid
        }
        for cid, amount in reversals:
            if cid:
                credit_by_customer[cid] = credit_by_customer.get(cid, Decimal("0")) - Decimal(str(amount or 0))

        by_customer: dict[int, dict] = {}
        for inv in invoices:
            cid = inv.customer_id
            if cid not in by_customer:
                by_customer[cid] = {
                    "customer_id": cid,
                    "ten_don_vi": inv.ten_don_vi,
                    "trong_han": Decimal("0"),
                    "qua_han_30": Decimal("0"),
                    "qua_han_60": Decimal("0"),
                    "qua_han_90": Decimal("0"),
                    "credit_left": max(Decimal("0"), credit_by_customer.get(cid, Decimal("0"))),
                }

            d = by_customer[cid]
            invoice_amount = inv.tong_cong or Decimal("0")
            applied = min(d["credit_left"], invoice_amount)
            d["credit_left"] -= applied
            con_lai = invoice_amount - applied
            if con_lai <= 0:
                continue

            so_ngay = (today - inv.han_tt).days if inv.han_tt else 0
            if so_ngay <= 0:
                d["trong_han"] += con_lai
            elif so_ngay <= 30:
                d["qua_han_30"] += con_lai
            elif so_ngay <= 60:
                d["qua_han_60"] += con_lai
            else:
                d["qua_han_90"] += con_lai

        result = []
        for d in by_customer.values():
            tong = d["trong_han"] + d["qua_han_30"] + d["qua_han_60"] + d["qua_han_90"]
            if tong <= 0:
                continue
            result.append(ARAgingRow(
                customer_id=d["customer_id"],
                ten_don_vi=d["ten_don_vi"],
                tong_con_lai=tong,
                trong_han=d["trong_han"],
                qua_han_30=d["qua_han_30"],
                qua_han_60=d["qua_han_60"],
                qua_han_90=d["qua_han_90"],
            ))
        return sorted(result, key=lambda r: r.tong_con_lai, reverse=True)

    def get_supplier_reconciliation(self, supplier_id: int, tu_ngay: date, den_ngay: date):
        # 1. Lay danh sach nhap kho (Goods Receipt)
        receipts = (self.db.query(GoodsReceipt)
            .filter(GoodsReceipt.supplier_id == supplier_id)
            .filter(GoodsReceipt.ngay_nhap >= tu_ngay)
            .filter(GoodsReceipt.ngay_nhap <= den_ngay)
            .filter(GoodsReceipt.trang_thai != "huy")
            .options(joinedload(GoodsReceipt.items))
            .order_by(GoodsReceipt.ngay_nhap)
            .all())

        from app.models.purchase import PurchaseOrderItem
        items_detail = []
        total_purchase_amount = Decimal("0")

        for gr in receipts:
            for item in gr.items:
                # Tim don gia tu PurchaseOrderItem
                po_item = None
                if item.po_item_id:
                    po_item = self.db.query(PurchaseOrderItem).get(item.po_item_id)
                
                unit_price = po_item.don_gia if po_item else Decimal("0")
                amount = item.so_luong_thuc_te * unit_price
                total_purchase_amount += amount

                items_detail.append({
                    "ngay": gr.ngay_nhap,
                    "so_phieu": gr.so_phieu,
                    "ten_hang": item.ten_hang,
                    "so_luong": item.so_luong_thuc_te,
                    "dvt": item.dvt,
                    "don_gia": unit_price,
                    "thanh_tien": amount,
                    "ghi_chu": gr.ghi_chu
                })

        # 2. Lay danh sach thanh toan (CashPayment - Phieu chi)
        payments = (self.db.query(CashPayment)
            .filter(CashPayment.supplier_id == supplier_id)
            .filter(CashPayment.ngay_phieu >= tu_ngay)
            .filter(CashPayment.ngay_phieu <= den_ngay)
            .filter(CashPayment.trang_thai != "huy")
            .all())

        total_paid = sum((p.so_tien for p in payments), Decimal("0"))

        return {
            "supplier_id": supplier_id,
            "tu_ngay": tu_ngay,
            "den_ngay": den_ngay,
            "items": items_detail,
            "payments": payments,
            "total_purchase_amount": total_purchase_amount,
            "total_paid_amount": total_paid,
            "balance": total_purchase_amount - total_paid
        }

    # ─────────────────────────────────────────────
    # SỔ CÔNG NỢ PHẢI TRẢ (AP)
    # ─────────────────────────────────────────────
    def get_ar_ledger_entries(
        self,
        customer_id: int | None = None,
        tu_ngay: date | None = None,
        den_ngay: date | None = None,
    ) -> dict:
        start_date = tu_ngay or date(2000, 1, 1)
        end_date = den_ngay or date.today()
        so_du_dau = Decimal(str(self._calc_balance_before(customer_id, None, start_date, "khach_hang")))
        so_du_luy_ke = so_du_dau
        tong_no = Decimal("0")
        tong_co = Decimal("0")

        q = self.db.query(DebtLedgerEntry).filter(
            DebtLedgerEntry.doi_tuong == "khach_hang",
            DebtLedgerEntry.ngay >= start_date,
            DebtLedgerEntry.ngay <= end_date,
        )
        if customer_id:
            q = q.filter(DebtLedgerEntry.customer_id == customer_id)

        rows = []
        for e in q.order_by(DebtLedgerEntry.ngay, DebtLedgerEntry.id).all():
            customer = self.db.get(Customer, e.customer_id) if e.customer_id else None
            invoice = None
            receipt = None
            if e.chung_tu_loai in {"hoa_don_ban", "huy_hoa_don_ban"} and e.chung_tu_id:
                invoice = self.db.get(SalesInvoice, e.chung_tu_id)
            elif e.chung_tu_loai in {"phieu_thu", "huy_phieu_thu"} and e.chung_tu_id:
                receipt = self.db.get(CashReceipt, e.chung_tu_id)

            if e.loai == "tang_no":
                phat_sinh_no = e.so_tien
                phat_sinh_co = Decimal("0")
                so_du_luy_ke += e.so_tien
                tong_no += e.so_tien
            else:
                phat_sinh_no = Decimal("0")
                phat_sinh_co = e.so_tien
                so_du_luy_ke -= e.so_tien
                tong_co += e.so_tien

            rows.append({
                "id": e.id,
                "ngay": e.ngay,
                "customer_id": e.customer_id,
                "ten_don_vi": getattr(customer, "ten_don_vi", None) or getattr(customer, "ten_viet_tat", None),
                "chung_tu_loai": e.chung_tu_loai,
                "chung_tu_id": e.chung_tu_id,
                "so_chung_tu": (
                    getattr(invoice, "so_hoa_don", None)
                    or getattr(receipt, "so_phieu", None)
                    or (f"#{e.chung_tu_id}" if e.chung_tu_id else None)
                ),
                "dien_giai": e.ghi_chu,
                "phat_sinh_no": phat_sinh_no,
                "phat_sinh_co": phat_sinh_co,
                "so_du": so_du_luy_ke,
            })

        return {
            "tu_ngay": start_date,
            "den_ngay": end_date,
            "customer_id": customer_id,
            "so_du_dau_ky": so_du_dau,
            "phat_sinh_no": tong_no,
            "phat_sinh_co": tong_co,
            "so_du_cuoi_ky": so_du_luy_ke,
            "rows": rows,
        }

    def get_ap_ledger(
        self,
        supplier_id: int | None = None,
        tu_ngay: date | None = None,
        den_ngay: date | None = None,
        trang_thai: str | None = None,
        qua_han_only: bool = False,
    ) -> list[APLedgerRow]:
        self._mark_overdue_ap()
        today = date.today()
        q = self.db.query(PurchaseInvoice).filter(PurchaseInvoice.trang_thai != "huy")
        if supplier_id:
            q = q.filter(PurchaseInvoice.supplier_id == supplier_id)
        if tu_ngay:
            q = q.filter(PurchaseInvoice.ngay_lap >= tu_ngay)
        if den_ngay:
            q = q.filter(PurchaseInvoice.ngay_lap <= den_ngay)
        if trang_thai:
            q = q.filter(PurchaseInvoice.trang_thai == trang_thai)
        if qua_han_only:
            q = q.filter(PurchaseInvoice.han_tt < today, PurchaseInvoice.trang_thai != "da_tt_du")

        rows = []
        for inv in q.order_by(PurchaseInvoice.ngay_lap).all():
            so_ngay_qua_han = 0
            if inv.han_tt and inv.han_tt < today and inv.trang_thai != "da_tt_du":
                so_ngay_qua_han = (today - inv.han_tt).days
            rows.append(APLedgerRow(
                invoice_id=inv.id,
                so_hoa_don=inv.so_hoa_don,
                ngay_lap=inv.ngay_lap,
                han_tt=inv.han_tt,
                supplier_id=inv.supplier_id,
                ten_don_vi=inv.ten_don_vi,
                tong_thanh_toan=inv.tong_thanh_toan,
                da_thanh_toan=inv.da_thanh_toan,
                con_lai=inv.con_lai,
                so_ngay_qua_han=so_ngay_qua_han,
                trang_thai=inv.trang_thai,
            ))
        return rows

    def get_ap_aging(self, as_of_date: date | None = None) -> list[APAgingRow]:
        today = as_of_date or date.today()
        self._mark_overdue_ap()

        invoices = (
            self.db.query(PurchaseInvoice)
            .filter(
                PurchaseInvoice.trang_thai.notin_(["huy", "da_tt_du"]),
                PurchaseInvoice.con_lai > 0,
            )
            .all()
        )

        by_supplier: dict[int, dict] = {}
        for inv in invoices:
            sid = inv.supplier_id
            if sid not in by_supplier:
                by_supplier[sid] = {
                    "supplier_id": sid,
                    "ten_don_vi": inv.ten_don_vi,
                    "trong_han": Decimal("0"),
                    "qua_han_30": Decimal("0"),
                    "qua_han_60": Decimal("0"),
                    "qua_han_90": Decimal("0"),
                }
            d = by_supplier[sid]
            so_ngay = (today - inv.han_tt).days if inv.han_tt else 0
            con_lai = inv.con_lai or Decimal("0")
            if so_ngay <= 0:
                d["trong_han"] += con_lai
            elif so_ngay <= 30:
                d["qua_han_30"] += con_lai
            elif so_ngay <= 60:
                d["qua_han_60"] += con_lai
            else:
                d["qua_han_90"] += con_lai

        result = []
        for d in by_supplier.values():
            tong = d["trong_han"] + d["qua_han_30"] + d["qua_han_60"] + d["qua_han_90"]
            result.append(APAgingRow(
                supplier_id=d["supplier_id"],
                ten_don_vi=d["ten_don_vi"],
                tong_con_lai=tong,
                trong_han=d["trong_han"],
                qua_han_30=d["qua_han_30"],
                qua_han_60=d["qua_han_60"],
                qua_han_90=d["qua_han_90"],
            ))
        return sorted(result, key=lambda r: r.tong_con_lai, reverse=True)

    def get_ar_balance(
        self, customer_id: int | None, tu_ngay: date, den_ngay: date
    ) -> BalanceByPeriod:
        so_du_dau = self._calc_balance_before(customer_id, None, tu_ngay, "khach_hang")
        filters_base = [
            DebtLedgerEntry.doi_tuong == "khach_hang",
            DebtLedgerEntry.ngay >= tu_ngay,
            DebtLedgerEntry.ngay <= den_ngay,
        ]
        if customer_id:
            filters_base.append(DebtLedgerEntry.customer_id == customer_id)

        tang = self.db.query(func.coalesce(func.sum(DebtLedgerEntry.so_tien), 0)).filter(
            *filters_base, DebtLedgerEntry.loai == "tang_no"
        ).scalar()
        giam = self.db.query(func.coalesce(func.sum(DebtLedgerEntry.so_tien), 0)).filter(
            *filters_base, DebtLedgerEntry.loai == "giam_no"
        ).scalar()

        return BalanceByPeriod(
            so_du_dau_ky=Decimal(str(so_du_dau)),
            phat_sinh_tang=Decimal(str(tang)),
            phat_sinh_giam=Decimal(str(giam)),
            so_du_cuoi_ky=Decimal(str(so_du_dau)) + Decimal(str(tang)) - Decimal(str(giam)),
        )

    def get_ap_balance(
        self, supplier_id: int | None, tu_ngay: date, den_ngay: date
    ) -> BalanceByPeriod:
        so_du_dau = self._calc_balance_before(None, supplier_id, tu_ngay, "nha_cung_cap")
        filters_base = [
            DebtLedgerEntry.doi_tuong == "nha_cung_cap",
            DebtLedgerEntry.ngay >= tu_ngay,
            DebtLedgerEntry.ngay <= den_ngay,
        ]
        if supplier_id:
            filters_base.append(DebtLedgerEntry.supplier_id == supplier_id)

        tang = self.db.query(func.coalesce(func.sum(DebtLedgerEntry.so_tien), 0)).filter(
            *filters_base, DebtLedgerEntry.loai == "tang_no"
        ).scalar()
        giam = self.db.query(func.coalesce(func.sum(DebtLedgerEntry.so_tien), 0)).filter(
            *filters_base, DebtLedgerEntry.loai == "giam_no"
        ).scalar()

        return BalanceByPeriod(
            so_du_dau_ky=Decimal(str(so_du_dau)),
            phat_sinh_tang=Decimal(str(tang)),
            phat_sinh_giam=Decimal(str(giam)),
            so_du_cuoi_ky=Decimal(str(so_du_dau)) + Decimal(str(tang)) - Decimal(str(giam)),
        )

    # ─────────────────────────────────────────────
    # SỔ DƯ ĐẦU KỲ
    # ─────────────────────────────────────────────
    def create_opening_balance(self, data: OpeningBalanceCreate, user_id: int) -> OpeningBalance:
        ob = OpeningBalance(
            ky_mo_so=data.ky_mo_so,
            doi_tuong=data.doi_tuong,
            customer_id=data.customer_id,
            supplier_id=data.supplier_id,
            so_du_dau_ky=data.so_du_dau_ky,
            ghi_chu=data.ghi_chu,
            created_by=user_id,
        )
        self.db.add(ob)
        self.db.commit()
        self.db.refresh(ob)
        return ob

    # ─────────────────────────────────────────────
    # HELPERS
    # ─────────────────────────────────────────────
    def _calc_balance_before(
        self,
        customer_id: int | None,
        supplier_id: int | None,
        before_date: date,
        doi_tuong: str,
    ) -> float:
        """Tính số dư trước một ngày dựa trên opening_balances + debt_ledger_entries"""
        # Lấy opening balance gần nhất trước before_date
        ob_q = self.db.query(OpeningBalance).filter(
            OpeningBalance.doi_tuong == doi_tuong,
            OpeningBalance.ky_mo_so < before_date,
        )
        if customer_id:
            ob_q = ob_q.filter(OpeningBalance.customer_id == customer_id)
        if supplier_id:
            ob_q = ob_q.filter(OpeningBalance.supplier_id == supplier_id)
        ob = ob_q.order_by(desc(OpeningBalance.ky_mo_so)).first()

        start_date = ob.ky_mo_so if ob else date(2000, 1, 1)
        base = float(ob.so_du_dau_ky) if ob else 0.0

        filters = [
            DebtLedgerEntry.doi_tuong == doi_tuong,
            DebtLedgerEntry.ngay >= start_date,
            DebtLedgerEntry.ngay < before_date,
        ]
        if customer_id:
            filters.append(DebtLedgerEntry.customer_id == customer_id)
        if supplier_id:
            filters.append(DebtLedgerEntry.supplier_id == supplier_id)

        tang = self.db.query(func.coalesce(func.sum(DebtLedgerEntry.so_tien), 0)).filter(
            *filters, DebtLedgerEntry.loai == "tang_no"
        ).scalar()
        giam = self.db.query(func.coalesce(func.sum(DebtLedgerEntry.so_tien), 0)).filter(
            *filters, DebtLedgerEntry.loai == "giam_no"
        ).scalar()
        return base + float(tang) - float(giam)

    def _mark_overdue_ar(self):
        today = date.today()
        self.db.query(SalesInvoice).filter(
            SalesInvoice.han_tt < today,
            SalesInvoice.trang_thai.in_(["da_phat_hanh", "da_tt_mot_phan"]),
        ).update({"trang_thai": "qua_han"}, synchronize_session=False)
        self.db.commit()

    def _mark_overdue_ap(self):
        today = date.today()
        self.db.query(PurchaseInvoice).filter(
            PurchaseInvoice.han_tt < today,
            PurchaseInvoice.trang_thai.in_(["nhap", "da_tt_mot_phan"]),
        ).update({"trang_thai": "qua_han"}, synchronize_session=False)
        self.db.commit()

    # ─────────────────────────────────────────────
    # SỔ CHI TIẾT MUA HÀNG
    # ─────────────────────────────────────────────
    def get_so_chi_tiet_mua_hang(
        self,
        supplier_id: int | None,
        tu_ngay: date,
        den_ngay: date,
    ) -> dict:
        """
        Sổ chi tiết mua hàng theo NCC trong kỳ.
        Trả về: số dư đầu kỳ + từng giao dịch (HĐ mua / phiếu chi / trả hàng) + số dư cuối kỳ.
        """
        from app.models.purchase import PurchaseReturn
        from app.models.master import Supplier as Sup

        so_du_dau = self._calc_balance_before(None, supplier_id, tu_ngay, "nha_cung_cap")

        entries = (
            self.db.query(DebtLedgerEntry)
            .filter(
                DebtLedgerEntry.doi_tuong == "nha_cung_cap",
                DebtLedgerEntry.ngay >= tu_ngay,
                DebtLedgerEntry.ngay <= den_ngay,
                *([DebtLedgerEntry.supplier_id == supplier_id] if supplier_id else []),
            )
            .order_by(DebtLedgerEntry.ngay, DebtLedgerEntry.id)
            .all()
        )

        so_du_luy_ke = Decimal(str(so_du_dau))
        ps_no = Decimal("0")
        ps_co = Decimal("0")
        rows = []
        for e in entries:
            sup = self.db.get(Sup, e.supplier_id) if e.supplier_id else None
            if e.loai == "tang_no":
                so_du_luy_ke += e.so_tien
                phat_sinh_no = e.so_tien
                phat_sinh_co = Decimal("0")
                ps_no += e.so_tien
            else:
                so_du_luy_ke -= e.so_tien
                phat_sinh_no = Decimal("0")
                phat_sinh_co = e.so_tien
                ps_co += e.so_tien
            rows.append({
                "ngay": e.ngay.isoformat(),
                "chung_tu_loai": e.chung_tu_loai,
                "chung_tu_id": e.chung_tu_id,
                "supplier_id": e.supplier_id,
                "ten_ncc": sup.ten_viet_tat if sup else None,
                "dien_giai": e.ghi_chu,
                "phat_sinh_no": float(phat_sinh_no),    # phát sinh Nợ TK 331 = tăng nợ phải trả
                "phat_sinh_co": float(phat_sinh_co),    # phát sinh Có TK 331 = giảm nợ phải trả
                "so_du": float(so_du_luy_ke),
            })

        return {
            "tu_ngay": tu_ngay.isoformat(),
            "den_ngay": den_ngay.isoformat(),
            "supplier_id": supplier_id,
            "so_du_dau_ky": float(so_du_dau),
            "so_du_cuoi_ky": float(so_du_luy_ke),
            "phat_sinh_no": float(ps_no),
            "phat_sinh_co": float(ps_co),
            "rows": rows,
        }

    # ─────────────────────────────────────────────
    # BIÊN BẢN ĐỐI CHIẾU CÔNG NỢ
    # ─────────────────────────────────────────────
    def get_doi_chieu_cong_no(
        self,
        supplier_id: int,
        tu_ngay: date,
        den_ngay: date,
    ) -> dict:
        """
        Biên bản đối chiếu công nợ phải trả với một NCC cụ thể.
        Liệt kê chi tiết: HĐ mua → phiếu chi → trả hàng trong kỳ.
        """
        from app.models.purchase import PurchaseReturn
        from app.models.master import Supplier as Sup

        sup = self.db.get(Sup, supplier_id)
        if not sup:
            raise HTTPException(404, "Không tìm thấy nhà cung cấp")

        so_du_dau = self._calc_balance_before(None, supplier_id, tu_ngay, "nha_cung_cap")

        # Hóa đơn mua trong kỳ
        invoices = (
            self.db.query(PurchaseInvoice)
            .filter(
                PurchaseInvoice.supplier_id == supplier_id,
                PurchaseInvoice.ngay_lap >= tu_ngay,
                PurchaseInvoice.ngay_lap <= den_ngay,
                PurchaseInvoice.trang_thai != "huy",
            )
            .order_by(PurchaseInvoice.ngay_lap)
            .all()
        )

        # Phiếu chi trong kỳ
        payments = (
            self.db.query(CashPayment)
            .filter(
                CashPayment.supplier_id == supplier_id,
                CashPayment.ngay_phieu >= tu_ngay,
                CashPayment.ngay_phieu <= den_ngay,
                CashPayment.trang_thai != "huy",
            )
            .order_by(CashPayment.ngay_phieu)
            .all()
        )

        # Phiếu trả hàng trong kỳ
        returns = (
            self.db.query(PurchaseReturn)
            .filter(
                PurchaseReturn.supplier_id == supplier_id,
                PurchaseReturn.ngay >= tu_ngay,
                PurchaseReturn.ngay <= den_ngay,
                PurchaseReturn.trang_thai == "da_duyet",
            )
            .order_by(PurchaseReturn.ngay)
            .all()
        )

        tong_hoa_don = sum(float(i.tong_thanh_toan) for i in invoices)
        tong_thanh_toan = sum(float(p.so_tien) for p in payments)
        tong_tra_hang = sum(float(r.tong_thanh_toan) for r in returns)
        so_du_cuoi = so_du_dau + tong_hoa_don - tong_thanh_toan - tong_tra_hang

        return {
            "supplier_id": supplier_id,
            "ten_ncc": sup.ten_viet_tat,
            "ma_so_thue": getattr(sup, "ma_so_thue", None),
            "tu_ngay": tu_ngay.isoformat(),
            "den_ngay": den_ngay.isoformat(),
            "so_du_dau_ky": so_du_dau,
            "hoa_don": [
                {
                    "id": i.id,
                    "so_hoa_don": i.so_hoa_don,
                    "ngay": i.ngay_lap.isoformat(),
                    "tong_thanh_toan": float(i.tong_thanh_toan),
                    "da_thanh_toan": float(i.da_thanh_toan),
                    "con_lai": float(i.con_lai),
                    "trang_thai": i.trang_thai,
                }
                for i in invoices
            ],
            "thanh_toan": [
                {
                    "id": p.id,
                    "so_phieu": p.so_phieu,
                    "ngay": p.ngay_phieu.isoformat(),
                    "so_tien": float(p.so_tien),
                    "hinh_thuc": p.hinh_thuc_tt,
                    "invoice_id": p.purchase_invoice_id,
                }
                for p in payments
            ],
            "tra_hang": [
                {
                    "id": r.id,
                    "so_phieu": r.so_phieu,
                    "ngay": r.ngay.isoformat(),
                    "loai": r.loai,
                    "tong_thanh_toan": float(r.tong_thanh_toan),
                }
                for r in returns
            ],
            "tong_hoa_don": tong_hoa_don,
            "tong_thanh_toan": tong_thanh_toan,
            "tong_tra_hang": tong_tra_hang,
            "so_du_cuoi_ky": so_du_cuoi,
        }

    # ─────────────────────────────────────────────
    # SỔ QUỸ TIỀN MẶT
    # ─────────────────────────────────────────────
    def get_cash_book(self, tu_ngay: date, den_ngay: date) -> dict:
        """Sổ quỹ tiền mặt: thu/chi tiền mặt trong kỳ + số dư."""
        _CASH_HTTT = {"tien_mat", "TM"}

        receipts = (
            self.db.query(CashReceipt)
            .filter(
                CashReceipt.hinh_thuc_tt.in_(_CASH_HTTT),
                CashReceipt.trang_thai == "da_duyet",
                CashReceipt.ngay_phieu >= tu_ngay,
                CashReceipt.ngay_phieu <= den_ngay,
            )
            .order_by(CashReceipt.ngay_phieu, CashReceipt.so_phieu)
            .all()
        )
        payments = (
            self.db.query(CashPayment)
            .filter(
                CashPayment.hinh_thuc_tt.in_(_CASH_HTTT),
                CashPayment.trang_thai.in_(["da_chot", "da_duyet"]),
                CashPayment.ngay_phieu >= tu_ngay,
                CashPayment.ngay_phieu <= den_ngay,
            )
            .order_by(CashPayment.ngay_phieu, CashPayment.so_phieu)
            .all()
        )

        # Số dư đầu kỳ: dùng opening balance từ AMIS migration làm gốc (nếu có)
        ob_cash = (
            self.db.query(OpeningBalance)
            .filter(OpeningBalance.doi_tuong == "quy_tien_mat", OpeningBalance.ky_mo_so < tu_ngay)
            .order_by(desc(OpeningBalance.ky_mo_so))
            .first()
        )
        ob_date = ob_cash.ky_mo_so if ob_cash else date(2000, 1, 1)
        ob_amount = Decimal(str(ob_cash.so_du_dau_ky)) if ob_cash else Decimal("0")
        thu_truoc = self.db.query(func.coalesce(func.sum(CashReceipt.so_tien), 0)).filter(
            CashReceipt.hinh_thuc_tt.in_(_CASH_HTTT),
            CashReceipt.trang_thai == "da_duyet",
            CashReceipt.ngay_phieu >= ob_date,
            CashReceipt.ngay_phieu < tu_ngay,
        ).scalar()
        chi_truoc = self.db.query(func.coalesce(func.sum(CashPayment.so_tien), 0)).filter(
            CashPayment.hinh_thuc_tt.in_(_CASH_HTTT),
            CashPayment.trang_thai.in_(["da_chot", "da_duyet"]),
            CashPayment.ngay_phieu >= ob_date,
            CashPayment.ngay_phieu < tu_ngay,
        ).scalar()
        so_du_dau = ob_amount + Decimal(str(thu_truoc)) - Decimal(str(chi_truoc))

        entries = []
        for r in receipts:
            kh = self.db.get(Customer, r.customer_id)
            entries.append({
                "ngay": r.ngay_phieu,
                "so_chung_tu": r.so_phieu,
                "loai": "thu",
                "doi_tuong": getattr(kh, "ten_viet_tat", None) or getattr(kh, "ten_don_vi", None),
                "dien_giai": r.dien_giai or f"Thu tiền mặt từ khách hàng",
                "thu": Decimal(str(r.so_tien)),
                "chi": Decimal("0"),
            })
        for p in payments:
            ncc = self.db.get(Supplier, p.supplier_id)
            entries.append({
                "ngay": p.ngay_phieu,
                "so_chung_tu": p.so_phieu,
                "loai": "chi",
                "doi_tuong": getattr(ncc, "ten_viet_tat", None) or getattr(ncc, "ten_don_vi", None),
                "dien_giai": p.dien_giai or f"Chi tiền mặt cho nhà cung cấp",
                "thu": Decimal("0"),
                "chi": Decimal(str(p.so_tien)),
            })

        entries.sort(key=lambda x: (x["ngay"], x["so_chung_tu"]))

        balance = so_du_dau
        for e in entries:
            balance = balance + e["thu"] - e["chi"]
            e["so_du"] = balance

        tong_thu = sum(e["thu"] for e in entries)
        tong_chi = sum(e["chi"] for e in entries)

        return {
            "so_du_dau": so_du_dau,
            "tong_thu": tong_thu,
            "tong_chi": tong_chi,
            "so_du_cuoi": so_du_dau + tong_thu - tong_chi,
            "entries": entries,
        }

    # ─────────────────────────────────────────────
    # SỔ NGÂN HÀNG
    # ─────────────────────────────────────────────
    def get_bank_ledger(
        self,
        tu_ngay: date,
        den_ngay: date,
        so_tai_khoan: str | None = None,
    ) -> dict:
        """Sổ ngân hàng: thu/chi chuyển khoản trong kỳ."""
        _BANK_HTTT = {"chuyen_khoan", "CK"}

        r_q = self.db.query(CashReceipt).filter(
            CashReceipt.hinh_thuc_tt.in_(_BANK_HTTT),
            CashReceipt.trang_thai == "da_duyet",
            CashReceipt.ngay_phieu >= tu_ngay,
            CashReceipt.ngay_phieu <= den_ngay,
        )
        p_q = self.db.query(CashPayment).filter(
            CashPayment.hinh_thuc_tt.in_(_BANK_HTTT),
            CashPayment.trang_thai.in_(["da_chot", "da_duyet"]),
            CashPayment.ngay_phieu >= tu_ngay,
            CashPayment.ngay_phieu <= den_ngay,
        )
        if so_tai_khoan:
            r_q = r_q.filter(CashReceipt.so_tai_khoan == so_tai_khoan)
            p_q = p_q.filter(CashPayment.so_tai_khoan == so_tai_khoan)

        receipts = r_q.order_by(CashReceipt.ngay_phieu, CashReceipt.so_phieu).all()
        payments = p_q.order_by(CashPayment.ngay_phieu, CashPayment.so_phieu).all()

        # Số dư đầu kỳ
        r_prev_q = self.db.query(func.coalesce(func.sum(CashReceipt.so_tien), 0)).filter(
            CashReceipt.hinh_thuc_tt.in_(_BANK_HTTT),
            CashReceipt.trang_thai == "da_duyet",
            CashReceipt.ngay_phieu < tu_ngay,
        )
        p_prev_q = self.db.query(func.coalesce(func.sum(CashPayment.so_tien), 0)).filter(
            CashPayment.hinh_thuc_tt.in_(_BANK_HTTT),
            CashPayment.trang_thai.in_(["da_chot", "da_duyet"]),
            CashPayment.ngay_phieu < tu_ngay,
        )
        if so_tai_khoan:
            r_prev_q = r_prev_q.filter(CashReceipt.so_tai_khoan == so_tai_khoan)
            p_prev_q = p_prev_q.filter(CashPayment.so_tai_khoan == so_tai_khoan)

        so_du_dau = Decimal(str(r_prev_q.scalar())) - Decimal(str(p_prev_q.scalar()))

        entries = []
        for r in receipts:
            kh = self.db.get(Customer, r.customer_id)
            entries.append({
                "ngay": r.ngay_phieu,
                "so_chung_tu": r.so_phieu,
                "loai": "thu",
                "doi_tuong": getattr(kh, "ten_viet_tat", None) or getattr(kh, "ten_don_vi", None),
                "dien_giai": r.dien_giai or "Thu chuyển khoản",
                "so_tham_chieu": r.so_tham_chieu,
                "thu": Decimal(str(r.so_tien)),
                "chi": Decimal("0"),
            })
        for p in payments:
            ncc = self.db.get(Supplier, p.supplier_id)
            entries.append({
                "ngay": p.ngay_phieu,
                "so_chung_tu": p.so_phieu,
                "loai": "chi",
                "doi_tuong": getattr(ncc, "ten_viet_tat", None) or getattr(ncc, "ten_don_vi", None),
                "dien_giai": p.dien_giai or "Chi chuyển khoản",
                "so_tham_chieu": p.so_tham_chieu,
                "thu": Decimal("0"),
                "chi": Decimal(str(p.so_tien)),
            })

        entries.sort(key=lambda x: (x["ngay"], x["so_chung_tu"]))

        balance = so_du_dau
        for e in entries:
            balance = balance + e["thu"] - e["chi"]
            e["so_du"] = balance

        tong_thu = sum(e["thu"] for e in entries)
        tong_chi = sum(e["chi"] for e in entries)

        return {
            "so_du_dau": so_du_dau,
            "tong_thu": tong_thu,
            "tong_chi": tong_chi,
            "so_du_cuoi": so_du_dau + tong_thu - tong_chi,
            "entries": entries,
        }

    # ─────────────────────────────────────────────
    # PHIẾU HOÀN TIỀN KHÁCH HÀNG
    # ─────────────────────────────────────────────
    def list_customer_refunds(
        self,
        customer_id: int | None = None,
        sales_return_id: int | None = None,
        trang_thai: str | None = None,
        tu_ngay: date | None = None,
        den_ngay: date | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        from app.models.sales import SalesReturn
        q = self.db.query(CustomerRefundVoucher)
        if customer_id:
            q = q.filter(CustomerRefundVoucher.customer_id == customer_id)
        if sales_return_id:
            q = q.filter(CustomerRefundVoucher.sales_return_id == sales_return_id)
        if trang_thai:
            q = q.filter(CustomerRefundVoucher.trang_thai == trang_thai)
        if tu_ngay:
            q = q.filter(CustomerRefundVoucher.ngay >= tu_ngay)
        if den_ngay:
            q = q.filter(CustomerRefundVoucher.ngay <= den_ngay)
        total = q.count()
        items = q.order_by(desc(CustomerRefundVoucher.ngay)).offset((page - 1) * page_size).limit(page_size).all()
        result = []
        for v in items:
            customer = self.db.get(Customer, v.customer_id)
            sr = self.db.get(SalesReturn, v.sales_return_id)
            result.append(self._refund_to_dict(v, customer, sr))
        return {"total": total, "page": page, "page_size": page_size, "items": result}

    def _refund_to_dict(self, v: CustomerRefundVoucher, customer=None, sr=None) -> dict:
        if customer is None:
            customer = self.db.get(Customer, v.customer_id)
        if sr is None:
            from app.models.sales import SalesReturn
            sr = self.db.get(SalesReturn, v.sales_return_id)
        return {
            "id": v.id,
            "so_phieu": v.so_phieu,
            "ngay": v.ngay,
            "customer_id": v.customer_id,
            "ten_khach_hang": getattr(customer, "ten_viet_tat", None) or getattr(customer, "ten_don_vi", None),
            "sales_return_id": v.sales_return_id,
            "so_phieu_tra": getattr(sr, "so_phieu_tra", None),
            "sales_invoice_id": v.sales_invoice_id,
            "so_tien": v.so_tien,
            "hinh_thuc": v.hinh_thuc,
            "tk_hoan_tien": v.tk_hoan_tien,
            "dien_giai": v.dien_giai,
            "trang_thai": v.trang_thai,
            "nguoi_duyet_id": v.nguoi_duyet_id,
            "ngay_duyet": v.ngay_duyet,
            "created_by": v.created_by,
            "created_at": v.created_at,
            "phap_nhan_id": v.phap_nhan_id,
            "phan_xuong_id": v.phan_xuong_id,
        }

    def get_customer_refund(self, voucher_id: int) -> dict:
        v = self.db.query(CustomerRefundVoucher).filter(CustomerRefundVoucher.id == voucher_id).first()
        if not v:
            raise HTTPException(404, "Không tìm thấy phiếu hoàn tiền")
        return self._refund_to_dict(v)

    def update_customer_refund(self, voucher_id: int, data: CustomerRefundVoucherUpdate) -> dict:
        v = self.db.query(CustomerRefundVoucher).filter(CustomerRefundVoucher.id == voucher_id).first()
        if not v:
            raise HTTPException(404, "Không tìm thấy phiếu hoàn tiền")
        if v.trang_thai != "nhap":
            raise HTTPException(400, "Chỉ có thể sửa phiếu ở trạng thái Nháp")
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(v, field, value)
        self.db.commit()
        return self.get_customer_refund(voucher_id)

    def approve_customer_refund(self, voucher_id: int, user_id: int) -> dict:
        v = self.db.query(CustomerRefundVoucher).filter(CustomerRefundVoucher.id == voucher_id).first()
        if not v:
            raise HTTPException(404, "Không tìm thấy phiếu hoàn tiền")
        if v.trang_thai != "nhap":
            raise HTTPException(400, f"Phiếu hoàn tiền đang ở trạng thái '{v.trang_thai}', không thể duyệt")
        if not v.hinh_thuc:
            raise HTTPException(400, "Chưa chọn hình thức hoàn tiền (bù trừ / hoàn tiền mặt/CK)")
        if v.hinh_thuc == "hoan_tien" and not v.tk_hoan_tien:
            raise HTTPException(400, "Chưa chọn tài khoản hoàn tiền (111 hoặc 112)")

        so_tien = float(v.so_tien)
        ngay = v.ngay

        # 1. Ghi sổ công nợ — giảm AR
        self.db.add(DebtLedgerEntry(
            ngay=ngay,
            loai="giam_no",
            doi_tuong="khach_hang",
            customer_id=v.customer_id,
            chung_tu_loai="phieu_hoan_tien",
            chung_tu_id=v.id,
            so_tien=v.so_tien,
            ghi_chu=v.dien_giai or f"Hoàn tiền trả hàng {v.so_phieu}",
        ))

        # 2. Bút toán: Dr 5213 / Cr 131
        self._create_journal_entry(
            ngay=ngay,
            dien_giai=v.dien_giai or f"Hàng bán trả lại — {v.so_phieu}",
            loai_but_toan="tra_hang_ban",
            chung_tu_loai="phieu_hoan_tien",
            chung_tu_id=v.id,
            lines=[
                {"so_tk": "5213", "dien_giai": "Giảm doanh thu hàng trả", "so_tien_no": so_tien, "so_tien_co": 0},
                {"so_tk": "131", "dien_giai": f"Giảm phải thu KH {v.customer_id}", "so_tien_no": 0, "so_tien_co": so_tien},
            ],
            phap_nhan_id=v.phap_nhan_id,
            phan_xuong_id=v.phan_xuong_id,
        )

        # 3. Nếu hoàn tiền thực: Dr 131 / Cr 111 hoặc 112
        if v.hinh_thuc == "hoan_tien":
            tk_hoan = v.tk_hoan_tien or "111"
            self._create_journal_entry(
                ngay=ngay,
                dien_giai=f"Hoàn tiền KH — {v.so_phieu}",
                loai_but_toan="hoan_tien_khach_hang",
                chung_tu_loai="phieu_hoan_tien",
                chung_tu_id=v.id,
                lines=[
                    {"so_tk": "131", "dien_giai": f"Giảm phải thu KH {v.customer_id}", "so_tien_no": so_tien, "so_tien_co": 0},
                    {"so_tk": tk_hoan, "dien_giai": f"Chi hoàn tiền KH — {v.so_phieu}", "so_tien_no": 0, "so_tien_co": so_tien},
                ],
                phap_nhan_id=v.phap_nhan_id,
                phan_xuong_id=v.phan_xuong_id,
            )

        v.trang_thai = "da_duyet"
        v.nguoi_duyet_id = user_id
        v.ngay_duyet = datetime.utcnow()
        self.db.commit()
        return self.get_customer_refund(voucher_id)

    def cancel_customer_refund(self, voucher_id: int) -> dict:
        v = self.db.query(CustomerRefundVoucher).filter(CustomerRefundVoucher.id == voucher_id).first()
        if not v:
            raise HTTPException(404, "Không tìm thấy phiếu hoàn tiền")
        if v.trang_thai == "huy":
            return self.get_customer_refund(voucher_id)
        if v.trang_thai == "da_duyet":
            self._reverse_journal_entries("phieu_hoan_tien", v.id)
            self.db.query(DebtLedgerEntry).filter(
                DebtLedgerEntry.chung_tu_loai == "phieu_hoan_tien",
                DebtLedgerEntry.chung_tu_id == voucher_id,
            ).delete(synchronize_session=False)
        v.trang_thai = "huy"
        self.db.commit()
        return self.get_customer_refund(voucher_id)

    def get_customer_reconciliation(self, customer_id: int, tu_ngay: date, den_ngay: date):
        from app.models.sales import SalesOrderItem
        deliveries = (self.db.query(DeliveryOrder)
            .filter(DeliveryOrder.customer_id == customer_id)
            .filter(DeliveryOrder.ngay_xuat >= tu_ngay)
            .filter(DeliveryOrder.ngay_xuat <= den_ngay)
            .filter(DeliveryOrder.trang_thai != "huy")
            .options(joinedload(DeliveryOrder.items))
            .order_by(DeliveryOrder.ngay_xuat)
            .all())

        items_detail = []
        total_amount = Decimal("0")

        for do in deliveries:
            for item in do.items:
                so_item = None
                if item.sales_order_item_id:
                    so_item = self.db.query(SalesOrderItem).get(item.sales_order_item_id)
                unit_price = so_item.don_gia if so_item else Decimal("0")
                amount = item.so_luong * unit_price
                total_amount += amount
                items_detail.append({
                    "ngay": do.ngay_xuat,
                    "so_phieu": do.so_phieu,
                    "ten_hang": item.ten_hang,
                    "so_luong": item.so_luong,
                    "dvt": item.dvt,
                    "don_gia": unit_price,
                    "thanh_tien": amount,
                    "ghi_chu": do.ghi_chu,
                })

        payments = (self.db.query(CashReceipt)
            .filter(CashReceipt.customer_id == customer_id)
            .filter(CashReceipt.ngay_phieu >= tu_ngay)
            .filter(CashReceipt.ngay_phieu <= den_ngay)
            .filter(CashReceipt.trang_thai != "huy")
            .all())

        total_paid = sum((p.so_tien for p in payments), Decimal("0"))

        return {
            "customer_id": customer_id,
            "tu_ngay": tu_ngay,
            "den_ngay": den_ngay,
            "items": items_detail,
            "payments": payments,
            "total_delivery_amount": total_amount,
            "total_paid_amount": total_paid,
            "balance": total_amount - total_paid,
        }

    def get_general_ledger(
        self,
        so_tk: str,
        tu_ngay: date,
        den_ngay: date,
        phap_nhan_id: int | None = None,
        phan_xuong_id: int | None = None,
    ):
        """Truy vấn sổ cái tài khoản (General Ledger)"""
        from app.models.accounting import ChartOfAccounts
        acc = self.db.query(ChartOfAccounts).filter(ChartOfAccounts.so_tk == so_tk).first()
        if not acc:
            raise HTTPException(404, f"Không tìm thấy tài khoản {so_tk}")

        # 1. Tinh so du dau ky
        base_pre = self.db.query(JournalEntryLine).join(JournalEntry).filter(JournalEntryLine.so_tk == so_tk, JournalEntry.ngay_but_toan < tu_ngay)
        if phap_nhan_id:
            base_pre = base_pre.filter(JournalEntry.phap_nhan_id == phap_nhan_id)
        if phan_xuong_id:
            base_pre = base_pre.filter(JournalEntry.phan_xuong_id == phan_xuong_id)
            
        pre_no = base_pre.with_entities(func.coalesce(func.sum(JournalEntryLine.so_tien_no), 0)).scalar() or Decimal("0")
        pre_co = base_pre.with_entities(func.coalesce(func.sum(JournalEntryLine.so_tien_co), 0)).scalar() or Decimal("0")

        so_du_dau = pre_no - pre_co

        # 2. Lay cac but toan trong ky
        query = self.db.query(JournalEntryLine)\
            .join(JournalEntry)\
            .filter(JournalEntryLine.so_tk == so_tk)\
            .filter(JournalEntry.ngay_but_toan >= tu_ngay)\
            .filter(JournalEntry.ngay_but_toan <= den_ngay)
            
        if phap_nhan_id:
            query = query.filter(JournalEntry.phap_nhan_id == phap_nhan_id)
        if phan_xuong_id:
            query = query.filter(JournalEntry.phan_xuong_id == phan_xuong_id)
            
        lines = query.options(joinedload(JournalEntryLine.entry)).order_by(JournalEntry.ngay_but_toan, JournalEntry.so_but_toan).all()

        rows = []
        current_balance = so_du_dau
        for line in lines:
            current_balance += (line.so_tien_no - line.so_tien_co)
            rows.append({
                "id": line.id,
                "ngay": line.entry.ngay_but_toan,
                "so_phieu": line.entry.so_but_toan,
                "dien_giai": line.dien_giai or line.entry.dien_giai,
                "tk_doi_ung": self._get_tk_doi_ung(line.entry.id, so_tk),
                "phat_sinh_no": line.so_tien_no,
                "phat_sinh_co": line.so_tien_co,
                "so_du": current_balance,
                "chung_tu_loai": line.entry.chung_tu_loai,
                "chung_tu_id": line.entry.chung_tu_id
            })

        return {
            "so_tk": so_tk,
            "ten_tk": acc.ten_tk,
            "tu_ngay": tu_ngay,
            "den_ngay": den_ngay,
            "so_du_dau": so_du_dau,
            "rows": rows,
            "so_du_cuoi": current_balance
        }

    def _get_tk_doi_ung(self, entry_id: int, current_tk: str) -> str:
        other = self.db.query(JournalEntryLine.so_tk)\
            .filter(JournalEntryLine.entry_id == entry_id)\
            .filter(JournalEntryLine.so_tk != current_tk)\
            .first()
        return other[0] if other else ""

    def get_trial_balance(self, tu_ngay: date, den_ngay: date, phap_nhan_id: int | None = None, phan_xuong_id: int | None = None):
        """Bảng cân đối số phát sinh"""
        from app.models.accounting import ChartOfAccounts
        accounts = self.db.query(ChartOfAccounts).order_by(ChartOfAccounts.so_tk).all()
        
        result = []
        for acc in accounts:
            # Base query cho so du dau
            base_pre = self.db.query(JournalEntryLine).join(JournalEntry).filter(JournalEntryLine.so_tk == acc.so_tk, JournalEntry.ngay_but_toan < tu_ngay)
            # Base query cho phat sinh
            base_cur = self.db.query(JournalEntryLine).join(JournalEntry).filter(JournalEntryLine.so_tk == acc.so_tk, JournalEntry.ngay_but_toan >= tu_ngay, JournalEntry.ngay_but_toan <= den_ngay)
            
            if phap_nhan_id:
                base_pre = base_pre.filter(JournalEntry.phap_nhan_id == phap_nhan_id)
                base_cur = base_cur.filter(JournalEntry.phap_nhan_id == phap_nhan_id)
            if phan_xuong_id:
                base_pre = base_pre.filter(JournalEntry.phan_xuong_id == phan_xuong_id)
                base_cur = base_cur.filter(JournalEntry.phan_xuong_id == phan_xuong_id)

            pre_no = base_pre.with_entities(func.coalesce(func.sum(JournalEntryLine.so_tien_no), 0)).scalar() or Decimal("0")
            pre_co = base_pre.with_entities(func.coalesce(func.sum(JournalEntryLine.so_tien_co), 0)).scalar() or Decimal("0")

            cur_no = base_cur.with_entities(func.coalesce(func.sum(JournalEntryLine.so_tien_no), 0)).scalar() or Decimal("0")
            cur_co = base_cur.with_entities(func.coalesce(func.sum(JournalEntryLine.so_tien_co), 0)).scalar() or Decimal("0")
            
            so_du_dau = pre_no - pre_co
            so_du_cuoi = so_du_dau + cur_no - cur_co
            
            if so_du_dau != 0 or cur_no != 0 or cur_co != 0:
                result.append({
                    "so_tk": acc.so_tk,
                    "ten_tk": acc.ten_tk,
                    "so_du_dau": so_du_dau,
                    "phat_sinh_no": cur_no,
                    "phat_sinh_co": cur_co,
                    "so_du_cuoi": so_du_cuoi
                })
        
        return result

    def get_workshop_pnl(self, phan_xuong_id: int, tu_ngay: date, den_ngay: date):
        """Báo cáo Lãi/Lỗ theo phân xưởng (management P&L)."""
        # Dimension filter: prefer line-level tag, fall back to header-level
        px_filter = or_(
            JournalEntryLine.phan_xuong_id == phan_xuong_id,
            and_(
                JournalEntryLine.phan_xuong_id.is_(None),
                JournalEntry.phan_xuong_id == phan_xuong_id,
            ),
        )
        date_filter = and_(
            JournalEntry.ngay_but_toan >= tu_ngay,
            JournalEntry.ngay_but_toan <= den_ngay,
        )

        base = self.db.query(JournalEntryLine).join(JournalEntry).filter(px_filter, date_filter)

        def _no(tk_like: str | None = None, loai: str | None = None) -> Decimal:
            q = base.with_entities(func.coalesce(func.sum(JournalEntryLine.so_tien_no), 0))
            if tk_like:
                q = q.filter(JournalEntryLine.so_tk.like(tk_like))
            if loai:
                q = q.filter(JournalEntry.loai_but_toan == loai)
            return Decimal(str(q.scalar() or 0))

        def _co(tk_like: str | None = None, loai: str | None = None) -> Decimal:
            q = base.with_entities(func.coalesce(func.sum(JournalEntryLine.so_tien_co), 0))
            if tk_like:
                q = q.filter(JournalEntryLine.so_tk.like(tk_like))
            if loai:
                q = q.filter(JournalEntry.loai_but_toan == loai)
            return Decimal(str(q.scalar() or 0))

        # Revenue
        doanh_thu_noi_bo = _co("5112%")          # internal transfer at standard price
        doanh_thu_ngoai  = _co("511%") - doanh_thu_noi_bo  # external sales
        tong_doanh_thu   = doanh_thu_ngoai + doanh_thu_noi_bo

        # COGS
        gia_von_noi_bo = _no("6322%")             # internal transfer at actual cost
        gia_von_ngoai  = _no("632%") - gia_von_noi_bo      # external COGS
        tong_gia_von   = gia_von_ngoai + gia_von_noi_bo

        loi_nhuan_gop = tong_doanh_thu - tong_gia_von

        # Goal 3: efficiency variance (positive = workshop beat standard cost)
        bien_dong_dinh_muc = doanh_thu_noi_bo - gia_von_noi_bo

        # Period operating costs — memo breakdown (already absorbed into COGS via 154)
        cp_nhan_cong = _no("154%", "luong_nhan_cong")
        cp_khau_hao  = _no("154%", "khau_hao_ts")
        cp_phan_bo   = _no(loai="phan_bo_chi_phi")

        # Period SG&A — deducted directly from gross profit
        cp_ban_hang = _no("641%")
        cp_quan_ly  = _no("642%")

        loi_nhuan_thuan = loi_nhuan_gop - cp_ban_hang - cp_quan_ly

        return {
            "phan_xuong_id": phan_xuong_id,
            "tu_ngay": tu_ngay,
            "den_ngay": den_ngay,
            # Revenue
            "doanh_thu_ngoai":  doanh_thu_ngoai,
            "doanh_thu_noi_bo": doanh_thu_noi_bo,
            "tong_doanh_thu":   tong_doanh_thu,
            # COGS
            "gia_von_ngoai":  gia_von_ngoai,
            "gia_von_noi_bo": gia_von_noi_bo,
            "tong_gia_von":   tong_gia_von,
            # Profit
            "loi_nhuan_gop":   loi_nhuan_gop,
            # Goal 3: standard-cost efficiency
            "bien_dong_dinh_muc": bien_dong_dinh_muc,
            # Goal 2: cost breakdown (memo — already in COGS)
            "cp_nhan_cong": cp_nhan_cong,
            "cp_khau_hao":  cp_khau_hao,
            "cp_phan_bo":   cp_phan_bo,
            # Period SG&A
            "cp_ban_hang": cp_ban_hang,
            "cp_quan_ly":  cp_quan_ly,
            # Bottom line
            "loi_nhuan_thuan": loi_nhuan_thuan,
        }

    def get_legal_entity_cashflow(self, phap_nhan_id: int, tu_ngay: date, den_ngay: date):
        """Báo cáo dòng tiền theo pháp nhân"""
        # 1. Thu tiền (Inflow)
        inflow = self.db.query(func.sum(CashReceipt.so_tien))\
            .filter(CashReceipt.phap_nhan_id == phap_nhan_id)\
            .filter(CashReceipt.ngay_phieu >= tu_ngay)\
            .filter(CashReceipt.ngay_phieu <= den_ngay)\
            .filter(CashReceipt.trang_thai == "da_duyet")\
            .scalar() or Decimal("0")

        # 2. Chi tiền (Outflow)
        outflow = self.db.query(func.sum(CashPayment.so_tien))\
            .filter(CashPayment.phap_nhan_id == phap_nhan_id)\
            .filter(CashPayment.ngay_phieu >= tu_ngay)\
            .filter(CashPayment.ngay_phieu <= den_ngay)\
            .filter(CashPayment.trang_thai == "da_duyet")\
            .scalar() or Decimal("0")

        return {
            "phap_nhan_id": phap_nhan_id,
            "tu_ngay": tu_ngay,
            "den_ngay": den_ngay,
            "tong_thu": inflow,
            "tong_chi": outflow,
            "dong_tien_thuan": inflow - outflow
        }

    # ─────────────────────────────────────────────
    # BẢNG LƯƠNG XƯỞNG
    # ─────────────────────────────────────────────
    def create_workshop_payroll(self, data: WorkshopPayrollCreate, user_id: int) -> WorkshopPayroll:
        wp = WorkshopPayroll(
            so_phieu=self._gen_so_phieu("WPR", WorkshopPayroll),
            thang=data.thang,
            phan_xuong_id=data.phan_xuong_id,
            phap_nhan_id=data.phap_nhan_id,
            tong_luong=data.tong_luong,
            tong_thuong=data.tong_thuong,
            tong_bao_hiem=data.tong_bao_hiem,
            ghi_chu=data.ghi_chu,
            created_by=user_id,
        )
        self.db.add(wp)
        self.db.commit()
        self.db.refresh(wp)
        return wp

    def approve_workshop_payroll(self, wp_id: int, user_id: int) -> WorkshopPayroll:
        wp = self.db.query(WorkshopPayroll).get(wp_id)
        if not wp:
            raise HTTPException(404, "Không tìm thấy bảng lương")
        if wp.bo_qua_hach_toan:
            wp.trang_thai = "da_duyet"
            self.db.commit()
            return wp
        
        tong_no_154 = float(wp.tong_luong + wp.tong_thuong + wp.tong_bao_hiem)
        lines = [
            {"so_tk": "154", "dien_giai": "Chi phí lương+thưởng+BHXH phân xưởng",
             "so_tien_no": tong_no_154, "so_tien_co": 0},
            {"so_tk": "334", "dien_giai": "Lương+thưởng phải trả NLĐ",
             "so_tien_no": 0, "so_tien_co": float(wp.tong_luong + wp.tong_thuong)},
        ]
        if wp.tong_bao_hiem > 0:
            lines.append({
                "so_tk": "338", "dien_giai": "BHXH/BHYT/BHTN công ty đóng",
                "so_tien_no": 0, "so_tien_co": float(wp.tong_bao_hiem),
            })
        self._create_journal_entry(
            ngay=date.today(),
            dien_giai=f"Lương xưởng tháng {wp.thang} - {wp.so_phieu}",
            loai_but_toan="luong_nhan_cong",
            chung_tu_loai="workshop_payroll",
            chung_tu_id=wp.id,
            phap_nhan_id=wp.phap_nhan_id,
            phan_xuong_id=wp.phan_xuong_id,
            lines=lines,
        )
        
        wp.trang_thai = "da_duyet"
        self.db.commit()
        return wp

    def list_workshop_payroll(self, phan_xuong_id: int | None = None, phap_nhan_id: int | None = None) -> list[WorkshopPayroll]:
        q = self.db.query(WorkshopPayroll)
        if phan_xuong_id:
            q = q.filter(WorkshopPayroll.phan_xuong_id == phan_xuong_id)
        if phap_nhan_id:
            q = q.filter(WorkshopPayroll.phap_nhan_id == phap_nhan_id)
        return q.order_by(WorkshopPayroll.created_at.desc()).all()

    # ─────────────────────────────────────────────
    # KHẤU HAO TÀI SẢN CỐ ĐỊNH
    # ─────────────────────────────────────────────
    def create_fixed_asset(self, data: FixedAssetCreate) -> FixedAsset:
        fa = FixedAsset(**data.model_dump())
        self.db.add(fa)
        self.db.commit()
        return fa

    def list_fixed_assets(self, phan_xuong_id: int | None = None, phap_nhan_id: int | None = None) -> list[FixedAsset]:
        q = self.db.query(FixedAsset)
        if phan_xuong_id:
            q = q.filter(FixedAsset.phan_xuong_id == phan_xuong_id)
        if phap_nhan_id:
            q = q.filter(FixedAsset.phap_nhan_id == phap_nhan_id)
        return q.all()

    def run_monthly_depreciation(self, thang: int, nam: int, phap_nhan_id: int, user_id: int):
        # 0. Kiểm tra đã chạy chưa
        existing = self.db.query(JournalEntry).filter(
            JournalEntry.loai_but_toan == "khau_hao_ts",
            JournalEntry.phap_nhan_id == phap_nhan_id,
            func.extract('month', JournalEntry.ngay_but_toan) == thang,
            func.extract('year', JournalEntry.ngay_but_toan) == nam
        ).first()
        if existing:
            raise HTTPException(400, f"Đã chạy khấu hao cho tháng {thang}/{nam} rồi.")

        """Chạy khấu hao hàng tháng cho toàn bộ tài sản"""
        target_date = date(nam, thang, 1) # Ngày đại diện cho kỳ khấu hao
        
        # Lấy danh sách tài sản đang sử dụng
        assets = self.db.query(FixedAsset).filter(
            FixedAsset.phap_nhan_id == phap_nhan_id,
            FixedAsset.trang_thai == "dang_su_dung",
            FixedAsset.ngay_mua <= target_date
        ).all()

        next_month_date = date(nam + 1, 1, 1) if thang == 12 else date(nam, thang + 1, 1)

        results = []
        for asset in assets:
            if asset.bo_qua_hach_toan:
                results.append({"ma_ts": asset.ma_ts, "status": "skipped_bo_qua"})
                continue
            already_done = self.db.query(JournalEntry).filter(
                JournalEntry.loai_but_toan == "khau_hao_ts",
                JournalEntry.chung_tu_loai == "fixed_asset",
                JournalEntry.chung_tu_id == asset.id,
                JournalEntry.ngay_but_toan >= target_date,
                JournalEntry.ngay_but_toan < next_month_date,
            ).first()
            if already_done:
                results.append({"ma_ts": asset.ma_ts, "status": "skipped"})
                continue

            muc_kh = asset.nguyen_gia / asset.so_thang_khau_hao
            
            # Hạch toán: Nợ TK chi phí (154/642) / Có 214
            self._create_journal_entry(
                ngay=date(nam, thang, calendar.monthrange(nam, thang)[1]),
                dien_giai=f"Khấu hao TS: {asset.ten_ts} - Tháng {thang}/{nam}",
                loai_but_toan="khau_hao_ts",
                chung_tu_loai="fixed_asset",
                chung_tu_id=asset.id,
                phap_nhan_id=asset.phap_nhan_id,
                phan_xuong_id=asset.phan_xuong_id,
                lines=[
                    {"so_tk": asset.tk_chi_phi, "dien_giai": f"Chi phí khấu hao {asset.ma_ts}", "so_tien_no": float(muc_kh), "so_tien_co": 0},
                    {"so_tk": asset.tk_khau_hao, "dien_giai": f"Hao mòn lũy kế {asset.ma_ts}", "so_tien_no": 0, "so_tien_co": float(muc_kh)},
                ]
            )
            
            # Cập nhật trạng thái tài sản
            asset.da_khau_hao_thang += 1
            asset.gia_tri_da_khau_hao += muc_kh
            if asset.da_khau_hao_thang >= asset.so_thang_khau_hao:
                asset.trang_thai = "da_kh_het"
            
            results.append({"ma_ts": asset.ma_ts, "muc_kh": muc_kh})

        self.db.commit()
        return {"thang": thang, "nam": nam, "so_tai_san_da_kh": len(results), "details": results}

    def allocate_overhead(
        self, 
        tu_ngay: date, 
        den_ngay: date, 
        so_tk: str, 
        allocations: list[dict], # [{"phan_xuong_id": 1, "ty_le": 0.4}, ...]
        phap_nhan_id: int,
        user_id: int
    ):
        """Phân bổ chi phí chung cho các phân xưởng"""
        # 1. Tính tổng chi phí chưa phân bổ (phan_xuong_id is NULL) cho tài khoản này
        total_unallocated = self.db.query(func.sum(JournalEntryLine.so_tien_no))\
            .join(JournalEntry)\
            .filter(JournalEntry.phap_nhan_id == phap_nhan_id)\
            .filter(JournalEntryLine.phan_xuong_id.is_(None))\
            .filter(JournalEntry.ngay_but_toan >= tu_ngay)\
            .filter(JournalEntry.ngay_but_toan <= den_ngay)\
            .filter(JournalEntryLine.so_tk.like(f"{so_tk}%"))\
            .scalar() or Decimal("0")

        if total_unallocated <= 0:
            return {"status": "error", "message": "Không có chi phí chưa phân bổ trong khoảng thời gian này."}

        # 2. Tạo bút toán kết chuyển phân bổ
        # - Có tài khoản chung (phan_xuong_id = None): -Total
        # - Nợ tài khoản chung (từng phan_xuong_id): +Amount
        
        lines = []
        # Dòng giảm chi phí chung (Ghi Có)
        lines.append({
            "so_tk": so_tk,
            "dien_giai": f"Kết chuyển phân bổ chi phí {so_tk}",
            "so_tien_no": 0,
            "so_tien_co": float(total_unallocated)
        })

        # Dòng tăng chi phí cho từng xưởng (Ghi Nợ)
        for alloc in allocations:
            px_id = alloc["phan_xuong_id"]
            ty_le = Decimal(str(alloc["ty_le"]))
            amount = total_unallocated * ty_le
            
            lines.append({
                "so_tk": so_tk,
                "dien_giai": f"Phân bổ chi phí {so_tk} (Tỷ lệ {ty_le*100}%)",
                "so_tien_no": float(amount),
                "so_tien_co": 0,
                "phan_xuong_id": px_id # Gán xưởng cho dòng này
            })

        # Ghi nhận bút toán
        je = self._create_journal_entry(
            ngay=den_ngay,
            dien_giai=f"Phân bổ chi phí {so_tk} từ {tu_ngay} đến {den_ngay}",
            loai_but_toan="phan_bo_chi_phi",
            chung_tu_loai="phan_bo_chi_phi",
            chung_tu_id=None,
            phap_nhan_id=phap_nhan_id,
            phan_xuong_id=None,
            lines=lines
        )

        return {
            "status": "success",
            "total_allocated": total_unallocated,
            "journal_id": je.id,
            "so_but_toan": je.so_but_toan
        }

    # ─────────────────────────────────────────────
    # BÁO CÁO THUẾ
    # ─────────────────────────────────────────────

    # Tài khoản chỉ dùng nội bộ — loại ra khi lập BCTC/kê khai thuế
    _INTERNAL_ACCOUNTS = {"5112", "6322", "1368", "3368"}

    def get_trial_balance_tax(
        self,
        tu_ngay: date,
        den_ngay: date,
        phap_nhan_id: int | None = None,
    ) -> list[dict]:
        """Bảng cân đối số phát sinh dùng cho báo cáo thuế/BCTC.
        Loại bỏ TK nội bộ 5112/6322/1368/3368."""
        from app.models.accounting import ChartOfAccounts

        accounts = (
            self.db.query(ChartOfAccounts)
            .filter(ChartOfAccounts.so_tk.notin_(self._INTERNAL_ACCOUNTS))
            .order_by(ChartOfAccounts.so_tk)
            .all()
        )

        result = []
        for acc in accounts:
            # Skip any account whose prefix matches an internal account (e.g. sub-accounts)
            if any(acc.so_tk.startswith(ik) for ik in self._INTERNAL_ACCOUNTS):
                continue

            def _sum(q_base):
                if phap_nhan_id:
                    q_base = q_base.filter(JournalEntry.phap_nhan_id == phap_nhan_id)
                return q_base

            pre = _sum(
                self.db.query(JournalEntryLine)
                .join(JournalEntry)
                .filter(
                    JournalEntryLine.so_tk == acc.so_tk,
                    JournalEntry.ngay_but_toan < tu_ngay,
                )
            )
            cur = _sum(
                self.db.query(JournalEntryLine)
                .join(JournalEntry)
                .filter(
                    JournalEntryLine.so_tk == acc.so_tk,
                    JournalEntry.ngay_but_toan >= tu_ngay,
                    JournalEntry.ngay_but_toan <= den_ngay,
                )
            )

            pre_no = pre.with_entities(func.coalesce(func.sum(JournalEntryLine.so_tien_no), 0)).scalar() or Decimal("0")
            pre_co = pre.with_entities(func.coalesce(func.sum(JournalEntryLine.so_tien_co), 0)).scalar() or Decimal("0")
            cur_no = cur.with_entities(func.coalesce(func.sum(JournalEntryLine.so_tien_no), 0)).scalar() or Decimal("0")
            cur_co = cur.with_entities(func.coalesce(func.sum(JournalEntryLine.so_tien_co), 0)).scalar() or Decimal("0")

            so_du_dau  = pre_no - pre_co
            so_du_cuoi = so_du_dau + cur_no - cur_co

            if so_du_dau != 0 or cur_no != 0 or cur_co != 0:
                result.append({
                    "so_tk":       acc.so_tk,
                    "ten_tk":      acc.ten_tk,
                    "so_du_dau":   so_du_dau,
                    "phat_sinh_no": cur_no,
                    "phat_sinh_co": cur_co,
                    "so_du_cuoi":  so_du_cuoi,
                })

        return result

    def get_vat_summary(
        self,
        thang: int,
        nam: int,
        phap_nhan_id: int | None = None,
    ) -> dict:
        """Tổng hợp thuế GTGT theo tháng — dùng cho mẫu 01/GTGT.

        Đầu ra (thuế GTGT đầu ra): từ SalesInvoice đã phát hành.
        Đầu vào (thuế GTGT đầu vào): từ PurchaseInvoice đã nhập.
        Chỉ tính hóa đơn trạng thái hợp lệ (loại 'huy').
        """
        from app.models.billing import SalesInvoice

        first_day = date(nam, thang, 1)
        last_day  = date(nam, thang, calendar.monthrange(nam, thang)[1])

        # --- Đầu ra ---
        out_q = (
            self.db.query(
                func.coalesce(func.sum(SalesInvoice.tong_tien_hang), 0).label("doanh_thu"),
                func.coalesce(func.sum(SalesInvoice.tien_vat), 0).label("thue_gtgt_ra"),
                func.count(SalesInvoice.id).label("so_hoa_don"),
            )
            .filter(
                SalesInvoice.ngay_hoa_don >= first_day,
                SalesInvoice.ngay_hoa_don <= last_day,
                SalesInvoice.trang_thai != "huy",
            )
        )
        if phap_nhan_id:
            out_q = out_q.filter(SalesInvoice.phap_nhan_id == phap_nhan_id)
        out_row = out_q.one()

        # --- Đầu vào ---
        in_q = (
            self.db.query(
                func.coalesce(func.sum(PurchaseInvoice.tong_tien_hang), 0).label("gia_tri_hang"),
                func.coalesce(func.sum(PurchaseInvoice.tien_thue), 0).label("thue_gtgt_vao"),
                func.count(PurchaseInvoice.id).label("so_hoa_don"),
            )
            .filter(
                PurchaseInvoice.ngay_lap >= first_day,
                PurchaseInvoice.ngay_lap <= last_day,
                PurchaseInvoice.trang_thai != "huy",
            )
        )
        if phap_nhan_id:
            in_q = in_q.filter(PurchaseInvoice.phap_nhan_id == phap_nhan_id)
        in_row = in_q.one()

        thue_gtgt_ra  = Decimal(str(out_row.thue_gtgt_ra))
        thue_gtgt_vao = Decimal(str(in_row.thue_gtgt_vao))

        return {
            "thang":        thang,
            "nam":          nam,
            "phap_nhan_id": phap_nhan_id,
            # Doanh thu & thuế đầu ra
            "doanh_thu_chiu_thue":  Decimal(str(out_row.doanh_thu)),
            "thue_gtgt_dau_ra":     thue_gtgt_ra,
            "so_hd_ban_ra":         int(out_row.so_hoa_don),
            # Hàng mua & thuế đầu vào
            "gia_tri_hang_mua":     Decimal(str(in_row.gia_tri_hang)),
            "thue_gtgt_dau_vao":    thue_gtgt_vao,
            "so_hd_mua_vao":        int(in_row.so_hoa_don),
            # Số thuế phải nộp (dương = nộp thêm, âm = được hoàn)
            "thue_gtgt_phai_nop":   thue_gtgt_ra - thue_gtgt_vao,
        }

    def get_production_costing(self, tu_ngay: date, den_ngay: date, phan_xuong_id: int | None = None):
        """Báo cáo Giá thành Sản xuất thực tế (Actual Production Costing)."""
        from app.models.production import ProductionOrder
        from app.models.warehouse_doc import MaterialIssue, ProductionOutput
        
        # 1. Lấy các lệnh sản xuất có phát sinh trong kỳ
        q = self.db.query(ProductionOrder).filter(
            ProductionOrder.ngay_lenh <= den_ngay,
            ProductionOrder.trang_thai != "huy"
        )
        if phan_xuong_id:
            q = q.filter(ProductionOrder.phan_xuong_id == phan_xuong_id)
        
        orders = q.all()
        
        # 2. Lấy chi phí nhân công và sản xuất chung của xưởng trong kỳ (để phân bổ)
        # Giả sử chúng ta phân bổ theo số lượng thành phẩm nhập kho
        workshop_total_nc = Decimal("0")
        workshop_total_sxc = Decimal("0")
        
        if phan_xuong_id:
            # Truy vấn từ JournalEntryLine cho TK 154 của xưởng này
            px_filter = or_(
                JournalEntryLine.phan_xuong_id == phan_xuong_id,
                and_(JournalEntryLine.phan_xuong_id.is_(None), JournalEntry.phan_xuong_id == phan_xuong_id)
            )
            date_filter = and_(JournalEntry.ngay_but_toan >= tu_ngay, JournalEntry.ngay_but_toan <= den_ngay)
            
            # Nhân công (luong_nhan_cong)
            workshop_total_nc = self.db.query(func.coalesce(func.sum(JournalEntryLine.so_tien_no), 0))\
                .join(JournalEntry).filter(px_filter, date_filter, JournalEntry.loai_but_toan == "luong_nhan_cong")\
                .scalar() or Decimal("0")
            
            # Chi phí chung (khau_hao_ts + phan_bo_chi_phi)
            workshop_total_sxc = self.db.query(func.coalesce(func.sum(JournalEntryLine.so_tien_no), 0))\
                .join(JournalEntry).filter(px_filter, date_filter, JournalEntry.loai_but_toan.in_(["khau_hao_ts", "phan_bo_chi_phi"]))\
                .scalar() or Decimal("0")

        # 3. Tính tổng sản lượng của xưởng trong kỳ để phân bổ
        total_workshop_output = Decimal("0")
        output_q = self.db.query(func.sum(ProductionOutput.so_luong_nhap)).join(ProductionOrder)
        if phan_xuong_id:
            output_q = output_q.filter(ProductionOrder.phan_xuong_id == phan_xuong_id)
        output_q = output_q.filter(ProductionOutput.ngay_nhap >= tu_ngay, ProductionOutput.ngay_nhap <= den_ngay)
        total_workshop_output = output_q.scalar() or Decimal("0")

        results = []
        for o in orders:
            # A. Chi phí NVL thực tế (tổng các phiếu xuất kho cho lệnh này)
            issues = self.db.query(MaterialIssue).filter(
                MaterialIssue.production_order_id == o.id,
                MaterialIssue.trang_thai == "da_xuat"
            ).all()
            
            total_mat_cost = Decimal("0")
            for issue in issues:
                for item in issue.items:
                    total_mat_cost += (Decimal(str(item.so_luong_thuc_xuat)) * Decimal(str(item.don_gia)))
            
            # B. Sản lượng nhập kho thực tế
            outputs = self.db.query(ProductionOutput).filter(
                ProductionOutput.production_order_id == o.id,
                ProductionOutput.ngay_nhap >= tu_ngay,
                ProductionOutput.ngay_nhap <= den_ngay
            ).all()
            
            total_qty = sum((out.so_luong_nhap for out in outputs), Decimal("0"))
            
            if total_qty == 0:
                continue

            # C. Phân bổ NC và SXC (tạm tính theo tỷ lệ sản lượng của lệnh / tổng sản lượng xưởng)
            alloc_ratio = total_qty / total_workshop_output if total_workshop_output > 0 else Decimal("0")
            alloc_nc = workshop_total_nc * alloc_ratio
            alloc_sxc = workshop_total_sxc * alloc_ratio
            
            total_cost = total_mat_cost + alloc_nc + alloc_sxc
            unit_cost = total_cost / total_qty
            
            first_item = o.items[0] if o.items else None
            results.append({
                "so_lenh": o.so_lenh,
                "ten_hang": first_item.ten_hang if first_item else "N/A",
                "dvt": first_item.dvt if first_item else "Thùng",
                "so_luong": float(total_qty),
                "cp_nvl": float(total_mat_cost),
                "cp_nhan_cong": float(alloc_nc),
                "cp_chung": float(alloc_sxc),
                "tong_chi_phi": float(total_cost),
                "gia_thanh_don_vi": float(unit_cost),
                "standard_cost": float(first_item.sales_order_item.quote_item.gia_ban) if (first_item and first_item.sales_order_item and first_item.sales_order_item.quote_item) else 0
            })
            
        return results
