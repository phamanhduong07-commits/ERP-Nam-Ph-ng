from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


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
    ghi_chu: Optional[str] = None
    trang_thai: Optional[str] = None

class LaborContract(LaborContractBase):
    id: int
    employee_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Employee Schemas ---
class EmployeeBase(BaseModel):
    ma_nv: str
    ho_ten: str
    ngay_sinh: Optional[date] = None
    gioi_tinh: Optional[str] = None
    cccd: Optional[str] = None
    ngay_cap: Optional[date] = None
    noi_cap: Optional[str] = None
    dia_chi: Optional[str] = None
    que_quan: Optional[str] = None
    so_dien_thoai: Optional[str] = None
    email: Optional[str] = None
    so_tk_ngan_hang: Optional[str] = None
    ten_ngan_hang: Optional[str] = None
    chi_nhanh_ngan_hang: Optional[str] = None
    phap_nhan_id: Optional[int] = None
    phan_xuong_id: Optional[int] = None
    bo_phan_id: Optional[int] = None
    chuc_vu_id: Optional[int] = None
    ma_van_tay: Optional[str] = None
    user_id: Optional[int] = None
    ngay_vao_lam: Optional[date] = None
    he_so_ca_nhan: Decimal = Decimal("1.5")
    trang_thai: str = "dang_lam"

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeBulkCreate(BaseModel):
    items: List[EmployeeCreate]

class EmployeeUpdate(BaseModel):
    ho_ten: Optional[str] = None
    ngay_sinh: Optional[date] = None
    gioi_tinh: Optional[str] = None
    cccd: Optional[str] = None
    ngay_cap: Optional[date] = None
    noi_cap: Optional[str] = None
    dia_chi: Optional[str] = None
    que_quan: Optional[str] = None
    so_dien_thoai: Optional[str] = None
    email: Optional[str] = None
    so_tk_ngan_hang: Optional[str] = None
    ten_ngan_hang: Optional[str] = None
    chi_nhanh_ngan_hang: Optional[str] = None
    phap_nhan_id: Optional[int] = None
    phan_xuong_id: Optional[int] = None
    bo_phan_id: Optional[int] = None
    chuc_vu_id: Optional[int] = None
    ma_van_tay: Optional[str] = None
    user_id: Optional[int] = None
    ngay_vao_lam: Optional[date] = None
    ngay_nghi_viec: Optional[date] = None
    he_so_ca_nhan: Optional[Decimal] = None
    trang_thai: Optional[str] = None

class Employee(EmployeeBase):
    id: int
    ngay_nghi_viec: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


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
    ma_hang: str
    ten_hang: str
    phan_xuong_id: Optional[int] = None
    cong_doan: Optional[str] = None
    phan_tram_luong_sp: Decimal = Decimal("100")
    don_gia: Decimal = Decimal("0")
    loai: str = "san_pham"
    ghi_chu: Optional[str] = None
    trang_thai: bool = True

class PayrollConfigCreate(PayrollConfigBase):
    pass

class PayrollConfigBulkCreate(BaseModel):
    items: List[PayrollConfigCreate]

class PayrollConfigUpdate(BaseModel):
    ma_cau_hinh: Optional[str] = None
    ten_cau_hinh: Optional[str] = None
    loai: Optional[str] = None
    gia_tri: Optional[Decimal] = None
    ghi_chu: Optional[str] = None
    trang_thai: Optional[bool] = None

class PayrollConfig(PayrollConfigBase):
    id: int
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- EmployeeHistory Schemas ---
class EmployeeHistoryBase(BaseModel):
    employee_id: int
    loai: str
    gia_tri_cu: Optional[str] = None
    gia_tri_moi: Optional[str] = None
    ly_do: Optional[str] = None
    ngay_hieu_luc: date = date.today()

class EmployeeHistory(EmployeeHistoryBase):
    id: int
    created_at: datetime
    created_by: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)


# --- EmployeeDocument Schemas ---
class EmployeeDocumentBase(BaseModel):
    employee_id: int
    ten_tai_lieu: str
    loai_tai_lieu: str
    file_path: str
    ngay_het_han: Optional[date] = None

class EmployeeDocument(EmployeeDocumentBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
