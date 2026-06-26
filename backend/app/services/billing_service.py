import json
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session, joinedload

from app.models.billing import InvoiceAdjustmentLog, SalesInvoice
from app.models.accounting import DebtLedgerEntry, JournalEntry, JournalEntryLine
from app.models.master import Customer
from app.models.warehouse_doc import DeliveryOrder
from app.models.sales import SalesOrder
from app.schemas.billing import (
    AdjustmentApprove,
    AdjustmentRequest,
    SalesInvoiceCreate,
    SalesInvoiceUpdate,
)


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
                so_tien_no=line.get('so_tien_no', 0),
                so_tien_co=line.get('so_tien_co', 0),
                phap_nhan_id=phap_nhan_id,
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
            phap_nhan_id=invoice.phap_nhan_id,
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
            phap_nhan_id=invoice.phap_nhan_id,
        )

    def _snapshot(self, inv: SalesInvoice) -> str:
        items = []
        if inv.delivery:
            items = [
                {
                    "item_id":    it.id,
                    "ten_hang":   it.ten_hang or "",
                    "dvt":        it.dvt or "",
                    "so_luong":   float(it.so_luong or 0),
                    "don_gia":    float(it.don_gia or 0),
                    "thanh_tien": float(it.thanh_tien or 0),
                }
                for it in (inv.delivery.items or [])
            ]
        return json.dumps({
            'tong_tien_hang': str(inv.tong_tien_hang),
            'ty_le_vat': str(inv.ty_le_vat),
            'tien_vat': str(inv.tien_vat),
            'tong_cong': str(inv.tong_cong),
            'han_tt': str(inv.han_tt) if inv.han_tt else None,
            'hinh_thuc_tt': inv.hinh_thuc_tt,
            'items': items,
        }, ensure_ascii=False)

    # ─────────────────────────────────────────
    # Tạo hóa đơn bán hàng
    # ─────────────────────────────────────────
    def create_invoice(self, data: SalesInvoiceCreate, user_id: int) -> SalesInvoice:
        customer = self.db.get(Customer, data.customer_id)
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
            phap_nhan_id=data.phap_nhan_id,
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

        entry = DebtLedgerEntry(
            ngay=data.ngay_hoa_don,
            loai="tang_no",
            doi_tuong="khach_hang",
            customer_id=data.customer_id,
            chung_tu_loai="hoa_don_ban",
            chung_tu_id=invoice.id,
            so_tien=data.tong_cong,
            ghi_chu=f"HĐ bán hàng {invoice.so_hoa_don}",
            phap_nhan_id=invoice.phap_nhan_id,
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(invoice)
        return invoice

    # ─────────────────────────────────────────
    # Tạo hóa đơn từ phiếu xuất kho — VAT được chọn từ frontend
    # ─────────────────────────────────────────
    def create_invoice_from_delivery(
        self,
        delivery_id: int,
        user_id: int,
        ty_le_vat: Decimal = Decimal("10"),
    ) -> SalesInvoice:
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
        tien_vat = round(tong_tien_hang * ty_le_vat / 100, 0)
        tong_cong = tong_tien_hang + tien_vat

        phap_nhan_id: int | None = getattr(delivery, "phap_nhan_id", None)
        if delivery.sales_order_id:
            order = self.db.get(SalesOrder, delivery.sales_order_id)
            if order and order.phap_nhan_id:
                phap_nhan_id = order.phap_nhan_id

        data = SalesInvoiceCreate(
            customer_id=delivery.customer_id,
            delivery_id=delivery.id,
            sales_order_id=delivery.sales_order_id,
            phap_nhan_id=phap_nhan_id,
            ngay_hoa_don=date.today(),
            tong_tien_hang=tong_tien_hang,
            ty_le_vat=ty_le_vat,
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
            phap_nhan_id=order.phap_nhan_id,
            ngay_hoa_don=date.today(),
            tong_tien_hang=tong_tien_hang,
            tien_vat=tien_vat,
            tong_cong=tong_tien_hang + tien_vat,
        )
        return self.create_invoice(data, user_id)

    # ─────────────────────────────────────────
    # Danh sách hóa đơn
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
        phap_nhan_id: int | None = None,
        scope_customer_ids=None,  # subquery or None; set by router for SALE_STAFF_ROLES
    ):
        self._mark_overdue_ar()

        q = self.db.query(SalesInvoice).options(joinedload(SalesInvoice.phap_nhan))
        if scope_customer_ids is not None:
            q = q.filter(SalesInvoice.customer_id.in_(scope_customer_ids))
        if phap_nhan_id:
            q = q.filter(SalesInvoice.phap_nhan_id == phap_nhan_id)
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
            .options(
                joinedload(SalesInvoice.phap_nhan),
                joinedload(SalesInvoice.receipts),
                joinedload(SalesInvoice.adjustment_logs).joinedload(InvoiceAdjustmentLog.adjusted_by),
                joinedload(SalesInvoice.adjustment_logs).joinedload(InvoiceAdjustmentLog.approved_by),
            )
            .filter(SalesInvoice.id == invoice_id)
            .first()
        )
        if not inv:
            raise HTTPException(404, "Không tìm thấy hóa đơn")
        return inv

    # ─────────────────────────────────────────
    # Điều chỉnh TRƯỚC kết chuyển (trực tiếp)
    # ─────────────────────────────────────────
    def update_invoice(self, invoice_id: int, data: SalesInvoiceUpdate, user_id: int) -> SalesInvoice:
        inv = self.get_invoice(invoice_id)
        if inv.trang_thai != "nhap":
            raise HTTPException(
                400,
                "Hóa đơn đã kết chuyển. Dùng chức năng 'Yêu cầu điều chỉnh' để thay đổi.",
            )
        if inv.adjustment_logs:
            raise HTTPException(400, "Hóa đơn này đã được điều chỉnh 1 lần. Không thể điều chỉnh thêm.")

        before_snap = self._snapshot(inv)
        old_tong_cong = inv.tong_cong

        update_fields = data.model_dump(exclude_none=True, exclude={'ghi_chu_dieu_chinh'})
        financial_changed = 'tong_tien_hang' in update_fields or 'ty_le_vat' in update_fields

        for field, value in update_fields.items():
            setattr(inv, field, value)

        if financial_changed:
            inv.tien_vat = round(inv.tong_tien_hang * inv.ty_le_vat / 100, 0)
            inv.tong_cong = inv.tong_tien_hang + inv.tien_vat

        inv.updated_at = datetime.now(timezone.utc)

        # Điều chỉnh debt ledger nếu số tiền thay đổi
        if financial_changed and inv.tong_cong != old_tong_cong:
            self.db.add(DebtLedgerEntry(
                ngay=date.today(),
                loai="giam_no",
                doi_tuong="khach_hang",
                customer_id=inv.customer_id,
                chung_tu_loai="dieu_chinh_hoa_don",
                chung_tu_id=inv.id,
                so_tien=old_tong_cong,
                ghi_chu=f"Đảo nợ HĐ {inv.so_hoa_don} trước điều chỉnh",
                phap_nhan_id=inv.phap_nhan_id,
            ))
            self.db.add(DebtLedgerEntry(
                ngay=date.today(),
                loai="tang_no",
                doi_tuong="khach_hang",
                customer_id=inv.customer_id,
                chung_tu_loai="dieu_chinh_hoa_don",
                chung_tu_id=inv.id,
                so_tien=inv.tong_cong,
                ghi_chu=f"Điều chỉnh HĐ {inv.so_hoa_don}",
                phap_nhan_id=inv.phap_nhan_id,
            ))

        after_snap = self._snapshot(inv)
        self.db.add(InvoiceAdjustmentLog(
            invoice_id=inv.id,
            adjusted_by_id=user_id,
            loai="truoc_ket_chuyen",
            ghi_chu=data.ghi_chu_dieu_chinh or "Điều chỉnh thông tin hóa đơn",
            trang_thai="na",
            du_lieu_truoc=before_snap,
            du_lieu_sau=after_snap,
        ))

        self.db.commit()
        self.db.refresh(inv)
        return inv

    # ─────────────────────────────────────────
    # Upload ảnh phiếu giao
    # ─────────────────────────────────────────
    def update_anh_phieu_giao(self, invoice_id: int, url: str) -> SalesInvoice:
        inv = self.db.get(SalesInvoice, invoice_id)
        if not inv:
            raise HTTPException(404, "Không tìm thấy hóa đơn")
        inv.anh_phieu_giao = url
        inv.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        return self.get_invoice(invoice_id)

    # ─────────────────────────────────────────
    # Yêu cầu điều chỉnh SAU kết chuyển
    # ─────────────────────────────────────────
    def request_adjustment(
        self, invoice_id: int, data: AdjustmentRequest, user_id: int
    ) -> InvoiceAdjustmentLog:
        inv = self.get_invoice(invoice_id)
        if inv.trang_thai not in ("da_phat_hanh", "da_tt_mot_phan", "qua_han"):
            raise HTTPException(400, "Chỉ yêu cầu điều chỉnh được hóa đơn đã kết chuyển")
        raise HTTPException(
            400,
            "Hóa đơn đã phát hành không thể điều chỉnh. Mọi thay đổi cần thực hiện trước khi tạo hóa đơn.",
        )

        tien_vat_moi = round(data.tong_tien_hang * data.ty_le_vat / 100, 0)
        tong_cong_moi = data.tong_tien_hang + tien_vat_moi

        before_snap = self._snapshot(inv)
        after_snap = json.dumps({
            'tong_tien_hang': str(data.tong_tien_hang),
            'ty_le_vat': str(data.ty_le_vat),
            'tien_vat': str(tien_vat_moi),
            'tong_cong': str(tong_cong_moi),
        }, ensure_ascii=False)

        log = InvoiceAdjustmentLog(
            invoice_id=inv.id,
            adjusted_by_id=user_id,
            loai="sau_ket_chuyen",
            ghi_chu=data.ghi_chu_dieu_chinh,
            trang_thai="pending",
            du_lieu_truoc=before_snap,
            du_lieu_sau=after_snap,
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        return log

    # ─────────────────────────────────────────
    # Duyệt / Từ chối yêu cầu điều chỉnh
    # ─────────────────────────────────────────
    def approve_adjustment(
        self, log_id: int, data: AdjustmentApprove, user_id: int
    ) -> InvoiceAdjustmentLog:
        log = self.db.get(InvoiceAdjustmentLog, log_id)
        if not log:
            raise HTTPException(404, "Không tìm thấy yêu cầu điều chỉnh")
        if log.trang_thai != "pending":
            raise HTTPException(400, "Yêu cầu không ở trạng thái chờ duyệt")

        log.approved_by_id = user_id
        log.approved_at = datetime.now(timezone.utc)

        if data.approved:
            log.trang_thai = "approved"
            if data.ghi_chu:
                log.ghi_chu = log.ghi_chu + f"\n[Ghi chú duyệt]: {data.ghi_chu}"

            inv = self.db.get(SalesInvoice, log.invoice_id)
            new_vals = json.loads(log.du_lieu_sau)

            old_tong_cong = inv.tong_cong

            # 1. Đảo ngược debt ledger entry cũ
            self.db.add(DebtLedgerEntry(
                ngay=date.today(),
                loai="giam_no",
                doi_tuong="khach_hang",
                customer_id=inv.customer_id,
                chung_tu_loai="dieu_chinh_hoa_don",
                chung_tu_id=inv.id,
                so_tien=old_tong_cong,
                ghi_chu=f"Đảo nợ HĐ {inv.so_hoa_don} theo yêu cầu #{log.id}",
                phap_nhan_id=inv.phap_nhan_id,
            ))

            # 2. Đảo ngược journal entries
            self._reverse_sales_invoice_journal(inv)

            # 3. Áp dụng giá trị mới
            inv.tong_tien_hang = Decimal(new_vals['tong_tien_hang'])
            inv.ty_le_vat = Decimal(new_vals['ty_le_vat'])
            inv.tien_vat = Decimal(new_vals['tien_vat'])
            inv.tong_cong = Decimal(new_vals['tong_cong'])
            inv.updated_at = datetime.now(timezone.utc)

            # 4. Debt ledger entry mới
            self.db.add(DebtLedgerEntry(
                ngay=date.today(),
                loai="tang_no",
                doi_tuong="khach_hang",
                customer_id=inv.customer_id,
                chung_tu_loai="dieu_chinh_hoa_don",
                chung_tu_id=inv.id,
                so_tien=inv.tong_cong,
                ghi_chu=f"Điều chỉnh HĐ {inv.so_hoa_don} theo yêu cầu #{log.id}",
                phap_nhan_id=inv.phap_nhan_id,
            ))

            # 5. Journal entries mới
            self._post_sales_invoice_journal(inv)
        else:
            log.trang_thai = "rejected"
            if data.ghi_chu:
                log.ghi_chu = log.ghi_chu + f"\n[Lý do từ chối]: {data.ghi_chu}"

        self.db.commit()
        self.db.refresh(log)
        return log

    # ─────────────────────────────────────────
    # Phát hành (kết chuyển)
    # ─────────────────────────────────────────
    def issue_invoice(self, invoice_id: int) -> SalesInvoice:
        inv = self.get_invoice(invoice_id)
        if inv.trang_thai != "nhap":
            raise HTTPException(400, "Chỉ phát hành được hóa đơn ở trạng thái Nháp")
        inv.trang_thai = "da_phat_hanh"
        inv.updated_at = datetime.now(timezone.utc)
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
        inv.updated_at = datetime.now(timezone.utc)
        self.db.add(DebtLedgerEntry(
            ngay=date.today(),
            loai="giam_no",
            doi_tuong="khach_hang",
            customer_id=inv.customer_id,
            chung_tu_loai="huy_hoa_don_ban",
            chung_tu_id=inv.id,
            so_tien=inv.tong_cong,
            ghi_chu=f"Huy hoa don ban {inv.so_hoa_don}",
            phap_nhan_id=inv.phap_nhan_id,
        ))
        if should_reverse:
            self._reverse_sales_invoice_journal(inv)
        if inv.delivery_id:
            delivery = self.db.get(DeliveryOrder, inv.delivery_id)
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
