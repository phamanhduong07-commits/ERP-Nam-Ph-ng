from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import (
    Boolean, Date, DateTime, Float, ForeignKey, Integer, Numeric,
    String, Text, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Vehicle(Base):
    """Danh mục Đội xe vận tải"""
    __tablename__ = "hr_vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bien_so: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    ten_xe: Mapped[str] = mapped_column(String(100))
    loai_xe: Mapped[str | None] = mapped_column(String(50))  # 5 tấn, 10 tấn...

    dinh_muc_dau: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)  # Lít/100km

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


class Team(Base):
    """Tổ / Nhóm — cấp dưới Bộ phận trong cây tổ chức.

    Cây tổ chức 4 cấp: Pháp nhân → Bộ phận → Tổ → Nhân viên.
    Một bộ phận có thể có nhiều tổ (vd Khối sản xuất CĐ2 có Tổ In, Tổ Chạp, Tổ Bế...).
    """
    __tablename__ = "hr_teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ten_to: Mapped[str] = mapped_column(String(150), nullable=False)
    bo_phan_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("hr_departments.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    to_truong_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("hr_employees.id", ondelete="SET NULL"), nullable=True,
    )
    mo_ta: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    bo_phan: Mapped["Department | None"] = relationship("Department", foreign_keys=[bo_phan_id])
    to_truong: Mapped["Employee | None"] = relationship("Employee", foreign_keys=[to_truong_id])
    employees: Mapped[list["Employee"]] = relationship(
        "Employee", back_populates="to_nhom", foreign_keys="Employee.to_id",
    )

    __table_args__ = (
        # Cùng 1 bộ phận thì tên tổ phải unique (case-insensitive normalize trong code)
        UniqueConstraint("bo_phan_id", "ten_to", name="uq_team_dept_name"),
    )


