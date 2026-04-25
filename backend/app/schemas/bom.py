from datetime import datetime
from decimal import Decimal
from typing import Any
from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Layer input schema (dùng trong request)
# ---------------------------------------------------------------------------

class BomLayerInput(BaseModel):
    """Thông tin một lớp giấy khi gửi lên để tính BOM."""
    vi_tri_lop: str = Field(..., description="Tên vị trí lớp, vd: 'Mặt ngoài', 'Sóng C'")
    loai_lop: str = Field(..., description="'mat' hoặc 'song'")
    flute_type: str | None = Field(None, description="E/B/C/A — chỉ cho lớp sóng")
    ma_ky_hieu: str = Field(..., description="Mã ký hiệu giấy")
    paper_material_id: int | None = Field(None, description="ID nguyên liệu giấy (nếu đã có)")
    dinh_luong: Decimal = Field(..., description="Định lượng g/m²", gt=0)
    don_gia_kg: Decimal = Field(..., description="Đơn giá mua đ/kg", ge=0)

    @field_validator("loai_lop")
    @classmethod
    def validate_loai_lop(cls, v: str) -> str:
        if v not in ("mat", "song"):
            raise ValueError("loai_lop phải là 'mat' hoặc 'song'")
        return v


# ---------------------------------------------------------------------------
# BomCalculateRequest
# ---------------------------------------------------------------------------

class BomCalculateRequest(BaseModel):
    """Dữ liệu đầu vào để tính BOM + giá."""

    # Thông số sản phẩm
    loai_thung: str = Field(..., description="A1 | A3 | A5 | tam")
    dai: Decimal = Field(..., description="Chiều dài (cm)", gt=0)
    rong: Decimal = Field(..., description="Chiều rộng (cm)", gt=0)
    cao: Decimal = Field(..., description="Chiều cao (cm)", ge=0)
    so_lop: int = Field(..., description="Số lớp: 3, 5 hoặc 7")
    to_hop_song: str = Field(..., description="Tổ hợp sóng, vd: 'C-B', 'B', 'BCE'")
    so_luong: Decimal = Field(..., description="Số lượng sản xuất", gt=0)

    # Các lớp giấy (theo thứ tự từ ngoài vào trong)
    layers: list[BomLayerInput] = Field(..., min_length=3)

    # Add-ons
    chong_tham: int = Field(0, description="0=không, 1=1 mặt, 2=2 mặt", ge=0, le=2)
    in_flexo_mau: int = Field(0, description="0=không in, 1+=số màu", ge=0)
    in_flexo_phu_nen: bool = Field(False)
    in_ky_thuat_so: bool = Field(False)
    chap_xa: bool = Field(False)
    boi: bool = Field(False)
    be_so_con: int = Field(0, description="0/1/2/4/6/8")
    dan: bool = Field(False, description="Dán thùng")
    ghim: bool = Field(False, description="Ghim thùng")
    can_mang: int = Field(0, description="0=không, 1=1 mặt, 2=2 mặt", ge=0, le=2)
    san_pham_kho: bool = Field(False)

    # Định giá
    ty_le_loi_nhuan: Decimal | None = Field(
        None, description="Override tỷ lệ lợi nhuận. None = dùng mặc định theo loại+số lớp"
    )
    hoa_hong_kd_pct: Decimal = Field(Decimal("0"), description="% hoa hồng KD", ge=0)
    hoa_hong_kh_pct: Decimal = Field(Decimal("0"), description="% hoa hồng KH", ge=0)
    chi_phi_khac: Decimal = Field(Decimal("0"), description="Chi phí khác (đồng)", ge=0)
    chiet_khau: Decimal = Field(Decimal("0"), description="Chiết khấu (đồng)", ge=0)

    @field_validator("so_lop")
    @classmethod
    def validate_so_lop(cls, v: int) -> int:
        if v not in (3, 5, 7):
            raise ValueError("so_lop phải là 3, 5 hoặc 7")
        return v

    @field_validator("loai_thung")
    @classmethod
    def validate_loai_thung(cls, v: str) -> str:
        valid = {"A1", "A3", "A5", "A7", "GOI_GIUA", "GOI_SUON", "TAM"}
        if v.upper() not in valid:
            raise ValueError(f"loai_thung phải là {', '.join(sorted(valid))}")
        return v.upper()

    @field_validator("be_so_con")
    @classmethod
    def validate_be_so_con(cls, v: int) -> int:
        if v not in (0, 1, 2, 4, 6, 8):
            raise ValueError("be_so_con phải là 0, 1, 2, 4, 6 hoặc 8")
        return v


# ---------------------------------------------------------------------------
# BomSaveRequest (extends calculate with FK)
# ---------------------------------------------------------------------------

class BomSaveRequest(BomCalculateRequest):
    """Tính BOM và lưu vào DB."""
    production_order_item_id: int | None = Field(
        None, description="ID dòng lệnh SX liên kết (tuỳ chọn)"
    )
    ghi_chu: str | None = None


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class DimensionResult(BaseModel):
    kho1: float
    dai1: float
    so_dao: int
    kho_tt: float
    dai_tt: float
    kho_kh: float
    dai_kh: float
    dien_tich: float  # m²/unit


