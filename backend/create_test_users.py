import os
import bcrypt
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path)
DATABASE_URL = os.getenv("DATABASE_URL")

def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

def create_test_users():
    engine = create_engine(DATABASE_URL)
    hashed_password = _hash_password("123456")
    
    roles_data = [
        ("TRUONG_PHONG_SALE_ADMIN", "Trưởng phòng Sale Admin"),
        ("KE_TOAN_CONG_NO", "Kế toán công nợ"),
        ("SALE_ADMIN", "Sale Admin"),
        ("KE_TOAN_TRUONG", "Kế toán trưởng"),
        ("KETOAN_TO_TRUONG", "Tổ trưởng - Phòng Kế Toán"),
        ("SAN_XUAT_THO", "Thợ - Khối Sản Xuất"),
        ("KETOAN_NHAN_VIEN", "Nhân viên - Phòng Kế Toán"),
        ("BGD_TO_TRUONG", "Tổ trưởng - Ban Giám Đốc"),
        ("SALE_ADMIN_NHAN_VIEN", "Nhân viên - Sale Admin"),
        ("SALE_ADMIN_TO_TRUONG", "Tổ trưởng - Sale Admin"),
        ("NHAN_SU_NHAN_VIEN", "Nhân viên - Phòng Nhân Sự"),
        ("KHO_NHAN_VIEN", "Nhân viên - Kho"),
        ("SAN_XUAT_TO_TRUONG", "Tổ trưởng - Khối Sản Xuất"),
        ("SAN_XUAT_GIAM_SAT", "Giám sát - Khối Sản Xuất"),
        ("BGD_NHAN_VIEN", "Nhân viên - Ban Giám Đốc"),
        ("NHAN_SU_TO_TRUONG", "Tổ trưởng - Phòng Nhân Sự"),
        ("KINH_DOANH_NHAN_VIEN", "Nhân viên - Phòng Kinh Doanh"),
        ("BGD_GIAM_DOC", "Giám đốc - Ban Giám Đốc"),
        ("KINH_DOANH_TO_TRUONG", "Tổ trưởng - Phòng Kinh Doanh"),
        ("THIET_KE_TO_TRUONG", "Tổ trưởng - Phòng Thiết Kế"),
        ("THIET_KE_NHAN_VIEN", "Nhân viên - Phòng Thiết Kế"),
        ("KHO_TO_TRUONG", "Tổ trưởng - Kho"),
        ("ADMIN", "Administrator")
    ]
    
    with engine.connect() as conn:
        print("Bat dau tao 23 Roles va Users...")
        for ma_vai_tro, ten_vai_tro in roles_data:
            # 1. Tao Role (Neu chua co thi tao, neu co thi ignore hoac update)
            conn.execute(text(f"""
                INSERT INTO roles (ma_vai_tro, ten_vai_tro, mo_ta, trang_thai, created_at) 
                VALUES ('{ma_vai_tro}', '{ten_vai_tro}', 'Test Role', true, now()) 
                ON CONFLICT (ma_vai_tro) DO UPDATE SET ten_vai_tro = '{ten_vai_tro}'
            """))
            
            # 2. Lay ID cua Role vua tao/update
            result = conn.execute(text(f"SELECT id FROM roles WHERE ma_vai_tro = '{ma_vai_tro}'")).fetchone()
            if not result:
                print(f"Loi: Khong tim thay Role {ma_vai_tro}")
                continue
            role_id = result[0]
            
            # 3. Tao User
            # username = ma_vai_tro (VD: SALE_ADMIN)
            # password = 123456
            conn.execute(text(f"""
                INSERT INTO users (username, ho_ten, password_hash, role_id, trang_thai, created_at, updated_at)
                VALUES ('{ma_vai_tro}', '{ten_vai_tro}', '{hashed_password}', {role_id}, true, now(), now())
                ON CONFLICT (username) DO UPDATE 
                SET password_hash = '{hashed_password}', role_id = {role_id}, ho_ten = '{ten_vai_tro}', trang_thai = true
            """))
            
        conn.commit()
        print("Da tao/cap nhat thanh cong 23 users voi mat khau 123456!")

if __name__ == "__main__":
    create_test_users()