class Employee(Base):
    """Hồ sơ nhân viên chính"""
    __tablename__ = "hr_employees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_nv: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    ho_ten: Mapped[str] = mapped_column(String(150), nullable=False)
    # Tách ho_dem + ten để hiển thị form chuẩn HR (giữ ho_ten làm computed/legacy)
    ho_dem: Mapped[str | None] = mapped_column(String(100))
    ten: Mapped[str | None] = mapped_column(String(50))
    ten_bi_danh: Mapped[str | None] = mapped_column(String(100))

    # Thông tin cá nhân
    ngay_sinh: Mapped[date | None] = mapped_column(Date)
    gioi_tinh: Mapped[str | None] = mapped_column(String(10))  # Nam / Nữ / Khác
    quoc_tich: Mapped[str | None] = mapped_column(String(50), default="Việt Nam")
    dan_toc: Mapped[str | None] = mapped_column(String(50))
    ton_giao: Mapped[str | None] = mapped_column(String(50))
    cccd: Mapped[str | None] = mapped_column(String(20), unique=True)
    ngay_cap: Mapped[date | None] = mapped_column(Date)
    noi_cap: Mapped[str | None] = mapped_column(String(150))

    # Nơi sinh
    noi_sinh_tinh: Mapped[str | None] = mapped_column(String(100))
    noi_sinh_dia_chi: Mapped[str | None] = mapped_column(Text)

    # Quê quán (4 cấp)
    tinh_que_quan: Mapped[str | None] = mapped_column(String(100))
    huyen_que_quan: Mapped[str | None] = mapped_column(String(100))
    phuong_que_quan: Mapped[str | None] = mapped_column(String(100))
    dia_chi_que_quan: Mapped[str | None] = mapped_column(Text)

    # Hộ khẩu (4 cấp)
    tinh_ho_khau: Mapped[str | None] = mapped_column(String(100))
    huyen_ho_khau: Mapped[str | None] = mapped_column(String(100))
    phuong_ho_khau: Mapped[str | None] = mapped_column(String(100))
    dia_chi_ho_khau: Mapped[str | None] = mapped_column(Text)

    # Địa chỉ + liên hệ
    dia_chi: Mapped[str | None] = mapped_column(Text)  # Legacy field
    dia_chi_hien_tai: Mapped[str | None] = mapped_column(Text)
    que_quan: Mapped[str | None] = mapped_column(String(255))  # Legacy
    dien_thoai_ban: Mapped[str | None] = mapped_column(String(20))
    so_dien_thoai: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(100))

    # Ảnh đại diện
    avatar_url: Mapped[str | None] = mapped_column(String(500))

    # Sơ yếu (học vấn, kỹ năng)
    trinh_do_hoc_van: Mapped[str | None] = mapped_column(String(100))  # 12/12, Trung cấp, Cao đẳng, Đại học, Sau ĐH
    chuyen_nganh: Mapped[str | None] = mapped_column(String(150))
    truong_dao_tao: Mapped[str | None] = mapped_column(String(255))
    nam_tot_nghiep: Mapped[int | None] = mapped_column(Integer)
    ngoai_ngu: Mapped[str | None] = mapped_column(String(150))     # VD: "Anh - TOEIC 750"
    tin_hoc: Mapped[str | None] = mapped_column(String(150))       # VD: "MOS, AutoCAD"
    ky_nang_khac: Mapped[str | None] = mapped_column(Text)
    so_yeu_tom_tat: Mapped[str | None] = mapped_column(Text)       # Free-text bio

    # BHXH / BHYT
    so_so_bhxh: Mapped[str | None] = mapped_column(String(30), index=True)
    ngay_tham_gia_bhxh: Mapped[date | None] = mapped_column(Date)
    ma_bhyt: Mapped[str | None] = mapped_column(String(30))
    noi_kham_chua_benh: Mapped[str | None] = mapped_column(String(255))
    muc_dong_bhxh: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))  # Mức lương đóng BHXH

    # Thông tin thanh toán
    so_tk_ngan_hang: Mapped[str | None] = mapped_column(String(50))
    ten_ngan_hang: Mapped[str | None] = mapped_column(String(150))
    chi_nhanh_ngan_hang: Mapped[str | None] = mapped_column(String(150))

    # Thông tin công việc
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True)
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)
    bo_phan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("hr_departments.id"), nullable=True)
    to_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("hr_teams.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    chuc_vu_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("hr_positions.id"), nullable=True)

    # Chấm công & Hệ thống
    ma_van_tay: Mapped[str | None] = mapped_column(String(50))
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)

    # Hệ số cá nhân (Điều 11)
    he_so_ca_nhan: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=1.5)

    ngay_vao_lam: Mapped[date | None] = mapped_column(Date, default=date.today)
    ngay_nghi_viec: Mapped[date | None] = mapped_column(Date)

    # Thông tin tài xế / lơ xe (Mở rộng theo báo cáo Logistics)
    is_tai_xe: Mapped[bool] = mapped_column(Boolean, default=False)
    is_lo_xe: Mapped[bool] = mapped_column(Boolean, default=False)
    hang_bang_lai: Mapped[str | None] = mapped_column(String(20))
    ngay_het_han_bang: Mapped[date | None] = mapped_column(Date)
    vehicle_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("hr_vehicles.id"))

    trang_thai: Mapped[str] = mapped_column(String(20), default="dang_lam")  # dang_lam | tam_nghi | da_nghi

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(
            timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow)

    # Quan hệ
    phap_nhan: Mapped["PhapNhan | None"] = relationship("PhapNhan")
    phan_xuong: Mapped["PhanXuong | None"] = relationship("PhanXuong")
    bo_phan: Mapped["Department | None"] = relationship("Department", back_populates="employees")
    to_nhom: Mapped["Team | None"] = relationship(
        "Team", back_populates="employees", foreign_keys=[to_id],
    )
    chuc_vu: Mapped["Position | None"] = relationship("Position", back_populates="employees")
    user: Mapped["User | None"] = relationship("User")
    contracts: Mapped[list["LaborContract"]] = relationship("LaborContract", back_populates="employee")
    family_relations: Mapped[list["FamilyRelation"]] = relationship(
        "FamilyRelation", back_populates="employee", cascade="all, delete-orphan",
    )


class SafetyEquipment(Base):
    """Danh mục BHLĐ (Bảo hộ lao động) — nón, găng, giày, khẩu trang, dây đai..."""
    __tablename__ = "hr_safety_equipments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    ten: Mapped[str] = mapped_column(String(150), nullable=False)
    loai: Mapped[str | None] = mapped_column(String(50))  # non, giay, gang_tay, khau_trang, kinh, ao_phan_quang, day_dai
    don_vi: Mapped[str] = mapped_column(String(20), default="cái")  # cái, đôi, cặp, bộ
    han_su_dung_thang: Mapped[int | None] = mapped_column(Integer)  # số tháng trước khi đổi mới (định mức)
    don_gia: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    mo_ta: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class SafetyEquipmentIssue(Base):
    """Mỗi lần cấp BHLĐ cho 1 NV (audit + tính chi phí)."""
    __tablename__ = "hr_safety_equipment_issues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("hr_employees.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    equipment_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("hr_safety_equipments.id", ondelete="RESTRICT"), nullable=False,
    )
    ngay_cap: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    so_luong: Mapped[int] = mapped_column(Integer, default=1)
    han_su_dung_den: Mapped[date | None] = mapped_column(Date)  # auto = ngay_cap + equipment.han_su_dung_thang
    ly_do: Mapped[str | None] = mapped_column(String(50))  # cap_moi | thay_the | hong | mat
    nguoi_cap_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    employee: Mapped["Employee"] = relationship("Employee", foreign_keys=[employee_id])
    equipment: Mapped["SafetyEquipment"] = relationship("SafetyEquipment")
    nguoi_cap: Mapped["User | None"] = relationship("User", foreign_keys=[nguoi_cap_id])


