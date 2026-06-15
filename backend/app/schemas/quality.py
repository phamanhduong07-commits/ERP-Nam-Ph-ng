from datetime import date, datetime
from pydantic import BaseModel, field_validator


class QCDefectCreate(BaseModel):
    loai_loi: str
    mo_ta: str | None = None
    so_luong_loi: int = 0
    hinh_anh_path: str | None = None


class QCDefectResponse(BaseModel):
    id: int
    loai_loi: str
    mo_ta: str | None
    so_luong_loi: int
    hinh_anh_path: str | None

    class Config:
        from_attributes = True


class QCSheetCreate(BaseModel):
    loai: str  # nhan_hang | san_xuat | xuat_hang
    ref_type: str | None = None
    ref_id: int | None = None
    ngay: date
    nguoi_kiem_tra: str | None = None
    ket_qua: str | None = None
    ghi_chu: str | None = None
    phap_nhan_id: int | None = None
    phan_xuong_id: int | None = None
    defects: list[QCDefectCreate] = []

    @field_validator("loai")
    @classmethod
    def validate_loai(cls, v: str) -> str:
        valid = ("nhan_hang", "san_xuat", "xuat_hang")
        if v not in valid:
            raise ValueError(f"loai phải là một trong: {valid}")
        return v

    @field_validator("ket_qua")
    @classmethod
    def validate_ket_qua(cls, v: str | None) -> str | None:
        if v is not None:
            valid = ("dat", "khong_dat", "tam_chap_nhan")
            if v not in valid:
                raise ValueError(f"ket_qua phải là một trong: {valid}")
        return v


class QCSheetUpdate(BaseModel):
    nguoi_kiem_tra: str | None = None
    ket_qua: str | None = None
    ghi_chu: str | None = None
    defects: list[QCDefectCreate] | None = None

    @field_validator("ket_qua")
    @classmethod
    def validate_ket_qua(cls, v: str | None) -> str | None:
        if v is not None:
            valid = ("dat", "khong_dat", "tam_chap_nhan")
            if v not in valid:
                raise ValueError(f"ket_qua phải là một trong: {valid}")
        return v


class QCSheetResponse(BaseModel):
    id: int
    so_phieu: str
    loai: str
    ref_type: str | None
    ref_id: int | None
    ngay: date
    nguoi_kiem_tra: str | None
    ket_qua: str | None
    ghi_chu: str | None
    phap_nhan_id: int | None
    phan_xuong_id: int | None
    created_by: int | None
    created_at: datetime
    defects: list[QCDefectResponse] = []

    class Config:
        from_attributes = True


class QCStatsResponse(BaseModel):
    tong: int
    dat: int
    khong_dat: int
    tam_chap_nhan: int
    chua_co_ket_qua: int
    ty_le_dat_pct: float


# ── QC Giấy Cuộn ────────────────────────────────────────────────────────────

class QCGiayCuonCreate(BaseModel):
    paper_material_id: int
    goods_receipt_id: int | None = None
    goods_receipt_item_id: int | None = None
    ngay_nhap_giay: date | None = None
    ngay_kiem_tra: date
    nguoi_kiem_tra: str | None = None
    trong_luong_tem: float | None = None
    kho_thuc_te: float | None = None
    kho_tc: float | None = None
    # Định lượng
    dl_l1: float | None = None
    dl_l2: float | None = None
    # Độ bục
    buc_l1: float | None = None
    buc_l2: float | None = None
    buc_l3: float | None = None
    buc_l4: float | None = None
    # Độ nén vòng
    nen_vong_l1: float | None = None
    nen_vong_l2: float | None = None
    nen_vong_l3: float | None = None
    ghi_chu: str | None = None
    phap_nhan_id: int | None = None


class QCGiayCuonUpdate(BaseModel):
    ngay_kiem_tra: date | None = None
    nguoi_kiem_tra: str | None = None
    trong_luong_tem: float | None = None
    kho_thuc_te: float | None = None
    kho_tc: float | None = None
    dl_l1: float | None = None
    dl_l2: float | None = None
    buc_l1: float | None = None
    buc_l2: float | None = None
    buc_l3: float | None = None
    buc_l4: float | None = None
    nen_vong_l1: float | None = None
    nen_vong_l2: float | None = None
    nen_vong_l3: float | None = None
    ghi_chu: str | None = None


