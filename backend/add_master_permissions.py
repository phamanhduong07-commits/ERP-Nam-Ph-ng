import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path)
DATABASE_URL = os.getenv("DATABASE_URL")

def add_master_permissions():
    engine = create_engine(DATABASE_URL)
    
    perms_data = [
        ("master.users.view", "Xem danh mục hệ thống", "Danh mục"),
        ("master.users.manage", "Quản lý danh mục hệ thống", "Danh mục"),
        ("master.customers.view", "Xem danh mục khách hàng", "Danh mục"),
        ("master.customers.manage", "Quản lý danh mục khách hàng", "Danh mục"),
        ("master.products.view", "Xem danh mục hàng hóa", "Danh mục"),
        ("master.products.manage", "Quản lý danh mục hàng hóa", "Danh mục"),
        ("master.suppliers.view", "Xem danh mục nhà cung cấp", "Danh mục"),
        ("master.suppliers.manage", "Quản lý danh mục nhà cung cấp", "Danh mục"),
        ("master.materials.view", "Xem danh mục vật tư", "Danh mục"),
        ("master.materials.manage", "Quản lý danh mục vật tư", "Danh mục"),
        ("master.other.view", "Xem danh mục khác", "Danh mục"),
        ("master.other.manage", "Quản lý danh mục khác", "Danh mục"),
    ]
    
    with engine.connect() as conn:
        for ma_quyen, ten_quyen, nhom in perms_data:
            conn.execute(text(f"""
                INSERT INTO permissions (ma_quyen, ten_quyen, nhom, trang_thai, created_at) 
                VALUES ('{ma_quyen}', '{ten_quyen}', '{nhom}', true, now()) 
                ON CONFLICT (ma_quyen) DO UPDATE SET ten_quyen = '{ten_quyen}', nhom = '{nhom}'
            """))
        conn.commit()
        print("Da them cac quyen Danh muc!")

if __name__ == "__main__":
    add_master_permissions()
