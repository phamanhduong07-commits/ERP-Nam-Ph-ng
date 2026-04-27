from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, field_validator


# ─── Purchase Order ───────────────────────────────────────────────────────────

class PurchaseOrderItemCreate(BaseModel):
    paper_material_id: int | None = None
    other_material_id: int | None = None
    ten_hang: str | None = None
    so_cuon: int | None = None
    so_luong: Decimal
    dvt: str | None = None
    don_gia: Decimal = Decimal(0)
    ghi_chu: str | None = None

    @field_validator("so_luong")
    @classmethod
    def sl_duong(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Số lượng phải > 0")
        return v


class PurchaseOrderItemUpdate(BaseModel):
    ten_hang: str | None = None
    so_cuon: int | None = None
    so_luong: Decimal | None = None
    dvt: str | None = None
    don_gia: Decimal | None = None
    ghi_chu: str | None = None


class PurchaseOrderItemResponse(BaseModel):
    id: int
    order_id: int
    paper_material_id: int | None = None
    other_material_id: int | None = None
    ten_hang: str | None = None
    # Joined
    ten_nguyen_lieu: str | None = None
    ma_nguyen_lieu: str | None = None
    so_cuon: int | None = None
    so_luong: Decimal
    dvt: str | None = None
    don_gia: Decimal
    thanh_tien: Decimal
    so_luong_da_nhap: Decimal
    ghi_chu: str | None = None

    class Config:
        from_attributes = True


class PurchaseOrderCreate(BaseModel):
    loai_don: str  # giay_cuon | khac
    ngay_dat: date
    supplier_id: int
    nv_thu_mua_id: int | None = None
    ten_nhom_hang: str | None = None
    noi_dung: str | None = None
    ghi_chu: str | None = None
    items: list[PurchaseOrderItemCreate] = []


class PurchaseOrderUpdate(BaseModel):
    ngay_dat: date | None = None
    supplier_id: int | None = None
    nv_thu_mua_id: int | None = None
    ten_nhom_hang: str | None = None
    noi_dung: str | None = None
    ghi_chu: str | None = None


class PurchaseOrderListItem(BaseModel):
    id: int
    so_don_mua: str
    loai_don: str
    ngay_dat: date
    supplier_id: int
    ten_nha_cung_cap: str | None = None
    tong_tien: Decimal
    trang_thai: str
    so_dong: int
    created_at: datetime

    class Config:
        from_attributes = True


class PurchaseOrderResponse(BaseModel):
    id: int
    so_don_mua: str
    loai_don: str
    ngay_dat: date
    supplier_id: int
    ten_nha_cung_cap: str | None = None
    nv_thu_mua_id: int | None = None
    ten_nv_thu_mua: str | None = None
    nguoi_duyet_id: int | None = None
    ten_nguoi_duyet: str | None = None
    ngay_duyet: datetime | None = None
    ten_nhom_hang: str | None = None
    tong_tien: Decimal
    trang_thai: str
    noi_dung: str | None = None
    ghi_chu: str | None = None
    items: list[PurchaseOrderItemResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class POPagedResponse(BaseModel):
    items: list[PurchaseOrderListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


# ─── Material Receipt ─────────────────────────────────────────────────────────

class MaterialReceiptItemCreate(BaseModel):
    purchase_order_item_id: int | None = None
    paper_material_id: int | None = None
    other_material_id: int | None = None
    ten_hang: str | None = None
    so_luong: Decimal
    dvt: str | None = None
    don_gia: Decimal = Decimal(0)
    ghi_chu: str | None = None

    @field_validator("so_luong")
    @classmethod
    def sl_duong(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Số lượng phải > 0")
        return v


class MaterialReceiptItemUpdate(BaseModel):
    ten_hang: str | None = None
    so_luong: Decimal | None = None
    dvt: str | None = None
    don_gia: Decimal | None = None
    ghi_chu: str | None = None


class MaterialReceiptItemResponse(BaseModel):
    id: int
    receipt_id: int
    purchase_order_item_id: int | None = None
    paper_material_id: int | None = None
    other_material_id: int | None = None
    ten_hang: str | None = None
    ten_nguyen_lieu: str | None = None
    ma_nguyen_lieu: str | None = None
    so_luong: Decimal
    dvt: str | None = None
    don_gia: Decimal
    thanh_tien: Decimal
    ghi_chu: str | None = None

    class Config:
        from_attributes = True


class MaterialReceiptCreate(BaseModel):
    ngay_nhap: date
    phan_xuong: str | None = None
    warehouse_id: int
    supplier_id: int
    purchase_order_id: int | None = None
    so_phieu_can: str | None = None
    bien_so_xe: str | None = None
    trong_luong_xe: Decimal | None = None
    trong_luong_hang: Decimal | None = None
    ghi_chu: str | None = None
    items: list[MaterialReceiptItemCreate] = []


class MaterialReceiptUpdate(BaseModel):
    ngay_nhap: date | None = None
    phan_xuong: str | None = None
    warehouse_id: int | None = None
    supplier_id: int | None = None
    so_phieu_can: str | None = None
    bien_so_xe: str | None = None
    trong_luong_xe: Decimal | None = None
    trong_luong_hang: Decimal | None = None
    ghi_chu: str | None = None


class MaterialReceiptListItem(BaseModel):
    id: int
    so_phieu: str
    ngay_nhap: date
    supplier_id: int
    ten_nha_cung_cap: str | None = None
    ten_kho: str | None = None
    purchase_order_id: int | None = None
    so_don_mua: str | None = None
    tong_tien: Decimal
    trang_thai: str
    so_dong: int
    created_at: datetime

    class Config:
        from_attributes = True


class MaterialReceiptResponse(BaseModel):
    id: int
    so_phieu: str
    ngay_nhap: date
    phan_xuong: str | None = None
    warehouse_id: int
    ten_kho: str | None = None
    supplier_id: int
    ten_nha_cung_cap: str | None = None
    purchase_order_id: int | None = None
    so_don_mua: str | None = None
    so_phieu_can: str | None = None
    bien_so_xe: str | None = None
    trong_luong_xe: Decimal | None = None
    trong_luong_hang: Decimal | None = None
    tong_tien: Decimal
    ghi_chu: str | None = None
    trang_thai: str
    items: list[MaterialReceiptItemResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReceiptPagedResponse(BaseModel):
    items: list[MaterialReceiptListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


# ─── Inventory Summary ────────────────────────────────────────────────────────

class MaterialInventoryRow(BaseModel):
    ma_nguyen_lieu: str
    ten_nguyen_lieu: str
    loai: str  # giay_cuon | khac
    dvt: str | None = None
    ton_luong: Decimal
    gia_tri_ton: Decimal
    don_gia_binh_quan: Decimal
