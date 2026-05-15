import sys
import os

# Add the project root to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import SessionLocal
from app.models.hr import Department, Position, PayrollConfig
from app.models.auth import Role
from decimal import Decimal

def seed_hr_data():
    db = SessionLocal()
    try:
        # 1. Seed Payroll Configs
        # configs = [
        #     ("HS_3_LOP", "Hệ số lương giấy 3 lớp", "so_lop_giay", 1.0),
        #     ("HS_5_LOP", "Hệ số lương giấy 5 lớp", "so_lop_giay", 2.0),
        #     ("HS_7_LOP", "Hệ số lương giấy 7 lớp", "so_lop_giay", 3.0),
        # ]
        # 
        # for ma, ten, loai, gia_tri in configs:
        #     if not db.query(PayrollConfig).filter(PayrollConfig.ma_hang == ma).first():
        #         cfg = PayrollConfig(ma_hang=ma, ten_hang=ten, loai=loai, don_gia=Decimal(str(gia_tri)))
        #         db.add(cfg)
        #         print(f"Added PayrollConfig: {ma}")

        # 2. Seed Departments
        # BGD, Kế toán, Sale Admin, Kinh Doanh, Nhân Sự, Thiết Kế, Kho, Sản xuất
        departments = [
            ("BGD", "Ban Giám Đốc", None),
            ("KETOAN", "Phòng Kế Toán", None),
            ("SALE_ADMIN", "Sale Admin", None),
            ("KINH_DOANH", "Phòng Kinh Doanh", None),
            ("NHAN_SU", "Phòng Nhân Sự", None),
            ("THIET_KE", "Phòng Thiết Kế", None),
            ("KHO", "Kho", None),
            ("SAN_XUAT", "Khối Sản Xuất", None),
        ]
        
        dept_objs = {}
        for ma, ten, p_ma in departments:
            obj = db.query(Department).filter(Department.ma_bo_phan == ma).first()
            if not obj:
                obj = Department(ma_bo_phan=ma, ten_bo_phan=ten)
                db.add(obj)
                db.flush()
            dept_objs[ma] = obj

        # 3. Seed Positions
        # Giám đốc, Giám sát, Tổ trưởng, Thợ, Nhân viên
        positions = [
            ("GIAM_DOC", "Giám đốc", 1),
            ("GIAM_SAT", "Giám sát", 2),
            ("TO_TRUONG", "Tổ trưởng", 3),
            ("NHAN_VIEN", "Nhân viên", 4),
            ("THO", "Thợ", 5),
        ]
        
        pos_objs = {}
        for ma, ten, level in positions:
            obj = db.query(Position).filter(Position.ma_chuc_vu == ma).first()
            if not obj:
                obj = Position(ma_chuc_vu=ma, ten_chuc_vu=ten, cap_bac=level)
                db.add(obj)
                db.flush()
            pos_objs[ma] = obj

        # 4. Generate Roles for the Matrix
        # Every department has Tổ trưởng and Nhân viên. BGD has Giám đốc. Sản xuất has Giám sát, Tổ trưởng, Thợ.
        matrix_combinations = [
            ("BGD", "GIAM_DOC"), ("BGD", "TO_TRUONG"), ("BGD", "NHAN_VIEN"),
            ("KETOAN", "TO_TRUONG"), ("KETOAN", "NHAN_VIEN"),
            ("SALE_ADMIN", "TO_TRUONG"), ("SALE_ADMIN", "NHAN_VIEN"),
            ("KINH_DOANH", "TO_TRUONG"), ("KINH_DOANH", "NHAN_VIEN"),
            ("NHAN_SU", "TO_TRUONG"), ("NHAN_SU", "NHAN_VIEN"),
            ("THIET_KE", "TO_TRUONG"), ("THIET_KE", "NHAN_VIEN"),
            ("KHO", "TO_TRUONG"), ("KHO", "NHAN_VIEN"),
            ("SAN_XUAT", "GIAM_SAT"), ("SAN_XUAT", "TO_TRUONG"), ("SAN_XUAT", "THO"),
        ]

        for dept_ma, pos_ma in matrix_combinations:
            role_code = f"{dept_ma}_{pos_ma}"
            role_name = f"{pos_objs[pos_ma].ten_chuc_vu} - {dept_objs[dept_ma].ten_bo_phan}"
            
            role = db.query(Role).filter(Role.ma_vai_tro == role_code).first()
            if not role:
                role = Role(ma_vai_tro=role_code, ten_vai_tro=role_name, mo_ta="Quyền tự động theo phòng ban & chức vụ")
                db.add(role)

        db.commit()
        print("Seeding completed successfully!")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_hr_data()