class QCGiayCuonResponse(BaseModel):
    id: int
    so_phieu: str
    paper_material_id: int
    goods_receipt_id: int | None
    goods_receipt_item_id: int | None
    ngay_nhap_giay: date | None
    ngay_kiem_tra: date
    nguoi_kiem_tra: str | None
    trong_luong_tem: float | None
    kho_thuc_te: float | None
    kho_tc: float | None
    # Snapshot TC
    tc_dinh_luong: float | None
    tc_sai_so_pct: float | None
    tc_do_buc: float | None
    tc_do_nen_vong: float | None
    # Định lượng
    dl_l1: float | None
    dl_l2: float | None
    dl_tb: float | None
    dl_ket_qua: str | None
    # Độ bục
    buc_l1: float | None
    buc_l2: float | None
    buc_l3: float | None
    buc_l4: float | None
    buc_tb: float | None
    buc_ket_qua: str | None
    # Độ nén vòng
    nen_vong_l1: float | None
    nen_vong_l2: float | None
    nen_vong_l3: float | None
    nen_vong_tb: float | None
    nen_vong_ket_qua: str | None
    # Khổ
    kho_ket_qua: str | None
    # Tổng hợp
    ket_qua: str | None
    ghi_chu: str | None
    phap_nhan_id: int | None
    created_by: int | None
    created_at: datetime
    # Tên hiển thị
    paper_material_ma: str | None = None
    paper_material_ten: str | None = None
    ncc_ten: str | None = None

    class Config:
        from_attributes = True


class QCGiayCuonStatsResponse(BaseModel):
    tong: int
    dat: int
    khong_dat: int
    chua_co_ket_qua: int
    ty_le_dat_pct: float


# ── QC NVL (Nguyên vật liệu khác) ───────────────────────────────────────────

class ChiTieuItem(BaseModel):
    stt: int
    ten_chi_tieu: str
    don_vi: str | None = None
    yeu_cau_text: str | None = None
    kieu_kiem_tra: str = "pass_fail"  # range | min | max | pass_fail
    gia_tri_min: float | None = None
    gia_tri_max: float | None = None
    bat_buoc: bool = True


class QCNvlItemResult(BaseModel):
    stt: int
    ten_chi_tieu: str
    yeu_cau: str | None = None
    ket_qua_do: str | None = None   # giá trị đo được (text)
    ket_qua: str | None = None      # dat | khong_dat | None
    ghi_chu: str | None = None


class QCNvlCreate(BaseModel):
    other_material_id: int
    goods_receipt_id: int | None = None
    ngay_kiem_tra: date
    nguoi_kiem_tra: str | None = None
    tieu_chuan_id: int | None = None
    items_json: list[QCNvlItemResult] | None = None
    ghi_chu: str | None = None
    phap_nhan_id: int | None = None


class QCNvlUpdate(BaseModel):
    ngay_kiem_tra: date | None = None
    nguoi_kiem_tra: str | None = None
    tieu_chuan_id: int | None = None
    items_json: list[QCNvlItemResult] | None = None
    ghi_chu: str | None = None


class QCNvlResponse(BaseModel):
    id: int
    so_phieu: str
    other_material_id: int
    goods_receipt_id: int | None
    ngay_kiem_tra: date
    nguoi_kiem_tra: str | None
    tieu_chuan_id: int | None
    tc_snapshot_json: list | None
    items_json: list | None
    ket_qua: str | None
    ghi_chu: str | None
    phap_nhan_id: int | None
    created_by: int | None
    created_at: datetime
    # Tên hiển thị (enriched)
    other_material_ma: str | None = None
    other_material_ten: str | None = None
    tieu_chuan_ten: str | None = None
    ncc_ten: str | None = None

    class Config:
        from_attributes = True


class QCNvlStatsResponse(BaseModel):
    tong: int
    dat: int
    khong_dat: int
    chua_co_ket_qua: int
    ty_le_dat_pct: float