class SafetyTraining(Base):
    """Buổi huấn luyện ATVSLĐ định kỳ (Nghị định 44/2016).

    4 nhóm đối tượng:
    - nhom_1: BGĐ + người sử dụng LĐ
    - nhom_2: Cán bộ phụ trách ATVSLĐ
    - nhom_3: NV làm việc có yêu cầu nghiêm ngặt (vận hành máy bế/in, hóa chất...)
    - nhom_4: NV còn lại (văn phòng)
    """
    __tablename__ = "hr_safety_trainings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ten_khoa_hoc: Mapped[str] = mapped_column(String(255), nullable=False)
    nhom_doi_tuong: Mapped[str] = mapped_column(String(20), nullable=False)  # nhom_1..nhom_4
    ngay_bat_dau: Mapped[date] = mapped_column(Date, nullable=False)
    ngay_ket_thuc: Mapped[date | None] = mapped_column(Date)
    don_vi_dao_tao: Mapped[str | None] = mapped_column(String(255))
    giang_vien: Mapped[str | None] = mapped_column(String(150))
    so_gio: Mapped[int | None] = mapped_column(Integer)
    chu_de: Mapped[str | None] = mapped_column(Text)
    chi_phi: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    trang_thai: Mapped[str] = mapped_column(String(20), default="sap_dien_ra")  # sap_dien_ra | da_dien_ra | huy
    file_url: Mapped[str | None] = mapped_column(String(500))  # link tài liệu / giáo trình
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    participants: Mapped[list["SafetyTrainingParticipant"]] = relationship(
        "SafetyTrainingParticipant", back_populates="training", cascade="all, delete-orphan",
    )


class SafetyTrainingParticipant(Base):
    """NV tham gia buổi huấn luyện ATVSLĐ."""
    __tablename__ = "hr_safety_training_participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    training_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("hr_safety_trainings.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("hr_employees.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    da_hoan_thanh: Mapped[bool] = mapped_column(Boolean, default=False)
    diem: Mapped[int | None] = mapped_column(Integer)  # 0-100
    so_chung_chi: Mapped[str | None] = mapped_column(String(100))
    ngay_cap_chung_chi: Mapped[date | None] = mapped_column(Date)
    han_chung_chi: Mapped[date | None] = mapped_column(Date, index=True)  # auto = +2 năm
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    training: Mapped["SafetyTraining"] = relationship("SafetyTraining", back_populates="participants")
    employee: Mapped["Employee"] = relationship("Employee")

    __table_args__ = (
        UniqueConstraint("training_id", "employee_id", name="uq_training_employee"),
    )


class WorkAccident(Base):
    """Báo cáo tai nạn lao động (Luật ATVSLĐ Điều 38-42 + TT 28/2021/TT-BLĐTBXH).

    Mức độ: nhe / nang / tu_vong. TNLĐ nặng phải báo Sở LĐ-TBXH trong 24h.
    """
    __tablename__ = "hr_work_accidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("hr_employees.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    ngay_xay_ra: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    gio_xay_ra: Mapped[str | None] = mapped_column(String(10))  # "14:30"
    dia_diem: Mapped[str | None] = mapped_column(String(255))
    mo_ta: Mapped[str] = mapped_column(Text, nullable=False)
    nguyen_nhan: Mapped[str | None] = mapped_column(Text)
    muc_do: Mapped[str] = mapped_column(String(20), nullable=False)  # nhe | nang | tu_vong
    so_ngay_nghi: Mapped[int] = mapped_column(Integer, default=0)
    chi_phi_y_te: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    bao_hiem_chi_tra: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    da_bao_cao_so_lao_dong: Mapped[bool] = mapped_column(Boolean, default=False)
    ngay_bao_cao: Mapped[date | None] = mapped_column(Date)
    file_bien_ban: Mapped[str | None] = mapped_column(String(500))
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    created_by_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))

    employee: Mapped["Employee"] = relationship("Employee", foreign_keys=[employee_id])
    created_by: Mapped["User | None"] = relationship("User", foreign_keys=[created_by_id])


class KPITemplate(Base):
    """Bộ tiêu chí KPI mẫu theo vị trí (vd 'NV Sale', 'Tổ trưởng SX')."""
    __tablename__ = "hr_kpi_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ten: Mapped[str] = mapped_column(String(255), nullable=False)
    mo_ta: Mapped[str | None] = mapped_column(Text)
    # Liên kết tới chức vụ (nullable — vẫn dùng được nếu chưa map theo Position)
    chuc_vu_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("hr_positions.id", ondelete="SET NULL"))
    bo_phan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("hr_departments.id", ondelete="SET NULL"))
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    criteria: Mapped[list["KPICriteria"]] = relationship(
        "KPICriteria", back_populates="template", cascade="all, delete-orphan",
        order_by="KPICriteria.thu_tu",
    )


