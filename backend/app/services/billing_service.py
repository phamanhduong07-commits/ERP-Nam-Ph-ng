from datetime import date, datetime, timedelta
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session, joinedload

from app.models.billing import SalesInvoice
from app.models.accounting import CashReceipt, DebtLedgerEntry, JournalEntry, JournalEntryLine
from app.models.master import Customer
from app.models.warehouse_doc import DeliveryOrder
from app.models.sales import SalesOrder, SalesOrderItem
from app.schemas.billing import SalesInvoiceCreate, SalesInvoiceUpdate


class BillingService:
    def __init__(self, db: Session):
        self.db = db

    # ─────────────────────────────────────────
    # Sinh số hóa đơn tự động: HD-YYYYMM-XXXX
    # ─────────────────────────────────────────
    def _gen_so_hoa_don(self) -> str:
        prefix = f"HD{date.today().strftime('%Y%m')}"
        last = (
            self.db.query(SalesInvoice)
            .filter(SalesInvoice.so_hoa_don.like(f"{prefix}%"))
            .order_by(desc(SalesInvoice.so_hoa_don))
            .first()
        )
        seq = int(last.so_hoa_don[-4:]) + 1 if last else 1
        return f"{prefix}-{seq:04d}"

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
        )
        self.db.add(entry)
        self.db.flush()
        for line in lines:
            entry_line = JournalEntryLine(
                entry_id=entry.id,
                so_tk=line['so_tk'],
                dien_giai=line.get('dien_giai'),
                so_tien_no=line.get('so_tien_no', 0),
                so_tien_co=line.get('so_tien_co', 0),
            )
            self.db.add(entry_line)
        self.db.flush()
        return entry

    def _post_sales_invoice_journal(self, invoice: SalesInvoice) -> None:
        lines = [
            {
                'so_tk': '131',
                'dien_giai': f"Ghi nhận doanh thu HĐ {invoice.so_hoa_don}",
                'so_tien_no': float(invoice.tong_cong),
                'so_tien_co': 0,
            },
            {
                'so_tk': '511',
                'dien_giai': f"Doanh thu bán hàng HĐ {invoice.so_hoa_don}",
                'so_tien_no': 0,
                'so_tien_co': float(invoice.tong_tien_hang),
            },
        ]
        if invoice.tien_vat and float(invoice.tien_vat) > 0:
            lines.append({
                'so_tk': '3331',
                'dien_giai': f"VAT HĐ {invoice.so_hoa_don}",
                'so_tien_no': 0,
                'so_tien_co': float(invoice.tien_vat),
            })
        self._create_journal_entry(
            ngay=invoice.ngay_hoa_don,
            dien_giai=f"Phát hành hóa đơn bán hàng {invoice.so_hoa_don}",
            loai_but_toan='hoa_don_ban',
            chung_tu_loai='hoa_don_ban',
            chung_tu_id=invoice.id,
            lines=lines,
        )

    def _reverse_sales_invoice_journal(self, invoice: SalesInvoice) -> None:
        lines = [
            {
                'so_tk': '511',
                'dien_giai': f"Hủy doanh thu HĐ {invoice.so_hoa_don}",
                'so_tien_no': float(invoice.tong_tien_hang),
                'so_tien_co': 0,
            },
            {
                'so_tk': '131',
                'dien_giai': f"Hủy công nợ HĐ {invoice.so_hoa_don}",
                'so_tien_no': 0,
                'so_tien_co': float(invoice.tong_cong),
            },
        ]
        if invoice.tien_vat and float(invoice.tien_vat) > 0:
            lines.insert(1, {
                'so_tk': '3331',
                'dien_giai': f"Hủy VAT HĐ {invoice.so_hoa_don}",
                'so_tien_no': float(invoice.tien_vat),
                'so_tien_co': 0,
            })
        self._create_journal_entry(
            ngay=date.today(),
            dien_giai=f"Hủy hóa đơn bán hàng {invoice.so_hoa_don}",
            loai_but_toan='huy_hoa_don_ban',
            chung_tu_loai='huy_hoa_don_ban',
            chung_tu_id=invoice.id,
            lines=lines,
        )

    # ─────────────────────────────────────────
    # Tạo hóa đơn bán hàng
    # ─────────────────────────────────────────
    def create_invoice(self, data: SalesInvoiceCreate, user_id: int) -> SalesInvoice:
        # Nếu không nhập snapshot → lấy từ Customer
        customer = self.db.query(Customer).get(data.customer_id)
        if not customer:
            raise HTTPException(404, "Không tìm thấy khách hàng")

        if not data.han_tt and customer.so_ngay_no and customer.so_ngay_no > 0:
            data.han_tt = data.ngay_hoa_don + timedelta(days=customer.so_ngay_no)

        ten_don_vi = data.ten_don_vi or customer.ten_don_vi or customer.ten_viet_tat
        dia_chi = data.dia_chi or customer.dia_chi or customer.dia_chi_giao_hang
        ma_so_thue = data.ma_so_thue or getattr(customer, "ma_so_thue", None)

        invoice = SalesInvoice(
            so_hoa_don=self._gen_so_hoa_don(),
            mau_so=data.mau_so,
            ky_hieu=data.ky_hieu,
            ngay_hoa_don=data.ngay_hoa_don,
            han_tt=data.han_tt,
            customer_id=data.customer_id,
            delivery_id=data.delivery_id,
            sales_order_id=data.sales_order_id,
            ten_don_vi=ten_don_vi,
            dia_chi=dia_chi,
            ma_so_thue=ma_so_thue,
            nguoi_mua_hang=data.nguoi_mua_hang,
            hinh_thuc_tt=data.hinh_thuc_tt,
            tong_tien_hang=data.tong_tien_hang,
            ty_le_vat=data.ty_le_vat,
            tien_vat=data.tien_vat,
            tong_cong=data.tong_cong,
            da_thanh_toan=Decimal("0"),
            ghi_chu=data.ghi_chu,
            created_by=user_id,
        )
        self.db.add(invoice)
        self.db.flush()

        # Ghi vào sổ công nợ phải thu
        entry = DebtLedgerEntry(
            ngay=data.ngay_hoa_don,
            loai="tang_no",
            doi_tuong="khach_hang",
            customer_id=data.customer_id,
            chung_tu_loai="hoa_don_ban",
            chung_tu_id=invoice.id,
            so_tien=data.tong_cong,
            ghi_chu=f"HĐ bán hàng {invoice.so_hoa_don}",
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(invoice)
        return invoice

    # ─────────────────────────────────────────
    # Tạo hóa đơn từ phiếu xuất kho
    # ─────────────────────────────────────────
    def create_invoice_from_delivery(self, delivery_id: int, user_id: int) -> SalesInvoice:
        existing = (
            self.db.query(SalesInvoice)
            .filter(SalesInvoice.delivery_id == delivery_id, SalesInvoice.trang_thai != "huy")
            .first()
        )
        if existing:
            return existing

        delivery = (
            self.db.query(DeliveryOrder)
            .options(joinedload(DeliveryOrder.customer))
            .filter(DeliveryOrder.id == delivery_id)
            .first()
        )
        if not delivery:
            raise HTTPException(404, "Không tìm thấy phiếu xuất")
        if not delivery.tong_tien_hang:
            raise HTTPException(400, "Phiếu xuất chưa có tổng tiền hàng")

        tong_tien_hang = delivery.tong_tien_hang
        tien_vat = round(tong_tien_hang * Decimal("10") / 100, 0)
        tong_cong = tong_tien_hang + tien_vat

        data = SalesInvoiceCreate(
            customer_id=delivery.customer_id,
            delivery_id=delivery.id,
            sales_order_id=delivery.sales_order_id,
            ngay_hoa_don=date.today(),
            tong_tien_hang=tong_tien_hang,
            ty_le_vat=Decimal("10"),
            tien_vat=tien_vat,
            tong_cong=tong_cong,
        )
        return self.create_invoice(data, user_id)

    # ─────────────────────────────────────────
    # Tạo hóa đơn từ đơn hàng bán
    # ─────────────────────────────────────────
    def create_invoice_from_order(self, order_id: int, user_id: int) -> SalesInvoice:
        order = (
            self.db.query(SalesOrder)
            .options(joinedload(SalesOrder.items))
            .filter(SalesOrder.id == order_id)
            .first()
        )
        if not order:
            raise HTTPException(404, "Không tìm thấy đơn hàng")

        tong_tien_hang = sum(
            (item.so_luong * item.don_gia for item in order.items if item.don_gia),
            Decimal("0"),
        )
        tien_vat = round(tong_tien_hang * Decimal("10") / 100, 0)

        data = SalesInvoiceCreate(
            customer_id=order.customer_id,
            sales_order_id=order.id,
            ngay_hoa_don=date.today(),
            tong_tien_hang=tong_tien_hang,
            tien_vat=tien_vat,
            tong_cong=tong_tien_hang + tien_vat,
        )
        return self.create_invoice(data, user_id)

    # ─────────────────────────────────────────
    # Lấy danh sách hóa đơn (phân trang)
    # ─────────────────────────────────────────
    def list_invoices(
        self,
        customer_id: int | None = None,
        trang_thai: str | None = None,
        tu_ngay: date | None = None,
        den_ngay: date | None = None,
        qua_han_only: bool = False,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ):
        self._mark_overdue_ar()

        q = self.db.query(SalesInvoice)
        if customer_id:
            q = q.filter(SalesInvoice.customer_id == customer_id)
        if trang_thai:
            q = q.filter(SalesInvoice.trang_thai == trang_thai)
        if tu_ngay:
            q = q.filter(SalesInvoice.ngay_hoa_don >= tu_ngay)
        if den_ngay:
            q = q.filter(SalesInvoice.ngay_hoa_don <= den_ngay)
        if qua_han_only:
            q = q.filter(SalesInvoice.trang_thai == "qua_han")
        if search:
            like = f"%{search}%"
            q = q.filter(
                SalesInvoice.so_hoa_don.ilike(like)
                | SalesInvoice.ten_don_vi.ilike(like)
            )

        total = q.count()
        items = (
            q.order_by(desc(SalesInvoice.ngay_hoa_don))
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return {"total": total, "page": page, "page_size": page_size, "items": items}

    def get_invoice(self, invoice_id: int) -> SalesInvoice:
        inv = (
            self.db.query(SalesInvoice)
            .options(joinedload(SalesInvoice.receipts))
            .filter(SalesInvoice.id == invoice_id)
            .first()
        )
        if not inv:
            raise HTTPException(404, "Không tìm thấy hóa đơn")
        return inv

    def update_invoice(self, invoice_id: int, data: SalesInvoiceUpdate) -> SalesInvoice:
        inv = self.get_invoice(invoice_id)
        if inv.trang_thai != "nhap":
            raise HTTPException(400, "Chỉ sửa được hóa đơn ở trạng thái Nháp")
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(inv, field, value)
        inv.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(inv)
        return inv

    def issue_invoice(self, invoice_id: int) -> SalesInvoice:
        """Phát hành hóa đơn: nhap → da_phat_hanh"""
        inv = self.get_invoice(invoice_id)
        if inv.trang_thai != "nhap":
            raise HTTPException(400, "Chỉ phát hành được hóa đơn ở trạng thái Nháp")
        inv.trang_thai = "da_phat_hanh"
        inv.updated_at = datetime.utcnow()
        self._post_sales_invoice_journal(inv)
        self.db.commit()
        self.db.refresh(inv)
        return inv

    def cancel_invoice(self, invoice_id: int) -> SalesInvoice:
        inv = self.get_invoice(invoice_id)
        if inv.trang_thai == "huy":
            return inv
        if inv.da_thanh_toan and inv.da_thanh_toan > 0:
            raise HTTPException(400, "Khong the huy hoa don da co phieu thu")
        should_reverse = inv.trang_thai != "nhap"
        inv.trang_thai = "huy"
        inv.updated_at = datetime.utcnow()
        entry = DebtLedgerEntry(
            ngay=date.today(),
            loai="giam_no",
            doi_tuong="khach_hang",
            customer_id=inv.customer_id,
            chung_tu_loai="huy_hoa_don_ban",
            chung_tu_id=inv.id,
            so_tien=inv.tong_cong,
            ghi_chu=f"Huy hoa don ban {inv.so_hoa_don}",
        )
        self.db.add(entry)
        if should_reverse:
            self._reverse_sales_invoice_journal(inv)
        if inv.delivery_id:
            delivery = self.db.query(DeliveryOrder).get(inv.delivery_id)
            if delivery:
                delivery.trang_thai_cong_no = "chua_thu"
        self.db.commit()
        self.db.refresh(inv)
        return inv

    # ─────────────────────────────────────────
    # Tự động đánh dấu quá hạn
    # ─────────────────────────────────────────
    def _mark_overdue_ar(self):
        today = date.today()
        (
            self.db.query(SalesInvoice)
            .filter(
                SalesInvoice.han_tt < today,
                SalesInvoice.trang_thai.in_(["da_phat_hanh", "da_tt_mot_phan"]),
            )
            .update({"trang_thai": "qua_han"}, synchronize_session=False)
        )
        self.db.commit()
