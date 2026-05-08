import os
import bcrypt
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def _hash_password(plain: str) -> str:
    # Day la logic giong het trong app/routers/auth.py
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

def create_admin():
    engine = create_engine(DATABASE_URL)
    hashed_password = _hash_password("admin123")
    
    with engine.connect() as conn:
        print("Creating admin user with system-native bcrypt...")
        # Bang roles cot la ma_vai_tro, ten_vai_tro
        conn.execute(text("INSERT INTO roles (id, ma_vai_tro, ten_vai_tro, trang_thai, created_at) VALUES (1, 'ADMIN', 'Administrator', true, now()) ON CONFLICT (id) DO NOTHING"))
        
        # Tao admin
        conn.execute(text(f"""
            INSERT INTO users (username, ho_ten, password_hash, role_id, trang_thai, created_at, updated_at)
            VALUES ('admin', 'Administrator', '{hashed_password}', 1, true, now(), now())
            ON CONFLICT (username) DO UPDATE SET password_hash = '{hashed_password}', trang_thai = true
        """))
        conn.commit()
        print("Admin user 'admin' with password 'admin123' is ready.")

if __name__ == "__main__":
    create_admin()