class KPICriteria(Base):
    """Tiêu chí KPI trong 1 template."""
    __tablename__ = "hr_kpi_criteria"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    template_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("hr_kpi_templates.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    thu_tu: Mapped[int] = mapped_column(Integer, default=0)
    ten: Mapped[str] = mapped_column(String(255), nullable=False)
    mo_ta: Mapped[str | None] = mapped_column(Text)
    nhom: Mapped[str] = mapped_column(String(20), default="ket_qua")  # ket_qua | hanh_vi | phat_trien
    trong_so: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)  # 0-100, tổng/template = 100
    muc_tieu: Mapped[str | None] = mapped_column(String(255))  # target (vd "≥ 100 triệu/tháng")
    thang_diem_max: Mapped[int] = mapped_column(Integer, default=10)  # thường 5 hoặc 10

    template: Mapped["KPITemplate"] = relationship("KPITemplate", back_populates="criteria")


class KPICycle(Base):
    """Chu kỳ đánh giá KPI (vd 'Q3/2026', '6 tháng đầu 2026', 'Năm 2026')."""
    __tablename__ = "hr_kpi_cycles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ten: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    loai: Mapped[str] = mapped_column(String(20), default="quy")  # quy | 6_thang | nam
    ngay_bat_dau: Mapped[date] = mapped_column(Date, nullable=False)
    ngay_ket_thuc: Mapped[date] = mapped_column(Date, nullable=False)
    han_nv_tu_danh_gia: Mapped[date | None] = mapped_column(Date)
    han_ql_danh_gia: Mapped[date | None] = mapped_column(Date)
    # trang_thai: chuan_bi (chưa mở) / mo (đang đánh giá) / dong (đã đóng/duyệt)
    trang_thai: Mapped[str] = mapped_column(String(20), default="chuan_bi")
    # Trọng số NV/QL khi tính điểm cuối (thường 30/70 hoặc 40/60)
    ty_le_nv: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("30"))
    ty_le_ql: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("70"))
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class KPIEvaluation(Base):
    """Bản đánh giá KPI 1 NV trong 1 chu kỳ."""
    __tablename__ = "hr_kpi_evaluations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cycle_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("hr_kpi_cycles.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("hr_employees.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    template_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("hr_kpi_templates.id", ondelete="SET NULL"),
    )
    quan_ly_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("hr_employees.id", ondelete="SET NULL"),
    )  # NV cấp trên trực tiếp đánh giá

    # Tổng điểm (sau khi tính weighted): 0-10
    diem_nv_tu_cham: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    diem_quan_ly: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    diem_cuoi_cung: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    xep_loai: Mapped[str | None] = mapped_column(String(5))  # A/B/C/D/E

    # Nhận xét
    nhan_xet_nv: Mapped[str | None] = mapped_column(Text)
    nhan_xet_ql: Mapped[str | None] = mapped_column(Text)
    nhan_xet_bgd: Mapped[str | None] = mapped_column(Text)

    # Workflow: chua_lam | nv_dang_cham | cho_ql | cho_duyet | hoan_tat
    trang_thai: Mapped[str] = mapped_column(String(20), default="chua_lam")
    ngay_nv_submit: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ngay_ql_submit: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ngay_duyet: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow,
    )

    employee: Mapped["Employee"] = relationship("Employee", foreign_keys=[employee_id])
    quan_ly: Mapped["Employee | None"] = relationship("Employee", foreign_keys=[quan_ly_id])
    cycle: Mapped["KPICycle"] = relationship("KPICycle")
    template: Mapped["KPITemplate | None"] = relationship("KPITemplate")
    scores: Mapped[list["KPIScore"]] = relationship(
        "KPIScore", back_populates="evaluation", cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("cycle_id", "employee_id", name="uq_kpi_eval_cycle_emp"),
    )


class KPIScore(Base):
    """Điểm từng tiêu chí trong 1 bản đánh giá."""
    __tablename__ = "hr_kpi_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    evaluation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("hr_kpi_evaluations.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    # Snapshot từ KPICriteria — để giữ ngữ cảnh khi criteria bị sửa sau
    criteria_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("hr_kpi_criteria.id", ondelete="SET NULL"),
    )
    ten_tieu_chi: Mapped[str] = mapped_column(String(255), nullable=False)
    nhom: Mapped[str] = mapped_column(String(20), default="ket_qua")
    trong_so: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    thang_diem_max: Mapped[int] = mapped_column(Integer, default=10)

    diem_nv: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))  # NV tự cho
    diem_ql: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))  # QL cho
    ghi_chu_nv: Mapped[str | None] = mapped_column(Text)
    ghi_chu_ql: Mapped[str | None] = mapped_column(Text)

    evaluation: Mapped["KPIEvaluation"] = relationship("KPIEvaluation", back_populates="scores")


