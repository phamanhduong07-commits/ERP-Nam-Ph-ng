import os
import sys
from datetime import datetime, timezone
from sqlalchemy import create_engine, text

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.config import settings

def main():
    engine = create_engine(settings.DATABASE_URL)
    now = datetime.now(timezone.utc)
    
    with engine.begin() as conn:
        print("Inserting dummy records...")
        
        # 1. Insert dummy Material Groups 12 and 13 if they don't exist
        for group_id, code, name in [(12, 'DUMMY_NHOM_12', 'Dummy Nhom 12'), (13, 'DUMMY_NHOM_13', 'Dummy Nhom 13')]:
            res = conn.execute(text("SELECT id FROM material_groups WHERE id = :id"), {"id": group_id}).fetchone()
            if not res:
                conn.execute(
                    text("""
                        INSERT INTO material_groups (id, ma_nhom, ten_nhom, la_nhom_giay, trang_thai, created_at)
                        VALUES (:id, :code, :name, false, true, :created_at)
                    """),
                    {"id": group_id, "code": code, "name": name, "created_at": now}
                )
                print(f"Inserted dummy material_group: id={group_id}")
                
        # 2. Insert dummy Warehouses 5 and 8 if they don't exist
        for wh_id, code, name in [(5, 'DUMMY_KHO_5', 'Dummy Kho 5'), (8, 'DUMMY_KHO_8', 'Dummy Kho 8')]:
            res = conn.execute(text("SELECT id FROM warehouses WHERE id = :id"), {"id": wh_id}).fetchone()
            if not res:
                conn.execute(
                    text("""
                        INSERT INTO warehouses (id, ma_kho, ten_kho, loai_kho, trang_thai, created_at)
                        VALUES (:id, :code, :name, 'ao', true, :created_at)
                    """),
                    {"id": wh_id, "code": code, "name": name, "created_at": now}
                )
                print(f"Inserted dummy warehouse: id={wh_id}")
                
        # 3. Insert dummy User 1 if they don't exist
        res = conn.execute(text("SELECT id FROM users WHERE id = 1")).fetchone()
        if not res:
            # We need a valid role_id. Let's find one first (e.g. 11 or 13)
            role_res = conn.execute(text("SELECT id FROM roles ORDER BY id LIMIT 1")).fetchone()
            if not role_res:
                # If there are no roles, insert a dummy role first
                conn.execute(
                    text("""
                        INSERT INTO roles (id, ma_vai_tro, ten_vai_tro, trang_thai, created_at)
                        VALUES (11, 'KE_TOAN_TRUONG', 'Kế toán trưởng', true, :created_at)
                    """),
                    {"created_at": now}
                )
                role_id = 11
                print("Inserted dummy role: id=11")
            else:
                role_id = role_res[0]
                
            conn.execute(
                text("""
                    INSERT INTO users (id, username, ho_ten, password_hash, role_id, trang_thai, must_change_password, created_at, updated_at)
                    VALUES (1, 'dummy_user_1', 'Dummy User 1', 'dummy_hash', :role_id, true, false, :created_at, :updated_at)
                """),
                {"role_id": role_id, "created_at": now, "updated_at": now}
            )
            print("Inserted dummy user: id=1")
            
        # 4. Insert dummy Products 9952 and 9953 if they don't exist
        for prod_id, code, name in [(9952, 'DUMMY_PROD_9952', 'Dummy Product 9952'), (9953, 'DUMMY_PROD_9953', 'Dummy Product 9953')]:
            res = conn.execute(text("SELECT id FROM products WHERE id = :id"), {"id": prod_id}).fetchone()
            if not res:
                conn.execute(
                    text("""
                        INSERT INTO products (id, ma_amis, ten_hang, so_lop, so_mau, loai_in, ghim, dan, chap_xa, dvt, gia_ban, gia_mua, gia_dinh_muc, ton_toi_thieu, khong_tinh_nxt, trang_thai, created_at, updated_at)
                        VALUES (:id, :code, :name, 3, 0, 0, false, false, 0, 'Thùng', 0, 0, 0, 0, false, true, :created_at, :updated_at)
                    """),
                    {"id": prod_id, "code": code, "name": name, "created_at": now, "updated_at": now}
                )
                print(f"Inserted dummy product: id={prod_id}")
                
    print("All dummy inserts completed!")

if __name__ == "__main__":
    main()
