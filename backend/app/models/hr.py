from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey, Integer, Numeric,
    String, Text, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class Vehicle(Base):
    """Danh mục Đội xe vận tải"""
    __tablename__ = "hr_vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bien_so: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    ten_xe: Mapped[str] = mapped_column(String(100))
    loai_xe: Mapped[str | None] = mapped_column(String(50)) # 5 tấn, 10 tấn...
    
    dinh_muc_dau: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0) # Lít/100km
    
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Department(Base):
    """Phòng ban / Bộ phận / Khối"""
    __tablename__ = "hr_departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_bo_phan: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    ten_bo_phan: Mapped[str] = mapped_column(String(150), nullable=False)
    mo_ta: Mapped[str | None] = mapped_column(Text)
    
    # Parent-child relationship for tree structure (Khối -> Phòng -> Bộ phận)
    parent_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("hr_departments.id"), nullable=True)
    
    # Link to physical location/workshop if applicable
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True)
    
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    parent: Mapped["Department | None"] = relationship("Department", remote_side=[id], backref="children")
    phan_xuong: Mapped["PhanXuong | None"] = relationship("PhanXuong")
    phap_nhan: Mapped["PhapNhan | None"] = relationship("PhapNhan")
    employees: Mapped[list["Employee"]] = relationship("Employee", back_populates="bo_phan")


class Position(Base):
    """Chức vụ / Chức danh"""
    __tablename__ = "hr_positions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_chuc_vu: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    ten_chuc_vu: Mapped[str] = mapped_column(String(150), nullable=False)
    cap_bac: Mapped[int | None] = mapped_column(Integer)  # Cấp độ quản lý
    mo_ta: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)

    employees: Mapped[list["Employee"]] = relationship("Employee", back_populates="chuc_vu")


class Employee(Base):
    """Hồ sơ nhân viên chính"""
    __tablename__ = "hr_employees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_nv: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    ho_ten: Mapped[str] = mapped_column(String(150), nullable=False)
    
    # Thông tin cá nhân
    ngay_sinh: Mapped[date | None] = mapped_column(Date)
    gioi_tinh: Mapped[str | None] = mapped_column(String(10))  # Nam / Nữ / Khác
    cccd: Mapped[str | None] = mapped_column(String(20), unique=True)
    ngay_cap: Mapped[date | None] = mapped_column(Date)
    noi_cap: Mapped[str | None] = mapped_column(String(150))
    dia_chi: Mapped[str | None] = mapped_column(Text)
    que_quan: Mapped[str | None] = mapped_column(String(255))
    so_dien_thoai: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(100))
    
    # Thông tin thanh toán
    so_tk_ngan_hang: Mapped[str | None] = mapped_column(String(50))
    ten_ngan_hang: Mapped[str | None] = mapped_column(String(150))
    chi_nhanh_ngan_hang: Mapped[str | None] = mapped_column(String(150))
    
    # Thông tin công việc
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True)
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)
    bo_phan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("hr_departments.id"), nullable=True)
    chuc_vu_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("hr_positions.id"), nullable=True)
    
    # Chấm công & Hệ thống
    ma_van_tay: Mapped[str | None] = mapped_column(String(50))
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Hệ số cá nhân (Điều 11)
    he_so_ca_nhan: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=1.5)
    
    ngay_vao_lam: Mapped[date | None] = mapped_column(Date, default=date.today)
    ngay_nghi_viec: Mapped[date | None] = mapped_column(Date)
    
    # Thông tin tài xế (Mở rộng theo báo cáo Logistics)
    is_tai_xe: Mapped[bool] = mapped_column(Boolean, default=False)
    hang_bang_lai: Mapped[str | None] = mapped_column(String(20))
    ngay_het_han_bang: Mapped[date | None] = mapped_column(Date)
    vehicle_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("hr_vehicles.id"))
    
    trang_thai: Mapped[str] = mapped_column(String(20), default="dang_lam") # dang_lam | tam_nghi | da_nghi
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Quan hệ
    phap_nhan: Mapped["PhapNhan | None"] = relationship("PhapNhan")
    phan_xuong: Mapped["PhanXuong | None"] = relationship("PhanXuong")
    bo_phan: Mapped["Department | None"] = relationship("Department", back_populates="employees")
    chuc_vu: Mapped["Position | None"] = relationship("Position", back_populates="employees")
    user: Mapped["User | None"] = relationship("User")
    contracts: Mapped[list["LaborContract"]] = relationship("LaborContract", back_populates="employee")