class HealthCheck(Base):
    """Lần khám sức khỏe định kỳ của nhân viên.

    Theo Thông tư 14/2013/TT-BYT:
    - NV bình thường: khám tối thiểu 1 lần/năm
    - NV làm việc nặng nhọc/độc hại/nguy hiểm: 6 tháng/lần
    - NV nữ: thêm khám phụ khoa định kỳ
    Phân loại sức khỏe: I (rất tốt) / II (tốt) / III (trung bình) / IV (yếu) / V (rất yếu)
    """
    __tablename__ = "hr_health_checks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("hr_employees.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    ngay_kham: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    # loai: dinh_ky | dot_xuat | truoc_tuyen_dung | sau_om_dau
    loai_kham: Mapped[str] = mapped_column(String(30), default="dinh_ky", nullable=False)
    # phan_loai: I | II | III | IV | V (theo TT 14/2013/TT-BYT)
    phan_loai_suc_khoe: Mapped[str | None] = mapped_column(String(5))
    noi_kham: Mapped[str | None] = mapped_column(String(255))
    bac_si: Mapped[str | None] = mapped_column(String(150))
    ket_luan: Mapped[str | None] = mapped_column(Text)
    benh_man_tinh: Mapped[str | None] = mapped_column(Text)  # liệt kê bệnh mãn tính nếu có
    file_url: Mapped[str | None] = mapped_column(String(500))  # link giấy khám sức khỏe (PDF/ảnh)
    chi_phi: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    # Auto-tính ngày khám tiếp theo (12 tháng cho NV thường, 6 tháng cho NV độc hại)
    ngay_kham_tiep_theo: Mapped[date | None] = mapped_column(Date, index=True)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    created_by_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))

    employee: Mapped["Employee"] = relationship("Employee", foreign_keys=[employee_id])
    created_by: Mapped["User | None"] = relationship("User", foreign_keys=[created_by_id])


class FamilyRelation(Base):
    """Quan hệ gia đình của nhân viên — Bố, mẹ, vợ/chồng, con, anh chị em..."""
    __tablename__ = "hr_family_relations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("hr_employees.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    ho_ten: Mapped[str] = mapped_column(String(150), nullable=False)
    nam_sinh: Mapped[int | None] = mapped_column(Integer)
    moi_quan_he: Mapped[str | None] = mapped_column(String(50))  # Bố / Mẹ / Vợ / Chồng / Con / ...
    nghe_nghiep: Mapped[str | None] = mapped_column(String(150))
    so_dien_thoai: Mapped[str | None] = mapped_column(String(20))
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    employee: Mapped["Employee"] = relationship("Employee", back_populates="family_relations")


class CheckInLocation(Base):
    """Địa điểm chấm công geo-fence — văn phòng, công xưởng, kho, dự án..."""
    __tablename__ = "hr_checkin_locations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ten: Mapped[str] = mapped_column(String(150), nullable=False)
    dia_chi: Mapped[str | None] = mapped_column(Text)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    ban_kinh_m: Mapped[int] = mapped_column(Integer, nullable=False, default=100)  # Bán kính cho phép (mét)
    mau_sac: Mapped[str | None] = mapped_column(String(20), default="#1677ff")  # Màu hiển thị trên map
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow,
    )


class BenefitPolicy(Base):
    """Chính sách phúc lợi — định nghĩa các loại phúc lợi và mức tiền cố định.

    Loại (loai):
      - sinh_nhat     : sinh nhật nhân viên (auto cron)
      - hieu          : đám tang (HR tạo thủ công)
      - hi            : đám cưới NV (HR tạo thủ công)
      - sinh_con      : NV sinh con (HR tạo thủ công)
      - tet_am        : Tết Âm Lịch
      - le_30_4       : Lễ 30/4 - 1/5
      - le_2_9        : Lễ Quốc Khánh 2/9
      - le_8_3        : Quốc tế Phụ nữ 8/3 (nữ)
      - le_20_10      : Phụ nữ Việt Nam 20/10 (nữ)
      - trung_thu     : Trung thu
      - khac          : Khác (tùy chỉnh)

    Đối tượng (ap_dung_cho):
      - all           : tất cả NV đang làm
      - female        : chỉ nữ
      - male          : chỉ nam
    """
    __tablename__ = "hr_benefit_policies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ten: Mapped[str] = mapped_column(String(150), nullable=False)
    loai: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    muc_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    ap_dung_cho: Mapped[str] = mapped_column(String(20), nullable=False, default="all")
    mo_ta: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow,
    )


