"""
Script: Gán TẤT CẢ quyền trong DB cho role ADMIN
Chạy 1 lần sau khi thêm permissions mới vào hệ thống.
"""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path)
DATABASE_URL = os.getenv("DATABASE_URL")

def seed_admin_all_permissions():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        # Lay ID cua role ADMIN
        admin_role = conn.execute(text("SELECT id FROM roles WHERE ma_vai_tro = 'ADMIN'")).fetchone()
        if not admin_role:
            print("Khong tim thay role ADMIN trong DB!")
            return
        admin_role_id = admin_role[0]

        # Lay tat ca permission IDs
        all_perms = conn.execute(text("SELECT id FROM permissions WHERE trang_thai = true")).fetchall()
        perm_ids = [r[0] for r in all_perms]
        print(f"Tim thay {len(perm_ids)} quyen trong DB, gan cho ADMIN...")

        # Xoa quyen cu cua ADMIN (de assign lai sach)
        conn.execute(text(f"DELETE FROM role_permissions WHERE role_id = {admin_role_id}"))

        # Gan tat ca quyen cho ADMIN
        for perm_id in perm_ids:
            conn.execute(text(f"""
                INSERT INTO role_permissions (role_id, permission_id, created_at)
                VALUES ({admin_role_id}, {perm_id}, now())
                ON CONFLICT DO NOTHING
            """))

        conn.commit()
        print(f"Da gan thanh cong {len(perm_ids)} quyen cho ADMIN!")

if __name__ == "__main__":
    seed_admin_all_permissions()