class AddonDetail(BaseModel):
    d1_chong_tham: float = 0
    d2_in_flexo: float = 0
    d3_in_ky_thuat_so: float = 0
    d4_chap_xa: float = 0
    d5_boi: float = 0
    d6_be: float = 0
    d7_dan: float = 0
    d7_ghim: float = 0
    d8_can_mang: float = 0
    d9_san_pham_kho: float = 0


class BomLayerResult(BaseModel):
    """Kết quả tính toán cho một lớp giấy."""
    vi_tri_lop: str
    loai_lop: str
    flute_type: str | None = None
    ma_ky_hieu: str
    paper_material_id: int | None = None
    dinh_luong: float
    take_up_factor: float
    dien_tich_1con: float    # m²/unit (after take-up for song layers)
    trong_luong_1con: float  # kg/unit
    don_gia_kg: float
    chi_phi_1con: float
    so_luong_sx: float
    ty_le_hao_hut: float
    trong_luong_can_tong: float
    thanh_tien: float


class IndirectCostItem(BaseModel):
    ten: str
    don_gia_m2: float
    thanh_tien: float


class BomCalculateResponse(BaseModel):
    """Full response từ endpoint /calculate."""
    dimensions: DimensionResult
    chi_phi_giay: float
    chi_phi_gian_tiep: float
    ty_le_hao_hut: float
    chi_phi_hao_hut: float
    ty_le_loi_nhuan: float
    loi_nhuan: float
    addon_detail: AddonDetail
    chi_phi_addon: float
    gia_ban_co_ban: float
    hoa_hong_kd: float
    hoa_hong_kh: float
    chi_phi_khac: float
    chiet_khau: float
    gia_ban_cuoi: float
    bom_layers: list[BomLayerResult]
    gian_tiep_breakdown: list[IndirectCostItem] = []


# ---------------------------------------------------------------------------
# Saved BOM response schemas
# ---------------------------------------------------------------------------

class BomItemResponse(BaseModel):
    id: int
    bom_id: int
    vi_tri_lop: str
    loai_lop: str
    flute_type: str | None
    ma_ky_hieu: str | None
    paper_material_id: int | None
    dinh_luong: Decimal
    take_up_factor: Decimal
    dien_tich_1con: Decimal | None
    trong_luong_1con: Decimal | None
    so_luong_sx: Decimal
    ty_le_hao_hut: Decimal
    trong_luong_can_tong: Decimal | None
    don_gia_kg: Decimal
    thanh_tien: Decimal | None

    class Config:
        from_attributes = True


class BomResponse(BaseModel):
    id: int
    production_order_item_id: int | None

    # Product specs
    loai_thung: str
    dai: Decimal
    rong: Decimal
    cao: Decimal
    so_lop: int
    to_hop_song: str | None

    # Dimensions
    kho_tt: Decimal | None
    dai_tt: Decimal | None
    kho_kh: Decimal | None
    dai_kh: Decimal | None
    dien_tich: Decimal | None

    # Production params
    so_luong_sx: Decimal
    ty_le_hao_hut: Decimal | None

    # Cost breakdown
    chi_phi_giay: Decimal | None
    chi_phi_gian_tiep: Decimal | None
    chi_phi_hao_hut: Decimal | None
    loi_nhuan: Decimal | None
    chi_phi_addon: Decimal | None
    gia_ban_co_ban: Decimal | None
    gia_ban_cuoi: Decimal | None

    # Add-on config
    chong_tham: int
    in_flexo_mau: int
    in_flexo_phu_nen: bool
    in_ky_thuat_so: bool
    chap_xa: bool
    boi: bool
    be_so_con: int
    dan: bool = False
    ghim: bool = False
    can_mang: int
    san_pham_kho: bool

    # Pricing
    ty_le_loi_nhuan: Decimal | None
    hoa_hong_kd_pct: Decimal
    hoa_hong_kh_pct: Decimal
    chi_phi_khac: Decimal
    chiet_khau: Decimal
    hoa_hong_kd: Decimal | None
    hoa_hong_kh: Decimal | None

    # Meta
    trang_thai: str
    ghi_chu: str | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime

    # BOM lines
    items: list[BomItemResponse] = []

    # Chi tiết chi phí gián tiếp (hoạch toán)
    indirect_items: list["BomIndirectItemResponse"] = []

    class Config:
        from_attributes = True


class BomIndirectItemResponse(BaseModel):
    id: int
    bom_id: int
    ten: str
    don_gia_m2: Decimal
    dien_tich: Decimal
    thanh_tien: Decimal


class BomSummaryItem(BaseModel):
    """Lightweight summary dùng cho trang danh sách Định mức BOM."""
    id: int
    production_order_item_id: int | None
    # Context từ quan hệ
    ten_hang: str | None
    so_lenh: str | None
    ten_khach_hang: str | None
    ma_khach_hang: str | None
    # Thông số
    loai_thung: str
    dai: Decimal
    rong: Decimal
    cao: Decimal
    so_lop: int
    to_hop_song: str | None
    so_luong_sx: Decimal
    # Chi phí tổng hợp
    chi_phi_giay: Decimal | None
    chi_phi_gian_tiep: Decimal | None
    chi_phi_hao_hut: Decimal | None
    chi_phi_addon: Decimal | None
    gia_ban_cuoi: Decimal | None
    # Trạng thái
    trang_thai: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    class Config:
        from_attributes = True