class BenefitRecord(Base):
    """Bản ghi cấp phúc lợi cho 1 nhân viên cụ thể.

    Lưu ý: partial UNIQUE INDEX trên (employee_id, loai, thang_ap_dung, nam_ap_dung)
    cho các loại recurring (sinh_nhat, lễ Tết) được tạo qua migration script
    `scripts/migrate_benefits_unique.py` (PostgreSQL partial index syntax).
    """
    __tablename__ = "hr_benefit_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("hr_employees.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    policy_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("hr_benefit_policies.id", ondelete="SET NULL"), nullable=True,
    )
    loai: Mapped[str] = mapped_column(String(30), nullable=False)  # snapshot từ policy
    ngay_su_kien: Mapped[date] = mapped_column(Date, nullable=False)  # sinh nhật, ngày Tết...
    muc_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    # Kỳ lương áp dụng (cộng vào lương tháng nào)
    thang_ap_dung: Mapped[int] = mapped_column(Integer, nullable=False)
    nam_ap_dung: Mapped[int] = mapped_column(Integer, nullable=False)

    # trang_thai: de_xuat | da_duyet | da_chi | huy
    trang_thai: Mapped[str] = mapped_column(String(20), default="de_xuat", index=True)
    nguoi_de_xuat_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    nguoi_duyet_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    ngay_duyet: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Audit chi tiết — DB-side trail thay vì chỉ log file
    nguoi_chi_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    ngay_chi: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    nguoi_huy_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    ngay_huy: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ly_do_huy: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow,
    )

    employee: Mapped["Employee"] = relationship("Employee")
    policy: Mapped["BenefitPolicy | None"] = relationship("BenefitPolicy")
    de_xuat_by: Mapped["User | None"] = relationship("User", foreign_keys=[nguoi_de_xuat_id])
    duyet_by: Mapped["User | None"] = relationship("User", foreign_keys=[nguoi_duyet_id])
    chi_by: Mapped["User | None"] = relationship("User", foreign_keys=[nguoi_chi_id])
    huy_by: Mapped["User | None"] = relationship("User", foreign_keys=[nguoi_huy_id])


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

    trang_thai: Mapped[str] = mapped_column(String(20), default="hieu_luc")  # hieu_luc | het_han | tam_dung
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

    # loai_cham_cong: van_tay | thu_cong | app | app_geo
    loai: Mapped[str] = mapped_column(String(20), default="van_tay")

    tong_gio_thuc: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)  # Tổng giờ làm việc thực tế (Điều 9)
    so_cong: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=0)  # Công quy đổi
    so_gio_ot: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=0)

    # trang_thai: hop_le | thieu_ca | nghi_phep | nghi_khong_phep
    trang_thai: Mapped[str] = mapped_column(String(20), default="hop_le")
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    # ─── Sprint B: Geo-fence chấm công online ───
    # Vị trí lúc chấm công vào (snapshot — không cập nhật khi chấm ra)
    checkin_lat: Mapped[float | None] = mapped_column(Float)
    checkin_lng: Mapped[float | None] = mapped_column(Float)
    checkin_address: Mapped[str | None] = mapped_column(Text)
    checkin_selfie_url: Mapped[str | None] = mapped_column(String(500))
    checkin_location_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("hr_checkin_locations.id", ondelete="SET NULL"), nullable=True,
    )
    checkin_distance_m: Mapped[float | None] = mapped_column(Float)  # Khoảng cách đến địa điểm gần nhất
    # Vị trí lúc chấm ra
    checkout_lat: Mapped[float | None] = mapped_column(Float)
    checkout_lng: Mapped[float | None] = mapped_column(Float)
    checkout_address: Mapped[str | None] = mapped_column(Text)
    checkout_selfie_url: Mapped[str | None] = mapped_column(String(500))
    checkout_distance_m: Mapped[float | None] = mapped_column(Float)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(
            timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow)

    employee: Mapped["Employee"] = relationship("Employee")


class LeaveRequest(Base):
    """Đơn từ thống nhất (Sprint C — Workflow đơn từ).

    4 loại đơn dùng chung model: nghi_phep, tang_ca, cong_tac, ung_luong.
    Workflow 2 bước: cho_duyet → phong_ban_duyet → bgd_duyet (hoặc tu_choi/huy).
    """
    __tablename__ = "hr_leave_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("hr_employees.id"), nullable=False)

    # loai_don: nghi_phep | tang_ca | di_muon_ve_som | cong_tac | ung_luong
    loai_don: Mapped[str] = mapped_column(String(30), nullable=False)

    ngay_bat_dau: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ngay_ket_thuc: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    tong_ngay: Mapped[Decimal] = mapped_column(Numeric(4, 2))
    ly_do: Mapped[str | None] = mapped_column(Text)

    # ─── Sprint C: fields mở rộng theo loại đơn ───
    so_tien: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))      # Ứng lương / Công tác phí
    so_gio_ot: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))     # Tăng ca (giờ)
    dia_diem: Mapped[str | None] = mapped_column(String(255))            # Công tác đi đâu
    file_dinh_kem_url: Mapped[str | None] = mapped_column(String(500))   # Giấy bác sĩ, hóa đơn...

    # trang_thai: cho_duyet | phong_ban_duyet | bgd_duyet | tu_choi | huy
    trang_thai: Mapped[str] = mapped_column(String(20), default="cho_duyet")

    nguoi_duyet_dept_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    nguoi_duyet_bgd_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))

    y_kien_duyet: Mapped[str | None] = mapped_column(Text)
    ngay_duyet: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Đánh dấu đã xử lý hậu kỳ (ứng lương → đã trừ trong PayrollRun, công tác → kế toán đã chi)
    da_xu_ly: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    employee: Mapped["Employee"] = relationship("Employee")
    dept_approver: Mapped["User | None"] = relationship("User", foreign_keys=[nguoi_duyet_dept_id])
    bgd_approver: Mapped["User | None"] = relationship("User", foreign_keys=[nguoi_duyet_bgd_id])


