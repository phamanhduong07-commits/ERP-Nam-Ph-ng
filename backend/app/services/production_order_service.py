from datetime import date
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import or_, func
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.sales import SalesOrder, SalesOrderItem
from app.models.master import Product, Customer, PhanXuong
from app.schemas.master import ProductShort
from app.schemas.production import (
    ProductionOrderCreate, ProductionOrderUpdate,
    ProductionOrderResponse, ProductionOrderItemResponse,
    ProductionOrderListItem,
    PagedResponse
)
from app.utils.log import get_logger

logger = get_logger(__name__)


class ProductionOrderService:
    def __init__(self, db: Session):
        self.db = db

    # ── Helpers moved from router ─────────────────────────────────────────────

    def resolve_kho_sx_id(self, phan_xuong_id: int | None, kho_sx_id: int | None) -> int | None:
        """Tự động tìm kho SX nếu chưa có: GIAY_CUON cho xưởng cd1_cd2, PHOI cho xưởng cd2."""
        if kho_sx_id or not phan_xuong_id:
            return kho_sx_id
        px = self.db.get(PhanXuong, phan_xuong_id)
        if not px:
            return None
        from app.services.inventory_service import get_workshop_warehouse as _get_workshop_warehouse
        loai_kho = "GIAY_CUON" if getattr(px, "cong_doan", None) == "cd1_cd2" else "PHOI"
        wh = _get_workshop_warehouse(self.db, phan_xuong_id, loai_kho)
        return wh.id if wh else None

    def generate_so_lenh(self) -> str:
        today = date.today()
        prefix = f"LSX{today.strftime('%Y%m%d')}"
        last = (
            self.db.query(ProductionOrder)
            .filter(ProductionOrder.so_lenh.like(f"{prefix}%"))
            .order_by(ProductionOrder.so_lenh.desc())
            .first()
        )
        seq = (int(last.so_lenh[-3:]) + 1) if last else 1
        return f"{prefix}{seq:03d}"

    def load_order(self, order_id: int) -> ProductionOrder:
        order = (
            self.db.query(ProductionOrder)
            .options(
                joinedload(ProductionOrder.sales_order).joinedload(SalesOrder.customer),
                joinedload(ProductionOrder.sales_order).joinedload(SalesOrder.phap_nhan),
                joinedload(ProductionOrder.sales_order).joinedload(SalesOrder.phan_xuong),
                joinedload(ProductionOrder.items).joinedload(ProductionOrderItem.product),
                joinedload(ProductionOrder.items)
                .joinedload(ProductionOrderItem.sales_order_item)
                .joinedload(SalesOrderItem.quote_item),
                joinedload(ProductionOrder.phap_nhan),
                joinedload(ProductionOrder.kho_sx),
                joinedload(ProductionOrder.phan_xuong),
                joinedload(ProductionOrder.nv_theo_doi),
                joinedload(ProductionOrder.creator),
            )
            .filter(ProductionOrder.id == order_id)
            .first()
        )
        if not order:
            logger.warning("load_order: lệnh SX id=%s không tìm thấy", order_id)
            raise HTTPException(status_code=404, detail="Không tìm thấy lệnh sản xuất")
        return order

    @staticmethod
    def build_response(order: ProductionOrder) -> ProductionOrderResponse:
        so_don = order.sales_order.so_don if order.sales_order else None
        kh = order.sales_order.customer if order.sales_order else None
        ten_khach_hang = kh.ten_viet_tat if kh else None
        ma_khach_hang = kh.ma_kh if kh else None

        def _build_item(item: ProductionOrderItem) -> ProductionOrderItemResponse:
            soi = item.sales_order_item
            qi = soi.quote_item if soi else None

            _DEFAULT_TO_HOP_SONG = {3: 'B', 5: 'BC', 7: 'BCB'}

            def _f(field):
                v = getattr(item, field, None)
                if v is None and soi is not None:
                    v = getattr(soi, field, None)
                if v is None and qi is not None:
                    v = getattr(qi, field, None)
                return v

            so_lop = _f('so_lop') or 3
            to_hop_song = _f('to_hop_song') or _DEFAULT_TO_HOP_SONG.get(so_lop)

            # Tính cong_doan từ loai_in + các checkbox (POI → SOI → QI)
            _cd: list[str] = []
            _loai_in = _f('loai_in')
            _so_mau = _f('so_mau')
            if _loai_in and _loai_in != 'khong_in':
                _lbl = 'Flexo' if _loai_in == 'flexo' else 'Kỹ thuật số'
                if _so_mau and _so_mau > 0:
                    _lbl += f' {_so_mau} màu'
                _cd.append(_lbl)
            if qi:
                if qi.do_kho:
                    _cd.append('Độ khó')
                if qi.ghim:
                    _cd.append('Ghim')
                if qi.chap_xa:
                    _cd.append('Chạp Xã')
                if qi.do_phu:
                    _cd.append('Độ phủ')
                if qi.dan:
                    _cd.append('Dán')
                if qi.boi:
                    _cd.append('Bồi')
                if qi.be_lo:
                    _cd.append('Bế Lỗ')
            cong_doan = ' | '.join(_cd) if _cd else None

            return ProductionOrderItemResponse(
                id=item.id,
                product_id=item.product_id,
                sales_order_item_id=item.sales_order_item_id,
                ten_hang=item.ten_hang,
                product=ProductShort.model_validate(item.product) if item.product else None,
                so_luong_ke_hoach=item.so_luong_ke_hoach,
                so_luong_hoan_thanh=item.so_luong_hoan_thanh,
                dvt=item.dvt,
                ngay_giao_hang=item.ngay_giao_hang,
                ghi_chu=_f('ghi_chu'),
                loai_thung=_f('loai_thung'),
                dai=_f('dai'), rong=_f('rong'), cao=_f('cao'),
                so_lop=so_lop, to_hop_song=to_hop_song,
                mat=_f('mat'), mat_dl=_f('mat_dl'),
                song_1=_f('song_1'), song_1_dl=_f('song_1_dl'),
                mat_1=_f('mat_1'), mat_1_dl=_f('mat_1_dl'),
                song_2=_f('song_2'), song_2_dl=_f('song_2_dl'),
                mat_2=_f('mat_2'), mat_2_dl=_f('mat_2_dl'),
                song_3=_f('song_3'), song_3_dl=_f('song_3_dl'),
                mat_3=_f('mat_3'), mat_3_dl=_f('mat_3_dl'),
                loai_in=_f('loai_in'), so_mau=_f('so_mau'), loai_lan=_f('loai_lan'),
                kho_tt=item.kho_tt, dai_tt=item.dai_tt, qccl=item.qccl,
                dien_tich=item.dien_tich,
                gia_ban_muc_tieu=item.gia_ban_muc_tieu,
                cong_doan=cong_doan,
            )

        items = [_build_item(item) for item in order.items]
        return ProductionOrderResponse(
            id=order.id,
            so_lenh=order.so_lenh,
            ngay_lenh=order.ngay_lenh,
            sales_order_id=order.sales_order_id,
            so_don=so_don,
            ten_khach_hang=ten_khach_hang,
            ma_khach_hang=ma_khach_hang,
            phap_nhan_id=order.phap_nhan_id,
            ten_phap_nhan=order.phap_nhan.ten_phap_nhan if order.phap_nhan else (
                order.sales_order.phap_nhan.ten_phap_nhan if order.sales_order and order.sales_order.phap_nhan else None),
            kho_sx_id=order.kho_sx_id,
            ten_kho_sx=order.kho_sx.ten_kho if order.kho_sx else None,
            phan_xuong_id=order.phan_xuong_id,
            ten_phan_xuong=order.phan_xuong.ten_xuong if order.phan_xuong else (
                order.sales_order.phan_xuong.ten_xuong if order.sales_order and order.sales_order.phan_xuong else None),
            nv_theo_doi_id=order.nv_theo_doi_id,
            ten_nv_theo_doi=order.nv_theo_doi.ho_ten if order.nv_theo_doi else None,
            created_by_name=order.creator.ho_ten if order.creator else None,
            so_po_kh=order.so_po_kh,
            trang_thai=order.trang_thai,
            ngay_bat_dau_ke_hoach=order.ngay_bat_dau_ke_hoach,
            ngay_hoan_thanh_ke_hoach=order.ngay_hoan_thanh_ke_hoach,
            ngay_bat_dau_thuc_te=order.ngay_bat_dau_thuc_te,
            ngay_hoan_thanh_thuc_te=order.ngay_hoan_thanh_thuc_te,
            ghi_chu=order.ghi_chu,
            ghi_chu_don_hang=order.sales_order.ghi_chu if order.sales_order else None,
            don_gia_noi_bo=getattr(order, "don_gia_noi_bo", None),
            items=items,
            created_at=order.created_at,
            updated_at=order.updated_at,
        )

    @staticmethod
    def phieu_to_dict(p: "PhieuNhapPhoiSong") -> dict:
        return {
            "id": p.id,
            "so_phieu": p.so_phieu,
            "production_order_id": p.production_order_id,
            "ngay": str(p.ngay),
            "ca": p.ca,
            "ghi_chu": p.ghi_chu,
            "gio_bat_dau": p.gio_bat_dau,
            "gio_ket_thuc": p.gio_ket_thuc,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "items": [
                {
                    "id": it.id,
                    "production_order_item_id": it.production_order_item_id,
                    "ten_hang": getattr(getattr(it, "production_order_item", None), "ten_hang", None),
                    "so_lop": getattr(getattr(it, "production_order_item", None), "so_lop", None),
                    "mat": getattr(getattr(it, "production_order_item", None), "mat", None),
                    "mat_dl": getattr(getattr(it, "production_order_item", None), "mat_dl", None),
                    "song_1": getattr(getattr(it, "production_order_item", None), "song_1", None),
                    "song_1_dl": getattr(getattr(it, "production_order_item", None), "song_1_dl", None),
                    "mat_1": getattr(getattr(it, "production_order_item", None), "mat_1", None),
                    "mat_1_dl": getattr(getattr(it, "production_order_item", None), "mat_1_dl", None),
                    "song_2": getattr(getattr(it, "production_order_item", None), "song_2", None),
                    "song_2_dl": getattr(getattr(it, "production_order_item", None), "song_2_dl", None),
                    "mat_2": getattr(getattr(it, "production_order_item", None), "mat_2", None),
                    "mat_2_dl": getattr(getattr(it, "production_order_item", None), "mat_2_dl", None),
                    "song_3": getattr(getattr(it, "production_order_item", None), "song_3", None),
                    "song_3_dl": getattr(getattr(it, "production_order_item", None), "song_3_dl", None),
                    "mat_3": getattr(getattr(it, "production_order_item", None), "mat_3", None),
                    "mat_3_dl": getattr(getattr(it, "production_order_item", None), "mat_3_dl", None),
                    "so_luong_ke_hoach": float(it.so_luong_ke_hoach),
                    "so_luong_thuc_te": float(it.so_luong_thuc_te) if it.so_luong_thuc_te is not None else None,
                    "so_luong_loi": float(it.so_luong_loi) if it.so_luong_loi is not None else None,
                    "chieu_kho": float(it.chieu_kho) if it.chieu_kho is not None else None,
                    "chieu_cat": float(it.chieu_cat) if it.chieu_cat is not None else None,
                    "so_tam": it.so_tam,
                    "ghi_chu": it.ghi_chu,
                }
                for it in p.items
            ],
        }

    def get_production_orders_paginated(
        self,
        search: str = "",
        trang_thai: str = "",
        sales_order_id: int = None,
        phan_xuong_id: int = None,
        phap_nhan_id: int = None,
        tu_ngay: date = None,
        den_ngay: date = None,
        page: int = 1,
        page_size: int = 20,
    ) -> PagedResponse:
        q = self.db.query(ProductionOrder).options(
            joinedload(ProductionOrder.sales_order).joinedload(SalesOrder.customer),
            joinedload(ProductionOrder.phap_nhan),
            joinedload(ProductionOrder.kho_sx),
            joinedload(ProductionOrder.phan_xuong),
            selectinload(ProductionOrder.items),  # one-to-many → selectinload avoids duplicate rows
            joinedload(ProductionOrder.creator),
        )

        if search:
            like = f"%{search}%"
            q = (q
                 .outerjoin(ProductionOrder.sales_order)
                 .outerjoin(SalesOrder.customer)
                 .outerjoin(ProductionOrder.items)
                 .filter(or_(
                     ProductionOrder.so_lenh.ilike(like),
                     SalesOrder.so_don.ilike(like),
                     Customer.ten_viet_tat.ilike(like),
                     ProductionOrderItem.ten_hang.ilike(like),
                 ))
                 .distinct()
                 )
        if trang_thai:
            q = q.filter(ProductionOrder.trang_thai == trang_thai)
        if sales_order_id:
            q = q.filter(ProductionOrder.sales_order_id == sales_order_id)
        if phan_xuong_id:
            q = q.filter(ProductionOrder.phan_xuong_id == phan_xuong_id)
        if phap_nhan_id:
            q = q.filter(ProductionOrder.phap_nhan_id == phap_nhan_id)
        if tu_ngay:
            q = q.filter(ProductionOrder.ngay_lenh >= tu_ngay)
        if den_ngay:
            q = q.filter(ProductionOrder.ngay_lenh <= den_ngay)

        total = q.count()
        orders = q.order_by(ProductionOrder.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

        _KHO_DE_XUAT = 2000  # mm — kho 1 con >= 2m → đề xuất mua phôi ngoài

        # Batch query: tổng SL thực tế đã nhập theo từng lệnh SX (tránh N+1)
        order_ids = [o.id for o in orders]
        sl_thuc_te_map: dict[int, Decimal] = {}
        if order_ids:
            rows = (
                self.db.query(
                    PhieuNhapPhoiSong.production_order_id,
                    func.coalesce(func.sum(PhieuNhapPhoiSongItem.so_luong_thuc_te), 0).label("total"),
                )
                .join(PhieuNhapPhoiSongItem, PhieuNhapPhoiSongItem.phieu_id == PhieuNhapPhoiSong.id)
                .filter(PhieuNhapPhoiSong.production_order_id.in_(order_ids))
                .group_by(PhieuNhapPhoiSong.production_order_id)
                .all()
            )
            sl_thuc_te_map = {r.production_order_id: Decimal(str(r.total)) for r in rows}

        items = []
        for o in orders:
            first_item = o.items[0] if o.items else None
            kho_vals = [float(i.kho_tt) for i in o.items if i.kho_tt is not None]
            kho_tt_max = max(kho_vals) if kho_vals else None
            items.append(ProductionOrderListItem(
                id=o.id,
                so_lenh=o.so_lenh,
                ngay_lenh=o.ngay_lenh,
                sales_order_id=o.sales_order_id,
                so_don=o.sales_order.so_don if o.sales_order else None,
                ten_khach_hang=(
                    o.sales_order.customer.ten_viet_tat
                    if o.sales_order and o.sales_order.customer else None
                ),
                ten_hang=first_item.ten_hang if first_item else None,
                phap_nhan_id=o.phap_nhan_id,
                ten_phap_nhan=o.phap_nhan.ten_phap_nhan if o.phap_nhan else None,
                ten_kho_sx=o.kho_sx.ten_kho if o.kho_sx else None,
                phan_xuong_id=o.phan_xuong_id,
                ten_phan_xuong=o.phan_xuong.ten_xuong if o.phan_xuong else None,
                gia_ban_muc_tieu=getattr(first_item, 'gia_ban', None) if first_item else None,
                created_by_name=o.creator.ho_ten if o.creator else None,
                ngay_hoan_thanh_ke_hoach=o.ngay_hoan_thanh_ke_hoach,
                trang_thai=o.trang_thai,
                tong_sl_ke_hoach=sum(i.so_luong_ke_hoach for i in o.items),
                so_dong=len(o.items),
                kho_tt_max=kho_tt_max,
                de_xuat_mua_ngoai=(kho_tt_max or 0) >= _KHO_DE_XUAT,
                kho_tt=float(first_item.kho_tt) if first_item and first_item.kho_tt is not None else None,
                dai_tt=float(first_item.dai_tt) if first_item and first_item.dai_tt is not None else None,
                so_lop=first_item.so_lop if first_item else None,
                to_hop_song=first_item.to_hop_song if first_item else None,
                loai_thung=first_item.loai_thung if first_item else None,
                dai=first_item.dai if first_item else None,
                rong=first_item.rong if first_item else None,
                cao=first_item.cao if first_item else None,
                tong_sl_thuc_te=sl_thuc_te_map.get(o.id, Decimal("0")),
                created_at=o.created_at,
            ))

        return PagedResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size,
        )

    def get_production_order_by_id(self, order_id: int) -> ProductionOrderResponse:
        order = self.db.query(ProductionOrder).options(
            joinedload(ProductionOrder.phan_xuong),
            joinedload(ProductionOrder.items).joinedload(ProductionOrderItem.sales_order_item)
        ).filter(ProductionOrder.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Không tìm thấy lệnh sản xuất")
        return ProductionOrderResponse.model_validate(order)

    def create_production_order(self, data: ProductionOrderCreate, user_id: int) -> ProductionOrderResponse:
        if data.sales_order_id:
            so = self.db.query(SalesOrder).filter(SalesOrder.id == data.sales_order_id).first()
            if not so:
                raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
            if so.trang_thai not in ("da_duyet", "dang_sx"):
                raise HTTPException(status_code=400, detail="Chỉ tạo lệnh SX từ đơn hàng đã duyệt")

        order_data = data.model_dump(exclude={'items'})
        order_data['so_lenh'] = self.generate_so_lenh()
        order_data['created_by'] = user_id
        order_data['trang_thai'] = "moi"
        order = ProductionOrder(**order_data)
        self.db.add(order)

        for item_data in data.items:
            product = None
            if item_data.product_id:
                product = self.db.query(Product).filter(Product.id == item_data.product_id).first()
            item = ProductionOrderItem(
                production_order=order,
                product_id=item_data.product_id,
                sales_order_item_id=item_data.sales_order_item_id,
                ten_hang=item_data.ten_hang or (product.ten_hang if product else ""),
                so_luong_ke_hoach=item_data.so_luong_ke_hoach,
                dvt=item_data.dvt,
                ngay_giao_hang=item_data.ngay_giao_hang,
                ghi_chu=item_data.ghi_chu,
            )
            self.db.add(item)

        # Cập nhật trạng thái đơn hàng → dang_sx
        if data.sales_order_id:
            so = self.db.query(SalesOrder).filter(SalesOrder.id == data.sales_order_id).first()
            if so and so.trang_thai == "da_duyet":
                so.trang_thai = "dang_sx"

        self.db.commit()
        self.db.refresh(order)
        logger.info("created production_order id=%s so_lenh=%s by user=%s", order.id, order.so_lenh, user_id)
        return ProductionOrderResponse.model_validate(order)

    def update_production_order(self, order_id: int, data: ProductionOrderUpdate) -> ProductionOrderResponse:
        order = self.db.query(ProductionOrder).filter(ProductionOrder.id == order_id).first()
        if not order:
            logger.warning("production_order id=%s not found", order_id)
            raise HTTPException(status_code=404, detail="Không tìm thấy lệnh sản xuất")
        if order.trang_thai == "huy":
            raise HTTPException(status_code=400, detail="Lệnh đã huỷ, không thể sửa")
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(order, key, value)
        self.db.commit()
        self.db.refresh(order)
        logger.info("updated production_order id=%s", order_id)
        return ProductionOrderResponse.model_validate(order)