class LaborContract(Base):
    """Hợp đồng lao động"""
    __tablename__ = "hr_contracts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("hr_employees.id"), nullable=False)
    so_hop_dong: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    
    # loai: thu_viec | xac_dinh_thoi_han | khong_thoi_han | khoan_viec
    loai_hop_dong: Mapped[str] = mapped_column(String(50), nullable=False)
    
    ngay_ky: Mapped[date] = mapped_column(Date)
    ngay_hieu_luc: Mapped[date] = mapped_column(Date)
    ngay_het_han: Mapped[date | None] = mapped_column(Date)
    
    luong_co_ban: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    phu_cap: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    phu_cap_chuyen_can: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    phu_cap_trach_nhiem: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    phu_cap_nha_o_com: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    phu_cap_dien_thoai: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    phu_cap_khac: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    
    trang_thai: Mapped[str] = mapped_column(String(20), default="hieu_luc") # hieu_luc | het_han | tam_dung
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    employee: Mapped["Employee"] = relationship("Employee", back_populates="contracts")


class AttendanceLog(Base):
    """Dữ liệu chấm công hàng ngày"""
    __tablename__ = "hr_attendance_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("hr_employees.id"), nullable=False)
    ngay: Mapped[date] = mapped_column(Date, nullable=False)
    
    gio_vao: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    gio_ra: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    
    # loai_cham_cong: van_tay | thu_cong | app
    loai: Mapped[str] = mapped_column(String(20), default="van_tay")
    
    tong_gio_thuc: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0) # Tổng giờ làm việc thực tế (Điều 9)
    so_cong: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=0) # Công quy đổi
    so_gio_ot: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=0)
    
    # trang_thai: hop_le | thieu_ca | nghi_phep | nghi_khong_phep
    trang_thai: Mapped[str] = mapped_column(String(20), default="hop_le")
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    employee: Mapped["Employee"] = relationship("Employee")


class LeaveRequest(Base):
    """Đơn từ (Nghỉ phép, Tăng ca, Công tác...)"""
    __tablename__ = "hr_leave_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("hr_employees.id"), nullable=False)
    
    # loai_don: nghi_phep | tang_ca | di_muon_ve_som | cong_tac
    loai_don: Mapped[str] = mapped_column(String(30), nullable=False)
    
    ngay_bat_dau: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ngay_ket_thuc: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    tong_ngay: Mapped[Decimal] = mapped_column(Numeric(4, 2))
    ly_do: Mapped[str | None] = mapped_column(Text)
    
    # trang_thai: cho_duyet | phong_ban_duyet | bgd_duyet | tu_choi | huy
    trang_thai: Mapped[str] = mapped_column(String(20), default="cho_duyet")
    
    nguoi_duyet_dept_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    nguoi_duyet_bgd_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    
    y_kien_duyet: Mapped[str | None] = mapped_column(Text)
    ngay_duyet: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    employee: Mapped["Employee"] = relationship("Employee")
    dept_approver: Mapped["User | None"] = relationship("User", foreign_keys=[nguoi_duyet_dept_id])
    bgd_approver: Mapped["User | None"] = relationship("User", foreign_keys=[nguoi_duyet_bgd_id])


class EmployeeHistory(Base):
    """Lịch sử thay đổi lương, hệ số, chức vụ"""
    __tablename__ = "hr_employee_histories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("hr_employees.id"), nullable=False)
    
    loai: Mapped[str] = mapped_column(String(50)) # he_so | chuc_vu | bo_phan | luong_cb
    gia_tri_cu: Mapped[str | None] = mapped_column(String(255))
    gia_tri_moi: Mapped[str | None] = mapped_column(String(255))
    
    ly_do: Mapped[str | None] = mapped_column(Text)
    ngay_hieu_luc: Mapped[date] = mapped_column(Date, default=date.today)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))

    employee: Mapped["Employee"] = relationship("Employee")


class EmployeeDocument(Base):
    """Tài liệu hồ sơ (CCCD, Hợp đồng, Bằng cấp...)"""
    __tablename__ = "hr_employee_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("hr_employees.id"), nullable=False)
    
    ten_tai_lieu: Mapped[str] = mapped_column(String(255), nullable=False)
    loai_tai_lieu: Mapped[str] = mapped_column(String(50)) # CCCD | HOP_DONG | BANG_CAP | KHAC
    
    file_path: Mapped[str] = mapped_column(String(500))
    ngay_het_han: Mapped[date | None] = mapped_column(Date)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    employee: Mapped["Employee"] = relationship("Employee")