class EmployeeHistory(Base):
    """Lịch sử thay đổi lương, hệ số, chức vụ"""
    __tablename__ = "hr_employee_histories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("hr_employees.id"), nullable=False)

    loai: Mapped[str] = mapped_column(String(50))  # he_so | chuc_vu | bo_phan | luong_cb
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
    loai_tai_lieu: Mapped[str] = mapped_column(String(50))  # CCCD | HOP_DONG | BANG_CAP | KHAC

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
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("hr_employees.id"), nullable=False)  # Tài xế

    so_km_chay: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    so_lit_dau: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    don_gia: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    thanh_tien: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)

    so_km_cuoi: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)  # (t)
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

    # loai = 'san_pham' | 'phu_cap' | 'khac': dùng các cột bên dưới
    ma_hang: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True)
    ten_hang: Mapped[str | None] = mapped_column(String(150), nullable=True)
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)
    cong_doan: Mapped[str | None] = mapped_column(String(50), nullable=True)
    phan_tram_luong_sp: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), default=100)
    don_gia: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), default=0)

    # loai = 'so_lop_giay': hệ số nhân máy sóng → tính lương sản phẩm
    # VD: HS_3_LOP=1.0, HS_5_LOP=2.0, HS_7_LOP=3.0
    ma_cau_hinh: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ten_cau_hinh: Mapped[str | None] = mapped_column(String(150), nullable=True)
    gia_tri: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)

    loai: Mapped[str] = mapped_column(String(50), nullable=False, default="san_pham")

    ghi_chu: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(
            timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow)
    phan_xuong: Mapped["PhanXuong | None"] = relationship("PhanXuong")


class HrProductionOutput(Base):
    """Bảng sản lượng tháng theo mã hàng × tổ × ca × ngày.

    Đầu vào cho engine tính lương sản phẩm (Sprint D.3).
    Workflow: cho_xac_nhan → da_xac_nhan (quản lý duyệt) → tính lương.

    Theo Điều 14 Quy chế Lương: sản lượng được tính lương phải đáp ứng:
    - Có mã hàng rõ ràng
    - Có đơn giá được ban hành
    - Đạt yêu cầu chất lượng
    - Được xác nhận bởi người có thẩm quyền
    """
    __tablename__ = "hr_production_outputs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ngay: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    # Mã hàng — khớp với PayrollConfig.ma_hang (loai='san_pham')
    ma_hang: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    bo_phan_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("hr_departments.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    to_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("hr_teams.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    # Ca: sang | chieu | dem | all (cho ca tổng nguyên ngày)
    ca: Mapped[str] = mapped_column(String(20), default="all", nullable=False)

    san_luong: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    san_luong_loi: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)  # không tính lương

    # Workflow xác nhận
    trang_thai: Mapped[str] = mapped_column(String(20), default="cho_xac_nhan", nullable=False)
    nguoi_xac_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    ngay_xac_nhan: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    created_by_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow,
    )

    bo_phan: Mapped["Department | None"] = relationship("Department", foreign_keys=[bo_phan_id])
    to_nhom: Mapped["Team | None"] = relationship("Team", foreign_keys=[to_id])
    nguoi_xac_nhan: Mapped["User | None"] = relationship("User", foreign_keys=[nguoi_xac_nhan_id])
    created_by: Mapped["User | None"] = relationship("User", foreign_keys=[created_by_id])


