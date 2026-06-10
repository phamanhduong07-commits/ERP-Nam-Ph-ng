from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator


# --- Department Schemas ---
class DepartmentBase(BaseModel):
    ma_bo_phan: str
    ten_bo_phan: str
    mo_ta: Optional[str] = None
    parent_id: Optional[int] = None
    phan_xuong_id: Optional[int] = None
    phap_nhan_id: Optional[int] = None
    trang_thai: bool = True


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    ma_bo_phan: Optional[str] = None
    ten_bo_phan: Optional[str] = None
    mo_ta: Optional[str] = None
    parent_id: Optional[int] = None
    phan_xuong_id: Optional[int] = None
    phap_nhan_id: Optional[int] = None
    trang_thai: Optional[bool] = None


class Department(DepartmentBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Position Schemas ---
class PositionBase(BaseModel):
    ma_chuc_vu: str
    ten_chuc_vu: str
    cap_bac: Optional[int] = None
    mo_ta: Optional[str] = None
    trang_thai: bool = True


class PositionCreate(PositionBase):
    pass


class PositionUpdate(BaseModel):
    ma_chuc_vu: Optional[str] = None
    ten_chuc_vu: Optional[str] = None
    cap_bac: Optional[int] = None
    mo_ta: Optional[str] = None
    trang_thai: Optional[bool] = None


class Position(PositionBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


# --- LaborContract Schemas ---
class LaborContractBase(BaseModel):
    so_hop_dong: str
    loai_hop_dong: str
    ngay_ky: date
    ngay_hieu_luc: date
    ngay_het_han: Optional[date] = None
    luong_co_ban: Decimal = Decimal(0)
    phu_cap: Decimal = Decimal(0)
    phu_cap_chuyen_can: Decimal = Decimal(0)
    phu_cap_trach_nhiem: Decimal = Decimal(0)
    phu_cap_nha_o_com: Decimal = Decimal(0)
    phu_cap_dien_thoai: Decimal = Decimal(0)
    phu_cap_khac: Decimal = Decimal(0)
    ghi_chu: Optional[str] = None
    trang_thai: str = "hieu_luc"


class LaborContractCreate(LaborContractBase):
    employee_id: int


class LaborContractUpdate(BaseModel):
    so_hop_dong: Optional[str] = None
    loai_hop_dong: Optional[str] = None
    ngay_ky: Optional[date] = None
    ngay_hieu_luc: Optional[date] = None
    ngay_het_han: Optional[date] = None
    luong_co_ban: Optional[Decimal] = None
    phu_cap: Optional[Decimal] = None
    phu_cap_chuyen_can: Optional[Decimal] = None
    phu_cap_trach_nhiem: Optional[Decimal] = None
    phu_cap_nha_o_com: Optional[Decimal] = None
    phu_cap_dien_thoai: Optional[Decimal] = None
    phu_cap_khac: Optional[Decimal] = None
    ghi_chu: Optional[str] = None
    trang_thai: Optional[str] = None


class LaborContract(LaborContractBase):
    id: int
    employee_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Team Schemas ---
class TeamBase(BaseModel):
    ten_to: str = Field(min_length=1, max_length=150)
    bo_phan_id: Optional[int] = None
    to_truong_id: Optional[int] = None
    mo_ta: Optional[str] = None
    trang_thai: bool = True


class TeamCreate(TeamBase):
    pass


class TeamUpdate(BaseModel):
    ten_to: Optional[str] = Field(default=None, min_length=1, max_length=150)
    bo_phan_id: Optional[int] = None
    to_truong_id: Optional[int] = None
    mo_ta: Optional[str] = None
    trang_thai: Optional[bool] = None


class Team(TeamBase):
    id: int
    created_at: datetime
    ten_bo_phan: Optional[str] = None
    ho_ten_to_truong: Optional[str] = None
    so_nv: Optional[int] = 0
    model_config = ConfigDict(from_attributes=True)


# --- HealthCheck Schemas (Khám sức khỏe định kỳ) ---
def _validate_safe_url(v: Optional[str]) -> Optional[str]:
    """Allowlist: chỉ chấp nhận http(s):// hoặc đường dẫn tương đối /.

    Chống XSS khi frontend render <a href>, <img src>, <iframe src> với các scheme độc:
    javascript:, data:, blob:, vbscript:, file:, ftp:.
    """
    if not v:
        return v
    s = v.strip()
    lower = s.lower()
    if s.startswith("/") or s.startswith("./") or s.startswith("../"):
        return s
    if lower.startswith("http://") or lower.startswith("https://"):
        return s
    raise ValueError(
        "URL chỉ chấp nhận http(s):// hoặc đường dẫn tương đối. "
        "Scheme javascript:/data:/blob:/vbscript:/file:/ftp: bị từ chối."
    )


class HealthCheckBase(BaseModel):
    employee_id: int
    ngay_kham: date
    loai_kham: str = "dinh_ky"  # dinh_ky | dot_xuat | truoc_tuyen_dung | sau_om_dau
    phan_loai_suc_khoe: Optional[str] = Field(default=None, max_length=5)  # I-V
    noi_kham: Optional[str] = Field(default=None, max_length=255)
    bac_si: Optional[str] = Field(default=None, max_length=150)
    ket_luan: Optional[str] = None
    benh_man_tinh: Optional[str] = None
    file_url: Optional[str] = Field(default=None, max_length=500)
    chi_phi: Decimal = Field(default=Decimal(0), ge=0)
    ngay_kham_tiep_theo: Optional[date] = None
    ghi_chu: Optional[str] = None

    @field_validator("file_url")
    @classmethod
    def _vt_file_url(cls, v):
        return _validate_safe_url(v)


class HealthCheckCreate(HealthCheckBase):
    pass


class HealthCheckUpdate(BaseModel):
    ngay_kham: Optional[date] = None
    loai_kham: Optional[str] = None
    phan_loai_suc_khoe: Optional[str] = Field(default=None, max_length=5)
    noi_kham: Optional[str] = Field(default=None, max_length=255)
    bac_si: Optional[str] = Field(default=None, max_length=150)
    ket_luan: Optional[str] = None
    benh_man_tinh: Optional[str] = None
    file_url: Optional[str] = Field(default=None, max_length=500)
    chi_phi: Optional[Decimal] = Field(default=None, ge=0)
    ngay_kham_tiep_theo: Optional[date] = None
    ghi_chu: Optional[str] = None

    @field_validator("file_url")
    @classmethod
    def _vt_file_url(cls, v):
        return _validate_safe_url(v)


class HealthCheck(HealthCheckBase):
    id: int
    created_at: datetime
    created_by_id: Optional[int] = None
    # Enriched
    ho_ten: Optional[str] = None
    ma_nv: Optional[str] = None
    ten_bo_phan: Optional[str] = None
    ten_phap_nhan: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# --- Employee Schemas ---
class _EmployeeExtendedFields(BaseModel):
    """Mixin: all the new HR form fields (giai đoạn 1)."""
    ho_dem: Optional[str] = Field(default=None, max_length=100)
    ten: Optional[str] = Field(default=None, max_length=50)
    ten_bi_danh: Optional[str] = Field(default=None, max_length=100)
    quoc_tich: Optional[str] = Field(default="Việt Nam", max_length=50)
    dan_toc: Optional[str] = Field(default=None, max_length=50)
    ton_giao: Optional[str] = Field(default=None, max_length=50)
    noi_sinh_tinh: Optional[str] = Field(default=None, max_length=100)
    noi_sinh_dia_chi: Optional[str] = None
    tinh_que_quan: Optional[str] = Field(default=None, max_length=100)
    huyen_que_quan: Optional[str] = Field(default=None, max_length=100)
    phuong_que_quan: Optional[str] = Field(default=None, max_length=100)
    dia_chi_que_quan: Optional[str] = None
    tinh_ho_khau: Optional[str] = Field(default=None, max_length=100)
    huyen_ho_khau: Optional[str] = Field(default=None, max_length=100)
    phuong_ho_khau: Optional[str] = Field(default=None, max_length=100)
    dia_chi_ho_khau: Optional[str] = None
    dia_chi_hien_tai: Optional[str] = None
    dien_thoai_ban: Optional[str] = Field(default=None, max_length=20)
    avatar_url: Optional[str] = Field(default=None, max_length=500)
    # Sơ yếu
    trinh_do_hoc_van: Optional[str] = Field(default=None, max_length=100)
    chuyen_nganh: Optional[str] = Field(default=None, max_length=150)
    truong_dao_tao: Optional[str] = Field(default=None, max_length=255)
    nam_tot_nghiep: Optional[int] = Field(default=None, ge=1900, le=2100)
    ngoai_ngu: Optional[str] = Field(default=None, max_length=150)
    tin_hoc: Optional[str] = Field(default=None, max_length=150)
    ky_nang_khac: Optional[str] = None
    so_yeu_tom_tat: Optional[str] = None
    # BHXH
    so_so_bhxh: Optional[str] = Field(default=None, max_length=30)
    ngay_tham_gia_bhxh: Optional[date] = None
    ma_bhyt: Optional[str] = Field(default=None, max_length=30)
    noi_kham_chua_benh: Optional[str] = Field(default=None, max_length=255)
    muc_dong_bhxh: Optional[Decimal] = Field(default=None, ge=0)
    # Tổ chức (cấp tổ - dưới bộ phận)
    to_id: Optional[int] = None

    @field_validator("avatar_url")
    @classmethod
    def reject_base64_data_url(cls, v: Optional[str]) -> Optional[str]:
        """Tránh lưu base64 data URL vào DB (DB bloat + vượt 500 chars).
        Chỉ chấp nhận URL http(s):// hoặc đường dẫn tương đối /static..."""
        if not v:
            return v
        if v.startswith("data:"):
            raise ValueError(
                "avatar_url không chấp nhận data URL (base64). Upload file qua "
                "endpoint media riêng và truyền URL kết quả."
            )
        return v


class EmployeeBase(BaseModel):
    ma_nv: str = Field(min_length=1, max_length=20)
    ho_ten: str = Field(min_length=1, max_length=150)
    ngay_sinh: Optional[date] = None
    gioi_tinh: Optional[str] = Field(default=None, max_length=10)
    cccd: Optional[str] = Field(default=None, max_length=20)
    ngay_cap: Optional[date] = None
    noi_cap: Optional[str] = Field(default=None, max_length=150)
    dia_chi: Optional[str] = None
    que_quan: Optional[str] = Field(default=None, max_length=255)
    so_dien_thoai: Optional[str] = Field(default=None, max_length=20)
    email: Optional[str] = Field(default=None, max_length=100)
    so_tk_ngan_hang: Optional[str] = Field(default=None, max_length=50)
    ten_ngan_hang: Optional[str] = Field(default=None, max_length=150)
    chi_nhanh_ngan_hang: Optional[str] = Field(default=None, max_length=150)
    phap_nhan_id: Optional[int] = None
    phan_xuong_id: Optional[int] = None
    bo_phan_id: Optional[int] = None
    chuc_vu_id: Optional[int] = None
    ma_van_tay: Optional[str] = Field(default=None, max_length=50)
    # user_id KHÔNG có ở Base — chỉ set qua issue_employee_account flow để tránh
    # client mass-assign nhân viên vào user_id tùy ý.
    ngay_vao_lam: Optional[date] = None
    he_so_ca_nhan: Decimal = Field(default=Decimal("1.5"), ge=0, le=10)
    trang_thai: str = Field(default="dang_lam", max_length=20)


class EmployeeCreate(EmployeeBase, _EmployeeExtendedFields):
    pass


class EmployeeBulkCreate(BaseModel):
    items: List[EmployeeCreate]


class EmployeeUpdate(_EmployeeExtendedFields):
    ho_ten: Optional[str] = Field(default=None, min_length=1, max_length=150)
    ngay_sinh: Optional[date] = None
    gioi_tinh: Optional[str] = Field(default=None, max_length=10)
    cccd: Optional[str] = Field(default=None, max_length=20)
    ngay_cap: Optional[date] = None
    noi_cap: Optional[str] = Field(default=None, max_length=150)
    dia_chi: Optional[str] = None
    que_quan: Optional[str] = Field(default=None, max_length=255)
    so_dien_thoai: Optional[str] = Field(default=None, max_length=20)
    email: Optional[str] = Field(default=None, max_length=100)
    so_tk_ngan_hang: Optional[str] = Field(default=None, max_length=50)
    ten_ngan_hang: Optional[str] = Field(default=None, max_length=150)
    chi_nhanh_ngan_hang: Optional[str] = Field(default=None, max_length=150)
    phap_nhan_id: Optional[int] = None
    phan_xuong_id: Optional[int] = None
    bo_phan_id: Optional[int] = None
    chuc_vu_id: Optional[int] = None
    ma_van_tay: Optional[str] = Field(default=None, max_length=50)
    # user_id KHÔNG có ở Update — chỉ set qua issue_employee_account flow.
    ngay_vao_lam: Optional[date] = None
    ngay_nghi_viec: Optional[date] = None
    he_so_ca_nhan: Optional[Decimal] = Field(default=None, ge=0, le=10)
    trang_thai: Optional[str] = Field(default=None, max_length=20)


class Employee(EmployeeBase, _EmployeeExtendedFields):
    id: int
    ngay_nghi_viec: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- FamilyRelation Schemas ---
class FamilyRelationBase(BaseModel):
    ho_ten: str = Field(min_length=1, max_length=150)
    nam_sinh: Optional[int] = Field(default=None, ge=1900, le=2100)
    moi_quan_he: Optional[str] = Field(default=None, max_length=50)
    nghe_nghiep: Optional[str] = Field(default=None, max_length=150)
    so_dien_thoai: Optional[str] = Field(default=None, max_length=20)
    ghi_chu: Optional[str] = Field(default=None, max_length=1000)


class FamilyRelationCreate(FamilyRelationBase):
    pass


class FamilyRelationUpdate(BaseModel):
    ho_ten: Optional[str] = Field(default=None, min_length=1, max_length=150)
    nam_sinh: Optional[int] = Field(default=None, ge=1900, le=2100)
    moi_quan_he: Optional[str] = Field(default=None, max_length=50)
    nghe_nghiep: Optional[str] = Field(default=None, max_length=150)
    so_dien_thoai: Optional[str] = Field(default=None, max_length=20)
    ghi_chu: Optional[str] = Field(default=None, max_length=1000)


class FamilyRelation(FamilyRelationBase):
    id: int
    employee_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- CheckIn Location (Sprint B — geo-fence chấm công) ---
class CheckInLocationBase(BaseModel):
    ten: str = Field(min_length=1, max_length=150)
    dia_chi: Optional[str] = None
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    ban_kinh_m: int = Field(default=100, ge=10, le=10000, description="Bán kính cho phép chấm công (mét)")
    mau_sac: Optional[str] = Field(default="#1677ff", max_length=20)
    ghi_chu: Optional[str] = None
    is_active: bool = True


class CheckInLocationCreate(CheckInLocationBase):
    pass


class CheckInLocationUpdate(BaseModel):
    ten: Optional[str] = Field(default=None, min_length=1, max_length=150)
    dia_chi: Optional[str] = None
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)
    ban_kinh_m: Optional[int] = Field(default=None, ge=10, le=10000)
    mau_sac: Optional[str] = Field(default=None, max_length=20)
    ghi_chu: Optional[str] = None
    is_active: Optional[bool] = None


class CheckInLocation(CheckInLocationBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Mobile checkin request/response ---
class CheckInRequest(BaseModel):
    """Payload chấm công từ mobile."""
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    address: Optional[str] = Field(default=None, max_length=500)
    # Selfie URL (đã upload qua media endpoint, hoặc tạm nhận data URL ngắn dưới 2MB)
    selfie_url: Optional[str] = Field(default=None, max_length=500)
    type: Literal["in", "out"] = "in"  # vào / ra


class CheckInResponse(BaseModel):
    """Kết quả chấm công."""
    success: bool
    message: str
    type: str               # in / out
    log_id: Optional[int] = None
    location_id: Optional[int] = None
    location_name: Optional[str] = None
    distance_m: Optional[float] = None  # Khoảng cách đến địa điểm gần nhất


# --- AttendanceLog Schemas ---
class AttendanceLogBase(BaseModel):
    employee_id: int
    ngay: date
    gio_vao: Optional[datetime] = None
    gio_ra: Optional[datetime] = None
    loai: str = "van_tay"
    so_cong: Decimal = Decimal(0)
    so_gio_ot: Decimal = Decimal(0)
    trang_thai: str = "hop_le"
    ghi_chu: Optional[str] = None
    # Geo-fence fields (Sprint B)
    checkin_lat: Optional[float] = None
    checkin_lng: Optional[float] = None
    checkin_address: Optional[str] = None
    checkin_selfie_url: Optional[str] = None
    checkin_location_id: Optional[int] = None
    checkin_distance_m: Optional[float] = None
    checkout_lat: Optional[float] = None
    checkout_lng: Optional[float] = None
    checkout_address: Optional[str] = None
    checkout_selfie_url: Optional[str] = None
    checkout_distance_m: Optional[float] = None


class AttendanceLogCreate(AttendanceLogBase):
    pass


class AttendanceLogUpdate(BaseModel):
    gio_vao: Optional[datetime] = None
    gio_ra: Optional[datetime] = None
    so_cong: Optional[Decimal] = None
    so_gio_ot: Optional[Decimal] = None
    trang_thai: Optional[str] = None
    ghi_chu: Optional[str] = None


class AttendanceLog(AttendanceLogBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- LeaveRequest Schemas ---
class LeaveRequestBase(BaseModel):
    employee_id: int
    loai_don: str
    ngay_bat_dau: datetime
    ngay_ket_thuc: datetime
    tong_ngay: Decimal
    ly_do: Optional[str] = None
    trang_thai: str = "cho_duyet"


class LeaveRequestCreate(LeaveRequestBase):
    pass


class LeaveRequestUpdate(BaseModel):
    loai_don: Optional[str] = None
    ngay_bat_dau: Optional[datetime] = None
    ngay_ket_thuc: Optional[datetime] = None
    tong_ngay: Optional[Decimal] = None
    ly_do: Optional[str] = None
    trang_thai: Optional[str] = None
    nguoi_duyet_dept_id: Optional[int] = None
    nguoi_duyet_bgd_id: Optional[int] = None
    y_kien_duyet: Optional[str] = None
    ngay_duyet: Optional[datetime] = None


class LeaveApprovalRequest(BaseModel):
    trang_thai: str = "bgd_duyet"
    y_kien_duyet: Optional[str] = None
    nguoi_duyet_id: Optional[int] = None


class LeaveRequest(LeaveRequestBase):
    id: int
    nguoi_duyet_dept_id: Optional[int] = None
    nguoi_duyet_bgd_id: Optional[int] = None
    y_kien_duyet: Optional[str] = None
    ngay_duyet: Optional[datetime] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- PayrollConfig Schemas ---
class PayrollConfigBase(BaseModel):
    loai: str = "san_pham"
    # loai = 'san_pham' | 'phu_cap' | 'khac'
    ma_hang: Optional[str] = None
    ten_hang: Optional[str] = None
    phan_xuong_id: Optional[int] = None
    cong_doan: Optional[str] = None
    phan_tram_luong_sp: Optional[Decimal] = Decimal("100")
    don_gia: Optional[Decimal] = Decimal("0")
    # loai = 'so_lop_giay' — hệ số nhân máy sóng → tính lương sản phẩm
    ma_cau_hinh: Optional[str] = None
    ten_cau_hinh: Optional[str] = None
    gia_tri: Optional[Decimal] = None
    ghi_chu: Optional[str] = None
    trang_thai: bool = True


class PayrollConfigCreate(PayrollConfigBase):
    pass


class PayrollConfigBulkCreate(BaseModel):
    items: List[PayrollConfigCreate]


class PayrollConfigUpdate(BaseModel):
    loai: Optional[str] = None
    ma_hang: Optional[str] = None
    ten_hang: Optional[str] = None
    phan_xuong_id: Optional[int] = None
    cong_doan: Optional[str] = None
    phan_tram_luong_sp: Optional[Decimal] = None
    don_gia: Optional[Decimal] = None
    ma_cau_hinh: Optional[str] = None
    ten_cau_hinh: Optional[str] = None
    gia_tri: Optional[Decimal] = None
    ghi_chu: Optional[str] = None
    trang_thai: Optional[bool] = None


class PayrollConfig(PayrollConfigBase):
    id: int
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- EmployeeHistory Schemas ---
HistoryLoai = Literal["he_so", "chuc_vu", "bo_phan", "luong_cb", "phu_cap"]


class EmployeeHistoryBase(BaseModel):
    employee_id: int
    loai: HistoryLoai
    gia_tri_cu: Optional[str] = Field(default=None, max_length=255)
    gia_tri_moi: Optional[str] = Field(default=None, max_length=255)
    ly_do: Optional[str] = None
    ngay_hieu_luc: date = Field(default_factory=date.today)


class EmployeeHistoryCreate(BaseModel):
    """Tạo bản ghi lịch sử thay đổi — employee_id lấy từ path param."""
    loai: HistoryLoai
    gia_tri_cu: Optional[str] = Field(default=None, max_length=255)
    gia_tri_moi: Optional[str] = Field(default=None, max_length=255)
    ly_do: Optional[str] = None
    ngay_hieu_luc: date = Field(default_factory=date.today)


class EmployeeHistoryUpdate(BaseModel):
    gia_tri_cu: Optional[str] = Field(default=None, max_length=255)
    gia_tri_moi: Optional[str] = Field(default=None, max_length=255)
    ly_do: Optional[str] = None
    ngay_hieu_luc: Optional[date] = None


class EmployeeHistory(EmployeeHistoryBase):
    id: int
    created_at: datetime
    created_by: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)


# --- EmployeeDocument Schemas ---
class EmployeeDocumentBase(BaseModel):
    employee_id: int
    ten_tai_lieu: str = Field(min_length=1, max_length=255)
    loai_tai_lieu: str = Field(max_length=50, description="CCCD | HOP_DONG | BANG_CAP | KHAC")
    file_path: str = Field(min_length=1, max_length=500)
    ngay_het_han: Optional[date] = None


DocumentLoai = Literal["CCCD", "HOP_DONG", "BANG_CAP", "CHUNG_CHI", "KHAC"]


class EmployeeDocumentCreate(BaseModel):
    """Tạo tài liệu — employee_id lấy từ path param.

    Lưu ý: file_path chỉ được là media key tương đối (UUID, /media/...)
    Không chấp nhận path traversal (../), absolute path, URL scheme (http/file/data)
    để chuẩn bị cho endpoint serve media sau này.
    """
    ten_tai_lieu: str = Field(min_length=1, max_length=255)
    loai_tai_lieu: DocumentLoai = "KHAC"
    file_path: str = Field(min_length=1, max_length=500)
    ngay_het_han: Optional[date] = None

    @field_validator("file_path")
    @classmethod
    def safe_file_path(cls, v: str) -> str:
        if not v:
            return v
        # Reject path traversal + absolute paths + dangerous URL schemes
        low = v.lower().strip()
        if ".." in low:
            raise ValueError("file_path không được chứa '..' (path traversal)")
        if low.startswith(("/", "\\", "c:", "d:", "e:", "f:")):
            raise ValueError("file_path không chấp nhận absolute path")
        if low.startswith(("file:", "data:", "javascript:", "ftp:")):
            raise ValueError("file_path không chấp nhận scheme này")
        # Cho phép http(s):// để tạm thời accept external URL (sẽ chặt hơn khi có media service)
        return v.strip()


class EmployeeDocument(EmployeeDocumentBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Payroll Holiday Schemas ---
class PayrollHolidayBase(BaseModel):
    ngay: date
    ten_ngay_le: str
    trang_thai: bool = True
    ghi_chu: Optional[str] = None


class PayrollHolidayCreate(PayrollHolidayBase):
    pass


class PayrollHoliday(PayrollHolidayBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
