from datetime import date, datetime
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import desc, func
from sqlalchemy.orm import Session, joinedload

from app.models.billing import SalesInvoice
from app.models.accounting import (
    PurchaseInvoice, CashReceipt, CashPayment,
    DebtLedgerEntry, OpeningBalance,
)
from app.models.master import Supplier
from app.models.purchase import PurchaseOrder
from app.models.warehouse_doc import GoodsReceipt, DeliveryOrder
from app.schemas.accounting import (
    PurchaseInvoiceCreate,
    CashReceiptCreate, CashReceiptResponse,
    CashPaymentCreate,
    ARLedgerRow, ARAgingRow,
    APLedgerRow, APAgingRow,
    BalanceByPeriod,
    OpeningBalanceCreate,
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

    def approve_receipt(self, receipt_id: int, user_id: int) -> CashReceipt:
        receipt = self.db.query(CashReceipt).get(receipt_id)
        if not receipt:
            raise HTTPException(404, "Không tìm thấy phiếu thu")
        if receipt.trang_thai != "cho_duyet":
            raise HTTPException(400, "Phiếu thu không ở trạng thái Chờ duyệt")
        receipt.trang_thai = "da_duyet"
        receipt.nguoi_duyet_id = user_id
        receipt.ngay_duyet = datetime.utcnow()
        self.db.commit()
        self.db.refresh(receipt)
        return receipt

    def cancel_receipt(self, receipt_id: int) -> CashReceipt:
        receipt = self.db.query(CashReceipt).get(receipt_id)
        if not receipt:
            raise HTTPException(404, "Không tìm thấy phiếu thu")
        if receipt.trang_thai == "da_duyet":
            raise HTTPException(400, "Không thể hủy phiếu thu đã duyệt")

        # Hoàn lại da_thanh_toan trên HĐ
        if receipt.sales_invoice_id:
            invoice = self.db.query(SalesInvoice).get(receipt.sales_invoice_id)
            if invoice:
                new_da_tt = max(Decimal("0"), invoice.da_thanh_toan - receipt.so_tien)
                invoice.da_thanh_toan = new_da_tt
                invoice.trang_thai = "da_phat_hanh" if new_da_tt == 0 else "da_tt_mot_phan"
                invoice.updated_at = datetime.utcnow()

        receipt.trang_thai = "huy"
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
        self.db.commit()
        self.db.refresh(inv)
        return inv

    def create_purchase_invoice_from_po(self, po_id: int, user_id: int) -> PurchaseInvoice:
        po = self.db.query(PurchaseOrder).options(joinedload(PurchaseOrder.items)).get(po_id)
        if not po:
            raise HTTPException(404, "Không tìm thấy đơn mua hàng")

        tong_tien_hang = sum(
            (item.thanh_tien for item in po.items if item.thanh_tien), Decimal("0")
        )
        tien_thue = round(tong_tien_hang * Decimal("10") / 100, 0)

        data = PurchaseInvoiceCreate(
            supplier_id=po.supplier_id,
            po_id=po.id,
            ngay_lap=date.today(),
            tong_tien_hang=tong_tien_hang,
            tien_thue=tien_thue,
            tong_thanh_toan=tong_tien_hang + tien_thue,
        )
        return self.create_purchase_invoice(data, user_id)

    def create_purchase_invoice_from_gr(self, gr_id: int, user_id: int) -> PurchaseInvoice:
        gr = self.db.query(GoodsReceipt).options(joinedload(GoodsReceipt.items)).get(gr_id)
        if not gr:
            raise HTTPException(404, "Không tìm thấy phiếu nhập")

        tong_tien_hang = gr.tong_gia_tri or Decimal("0")
        tien_thue = round(tong_tien_hang * Decimal("10") / 100, 0)

        data = PurchaseInvoiceCreate(
            supplier_id=gr.supplier_id,
            po_id=gr.po_id,
            gr_id=gr.id,
            ngay_lap=date.today(),
            tong_tien_hang=tong_tien_hang,
            tien_thue=tien_thue,
            tong_thanh_toan=tong_tien_hang + tien_thue,
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

    def get_ar_aging(self, as_of_date: date | None = None) -> list[ARAgingRow]:
        today = as_of_date or date.today()
        self._mark_overdue_ar()

        invoices = (
            self.db.query(SalesInvoice)
            .filter(
                SalesInvoice.trang_thai.notin_(["huy", "da_tt_du"]),
                SalesInvoice.con_lai > 0,
            )
            .all()
        )

        # Gom nhóm theo customer
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
                }
            d = by_customer[cid]
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
        for d in by_customer.values():
            tong = d["trong_han"] + d["qua_han_30"] + d["qua_han_60"] + d["qua_han_90"]
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

    def get_ar_balance(
        self, customer_id: int | None, tu_ngay: date, den_ngay: date
    ) -> BalanceByPeriod:
        """Số dư đầu kỳ / phát sinh / cuối kỳ — AMIS-style"""
        # Số dư đầu kỳ = số dư tích lũy trước tu_ngay
        so_du_dau = self._calc_balance_before(customer_id, None, tu_ngay, "khach_hang")

        tang = (
            self.db.query(func.coalesce(func.sum(DebtLedgerEntry.so_tien), 0))
            .filter(
                DebtLedgerEntry.doi_tuong == "khach_hang",
                DebtLedgerEntry.loai == "tang_no",
                DebtLedgerEntry.ngay >= tu_ngay,
                DebtLedgerEntry.ngay <= den_ngay,
                DebtLedgerEntry.customer_id == customer_id if customer_id else True,
            )
            .scalar()
        )
        giam = (
            self.db.query(func.coalesce(func.sum(DebtLedgerEntry.so_tien), 0))
            .filter(
                DebtLedgerEntry.doi_tuong == "khach_hang",
                DebtLedgerEntry.loai == "giam_no",
                DebtLedgerEntry.ngay >= tu_ngay,
                DebtLedgerEntry.ngay <= den_ngay,
                DebtLedgerEntry.customer_id == customer_id if customer_id else True,
            )
            .scalar()
        )
        return BalanceByPeriod(
            so_du_dau_ky=Decimal(str(so_du_dau)),
            phat_sinh_tang=Decimal(str(tang)),
            phat_sinh_giam=Decimal(str(giam)),
            so_du_cuoi_ky=Decimal(str(so_du_dau)) + Decimal(str(tang)) - Decimal(str(giam)),
        )

    # ─────────────────────────────────────────────
    # SỔ CÔNG NỢ PHẢI TRẢ (AP)
    # ─────────────────────────────────────────────
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
    # SỐ DƯ ĐẦU KỲ
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