class PayrollAdjustment(Base):
    """Phụ cấp / Khấu trừ / Tạm ứng theo NV theo tháng (Điều 12 Quy chế).

    8 khoản CỘNG THÊM (loai='cong_them'):
      tang_thuong_sp · boi_duong · cong_nhat · pc_het_hang ·
      pc_cong_doan · pc_may_hong · pc_chuc_vu · pc_khac

    7 khoản KHẤU TRỪ (loai='khau_tru'):
      bhxh (8%) · bhyt (1.5%) · bhtn (1%) · tien_com · tam_ung ·
      cong_doan_phi · phat (gồm điều chỉnh khác)

    Engine D.3 sẽ cộng/trừ các record da_duyet vào lương cuối cùng.
    """
    __tablename__ = "hr_payroll_adjustments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("hr_employees.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    thang: Mapped[int] = mapped_column(Integer, nullable=False, index=True)  # 1-12
    nam: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    # loai: cong_them | khau_tru
    loai: Mapped[str] = mapped_column(String(20), nullable=False)
    # sub_loai: tang_thuong_sp/boi_duong/cong_nhat/pc_*/bhxh/bhyt/bhtn/tien_com/tam_ung/cong_doan_phi/phat
    sub_loai: Mapped[str] = mapped_column(String(30), nullable=False)
    so_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)

    ngay_phat_sinh: Mapped[date | None] = mapped_column(Date)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    # trang_thai: du_thao | da_duyet
    trang_thai: Mapped[str] = mapped_column(String(20), default="du_thao", nullable=False)

    nguoi_duyet_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    ngay_duyet: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    created_by_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow,
    )

    employee: Mapped["Employee"] = relationship("Employee", foreign_keys=[employee_id])
    nguoi_duyet: Mapped["User | None"] = relationship("User", foreign_keys=[nguoi_duyet_id])
    created_by: Mapped["User | None"] = relationship("User", foreign_keys=[created_by_id])


class PayrollRun(Base):
    """Bảng lương tháng đã chốt"""
    __tablename__ = "hr_payroll_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    thang: Mapped[int] = mapped_column(Integer)  # 1-12
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

    # Sprint D.3: track chi tiết engine tính lương sản phẩm
    cong_quy_doi: Mapped[Decimal] = mapped_column(Numeric(8, 4), default=0)  # Điều 9
    he_so_ca_nhan_snapshot: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)  # Điều 10
    trong_so_ca_nhan: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=0)  # Điều 10
    bu_toi_thieu_vung: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)  # Điều 4.8
    bo_phan_id_snapshot: Mapped[int | None] = mapped_column(Integer)  # snapshot bộ phận khi tính
    ghi_chu_calc: Mapped[str | None] = mapped_column(Text)  # nhật ký engine

    trang_thai: Mapped[str] = mapped_column(String(20), default="du_thao")  # du_thao | da_chot | da_thanh_toan

    # Mốc HR chốt bảng lương — dùng tính hạn khiếu nại 15 ngày làm việc (Điều 16)
    ngay_chot: Mapped[date | None] = mapped_column(Date)

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

    trang_thai: Mapped[str] = mapped_column(String(20), default="moi")  # moi | da_duyet | huy

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))

    employee: Mapped["Employee"] = relationship("Employee")


class PayrollComplaint(Base):
    """Khiếu nại tiền lương theo Điều 16 Quy chế Lương Nam Phương.

    Quy trình 4 bước:
      1. Người lao động phản hồi (tao moi)
      2. Nhân sự / quản lý phối hợp kiểm tra (dang_xu_ly)
      3a. Có sai sót → điều chỉnh vào kỳ lương gần nhất hoặc thanh toán bổ sung (co_sai_sot)
      3b. Không có sai sót → nhân sự giải thích căn cứ tính lương (khong_sai_sot)

    Thời hạn phản hồi: trong vòng 15 ngày làm việc kể từ ngày nhận bảng lương
    (auto-tính `han_chot` = ngay_nhan_phieu + 15 ngày làm việc).
    """
    __tablename__ = "hr_payroll_complaints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("hr_employees.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    payroll_run_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("hr_payroll_runs.id", ondelete="SET NULL"), index=True,
    )
    thang: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    nam: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    ly_do: Mapped[str] = mapped_column(Text, nullable=False)
    so_tien_khieu_nai: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    bang_chung: Mapped[str | None] = mapped_column(Text)

    ngay_nhan_phieu: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    han_chot: Mapped[date] = mapped_column(Date, nullable=False)

    # Trạng thái: moi | dang_xu_ly | co_sai_sot | khong_sai_sot | het_han
    trang_thai: Mapped[str] = mapped_column(String(20), default="moi", nullable=False)

    nguoi_xu_ly_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    ngay_xu_ly: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ket_qua: Mapped[str | None] = mapped_column(Text)
    so_tien_dieu_chinh: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    adjustment_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("hr_payroll_adjustments.id", ondelete="SET NULL"),
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    created_by_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow,
    )

    employee: Mapped["Employee"] = relationship("Employee", foreign_keys=[employee_id])
    nguoi_xu_ly: Mapped["User | None"] = relationship("User", foreign_keys=[nguoi_xu_ly_id])
    created_by: Mapped["User | None"] = relationship("User", foreign_keys=[created_by_id])