class FuelLog(Base):
    """Báo cáo chi phí xăng dầu (Ảnh 4)"""
    __tablename__ = "hr_fuel_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ngay_do: Mapped[date] = mapped_column(Date, default=date.today)
    
    vehicle_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("hr_vehicles.id"), nullable=True)
    xe_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("xe.id"), nullable=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("hr_employees.id"), nullable=False) # Tài xế
    
    so_km_chay: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    so_lit_dau: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    don_gia: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    thanh_tien: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    
    so_km_cuoi: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0) # (t)
    so_km_dau: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)  # (t-1)
    
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    vehicle: Mapped["Vehicle | None"] = relationship()
    xe: Mapped["Xe | None"] = relationship("Xe")
    employee: Mapped["Employee"] = relationship()


class PayrollConfig(Base):
    """Bảng đơn giá sản phẩm (Điều 6)"""
    __tablename__ = "hr_payroll_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_hang: Mapped[str] = mapped_column(String(50), unique=True, nullable=False) # VD: IN, MAYSONG_A
    ten_hang: Mapped[str] = mapped_column(String(150), nullable=False)
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)
    cong_doan: Mapped[str | None] = mapped_column(String(50), nullable=True)
    
    phan_tram_luong_sp: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=100) # % lương SP
    don_gia: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0) # Đơn giá sản phẩm
    
    # loai: san_pham | phu_cap | khac
    loai: Mapped[str] = mapped_column(String(50), nullable=False, default="san_pham")
    
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    phan_xuong: Mapped["PhanXuong | None"] = relationship("PhanXuong")

class PayrollRun(Base):
    """Bảng lương tháng đã chốt"""
    __tablename__ = "hr_payroll_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    thang: Mapped[int] = mapped_column(Integer) # 1-12
    nam: Mapped[int] = mapped_column(Integer)
    
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("hr_employees.id"), nullable=False)
    
    # Các thành phần lương
    luong_co_ban: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    luong_san_pham: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    luong_chuyen: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    luong_co_ban_phu_cap: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ngay_cong_nguyen_luong: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)
    gio_cong_thuc_te: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)
    luong_theo_ngay_cong: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ot_gio_ngay_thuong: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)
    ot_gio_chu_nhat: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)
    ot_gio_chu_nhat_tang_ca: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)
    ot_gio_ngay_le: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)
    ot_tien_ngay_thuong: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ot_tien_chu_nhat: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ot_tien_chu_nhat_tang_ca: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ot_tien_ngay_le: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    
    phu_cap: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    phu_cap_chuyen_can: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    phu_cap_trach_nhiem: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    phu_cap_nha_o_com: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    phu_cap_dien_thoai: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    phu_cap_khac: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    tien_chuyen_hqcv_thanh_tich: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    tong_thu_nhap: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    thuong: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    
    # Các khoản trừ
    bao_hiem: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    thue_tncn: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    tam_ung: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    
    thuc_linh: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    
    trang_thai: Mapped[str] = mapped_column(String(20), default="du_thao") # du_thao | da_chot | da_thanh_toan
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    
    employee: Mapped["Employee"] = relationship("Employee")

class PayrollHoliday(Base):
    """Ngay le dung de phan loai tang ca he so 3.0"""
    __tablename__ = "hr_payroll_holidays"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ngay: Mapped[date] = mapped_column(Date, unique=True, nullable=False)
    ten_ngay_le: Mapped[str] = mapped_column(String(150), nullable=False)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class RewardDiscipline(Base):
    """Khen thưởng và Kỷ luật"""
    __tablename__ = "hr_reward_disciplines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("hr_employees.id"), nullable=False)
    
    ngay_quyet_dinh: Mapped[date] = mapped_column(Date, default=date.today)
    
    # loai: khen_thuong | ky_luat
    loai: Mapped[str] = mapped_column(String(20), nullable=False)
    
    # hinh_thuc: thuong_tien | phat_tien | canh_cao | khen_ngoi
    hinh_thuc: Mapped[str] = mapped_column(String(50), nullable=False)
    
    so_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ly_do: Mapped[str] = mapped_column(Text, nullable=False)
    
    # thang_ap_dung: Tháng lương sẽ được cộng/trừ (1-12)
    thang_ap_dung: Mapped[int | None] = mapped_column(Integer)
    nam_ap_dung: Mapped[int | None] = mapped_column(Integer)
    
    trang_thai: Mapped[str] = mapped_column(String(20), default="moi") # moi | da_duyet | huy
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))

    employee: Mapped["Employee"] = relationship("Employee")
